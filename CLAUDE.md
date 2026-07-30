# CLAUDE.md — BridgeLink / NABIS-Project Operating Contract

You are the primary AI developer for BridgeLink. Read fully before acting.

## ⭐ STATUS (2026-07-20, updated) — real app, not a mockup

Auth (email/password + Google/Apple SSO, **route-gated: unauthenticated visitors land
on /signup, not the app**), profile + real "Verify your profile" flow (country-first,
camera capture), business registration (**tiered KYB — Tier 1 "Listed" needs no
registration number; Tier 2 "Verified Business" adds it and unlocks paid access**,
D-015), channels-as-business-directories, business team display **+ team management
(owner adds/removes members by email, auto-verified under the owner, per-member
posting rights)**, global directory (people + businesses, search/filter, **working
Message buttons**), events + real RSVP, the Feed/Messages toggle **with a working
post composer (verification-gated)**, and **real 1:1 direct messaging** (secure
`get_or_create_direct_thread()` DB function, live via Supabase Realtime) are all built
and wired to the live Supabase project. Paid-provider contact is gated behind an
honest "payment not yet wired" stub rather than a fake bypass. `npm run build` passes
clean, 15 real routes. Security advisor reviewed — two SECURITY DEFINER warnings are
intentional (narrow, validated RPCs for thread-creation and email lookup).

**Not yet built:** onboarding flow (removed, needs a rewrite for the new model),
channel-level posting/group discussion (channels are directory-only per spec default),
admin review/reports queue, Shufti Pro integration (verification writes a
`pending_integration` placeholder — interface is correct so wiring the real provider
is a drop-in), Stripe/payment processing for paid access (UI gate exists, no charge
flow yet), audit logging on writes, global search bar (directory has search; no
cross-entity top-bar search yet).

## ⭐ STATUS (2026-07-20, updated again) — real app, not a mockup

All of the above, PLUS this batch: **real onboarding** (profile basics → sector
selection → guidelines, writes to `profiles`, new signups land here first), a
**report/flag system** (working Report button on posts and businesses, writes to
`reports`), and an **admin review queue** at `/admin` (business verification
approve/reject, personal verification approve/reject, reports dismiss/action) —
gated by a dedicated `admin_users` table (never a column on `profiles`, since that
table's own "update your row" policy would otherwise let anyone self-grant admin).
`npm run build` passes clean, **17 real routes**. Security advisor re-checked — same
three reviewed/intentional findings, nothing new.

**To grant the founder (or anyone) admin access:** no UI for this yet by design —
insert a row directly via the Supabase SQL editor or ask Claude Code to do it:
`insert into public.admin_users (user_id) select id from auth.users where email = '<their email>';`

**Not yet built:** channel-level posting/group discussion (channels are
directory-only per spec default), Shufti Pro integration (verification writes a
`pending_integration` placeholder — interface is correct so wiring the real
provider is a drop-in), Stripe/payment processing for paid access (UI gate exists,
no charge flow yet), audit logging on writes (reports/verification actions aren't
yet mirrored into `audit_logs`), global search bar (directory has search; no
cross-entity top-bar search yet).

## ⭐ STATUS (2026-07-20, third update) — real app, not a mockup

All of the above, PLUS: **global search** in the top bar (real, debounced, searches
profiles/businesses/channels together, dropdown navigates to results), a **public
profile view at `/people/[id]`** (view + message any other member — `/profile`
remains the current user's own editor), and **audit logging** wired into every
admin decision (business/profile verification approve+reject, report
dismiss/action) and report submissions, closing the `audit_logs` gap the spec
requires (§5.10/§7.1). `npm run build` passes clean, **18 real routes**. Security
advisor re-checked — only the same two pre-reviewed intentional RPC warnings
remain; the audit_logs "no policy" finding is now resolved.

**Not yet built:** channel-level posting/group discussion (channels are
directory-only per spec default — channel owners adding a group discussion is a
documented future option, D-012), Shufti Pro integration (verification writes a
`pending_integration` placeholder), Stripe/payment processing for paid access (UI
gate exists, no charge flow yet — both need the founder's provider API keys before
they can be real).

## ⭐ BUILD HANDOFF — START HERE
- **Authoritative spec:** `docs/SPECIFICATION.md` (v1). It supersedes all other docs for *what to build*; its decision log (D-001…D-014) captures every product decision. `docs/PHASE0_FOUNDATION.md` is supporting narrative; `SPEC_v3.md` / `TASK_BREAKDOWN.md` are historical only. Also read `BUILD.md`.
- **Backend is already provisioned (Supabase — LIVE):**
  - Project `nabis-bridgelink` (ref `dhnggnxwjgqvghbxelvw`), region us-east-1.
  - URL `https://dhnggnxwjgqvghbxelvw.supabase.co`.
  - All 16 tables from §6.3 exist; RLS is enabled with **starter** policies; the 8 sector channels are seeded; a trigger auto-creates a `profiles` row on signup. Full DDL: `supabase/schema.sql`.
  - Client env: copy `.env.local.example` → `.env.local` (URL + publishable key pre-filled). Service-role key (server-only) is in the Supabase dashboard.
- **The app code here is an early prototype** (mock data, pre-pivot flows). Do NOT treat it as the target. Reuse its design system (`app/globals.css` corridor palette + component style); evolve/replace screens to match `docs/SPECIFICATION.md`, backed by Supabase.
- **RLS is partial** — complete/harden per feature as you build (§6.2 / §7.1); run the Supabase security advisor after DDL changes.
- **Build order:** auth → profile + verification → businesses + teams + channel directory → Feed/Messages → directory/search → events → admin → paid access. Ship phase by phase; keep `npm run build` green; use the `@verifier` subagent before closing a phase.

---


## Strategy (governs everything)

1. **Phase 1 — Atomic Network (Community first)** ← current. Invite-only professional
   community: Nepali business owners (US + Nepal), entrepreneurs, investors, serious
   diaspora. High signal, low friction.
2. **Phase 2 — Utility layer:** Trip Planner + content tools.
3. **Phase 3 — Transaction layer:** Marketplace + payments (+ full tiered KYC).

## Source-of-truth hierarchy

1. `docs/PHASE1_ATOMIC_NETWORK.md` — approved Phase 1 scope, pages, and constraints.
   Governs sequencing and what gets built now.
2. This file — workflow, conventions, status, decision log.
3. The starter-kit docs, now in `docs/` — `SPEC_v3.md` remains the long-term feature
   vision; its `TASK_BREAKDOWN.md` **sequencing is superseded** by the Atomic Network
   strategy (D-003). `LOOP_PAPER.md` is reference-only. `SETUP.md` covers the Claude
   Code loop setup (subagents/hooks in `.claude/`).

## Direction (sharpened 2026-07-18 — see docs/PHASE0_FOUNDATION.md)

BridgeLink is an invite-only, identity-verified networking + messaging platform for the
high-trust US–Nepal business community (business owners, investors, diplomats, finance,
media, senior professionals). Launch anchored to NABIS 2026 (Sept 26–27, NYC). Messaging
(vertical channels + DMs) is a first-class pillar alongside verified profiles + directory
+ curated feed. Members join by apply OR invite, then tiered identity verification.
`docs/PHASE0_FOUNDATION.md` is the founding spec; read it before Phase 1 build work.

## Current status (living — update every session)

- **Phase:** 1 (Atomic Network)
- **Done:** Full dashboard app built and verified (`next build` passes): shell
  (sidebar/topbar/mobile drawer), color-coded US/Nepal/Bridge view system with
  context rail, Home feed (view-filtered), 7 community sections, members
  directory (search + filters), events + RSVP, real-time messages (Supabase
  Realtime), composer, 6-step onboarding, profile/settings, i18n (en/ne, static
  UI), 12-sector taxonomy. Locked: Marketplace/Vendor, Trip Planner (preview
  only). Auth, admin review queue, and reporting are live against Supabase —
  **not mocked** (this line was stale until 2026-07-20; correcting it here so
  the next session doesn't re-learn that the hard way).
- **2026-07-29 — Option C: E2E suites SELF-PROVISION their target post — no permanent fixture in real feeds (branch off bl-social-03b, NOT merged):**
  - **Problem:** the permanent seeded `"E2E marker post - do not delete"` (view='us')
    sat in EVERY real user's feed — KC found it and commented "Awesome" on it. **Fix
    (hub-chosen Option C):** `e2e/_target.ts createTargetPost` — account A creates its
    OWN target post at run time (`posts_insert_own`, view='us'); `social.spec` (all 5)
    + `feed-media` test 24 drive its permalink; global-teardown hard-deletes it
    (`posts_delete_own`). All four engagement FKs are **ON DELETE CASCADE**, so the
    post's reactions/comments/reposts/bookmarks vanish with it — **this ELIMINATES the
    comment-tombstone residual** (comments now live on A's own, hard-deleted post).
    `MARKER_POST_ID` removed; the hub retires the seeded marker + KC's stray comment.
  - **NO production code changed.** (Rejected Option B — an `is_test` filter on the feed
    query — on the trade, NOT the design: a permanent test-only branch in the hottest
    path in the product, where a regression silently changes what real users see, and
    thrown away the moment the real fix lands. B is rejected now AND later.)
  - **D-059 accepted-and-unguarded:** A's per-run target is briefly visible in the live
    `us` feed for a run's duration — bounded, identical to what the compose/quote tests
    already do, and pre-pilot the only real user is KC. Accepted.
  - See the **PRE-PILOT HARD BLOCKER** in the Trust backlog: the real end to test data in
    real feeds is a SEPARATE Supabase project; Option C + teardown are stopgaps.
  - **Finding (fixed):** `createTargetPost` must `signOut({ scope: "local" })`, NOT the
    default global — a global signOut revokes A's refresh tokens EVERYWHERE, silently
    killing the concurrent tests' logged-in browser sessions (their next `getUser()`
    returns null → compose/publish no-ops with no error). Any mid-suite auth helper
    that signs in as a shared account must sign out LOCAL-only.
  - gates: tsc 0 · control-bytes 0 · full e2e **39 passed / 5 skipped / 0 failed** vs
    prod; teardown verified: A = 0 posts/reactions/reposts/bookmarks/comments/post-media
    (all engagement CASCADES with A's own target — no residual at all).
- **2026-07-29 — BL-SOCIAL-03b: the 5 feed SOCIAL-ACTION E2E tests (stacked on 03a; NOT pushed to a shared branch yet — hub verifies):**
  - `social.spec.ts` rewritten against the SHIPPED PostActionBar (Like/Comment/Repost/
    Share/Bookmark — the old `/react/i` selectors never matched): **react**
    (like → persist across reload → change kind via the hover picker → remove),
    **comment** (add → edit → soft-delete tombstone; the permalink opens comments by
    default, so the composer is used directly — clicking the toggle would CLOSE it),
    **repost** (add → undo), **quote** (compose → non-interactive card in the feed),
    **bookmark** (save → `/bookmarks` → unsave). Target = the marker post
    `ba1001a6…`; **chromium-only + serial** (all five mutate the same marker as the
    same account, and `post_reposts` PK `(post_id,user_id)` forbids concurrent
    repost/quote; the 360 action-bar layout is covered by feed-media test 24).
  - **Optimistic-write gotcha:** undo/unsave/remove flip the UI before the DB request
    lands, so the repost undo now waits for the actual DELETE response (else the next
    serial test sees A still-reposted → its menu shows "Undo repost", not "Quote").
    Other self-undos rely on the teardown (self-healing).
  - **Teardown extended (D-060):** hard-deletes A's reactions/reposts/bookmarks
    (`delete_own`) + tombstones A's live comments; A-scoped, so the marker's non-E2E
    seed reaction+comment are untouched. Verified post-run: A = 0 reactions/reposts/
    bookmarks/live-comments/posts; marker + seed intact.
  - **Accepted residual (D-059, hub-swept):** comments have NO client hard-delete —
    soft-delete only. The `protect_post_comment_columns` BEFORE-UPDATE trigger sets
    `body := null` when `deleted_at` is set, so a comment tombstone is **CONTENTLESS**
    (body null), IDENTICAL to a message tombstone — not "keeps body" (corrected: an
    earlier note here had the wrong premise; hub verified all 3 tombstones were
    body=null). Each test-17 run leaves ~1 contentless tombstone ROW; folds into the
    future RPC-called-by-teardown sweep, hub hand-sweeps meanwhile. **SUPERSEDED by
    Option C (see the self-provision bullet above): with A commenting on its OWN target
    post, the comment CASCADE-deletes with the post — no tombstone residue at all.**
  - gates: tsc 0 · control-bytes 0 · full e2e **39 passed / 5 skipped / 0 failed** vs
    prod (smoke 12 + attachments 14 + feed-media 8 + social 5; social ×360 skipped).
- **2026-07-29 — BL-SOCIAL-03a: feed MEDIA path E2E (tests 21–24) against prod (NOT pushed yet — hub verifies):**
  - **Why media first:** D-042 r1–r4 were all browser-only video failures (duration
    Infinity, detached-element seek, poster dims read too early, seek stall) that
    unit tests can't see — every one shipped with CI green. `e2e/feed-media.spec.ts`
    drives the real composer + PostMedia as verified account A: **compose 2 images →
    both render**, **compose video → poster + play button, no autoplay, `<video>`
    only after tap**, **>90s video rejected in the composer** (95s clip trips the 90s
    gate via container-bytes duration, no upload), **action bar stays a single row**
    (on the hub-seeded marker post `ba1001a6…`).
  - **Codec risk resolved empirically:** `extractPosterFrame` needs the browser to
    DECODE the video (else upload blocked); probed Playwright's bundled Chromium
    (149.x) — it decodes H.264/AAC, so the hub-requested mp4 fixtures work (no webm
    fallback).
  - **Fixtures ffmpeg-generated** in `scripts/gen-e2e-fixtures.mjs` (img1/img2.jpg,
    short.mp4 3s H.264/AAC faststart, big.mp4 95s) — never committed; the script
    **fails loudly if ffmpeg is absent**; CI installs ffmpeg in the e2e job.
  - **Teardown extended (D-060):** hard-deletes A's composed posts (`posts_delete_own`)
    + post-media objects (`post_media_delete_own`), fail-loud, logged. Compose tests
    use unique body tokens so parallel runs as the same account don't collide.
  - **BL-SOCIAL-03b PENDING (D-059 accepted-and-unguarded):** the 5 social-action
    tests (react/comment/repost/quote/bookmark) stay skipped in `social.spec.ts` — their
    spec-authored selectors (`/react/i`, `/comments/i`) don't match the shipped
    PostActionBar (Like/Comment/Repost/Share/Bookmark); the skip is loud. 03b rewrites
    them against the marker post.
- **2026-07-29 — BL-E2E-02 MERGED to main (`41f67eb`); BL-E2E-03 opened (this session — NOT pushed yet, hub verifies):**
  - **bl-e2e-02 merged** (fast-forward `79e8334..41f67eb`), pushed; stale
    `bl-e2e-02` local+remote pruned. The authenticated DM-attachment E2E suite
    (7 cases × 2 viewport projects = 14) runs green against the hub-seeded prod
    accounts.
  - **bl-e2e-03, three hub-directed fixes:**
    - **(1) Removed the D-059-violating blanket retry.** `retries` was
      `process.env.CI ? 2 : 0` — a silent-failure switch that gave every test
      three chances and made the FIRST real defect the harness found (the
      homepage #418) un-failable. Now **`retries: 0`**.
    - **(2) #418 root-caused + named-quarantined (NOT globally retried).**
      Reproduced with a provocation loop (48 loads, 8× concurrency): a
      RECOVERABLE React #418 element-level hydration mismatch fires ~8% on the
      two homepage routes (`/`, `/ne`). Root cause: `/[locale]/home` is **SSG**
      (static HTML — verified byte-identical across 6 server renders) and every
      marketing client island (ThemeToggle/MarketingLocaleSwitch/
      RequestInviteForm/MarketingMotion) renders a first client state that
      **matches** the server (no `Date`/`Math.random`/locale-format/`window`/
      `localStorage` at render; `<html>` mutation is `suppressHydrationWarning`).
      So there is **no source-level content divergence to fix** — React
      regenerates the tree client-side and the page is fully functional
      (smoke checks 1–4 pass). It appears only under parallel-load hydration
      (~8% at 8× concurrency); the concurrency correlation *suggests but does not
      prove* a real one-page-at-a-time visitor is unaffected. `smoke.spec.ts` now
      tolerates **only the exact React minified codes #418/#423/#425, only on
      those two routes** (no loose `hydrat` match — that would swallow a genuine
      hydration bug), with
      a `known-bug` annotation + console.warn naming **BL-E2E-03**; any other
      error there, and ANY error on the other routes, still fails on the first
      miss. Tracked as a framework-level follow-up (React-19 concurrent
      hydration), not a markup fix.
    - **(3) E2E prod-residue teardown (D-060).** `e2e/global-teardown.ts` cleans
      up what the run wrote against LIVE Supabase — see D-060. Also: `social.spec`
      HAS_MEDIA skip is now **LOUD** (console.warn naming the missing fixtures +
      case count when creds are present but media is absent, so a deleted fixture
      can't decay into a quiet green).
  - **Accepted-and-unguarded (D-059):** BL-SOCIAL-02's social E2E suite (9 cases;
    18 instances × 2 viewport projects) stays **skipped** pending its own media
    fixtures (`img1/img2.jpg`, `short/big.mp4`) + a seeded feed for account A —
    that is separate BL-SOCIAL-02 work; the skip is now loud so it can't rot. (The
    "32 previously skipped" = attachments 14 + social 18 before bl-e2e-02
    activated attachments.)
- **2026-07-28 — BL-MSG-05 (WhatsApp DM attachment sheet + server-side magic-byte gate) MERGED to main; D-053 APPLIED to prod by the hub:**
  - **main = `565740d`** (merge of `bl-msg-05` into `3b41bb4`). No code conflicts —
    only the CLAUDE.md decision log (straight union of the BL-MSG-05 rows
    D-051/052/053/056/057 with the BL-NAV-01 rows D-054/D-055), resolved to a contiguous
    **D-051…D-058** block.
  - **D-053 migration APPLIED to prod 2026-07-28 (hub), verified:** bucket
    `message-attachments` = **50MB / 11 mime / still private**; all four notify/protect
    DEFINER fns → `anon`+`authenticated` EXECUTE = **false** (proacl `{postgres,
    service_role}`); security advisors **13 WARN → 5** (all 8 notify/protect lints
    cleared, **0 ERROR**); DEFINER triggers still fire post-revoke (verified with a live
    authenticated reaction). Recorded in `list_migrations` as
    `msg_attachments_expand_and_notif_revokes`. The BL-NOTIF-01 "revoke owed" item is
    **CLOSED**.
  - **The revoke bug round-2 caught (D-057):** `revoke ... from anon, authenticated` was
    a NO-OP — the default EXECUTE grant is to PUBLIC, so both roles kept it. Fixed to
    `revoke ... from public, anon, authenticated` (migration + inverse rollback).
  - **P0 sniffer fix (D-052 impl):** `looksLikeText` rejected bytes 0x80–0x9f as "C1
    controls", but those are legal UTF-8 CONTINUATION bytes — every non-ASCII UGC file
    (Devanagari/CJK/accents/emoji) sniffed clean on upload then 403'd on read. Replaced
    with RFC-3629 structural validation (C1/DEL rejected in the CODEPOINT domain). Plus
    P2a ftyp brand reject-list (HEIC/HEIF/AVIF/JP2 ≠ mp4) and P2e two-stage sniff (512B
    probe, refetch 64KB only for ZIP/text) to cut read-route egress.
  - **Still Phase-1 deferred (unchanged):** attachment BYTES are access-controlled but
    NOT E2E-encrypted (D-051 — encrypting would defeat the load-bearing malware scan);
    they join the E2EE client when it ships. Gates at merge: tsc 0 · vitest 328/328 ·
    build 67/67.
- **2026-07-27 — D-033 gap-closure (audit of the pushed D-033 build; the completion doc was stale — libs + guided UI already shipped):**
  - **Audit result — most items already SHIPPED:** (a) Step0 fork US→manual /
    Nepal→guided, two equal buttons, Google import hidden — `d5698a6`. (b)
    GuidedBuilder 8 questions + BioReview (EN+NE side-by-side, editable, Regenerate,
    "This looks right") wired to the libs — `d5698a6`. (c) PathSwitchLink on both
    paths, shared state carried — `d5698a6`. (d) `website.server.ts` importer with
    the FULL guard set (https-only, SSRF incl. CGNAT re-checked every redirect,
    robots, 5s, 1MB stream cap, 5/hr, mode live|fixture|off default off, no stored
    HTML, logo candidate not hotlinked) — `2b08f06` (UI affordance intentionally
    hidden per D-033). (e) A-1: neither form writes `is_paid_provider`; manual review
    copy = price recorded only. (f) `business/[id]/edit` covers profile_answers +
    Regenerate, secondary ≤4, social_links, website_url, phone, address_line, city.
    (i) events detail/ICS/month-view shipped (`e3cb090`); **Feed/Messages split was
    subsumed by messenger Phase 1** (the two-pane inbox replaced it).
  - **Gap CLOSED — (h) a11y tap targets (`711e2a5`):** guided nav/CTA + free-text
    inputs were 40–52px; bumped to ≥56px (chips/tiles already 56/76).
  - **(g) i18n naming reality:** the checklist named `business.new.*/catalog.*/
    bio.template.*`, but the shipped design puts UI chrome under `guided.*`(38) +
    `businessNew.*`/`businessEdit.*` (en+ne, parity-tested) and the catalog/bio
    strings as **bilingual data in the libs** (`serviceCatalog` `Chip{en,ne}`,
    `SECTOR_BIO_LABEL{en,ne}`, deterministic `bioAssembler`) — correct for
    no-translation-model assembly, not JSON keys. `emit-ne-review.ts` re-run →
    `docs/i18n/ne-review-BL-BIZ-02.md` = **150 data rows**, unchanged/in-sync.
  - **(j) D-034 is NOT defined anywhere in the repo** — flagged, not invented. D-033
    stands as shipped + live. If a D-034 is intended (e.g. to formalize the M-FIX
    server-side translation-cache decision), the hub should define it.
  - gates: tsc 0 · vitest 195/195 · build 64/64. Pushed `711e2a5`.
- **2026-07-27 — Batch M-FIX (P0 translation-cache vuln + E2EE-readiness RPC fixes; app fix committed locally, migrations prepared but NOT applied, NOT pushed — hub signs off):**
  - **P0 fixed (client-first).** `cache_post_translation` (SECURITY DEFINER, EXECUTE
    → `authenticated`) let ANY signed-in account write an arbitrary translation onto
    any post where `body_translated is null` (first-writer-wins, no ownership/length
    check). Translation is already server-side (Anthropic via `/api/posts/translate`;
    the client sends `postId` only), so the fix keeps server translate and moves the
    CACHE WRITE to a server-only service-role guarded `UPDATE` (`lib/supabase/service.ts`
    — returns null + degrades to ephemeral when `SUPABASE_SERVICE_ROLE_KEY` is unset,
    which it is locally), behind a length cap (≤ 4× source, floor 240) + target-lang
    check. `PostCard` unchanged (already sends `postId` only). Forward migration
    `20260727120000_drop_cache_post_translation_rpc.sql` revokes authenticated EXECUTE
    + drops the RPC — **hub applies AFTER the app ships** (client-first; restriction-
    first only degrades, never hard-breaks).
  - **E2EE-readiness RPC fixes (files only, NOT applied):**
    `20260727121000_messaging_e2ee_rpc_fixes.sql` (+ `.rollback.sql`): `edit_message`
    gains `p_body_iv` (default null); `schema_version = 1` requires a fresh IV and
    rejects IV reuse (writes body + body_iv atomically); `schema_version = 0` rejects
    a non-null IV. `delete_message_for_everyone` also nulls `body_iv`.
  - **Parked-commit reconcile:** `2b08f06` and `e3cb090` are BOTH already ancestors of
    `origin/main` (shipped as their own pushed commits, nothing local/dropped).
  - **D-033 completion doc absent** from the repo (`features/BL-BIZ-02b-…` does not
    exist) — flagged, not guessed. gates: tsc 0 · vitest 195/195 · build 64/64.
- **2026-07-26 (later) — Messenger Phase 1.5 E2EE FOUNDATION (DB on prod + verified crypto core; client UI integration deliberately NOT shipped — browser-verification gate):**
  - Migration `20260726160000_messaging_e2ee` (applied to prod; verified first on a
    disposable branch — advisors clean, **8/8 RLS proofs**, ciphertext-opacity demo,
    all FKs indexed): `user_keys` (ECDH P-256 public keys, world-readable so peers
    can wrap a thread key FOR you), `user_key_recovery` (owner-only, PBKDF2-wrapped
    private key backup), `thread_keys` (per-participant AES-GCM key wrapped via
    HKDF(ECDH); you can only SELECT your OWN row — a wrong participant cannot even
    read another's wrapped key), `messages.body_iv` (per-message IV; `body` = base64
    ciphertext when `schema_version=1`). Reactions / read cursors / typing /
    timestamps stay plaintext metadata (documented tradeoff).
  - `lib/e2ee/crypto.ts` — **Web Crypto ONLY**, standard constructions (ECDH P-256 +
    HKDF-SHA256 KEK, AES-GCM-256 messages with a fresh 12-byte IV, PBKDF2 250k for
    recovery). **+10 unit tests against real Node WebCrypto**: message round-trip,
    fresh-IV (no nonce reuse), wrong-key + wrong-phrase rejection,
    **wrong-participant-cannot-unwrap-a-thread-key**, and
    **recovered-key-decrypts-a-thread-key-wrapped-for-it** (end-to-end recovery).
  - **NOT SHIPPED (deliberate, gated):** the client integration — IndexedDB key
    store, BIP39 recovery-phrase UI (unskippable), thread-key establishment
    handshake, send→encrypt / receive→decrypt wiring, encrypted attachments,
    client-side previews, report-decrypted-copy. The spec REQUIRES two-browser live
    decrypt + fresh-profile recovery verification, which this (browser-less)
    environment cannot run; per the stated commitment, safety-critical E2EE
    integration is not blind-pushed. Gates on what IS shipped: tsc 0 · vitest
    195/195 · build 64/64 both locales.
- **2026-07-26 — Messenger Phase 1 (WhatsApp-style features; DB applied to prod, frontend build-green, pushed):**
  - Migration `20260726130000_messaging_phase1` (applied to prod; verified first
    on a disposable branch — advisors clean, 12/12 negative RLS + edit/delete
    window-rejection proofs): `messages` += `reply_to_message_id` / `edited_at` /
    `deleted_at` / `attachments jsonb` / `schema_version` (body now NULLABLE so a
    tombstone can null content server-side); new `message_reactions` (one per
    message/user, RLS = thread participants via `private.can_access_message`) +
    `message_hides` (delete-for-me, owner-only); SECURITY DEFINER RPCs
    `edit_message` (15-min window) + `delete_message_for_everyone` (1-hr window,
    tombstone nulls body + drops reactions) — messages has NO direct UPDATE/DELETE
    policy so the RPC is the only mutation path (window can't be bypassed by raw
    SQL); `enforce_reply_integrity` trigger (reply must be same-conversation;
    revoked from the API, not an RPC); `message_reactions` +
    `direct_thread_participants` added to the realtime publication; private
    `message-attachments` bucket + storage RLS keyed on path
    `{thread_id}/{uploader_id}/{file}`.
  - **Read tracking REUSES `direct_thread_participants.last_read_at`** (D: seen =
    every OTHER participant's cursor ≥ the message's created_at) — no per-message
    reads table; group-ready, O(1) per thread.
  - Frontend: `ThreadConversation` rewritten — sent/seen ticks, typing broadcast
    (ephemeral, 3s), reply (quoted preview + scroll-to-original), edit (15-min,
    "edited" label), delete (for-everyone tombstone / for-me hide), reactions
    (hover/long-press quick bar 👍❤️😂😮🙏 + lazy-loaded `frimousse` full picker,
    realtime grouped chips), attachments (client resize ≤2000px + type/size
    validate, private bucket, server signed-URL route `/api/messages/attachment`,
    inline images + lightbox / doc cards), load-earlier pagination, wrapped in an
    ErrorBoundary. Inbox left-pane previews show 📷 Photo / 📄 Document /
    tombstone via `messagePreview`. New `lib/messaging.ts` pure helpers
    (window/seen/preview/quote) +21 unit tests; new `lib/attachments.ts`.
  - **Runtime-unverified in this environment (no browser — Playwright binary
    blocked):** the two-browser LIVE exchange (ticks/typing/reactions updating
    live across contexts), long-press menu, lightbox, mark-read-on-focus, and the
    emoji picker rendering. DB/RLS/window enforcement IS proven via SQL. Gates:
    tsc 0 · vitest 185/185 · build 64/64 both locales. **E2EE is Phase 1.5 (next).**
- **2026-07-24 (sprint 9) — Nepali bio system: auto-translated marker + structured sector labels (branch migration, NOT pushed):**
  - **Branch migration** `bio-ne-auto` (ref `ocxsljiqiepoehdaihlf`, ~$0.32/day
    until merged), `20260724205853_bio_ne_auto.sql` (+ rollback): additive
    `profiles.bio_ne_auto` + `businesses.bio_ne_auto` (boolean NOT NULL default
    false; true = machine-translated draft not yet owner-reviewed). Advisors clean
    (same 3 intentional WARN; a boolean column adds nothing). NOT merged.
  - **BioText auto marker** — new `auto` prop + `lib/bilingual.ts isAutoBio(locale,
    pick, bioNeAuto)`: when the **active-locale** Nepali bio is shown (locale ne,
    `origin === null`) AND `bio_ne_auto`, renders "· Auto-translated" /
    "· स्वतः अनुवादित" (`common.autoTranslated`, en+ne) — distinct from the fallback
    "(English)/(नेपाली)" marker. Wired into person + business detail pages,
    MemberCard, BusinessCard (members page selects + passes `bio_ne_auto`), and the
    channel detail business list (upgraded from raw `b.bio` to bilingual BioText).
  - **Owner ownership** — profile editor + business registration set
    `bio_ne_auto = false` on save (owner reviewed the text).
  - **Structured sector labels (D-020 audit)** — the only violations were the two
    channels pages, which rendered the sector header from the DB English
    `channel.name`. Both now render from the **i18n `sectors` map** by slug
    (fallback to the stored name for any non-sector slug). Everything else
    (directory filters, register-business chips, admin sector/role labels, the
    People/Businesses tabs) already used `useSectors()`/i18n — no change. The 15-slug
    Nepali sector map already exists; no new map needed.
  - **Ordering dependency:** the explicit members-page selects now request
    `bio_ne_auto`, so — like `bio_ne` before it — the app works against prod only
    once the branch merges (client untyped → tsc/build green; not pushed). Hub
    merges branch + pushes together. gates: tsc 0 · vitest 76/76 · build 54/54 both
    locales. **NOT pushed — hub verifies.**
- **2026-07-24 (sprint 8) — Onboarding / first-run flow (frontend + 1 preferences key, pushed a0d369a):**
  - **`preferences.onboarded`** (jsonb, no migration) added to `lib/preferences.ts`
    (default false; merge-managed). `lib/onboarding.ts` = `fetchOnboarded` /
    `markOnboarded` (read-modify-write, never clobbers).
  - **Redirect-once** — `components/OnboardingRedirect.tsx` (mounted in the (app)
    layout) runs once per app mount: if `onboarded !== true` → `router.replace(
    "/welcome")`. Exempts `/welcome` (target) + `/onboarding` (OAuth/invite entry)
    so it never traps; "Skip for now" and completion both set `onboarded=true`.
    The existing `/onboarding` finish now also marks onboarded, so OAuth/invite
    users don't double-flow.
  - **`/welcome`** (new page in (app), 3 steps, skippable at every step):
    - **Step 1** Complete your profile — bio EN + ने (bilingual pattern) + city →
      `profiles.bio/bio_ne/city`. **Avatar skipped** (no existing storage plumbing
      — not building new storage this commit, per scope).
    - **Step 2** Your sectors — persisted `sectors[]` as add/remove chips
      (`profiles.sectors`); under each selected sector, up to 3 **real**
      members/businesses (RLS-respecting `overlaps`/`in` queries, private filtered;
      **nothing shown when none** — no filler).
    - **Step 3** Where things are — Feed / Members & Business / Trip Planner cards,
      one honest sentence each; when the user's sectors include tourism-hospitality
      the Trip Planner card swaps to **"Publish your first offering"** → offering
      editor. Each card + Finish complete onboarding then navigate.
  - Works both locales (i18n parity), both themes; responsive (no 375px overflow).
    +20 `welcome` i18n keys × en/ne. gates: tsc 0 · vitest 76/76 · build 54/54 both
    locales. **NOT pushed — hub verifies.**
- **2026-07-24 (sprint 7) — Settings account-page polish (frontend, pushed 00892af):**
  - **Overflow fix (real bug).** Root cause: `SettingsRow`'s control column is
    `shrink-0`, so a long status/error note in a non-wrapping flex (the Password
    row) forced the column — and the row — wider than the card → horizontal scroll.
    All account rows (name/email/phone/password) now use one pattern: label+helper
    left, a **width-bounded control column** (`w-full sm:w-72`) right, `w-full`
    inputs, `flex-wrap` action rows, notes `break-words` — so no child can exceed
    the card at 375/675/1280. Password stacks Current/New/Confirm vertically.
    Audited the other settings pages: `PrivacyForm`'s save/error row hardened
    (flex-wrap + break-words); appearance/devices already wrap; data/support are
    links. No DB changes.
  - **Email row** — kept "Update email" (Supabase has one email per user; a
    recovery-email field would imply account-recovery capability that doesn't
    exist). New helper copy; a **pending-change notice with the masked new address**
    when `getUser().new_email` is set.
  - **Request verification** — the RPC was NOT broken (the 400 was the admin DMing
    themselves). Moved the admin id + `canRequestVerification` into `lib/support.ts`;
    the button is **hidden when the current user is the admin** (the only 400 case).
    Real UX otherwise: loading state, calls the RPC directly to surface its message,
    navigates to the returned thread on success, shows a **visible error alert** on
    failure — no silent no-op. `currentUserId` passed from the server page. +1 pure
    helper test (admin-self hidden). No change to `get_or_create_direct_thread` or
    any DB object.
  - gates: tsc 0 · vitest 76/76 (+3 support) · build 52/52 both locales. **NOT
    pushed — hub verifies.**
- **2026-07-24 (sprint 6) — Trip Planner v2, Commit C2: festival overlay + compare + filters (frontend, pushed da51a66):**
  - **Festival overlay (Step 2)** — `festivalsOverlappingRange` (pure + tested):
    when the date range overlaps a `festivals` row it shows a banner + chips
    "<festival> (<dates>)"; dated windows (`dates` jsonb, per year) take priority,
    falling back to `month_hint` when a year has no dates. Nepal-bound trips
    overlapping dashain/tihar add the peak-season advisory. Chips jump to Step 3
    pre-filtered to that `festival_slug`. Bilingual via `pickFestivalName`.
  - **Compare tray (Step 3)** — `OfferingCard` gained optional
    `selectable`/`selected`/`onToggleSelect` (a header checkbox, additive — other
    usages unaffected). Select up to 4 → sticky "Compare (n)" bar → side-by-side
    panel (price+unit, duration, group, seasons, festivals, location, provider +
    TrustBadge, per-column Add-to-itinerary). Purely client-side.
  - **Filter row (Step 3)** — type / season / festival / price-range, applied by
    `applyOfferingFilters` (pure + tested) on top of C1's direction/date matching.
    Distinct empty states: no trip match (Directory + publish links) vs. no filter
    match (clear-filters).
  - +8 tests (festival overlap incl. month_hint fallback, `monthsFromHint`, filter
    matrix). +26 `tripPlanner` + `offerings.compareSelect` i18n keys × en/ne.
  - NOT in C2 (Commit D, blocked on Travelpayouts): flight guidance.
  - gates: tsc 0 · vitest 73/73 · build 52/52 both locales. **NOT pushed — hub verifies.**
- **2026-07-24 (sprint 5) — Trip Planner v2, Commit C1: planner wizard rebuild (frontend, pushed e56314a):**
  - Replaces the generic form + the fake "Suggested starting points" (curated
    templates + directory-business recommendations) with a real 4-step wizard over
    the live offerings/festivals schema. `recommendationsFor`/RECOMMENDATION_TEMPLATES
    stay in `lib/tripPlannerData.ts` (still exported + tested) but are no longer
    rendered; `budgetBreakdown` still drives Step 4.
  - **Step 1 Direction** — "Where is this trip?" 5 options; "Other" reveals
    origin+destination ISO-3166 selects. Writes `itineraries.direction/
    origin_country/destination_country` (fixed directions → NP/US endpoints).
  - **Step 2 When & who** — title, date range, group size, budget band + currency,
    interest chips (existing taxonomy).
  - **Step 3 From our providers** — grid of PUBLISHED offerings (reuses
    `OfferingCard`) filtered by `matchOfferings` (`lib/tripPlanner.ts`, pure +
    tested): direction_tags contains the choice (empty = shown), offering.country
    matches the destination side, date-window overlap when both set; interests
    rank-only (loose, never exclude). **Honest empty state** — no fabricated cards:
    "No published offerings match this trip yet." + Directory link + (if
    `canPublishOfferings(viewer)`) "Publish your first offering". "Add to
    itinerary" stages an item with `offering_id` + `business_id`, title +
    `price_from` from the offering.
  - **Step 4 Itinerary** — day-by-day builder (per-item day, provider chip →
    offering detail for offering-linked items) + budget breakdown seeded by real
    prices (planned-items total). Free-form custom items kept (v1 behavior).
  - **"Talk to a travel advisor"** (Steps 3–4) — DM via
    `get_or_create_direct_thread` to a verified tourism-hospitality professional
    (`sectors` contains tourism-hospitality, verified, not self); falls back to the
    admin id; prefilled "Travel advisor request —". Human, not AI.
  - NOT in C1 (C2): festival-calendar overlay, compare tray, flight guidance.
  - New `lib/tripPlanner.ts` (+`__tests__`, +11 tests: direction endpoints,
    category mapping, range overlap, match/rank). +27 `tripPlanner` i18n keys × en/ne
    (direction/country labels reuse the `offerings` namespace). gates: tsc 0 ·
    vitest 65/65 · build 52/52 both locales. **NOT pushed — hub verifies.**
- **2026-07-24 (sprint 4) — Settings fix batch (frontend; P0–P7, pushed 5085e53):**
  - **P0 (prod bug) — legal pages now public in every locale.** Root cause:
    `stripLocale` skipped the default locale, so an explicit `/en/terms` kept its
    `/en` prefix and `isPublicPath` failed → logged-out visitors bounced to
    `/login` (the docs signup links to for consent). Fix: strip the `/en` prefix
    too. **Verified with a logged-out `next start` + curl:** `/terms`, `/ne/terms`,
    `/privacy`, `/ne/privacy` → 200; `/en/terms`, `/en/privacy` → 307 to the
    canonical `/terms`/`/privacy` (render), no longer `/login`; control `/members`
    → 307 `/login`. +7 authRouting tests (all four legal URLs through the
    stripLocale→isPublicPath pipeline). No `/settings/legal` links exist; the data
    page already points at `/terms`+`/privacy`.
  - **P1 Account** — (a) display name never seeds from the email: if
    `profiles.name === user.email` it's treated as unset (placeholder "e.g. Kris
    Dahal" + helper), and saving a name equal to the email is blocked (frontend
    guard, no migration). (b) **Real password change**: Current / New / Confirm;
    the current password is verified via `signInWithPassword` **before**
    `updateUser({password})`; validates new≠current, confirm=new, min 8, inline
    errors. (c) **Phone** bound to the existing `profiles.phone` column, optional +
    basic format check. (d) **Request verification** button → DM to the admin via
    `get_or_create_direct_thread` with a prefilled draft (`?draft=` seeds the
    composer); pilot stays admin-curated, no self-serve. Admin id via
    `NEXT_PUBLIC_SUPPORT_ADMIN_ID` (falls back to the pilot admin's user id).
  - **P2 Privacy** — the person page now renders `profiles.phone` only when
    `sharing_defaults.show_phone` is on; unset resolves to OFF (already the
    `readPreferences` default). All privacy toggles already read saved state.
  - **P3 Appearance** — timezone groups reordered: **United States** + **Nepal &
    South Asia** at top, then Other. Language stays EN + ने.
  - **P4 Devices** — added **Sign out of all other devices**
    (`signOut({ scope: 'others' })`) with a confirm step + success state; nav label
    stays "Devices" (per-session list remains Phase B, needs a service-role route).
  - **P5 Data** — added the note "Your export downloads immediately as a JSON file."
  - **P6 Support** — visible **kcdream0913@gmail.com** ("Pilot support") + mailto
    `?subject=BridgeLink support request`. Deliberately NOT `support@bridgelink.app`
    (domain not owned — publishing it would misroute support mail).
  - **P7 Naming** — product name is already **BridgeLink** everywhere (metadata
    title/description); the remaining "NABIS" strings are summit/event references in
    mock `lib/data.ts` / `lib/tripPlannerData.ts`, which is allowed.
  - gates: tsc 0 · vitest 54/54 (i18n parity + 7 new routing) · build 52/52 both
    locales. **NOT pushed — hub verifies.** Hub: set `NEXT_PUBLIC_SUPPORT_ADMIN_ID`
    in Vercel if the admin id ever changes (default is the current pilot admin).
- **2026-07-24 (sprint 3) — Trip Planner v2, Commit B (provider Offerings; frontend, pushed 3939f9e):**
  - Commit A MERGED to prod by hub (offerings + festivals + itinerary columns +
    RLS live; both spent branches deleted). Commit B builds the provider surface
    on that live schema — no new DB work.
  - **`lib/offerings.ts`** — slugs/enums (9 types, 5 direction tags, 3 price units,
    5 seasons), `Offering`/`Festival` types, `formatMoney`, `pickFestivalName`,
    `canPublishOfferings` (tourism-hospitality gate). Labels translate via the new
    `offerings` i18n namespace (74 keys × en/ne, parity green).
  - **`OfferingCard`** (reusable — Commit C's planner will consume it): bilingual
    title (pickBio), type chip, price + unit, region/country/duration, season +
    festival chips, provider Avatar + TrustBadge, links to the detail view.
  - **`OfferingsSection`** on **profile (`/people/[id]`) + business (`/business/[id]`)**
    detail pages: loads the subject's offerings (RLS scopes visibility — published
    to all, drafts to the owner), renders the card grid. Hidden entirely when there
    are none and the viewer isn't the owner. Owner (with tourism sector) gets an
    **Add offering** button; drafts show a status chip + Edit link.
  - **`OfferingEditor`** (create/edit) at `/offerings/new` (`?business=<id>` sets
    `business_id`, else own profile sets `profile_id` — never both, DB CHECK
    enforces) and `/offerings/[id]/edit`. Fields: type, bilingual title +
    description, country, region, direction tags, price_from/currency/unit,
    duration, group min/max, seasons, festivals (loaded from `festivals`, grouped
    by country with month_hint), availability dates, draft/published. Tourism-sector
    gate on the entry routes (UX; RLS is the real guard).
  - **Offering detail** (`/offerings/[id]`, server): full view + provider (private
    profile falls back to "Member" but Inquire still resolves the real user id) +
    **`InquireButton`** → `get_or_create_direct_thread` with the provider. Owner
    sees Edit + a note instead of Inquire.
  - **Media upload SKIPPED this commit** (media stays `[]`) — tracked follow-up,
    noted in the editor UI too. gates: tsc 0 · vitest 47/47 · build 52/52 both
    locales. **NOT pushed — hub verifies; Commit C = planner wizard rebuild.**
- **2026-07-24 (sprint 3) — Trip Planner v2, Commit A (DB only; branch, NOT merged):**
  - Ref BL-TRIP-01 / D-019: publishers = businesses AND professionals; schema
    supports all sectors (UI stays tourism-only for now); no live flight API.
  - Branch `trip-planner-db` (ref `bdgcdmyidnpqyeexfatz`, ~$0.32/day until
    merged/deleted). Migration `20260724173650_trip_planner_v2.sql` + matching
    `…rollback.sql`. Additive + backward compatible.
    - **itineraries** += `direction` (CHECK np_to_us|us_to_np|domestic_np|
      domestic_us|other), `origin_country`, `destination_country` (all nullable).
    - **offerings** (new, 27 cols): owner is a business (via
      `businesses.owner_user_id`) OR a professional (`profile_id = auth.uid()`),
      enforced by a paired CHECK (`(owner_type='business')=(business_id is not
      null) and (owner_type='profile')=(profile_id is not null)` → exactly one FK
      set). type/price_unit/status CHECKs; bilingual title/description; sectors
      default `tourism-hospitality`; media jsonb. **RLS** split by command (one
      permissive policy each → no multiple_permissive_policies): SELECT =
      published OR owner; INSERT/UPDATE/DELETE = owner only; `(select auth.uid())`
      wrapped (no initplan). No anon. FK columns indexed.
    - **festivals** (new): `slug` PK, bilingual name, country CHECK, `month_hint`,
      `dates jsonb`. RLS SELECT-only for authenticated, no write policy. **Seeded
      14**: 10 Nepal 2026 (losar, shivaratri, holi, nepali-new-year,
      buddha-jayanti, tiji, teej, indra-jatra, dashain window, tihar) + 4 US-side
      slugs with no fixed dates (dashain-us, tihar-us, nepali-new-year-us, nabis).
    - **itinerary_items** += `offering_id` FK → offerings ON DELETE SET NULL (indexed).
  - **Verified on the branch:** paired CHECK rejects mismatched owner rows; a
    valid profile-owned offering inserts; RLS — owner sees own draft+published (2),
    a stranger sees only published (1); a stranger cannot insert under another
    identity, and a client cannot write `festivals` (both RLS-denied). Test rows
    reverted; festival seed left intact (offerings 0, profiles 0, festivals 14).
  - **Advisors (branch):** security = the 3 pre-existing intentional WARN, nothing
    new; performance = only 2 INFO `unused_index` on offerings (empty-branch
    artifact — zero unindexed_foreign_keys / initplan / multiple-permissive for
    the new objects). Client is untyped → no generated-type regen needed.
  - gates: tsc 0 · vitest 47/47 · build 50/50 both locales. **Commit A NOT pushed,
    branch NOT merged — hub verifies before Commit B/C (frontend).**
- **2026-07-24 (sprint 2) — Sprint-1 shipped to prod + signup data now persists:**
  - **bilingual-bio branch MERGED to prod, branch DELETED.** `profiles.bio_ne` +
    `businesses.bio_ne` are live (migration recorded `20260724162707`); prod
    advisors = the 3 pre-existing intentional WARN, nothing new.
  - **The 3 auth-overhaul + bilingual commits are PUSHED** (`1d2cb11` auth
    isolation, `026a970` real sign-up, `18bff91` bilingual bios); prod Vercel
    deploy `dpl_5piT8Vm…` built from `18bff91` (READY).
  - **signup-persist PUSHED (`f5ecdd6`) + hub-MERGED to prod** (consents table +
    extended handle_new_user live). Migration `20260724165101_signup_data_persist.sql`:
    - **`handle_new_user()` extended** to copy `country` + `sectors[]` out of the
      signup `user_metadata` into the new `profiles` row, so a new member lands in
      the right sector directories immediately (previously only
      name/avatar/provider were copied; country/sectors sat unused in metadata).
      country is lower-cased + validated against the `us|nepal` CHECK (else NULL,
      never a failed insert); sectors are filtered to slugs that exist in
      `channels.slug` (a stale/forged slug can't land). OAuth signups (no consent/
      country/sectors in metadata) still insert cleanly — country NULL, sectors
      `{}`, 0 consent rows; onboarding fills those for the OAuth path.
    - **Append-only `consents` ledger** (BL-LEGAL-05 §4): `consents(user_id,
      doc_type, doc_version, granted_at, ip, locale)`. Written **server-side from
      the trigger** because there is NO client session at signup (email
      confirmation required). RLS = owner insert/select own (`(select auth.uid())`
      so no `auth_rls_initplan` finding); **no UPDATE/DELETE policy → append-only**
      for authenticated callers. `ip` is nullable and left NULL — a DB trigger
      can't see the end user's request IP (populating it needs an app/edge layer,
      out of scope). The trigger writes one row per doc (tos + privacy), deriving
      `doc_type` from the `tos_`/`privacy_` prefix and `doc_version` from the rest.
    - **Verified on the branch** with two simulated signups: (1) `country:'US'` →
      `us`, sectors `[technology-ai, not-a-real-sector, energy-hydropower]` →
      `[energy-hydropower, technology-ai]` (bogus filtered), 2 consent rows
      (`v0.2-pilot`, locale carried, ip NULL); (2) OAuth-shape metadata → clean
      defaults, 0 consent rows. Branch advisors clean (same intentional WARN +
      the branch-default leaked-password Auth WARN; **zero new** on `consents`/
      the trigger, both security and performance).
    - Client: only the stale signup comment updated (consent capture now lives in
      the trigger, not "a follow-up"). **NOT pushed, branch NOT merged — hub
      verifies.** gates: tsc 0 · vitest 47/47 · build 50/50 both locales.
    - **Still flagged (NOT built):** the dedicated `consents` UI/export surface,
      NE Privacy translation before Nepal onboarding, real IP capture.
  - **LinkedIn OAuth:** re-checked GoTrue `/settings` — `linkedin_oidc` is still
    `false` (also `linkedin` false, `google` true, `apple` false), so **no button
    was added** (hide-if-not-configured, D-028). Enable `linkedin_oidc` in
    Supabase → Auth → Providers and it's a one-line add. No commit this pass.
- **2026-07-24 (sprint) — Auth overhaul + bilingual bios (3 commits, now pushed; bilingual-bio branch now merged — see sprint 2 above):**
  - **COMMIT 1 (`1d2cb11`) — auth isolated from the app shell (route-group split).**
    Logged-out visitors were seeing the full app chrome (rail, top bar, avatar +
    online dot) on /login and /signup — root cause: `AppShell` was mounted in
    `app/[locale]/layout.tsx`, wrapping every route. Fixed structurally: the root
    locale layout now renders providers only; `(app)/layout.tsx` owns
    AppProvider + AppShell and all authed routes were git-moved into `(app)/`
    (URLs unchanged). `(auth)/layout.tsx` = a chrome-free centered card with an
    `AuthLocaleSwitch` (English | नेपाली) in the footer — a Nepali-only visitor
    can switch **before** login (Settings is unreachable pre-auth). `/terms` +
    `/privacy` stay at the locale root, also bare. **Top-bar LanguageToggle
    removed** (language now lives in Settings + auth footer); component deleted.
    Middleware: unauthenticated → **/login** (was /signup); PUBLIC_PATHS gains
    /forgot-password + /pair. New chrome-free routes: /forgot-password (real
    `resetPasswordForEmail`) + /pair (Beta stub). login gained a "Forgot
    password?" link.
  - **COMMIT 2 (`026a970`) — real sign-up.** /signup collects full name, country
    (US/Nepal → lowercase for the CHECK), email, password + confirm, sector
    interests (15-chip multi-select), and an 18+ checkbox with inline Terms/
    Privacy links + the US-processing notice. signUp carries name/country/sectors
    + a versioned consent record (tos/privacy v0.2-pilot + timestamp + locale) in
    **user_metadata** (mailer_autoconfirm is off → no session at signup, so it
    shows a "confirm your email" state → /login). Password-strength meter +
    friendly accent errors.
    - **OAuth VERIFIED against prod GoTrue /settings: google = true, apple =
      false.** Apple button HIDDEN on /login + /signup; only Google shown.
    - **Follow-up flagged (NOT built, frontend-only commit):** copying
      profiles.country/sectors out of user_metadata (needs a `handle_new_user`
      extension) + the dedicated append-only `consents` table (BL-LEGAL-05 §4).
      Consent is version-recorded in user_metadata meanwhile.
  - **COMMIT 3 (`<pending>`) — bilingual bios.** Branch migration
    (`bilingual-bio`, ref `owgegsajzhefveczhgtx`, **NOT merged**, ~$0.32/day):
    `20260724162707_bilingual_bio.sql` adds `profiles.bio_ne` + `businesses.bio_ne`
    (text, nullable; existing `bio` stays English, NOT renamed). Advisors clean
    (same 3 intentional WARN, columns add nothing). `lib/bilingual.ts` `pickBio`
    (active locale's bio, else fall back with an origin marker) + `BioText`
    component (renders "…(English)"/"…(नेपाली)"). Profile + business forms get a
    second "Bio (नेपाली)" field; detail pages, directory MemberCard/BusinessCard
    render the picked bio. Feed shows no bios (post body only), so nothing there.
    - **Ordering dependency:** the code reads/writes `bio_ne`; against prod it
      works only once the branch merges (client is untyped, so tsc/build are
      green; not pushed). Hub merges branch + pushes code together.
  - **ALSO VERIFIED (asked, not changed) — top-bar search.** `GlobalSearch`
    queries **profiles, businesses, and channels by NAME (ilike prefix)** and
    navigates to the result; it does **NOT** search posts, and does **NOT** match
    bios/message/post content — name-only. (The earlier `businesses.sector`→
    `primary_sector` bug that silently broke business results is already fixed;
    private profiles are filtered.)
  - Verified each commit: tsc 0 · vitest 47/47 (parity) · next build 50/50 both
    locales. NOT pushed — hub verifies; bilingual-bio branch NOT merged.
- **2026-07-24 (latest) — Settings shipped to prod + Visibility Enforcement + Email-OTP + real legal copy:**
  - **Settings branch merged to prod, branch deleted.** `preferences` jsonb +
    `delete_own_account()` RPC now live on prod (migration recorded
    `20260724150558`; repo file renamed to match). Prod security advisors: the
    `delete_own_account` WARN is the only new one and is **intentional**
    (self-delete must be authenticated-callable), same accepted class as
    `get_or_create_direct_thread` / `redeem_business_invite`. Dark sweep +
    settings pushed (`8e50319`).
  - **Visibility enforcement — LIVE on prod (D-024 fulfilled).** RLS backstop
    `private.can_view_profile(target)` (SECURITY DEFINER, private schema so no
    new advisor surface): a profile row is SELECTable when it's the viewer's own,
    the **viewer is an admin** (review queue keeps full sight), the target is
    **public** (default when `preferences.visibility` unset), the target is
    **bridge** AND the viewer is **verified**, or an **existing relationship**
    links them — a **shared DM thread** or a **shared business** (member↔member,
    owner↔member). `profiles_select` altered to `USING(can_view_profile(id))`;
    all 32 profiles default to public so it's backward-compatible.
    - **Query/UX layer on top:** directory (`/members`) excludes private always +
      bridge-only outside Bridge view; GlobalSearch excludes private (and fixed a
      latent bug — it selected `businesses.sector`, renamed to `primary_sector`,
      so business search returned nothing); person page 404s a hidden profile
      (`.single()` → notFound); feed authors that RLS can't see render the
      "Member" fallback (no name leak; a private author's posts still appear
      anonymized — out of scope for this pass). Team lists + DM participant names
      resolve via the relationship branches, so **active conversations don't
      break**.
    - **Tested with the 30 seeded accounts** (techp→private, agrip→bridge, DM
      thread techp↔techb): stranger sees 30 (both hidden); DM partner sees 31
      (private techp **resolves via the shared thread**); a verified viewer sees
      32 (bridge included). Test mutations fully reverted — seeded data pristine.
    - Privacy copy flipped from "arrives in the next update" to active.
  - **Devices: Phone-OTP → Email-OTP** (`signInWithOtp({ email })`, no SMS
    provider needed). QR pairing kept, labeled **Beta**. Devices i18n keys
    reworked (en+ne, parity held).
  - **Legal filled from `BL-LEGAL-05` (v0.2-pilot).** `/terms` (17 sections) and
    `/privacy` (9 sections) render the real pilot text; **`[ENTITY]`/`[DATE]`/
    `[LEGAL_EMAIL]`/`[GOVERNING_LAW]`/`[VENUE]`/`[PRIVACY_LINK]` stay literal**
    until a real operating entity + counsel review land (Gate L1). A pilot-draft
    banner says so. **NE Privacy translation still required before Nepal-side
    onboarding** (D-001). NOT built this pass (flagged, in the doc's §3–4):
    the `consents` append-only table + signup consent checkbox, the 18+ age gate,
    and in-app disclaimers B–E — a separate scoped commit.
  - Verified: tsc 0 · vitest 47/47 (parity) · next build 46/46 both locales;
    prod security advisors = 3 intentional WARN, nothing new.
- **2026-07-24 (later) — Settings Phase A + dark-mode surface sweep (2 commits; branch migration, NOT merged):**
  - **v1 settings was NEVER in this repo** (no `/settings`, `/terms`, `/privacy`,
    ThemeProvider, SettingsNav, `settings.*` i18n, `preferences` column — grep +
    history clean). So Phase A built the shell **and** the v1 sections directly
    under the v2 IA (`BL-SETTINGS-package-v2.md`), not v1's superseded IA.
  - **Dark-mode sweep — its own commit (`1720cb4`), no light-mode change.**
    `bg-white → bg-surface`, `ring-white → ring-surface`, and `text-white → the
    matching on-* token by fill` (bg-primary→on-primary, accent→on-accent,
    bridge→on-bridge). All 24 `text-white` were on coloured fills — none on a
    surface — so **none map to `text-ink`** (that would break button contrast in
    light); flagged rather than applied literally. The `.dark` token layer
    (foundation commit) now has surfaces that consume it; the toggle ships with
    Settings.
  - **Settings routes:** `/settings` (→ account), account, privacy, appearance,
    devices, data (+ `data/export` GET route), support; legal `/terms` `/privacy`
    (added to `PUBLIC_PATHS`). Shell = `ThemeProvider` (light/dark/system + font
    scale, localStorage, pre-paint init script) + `SettingsNav` + primitives.
  - **Verification card** reads user's own state: `user_trust_tiers.trust_tier`
    (pk `id`), `profiles.us_/np_verification`, `verification_records` (subject key
    = `subject_id`; history cols created_at/policy_track/status/provider). Read-only.
  - **Download-my-data** streams RLS-scoped own rows only (profile, owned
    businesses, authored posts, sent messages, rsvps, itineraries, verification
    records) — no other party's data, no new storage.
  - **DECISIONS (recorded, D-021…D-024 below):** preferences live in **one**
    `profiles.preferences` jsonb (merge-managed via `lib/preferences.ts`, never
    clobbered); **timezone is stored in preferences** (theme/font are
    device-local in localStorage, NOT the DB); Phase B **2FA = TOTP** (not
    email-OTP) and **active sessions via a service-role route** over
    `auth.sessions`; **account deletion = the tightly-scoped
    `delete_own_account()` SECURITY DEFINER RPC** (deletes only `auth.uid()`,
    revoked from anon/public, granted to authenticated; FK cascade removes
    profile + businesses).
  - **Branch migration (NOT merged, accruing ~$0.32/day until merged/deleted):**
    branch `settings-phase-a` (ref `rllkuddhuufmvrjgfpde`) replays the verified
    baseline + `20260724120000_settings_preferences_and_delete_account.sql`
    (`preferences` column + the RPC). `profiles_update_own` is row-level
    (`id = auth.uid()`, no column scope) so the owner writes `preferences` with
    **no new policy** (hub-confirmed). Advisors run on the branch.
  - **OPEN QUESTIONS / honest scope:** (1) `preferences`/RPC live only on the
    branch — settings pages that read/write preferences error against prod until
    the branch merges (client is untyped, so this doesn't break tsc/build; not
    pushed). (2) **visibility is stored, NOT enforced** — feed/directory/DM
    filtering is the next commit (copy says so). (3) **email delivery** for Phase
    B notifications/login-alerts needs a provider/worker — store-only until then.
    (4) **SMS** phone-OTP is real but needs a configured provider or it errors
    (labeled). (5) **`BL-LEGAL-05` was not provided** — `/terms` `/privacy` render
    an honest working-draft notice with `[ENTITY]`/`[DATE]` placeholders (no
    lorem); fill real clauses when the doc arrives. (6) settings user-data pages
    are `force-dynamic`; the build still lists them `●` because the `[locale]`
    param is statically enumerated — **verify per-user rendering on the live
    deploy**. (7) blocking enforcement is Phase C.
  - Verified: tsc 0 · vitest 47/47 (i18n parity + new authRouting cases) · next
    build 46/46 both locales. NOT pushed — hub verifies; branch NOT merged.
- **2026-07-24 (Phase A · design) — foundation rebrand + Members/Business + Feed cards (TWO gated commits, NOT pushed):**
  - **Commit 1 — foundation rebrand (`06d05c4`), one atomic colour migration.**
    Applied the token-migration map (`BL-DESIGN-token-migration-map-v1`): a
    half-migrated palette compiles green but renders broken (Tailwind v4 drops
    undefined-token utilities silently), so it landed whole. New `@theme`: brand
    **blue** (`primary`/-pressed/-soft/on-primary/chip-ink), `accent` red =
    importance/destructive ONLY, `bridge` = gold, **green is a STATUS colour**
    (active + online) only, `view-us`/`view-nepal`/`view-bridge` promoted here
    (VIEW_META migrated), neutrals → slate, `border` split into decorative
    `border` vs interactive `border-input`, plus a forward-looking `.dark`
    charcoal layer (no in-app toggle yet). Old→new applied across 32 files;
    grep proof shows ZERO old token utilities and ZERO old green hex remain.
    New `components/icons.tsx` (NAV_ICON, blue VerifiedIcon, gold BridgeStar),
    `components/OnlineDot.tsx`; **Sidebar rebuilt as a flyout rail** (68px icons
    → hover-expand 248px; `expanded` prop forces labels on the mobile drawer;
    AppShell rail width + content offset now 68px). **TrustBadge restyled** to
    blue shield (Verified) / solid gold star (Bridge); prop stays
    `tier: TrustTier` so all 6 callsites + the mapping test are untouched.
    `nav.online` i18n added.
    - **view-bridge = `#3F3D9E` indigo, NOT primary blue.** The map left it
      unpinned and mapped pine→primary, which would have made Bridge≡US blue
      (breaks D-004 "clear country context"). Took the cards package's distinct
      indigo instead; amended into the foundation commit so view tokens stay
      defined in one place.
    - **rhodo split (17 occurrences) — REPORTED to the hub for sign-off, per the
      map; NOT pushed.** Only `lib/data.ts` VIEW_META Nepal → `view-nepal`; every
      other rhodo (errors, destructive/remove actions, the like-heart, the unread
      dot, failed-status, the report-count badge) → `accent`.
  - **Commit 2 — Cards + Feed package (`BL-DESIGN-cards-feed-package-v1`).**
    New `chips.tsx` (ViewChip/SectorChip), `ui/Cover.tsx`, `MemberCard`,
    `BusinessCard`, `ReactionBar` (wired to `post_reactions` with rollback,
    self-contained), `PostCard`, `Feed` (`@formkit/auto-animate`), and
    `lib/formatRelativeTime.ts`. Card components reconciled to the repo's
    `TrustBadge(tier,label)` API. `/members` people + business grids now render
    the new cards (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`); the feed mode of
    `app/[locale]/page.tsx` now renders `<Feed>`/`<PostCard>` (ReportButton
    preserved via a `renderAction` slot; the page's old inline reaction toggle
    removed in favour of per-card ReactionBar). +`card.*` / `feed.*` i18n
    (en/ne). MemberCard `headline` carries the member bio (no short-title field
    exists), clamped to 2 lines. MemberCard message button uses the existing
    `findOrCreateThread` flow (there is no `/messages/new` route).
  - **Not pushed — hub verifies first.** Local `main` is now ahead of
    `origin/main` by 3 (nav `ff6d5b6` + foundation + cards). `bg-white`/
    `text-white` were intentionally NOT migrated to `surface`/tokens (not old
    brand tokens; dark mode isn't wired), so dark mode is forward-looking only.
  - Verified (each commit): tsc 0 · vitest 46/46 (i18n parity) · next build
    28/28 both locales; compiled CSS confirmed to emit the new utilities
    (`bg-active-soft`, `text-online`, `bg-view-bridge-soft`=indigo, `.card`/
    `.card-hover`, `border-border-input`) with real values.
- **2026-07-23 (Phase A · nav) — grouped navigation + "Members & Business" rename:**
  - Nav backbone grouped into eyebrow-labelled sections: **Community** (Feed,
    Members & Business, Channels, Events) and **Tools** (Trip Planner, Register
    business), with the admin queue under its own **Admin** group (admin-only).
    Sector channels stay in Community as the backbone (D-017).
  - **Directory → "Members & Business"** across nav label, page eyebrow and H1
    (D-019). Route stays `/members` so links + the middleware public-path list
    don't break; the internal `DirectoryPage`/`directory.*` identifiers are
    unchanged (code-only, no user impact).
  - **Removed the channel-page "Listed" chip** (D-020): unverified now renders
    nothing there, matching the ratified no-badge rule everywhere. Dropped the
    now-dead `channels.listed` key from both locales (parity held).
  - Decision log: recorded D-016…D-020 (billing placeholder, channel-creation
    gating, phased sequencing, the rename, and the no-badge rule).
  - Scope: nav is Phase A step 1 only. Polished Members & Business cards and the
    Feed redesign are the next two Phase-A commits, each hub-verified before push.
  - Verified: tsc 0 · vitest 46/46 · build 28/28 both locales.
- **2026-07-23 (later) — Admin verification queue (LIGHT model) + source-of-truth map:**
  - **SOURCE OF TRUTH, settled — read this before touching verification.**
    `user_trust_tiers` is a **VIEW, not a table** (`security_invoker=true`, zero
    write rules, zero triggers) defined purely over `profiles`:
    `bridge → 'bridge'`, else either track verified → `'verified'`, else
    `'basic'`. So `trust_tier` / `verified_tracks[]` are **computed, never
    stored**, and **"basic" is just that view's word for unverified**. Nothing in
    the app reads it (grep: zero hits). One lineage only:
    **base `us_/np_verification` → GENERATED `verification_status`/`verified_at`/
    `bridge` → the view.** TrustBadge READS the generated columns; approve/reject
    WRITES the base columns. Same source, no divergence possible.
  - **A trigger to "recompute" the aggregate or the tier was specified and
    deliberately NOT built — it is a no-op.** The aggregates are GENERATED
    (Postgres recomputes them on every write and *forbids* writing them), and the
    view has nothing stored to recompute. Writes to the base columns from
    anywhere — SQL editor, another service — already propagate automatically. No
    Supabase branch, no migration, no prod writes: the whole task was read-only
    against prod.
  - **FIXED, was silently broken: the admin businesses queue.** It selected
    `businesses.sector`, a column the multi-sector migration renamed to
    `primary_sector` on 2026-07-21. PostgREST errored, the error was discarded,
    and the tab rendered "nothing pending" unconditionally. Load errors are now
    surfaced instead of swallowed — that silence is what hid this for two days.
  - **Admin queue built to the LIGHT model, no new tables.** Both queues now show
    sector, sandbox (US/Nepal) and the self-attested evidence, plus per-row
    reviewer controls: which light signal was seen
    (self-attestation / reference / public profile / other), an optional reason,
    and a `credential_check_needed` flag for higher-risk categories (a marker for
    a later manual Bar-style lookup — no integration, by design). Decisions write
    the per-track column (which drives the tier automatically) and log to
    `verification_records` with `reviewer_id`, `status`, and a `checks` jsonb that
    **layers the review over the submitter's original payload** rather than
    clobbering it. Business decisions now log there too, so people and businesses
    share one trail; `policy_track` is NOT NULL so the reviewer must pick a
    sandbox when it can't be inferred from the country — never guessed.
  - `lib/verificationDecision.ts` holds the pure helpers (`trackForCountry`,
    `trackUpdate`, `buildDecisionChecks`) so the decision payload is unit-testable
    without a DB. +9 tests, one of which asserts `trackUpdate` never emits the
    generated columns — pinning yesterday's prod bug.
  - **Known gap (deliberate):** the submit side (`profile/verify`) still writes a
    *document-capture* shape (`provider:'pending_integration'`, `document_type`,
    `document_country`). The light model's "self-attestation + references" has no
    field yet, so reviewers currently see document metadata. Converting submit to
    self-attestation is a separate, scoped decision.
  - Verified: tsc 0 · build 28/28 both locales · vitest 46/46 (up from 37).
- **2026-07-23 — Trust tiers wired to real data + verification write-path fix:**
  - **GROUND TRUTH (read this before touching trust UI): there is NO
    `verification_tier` column.** Tiers are DERIVED, and only `profiles` carries
    the model: `us_verification` / `np_verification`
    (`none|pending|verified|rejected|revoked`, NOT NULL default `none`),
    `us_verified_at` / `np_verified_at`, plus three **GENERATED STORED** columns —
    `verification_status` (`verified` when EITHER track is verified),
    `verified_at` (`least(...)`), and `bridge` (true only when BOTH tracks are
    verified). `businesses` has **no** per-track columns and **no** `bridge`: a
    business can be `verified` at most, never Bridge. The KYB Tier 1 "Listed" /
    Tier 2 idea (D-015) is still only a derived `registration_number` check plus
    a "listed" chip on the channel page — not modelled as a column.
  - **FIXED, was broken in prod: admin approval of a person's verification.**
    `approvePerson` wrote `profiles.verification_status` + `verified_at`
    directly, but both are GENERATED ALWAYS STORED — Postgres refuses those
    writes, and the result was never error-checked. Nothing anywhere in the
    codebase wrote `us_verification`/`np_verification` (grep: zero hits), so
    **no member could ever become verified through the app**; prod confirms it
    (2 profiles, 0 verified, 0 bridge, all tracks `none`). Approve/reject now
    write the correct per-track column keyed off the record's `policy_track`,
    both writes are error-checked, and failures surface in the dashboard
    (`role="alert"`). Do NOT reintroduce writes to the generated columns.
  - **`lib/trust.ts` is the single tier mapping** (`trustTier()` →
    `none | verified | bridge`). `verification_status` is the gate, so a stale or
    forged `bridge` in a client payload can never mint a badge. There is
    deliberately **no "basic" tier** — the schema doesn't model one, and an
    unverified subject renders nothing rather than a negative mark.
  - `TrustBadge` API changed: `verified: boolean` → `tier: TrustTier`. All six
    call sites updated (feed, directory people + businesses, business header,
    business team rows, channel rows, person page). `bridge` added to the profile
    selects that feed a badge. Bridge is distinguished by a **distinct label**
    (`common.bridgeVerified`), not by the gold ring alone — the tier is never
    colour-only. Team-member rows now render a badge at all (they already
    selected `verification_status` but showed nothing).
  - +2 i18n keys × 2 locales (`common.bridgeVerified`, `person.bridgeVerified`).
  - No schema change and no Supabase branch: the columns already exist, and a
    backfill would be a no-op (zero verified rows). Prod was read-only throughout.
  - Verified: tsc 0 · build 28/28 both locales · vitest 37/37 (up from 31), and
    the new mapping test was mutation-checked — removing the
    `verification_status` guard fails 4 of its 6 cases.
- **2026-07-22 (late) — Prod fix + DB↔repo parity + reaction rollback:**
  - **FIXED, was broken in prod: "add team member".** `team-manager.tsx` called
    `find_user_id_by_email`, which migration `20260722095956` revoked from
    `authenticated` (F8 email→uid oracle). Every call failed — and because the
    handler collapsed `lookupError || !foundId` into one branch, owners were told
    an existing member "isn't on BridgeLink" and were pushed to the invite path.
    Adding a real teammate was impossible. **The Add button now ALWAYS mints a
    `business_member` invite by email**; the uid-lookup + direct
    `business_members` insert are gone. `redeem_business_invite()` resolves the
    account at signup by matching the caller's email, so an existing member simply
    redeems immediately. **No client-side call to `find_user_id_by_email` remains
    anywhere** — do not reintroduce one; if a server ever needs it, call it with
    the service key. i18n: `addMemberTitle`/`addMemberHint`/
    `memberEmailPlaceholder` reworded to invite semantics, and the three keys only
    the deleted path used (`add`, `noMemberFound`, `alreadyOnTeam`) dropped from
    BOTH en and ne (parity test enforces this).
  - **Captured 4 forward migrations that existed only as ROLLBACK files**:
    `20260722155304_events_add_timestamptz_and_tz`,
    `20260722161126_itinerary_items_add_business_fk`,
    `20260722162053_messages_last_read_at`,
    `20260722162840_post_reactions_table`. Definitions were dumped from the LIVE
    database (`pg_attribute` / `pg_constraint` / `pg_policies` /
    `pg_get_functiondef` / `pg_get_triggerdef`) and cross-checked against each
    ROLLBACK file — not reconstructed from memory. Filenames use the DB's own
    recorded version numbers so repo and `supabase_migrations` line up.
  - **Verified while doing this: `post_reactions` RLS is sound.**
    `post_reactions_insert_own` carries `WITH CHECK (user_id = auth.uid())`, so
    the client-supplied `user_id` cannot be forged. An earlier review flagged this
    as unverifiable from the repo; it is now both verified and captured.
  - **PARITY IS STILL INCOMPLETE — do not trust the repo to rebuild the DB.**
    The live project has **26** migrations; `supabase/migrations/` now holds **7**.
    19 remain uncaptured, including two from today that no file records:
    `20260722143651_verification_tiers_per_track_bridge` and
    `20260722143900_verification_tiers_pin_fn_search_path`. `supabase/schema.sql`
    is a stale snapshot, not a substitute. Applying the repo to an empty database
    does NOT reproduce prod today.
  - `toggleReaction` now rolls back its optimistic state when the insert/delete
    returns an error, instead of leaving the UI asserting a reaction that was
    never persisted.
  - Verified: tsc 0 errors · build 28/28 both locales · vitest 31/31.
- **2026-07-22 — Design Batch 1 integrated (from the parallel design-audit session):**
  - Cross-session workflow worked as intended: the design session produced a
    read-only fix batch as a zip; THIS session reviewed the diff against the
    real repo, verified DB columns it depends on (`profiles.avatar_url`,
    `businesses.logo_url` — both exist live), and integrated it. Single
    writer preserved; no divergent trees.
  - New `components/Avatar.tsx` (image with monogram fallback, never a
    broken-image icon) and `components/TrustBadge.tsx` (single reusable
    verification mark — teal `--trust` tokens, deliberately not green ≠
    success and not pine ≠ clickable; unverified renders NOTHING, never a
    scarlet letter; forward-compatible `tier="bridge"` gold ring, unused
    until the DB models a Bridge tier).
  - New tokens in `app/globals.css`: trust / trust-soft / trust-ink,
    formalized bg-success/text-success, surface-2 — all AA contrast-checked
    per the design session's audit.
  - Replaced inline monograms + inline verified pills across Sidebar,
    directory (people + businesses), business detail (header + team),
    channel detail, and person profile.
  - **Fixed during integration**: directory's verified badge had hardcoded
    English "Verified" (pre-existing miss from the translation pass, faithfully
    preserved by the batch) — now uses `common.verified`.
  - Note for the design session's next batch: the stale starter-kit CLAUDE.md
    in its project files claims "never pushed to GitHub" — false; correct it
    or ignore it. The repo is github.com/kcdream0913-hub/NABIS-Project.
  - Verified: `npm run verify` green (build 28/28 both locales + 31 tests).
- **2026-07-22 — Design per-feature pass (CTO session, incremental):**
  - **Events — DONE.** Migration `events_add_timestamptz_and_tz` (additive:
    `starts_at`/`ends_at timestamptz` + `event_tz`; events table EMPTY →
    zero-data-risk; advisor re-run clean, no new findings). `events/page.tsx`:
    explicit tz-aware "when" (renders `starts_at` in the event's IANA zone with
    the zone shown via `Intl.DateTimeFormat`; falls back to legacy date/time),
    host join ("Hosted by …"), per-event RSVP count (attendee proof, optimistic),
    `VIEW_META` view chip. +2 i18n keys (en+ne). tsc 0 · vitest 31/31 · build
    green. NOTE: events have no create form (seeded/admin-only) — whatever creates
    them must set `starts_at` + `event_tz`; seeding the NABIS-2026 anchor event is
    a good next step.
  - **Directory filters — DONE.** `members/page.tsx`: view (US/Nepal/Bridge —
    Bridge = corridor-wide, reusing the `view` vocabulary to stay synced with
    CDO), sector (existing), and verified-only, across People + Businesses;
    business free-text country normalized onto the two corridor countries.
    Frontend only, no schema. +1 i18n key (`directory.verifiedOnly`; view labels
    reuse the existing `view` namespace). tsc 0 · vitest 31/31 · build green.
  - **Trip Planner ↔ Directory link — DONE.** Migration
    `itinerary_items_add_business_fk` (additive nullable FK →
    `businesses(id) on delete set null` + index; itinerary_items had 1 row;
    advisor re-run clean; no new RLS needed — plain reference to world-readable
    directory businesses, still gated by the owner-only itinerary_items policies).
    `trip-planner/page.tsx`: real **verified** directory businesses surfaced as a
    linkable recommendation group (view-filtered like Directory; degrades to the
    curated templates when the directory is sparse — currently 1 business); adding
    one stages `business_id`, which is persisted on save; saved items with a
    `business_id` render a directory link. Tested `recommendationsFor`/
    `budgetBreakdown` untouched. +2 i18n keys. tsc 0 · vitest 31/31 · build green.
    NOTE (out of scope, tracked): item `day` still hardcoded 1 and item currency
    USD though schema supports multi-day + per-item currency.
  - **Messages: timestamps + two-pane inbox + last_read_at — DONE.** Migration
    `messages_last_read_at`: `direct_thread_participants.last_read_at` + a
    self-scoped UPDATE policy (`dtp_update_own`) + a BEFORE-UPDATE trigger
    (`protect_dtp_identity`, SECURITY INVOKER) pinning `thread_id`/`user_id` so
    an update can ONLY change `last_read_at` — **adversarially verified** (own
    read set; thread_id repoint blocked; other participant's row untouchable),
    advisor clean, no new SECURITY-DEFINER surface. New reusable
    `components/ThreadConversation.tsx` (realtime + send + per-message
    timestamps + marks-read-on-open); `/messages/[id]` now just renders it. Home
    "messages" mode rebuilt as a **two-pane inbox** (list + conversation on
    desktop, stacked on mobile) with last-message previews, relative times, and
    **unread indicators** derived from `last_read_at`. +3 i18n keys. tsc 0 ·
    vitest 31/31 · build green.
  - **Reactions wired to real data — DONE.** Migration `post_reactions_table`
    (`post_reactions(post_id, user_id, created_at)` PK(post_id,user_id); RLS:
    world-readable counts + insert/delete-own — same safe shape as `rsvps`,
    consistent with posts already world-readable; advisor clean, no new
    findings). The Batch-2 feed footer's Heart scaffold is now a real like:
    loads counts + my-reactions for visible posts, optimistic toggle
    (insert/delete own), filled + count when reacted. Comment affordance stays a
    scaffold (comments are a later feature). tsc 0 · vitest 31/31 · build green.
    NOTE: feed has 0 posts today, so like the directory it's mechanism-first —
    visible once posts exist. This completes the 5-feature per-feature pass.
- **2026-07-22 — Design Batch 2 (token system + feed-card completion, CTO session):**
  - **Ground truth first, no duplication:** the parallel session had already
    shipped the view-aware feed card (`5afff12`, live on origin/main) — Avatar
    (circle/rounded by identity), business-vs-user identity, TrustBadge,
    `VIEW_META` chip, relative timestamp, view-filtered query. NOT rebuilt;
    a second card would have collided with live work.
  - **Token system (the real Batch 2 gap):** `app/globals.css` `@theme` held
    colors only. Added the non-color layer per design-foundations — type ramp
    (`--text-display/title/body/meta`, Inter, 16px UGC floor + line-heights),
    `--radius-card`, `--shadow-card`/`--shadow-raised` (borders-first),
    `--ease-standard`. Additive, NEW utility names — nothing shipped restyled.
    Spacing intentionally stays on Tailwind's 4px scale (already a token
    system; no redundant aliases). Tailwind v4 emits a utility per *used*
    token; unused ones (display/title/radius-card/shadow-card) live in source
    and materialize on adoption.
  - **Feed card finished to spec (additive, not a rebuild):** post body lifted
    14px → `text-body` (16px UGC floor — the shipped card violated the
    foundations content floor), plus a reactions-ready footer scaffold
    (disabled affordances, `data-reactions-scaffold`, i18n `home.react` /
    `home.comment` added to en + ne). Structure only; no reaction behavior
    wired, per brief.
  - Verified: `npx tsc --noEmit` 0 errors; `vitest` 31/31 (bundle parity holds,
    322 keys en/ne); `next build` green (all routes, both locales); compiled
    CSS confirmed to emit `--text-body` / `--text-meta` / `--ease-standard`
    and `.text-body`.
  - Built on `origin/main` `5afff12` in a clean clone, delivered as a reviewable
    patch. **Local `main` was behind at `bbd9fc5` — fast-forward pull to
    `5afff12` before applying.** Repo has no `.gitattributes`, so Windows
    checkouts show a phantom ~90-file CRLF diff; add `* text=auto eol=lf` to
    end it permanently.
- **2026-07-21 (evening) — Team invites, multi-sector businesses, 15-sector list:**
  - **Team invitation UX**: "email not found" is no longer a dead end — the
    owner gets an "Invite to BridgeLink" action that creates a real `invites`
    row and a shareable `/signup?invite=<id>` link. Redemption happens in
    onboarding via new SECURITY DEFINER RPC `redeem_business_invite`
    (validates email match + pending status + expiry, preserves the
    owner-chosen role/can_post, marks invite accepted). No email sending —
    no provider is wired; owner shares the link manually. That's a scoped-out
    decision, not an oversight.
  - **Verified live with real cross-user tests** (simulated JWTs against the
    real RPC, then cleaned up): correct-target redemption works; replaying an
    accepted invite fails; redeeming an invite addressed to someone else's
    email fails. DB restored to exact pre-test state afterward.
  - **Two more pre-existing RLS bugs fixed** (same class as the
    verification_records one): `invites` had no INSERT policy at all, and the
    new RPC was initially executable by `anon` — caught via Supabase advisor,
    revoked, re-verified clean.
  - **Multi-sector**: `businesses.sector` → `primary_sector` (required) +
    `secondary_sectors` (0–2, DB-enforced: max-2 + not-equal-primary
    constraints). One real business row migrated safely. Registration form:
    primary select + up-to-2 secondary chip picker. Channel pages and the
    directory filter match primary OR secondary; secondary appearances are
    tagged "Secondary" in channel listings; directory cards show primary
    prominently + secondary as small tags. Also fixed a display bug found on
    the way: the directory was showing raw slugs instead of translated names.
  - **Sectors now 15**: found live-DB drift — someone replaced
    "Innovation & R&D" with "Real Estate & Home Improvement" directly in the
    DB outside these sessions. Founder decision: keep both. Restored
    innovation-rd, adopted real-estate-home-improvement (using its existing
    well-written DB description verbatim, incl. NRN property rules), and
    added the two requested new sectors: **Retail & Consumer** and
    **Food & Beverage**. Code + en/ne translations synced; no separate
    "Small Business" sector per founder direction (size filter/tag later).
  - Migrations: `multi_sector_and_invites_fix`,
    `restrict_redeem_invite_to_authenticated`, `restore_innovation_rd_sector`.
  - Verified: full `next build` green (28/28 both locales), 31 Vitest tests
    pass, message-bundle parity 320/320 keys.
- **2026-07-21 (later still) — KYC: US and Nepal as separate policy tracks, Bridge = both:**
  - Founder decision, recorded here so it's never silently reversed: US View
    and Nepal View have independently regulated KYC requirements (different
    documents, different rules). **Bridge View requires a PASSED US track AND
    a PASSED Nepal track — not either, not a third combined check.** Locked
    down with `lib/__tests__/kyc.test.ts` specifically to catch a future
    "simplify to ||" mistake.
  - **Real pre-existing bug found and fixed while building this**: there was
    no RLS policy letting a regular (non-admin) user INSERT their own
    `verification_records` row — only SELECT-own and admin-ALL existed. The
    verify page's `insert()` call would have been silently rejected for every
    real user who ever tried it. Added `verification_insert_own`, migration
    `kyc_policy_tracks`.
  - **Schema**: added `verification_records.policy_track` (`'us'|'nepal'`,
    not null). Table was empty (0 rows) before this — verified before
    running, zero data-loss risk. Verified live: insert, an invalid-track
    value correctly rejected by the check constraint, query pattern
    round-tripped, test rows cleaned up.
  - **`lib/kyc.ts`**: `getVerificationTracks()` (latest status per track from
    `verification_records`) and `isBridgeEligible()` (both passed) — the
    single source of truth for this logic, not duplicated inline anywhere.
  - **`app/[locale]/profile/verify/page.tsx` rewritten**: no more single
    free-country picker disconnected from the View toggle. Now shows two
    independent track cards (US, Nepal) each with their own status
    (none/pending/passed/failed) and their own document-capture flow
    (`documentsFor()` already had correct per-country document lists — that
    part didn't need to change). In Bridge View, shows both tracks plus an
    explicit banner stating Bridge eligibility requires both.
  - **Admin dashboard**: pending-verification cards now show which policy
    track a submission is for (reviewers were previously approving/rejecting
    blind to this). `profiles.verification_status` still means "at least one
    track passed" (used by the existing composer/posting gate) — Bridge
    eligibility is deliberately NOT stored redundantly on `profiles`; it's
    always computed fresh from `verification_records` via `isBridgeEligible()`.
  - Verified: `npm run verify` (build + 31 Vitest tests, up from 26) green.
- **2026-07-21 (later) — Real test suite, closing the biggest gap of the day:**

  - Reason this happened: today's session had multiple "it works" claims that
    turned out wrong on the user's machine (missing NextIntlClientProvider,
    merged stale folders, workspace-root confusion). `npm run verify` was
    literally just `next build` — zero automated tests existed anywhere,
    despite this file's own workflow rules promising unit + E2E coverage.
  - **Vitest** (26 tests, 3 files, all passing — verified by deliberately
    injecting a bug into `withLocalePrefix` and confirming the suite actually
    failed before reverting; not just "ran once, looked green"):
    - `lib/__tests__/authRouting.test.ts` — the locale-redirect logic
      (`stripLocale`/`withLocalePrefix`/`isPublicPath`), extracted from
      `lib/supabase/middleware.ts` into `lib/authRouting.ts` for testability.
      Behavior unchanged, just now covered.
    - `lib/__tests__/tripPlannerData.test.ts` — recommendation filtering and
      the budget-split math (also extracted into pure functions in
      `lib/tripPlannerData.ts`, `budgetBreakdown()`/`BUDGET_SPLIT`).
    - `messages/__tests__/parity.test.ts` — turns the ad-hoc Python
      key-parity check (run by hand ~6 times this session) into a permanent,
      committed test. Would have caught every "translated half the app"
      mistake before a build ever ran.
  - **Playwright** (`e2e/smoke.spec.ts`, unauthenticated-only smoke tests):
    written but **NOT verified to pass** — this sandbox's network allowlist
    blocks `cdn.playwright.dev`, so browser binaries can't be downloaded here.
    Caught two real mistakes while writing them regardless (a wrong assumption
    that signup has no topbar — it does, AppShell wraps every route — and a
    text-match bug, "Create an account" vs. the actual rendered "Create
    account"), which is itself evidence for why this suite is worth having.
    **Run `npx playwright install && npm run test:e2e` locally/in CI before
    trusting these** — do not treat them as verified until that's done.
  - `package.json`: `verify` is now `next build && vitest run` (was just
    `next build`). Added `test`, `test:watch`, `test:e2e`, `typecheck`.
  - Scope, deliberately: no auth-flow E2E tests (no seeded test account exists
    against the live Supabase project, and creating one wasn't in scope here).
    Extending `e2e/smoke.spec.ts` to log in with real or fake credentials
    against production data should be its own considered decision, not an
    incidental addition.
- **2026-07-21 — Trip Planner made functional (Phase 2, not Phase 3):**
  - Founder decision: Marketplace/Vendor is explicitly Phase 3 per
    `docs/PHASE1_ATOMIC_NETWORK.md` ("No marketplace or payments yet") and
    requires a payments provider — a human-checkpoint item per this file's own
    safety rails. Deferred; picked Trip Planner instead (Phase 2, the next
    phase in sequence, not a skip).
  - **New tables, additive only**: `itineraries` + `itinerary_items`
    (migration `add_trip_planner_tables`, applied to nabis-bridgelink). RLS is
    owner-only (`user_id = auth.uid()`, unlike profiles/rsvps which are
    browsable) — trip plans are private. Verified with a live insert →
    read → cascade-delete round trip before calling it done, not just a
    passing TypeScript build.
  - Real feature, not a mock: date/budget/group-size/interests form, rule-based
    budget breakdown (25/25/20/20/10 split — stay/activity/transport/
    food/buffer — transparent, not AI-driven), curated recommendation
    templates filtered by view + interest, add-to-itinerary staging, save/
    list/expand/delete against the real tables.
  - **Recommendations are explicitly labeled as curated examples, not live
    vendor listings** — surfaced in the UI itself (`recommendationsHint`), not
    just in code comments, so the gap to real Phase 3 marketplace data is
    honest to the end user too.
  - No booking/payment step — a banner in the UI says so explicitly
    (`bookingNotice`). This is the correct Phase 2 boundary; do not wire
    payments here without the same human-checkpoint conversation Marketplace
    would need.
  - Moved Trip Planner from Sidebar's "Coming next" into the main nav (no
    longer a preview) and removed its "Phase 2" tag.
  - New `lib/interests.ts` / `lib/useInterests.ts` — a separate small taxonomy
    from business sectors (`lib/sectors.ts`), fully translatable (en/ne),
    following the same pattern as `useSectors()`.
  - Verified with a real `next build`: 28/28 routes, both locales, green.
- **2026-07-20 (later still) — Sector taxonomy replaced (12 refined sectors):**
  - Replaced the 8 launch sectors with the founder's refined 12-sector list.
    Immigration now has its own explicit sector ("Policy, Immigration & Legal")
    rather than being buried — per founder direction, this is a key engagement
    driver.
  - **New slugs, not a relabel** (founder's call): technology-ai,
    energy-hydropower, investment-finance, innovation-rd, tourism-hospitality,
    healthcare-life-sciences, agriculture-food-systems,
    infrastructure-logistics, education-human-capital, manufacturing-industry,
    policy-immigration-legal, media-creative-industries.
  - **DB migration applied** (`replace_launch_sectors_with_refined_12`, live on
    nabis-bridgelink): old 8 channel rows deleted, new 12 inserted with name +
    description. Verified before running: `businesses` table was empty (0
    rows) and no `posts` referenced a channel — zero data-loss risk. Exactly
    one `profiles` row referenced old slugs; migrated `tech-ai` →
    `technology-ai`, dropped `entrepreneurs` (no equivalent in the new 12 —
    flagging in case that founder profile needs a manual re-pick).
  - **Fixed a latent bug while in here**: `businesses.sector` was storing the
    display *name* ("Tech & AI") while `profiles.sectors` stored *slugs* —
    two different conventions for the same concept. Both now consistently
    store slugs; the members-directory sector filter and channel-detail join
    both now compare slug-to-slug instead of name-string matching.
  - Sector names + descriptions are translatable (`messages/{en,ne}.json`
    "sectors" namespace) via a new `lib/useSectors()` hook, consumed by
    business registration, profile editor, onboarding, and the members
    directory filter — replacing the old static `SECTORS` export from
    `lib/sectors.ts` (now slugs-only).
  - Descriptions render as native `title` tooltips on the sector chips
    (profile editor, onboarding) and as helper text under the sector `<select>`
    on business registration (native `<option>` tooltips aren't reliable
    cross-browser, so a description line was used there instead).
  - **Scope note**: the Channels list/detail pages read `name`/`description`
    directly from the `channels` DB rows (English-only, seeded by the
    migration above) — this is DB content, same category as member bios/posts
    that we already scoped out of translation. The *sector picker UI* (what
    was actually asked for) is fully translatable; the channels page mirror of
    that data is not, unless it's rebuilt to read from the same message keys.
  - Verified with a real `next build`: 28/28 routes, both locales, green.
- **2026-07-20 (later) — Full static-UI translation pass:**
  - Extracted every user-facing UI string across all ~20 pages/components into
    `messages/{en,ne}.json` (225 keys, exact parity — verified programmatically).
  - Translated: auth (login/signup), home feed + composer, directory, events,
    channels (list + detail), thread/messages, trip-planner, business
    registration form, profile editor, identity verification, admin dashboard,
    business detail + team manager + contact + remove-member, people detail,
    onboarding (all 4 steps), EmptyState, ReportButton, GlobalSearch.
  - Nepali strings are a usable first draft — **FLAG: needs native-speaker
    review before launch** (esp. domain terms: "करिडोर", verification/KYC
    wording, "प्रमाणित व्यवसाय").
  - Scope decision (founder): static UI only. User-generated content (member
    bios, post bodies, event descriptions — all DB rows) is deliberately left
    as-typed; next-intl cannot translate it. A runtime content-translator is a
    separate future feature, not attempted here.
  - Server Components use `getTranslations` (async); Client Components use
    `useTranslations`. Fixed one variable-shadowing bug (tab loop `t` vs
    translation `t`) and moved two module-level string arrays
    (onboarding GUIDELINES, business ROLE_LABEL) into components so they localize.
  - Verified with a real `next build`: 28/28 routes, both locales, still green.
- **2026-07-20 — View toggle confirmed + i18n foundation added:**
  - Confirmed the US/Nepal/Bridge `ViewToggle` was already live (`lib/store.tsx`,
    `lib/data.ts` VIEW_META, wired into `Topbar`) — not rebuilt, per founder direction.
  - Added `next-intl` (locales: `en` unprefixed, `ne` at `/ne`). Moved all routes
    under `app/[locale]/`; `app/auth/callback` deliberately stays outside the
    locale tree (fixed OAuth redirect URI). Supabase session middleware now
    composes with the intl rewrite instead of discarding it, and its
    login/signup redirects are locale-aware.
  - Added `LanguageToggle` (native names, no flags) in the Topbar next to
    ViewToggle. Devanagari renders via self-hosted `@fontsource/noto-sans-devanagari`
    (not `next/font/google` — no external fetch at build time).
  - **Translated so far:** sidebar nav, topbar (search/notifications/assistant),
    ViewToggle, LanguageToggle. **Not yet translated:** page-level content —
    member bios, event/business/onboarding forms, admin dashboard, messages UI.
    Treat this as the i18n foundation, not full coverage; do the remaining
    string-extraction pass page-by-page next.
  - Fixed a real Topbar alignment bug: `GlobalSearch` carried `ml-auto` but is
    `hidden` below `sm`, so on mobile the whole right-hand cluster (search/
    bell/assistant) collapsed to the left with nothing pinning it right.
    `ml-auto` now lives on a wrapper div that's never conditionally hidden.
  - Verified with a real `next build` (not just read-through): 28/28 routes
    generate for both `en` and `ne`, `/auth/callback` untouched.
- **Mocked (by design, this pass):** auth/invites (UI only), image upload, message
  delivery, persistence (in-memory + localStorage for view pref).
- **Next up (in order):**
  1. Supabase project + schema (members, posts, sections, events, rsvps, invites)
  2. Auth (Clerk or Supabase Auth) + invite-code redemption + approval queue
  3. Replace lib/data.ts mocks with real queries; persist posts/RSVPs
  4. Image upload (Supabase Storage) in composer + profile photo
  5. Deploy to Vercel; seed founding cohort
- **Blockers:** Supabase/Clerk credentials needed from founder for step 1–2.

## Stack (locked — change only via "Breakthrough")

Next.js 15 (App Router) + TypeScript strict + Tailwind v4. State: React context now,
server data via Supabase next. Auth: Clerk or Supabase Auth. DB: Supabase Postgres.
Deploy: Vercel. Tests: Vitest + Playwright (add with the data layer).

## Design system (do not drift)

Corridor palette in `app/globals.css` — pine `#0F5C55` (brand/Bridge), denim
`#2B4C8C` (US), rhodo `#C2412F` (Nepal), mist/ink/line neutrals. The three view
colors are **informational**: they mark country context in the toggle, the topbar
context rail, and post/member chips. Type: **Inter** (Latin, self-hosted via
next/font/local) + **Noto Sans Devanagari**, with per-script `:lang(ne)` metrics —
no longer the system stack. A semantic non-color token layer (type / radius /
elevation / motion) lives in the `@theme` block of `app/globals.css` (Batch 2);
spacing stays on Tailwind's 4px scale. Eyebrow labels
(11px/uppercase/tracked) for section context. Professional density; hairline borders;
no gradients; restraint everywhere except the context-color system.

## Workflow — every task

Plan → implement → `npm run verify` (= next build; keep it passing) → update this
file → commit (`feat:`/`fix:`/`chore:`) → propose next, wait for confirmation.
"Breakthrough <instructions>" = sanctioned pivot: update plan + this file, confirm,
proceed.

**Every end-of-task report carries, next to the gate counts, a line
"findings turned into permanent checks: <list>" (D-059).** Each finding this task
surfaced either becomes a standing gate (test / `*.verify.sql` / lint) or is recorded
as accepted-and-unguarded with the reason. A fix without a check is how the same class
of bug ships twice.

## Phase discipline (safety rails)

- Do NOT build marketplace, checkout, payments, or vendor inventory in Phase 1.
- Invite-only access is Phase 1's trust mechanism; full tiered KYC returns with the
  transaction layer. Never present the mock auth as real gating.
- Locked pages stay honest: they say what phase unlocks them and route people to the
  community meanwhile.

## Trust backlog (server-side gaps — standing, not tied to any one branch)

- **PRE-PILOT HARD BLOCKER — E2E must run against a SEPARATE Supabase project, NOT
  production.** The suites write real posts / reactions / comments / reposts / bookmarks
  / DMs + storage objects to the LIVE project. Per-run cleanup (global-teardown), the
  self-provisioned target post (Option C), and the rejected feed filter (Option B) are
  all STOPGAPS that only BOUND the exposure — during a run, real test content is briefly
  in real users' feeds. The ONLY thing that ends test data touching production is a
  dedicated E2E Supabase project (separate URL/keys, its own seed). **No pilot user is
  onboarded until this is done.** Scope it once the CI harness is green — not before.
- **The "verified to post" rule is CLIENT-SIDE ONLY.** Hub-verified 2026-07-29:
  `posts_insert_own` is `author_id = auth.uid()` with **no verification predicate**;
  same for `post_reactions`, `post_comments`, `post_reposts`, `post_bookmarks`. An
  **unverified account can post, react, comment, repost and bookmark straight through
  the API** — `composer.tsx:173` only hides the textarea in the UI. Not a data leak,
  so not a blocker — but "all features integrate with KYC gating" is a project pillar,
  and this gate **does not exist server-side**. Fix = add a verification predicate to
  the insert policies (e.g. an `EXISTS` against a verified-status helper), when the
  KYC/transaction layer lands. Surfaced by BL-SOCIAL-03; **not fixed in that branch.**
- **DB doc note — verification is written to the PER-TRACK columns, never the
  aggregate.** `profiles.verification_status` and `verified_at` are **GENERATED**
  columns; a direct `update` raises **428C9** (cannot update a generated column). To
  mark someone verified, set `us_verification` / `us_verified_at` (or the `np_`
  equivalents); the aggregate + `bridge` recompute automatically (see the 2026-07-23
  ground-truth note). This is exactly how the hub seeded A/B/C for the E2E suite.

## Decision log

| ID    | Date       | Decision | Why |
|-------|------------|----------|-----|
| D-001 | 2026-07-16 | Task Breakdown = task-ID source (starter kit) | Resolved doc conflict |
| D-002 | 2026-07-16 | Loop runs in Claude Code, not custom LangGraph | 90% of value, ~0 build cost |
| D-003 | 2026-07-17 | **Atomic Network pivot approved by founder** — community-first sequencing supersedes old Phase 1 (marketplace/KYC deferred to Phase 3) | Cold-start strategy: seed a dense, high-trust network before transactions |
| D-004 | 2026-07-17 | Corridor palette: view colors carry information (US=denim, Nepal=rhodo, Bridge=pine) | Brief requires "clear country context at all times" |
| D-005 | 2026-07-17 | Mock data layer this pass; Supabase next | Real auth/DB needs founder credentials; UI-first unblocked the build |
| D-016 | 2026-07-23 | **Settings "Subscription & Billing" = PLACEHOLDER ONLY** — a Subscription section reads "Founding member — free during the pilot." Build NO payment methods, invoices, or plan-management UI. | Monetization is deferred; no entity and no payment processor yet. Payment UI would imply taking money we cannot yet take. |
| D-017 | 2026-07-23 | **User-created channels are gated to verified/founding members AND require admin approval — mandatory during the pilot, not "if needed."** The 8/12/15 sector channels remain the backbone. | Adds a moderation surface while the founder is still the manual gate. |
| D-018 | 2026-07-23 | **Phased sequencing (BL-STRATEGY-01).** Phase A = first-impression surfaces (navigation, "Members & Business", Feed). Phase B (only after the founding cohort is actively using it) = the heavier builds (Discord-style channels, Trip Planner, Events, full Settings). Each area ships as its own gated, hub-verified commit. | Ship what the founding cohort judges first; defer heavy builds until there's usage to shape them. |
| D-019 | 2026-07-23 | **"Directory" renamed to "Members & Business"** (nav label, page eyebrow, page H1). Route stays `/members`. | Founder-chosen name; keeping the route avoids breaking links + the middleware public-path list. |
| D-020 | 2026-07-23 | **Unverified = NO badge anywhere.** No "Listed" chip, no placeholder mark — absence is neutral, never a scarlet letter. TrustBadge reflects real per-track state only; tone is "facilitation only." | Light-verification model must stay honest in the UI; a fake status mark misrepresents standing. Removed the channel-page "Listed" chip to comply. |
| D-021 | 2026-07-24 | **All user preferences live in one `profiles.preferences` jsonb** (merge-managed, never clobbered); **timezone stored there**, while **theme + font are device-local** (localStorage), not the DB. | One additive column beats many; per-device display prefs shouldn't sync across devices via the DB. |
| D-022 | 2026-07-24 | **Account deletion = `delete_own_account()` SECURITY DEFINER RPC** — deletes only `auth.uid()`, revoked from anon/public, granted to authenticated; FK cascade removes profile + businesses. | Self-serve delete needs elevated privilege; scope it to the caller in the DB rather than shipping a service-role key to the client. |
| D-023 | 2026-07-24 | **Phase B: 2FA = TOTP** (not email-OTP-as-2FA); **active sessions via a service-role server route** over `auth.sessions`. | TOTP is the standard second factor; listing sessions needs an elevated read. |
| D-024 | 2026-07-24 | **Profile visibility is stored now but enforced in the next commit**; the UI copy says so. → **FULFILLED** by `private.can_view_profile` (see D-025). | Honest UI — never imply feed/directory/DM filtering that isn't wired yet. |
| D-025 | 2026-07-24 | **Visibility model.** public = listed everywhere; bridge = visible to verified viewers + shown only in Bridge view; private = hidden from directory/search/public-profile BUT resolvable by existing relationships (shared DM thread or shared business). Admins keep full sight. Enforced by RLS (`private.can_view_profile`) as the security floor + query filters for UX. | A leak on any people-listing surface defeats it, so enforce at the DB; but never break active conversations or team visibility. |
| D-026 | 2026-07-24 | **Device sign-in = Email OTP** (`signInWithOtp` email), not phone/SMS. QR app-pairing stays a labeled **Beta** scaffold. | No SMS provider is configured; email OTP works out of the box and needs no extra vendor. |
| D-027 | 2026-07-24 | **Auth screens render OUTSIDE the app shell** (route-group split: `(app)` owns AppShell, `(auth)` is chrome-free). Unauthenticated → **/login**. Language pre-login lives in the auth-card footer; the top-bar language toggle is removed. | Trust-critical first impression — logged-out users must not see app chrome/avatar; a Nepali-only user must switch language before login, which Settings can't provide. |
| D-028 | 2026-07-24 | **OAuth buttons are gated to providers actually configured in Supabase.** Verified via GoTrue /settings: Google live → shown; Apple not configured → hidden (both /login + /signup). | A dead OAuth button is worse than none. |
| D-029 | 2026-07-24 | **Bilingual bios: `bio` = English, `bio_ne` = Nepali** (existing `bio` NOT renamed); both optional. Display shows the active locale's bio, else falls back with an origin marker (`pickBio`/`BioText`). | US–Nepal corridor is bilingual; don't silently show the wrong-language bio or lose the English one. |
| D-033 | 2026-07-25 | **Country-forked business onboarding, Nepal-first.** Step 0 forks on `country_of_registration` (NOT UI language / View, R1): **US → existing manual form** (full Google/Places import BL-BIZ-01 **deferred post-pilot**, affordance hidden), **Nepal → guided builder** (8 tap/dictation questions → a **deterministic** bilingual bio assembled from pre-written labels, no translation model). Each path links to the other and carries entered data (R2). Owner-own-site importer only, https + SSRF-guarded (re-checked after every redirect) + robots-honoring; social URLs are **stored, never fetched** (R3). `import_source`/`field_sources`/`profile_answers`/`social_links`/`website_url` are UX metadata, **never trust signals** (R8); public trust = `verification_status` alone. **A-1:** clients never write `is_paid_provider` (trigger `protect_business_trust_columns` forces it false silently — a fake "fee on" would strand vendors); the price is recorded, charging turns on with the payments rail. | LinkedIn/Facebook scraping is legally closed and their APIs need an entity we don't have; import-first fails the low-literacy Nepal owner (no site/LinkedIn) — a guided builder + deterministic assembler serves everyone and removes the translation-model dependency from the critical path. |
| D-034 | 2026-07-27 | **Messenger Phase 1 + E2EE foundation verified by hub against live prod. E2EE client integration is GATED, not green-lit:** branch/flag first; two-browser live-decrypt + fresh-profile recovery demonstrated before merge; abuse reports attach a **decrypted copy** (preserves the law-enforcement forwarding policy). Accepted residuals: `thread_keys` recipient not participant-constrained (outside the E2EE threat model); server-distributed keys without safety numbers acceptable for pilot. Client must handle **unwrap-failure gracefully**. | E2EE is safety-critical; the spec itself requires live two-browser decrypt + fresh-profile recovery, which a browserless environment can't run — so integration stays gated behind a flag until those gates pass. The two residuals are within-scope-for-pilot tradeoffs, recorded so they're never silently "fixed" or silently forgotten. |
| D-035 | 2026-07-27 | **M-FIX closed.** Translation caching is **server-side only** (`/api/posts/translate`: RLS-scoped read → Anthropic → service-role-guarded UPDATE with length cap + lang check); `cache_post_translation` dropped from prod, **forward-only by design** — if a DB write path ever returns, grant `service_role` only, never `authenticated`. `edit_message` now enforces a **fresh IV** for `schema_version = 1` (rejects null/empty/reused); `delete_message_for_everyone` nulls `body_iv`. i18n naming: implementation namespaces stand; catalog/bio strings stay **bilingual lib data, parity-tested** (§2g rename declined). | The old RPC (SECURITY DEFINER, EXECUTE→authenticated) let any signed-in user inject a translation onto any post — moving the write server-side removes the client write path entirely, and dropping it forward-only prevents re-opening the hole. IV-reuse in AES-GCM is catastrophic, so the fresh-IV check is enforced in the RPC, not the client. |
| D-045 | 2026-07-28 | **Referral & partner program (BL-STRATEGY-04) — strategy, NOT scheduled work.** Full sourced doc: `docs/BL-STRATEGY-04-referral-program.md`. **Rewards are platform entitlements (subscription time, boost credits, commission holidays), NEVER cash** — cross-border cash to Nepal is effectively blocked (Stripe Connect/PayPal don't reach Nepal; Wise US→NPR is individual-only and its API/NPR payout support is **unverified**) and Nepal's FX Act is tightening (13 Jul 2026 bill criminalizes value transfer outside recognized institutions, bans crypto rails). Because the reward is an entitlement, payouts/W-9-W-8BEN/1099/FX/NRB are **out of scope** → member referral is **built in-house** (~2–3 eng-weeks: code-gen, link routing, server-side first-touch attribution, vesting, velocity caps, review queue). Shape: **asymmetric + pro-social** — referee gets the larger *certain* reward (e.g. 60d paid + boost), referrer gets a *smaller uncertain* one (gamble on the sender leg only). Vendor/affiliate **cash** program **deferred** until real earners exist, then **bought** (Tolt or Dub — they file 1099s), not built; Nepal-side vendors get commission holidays not cash, cash only US-side. Ambassador layer = hometown associations + NRNA chapters, entitlements/access not cash, **staffed separately from Community Notes moderators** (burnout). Fraud: gate payout behind **full KYC re-validated at vest time**, vest on 2nd/3rd meaningful action, Stripe card-fingerprint self-referral check → **review not auto-block**; IP/device collision is a **clustering weight, never a block** (VPN + CGNAT + shared family devices in this population); publish terms not thresholds; any rating-linked reward conditioned on an **honest** rating, never a positive one (FTC). **Launch gate: 100–200 genuinely active users AND zero test accounts remaining.** Planning number 2–8% of signups in the first two quarters; viral coefficient <1 → this is CAC-reduction, not a growth engine, so **build the attribution/instrumentation early, hold the incentive economics**. 5 open questions need human/counsel (Wise NPR API; US-source-income characterization of a bounty; NRB authorization; unlicensed-payment-operator risk; FTC on Boost paid-ranking + incentivized reviews) — see doc §"Open questions". | Cross-border payout + Nepal FX law decide the whole design: entitlements remove the money-movement half of the build entirely. In a dense 185k–215k diaspora network most signups arrive via existing ties anyway, so a bounty launched early cannibalizes free growth and buys lower-LTV discount-seekers — the value is instrumenting the referral channel that already exists, not the bounty. |
| D-051 | 2026-07-28 | **DM attachment BYTES are NOT E2E-encrypted in Phase 1 (BL-MSG-05).** Bytes are stored access-controlled (private `message-attachments` bucket, thread-scoped storage RLS), and metadata (filename/type/size) lives in the plaintext `messages.attachments` jsonb — the same trust model as message bodies today. **Runner-up rejected: encrypt bytes with the thread key now.** Rejected on three grounds: (1) it needs the E2EE client integration that D-034 explicitly GATES behind live two-browser verification (not shipped, un-runnable here); (2) it would make the **load-bearing server-side magic-byte malware scan impossible** — you cannot sniff ciphertext, so encrypting now directly defeats the security requirement; (3) it breaks the D-034 abuse-report "attach a decrypted copy" policy. When the E2EE client ships (post-D-034), attachments join it as a coordinated future decision (encrypt bytes client-side with the thread key + store an IV in metadata). Cost of the chosen path: bytes are readable by anyone with storage access (bounded to thread participants by RLS + the platform operator) — accepted for pilot, consistent with plaintext bodies. | Malware/fraud scanning of DM attachments is the load-bearing requirement; it needs plaintext bytes. Encrypting bytes now would be inconsistent with plaintext bodies AND defeat the scan — so bytes stay access-controlled-but-unencrypted until the whole E2EE client lands. |
| D-052 | 2026-07-28 | **DM attachment type is decided SERVER-SIDE by MAGIC BYTES, never the client Content-Type or the filename extension (BL-MSG-05).** `lib/attachmentSniff.ts` sniffs an allowlist (jpeg/png/webp/gif · mp4/webm · pdf/docx/xlsx · csv/txt) and REJECTS executables/installers/archives outright (MZ, ELF, Mach-O, shebang, RAR, 7z, gzip, bzip2, xz, and any non-OOXML ZIP). **ZIP discrimination:** docx/xlsx are ZIP containers (`PK\x03\x04` — identical magic to a generic `.zip`), so a bare "reject ZIP" would reject every Office doc; instead, on `PK` we scan the head window for the OOXML `[Content_Types].xml` local-file entry plus a `word/` (docx) or `xl/` (xlsx) part — anything else `PK` = generic archive = REJECT. **csv/txt have no signature** → a structural UTF-8 heuristic (RFC 3629: reject C0/DEL + C1 in the CODEPOINT domain, per D-057-adjacent P0 fix — continuation bytes 0x80–0x9f are legal) → `text/plain`; a binary masquerading as `.txt` fails and is rejected. **Mismatch policy = the extension is IGNORED for the security decision.** A file is accepted iff its *sniffed* type is allowlisted; it is then stored under a generated UUID key with the SNIFFED type recorded — never the client's claim. So an `.exe` renamed with a `.pdf`-looking bidi name (magic MZ) is rejected; there is no "accept-and-rename to match the lie." **Enforcement:** the sniff runs in the signed-URL READ route BEFORE minting a URL (the only GATED mint path — storage RLS lets a participant `createSignedUrl` directly, so any NEW signed-URL path must also route through the sniff). Displayed filenames are sanitized (strip U+202A–202E / U+2066–2069 / other bidi + control chars, cap length, rendered as text never HTML) at BOTH store and render, because a malicious sender can write the jsonb directly. | A fraud-protection marketplace's DM attachments are a direct malware/fraud vector; Content-Type and extension are attacker-controlled, so only the bytes can be trusted, and the check must sit on the delivery path, not just the composer. |
| D-053 | 2026-07-28 | **`message-attachments` bucket expanded for BL-MSG-05 — APPLIED to prod 2026-07-28 by the hub.** Finding that corrected the spec: the DM bucket was **10MB** (not the 50MB cited — that is the *feed* video bucket) and its `allowed_mime_types` was jpeg/png/webp/pdf/docx/xlsx only, so it **physically rejected** video/gif/csv/txt uploads. Migration raised `file_size_limit` to 50MB (video ≤90s; images still capped smaller client-side) and expanded `allowed_mime_types` to the 11-type Phase-1 set (bucket still private). The Content-Type allowlist is only a coarse first filter (client-controlled); the real type boundary is the D-052 magic-byte sniff on read. Storage RLS UNCHANGED (participant-scoped: `message_attach_select/insert/delete` on `private.is_thread_participant`). The same migration landed the four BL-NOTIF-01 `revoke execute` statements — corrected to name `public` (see **D-057**), which cleared all 8 notify/protect advisor lints (advisors **13 WARN → 5, 0 ERROR**); the DEFINER triggers still fire post-revoke (verified live). | Spec assumed the feed bucket's config; the DM bucket differs and blocked the requested types — a one-statement config change met the scope, and it was the natural place to land the (now applied, PUBLIC-corrected) notif revokes. |
| D-054 | 2026-07-28 | **Collapsed sidebar rail must not scroll horizontally (BL-NAV-01).** Root cause: a flex-column `<nav>` with `overflow-y-auto` computes `overflow-x` to `auto` (CSS spec — a non-`visible` value on one axis forces the other to `auto`), so the collapsed 68px rail scrolled ~131px sideways because the nav labels were `opacity-0` yet still occupied their full expanded width. Fix (three parts, all required): (1) labels are `hidden` (removed from layout) when collapsed, not merely transparent; (2) the `<nav>` gets `overflow-x-hidden`; (3) the scrollbar is suppressed inside the 68px rail (`[scrollbar-width:none]` + `[&::-webkit-scrollbar]:hidden`). `overflow-x-hidden` is deliberately NOT applied to the shell root — that would clip the notification bell's right-flyout panel. | A horizontal scrollbar in a 68px icon rail is a visible defect on the first-impression surface; the fix must remove the width source (labels) AND the computed overflow, not just hide the bar. |
| D-055 | 2026-07-28 | **Mobile nav drawer needs an explicit collapse control (BL-NAV-01).** The drawer opened (hamburger → `setSidebarOpen(true)`) but had no visible way to close besides tapping the backdrop — undiscoverable on touch. Fix: an `X` close button in the drawer header (`setSidebarOpen(false)`, shown only when `expanded`) plus an Escape-closes-drawer effect in `AppShell` (backdrop-click already worked). | A drawer with no visible dismiss affordance reads as a trap on mobile; provide button + Esc + backdrop, not backdrop alone. |
| Note | — | D-054/D-055 are the BL-NAV-01 findings the hub labeled "D-051/D-052" in its paste block; renumbered because D-051–D-053 were already committed for BL-MSG-05 (attachments) at `c636a44`. Decision numbering is owned in this file, allocated after the current max, never taken from a hub label (see D-056). |
| D-056 | 2026-07-28 | **The hub CAN clone this repo.** `git clone --depth 1 --filter=blob:none` over https works from the hub sandbox, so directory listing, `git log`/`git diff`, test-merges, and byte-exact reads at any SHA are all available for verification. Retires the earlier "GitHub REST 403 / codeload 403 / cannot list a directory" limitation — hub verification is no longer limited to what a session pastes. | The prior assumption (hub is blind to the tree) shaped how much got pasted back each round; it was wrong, so stop over-pasting and let the hub read the SHA directly. |
| D-057 | 2026-07-28 | **Revoking EXECUTE on a Postgres function requires naming `public`.** The default grant Postgres puts on every function is to PUBLIC; `revoke execute ... from anon, authenticated` alone is silently ineffective — `has_function_privilege` stays TRUE for both because the PUBLIC grant survives (verified on prod in a begin/rollback). Always `revoke ... from public, anon, authenticated`. A rollback that re-grants must likewise name `public` to be a true inverse. Applies to every future revoke, not just the four BL-NOTIF-01 trigger fns that surfaced it. | A revoke that looks applied but isn't is worse than none — it reads as "locked down" in review while the grant stands. This bit the D-053 notif revokes; pin the rule so it never recurs. |
| D-058 | 2026-07-28 | **A negative-control DB assertion that matches ZERO rows is indistinguishable from a pass — always assert `row_count`.** A verification query written to prove "no bad rows exist" returns an empty set both when the guard works AND when the query targets the wrong table/column/predicate and simply matched nothing. Bind the proof to an expected count (assert the query touched the rows it claims to, then assert the property), or use a positive control that MUST match. | Cost the hub a round on the protect-guard test; a silent zero-row match reads as green while proving nothing. |
| D-059 | 2026-07-28 | **Every finding becomes a permanent check, or is recorded as accepted-and-unguarded — and the end-of-task report says which.** Next to the gate counts, the report carries a line `findings turned into permanent checks: <list>`. A one-off fix leaves the door open for the same class of bug to ship again (bl-i18n-01's wrong-namespace `t()` key was fixed, then a SECOND identical one — `tripPlanner.daysCount` — was found the moment the `usage.test.ts` gate existed). Checks take the form of a test, a `*.verify.sql`, or a lint; "accepted-and-unguarded" must state why guarding is impractical. | A fix without a check is invisible to the next session and to CI; the value of a finding is the gate it leaves behind, not the single line it changed. |
| D-060 | 2026-07-29 | **The E2E suite runs against the LIVE Supabase project, so every suite that WRITES must clean up after itself — residue in prod is a defect, not acceptable noise.** Measured: one attachment-suite run leaked ~15 storage objects + ~5 message rows into the seeded A↔B thread, growing without bound per push. `e2e/global-teardown.ts` (wired via `globalTeardown`) now runs after every suite, authenticated as account A: it **hard-deletes** A's whole uploader subtree under the A↔B thread (`{thread}/{A}/*` — storage DELETE policy is uploader-owns, so this is self-healing and clears prior residue too) and **tombstones** the messages A sent this run via `delete_message_for_everyone` (the ONLY client mutation path; `public.messages` has no DELETE/UPDATE policy by design — the RPC nulls body + `attachments` + drops reactions). It fails LOUDLY on any API error (never swallows) and logs the counts removed. **Residual, accepted-and-unguarded (D-059):** the tombstone ROW itself cannot be hard-deleted by the client (no DELETE policy) — true row removal needs a service-role sweep; the row is contentless (body+attachments nulled) so it is bounded, tiny residue, flagged for a hub-side sweep if row count ever matters. | A test harness that pollutes prod on every run is a defect; the strongest client-side cleanup (hard-delete bytes, tombstone rows) removes the unbounded-growth bulk, and the one thing it can't do (hard-delete rows) is bounded + documented, not hidden. |
| D-061 | 2026-07-29 | **BL-NAV-02 — Directory rename + removal of the "Phase 2" defect that labelled the SHIPPED Trip Planner as unbuilt.** Rail label `nav.directory` "Members & Business" → **"Directory"** (the rest of the product already says Directory: `tripPlanner.browseDirectory`, marketing footer); the entity words move to the page where there is room — `directory.eyebrow` → "Community directory", `directory.title` → "Professionals & Businesses", `directory.people` "People" → "Professionals" (route stays `/members`, tab literals `people`/`businesses` unchanged). Deleted the stale eyebrow `<p>{t("phaseEyebrow")}</p>` above the v2 wizard's h1 ("Phase 2 · Utility layer" read as "not built yet"). **Dead-key cleanup, PROVEN not guessed:** 15 keys removed from BOTH bundles — `nav.comingNext`, `nav.phaseTag`, `tripPlanner.{phaseEyebrow, body, previewEyebrow, dates, postHintPrefix, travelPlans, postHintSuffix, recommendationsTitle, recommendationsHint, stagedTitle, itemsCount, bookingNotice, verifiedBusinessesTitle}`. Each verified dead by a **repo-wide `.ts/.tsx` grep AND** confirming the trip-planner page + OfferingEditor build **no** dynamic `tripPlanner` key (every `t(\`…\`)` there is on the `offerings` translator: `types.*`/`directions.*`/`units.*`/`seasons.*`/`country.*`). **Two hub-list corrections:** (1) `compareCount` is NOT dead — it renders the compare-tray count at `trip-planner/page.tsx:636` (`t("compareCount", {count})`) alongside the `compare` button at :640; kept, and the step-5 "tray silently shows no count" hypothesis is **disproven** (it shows one). (2) `tripPlanner.body` was NOT on the hub's 12 but is dead + actively misleading ("…are next after the community reaches critical mass"), same defect class as `phaseEyebrow`/`recommendationsTitle`/`recommendationsHint`, so it was deleted too (flagged). budget/groupSize/interests/title/myItineraries were checked and are LIVE — not touched. **Permanent check (D-059):** no new gate needed — `usage.test.ts` (code→bundle) would fail the instant a deleted key were still referenced, and `parity.test.ts` enforces en/ne symmetry + no-empty; these existing gates are what made the removals safe and will catch any regression. **NE strings pending native review (4):** `डाइरेक्टरी` (nav), `समुदाय डाइरेक्टरी`, `पेसाकर्मी र व्यवसाय`, `पेसाकर्मीहरू` — `पेसाकर्मी` chosen over `व्यावसायिक` to match the shipped `register.professionalTitle` so registration + directory read as one product; **open call for the reviewer:** `डाइरेक्टरी` (transliteration) vs `निर्देशिका` (calque). | The rename closes the Members/Professional vocabulary split (`/register` already forks Business \| Professional); a "Phase 2" eyebrow on a shipped feature is a first-impression defect; and dead/misleading placeholder copy is removed by proof, not by "no literal reference" (which D-059 already showed is not proof of unused). |
| D-062 | 2026-07-29 | **BL-CI-02 — serialize the CI `e2e` job repo-wide; a per-ref concurrency group is not a serialization primitive for a job that mutates shared prod state.** ci.yml's only concurrency block was workflow-level `group: ci-${{ github.ref }}` — PER-REF, so a `main` run and a PR run (or two PR runs) execute SIMULTANEOUSLY as the single seeded account A against the shared A↔B thread; `global-teardown` hard-deletes A's WHOLE uploader subtree under `THREAD_AB` (its self-healing property → it deletes a CONCURRENT run's in-flight uploads) and tombstones A's messages inside a 55-min window (a concurrent run's live messages are inside it), and `attachments.spec` `.last()` can resolve to the other run's element → a flaky, NON-reproducible red that reads as a code failure. Fix: a JOB-level concurrency block on `e2e` only — constant `group: e2e-prod` (deliberately NO `${{ github.ref }}` → one e2e job at a time across every ref), `cancel-in-progress: false` (cancelling mid-run skips teardown → the exact D-060 residue), `queue: max` (default `single` CANCELS the pending run rather than queuing → a merge train silently loses a run; `max` = up to 100 pending). **`queue: max` + `cancel-in-progress: false` is the VALID pairing** — `queue: max` + `cancel-in-progress: true` is prohibited (Actions validation error). `queue` shipped 2026-05-07, AFTER the assistant's Jan-2026 model cutoff (so it was initially believed invalid; **verified against the GitHub concurrency docs before committing**, not asserted from stale memory). Workflow-level `ci-${{ github.ref }}` + `cancel-in-progress: true` left intact (correctly kills stale SAME-ref commits); `unit` gets no concurrency (pure — typecheck/build/vitest, no prod writes; only `e2e` writes prod). **Limitation (D-059):** serialization HIDES shared mutable state, it does not remove it — the P1 that removes it is run-scoped storage prefixes (a per-run id segment in each object name) + a teardown scoped to THIS run's own object names + message ids, which would let e2e parallelize again; `bl-e2e-selftarget` already applies that principle to posts (self-provisioned target), attachments is the remaining shared surface. **Note (c):** a SAME-ref cancellation (still possible by design) skips teardown, so if the next run starts >55 min later A's messages fall outside the 60-min delete window and become permanently un-tombstoned contentful rows until a service-role sweep — `global-teardown`'s `stale` log line already surfaces this; serialization is orthogonal (it fixes cross-ref overlap, not same-ref cancel). | A per-ref group serializes commits of ONE ref but lets different refs run concurrently; for a job whose teardown mutates a shared prod identity, "one at a time, repo-wide" is the requirement, and `queue: max` is what stops a merge train from silently dropping a queued run. |
| D-063 | 2026-07-30 | **BL-SOCIAL-03b — the react/quote/bookmark E2E tests had an unguarded optimistic-write→reload/navigate race; flaky (H5), a LATENT bug in THIS PR's own new test code, not a product bug.** The react test clicked Like (optimistic `aria-pressed=true`) then `page.reload()` BEFORE the `post_reactions` INSERT persisted, so the reloaded page re-read "not reacted" and the persist assertion failed with `aria-pressed="false"` on the 2-core CI runner. The quote test's `goto("/")` and the bookmark test's `goto("/bookmarks")` have the identical write-then-navigate shape. **Framing (corrected):** NOT a long-tolerated pre-existing defect — `social.spec.ts` had NEVER had a green CI run before this PR: its 4 media fixtures never existed in-repo, so `HAS_MEDIA` was always false and the suite SKIPPED in every prior CI run; this PR's ffmpeg generation activated it for the first time. The bug is in bl-social-03b's own new test bodies, written before the auth-setup commit; the `login()→storageState` change may have nudged the flake probability (removing login's pre-click warm-up) but did NOT introduce it. **H5 CONFIRMED non-hermetic:** the SAME SHA `11c21b4` went red (attempt 1) then GREEN on rerun (attempt 2) — one green run never proves a flaky fix, so the guard was verified across 3 local full-suite runs. **Fix:** a `waitForResponse` on the `post_reactions`/`post_reposts`/`post_bookmarks` POST, awaited BEFORE the reload/goto, in react(16)/quote(19)/bookmark(20). comment(17) + repost-add(18) assert on the same live page (no reload/navigate) → no guard needed. Does NOT weaken the assertions (still assert persistence-across-reload/navigate; a genuine non-persist regression still fails). NOT a product bug — reactions/quotes/bookmarks DO persist (green same-SHA rerun + both local runs + `68da93a` green). **Separate observability defect, also fixed:** the on-failure `playwright-report/` artifact was ALWAYS empty because `playwright.config.ts` set NO reporter (default `list` writes no report dir) — added `reporter: [["list"], ["html", { open: "never" }]]` so the upload has content. | A test that reloads/navigates before its own write persists is a race the harness owns, not the product; guard the write (the repost undo already did) rather than loosen the assertion. A no-HTML-reporter config makes every CI failure un-triageable — a silent observability hole that cost a full diagnostic detour. |
| D-064 | 2026-07-30 | **STANDING DEFECT: the React #418 hydration quarantine now follows `ssg: true`, so a genuine hydration regression on the 4 public SSG marketing routes will NOT fail CI.** BL-E2E-03 originally quarantined recoverable React #418/#423/#425 on `/` and `/ne` only; this branch widened it to every public SSG marketing route `smoke.spec.ts` visits — `/`, `/ne`, `/welcome-tour`, `/guidelines` — via a per-route `ssg: true` flag (after #418 was observed on `/guidelines` with the exact same signature). **The cost, recorded so it is never forgotten:** on those 4 routes a real #418/#423/#425 regression is TOLERATED (annotated + `console.warn`, but PASS) — only a NON-#418 error there, and ANY error on a non-ssg route, still fails first-miss. So a hydration regression on the marketing pages is invisible to CI. **The quarantine is TEMPORARY. To shrink it back / remove it, one of these must become true:** (a) the underlying React-19 concurrent-hydration #418 on the SSG marketing pages is root-caused and fixed at the source — then drop the `ssg` flags / the `isSsgRoute` branch so #418 fails first-miss again; or (b) it is proven a pure parallel-load test-env artifact a real one-page-at-a-time visitor never hits — then run those routes single-worker in smoke to expose real regressions while tolerating the artifact only under parallelism. Until (a) or (b), treat green smoke on these routes as "no NON-hydration error", not "no hydration bug". | A named, route-scoped quarantine keeps the suite green through a known framework artifact without a blanket retry — but it is a hole in coverage, and a hole you don't write down is a hole you forget you have. |
| D-065 | 2026-07-30 | **BL-EVENT-01 — event create/edit/cancel + org hosting + the host-FK account-deletion defect.** Migration `docs/BL-EVENT-01.sql` (+ `ROLLBACK_BL-EVENT-01.sql`) is **committed, NOT applied** — the hub verifies in begin/rollback against prod, then applies. It adds `status` (scheduled\|cancelled\|postponed) + `host_business_id` (→ businesses ON DELETE SET NULL); replaces `events_insert_host` (host_business_id, when set, must be a business the caller **owns** — ownership mirrors the offerings policies, `owner_user_id` only NOT business_members; org-hosting by a non-owner member is deliberately left a SEPARATE decision); adds the missing `events_update_host` + `events_delete_host`; and fixes `events_host_id_fkey` **NO ACTION → ON DELETE CASCADE** (it 23503-blocked `delete_own_account()` for any event host — proved in begin/rollback — and broke delete-test-accounts.mjs on the 5 seeded hosts; CASCADE matches posts.author_id/rsvps.user_id/offerings.profile_id, and rsvps already cascades from events). **Cancel = status, never delete** (rsvps_event_id_fkey is ON DELETE CASCADE, so a hard delete silently erases every attendee's RSVP); hard delete is offered ONLY when the event has 0 RSVPs. UI: shared `EventEditor` (create + edit) writing **starts_at/ends_at/event_tz ONLY** (never the legacy date/time), tz stored as the picked IANA zone with `lib/events.ts` wall⇄UTC mapping (DST + sub-hour Kathmandu +5:45, unit-tested); `/events/new` + `/events/[id]/edit`; a "Host an event" CTA on /events (NO nav rail row — D-054 still open); host-only Edit link + cancelled rendering (struck/badged, RSVP disabled) on both list + detail. **Report findings:** (a) events.date/time are read ONLY by the 2 events pages (a starts_at-null fallback + a `.order("date")`); all 5 rows have starts_at, so they are dead in practice and droppable once that fallback + sort are removed. (b) `events_select` is `to authenticated` with `qual true` → ANY authenticated member reads ALL events regardless of `view` (a Nepal-view member can read a US-only event via a crafted query; view is display context, NOT an access boundary — consistent with events being community-wide), and **anon gets nothing** (no anon SELECT policy). (c) **BROADER DEFECT, raised not decided:** business/offering/itinerary FKs into profiles are all CASCADE (fine), but **7 OTHER NO-ACTION FKs into profiles also 23503-block `delete_own_account()`** — `audit_logs.actor_id`, `business_members.added_by`, `channels.owner_user_id`, `invites.from_user_id`, `reports.reporter_id`, `reports.reviewer_id`, `verification_records.reviewer_id`. So account deletion is broken for admins, reporters, inviters, channel owners, reviewers — not just event hosts. Most want **SET NULL** (preserve the audit/moderation/history record, anonymize the departed user), NOT CASCADE, and some need nullable columns + a product call (channel-owner deletion) — a separate considered sweep, NOT folded in here. **NE strings: ~50 new `events` keys drafted (editor/create/edit/cancel/mode/view/danger-zone) — PENDING native review** (esp. रद्द/जोखिम क्षेत्र/भ्यू wording); parity + usage tests green. gates: tsc 0 · vitest 354/354 · build 73/73 both locales. P1 follow-ons: an `ends_at > starts_at` CHECK (validated client-side here), capacity/RSVP-states/cover-media, and dropping legacy date/time. **APPLIED to prod 2026-07-30 by hub — see this session's verification** (do NOT re-apply `docs/BL-EVENT-01.sql`). | Events had SELECT+INSERT only — no host could edit a typo'd time or cancel; and a NO-ACTION host FK made account deletion impossible for hosts, a pilot-launch blocker. The account-deletion FK gap is broader than events but each FK's correct rule differs (mostly SET NULL to preserve records), so it is surfaced with a recommendation rather than blind-CASCADEd. |
| D-066 | 2026-07-30 | **BL-ACCT-DELETE-FK — the 7 OTHER NO-ACTION FKs into `profiles` that 23503-block `delete_own_account()`, the broader defect raised (not decided) in D-065 finding (c). Files committed, NOT applied — hub verifies in begin/rollback against prod, then applies.** `docs/BL-ACCT-DELETE-FK.sql` (+ `ROLLBACK_…`): `audit_logs.actor_id` · `business_members.added_by` · `channels.owner_user_id` · `invites.from_user_id` · `reports.reporter_id` · `reports.reviewer_id` · `verification_records.reviewer_id` all go **NO ACTION → SET NULL** — the OPPOSITE default from BL-EVENT-01's host FK (CASCADE), **by design**: these 7 are audit/moderation/attribution trails; the RECORD (a report, a review decision, an invite) must survive an actor's account deletion, only the attribution anonymizes. CASCADE was right for events (an RSVP has no meaning without its event); it is wrong here. Hub verified live against prod (2026-07-30): all 7 already NULLABLE (no make-nullable step), all 7 confdeltype='a', all 7 → profiles(id); row counts audit_logs/invites/reports=0, business_members=1, verification_records=31, channels=15. RLS re-checked live for all 7 — none of the affected policies key on the FK column, so SET NULL has zero RLS impact. **Coding-agent pre-merge check (this branch), CLEAN:** no app code selects or dereferences `channels.owner_user_id` — the only 3 channel reads (GlobalSearch, channels list, channels detail) never request the column, and there is NO channel edit/settings/create/owner-gate UI at all (only legal copy, terms §10); SET NULL is safe with no code change. **Separate unscoped finding, raised not fixed:** `channels` has ONLY a SELECT policy (qual true) — no INSERT/UPDATE/DELETE policy exists; corroborated at code level (zero channel-write code anywhere), consistent with the unbuilt user-created-channels feature (D-017), NOT a broken guard. **Branch note:** `bl-acct-delete-fk` is off `main` (D-064), so this row's referent D-065 lands with `bl-event-01`; merge order is the hub's — number allocated after the true global max (D-065, in-flight), never reused. **Orphaned-channel product question** (what an owner-less channel means) stays deferred with the unbuilt feature, not decided here. **APPLIED to prod 2026-07-30 by hub — see this session's verification** (do NOT re-apply `docs/BL-ACCT-DELETE-FK.sql`). | Account deletion being broken for admins/reporters/inviters/channel-owners/reviewers is a pilot-launch blocker, same *class* as the event-host FK but a different *fix*: SET NULL preserves the record and anonymizes the actor, where CASCADE would destroy moderation/audit history. Each FK's correct rule is per-column, so it is surfaced as its own migration with the rules spelled out, not blind-CASCADEd into BL-EVENT-01. |
| D-067 | 2026-07-30 | **BL-ADMIN-HARDEN — /admin access moved from an IN-PAGE check (which rendered the app shell + an "Admins only" message before turning a non-admin away) to the MIDDLEWARE, so a non-admin is redirected BEFORE any admin code runs; `admin/layout.tsx` added as a fail-closed second layer that also auto-gates future `/admin/*` sub-routes.** `lib/authRouting.ts` gains `isAdminPath` (`/admin` or `/admin/*`, on the locale-stripped path). `lib/supabase/middleware.ts`: after the existing `!user && !isPublicPath` redirect, `if (user && isAdminPath(path))` runs the SAME `admin_users` select the old page used (`user_id = auth.uid()`, RLS `admin_users_select_self`) and redirects home on a missing row — **NO new authorization logic**, the identical check relocated. The DB round-trip is **path-scoped to /admin\*** (never added to other routes) and **fails closed** (`maybeSingle()` → null on absence OR error → redirect). `admin/page.tsx` simplified to just render `<AdminDashboard />` (dashboard.tsx + all KYC/report logic UNTOUCHED); dead `admin.adminsOnlyTitle`/`adminsOnlyBody` removed from both bundles (parity + usage tests green). **Live-exercised (curl vs a local `next start`, not "should work"):** (1) valid signed-in NON-admin (seeded account A) → `/admin`,`/en/admin`,`/ne/admin`,`/admin/reports` all **307 → `/`/`/ne`** (home), empty body, zero admin-content markers — the NEW behavior; (2) logged-out → same paths **307 → `/login`/`/ne/login`**, empty body — unchanged, and proves /admin stays protected + sub-routes gate. The two branches land on DISTINCT targets (non-admin→home vs logged-out→login), proving the non-admin branch actually fires. (3) admin-reaches-dashboard **NOT live-exercised** — no admin account in the E2E seed; it is a structural no-op for admins (both new gates fall through when the `admin_users` row exists, same check the old page used), accepted-and-unguarded for the live path. **Permanent checks (D-059):** `isAdminPath` unit suite in `authRouting.test.ts` (matches root+sub-routes, rejects `/administrators` lookalikes, both-locale pipeline, asserts `/admin` stays non-public) + `e2e/admin-gate.spec.ts` (the two redirect cases as read-only 307 assertions; authed case gated on `E2E_EMAIL`/`PASSWORD` so it runs in CI, skips locally). **Branch note:** `bl-admin-harden` is off `main` (D-064); referents D-065/D-066 arrive with `bl-event-01`/`bl-acct-delete-fk`; D-067 allocated after the true global max, never reused. | The old in-page guard let a non-admin's browser receive the full authenticated shell (rail/topbar/avatar) and only THEN an "admins only" panel — admin route code executed and admin chrome shipped before the refusal. Gating in middleware turns them away with a 307 and an empty body, so no admin surface is ever emitted; the layout repeats the check so the guarantee survives a middleware-matcher change and covers `/admin/*` for free. |
| D-068 | 2026-07-30 | **BL-ADMIN-ANALYTICS-ACCOUNTS — admin analytics dashboard + account management, applied from a hub patch. Migration `docs/BL-ADMIN-ACCOUNTS.sql` (+ rollback) committed, NOT applied — hub verifies begin/rollback (checklist a–e in the file), same as D-065/D-066.** **Analytics** (`/admin/analytics`, recharts): KYC/report ops metrics (pending, approved/rejected 30d, avg decision/resolution time, weekly volume charts) derived entirely from existing `audit_logs` timestamps — **no schema change**. **Accounts** (`/admin/accounts`): Professionals list (email + ban status via a service-role route — `auth.users` has no client-readable path), invite (GoTrue `inviteUserByEmail`), ban/unban (`ban_duration`, reversible soft-delete), hard-delete (the new `admin_delete_account()` RPC), + Businesses list/create/delete. **Migration adds:** `admin_delete_account(uuid)` SECURITY DEFINER (admin-gated + self-delete guard forcing the settings `delete_own_account` path; cascades reuse D-065/D-066, no new cascade) and `businesses_admin_insert`/`businesses_admin_delete` policies (additive OR-branches mirroring the existing `businesses_admin_update`). **Security review — the `/api/admin/*` routes are OUTSIDE the middleware matcher (it excludes `/api`), so each self-gates** via `requireAdmin()` (`lib/adminServerAuth.ts`, fail-closed `admin_users` check) BEFORE constructing the service client; the service-role key stays server-only (`createServiceClient`, `runtime="nodejs"`, `import "server-only"`); self-ban and self-delete are both blocked; every action audit-logs under the admin's own session. **BLOCKING BUG FOUND + FIXED (not the hub's design intent, a dead grant):** the create-business flow resolved owner-email→id via `find_user_id_by_email`, which is **revoked from `authenticated`** (the F8 enumeration oracle, revoked 2026-07-22 — verified STILL revoked live on prod 2026-07-30: `authenticated`/`anon` EXECUTE = false, `service_role` only). So the call would permission-fail for the admin too, and the migration correctly does NOT re-grant it (that would re-open the oracle for every user). **Fix:** resolve the owner from the already-loaded, admin-gated `professionals` list (each row carries its email, fetched through the service-role `/api/admin/accounts` route) — reuses admin-gated data, no new grant/endpoint, oracle stays closed. Removed the dead `findOwnerIdByEmail` helper. **Read-only prod verification (de-risking the hub's apply):** `audit_logs` columns exactly match the routes' inserts; `audit_logs_admin_select` exists → admin CAN read it → analytics shows real data, not always-zero; `businesses_admin_insert/delete` + `admin_delete_account` do NOT pre-exist → migration won't collide. **Smoke tests: NONE run live** — this env has no admin session (account A is non-admin → D-067 layout redirects it off `/admin`), no local `SUPABASE_SERVICE_ROLE_KEY` (invite/ban/list routes need it), and the migration is intentionally unapplied (business create/delete + hard-delete depend on it). Verified instead by code review + gates + the read-only DB checks; the delete-professional **cascade warning correctly names owned businesses** (accounts/page.tsx computes `owned = businesses.filter(owner_user_id===id)` and renders count + `join(", ")`); #5 hard-delete held for the hub per instruction. **Permanent checks (D-059):** parity + usage gates cover the +60 en/ne keys; the admin API routes have **no dedicated automated gate** — accepted-and-unguarded (needs an admin + service-role E2E harness, same gap as D-067's authed case), flagged for a future admin-E2E project. **Minor flags:** recharts 2.x is deprecated + `npm audit` reports 3 high vulns (hub pinned `^2.15.0` — bump to v3 is a separate call); `lib/adminAnalytics.ts` references `docs/BL-ADMIN-ANALYTICS.md`, which the patch did NOT include (dangling comment, harmless). gates: tsc 0 · vitest 358/358 · build 73/73 both locales. **FOLLOW-UP FIX (`0df3f5b`):** hub-found during verification — `handleCreateBusiness` audit-logged `admin_business_created` with `target_id` = the OWNER's user id under `target_type` "business" (silent: no error, not in the analytics KYC/report action sets, but it broke `audit_logs`' target_type/target_id contract for that one action). `createBusiness()` returned void, so the page had no business id to pass; it now `.select("id").single()` and returns `{id}`, and the page logs the business id as `target_id` with `owner_user_id` moved into metadata. Re-verified: tsc 0 · vitest 358/358 · build 73/73. | Analytics + account management are admin-first-impression surfaces; the account tools need the GoTrue Admin API (email/ban/invite) which no RLS can express, so they run through admin-gated service-role routes — but `/api/*` is outside the middleware admin gate, so each route re-checks admin itself. The one integration bug (a revoked oracle RPC) is fixed by reusing admin-gated data rather than re-granting the oracle, keeping the F8 fix intact. |
| D-069 | 2026-07-30 | **BL-PWRESET-01 — password reset actually resets the password now.** Applied from a hub patch. **Bug:** `resetPasswordForEmail`'s `/auth/callback` exchanged the recovery code for a session and redirected to `next` (default `/`) — so the user landed on the home feed **fully logged in with their forgotten password still the only one on file**; no page ever asked for a new one. The "reset" only granted a session. **Fix:** `app/auth/callback/route.ts` reads the `type` param and routes `type === "recovery"` to a NEW `/update-password` page instead of `next`; all other flows keep going to `next`. New `app/[locale]/(auth)/update-password/page.tsx` (chrome-free `(auth)` group): new-password + confirm, `supabase.auth.updateUser({ password })` against the recovery session the callback just established, then home. +5 `auth` keys × en/ne (`newPassword`, `updatePasswordTitle/Subtitle`, `updatingPassword`, `updatePasswordCta`); reuses existing `auth.passwordHint`/`confirmPassword`/`errPasswordShort`/`errPasswordMismatch`. **Three requested checks:** parity ✅ (en/ne symmetric); usage ✅ (all 5 new keys referenced, the 4 reused keys resolve — no dead/missing key); **OAuth login + OAuth signup + signup email-confirmation UNAFFECTED** ✅ — traced in code: login (`signInWithOAuth → /auth/callback`), signup OAuth (`→ /auth/callback?next=…`, `next` preserved), and signup email-confirm (`emailRedirectTo → /auth/callback`) all arrive **without** `type=recovery`, so `destination = next` exactly as before; only the recovery flow (Supabase appends `type=recovery`) takes the new branch. `/update-password` is **not** in `PUBLIC_PATHS` and doesn't need to be — `exchangeCodeForSession` establishes the session before the redirect, so the user is authenticated when they reach it. **Accepted trade-off (from the page, flagged not engineered around):** `updateUser` works against ANY active session, so a normally-logged-in user who navigates to `/update-password` directly can change their password WITHOUT re-entering the current one (unlike `settings/account`, which re-verifies via `signInWithPassword`) — this is Supabase's recovery model, not unique to this page. **Minor observation:** the recovery callback redirects to a locale-less `/update-password`, so a `ne` user lands on the English page (pre-existing `/auth/callback` behavior — the old `next` was locale-less too — not introduced here). **Permanent checks (D-059):** parity + usage gates cover the i18n keys; the recovery→`/update-password` routing has **no** automated gate (a real recovery email + session is needed) — accepted-and-unguarded, same class as the auth-E2E gaps in D-067/D-068. **Branch note:** `bl-pwreset-01` is off `main` (D-067 last there); D-068 arrives with `bl-admin-analytics-accounts`; D-069 allocated after the true global max, never reused. gates: tsc 0 · vitest 358/358 · next build green both locales (incl. the new `/update-password` route). | A password-reset that logs you in without letting you set a new password is a silent, total failure of the feature — the user believes they reset it and their old (forgotten) password is unchanged. Routing only `type=recovery` to a dedicated page fixes it without touching any other callback flow. |
| D-071 | 2026-07-30 | **BL-PWRESET-02 — D-069's recovery routing never fired; the fix delivers the `type` signal it always depended on.** Applied from a hub patch. **Root cause (confirmed live, not assumed):** `resetPasswordForEmail` uses Supabase's **PKCE** flow — the emailed link points at Supabase's own `/auth/v1/verify?token=pkce_…&type=recovery&redirect_to=…`, NOT our app. On success `/auth/v1/verify` 303-redirects to `redirect_to` **appending only `?code=…`** — it does NOT forward `type=recovery` onto our `/auth/callback`. (The `type=recovery` in the emailed link is a parameter *to Supabase's verify call*; it doesn't survive into the redirect. Supabase's docs example showing `type` on an app route is for the *token_hash-based `/auth/confirm`* pattern, which this codebase doesn't use.) So D-069's `/auth/callback` branch **always saw `type === null`** and every recovery link fell through to `next` ("/") again. **Confirmed via Vercel runtime logs** (`dpl_A2WA…`: `GET /auth/callback 307` → `GET / 200`, never `/update-password`) **and Supabase auth logs** (`/verify` 303, `action:"login"`, no recovery action). **Fix:** bake `type=recovery` directly into the `redirectTo` passed to `resetPasswordForEmail` (`/auth/callback?type=recovery`). GoTrue **preserves existing query params on `redirect_to`** and just adds `code` alongside, so `/auth/callback` now receives BOTH `type=recovery` and `code` → **D-069's branch logic works UNMODIFIED**. **D-069's routing was always correct — it just never received the `type` signal it depended on.** **Folded in (same file):** `forgot-password/page.tsx` showed Supabase's raw `error.message` for every failure, including `"email rate limit exceeded"` (KC hit it live mid-test) — now special-cases `error.code === "over_email_send_rate_limit"` → friendly `auth.errResetRateLimited` (`.code` verified against `@supabase/auth-js@2.110.7` `errors.js`); every other error path passes through unchanged. +1 `auth.errResetRateLimited` key × en/ne, additive; **NE string is machine-translated, NOT yet natively reviewed — flagged same as D-061's NE strings.** **NOT live-retested** (the hub burned the hourly email-send allowance verifying this — `over_email_send_rate_limit` re-triggered after one send); relied on code review + gates; hub re-verifies live once the allowance resets / custom SMTP is confirmed. **OPEN ITEM, flagged to KC/hub, NOT a code change:** the custom SMTP (Resend) KC configured today may not be taking effect — the recovery email still came from `noreply@mail.app.supabase.io` (Supabase's built-in default sender) and the built-in per-project rate limit re-triggered after a single send within ~7 min (inconsistent with Resend's free tier). KC to recheck Supabase Dashboard → Authentication → SMTP Settings; do NOT work around it in app code. **Permanent checks (D-059):** parity + usage guard the new key; the redirect-signal routing has no automated gate (needs a live recovery email) — accepted-and-unguarded, same class as the auth-E2E gaps in D-067/D-069. **Branch note:** `bl-pwreset-02` is off `main` (D-069 last there); D-068 arrives with `bl-admin-analytics-accounts`; D-071 as directed by the hub. gates: tsc 0 · vitest 358/358 (parity + usage green) · next build green both locales. | A routing fix that depends on a query param the platform never sends is a silent no-op — D-069 was verified as merged/deployed but the recovery flow stayed broken because the `type` signal died in GoTrue's `/verify` redirect. Setting `type` on `redirect_to` itself is the only place it survives, and it reuses D-069's logic verbatim rather than adding a second code path. |
