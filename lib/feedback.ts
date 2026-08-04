// Pure, dependency-free helpers for BL-FEEDBACK-02 (in-product pilot feedback capture).
// Kept out of the server action so the validation + rate-limit rules are unit-testable without a
// DB or a request. The DB CHECK constraints mirror these EXACTLY (kind allowlist; body length
// 10-4000 on the trimmed value) — belt and suspenders, so a bypass of the app still can't write a
// malformed row.

export const FEEDBACK_KINDS = ["bug", "idea", "confusing", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

export const FEEDBACK_BODY_MIN = 10;
export const FEEDBACK_BODY_MAX = 4000;

export type BodyValidation =
  | { ok: true; value: string }
  | { ok: false; error: "too_short" | "too_long" };

// Trims first (leading/trailing whitespace never counts toward the minimum), then bounds the
// trimmed length — identical to the DB CHECK `char_length(btrim(body)) between 10 and 4000`.
export function validateFeedbackBody(raw: string): BodyValidation {
  const value = raw.trim();
  if (value.length < FEEDBACK_BODY_MIN) return { ok: false, error: "too_short" };
  if (value.length > FEEDBACK_BODY_MAX) return { ok: false, error: "too_long" };
  return { ok: true, value };
}

// Rate limit: at most 5 submissions per user per rolling hour. The server action counts the
// caller's feedback rows created within FEEDBACK_RATE_WINDOW_MS and passes that count here, so the
// threshold logic stays pure and testable while the DB read stays in the action.
export const FEEDBACK_RATE_MAX = 5;
export const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000;

export function exceedsFeedbackRate(recentCount: number): boolean {
  return recentCount >= FEEDBACK_RATE_MAX;
}
