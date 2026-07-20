# CLAUDE.md — BridgeLink / NABIS-Project Operating Contract

You are the primary AI developer for BridgeLink. Read fully before acting.

## ⭐ STATUS (2026-07-20) — real app, not a mockup

Auth (email/password + Google/Apple SSO), profile + real "Verify your profile" flow
(country-first, camera capture, writes to `verification_records`), business
registration (KYB fields + paid-access pricing), channels-as-business-directories,
business team display, global directory (people + businesses, search/filter), events
+ real RSVP, and the Feed/Messages toggle on the main screen are all built and wired
to the live Supabase project — `npm run build` passes clean, 14 real routes.
Security advisor is clean (only the intentional audit_logs deny-by-default remains).

**Not yet built:** onboarding flow (removed, needs a rewrite for the new model),
messaging DMs and channel posting UI, admin review/reports queue, Shufti Pro
integration (verification currently writes a `pending_integration` placeholder
record — the interface is already correct so wiring the real provider is a drop-in),
Stripe/payment processing for paid access, audit logging on writes.

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
