// BL-SOCIAL-02 §4.1 — Share. Share is a UI action (DM / copy link / native sheet);
// post_shares is only an append-only counter. R3: no network call to any social
// platform — Web Share API, clipboard, or an internal DM, nothing else.
import type { ShareChannel } from "./reposts";

// The permalink Share copies / sends. Internal route only (R3) — /posts/[id].
export function postPermalink(origin: string, postId: string): string {
  return `${origin.replace(/\/+$/, "")}/posts/${postId}`;
}

// "Failure to log a share must NEVER block the share" (§4.1). This wraps the
// insert so a logging error is swallowed — the share already happened. Accepts any
// thenable (a Supabase query builder is PromiseLike, not a Promise).
export async function logShareSafe(
  insert: () => PromiseLike<unknown>,
): Promise<void> {
  try {
    await insert();
  } catch {
    // swallowed on purpose — the user's share must not fail because analytics did
  }
}

// The DM body carried when sharing a post into a direct thread. A "post reference"
// is the permalink plus a short quote (the messages table has no post-embed column
// this batch — a rich embed would need a migration).
export function shareDmBody(
  permalink: string,
  quote: string | null,
  label: string, // localized "Shared a post"
): string {
  const q = quote ? `“${quote.replace(/\s+/g, " ").trim().slice(0, 140)}”\n` : "";
  return `${label}\n${q}${permalink}`;
}

export type { ShareChannel };
