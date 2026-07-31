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

// Read-receipt writer gate. My open thread advances MY last_read_at to now()
// ONLY when every condition holds — this is the pure decision behind the
// debounced writer in ThreadConversation. Keeping it here makes the guards
// (which are the whole point) unit-testable without a DOM.
//   - documentVisible: never mark messages read while the tab is hidden — the
//     user isn't looking, so those messages are genuinely unseen.
//   - nearBottom: only mark read when scrolled to the newest message; reading
//     history up-thread must not claim you've seen what's below.
//   - a last message exists and is NOT my own: I don't "read" my own send, and
//     a thread with no foreign message has nothing to advance for.
//   - now() advances what I last wrote: monotonic, never backwards (the
//     client-side "greatest(existing, now())" — we always write now(), which
//     only moves forward, and skip a write that wouldn't advance it).
export function shouldAdvanceRead(args: {
  documentVisible: boolean;
  nearBottom: boolean;
  lastMessage: { sender_id: string; created_at: string } | null | undefined;
  userId: string | null;
  lastWrittenIso: string | null;
  nowIso: string;
}): boolean {
  const { documentVisible, nearBottom, lastMessage, userId, lastWrittenIso, nowIso } = args;
  if (!userId) return false;
  if (!documentVisible) return false;
  if (!nearBottom) return false;
  if (!lastMessage) return false;
  if (lastMessage.sender_id === userId) return false;
  if (lastWrittenIso && nowIso <= lastWrittenIso) return false;
  return true;
}

// ── message shape (plaintext Phase 1; Phase 1.5 adds schema_version/ciphertext) ──
export type Attachment = {
  path: string; // storage object path: {thread_id}/{uploader_id}/{name}
  type: string; // mime type ("image/jpeg", "application/pdf", …)
  name: string;
  size: number;
  width?: number;
  height?: number;
};

export type ChatMessage = {
  id: string;
  thread_id: string | null;
  sender_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id: string | null;
  attachments: Attachment[];
};

// Windows are mirrored in the SECURITY DEFINER RPCs (edit_message,
// delete_message_for_everyone). These client copies gate the UI affordance only;
// the DB is the real enforcer, so a clock-skewed client can never actually bypass
// them — the RPC rejects a late edit/delete regardless of what the UI shows.
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const DELETE_EVERYONE_WINDOW_MS = 60 * 60 * 1000;

const within = (createdAt: string, windowMs: number, nowMs: number) =>
  nowMs - Date.parse(createdAt) <= windowMs;

/** Own, not-deleted, still-has-text message inside the 15-minute edit window. */
export function canEditMessage(m: ChatMessage, myId: string, nowMs: number): boolean {
  if (m.sender_id !== myId) return false;
  if (m.deleted_at) return false;
  if (!m.body) return false; // text only — a pure-attachment message has nothing to edit
  return within(m.created_at, EDIT_WINDOW_MS, nowMs);
}

/** Own, not-already-deleted message inside the 1-hour delete-for-everyone window. */
export function canDeleteForEveryone(m: ChatMessage, myId: string, nowMs: number): boolean {
  if (m.sender_id !== myId) return false;
  if (m.deleted_at) return false;
  return within(m.created_at, DELETE_EVERYONE_WINDOW_MS, nowMs);
}

/** Delete-for-me hides any message you can see (own or not, any age), except a
 *  tombstone (already gone for everyone). */
export function canDeleteForMe(m: ChatMessage): boolean {
  return !m.deleted_at;
}

/** A message I sent is "seen" once every OTHER participant has read up to it.
 *  Ticks render on own messages only; group-ready (all others must be caught up). */
export function isSeenByOthers(
  m: ChatMessage,
  myId: string,
  otherLastReadAts: (string | null | undefined)[],
): boolean {
  if (m.sender_id !== myId) return false;
  if (otherLastReadAts.length === 0) return false;
  return otherLastReadAts.every((r) => !!r && r >= m.created_at);
}

/** Left-pane / notification preview. Tombstone > attachment glyph > text.
 *  In Phase 1.5 this runs client-side after decrypt (server sees only ciphertext). */
export function messagePreview(
  m: Pick<ChatMessage, "body" | "deleted_at" | "attachments">,
  labels: { deleted: string; photo: string; document: string },
): string {
  if (m.deleted_at) return labels.deleted;
  if (m.attachments && m.attachments.length > 0) {
    const first = m.attachments[0];
    return first.type?.startsWith("image/") ? labels.photo : labels.document;
  }
  return m.body ?? "";
}

/** Quoted-reply preview truncation (~90 chars), used above the composer and in
 *  the bubble's quoted block. */
export function truncateQuote(s: string, max = 90): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

// D-076. A DM thread row as shown in any inbox surface — the full /messages
// page and the Feed rail both render this same shape.
export type Thread = {
  id: string;
  otherName: string;
  lastPreview: string | null;
  lastAt: string | null;
  unread: boolean;
};

type ThreadParticipantRow = { thread_id: string; last_read_at: string | null };
type OtherParticipantRow = {
  thread_id: string;
  profiles: { name: string | null } | { name: string | null }[] | null;
};
type LastMessageRow = {
  thread_id: string;
  body: string | null;
  sender_id: string;
  created_at: string;
  deleted_at: string | null;
  attachments: Attachment[] | null;
};

/** Builds the sorted `Thread[]` an inbox surface renders, from the three raw
 *  query results every surface fetches the same way (my participant rows, the
 *  OTHER participant + name on each of my threads, and the latest message per
 *  thread). Pulled out of the /messages page so the Feed rail (D-076) doesn't
 *  reimplement — and risk drifting from — the one true "what does my inbox
 *  look like" rule; `isUnread` above is the equivalent extraction for a single
 *  thread's read state, this is its list-level counterpart. Pure: no
 *  network/Supabase calls, so it's unit-testable without a client or a DOM. */
export function buildThreadList(
  mine: ThreadParticipantRow[],
  others: OtherParticipantRow[],
  lastMsgs: LastMessageRow[],
  userId: string,
  labels: { member: string; deleted: string; photo: string; document: string },
): Thread[] {
  const readMap: Record<string, string | null> = Object.fromEntries(
    mine.map((r) => [r.thread_id, r.last_read_at]),
  );
  const latest: Record<string, LastMessageRow> = {};
  for (const m of lastMsgs) if (!latest[m.thread_id]) latest[m.thread_id] = m;

  const previewLabels = { deleted: labels.deleted, photo: labels.photo, document: labels.document };
  const list: Thread[] = others.map((o) => {
    const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
    const lm = latest[o.thread_id];
    return {
      id: o.thread_id,
      otherName: p?.name ?? labels.member,
      lastPreview: lm
        ? messagePreview(
            { body: lm.body, deleted_at: lm.deleted_at, attachments: Array.isArray(lm.attachments) ? lm.attachments : [] },
            previewLabels,
          )
        : null,
      lastAt: lm?.created_at ?? null,
      unread: isUnread(lm, readMap[o.thread_id], userId),
    };
  });
  list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return list;
}
