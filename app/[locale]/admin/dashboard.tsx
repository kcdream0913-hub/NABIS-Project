"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { logAction } from "@/lib/audit";
import { Building2, Flag, UserCheck } from "lucide-react";

type PendingBusiness = {
  id: string;
  name: string;
  sector: string | null;
  registration_number: string | null;
  country_of_registration: string | null;
};
type PendingVerification = {
  id: string;
  subject_id: string;
  document_type: string | null;
  document_country: string | null;
  created_at: string;
  profiles: { name: string | null } | { name: string | null }[] | null;
};
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
  const supabase = createClient();
  const [tab, setTab] = useState<"businesses" | "people" | "reports">("businesses");
  const [businesses, setBusinesses] = useState<PendingBusiness[]>([]);
  const [verifications, setVerifications] = useState<PendingVerification[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [{ data: biz }, { data: ver }, { data: rep }] = await Promise.all([
      supabase
        .from("businesses")
        .select("id, name, sector, registration_number, country_of_registration")
        .eq("verification_status", "unverified")
        .not("registration_number", "is", null),
      supabase
        .from("verification_records")
        .select("id, subject_id, document_type, document_country, created_at, profiles:subject_id ( name )")
        .eq("subject_type", "user")
        .eq("status", "pending"),
      supabase
        .from("reports")
        .select("id, target_type, target_id, reason, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ]);
    setBusinesses(biz ?? []);
    setVerifications(ver ?? []);
    setReports(rep ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveBusiness(id: string) {
    await supabase.from("businesses").update({ verification_status: "verified", verified_at: new Date().toISOString() }).eq("id", id);
    await logAction("business_verification_approved", "business", id);
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
  }
  async function rejectBusiness(id: string) {
    await supabase.from("businesses").update({ registration_number: null }).eq("id", id);
    await logAction("business_verification_rejected", "business", id);
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
  }

  async function approvePerson(v: PendingVerification) {
    await supabase.from("verification_records").update({ status: "passed" }).eq("id", v.id);
    await supabase
      .from("profiles")
      .update({ verification_status: "verified", verified_at: new Date().toISOString() })
      .eq("id", v.subject_id);
    await logAction("profile_verification_approved", "user", v.subject_id, { record_id: v.id });
    setVerifications((prev) => prev.filter((r) => r.id !== v.id));
  }
  async function rejectPerson(v: PendingVerification) {
    await supabase.from("verification_records").update({ status: "failed" }).eq("id", v.id);
    await logAction("profile_verification_rejected", "user", v.subject_id, { record_id: v.id });
    setVerifications((prev) => prev.filter((r) => r.id !== v.id));
  }

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

  const TABS = [
    { id: "businesses" as const, label: t("businessVerification"), icon: Building2, count: businesses.length },
    { id: "people" as const, label: t("profileVerification"), icon: UserCheck, count: verifications.length },
    { id: "reports" as const, label: t("reports"), icon: Flag, count: reports.length },
  ];

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="mt-3 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? "border-pine text-pine-ink" : "border-transparent text-ink-soft"
            }`}
          >
            <t.icon size={14} /> {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-rhodo px-1.5 text-[10px] font-semibold text-white">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {tab === "businesses" &&
            (businesses.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("nothingPending")}</p>
            ) : (
              businesses.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-line bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-ink-soft">
                      {b.sector} · {b.country_of_registration} · {t("regNumberLabel")}: {b.registration_number}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => rejectBusiness(b.id)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-mist">
                      {t("reject")}
                    </button>
                    <button onClick={() => approveBusiness(b.id)} className="rounded-md bg-pine px-3 py-1.5 text-xs font-medium text-white hover:bg-pine-ink">
                      {t("approve")}
                    </button>
                  </div>
                </div>
              ))
            ))}

          {tab === "people" &&
            (verifications.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("nothingPending")}</p>
            ) : (
              verifications.map((v) => {
                const person = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
                return (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-line bg-white p-3">
                    <div>
                      <p className="text-sm font-semibold">{person?.name ?? t("member")}</p>
                      <p className="text-xs text-ink-soft">
                        {v.document_type} · {v.document_country}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => rejectPerson(v)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-mist">
                        {t("reject")}
                      </button>
                      <button onClick={() => approvePerson(v)} className="rounded-md bg-pine px-3 py-1.5 text-xs font-medium text-white hover:bg-pine-ink">
                        {t("approve")}
                      </button>
                    </div>
                  </div>
                );
              })
            ))}

          {tab === "reports" &&
            (reports.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("noOpenReports")}</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {r.target_type} · {r.target_id.slice(0, 8)}…
                    </p>
                    {r.reason && <p className="text-xs text-ink-soft">{r.reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => dismissReport(r.id)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-mist">
                      {t("dismiss")}
                    </button>
                    <button onClick={() => actionReport(r.id)} className="rounded-md bg-rhodo px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
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
