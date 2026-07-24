"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ShieldCheck, Star } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { findOrCreateThread } from "@/lib/threads";
import { SettingsSection } from "./primitives";

// The pilot is admin-curated: verification is requested by DM to the founder/admin,
// not self-served. Overridable via env so the id can track admin_users without a
// code change; falls back to the current pilot admin's user id.
const SUPPORT_ADMIN_ID =
  process.env.NEXT_PUBLIC_SUPPORT_ADMIN_ID || "1258b010-291b-434c-a6a4-a1f6fee0d9b9";

export type TrackStatus = "none" | "pending" | "verified" | "rejected" | "revoked";
export type HistoryRow = {
  created_at: string;
  policy_track: string | null;
  status: string | null;
  provider: string | null;
};

function chipClasses(status: string): string {
  switch (status) {
    case "verified":
      return "bg-primary-soft text-chip-ink";
    case "rejected":
    case "revoked":
      return "bg-accent-soft text-accent";
    default: // none | pending
      return "bg-surface-2 text-ink-soft";
  }
}

export default function VerificationCard({
  tier,
  usStatus,
  npStatus,
  history,
}: {
  tier: "basic" | "verified" | "bridge";
  usStatus: TrackStatus;
  npStatus: TrackStatus;
  history: HistoryRow[];
}) {
  const t = useTranslations("settings.verification");
  const locale = useLocale();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));

  async function requestVerification() {
    setRequesting(true);
    const threadId = await findOrCreateThread(SUPPORT_ADMIN_ID);
    if (threadId) router.push(`/messages/${threadId}?draft=${encodeURIComponent(t("verificationPrefill"))}`);
    else setRequesting(false);
  }

  const TrackRow = ({ label, status }: { label: string; status: TrackStatus }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink">{label}</span>
      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${chipClasses(status)}`}>
        {t(`status.${status}`)}
      </span>
    </div>
  );

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      {/* Current tier */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-ink">{t("currentTier")}</span>
        {tier === "bridge" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-bridge-soft px-1.5 py-0.5 text-[11px] font-semibold text-on-bridge">
            <Star size={11} strokeWidth={0} fill="currentColor" className="text-bridge" aria-hidden />
            {t("tier.bridge")}
          </span>
        ) : tier === "verified" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-chip-ink">
            <ShieldCheck size={11} strokeWidth={2.2} className="text-primary" aria-hidden />
            {t("tier.verified")}
          </span>
        ) : (
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
            {t("tier.basic")}
          </span>
        )}
      </div>

      {/* Per-track status */}
      <div className="space-y-2 border-t border-border pt-3">
        <TrackRow label={t("usTrack")} status={usStatus} />
        <TrackRow label={t("npTrack")} status={npStatus} />
      </div>

      {/* History */}
      <div className="border-t border-border pt-3">
        <p className="text-sm font-medium text-ink">{t("history")}</p>
        {history.length === 0 ? (
          <p className="mt-1 text-[13px] text-ink-soft">{t("noHistory")}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                <time className="tabular-nums text-ink-soft">{fmtDate(h.created_at)}</time>
                <span className="text-ink">{h.policy_track === "nepal" ? t("npTrack") : t("usTrack")}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chipClasses(h.status ?? "none")}`}>
                  {t(`status.${(h.status as TrackStatus) ?? "none"}`)}
                </span>
                {h.provider && <span className="text-ink-soft">· {h.provider}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Request verification — opens a DM to the admin (pilot is admin-curated). */}
      <div className="border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={requestVerification}
            disabled={requesting}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed disabled:opacity-50"
          >
            {t("requestVerification")}
          </button>
          <span className="text-[13px] text-ink-soft">{t("requestVerificationHint")}</span>
        </div>
      </div>
    </SettingsSection>
  );
}
