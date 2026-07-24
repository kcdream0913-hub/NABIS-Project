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

  async function submit() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("reports").insert({
      target_type: targetType,
      target_id: targetId,
      reporter_id: user.id,
      reason: reason.trim() || null,
    });
    await logAction("report_submitted", targetType, targetId);
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setReason("");
    }, 1200);
  }

  if (open) {
    return (
      <div
        className="rounded-md border border-border bg-white p-2.5 text-xs"
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
              <button onClick={submit} className="font-medium text-accent hover:underline">
                {t("submit")}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
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
