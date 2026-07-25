// Shared DM helpers. `isUnread` is the single rule for "does this thread have
// something new for me": the last message must exist, not be my own, and be
// newer than my last_read_at (unset = never read → unread). Used by the two-pane
// inbox and the sidebar unread dot so both agree.
export function isUnread(
  lastMessage: { sender_id: string; created_at: string } | null | undefined,
  lastReadAt: string | null | undefined,
  userId: string,
): boolean {
  if (!lastMessage) return false;
  if (lastMessage.sender_id === userId) return false;
  return !lastReadAt || lastMessage.created_at > lastReadAt;
}
