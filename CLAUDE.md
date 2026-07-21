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
context rail, and post/member chips. Type: system stack; eyebrow labels
(11px/uppercase/tracked) for section context. Professional density; hairline borders;
no gradients; restraint everywhere except the context-color system.

## Workflow — every task

Plan → implement → `npm run verify` (= next build; keep it passing) → update this
file → commit (`feat:`/`fix:`/`chore:`) → propose next, wait for confirmation.
"Breakthrough <instructions>" = sanctioned pivot: update plan + this file, confirm,
proceed.

## Phase discipline (safety rails)

- Do NOT build marketplace, checkout, payments, or vendor inventory in Phase 1.
- Invite-only access is Phase 1's trust mechanism; full tiered KYC returns with the
  transaction layer. Never present the mock auth as real gating.
- Locked pages stay honest: they say what phase unlocks them and route people to the
  community meanwhile.

## Decision log

| ID    | Date       | Decision | Why |
|-------|------------|----------|-----|
| D-001 | 2026-07-16 | Task Breakdown = task-ID source (starter kit) | Resolved doc conflict |
| D-002 | 2026-07-16 | Loop runs in Claude Code, not custom LangGraph | 90% of value, ~0 build cost |
| D-003 | 2026-07-17 | **Atomic Network pivot approved by founder** — community-first sequencing supersedes old Phase 1 (marketplace/KYC deferred to Phase 3) | Cold-start strategy: seed a dense, high-trust network before transactions |
| D-004 | 2026-07-17 | Corridor palette: view colors carry information (US=denim, Nepal=rhodo, Bridge=pine) | Brief requires "clear country context at all times" |
| D-005 | 2026-07-17 | Mock data layer this pass; Supabase next | Real auth/DB needs founder credentials; UI-first unblocked the build |
