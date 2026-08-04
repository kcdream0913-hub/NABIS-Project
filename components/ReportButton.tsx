"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAction } from "@/lib/audit";

export default function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "post" | "business" | "profile" | "message";
  targetId: string;
}) {
  const t = useTranslations("report");
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t("error"));
      setBusy(false);
      return;
    }
    // Capture the insert result — swallowing it (the D-084 avatar-delete bug) would show "sent"
    // for a report that never landed. Only log + show success once the row is actually written.
    const { error: insErr } = await supabase.from("reports").insert({
      target_type: targetType,
      target_id: targetId,
      reporter_id: user.id,
      reason: reason.trim() || null,
    });
    if (insErr) {
      setError(t("error"));
      setBusy(false);
      return;
    }
    await logAction("report_submitted", targetType, targetId);
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setReason("");
      setError(null);
      setBusy(false);
    }, 1200);
  }

  if (open) {
    return (
      <div
        className="rounded-md border border-border bg-surface p-2.5 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <p className="text-active">{t("sent")}</p>
        ) : (
          <>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("placeholder")}
              className="w-full rounded border border-border-input px-2 py-1 text-xs focus:border-primary"
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:underline">
                {t("cancel")}
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="font-medium text-accent hover:underline disabled:opacity-60"
              >
                {busy ? t("submitting") : t("submit")}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-1.5 text-accent">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setError(null);
        setBusy(false);
        setOpen(true);
      }}
      aria-label={t("report")}
      title={t("report")}
      className="rounded p-1 text-ink-soft hover:bg-bg hover:text-accent"
    >
      <Flag size={13} />
    </button>
  );
}
