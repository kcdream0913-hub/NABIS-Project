// BL-SOCIAL-02 §3 — the reaction set, in ONE place.
// The picker, the summary row, and the i18n keys all read REACTION_KINDS.
// Adding a reaction is a one-line change here plus a migration to the DB CHECK.
//
// Deliberately no `love`, no `funny`, and above all NO negative reaction: on a
// 30-user professional network a visible negative count suppresses posting and
// enables pile-ons. That signal is what Report is for — it goes to moderation,
// not to a public counter. `namaste` (🙏) is a localization, not decoration.

export type ReactionKind =
  | "like"
  | "celebrate"
  | "support"
  | "insightful"
  | "namaste";

export type ReactionMeta = {
  kind: ReactionKind;
  emoji: string;
  labelEn: string;
  labelNe: string; // AI-drafted (R9) — see docs/i18n/ne-review-BL-SOCIAL-02.md
};

// Ordered — this order is the picker order and the tie-break for the summary row.
export const REACTION_KINDS: readonly ReactionMeta[] = [
  { kind: "like", emoji: "👍", labelEn: "Like", labelNe: "मन पर्‍यो" },
  { kind: "celebrate", emoji: "🎉", labelEn: "Celebrate", labelNe: "बधाई" },
  { kind: "support", emoji: "🤝", labelEn: "Support", labelNe: "समर्थन" },
  { kind: "insightful", emoji: "💡", labelEn: "Insightful", labelNe: "ज्ञानवर्धक" },
  { kind: "namaste", emoji: "🙏", labelEn: "Namaste", labelNe: "नमस्ते" },
] as const;

// Must stay identical to the DB CHECK in 20260728090000_feed_social_actions.sql.
export const REACTION_KIND_LIST: readonly ReactionKind[] = REACTION_KINDS.map(
  (r) => r.kind,
);

const BY_KIND: Record<ReactionKind, ReactionMeta> = Object.fromEntries(
  REACTION_KINDS.map((r) => [r.kind, r]),
) as Record<ReactionKind, ReactionMeta>;

export function reactionMeta(kind: ReactionKind): ReactionMeta {
  return BY_KIND[kind];
}

export function isReactionKind(v: unknown): v is ReactionKind {
  return typeof v === "string" && v in BY_KIND;
}

// ── toggle logic (§5.2) ──────────────────────────────────────────────────────
// One reaction per user per post (PK = post_id,user_id). Tapping the kind you
// already hold removes it; tapping a different kind CHANGES it (an upsert on the
// PK), it never adds a second.
export function nextReaction(
  current: ReactionKind | null,
  tapped: ReactionKind,
): ReactionKind | null {
  return current === tapped ? null : tapped;
}

// Total-count delta of applying `next` over `current`:
//   remove (had one → none)      -> -1
//   add    (none  → one)         -> +1
//   change (one   → other one)   ->  0
export function reactionCountDelta(
  current: ReactionKind | null,
  next: ReactionKind | null,
): -1 | 0 | 1 {
  if (current && !next) return -1;
  if (!current && next) return 1;
  return 0;
}

// The summary row shows up to `max` distinct emojis, most-used first (ties broken
// by REACTION_KINDS order). Input: a count per kind. Output: ordered emojis.
export function summaryEmojis(
  counts: Partial<Record<ReactionKind, number>>,
  max = 3,
): string[] {
  return REACTION_KINDS.filter((r) => (counts[r.kind] ?? 0) > 0)
    .map((r) => ({ emoji: r.emoji, n: counts[r.kind] ?? 0 }))
    .sort((a, b) => b.n - a.n) // stable sort keeps REACTION_KINDS order on ties
    .slice(0, max)
    .map((r) => r.emoji);
}

export function totalReactions(
  counts: Partial<Record<ReactionKind, number>>,
): number {
  return REACTION_KINDS.reduce((sum, r) => sum + (counts[r.kind] ?? 0), 0);
}
