"use client";

import { useState } from "react";
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
        className="rounded-md border border-line bg-white p-2.5 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <p className="text-text-success">Report sent — thank you.</p>
        ) : (
          <>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What's wrong? (optional)"
              className="w-full rounded border border-line px-2 py-1 text-xs focus:border-pine"
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:underline">
                Cancel
              </button>
              <button onClick={submit} className="font-medium text-rhodo hover:underline">
                Submit report
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
      aria-label="Report"
      title="Report"
      className="rounded p-1 text-ink-soft hover:bg-mist hover:text-rhodo"
    >
      <Flag size={13} />
    </button>
  );
}
