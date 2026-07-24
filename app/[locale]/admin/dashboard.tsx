"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { logAction } from "@/lib/audit";
import { useSectors } from "@/lib/useSectors";
import type { PolicyTrack } from "@/lib/kyc";
import {
  buildDecisionChecks,
  trackForCountry,
  trackUpdate,
  LIGHT_SIGNALS,
  type LightSignal,
} from "@/lib/verificationDecision";
import { Building2, Flag, UserCheck } from "lucide-react";

type PendingBusiness = {
  id: string;
  name: string;
  // NOTE: the column is primary_sector. It was renamed from `sector` by the
  // multi-sector migration (2026-07-21) and this query still asked for `sector`,
  // so PostgREST errored and the tab silently rendered "nothing pending".
  primary_sector: string | null;
  secondary_sectors: string[] | null;
  registration_number: string | null;
  country_of_registration: string | null;
  business_email: string | null;
  credentials: Record<string, unknown> | null;
  social_links: Record<string, unknown> | null;
  created_at: string;
};
type PendingVerification = {
  id: string;
  subject_id: string;
  provider: string | null;
  document_type: string | null;
  document_country: string | null;
  checks: Record<string, unknown> | null;
  policy_track: "us" | "nepal";
  created_at: string;
  profiles:
    | { name: string | null; sectors: string[] | null; country: string | null }
    | { name: string | null; sectors: string[] | null; country: string | null }[]
    | null;
};
/** Per-row reviewer input for the light model. */
type Decision = { signal: LightSignal; reason: string; credentialCheck: boolean; track: PolicyTrack | "" };
type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  status: string;
  created_at: string;
};

export default function AdminDashboard() {
  const t = useTranslations("admin");
  const sectors = useSectors();
  const supabase = createClient();
  const [tab, setTab] = useState<"businesses" | "people" | "reports">("businesses");
  const [businesses, setBusinesses] = useState<PendingBusiness[]>([]);
  const [verifications, setVerifications] = useState<PendingVerification[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const decisionFor = (id: string, inferredTrack: PolicyTrack | null): Decision =>
    decisions[id] ?? {
      signal: "self_attestation",
      reason: "",
      credentialCheck: false,
      track: inferredTrack ?? "",
    };
  const setDecision = (id: string, patch: Partial<Decision>, inferredTrack: PolicyTrack | null) =>
    setDecisions((prev) => ({ ...prev, [id]: { ...decisionFor(id, inferredTrack), ...patch } }));

  async function loadAll() {
    setLoading(true);
    setActionError(null);
    const [
      { data: biz, error: bizError },
      { data: ver, error: verError },
      { data: rep, error: repError },
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select(
          "id, name, primary_sector, secondary_sectors, registration_number, country_of_registration, business_email, credentials, social_links, created_at"
        )
        .eq("verification_status", "unverified")
        .not("registration_number", "is", null),
      supabase
        .from("verification_records")
        .select(
          "id, subject_id, provider, document_type, document_country, checks, policy_track, created_at, profiles:subject_id ( name, sectors, country )"
        )
        .eq("subject_type", "user")
        .eq("status", "pending"),
      supabase
        .from("reports")
        .select("id, target_type, target_id, reason, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ]);
    // Surface load failures. A silently-swallowed error here is exactly how the
    // businesses tab spent weeks reporting "nothing pending" while its query was
    // asking for a column that no longer existed.
    const loadError = bizError ?? verError ?? repError;
    if (loadError) setActionError(loadError.message);
    setBusinesses(biz ?? []);
    setVerifications(ver ?? []);
    setReports(rep ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function currentAdminId(): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  }

  // Businesses have no per-track columns, so the decision lands on
  // businesses.verification_status directly — but it is ALSO logged to
  // verification_records so people and businesses share one reviewable trail.
  async function decideBusiness(b: PendingBusiness, approve: boolean) {
    setActionError(null);
    const d = decisionFor(b.id, trackForCountry(b.country_of_registration));
    if (!d.track) {
      setActionError(t("trackRequired"));
      return;
    }
    const reviewerId = await currentAdminId();

    const { error: bizError } = approve
      ? await supabase
          .from("businesses")
          .update({ verification_status: "verified", verified_at: new Date().toISOString() })
          .eq("id", b.id)
      : await supabase.from("businesses").update({ registration_number: null }).eq("id", b.id);
    if (bizError) {
      setActionError(bizError.message);
      return;
    }

    const { error: recordError } = await supabase.from("verification_records").insert({
      subject_type: "business",
      subject_id: b.id,
      provider: "light_review",
      policy_track: d.track,
      status: approve ? "passed" : "failed",
      reviewer_id: reviewerId,
      checks: buildDecisionChecks({
        approve,
        signal: d.signal,
        reason: d.reason,
        credentialCheckNeeded: d.credentialCheck,
      }),
    });
    if (recordError) {
      setActionError(recordError.message);
      return;
    }

    await logAction(
      approve ? "business_verification_approved" : "business_verification_rejected",
      "business",
      b.id,
      { policy_track: d.track, signal: d.signal, credential_check_needed: d.credentialCheck }
    );
    setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
  }
  const approveBusiness = (b: PendingBusiness) => decideBusiness(b, true);
  const rejectBusiness = (b: PendingBusiness) => decideBusiness(b, false);

  async function decidePerson(v: PendingVerification, approve: boolean) {
    setActionError(null);
    const d = decisionFor(v.id, v.policy_track);
    const reviewerId = await currentAdminId();

    // Record the reviewer's decision and what they actually saw. checks merges
    // over whatever the submitter recorded, so the claim and the review both
    // survive on one row.
    const { error: recordError } = await supabase
      .from("verification_records")
      .update({
        status: approve ? "passed" : "failed",
        reviewer_id: reviewerId,
        checks: buildDecisionChecks({
          approve,
          signal: d.signal,
          reason: d.reason,
          credentialCheckNeeded: d.credentialCheck,
          existingChecks: v.checks,
        }),
      })
      .eq("id", v.id);
    if (recordError) {
      setActionError(recordError.message);
      return;
    }
    // Mirror the decision onto the profile's track. Without this the record
    // flips but the member's standing never changes. profiles.verification_status
    // / verified_at / bridge are GENERATED — writing these base columns is what
    // drives them (and the user_trust_tiers view) automatically.
    const { error: profileError } = await supabase
      .from("profiles")
      .update(trackUpdate(v.policy_track, approve ? "verified" : "rejected"))
      .eq("id", v.subject_id);
    if (profileError) {
      setActionError(profileError.message);
      return;
    }
    await logAction(
      approve ? "profile_verification_approved" : "profile_verification_rejected",
      "user",
      v.subject_id,
      {
        record_id: v.id,
        policy_track: v.policy_track,
        signal: d.signal,
        credential_check_needed: d.credentialCheck,
      }
    );
    setVerifications((prev) => prev.filter((r) => r.id !== v.id));
  }

  const approvePerson = (v: PendingVerification) => decidePerson(v, true);
  const rejectPerson = (v: PendingVerification) => decidePerson(v, false);

  async function dismissReport(id: string) {
    await supabase.from("reports").update({ status: "dismissed" }).eq("id", id);
    await logAction("report_dismissed", "report", id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }
  async function actionReport(id: string) {
    await supabase.from("reports").update({ status: "actioned" }).eq("id", id);
    await logAction("report_actioned", "report", id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  const sectorName = (slug: string | null) =>
    slug ? sectors.find((s) => s.slug === slug)?.name ?? slug : t("noSector");

  // Compact preview of a self-attested jsonb blob — keys only, so the reviewer
  // sees WHAT was claimed without the row turning into a wall of JSON.
  const summarize = (obj: Record<string, unknown> | null): string | null => {
    if (!obj) return null;
    const keys = Object.keys(obj);
    return keys.length ? keys.join(", ") : null;
  };

  /** Read-only evidence lines; renders nothing for absent values. */
  function Evidence({ items }: { items: [string, string | null | undefined][] }) {
    const present = items.filter(([, value]) => value);
    if (present.length === 0) {
      return <p className="mt-1.5 text-xs italic text-ink-soft">{t("noEvidence")}</p>;
    }
    return (
      <dl className="mt-1.5 space-y-0.5">
        {present.map(([label, value]) => (
          <div key={label} className="flex gap-1.5 text-xs">
            <dt className="shrink-0 text-ink-soft">{label}:</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  /** Light-model reviewer inputs: which signal was seen, why, and whether a
   *  higher-risk category still wants a manual credential lookup later. */
  function ReviewControls({
    id,
    inferred,
    trackLocked = false,
  }: {
    id: string;
    inferred: PolicyTrack | null;
    trackLocked?: boolean;
  }) {
    const d = decisionFor(id, inferred);
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <label className="flex items-center gap-1 text-xs text-ink-soft">
          {t("signalLabel")}
          <select
            value={d.signal}
            onChange={(e) => setDecision(id, { signal: e.target.value as LightSignal }, inferred)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
          >
            {LIGHT_SIGNALS.map((s) => (
              <option key={s} value={s}>
                {t(`signal_${s}` as "signal_self_attestation")}
              </option>
            ))}
          </select>
        </label>

        {!trackLocked && (
          <label className="flex items-center gap-1 text-xs text-ink-soft">
            {t("sandboxLabel")}
            <select
              value={d.track}
              onChange={(e) => setDecision(id, { track: e.target.value as PolicyTrack | "" }, inferred)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
            >
              <option value="">{t("sandboxChoose")}</option>
              <option value="us">US</option>
              <option value="nepal">Nepal</option>
            </select>
          </label>
        )}

        <input
          value={d.reason}
          onChange={(e) => setDecision(id, { reason: e.target.value }, inferred)}
          placeholder={t("reasonPlaceholder")}
          className="min-w-[160px] flex-1 rounded-md border border-border-input px-2 py-1 text-xs focus:border-primary"
        />

        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={d.credentialCheck}
            onChange={(e) => setDecision(id, { credentialCheck: e.target.checked }, inferred)}
            className="h-3.5 w-3.5 accent-primary"
          />
          {t("credentialCheckNeeded")}
        </label>
      </div>
    );
  }

  function DecisionButtons({ onReject, onApprove }: { onReject: () => void; onApprove: () => void }) {
    return (
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onReject} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg">
          {t("reject")}
        </button>
        <button onClick={onApprove} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-pressed">
          {t("approve")}
        </button>
      </div>
    );
  }

  const TABS = [
    { id: "businesses" as const, label: t("businessVerification"), icon: Building2, count: businesses.length },
    { id: "people" as const, label: t("profileVerification"), icon: UserCheck, count: verifications.length },
    { id: "reports" as const, label: t("reports"), icon: Flag, count: reports.length },
  ];

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="mt-3 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? "border-primary text-primary-pressed" : "border-transparent text-ink-soft"
            }`}
          >
            <t.icon size={14} /> {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-on-accent">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {actionError && (
        <p role="alert" className="mt-3 rounded-md border border-border bg-bg px-3 py-2 text-xs text-accent">
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {tab === "businesses" &&
            (businesses.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("nothingPending")}</p>
            ) : (
              businesses.map((b) => {
                const inferred = trackForCountry(b.country_of_registration);
                return (
                  <div key={b.id} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {sectorName(b.primary_sector)}
                      {(b.secondary_sectors ?? []).length > 0 &&
                        ` (+${(b.secondary_sectors ?? []).length})`}{" "}
                      · {b.country_of_registration ?? "—"} · {t("regNumberLabel")}:{" "}
                      {b.registration_number}
                    </p>
                    <Evidence
                      items={[
                        [t("evidenceEmail"), b.business_email],
                        [t("evidenceCredentials"), summarize(b.credentials)],
                        [t("evidenceLinks"), summarize(b.social_links)],
                      ]}
                    />
                    <ReviewControls id={b.id} inferred={inferred} />
                    <DecisionButtons onReject={() => rejectBusiness(b)} onApprove={() => approveBusiness(b)} />
                  </div>
                );
              })
            ))}

          {tab === "people" &&
            (verifications.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("nothingPending")}</p>
            ) : (
              verifications.map((v) => {
                const person = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
                return (
                  <div key={v.id} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-sm font-semibold">{person?.name ?? t("member")}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      <span className="mr-1.5 rounded bg-bg px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                        {v.policy_track}
                      </span>
                      {(person?.sectors ?? []).map(sectorName).join(", ") || t("noSector")}
                    </p>
                    <Evidence
                      items={[
                        [t("evidenceProvider"), v.provider],
                        [t("evidenceDocument"), [v.document_type, v.document_country].filter(Boolean).join(" · ")],
                        [t("evidenceSubmitted"), summarize(v.checks)],
                      ]}
                    />
                    <ReviewControls id={v.id} inferred={v.policy_track} trackLocked />
                    <DecisionButtons onReject={() => rejectPerson(v)} onApprove={() => approvePerson(v)} />
                  </div>
                );
              })
            ))}

          {tab === "reports" &&
            (reports.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("noOpenReports")}</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {r.target_type} · {r.target_id.slice(0, 8)}…
                    </p>
                    {r.reason && <p className="text-xs text-ink-soft">{r.reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => dismissReport(r.id)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg">
                      {t("dismiss")}
                    </button>
                    <button onClick={() => actionReport(r.id)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:opacity-90">
                      {t("takeAction")}
                    </button>
                  </div>
                </div>
              ))
            ))}
        </div>
      )}
    </div>
  );
}
