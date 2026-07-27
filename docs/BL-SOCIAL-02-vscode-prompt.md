# BL-SOCIAL-02 — Feed Social Actions + Media (B1 EXPANDED)

**Hub-authored 2026-07-27. Supersedes the earlier "B1 = post_comments" scope.**
Paste this whole file into the VS Code Claude Code session.

---

## 0. What changed and why

KC asked for **like, comment, repost, share, bookmark** and for feeds to accept **pics, videos, and live stream**.

Hub rulings, all binding for this batch:

| Ask | Ruling |
|---|---|
| like | Already exists as a binary row in `post_reactions`. Expanded to a **5-kind reaction set**, one reaction per user per post, changeable. |
| comment | New `post_comments`, **one level of replies**, soft-delete only. |
| repost | New `post_reposts`, plain + quote in one table. **Not** a row in `posts`. |
| share | Share is a UI action (DM / copy link / native sheet). `post_shares` exists **only as an append-only counter**, readable by the post author. |
| bookmark | New `post_bookmarks`. **Private — count never exposed to anyone, including the post author.** |
| pics | `posts.media` jsonb + new private `post-media` bucket. Up to 4 images. |
| video | Same column/bucket. **1 video per post, ≤90s, ≤50MB, no transcode, autoplay off.** |
| live stream | **DEFERRED. Not built this cycle.** Reasons in §0.1. The `type` vocabulary reserves nothing in SQL — the validator rejects anything that is not `image`/`video`, so enabling live later is a trigger change, not a migration. |

### 0.1 Why live stream is not in this batch

This is a disagreement, stated in full so it can be overturned with an argument rather than a preference.

**I disagree with building live stream now → build recorded video now, revisit live after incorporation → the risk in shipping live now is that it is the one feature that can put unreviewable content in front of users faster than anyone can respond to it.**

Three independent blockers, any one of which is sufficient:

1. **It is not a schema change, it is a vendor.** Supabase Storage cannot ingest RTMP or serve HLS live. Live requires Mux, Cloudflare Stream, AWS IVS, or LiveKit — a new billing relationship. Mux live encoding is **$0.03125/min at 1080p** for the first 5,000 min/month, plus storage at **$0.003/min/month** and delivery at **$0.001/min** past the free 100k. Cloudflare Stream is **$1 per 1,000 min stored + $5 per 1,000 min delivered** with no free tier. A single one-hour stream with 50 viewers costs roughly **$15 on Cloudflare** in delivery alone. That is a recurring per-minute cost attached to zero pilot revenue.
2. **The billing relationship needs the entity.** Same blocker as Meta Business Verification (D-030). BridgeLink has no legal entity yet.
3. **Moderation.** BridgeLink's stated policy forwards abuse to law enforcement. Recorded video is reviewable after upload; live is not reviewable at all without staffed real-time moderation, which does not exist for a 30-user pilot. This is the blocker that does not go away with money.

**Runner-up, and why it lost:** embed a scheduled third-party stream (YouTube Live / Facebook Live URL) on an Event. It loses on rule **R3 — no network call to any social platform, ever** (D-030). An iframe embed is exactly that call, made from the user's browser.

**What ships as the seam:** every media item carries `type`. When live is green-lit, `validate_post_media()` gains one branch and a `live` media kind. No table change, no data migration.

**If KC overturns this:** the decision that must be made first is *the provider and who pays for the minutes*, not the UI. Do not start until that is answered.

### 0.2 The "in messaging" ambiguity

KC wrote "add like, comment, repost, share and bookmark **in messaging**." Interpreting these as **feed/post** actions — they are X/FB post-level actions, and message-level reactions already shipped in Messenger Phase 1 (`message_reactions`). The messaging tie-in built here is **Share → Send in a direct message**, which posts a message carrying a post reference into an existing DM thread. If KC actually meant per-message reposts/bookmarks inside DMs, that is a separate batch — say so and stop.

---

## 1. Hard rules

- **R1 — Do not improvise the SQL.** §2 is the exact migration. Copy it verbatim into `supabase/migrations/20260728090000_feed_social_actions.sql` and the rollback into `supabase/migrations/ROLLBACK_20260728090000_feed_social_actions.sql`. **Do not apply it. Do not push it as part of a UI commit.** Commit the migration alone, push, and stop — the hub applies it on a Supabase branch, tests by execution, merges to prod (D-024 re-query), then green-lights Part B.
- **R2 — No new colors.** Tokens are frozen. Primary blue for active states, red for destructive only, gold for Bridge only, no green.
- **R3 — No network call to any social platform, ever.** Share = Web Share API / clipboard / internal DM. No oEmbed, no preview scrape, no third-party embed.
- **R4 — Bookmarks are private.** No bookmark count anywhere in the UI, no aggregate query, no exposure to the post author. If a design shows a bookmark count, the design is wrong.
- **R5 — No denormalized counters.** Counts come from PostgREST embedded aggregates (`select=*,post_reactions(count),post_comments(count),post_reposts(count)`). Do not add `like_count` columns and do not add counter triggers — a wrong counter is a silent, permanent data bug and this scale does not need one.
- **R6 — View scoping is load-bearing.** Task 1.1's Definition of Done is "no data leakage between views." A repost is a leak vector: a `nepal` post reposted into `us` view would publish Nepal-scoped content into the US feed. The trigger in §2 blocks it. Do not work around it client-side.
- **R7 — Autoplay is off.** Video plays on explicit tap, `preload="metadata"`, `playsInline`, poster frame required. Nepal-side mobile data is a real cost to a real user.
- **R8 — Media never becomes a trust signal.** Having photos does not affect ranking, badges, or verification.
- **R9 — NE strings are AI-drafted.** Emit `docs/i18n/ne-review-BL-SOCIAL-02.md` (key · EN · NE-draft) for KC's native reviewer. Key parity test (D-001) must stay green.
- **R10 — Soft delete only for comments.** No DELETE policy on `post_comments`. Tombstones keep reply threads coherent.
- **R11 — No new SECURITY DEFINER objects.** All triggers in §2 are `security invoker`. The accepted-DEFINER list stays at 5.

---

## 2. The migration — verbatim

`supabase/migrations/20260728090000_feed_social_actions.sql`

See the migration file already committed in this repository for the exact SQL (Part A commit).

### 2.1 Rollback

`supabase/migrations/ROLLBACK_20260728090000_feed_social_actions.sql`

See the rollback file already committed in this repository for the exact SQL (Part A commit).

---

## 3. The reaction set — and the one that is missing on purpose

`like · celebrate · support · insightful · namaste`

- No `love`, no `funny`, and above all **no negative reaction**. On a professional cross-border network with 30 pilot users, a visible negative count suppresses posting and creates pile-ons in a group small enough that everyone can identify the reactors. X has never shipped a public dislike for exactly this reason. If a negative signal is needed, that is what **Report** is for — it goes to moderation, not to a public counter.
- `namaste` (🙏) is a deliberate localization, not decoration. It is the reaction a Nepal-side user reaches for first.
- Emoji mapping lives in one place: `lib/feed/reactions.ts`, exporting `REACTION_KINDS` as an ordered array of `{ kind, emoji, labelEn, labelNe }`. The picker, the summary row, and the i18n keys all read that array. **Adding a reaction must be a one-line change plus a migration.**

---

## 4. Part B — UI (do not start until the hub confirms "prod merged")

### 4.1 `PostActionBar`

One row under every post card. Reference: X's action row + FB's reaction picker.

```
[😊 React ▸ 12] [💬 4] [🔁 2] [↗ Share] [🔖]
```

- **React** — tap = toggle `like`. Long-press (touch) or 400ms hover (pointer) = picker with the 5 kinds. Tapping a kind while holding a different kind **changes** it (upsert on PK), it does not add. Active state = primary blue fill + `aria-pressed="true"`. The count is total reactions of all kinds; the summary shows up to 3 distinct emojis, most-used first.
- **Comment** — opens the thread inline (not a route change), focuses the composer.
- **Repost** — menu with two items: *Repost* (immediate insert, button turns primary blue, tap again = un-repost) and *Quote* (opens a small composer, ≤1000 chars). Cross-view control appears **only** when the user's current view is `bridge` or matches the post's view; when a `nepal` post is viewed from `bridge`, offer "Repost to Bridge". Never render a control the trigger will reject.
- **Share** — menu: *Send in a message* (thread picker → posts a message with a post reference), *Copy link*, *Share…* (`navigator.share`, feature-detected, hidden when absent). Every one of the three inserts a `post_shares` row with the matching `channel`. Failure to log a share must **never** block the share.
- **Bookmark** — right-aligned, `aria-pressed`, no count, no tooltip mentioning others. Toggling shows a transient "Saved · View bookmarks" affordance.

Optimistic updates everywhere, with rollback on error and a single toast. No spinners inside the action bar.

### 4.2 Comment thread

- Top-level list, newest-first, paginated 10 at a time ("Show more comments").
- One level of replies, collapsed behind "Show N replies".
- Composer: 2000-char limit with a counter appearing at 1800, `body_lang` set from the active locale.
- Own comment: **Edit** visible only while `created_at` is within 15 minutes (mirror the messenger's window UX exactly), **Delete** always.
- Post author sees **Remove** on others' comments (sets `deleted_at` only — the policy and trigger enforce that they cannot edit).
- Deleted comment renders as a tombstone: *"This comment was removed"* / Nepali equivalent, replies preserved.
- Realtime: subscribe to `post_comments` filtered `post_id=eq.<id>` **only while the thread is open**. Unsubscribe on close. Do not open a feed-wide comment subscription.

### 4.3 Composer media

- Attach button → file picker accepting the bucket's mime list.
- **Either up to 4 images, or exactly 1 video.** Enforce in the picker with a clear message, not just at submit (X's rule; the trigger enforces it server-side as the backstop).
- Client-side before upload: reject images >10MB, video >50MB or >90s (read `duration` from a hidden `<video>` element's `loadedmetadata`), generate the video poster by drawing frame ~1s to a canvas and uploading it as a webp alongside.
- Upload path: \${auth.uid()}/\${crypto.randomUUID()}.\${ext} — the first path segment must be the user id or the storage policy rejects it.
- Show per-file progress and allow removing a file before posting. **If the post insert fails, delete the uploaded objects** — no orphans.
- Alt text field per image, optional but prompted once.

### 4.4 Media rendering

- 1 image: max-height 480px, natural aspect. 2: side-by-side. 3: one large + two stacked. 4: 2×2 grid. Rounded to the existing card radius token, `object-fit: cover`, `loading="lazy"`, width/height attributes set from the stored `w`/`h` so the feed does not shift.
- Video: poster image + centered play button, `preload="metadata"`, `playsInline`, `controls` once playing, muted-by-default with an unmute control, **never `autoplay`** (R7).
- Signed URLs generated **server-side** in the feed loader with a 1-hour TTL, batched (one `createSignedUrls` call per page of posts, not one per item).
- Tap-to-expand lightbox for images, Esc/backdrop to close, focus trapped and restored.

### 4.5 Routes

- `/bookmarks` — the user's saved posts, newest-first, same `PostCard`, empty state explaining bookmarks are private.
- Reposts appear in the feed as the **original card with a "‹name› reposted" header**; quote reposts render the quote above an embedded, non-interactive copy of the original card (the embedded copy has no action bar — actions belong to the original).
- **Known limitation, stated on purpose:** a quote repost is not itself a post, so it cannot be liked or commented on independently. That is the price of keeping recursion out of the feed query. Revisit only if pilot users ask for it.

### 4.6 i18n / a11y

- All new strings in EN + NE; key-parity test stays green; emit `docs/i18n/ne-review-BL-SOCIAL-02.md`.
- Every action button: ≥44px touch target (48 preferred), `aria-label` that includes the count, `aria-pressed` on toggles.
- Reaction picker: keyboard-reachable (Enter/Space opens, arrows move, Esc closes), roving tabindex.
- Count changes announced via a single polite live region per card, not per button.
- Verify at 360×640: the action bar must not wrap, and the picker must not overflow the viewport on the left- or right-most card edge.

---

## 5. Tests

**Unit (vitest)**

1. `reactions.ts` — `REACTION_KINDS` has exactly 5 entries, kinds match the DB CHECK list, every entry has `labelEn` + `labelNe`.
2. Reaction toggle logic — same kind twice = removal; different kind = change, not add; count math correct.
3. Media picker validator — 5 images rejected; 1 image + 1 video rejected; 2 videos rejected; 91s video rejected; 10.1MB image rejected; 4 images accepted.
4. Poster generation returns a blob for a valid video and fails closed (no upload) when metadata never loads.
5. Comment depth — reply-to-a-reply blocked client-side before the DB sees it.
6. Repost view options — for a `nepal` post the offered targets are exactly `nepal` and `bridge`; for a `bridge` post, exactly `bridge`.
7. Share logging failure does not reject the share promise.
8. i18n key parity for the new namespaces.

**Integration (against the branch, before merge — hub runs these)**

9. `insert post_comments` with `parent_comment_id` pointing at a reply → raises.
10. `insert post_reposts` with `view='us'` on a `nepal` post → raises; `view='bridge'` → succeeds.
11. `update post_comments set body` 16 minutes after creation → raises `edit window elapsed`.
12. Post author `update ... set body` on someone else's comment → raises; `set deleted_at` → succeeds and nulls body.
13. `select * from post_bookmarks` as a different user → 0 rows.
14. `update`/`delete` on `post_shares` → 0 rows affected (no policy).
15. `update posts set media` with a `live` type → raises.

**E2E (playwright)**

16. Like → count increments → reload → still liked → change to `namaste` → count unchanged, emoji changed → unlike → count decrements.
17. Comment → reply → edit within window → remove → tombstone visible, reply still visible.
18. Repost → header appears in feed → un-repost → header gone.
19. Quote repost → quote + embedded original render; embedded original has no action bar.
20. Bookmark → appears at `/bookmarks` → unbookmark → gone. Second account never sees it.
21. Upload 2 images → post → both render with correct aspect, no layout shift.
22. Upload a video → poster shows, no autoplay, plays on tap.
23. Oversized video → blocked in the picker with a readable message, nothing uploaded.
24. 360×640: action bar single row, picker fully on-screen at both card edges.

---

## 6. Do NOT

- Do not apply, merge, or push the migration with UI code.
- Do not add counter columns or counter triggers (R5).
- Do not expose a bookmark count (R4).
- Do not add a negative reaction (§3).
- Do not make the `post-media` bucket public.
- Do not autoplay video (R7).
- Do not build anything live-stream shaped, including a disabled button or a "coming soon" tile (§0.1).
- Do not add a SECURITY DEFINER function (R11).
- Do not touch messenger code — message reactions already shipped and are a separate table.

---

## 7. Report back

**After Part A (migration only):**
1. The two file paths, and confirmation that nothing was applied and nothing else is in the commit.
2. `git log --oneline -1` + `git diff --stat HEAD~1`.

**After Part B (once the hub says prod is merged):**
3. File list + diff stat.
4. `tsc` errors, `vitest` pass count, `next build` route count.
5. Screenshots at 360×640 of: action bar, reaction picker open, comment thread with a reply, 2×2 image grid, video poster state, `/bookmarks`.
6. Row counts of the five new/changed tables after E2E.
7. `docs/i18n/ne-review-BL-SOCIAL-02.md` row count.
8. Anything in this prompt you think is wrong — including §0.1. Push back before building, not after.
