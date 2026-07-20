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
  context rail, Home feed (view-filtered), 7 community sections, members directory
  (search + filters), events + RSVP, messages (mock), composer, 6-step onboarding,
  profile/settings with invite link, locked Marketplace/Vendor, Trip Planner preview.
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
