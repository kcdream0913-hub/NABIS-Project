"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Clock, Flag, ShieldCheck, UserCheck } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  getKycMetrics,
  getModerationVolume,
  getReportMetrics,
  type KycMetrics,
  type ModerationVolumePoint,
  type ReportMetrics,
} from "@/lib/adminAnalytics";

// Auth + admin gating: handled upstream by middleware.ts (isAdminPath) and
// admin/layout.tsx (D-067) — this sub-route inherits both automatically, the
// same way admin/page.tsx does. Nothing to check here.

function formatHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
        <Icon size={13} /> {label}
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default function AdminAnalytics() {
  const t = useTranslations("adminAnalytics");
  const supabase = createClient();
  const [kyc, setKyc] = useState<KycMetrics | null>(null);
  const [reports, setReports] = useState<ReportMetrics | null>(null);
  const [volume, setVolume] = useState<ModerationVolumePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [k, r, v] = await Promise.all([
          getKycMetrics(supabase),
          getReportMetrics(supabase),
          getModerationVolume(supabase),
        ]);
        if (cancelled) return;
        setKyc(k);
        setReports(r);
        setVolume(v);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This week's decisions = the most recent bucket in the weekly series (buckets
  // are UTC-Monday-aligned, so "this week" means "the bucket containing today").
  const decisionsThisWeek = (() => {
    if (volume.length === 0) return 0;
    const last = volume[volume.length - 1];
    return last.kycApproved + last.kycRejected + last.reportsResolved;
  })();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg"
        >
          <ArrowLeft size={13} /> {t("backToDashboard")}
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-border bg-bg px-3 py-2 text-xs text-accent">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={UserCheck}
              label={t("pendingKyc")}
              value={(kyc?.pendingPeople ?? 0) + (kyc?.pendingBusinesses ?? 0)}
            />
            <StatTile icon={Flag} label={t("pendingReports")} value={reports?.open ?? 0} />
            <StatTile icon={ShieldCheck} label={t("decisionsThisWeek")} value={decisionsThisWeek} />
            <StatTile
              icon={Clock}
              label={t("avgDecisionTime")}
              value={formatHours(kyc?.avgDecisionHours ?? null)}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm font-semibold">{t("kycChartTitle")}</p>
              <p className="text-xs text-ink-soft">{t("kycChartSubtitle")}</p>
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volume}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="kycApproved" name={t("approved")} stackId="kyc" fill="var(--color-primary, #2563eb)" />
                    <Bar dataKey="kycRejected" name={t("rejected")} stackId="kyc" fill="var(--color-accent, #dc2626)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm font-semibold">{t("reportsChartTitle")}</p>
              <p className="text-xs text-ink-soft">{t("reportsChartSubtitle")}</p>
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volume}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="reportsResolved" name={t("resolved")} fill="var(--color-primary, #2563eb)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {volume.length === 0 && (
            <p className="mt-3 text-xs italic text-ink-soft">{t("noActivityYet")}</p>
          )}
        </>
      )}
    </div>
  );
}
