"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Bug, Lightbulb, HelpCircle, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Auth + admin gating: handled upstream by middleware.ts (isAdminPath) and admin/layout.tsx
// (D-067) — this sub-route inherits both automatically, the same way admin/analytics does.
//
// This is the admin READ + triage surface for BL-FEEDBACK-02. Without it the feedback table is
// write-only. Reads use the browser client (RLS: feedback_select_own_or_admin -> admin sees all);
// status updates use it too (RLS: feedback_update_admin). No service role.

type FeedbackRow = {
  id: string;
  user_id: string | null;
  kind: string;
  body: string;
  page_path: string | null;
  locale: string | null;
  app_version: string | null;
  status: "new" | "triaged" | "closed";
  created_at: string;
};

const KIND_ICON: Record<string, typeof Bug> = {
  bug: Bug,
  idea: Lightbulb,
  confusing: HelpCircle,
  other: MessageSquare,
};
const STATUSES = ["new", "triaged", "closed"] as const;

export default function AdminFeedback() {
  const t = useTranslations("adminFeedback");
  const supabase = createClient();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Static literal keys so the i18n usage test resolves them (code -> bundle).
  const KIND_LABEL: Record<string, string> = {
    bug: t("kindBug"),
    idea: t("kindIdea"),
    confusing: t("kindConfusing"),
    other: t("kindOther"),
  };
  const STATUS_LABEL: Record<string, string> = {
    new: t("statusNew"),
    triaged: t("statusTriaged"),
    closed: t("statusClosed"),
  };

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("feedback")
      .select("id,user_id,kind,body,page_path,locale,app_version,status,created_at")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as FeedbackRow[];
    setRows(list);
    // feedback.user_id -> auth.users (NOT profiles), so there is no PostgREST embed. Stitch the
    // author name with a second RLS-safe query (profiles: admin can view all, D-025).
    const ids = [...new Set(list.map((r) => r.user_id).filter((v): v is string => !!v))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", ids);
      const map: Record<string, string | null> = {};
      for (const p of profs ?? []) map[(p as { id: string }).id] = (p as { name: string | null }).name;
      setNames(map);
    } else {
      setNames({});
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(id: string, status: FeedbackRow["status"]) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r))); // optimistic
    const { error: err } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (err) {
      setRows(prev); // roll back the optimistic flip
      setError(err.message);
    }
  }

  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
            {t("title")}
            {newCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-on-primary align-middle">
                {t("newCount", { count: newCount })}
              </span>
            )}
          </h1>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg"
        >
          <ArrowLeft size={13} /> {t("backToDashboard")}
        </Link>
      </div>

      {/* Finding 3 (D-087): version / browser / locale are client-asserted and cannot be forced
          server-side — say so, so nobody triages on the assumption a SHA here is real. */}
      <p className="mt-2 text-xs italic text-ink-soft">{t("provenanceHint")}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-accent bg-accent-soft px-3 py-2 text-xs text-accent">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const Icon = KIND_ICON[r.kind] ?? MessageSquare;
            const who = r.user_id ? names[r.user_id] || t("member") : t("deletedAccount");
            return (
              <li
                key={r.id}
                className={`rounded-lg border bg-surface p-3 ${r.status === "new" ? "border-primary" : "border-border"}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                  <span className="inline-flex items-center gap-1 font-medium text-ink">
                    <Icon size={13} aria-hidden /> {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  <span>{who}</span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  {r.app_version && (
                    <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-[11px]">
                      {r.app_version.slice(0, 7)}
                    </span>
                  )}
                  {r.page_path && <span className="italic">“{r.page_path}”</span>}
                  {r.locale && <span className="uppercase">{r.locale}</span>}
                </div>

                <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{r.body}</p>

                <div className="mt-2 flex gap-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={r.status === s}
                      onClick={() => setStatus(r.id, s)}
                      className={
                        r.status === s
                          ? "rounded-md border border-primary bg-primary px-2 py-1 text-xs font-medium text-on-primary"
                          : "rounded-md border border-border px-2 py-1 text-xs text-ink-soft hover:bg-surface-2"
                      }
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
