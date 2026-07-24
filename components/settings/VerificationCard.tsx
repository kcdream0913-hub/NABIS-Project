"use client";

import { useTranslations, useLocale } from "next-intl";
import { ShieldCheck, Star } from "lucide-react";
import { SettingsSection } from "./primitives";

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
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));

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
    </SettingsSection>
  );
}
