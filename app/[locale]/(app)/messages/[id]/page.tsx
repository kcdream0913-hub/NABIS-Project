"use client";

import { useParams, useSearchParams } from "next/navigation";
import ThreadConversation from "@/components/ThreadConversation";

// Full-page single conversation. The reusable ThreadConversation carries the
// realtime + send + mark-read + timestamps logic (shared with the two-pane inbox).
// An optional ?draft= seeds the composer (used by "Request verification").
export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const draft = useSearchParams().get("draft") ?? "";
  return (
    <div className="mx-auto max-w-2xl">
      <ThreadConversation threadId={id} initialDraft={draft} />
    </div>
  );
}
