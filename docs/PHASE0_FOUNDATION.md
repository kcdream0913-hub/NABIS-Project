# BridgeLink — Phase 0 Foundation Brief

Started 2026-07-18. This is the founding spec for the Atomic Network. It consolidates
the approved vision, the NABIS 2026 launch audience, the architecture decision, the
membership/vetting model, and the researched identity-verification approach. Later
build work references this document.

## 1. What we're building

BridgeLink is an **invite-only, identity-verified networking + messaging platform for
the high-trust US–Nepal business community** — the professional "operating system"
where business owners, investors, diplomats, finance leaders, journalists, and senior
professionals connect, message, and (later) transact.

Trust and exclusivity *are* the product. Every member is vetted, so an introduction or
message here carries weight a generic platform can't offer.

**Anchor launch moment:** NABIS 2026 (Nepali American Business & Investment Summit,
Sept 26–27, NYC) — 200–500+ attendees across exactly these member categories, timed to
UN General Assembly week (high-level Nepali delegation + diplomats present).

## 2. Launch audience → member segments

From the NABIS 2026 attendee profile:

- **Business owners & entrepreneurs** — restaurant/hospitality, retail/jewelry, tech founders, small businesses (Queens/Jackson Heights concentration).
- **Investors & VCs** — diaspora investors, Nepal-focused funds, angel investors.
- **Diplomats & government officials** — Nepal UN mission, Consulate General of Nepal in NY, visiting delegation, NYC/NY-state officials.
- **Politicians & community leaders** — Nepali-origin elected officials, NRNA, Chamber board.
- **Journalists & media** — diaspora outlets; content partners and amplifiers.
- **Professionals & experts** — lawyers, engineers, academics, AI/tech leaders.
- **Banking & finance professionals** — partner banks and lenders.
- **Courier / logistics / supply-chain businesses** — freight forwarders, couriers,
  customs brokers, and importers/exporters moving goods between the US and Nepal. A core
  corridor use case: consolidating shipments, finding freight partners, customs help.
- **Nepal-based businesses** — exporters, manufacturers, handicraft/textile producers,
  tour operators, suppliers, and service firms operating *from Nepal*. This is the other
  side of the corridor — not just US diaspora. Nepal businesses are first-class members
  who connect with US-side buyers, investors, and diaspora.

## 3. Architecture decision (left to Claude's judgment; founder had no preference)

**A blend, with a clear front door and a clear core.**

- **Front door — trust & discovery:** verified member profiles + a searchable directory
  (filter by role, sector, location, US/Nepal) + a curated feed of vetted announcements
  and opportunities. This is what makes the network worth joining: you can *see and
  trust who is here.*
- **Core interaction — messaging:** vertical group channels + 1:1 direct messages.
  Channels seed the community (Tech & AI, Tourism & Hospitality, Investment & Policy,
  **Logistics & Supply Chain** (couriers, freight, customs, import/export),
  **Immigration & Legal** (visas, entity setup, compliance), Media & Journalism,
  Entrepreneurs); DMs turn a discovery into a relationship. New sector
  channels are cheap to add — a business type = one channel + one directory filter tag,
  never a redesign.

**Two-sided by design (US ↔ Nepal).** BridgeLink is a corridor, so Nepal-based
businesses are a full half of the network, not a sub-section. Every profile is tagged US
or Nepal; the directory filters by it; and a US / Nepal / Bridge view lets members choose
which side of the corridor they're looking at. A Nepal exporter and a US buyer finding
each other *is* the product.

**Why not pure chat (Telegram-style):** for an elite network the value isn't the chat
itself — it's knowing the person on the other end is a verified diplomat or a real
investor. Strip the profile/directory/verification layer and you've built a group chat,
not a trusted network.

**Why not pure feed (LinkedIn-style):** the whole point is direct, high-signal
conversation between vetted people. So — profiles + directory + feed as the credibility
layer, messaging as the engine. (This also builds on the working app already
scaffolded, elevating messaging to a first-class pillar.)

## 4. Membership & vetting — approved model: "apply OR invite, then verified"

Every member arrives one of two ways and is verified before full access:

1. **Apply** — request access, state who you are and your category.
2. **Invite** — an existing member brings you in. Invites are limited, so members vouch
   carefully; every member reflects on whoever brought them in.

Then: **identity verification appropriate to the tier**, and a badge.

### Tiers

| Tier | Who | Verification | Unlocks |
|------|-----|--------------|---------|
| **Community (free)** | Journalists, community members, early-stage founders | Light — identity + professional/LinkedIn link | Verified profile, messaging, event discovery |
| **Verified Professional** | Business owners, senior professionals | Document identity (KYC) + business/role check | "Verified" badge, group channels, directory prominence |
| **Investor** | Diaspora investors, VCs, fund reps | Identity-verified; formal accredited-investor checks only if the platform later facilitates real deals | Enhanced profile (focus areas, check size — self-declared for now), priority matching |
| **VIP / Diplomat** | Diplomats, government officials, top-tier leaders | Identity + endorsement (Chamber, Consulate, or two existing VIP members) | Highest-trust badge, optional private channels |

The apply-or-invite + endorsement design is deliberate: for diplomats and serious
investors, trust comes from *who vouches*, not just a scanned ID. Document KYC proves
you're a real person; the endorsement proves you belong. That combination is the moat.

## 5. Identity verification — recommended approach (researched 2026-07-18)

The hard constraint: you must verify **both sides of the corridor — US and Nepal — plus
screen diplomats (PEP)**. Most providers do one country well; few do both.

**Primary recommendation: Shufti Pro.** The one provider that covers the whole need in a
single integration:
- Verifies Nepal's documents — National ID (NIDMC), passport, driver's license,
  citizenship — against government sources.
- Covers the US and 240+ countries for the diaspora.
- Does **PEP & sanctions screening** — essential for diplomats and government officials.
- Handles business verification (KYB) for the professional tier, plus liveness/deepfake
  detection.

**Lightweight / low-cost alternative for early testing: ID Analyzer** — supports 9 Nepal
documents, has a free tier (100 checks/month) and no-code flows. Good for the MVP and
the Community tier before committing to Shufti's enterprise pricing.

**The human layer sits on top of both:** apply-or-invite + endorsement. Document KYC +
vouching together is what keeps this genuinely elite — not any single vendor.

**Compliance note:** Nepal-side financial features (Phase 3) must respect Nepal Rastra
Bank (NRB) KYC/AML rules. For Phase 1 (networking only, no transactions) full financial
KYC isn't required yet — but building on Shufti now means the compliance foundation is
ready when transactions arrive.

## Business onboarding (KYB) & country coverage

A business doesn't sign up — an authorized person signs up on its behalf. Strategy:
- Verify the person first (fast ID scan), grant access to explore immediately, and verify
  the business in parallel — never block on paperwork.
- KYB for the entity: business registration / incorporation number (PAN-VAT in Nepal,
  EIN/registration in the US) cross-checked against the national registry. Enforces the
  "real, physical business" bar at the company level.
- Invite fast-track: a vouch from an existing verified member skips the queue — members
  become the growth engine.
- Two-sided pull for NABIS: seed anchor businesses, then let US buyers and Nepal suppliers
  pull each other in; QR onboarding at the event.
- Businesses get their own verified tier/badge (Verified Business), shown in the directory.

**Country coverage (hard requirement).** Identity verification is country-first — the
member selects their country from a full list of every country, which drives the valid
document types shown (US: passport / driver's license / state ID; Nepal: passport /
citizenship / national ID; everywhere else: that country's documents). Full global
coverage is absolute — the diaspora holds documents from many countries.

## 6. Phase plan (aligned to the Atomic Network sequencing)

- **Phase 1 — Atomic Network (now):** verified profiles + directory, vertical channels +
  DMs, the apply/invite + verification flow, event tools (NABIS), basic matching. Goal:
  a small, dense, high-trust network.
- **Phase 2 — Utility:** marketplace + trip planner + AI co-pilot (matching, warm intros,
  Nepali↔English translation & summarization).
- **Phase 3 — Transactions:** payments/remittance, affiliate/referral, analytics.

## 7. Status & next steps

**Already built (foundation):** a working community app — feed, member directory,
profiles, messaging, events, onboarding — that compiles cleanly. Messaging is now
elevated to a first-class pillar with the vertical channels above.

**Immediate next build steps:**
1. Reshape the app around the tiered membership + apply/invite/verify flow.
2. Stand up the database (Supabase) — real profiles, channels, messages, invites,
   verification status.
3. Wire identity verification (ID Analyzer for testing → Shufti for launch).
4. Deploy to a hosted link (Vercel) so the founder and first members can actually use
   it — no local install, no PowerShell.

**What needs the founder (only at deploy/verify time):** connecting Supabase, Vercel,
and the verification-provider accounts. The building happens in-session; those
connections are the only steps that require a login.

## Decision log additions

- D-006 (2026-07-18): Architecture = blend — verified profiles + directory + curated feed as the trust/discovery front door; vertical group channels + 1:1 DMs as the core. Founder deferred; leverages the app already built.
- D-007 (2026-07-18): Membership = apply OR invite, then tiered identity verification + endorsement for VIP/Diplomat. Founder-approved.
- D-008 (2026-07-18): Identity verification = Shufti Pro (primary, US+Nepal+PEP+KYB) with ID Analyzer for low-cost early testing; human endorsement layer on top.
- D-009 (2026-07-18): Launch anchored to NABIS 2026 (Sept 26–27, NYC); member segments taken from the NABIS attendee profile.
