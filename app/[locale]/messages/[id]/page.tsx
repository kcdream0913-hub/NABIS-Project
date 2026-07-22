"use client";

import { useParams } from "next/navigation";
import ThreadConversation from "@/components/ThreadConversation";

// Full-page single conversation. The reusable ThreadConversation carries the
// realtime + send + mark-read + timestamps logic (shared with the two-pane inbox).
export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-2xl">
      <ThreadConversation threadId={id} />
    </div>
  );
}
