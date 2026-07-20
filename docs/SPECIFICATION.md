# BridgeLink — Product, Design & Technical Specification

Version 1.0 · 2026-07-18 · Status: MVP-ready
This is the authoritative spec. It consolidates every decision to date and supersedes
scattered notes. Companion docs: `PHASE0_FOUNDATION.md` (strategy narrative),
`CLAUDE.md` (operating contract + decision log).

---

## 1. Overview

**BridgeLink is an invite-only, identity-verified networking and messaging platform for
the high-trust US–Nepal business community** — the professional operating system where
business owners, investors, diplomats, finance leaders, journalists, and senior
professionals connect, message, and (later) transact.

Trust and exclusivity are the product. Every member and every business is verified, so
an introduction or message here carries weight a generic platform cannot offer.

- **Positioning:** "The trusted network of the US–Nepal corridor."
- **Two-sided by design:** the US side (diaspora, buyers, investors) and the Nepal side
  (exporters, manufacturers, operators, suppliers) are equal halves, not a main market
  plus an add-on.
- **Sequencing strategy (governs scope):**
  1. **Phase 1 — Atomic Network (now):** verified community + messaging. Build a small,
     dense, high-trust network first.
  2. **Phase 2 — Utility:** marketplace, trip planner, AI co-pilot.
  3. **Phase 3 — Transactions:** payments, remittance, affiliate, analytics.
- **Launch anchor:** NABIS 2026 (Nepali American Business & Investment Summit,
  Sept 26–27, NYC; 200–500+ attendees across the exact target segments).

---

## 2. Target users

### Member segments (from the NABIS 2026 profile)
- Business owners & entrepreneurs (restaurant/hospitality, retail/jewelry, tech founders, SMBs)
- Investors & VCs (diaspora investors, Nepal-focused funds, angels)
- Diplomats & government officials (Nepal UN mission, Consulate General, visiting delegations, NYC/NY officials)
- Politicians & community leaders (Nepali-origin elected officials, NRNA, Chamber board)
- Journalists & media (diaspora outlets — content partners)
- Professionals & experts (lawyers, engineers, academics, AI/tech leaders)
- Banking & finance professionals (partner banks and lenders)
- **Courier / logistics / supply-chain businesses** (freight forwarders, couriers, customs brokers, importers/exporters)
- **Nepal-based businesses** (exporters, manufacturers, handicraft/textile producers, tour operators, suppliers, service firms)
- **Other** — professions we can't predict; still fully verified

### Representative personas
- *US restaurateur* sourcing spices/staff pipelines from Nepal; needs verified suppliers + freight partners.
- *Nepal exporter* (handicrafts/textiles) reaching US retailers; needs verified buyers + consolidated shipping.
- *Diaspora investor* seeking vetted, past-idea-stage founders in food, logistics, travel.
- *Freight forwarder* consolidating US↔Nepal shipments; needs verified counterparties.
- *Diplomat/official* hosting roundtables; needs a credible, verified audience and privacy.

---

## 3. Design requirements

### 3.1 Principles
- **Professional and trustworthy, not flashy social.** High information density without clutter; strong hierarchy; restraint everywhere except the trust/country signals.
- **Trust is visible.** Verification badges, tiers, and country context appear wherever a person or business is shown.
- **Minimal friction for busy people.** Short paths; verify-and-explore, never long blocking forms.
- **Country context is always clear** (US / Nepal / Bridge).

### 3.2 Visual system — the corridor palette
Colors carry meaning; the three view colors mark country context everywhere (view
toggle, top-bar context rail, member/post/business chips).

| Token | Hex | Use |
|-------|-----|-----|
| Pine | `#0F5C55` | Brand + Bridge (cross-border) context |
| Pine ink | `#0A3F3A` | Hover/active brand |
| Denim | `#2B4C8C` | **US** context |
| Rhodo | `#C2412F` | **Nepal** context (rhododendron / flag red) |
| Gold | `#9A7222` | Locked / premium / higher-tier accents |
| Mist | `#F6F8F7` | App background |
| Ink | `#16211F` | Primary text |
| Ink-soft | `#5B6B67` | Secondary text |
| Line | `#E2E8E6` | Hairline borders |

Tier/badge colors: Verified & Verified Business = green; Investor = purple;
VIP/Diplomat = amber; Community = neutral.

### 3.3 Typography & layout
- System font stack (fast, native, professional). Eyebrow labels: 11px, uppercase, letter-spacing 0.08em, for section context.
- Layout: fixed left sidebar (~240px), top bar (~56px) + 2px country-context rail, content max-width ~1024px; feed uses a content + right-rail split on wide screens.
- Hairline (0.5px) borders, generous radius (10–12px), no gradients, no heavy shadows.

### 3.4 Accessibility (WCAG 2.1 AA target)
- Visible focus states on all interactive elements; keyboard navigable.
- ARIA roles on toggles (tablist/tab), switches, and dialogs.
- `prefers-reduced-motion` respected (no scan-line/animation for those users).
- Color never the sole signal — badges pair color with icon + label; country pairs color with text.
- Minimum contrast ratios met on text and chips.

### 3.5 Responsive
- Mobile: sidebar collapses to an overlay drawer; view toggle shortens to abbreviations; grids reflow to single column.
- All flows (join, verification, messaging, directory) usable on a phone.

### 3.6 Voice
Clear, warm, professional. No hype. Copy assumes a busy, senior reader.

---

## 4. MVP scope (Phase 1 — Atomic Network)

### 4.1 In scope (P0 — required for MVP)
1. **Sign-up:** email or phone + password, plus Google / Apple sign-in. Standard, low-friction.
2. **Profile verification (KYC):** initiated from the Profile menu ("Verify your profile") — country-first, diverse documents, camera capture, liveness. Earns a Verified badge; not a gate to signing up.
3. **Business registration & verification (KYB):** businesses register, are registry-checked in parallel, and carry a **team** (owner / professional / assistant / employee).
4. **Verified profiles & businesses** with badges + country tags.
5. **Onboarding** (after signup): complete profile, choose view, verify, pick your sector/channel, create or join a business.
6. **Main screen with a Feed / Messages toggle** — Feed = content/opportunities; Messages = sector channels + DMs.
7. **Channels as sector directories:** clicking a channel shows registered business bios; a business bio shows its people.
8. **Member & business directory:** search + filters (sector, role, US/Nepal, verified).
9. **Content & Feed** (view-aware) with posting for verified members.
10. **Events** with RSVP.
11. **Admin review + reports queue;** audit logging.
12. **View system:** US / Nepal / Bridge.

### 4.2 Out of scope for MVP (later phases)
Marketplace & listings, payments/remittance, trip planner, AI chatbot/co-pilot, content
boost, affiliate program, advanced analytics, translation. (All specified at a high
level in §8 for forward-compatibility.)

### 4.3 MVP definition of done
A verified member can: get in (apply/invite + verify), complete a profile, browse and
filter the directory, join sector channels, post, DM another member, RSVP to an event —
all scoped by view; an admin can review and approve/reject applicants; every
verification, admission, and moderation action is audit-logged; the app is deployed to a
hosted URL.

---

## 5. Functional specifications

### 5.1 Sign-up & access
- **Sign-up (standard, low-friction):** email or phone number + password, plus **Google and Apple** single sign-on. No apply/invite gate at the door.
- **After sign-up** the user has an account and completes onboarding. Trusted status comes from **verifying the profile** (§5.2) — done from the Profile menu, not from gating entry.
- **Verified vs unverified (confirmed):** unverified accounts can **browse the Feed and the channel/business directories** — read-only. **Posting and messaging require verification.** This is where exclusivity is enforced now that signup is open.
- **Special designations:** Diplomat/official (PEP screening + endorsement) remains a distinct verified badge; investors surface in the Investment & Policy sector.

### 5.2 Profile verification (KYC) — lives in the Profile menu
- **Two verification types:** **Person** (individual identity — this section) and **Business** (the owner verifies as a person + registers the entity — §5.3). Both begin from **"Verify your profile"** in the Profile menu — no apply/invite screens.
- **"What describes you" = your sector, matching the channel names exactly** — selecting one places you in that sector/channel: Investment & Policy · Logistics & Supply Chain · Tourism & Hospitality · Tech & AI · Immigration & Legal · Media & Journalism · Entrepreneurs · **Freelancers / Outsourcing** · Other. A member may belong to more than one.
- **Country-first:** select country from a full list of **every country** → valid document types adapt (US → passport / driver's license / state ID; Nepal → passport / citizenship / national ID; else that country's documents).
- **Capture & checks (top-grade, no manual bypass):** live **camera scan** · document authenticity vs. issuing authority · **face match + liveness** · business/role verification · **PEP & sanctions + endorsement** for Diplomat.
- **Provider:** Shufti Pro (primary — US + Nepal + 240+ countries + PEP + KYB + liveness); ID Analyzer for early testing. Records store outcomes, not raw media where avoidable (§7.2).

### 5.3 Business registration, teams & channel directory (KYB)

**Tiered by design — registration number is not required to join (D-015):**
- **Tier 1 — Listed (default):** name, sector, bio, country only. No registration number.
  Appears in the directory with a neutral "Listed" tag. Zero friction to join.
- **Tier 2 — Verified Business:** adds the registration/tax number (PAN-VAT / EIN /
  company no.), checked against the national registry. Earns the green "Verified
  Business" badge, better directory placement, and is **required to enable paid access**
  (§5.13) — you cannot charge for contact unless verified. This is the incentive that
  makes disclosure worth it, rather than mandatory at the door.
- **Data handling for the registration number (security):** submitted directly to the
  verification check; the raw number is never displayed anywhere in the app (not to
  other members, not in the admin UI) — only the verification *outcome* is shown.
  Encrypted at rest; readable only by the automated verification job and, if ever
  needed, an admin action that is itself audit-logged. Same data-minimization principle
  as personal KYC (§7.2), applied to businesses.

- **A business joins through an authorized person** who verifies their own identity first, then registers the business.
- **KYB:** business name, country of registration (full dropdown), sector (= channel), registration/tax number (Tier 2 only) — checked against the national registry **in parallel** with the rep's verification (never block on paperwork). Invite fast-track: a vouch from a verified member skips any review.
- **Businesses have teams.** A business has a **bio/profile** and affiliated people with roles: **owner, professional, assistant, employee.** **Only the business owner adds/removes team members.** Added employees are **auto-verified under the owner's authority — the owner takes responsibility for them** (no separate KYC per employee); they appear as "verified via [business]." Nobody self-attaches, which prevents false "I work here" claims.
- **Posting rights are per-business.** Each business decides which of its people may post. A post shows the **poster's avatar** — the **business logo** when posted as the business, or the **employee's photo** when posted as themselves.
- **Channels are sector directories of businesses.** Clicking a channel shows the registered **business bios** in that sector; opening a business bio shows its **team** (owners, professionals, assistants, employees), each contactable per the messaging rules.
- **Result:** **Verified Business** badge; business listed in its sector channel + directory.
- **Freelancers/solo:** individuals without a company (Freelancers / Outsourcing) appear as a lightweight solo profile in that channel — no registered entity required.

### 5.4 Profiles
- **Person fields:** name, avatar, role/category, tier, country (US/Nepal), city, bio, verification badge + date, channels, links (LinkedIn/professional).
- **Business fields:** name, logo, sector, country of registration, verified badge, representative(s), offerings/needs (short), location.
- **Badges travel:** the tier/verified badge and country tag appear wherever the profile surfaces (channels, DMs, directory, feed).

### 5.5 Onboarding
Steps: welcome → complete profile (photo, bio, role, location) → choose default view →
read community guidelines (acknowledge) → introduce yourself (optional, posts to a
Welcome context) → suggested channels + members to follow. Default view = US unless
chosen otherwise; preference persists.

### 5.6 Main screen — Feed / Messages toggle
The main screen **toggles between two modes**:
- **Feed (content):** a view-aware stream of vetted content, announcements, and opportunities (RFPs, freight splits, investment calls, events). Verified members/businesses can post; cards show author + role + sector + verified badge + country + timestamp. Unverified = read-only (recommended).
- **Messages:** left rail = **sector channels** + **direct messages**.
  - **Channels (sector directories):** Investment & Policy · Logistics & Supply Chain · Tourism & Hospitality · Tech & AI · Immigration & Legal · Media & Journalism · Entrepreneurs · **Freelancers / Outsourcing**. Clicking a channel shows the registered **businesses** in that sector → open a business to see its **bio + team** (owner / professional / assistant / employee) → message a person.
  - **Direct messages:** 1:1 threads; messaging gated to verified members (recommended).
  - Every person/business shown carries its verified badge + country tag.
- Real-time updates. Report action on content/messages feeds the admin queue.
- **Channels are directories by default; channel owners can add a group discussion.** A **channel owner** runs a sector channel, can enable a **group discussion section** within it, and has their **own group** (a discussion space they control). Where no group is enabled, conversation happens in DMs + Feed.

### 5.7 Member directory
- Searchable list of verified members and businesses.
- Filters: sector, role/category, location (US / Nepal / everywhere), tier, verified-only.
- Cards show name, role, location, short bio, tier badge, country; action = view profile / message.

### 5.8 Feed / opportunity board
- Curated, view-aware feed of vetted announcements and opportunities (RFPs, freight splits, investment calls, events).
- Post cards: author + role + location + tier + country + timestamp; like/reply counts.
- Empty and loading states required.

### 5.9 Events
- List of upcoming events (online + in person), view-tagged.
- Simple RSVP; host + location + date/time + description.

### 5.10 Admin & moderation
- **Review queue:** pending applications and businesses; approve/reject with reason; view submitted verification outcomes.
- **Reports queue:** reported content/members; take action (dismiss, warn, remove).
- **Roles:** member, verified, **business owner/admin, channel owner,** moderator, admin.
- **Audit log:** every verification decision, admission, tier change, and moderation action recorded (actor, action, target, timestamp).

### 5.11 Notifications (was missing — added)
In-app notifications, with email/SMS for key events: new direct message, verification result (approved/failed), **added to a business / team invite received**, RSVP reminders, mentions. Per-type preferences in Profile.

### 5.12 Global search & content creation (was missing — added)
- **Global search** across people, businesses, channels, and content — a top-bar search returning grouped results.
- **Content composer** for the Feed: verified members/businesses post text + media, tagged to a sector/view; unverified = read-only.
- **Team management** (in a business profile): the owner adds/removes members and assigns roles (professional/assistant/employee); **employees are auto-verified under the owner's responsibility** (§5.3), not independently.

### 5.13 Paid access & service pricing (monetization)
Not all businesses are the same — some are **service providers** who charge for access.
- **Opt-in paid access.** A verified business or individual can set an **upfront access price** on their bio to become a paid provider. Common for service categories — **Immigration & Legal, Freelancers, Outsourcing (IT teams/companies), Founders (advisory / pitch access)** — but it's per-provider: each decides whether to charge and how much. **Requires Tier 2 — Verified Business** (§5.3); Tier 1 "Listed" businesses cannot charge for access, which is the incentive to complete registry verification.
- **Paywall on engagement, not browsing.** Anyone verified can see a provider's bio; **paying the upfront fee unlocks contacting and engaging** them. Free-to-contact businesses remain the default.
- **Platform revenue share.** The platform takes a **commission (%)** of each payment; the provider receives the remainder as a payout. (Recommend a fixed rate, e.g. 10–20%.)
- **Payment rails.** Requires **Stripe (US) + a Nepal gateway (eSewa / Khalti / connectIPS)**, provider payouts, and **NRB compliance** on the Nepal side. This makes paid access the platform's first revenue mechanism and pulls part of the transaction layer forward.

---

## 6. Technical specification

### 6.1 Stack (locked — change only via "Breakthrough")
- Frontend: Next.js 15 (App Router) + TypeScript (strict) + Tailwind v4.
- Backend: Next.js API routes or tRPC (decide at implementation; log it).
- Database: PostgreSQL via **Supabase**.
- Auth: **Supabase Auth (locked)** — email/phone + password + Google/Apple SSO; role-based access. One system for auth + data + realtime + storage.
- Real-time: Supabase Realtime (channels + DMs).
- Storage: Supabase Storage + CDN (avatars, business logos; KYC media handled by the provider, not stored raw where avoidable).
- Identity/KYB: Shufti Pro (primary) / ID Analyzer (testing).
- Payments: **Stripe (US) + Nepal gateway (eSewa / Khalti / connectIPS)** — paid access + provider payouts (§5.13).
- Testing: Vitest (unit) + Playwright (E2E).
- Deploy: **Vercel** (frontend/SSR); Supabase (managed backend). Version control: GitHub.

### 6.2 Architecture
- Next.js App Router renders the UI and hosts API routes.
- Supabase provides Postgres (with row-level security for view/tier scoping), Auth, Realtime, and Storage.
- Verification provider integrated server-side; status returned via webhook and stored on the verification record; gating checks read verification/tier before unlocking features.
- Row-Level Security (RLS) enforces: view scoping, tier gating on private channels, and access control on sensitive records.

### 6.3 Data model (core entities)
- **users** — id, name, avatar, **email, phone, oauth_provider (`google`/`apple`/null)** (auth via Supabase Auth), sectors (array of channel slugs), country (`us`/`nepal`), city, bio, links, **verification_status (`unverified`/`verified`)**, special_badge (`diplomat`/null), verified_at, created_at.
- **businesses** — id, name, logo, bio, country_of_registration, sector, registration_number, verification_status, verified_at, owner_user_id, **is_paid_provider (bool), access_price_amount, access_price_currency, payout_account_ref**.
- **business_members** — business_id, user_id, **role (`owner`/`professional`/`assistant`/`employee`)**, status (`invited`/`active`), **can_post (bool)**, **verified_via (`self`/`business`)**, added_by, created_at. *(Owner adds/removes members; employees auto-verified under the owner's responsibility → verified_via=`business`.)*
- **verification_records** — id, subject_type (`user`/`business`), subject_id, provider, document_type, document_country, checks (authenticity/liveness/pep/business_registry + notes), status, reviewer_id, created_at.
- **invites** — id, type (`business_member`/`vouch`), from_user_id, target (email/phone), business_id (nullable), status, expires_at, used_at. *(Used for team invitations and optional fast-track vouches — not a signup gate.)*
- **channels** — id, slug, name, description, sector, **owner_user_id**, **has_group_discussion (bool)**, min_tier, is_private.
- **channel_memberships** — user_id, channel_id, role, joined_at.
- **messages** — id, channel_id (nullable), thread_id (nullable), sender_id, body, created_at.
- **direct_threads** — id, participant_ids.
- **posts** — id, author_id, **posted_as (`user`/`business`), business_id (nullable)**, channel_id, body, view (`us`/`nepal`/`bridge`), created_at. *(Avatar shown = business logo or employee photo per posted_as.)*
- **events** — id, title, date, time, mode (`in_person`/`online`), location, view, description, host_id.
- **rsvps** — user_id, event_id.
- **access_purchases** — id, buyer_user_id, provider_type (`business`/`user`), provider_id, amount, currency, platform_fee, provider_payout, status, created_at. *(Records paid access to a service provider + the platform's revenue share.)*
- **reports** — id, target_type, target_id, reporter_id, reason, status, reviewer_id, created_at.
- **audit_logs** — id, actor_id, action, target_type, target_id, metadata, created_at.

### 6.4 Auth & authorization
- Authenticated session via Supabase Auth.
- Authorization by role (member/moderator/admin) and tier (Community/Professional/Investor/VIP).
- Server-side checks on every mutation; never trust client-claimed tier/role. RLS as the backstop.

### 6.5 Verification integration
- Country-first document selection drives the provider's document flow.
- Provider callbacks (webhooks) update `verification_records` and the subject's `verification_status`; signatures verified.
- KYB: registration number submitted to provider/registry check; parallel to rep KYC; status surfaced to admin queue.

---

## 7. Non-functional requirements

### 7.1 Security
- All mutations server-authorized; RLS on every table.
- No secrets in the repo (`.env.local` + Vercel/Supabase config).
- Webhook signature verification on provider/payment callbacks.
- Rate limits and caps on invites, messages, posts, reports (anti-abuse).

### 7.2 Privacy & data handling
- **Data minimization** for identity data: prefer storing provider verification *outcomes* and references over raw documents/biometrics; where raw media is unavoidable, encrypt at rest and restrict access to admins with audit logging.
- Consent captured at verification; clear privacy policy. Diplomat/investor privacy controls (who can see/contact).
- Right-to-deletion path defined for launch.

### 7.3 Compliance
- **US:** BSA/CIP considerations apply once payments/transactions arrive (Phase 3); for Phase 1 (networking only) identity verification is core but full financial KYC is not yet required.
- **Nepal:** Nepal Rastra Bank (NRB) KYC/AML rules apply to future financial features; FATF/e-KYC considerations.
- **PEP & sanctions screening** for diplomats/officials at onboarding.
- Building on Shufti now means the compliance foundation is ready when transactions start.

### 7.4 Performance & scalability
- Fast first load; realtime latency acceptable for chat; directory/search paginated.
- Modular architecture so Phase 2/3 modules (marketplace, payments, AI) attach without rework.

### 7.5 Accessibility
- WCAG 2.1 AA (see §3.4).

---

## 8. Roadmap (forward-compatible)

- **Phase 1 — Atomic Network (this spec):** open signup + profile verification (KYC/KYB), verified profiles + business-directory channels, Feed/Messages, teams, events, admin, view system. **Paid access (§5.13) is the first monetization layer**, brought in early with minimal payment rails. Goal: a dense, high-trust network that already monetizes expertise.
- **Phase 2 — Utility:** marketplace (verified vendors, listings), trip planner (budget + itinerary), AI co-pilot (matching, warm intros, Nepali↔English translation & summarization).
- **Phase 3 — Transactions:** payments + remittance (Stripe + Nepal gateway, NRB-compliant), affiliate/referral, analytics, content boost.

---

## 9. Success metrics

- **Phase 1:** verified members and businesses onboarded; verification pass rate & time; % applicants approved; channel activity (posts/DMs per active member); directory searches; day-1 intro rate; retention.
- **Later:** GMV (marketplace), transaction volume/fees, chatbot satisfaction/conversion, boost ROI.

---

## 10. Open decisions / what's pending

1. **Deployment accounts.** Deploying to Vercel + Supabase needs the founder's accounts — the one step a chat cannot perform. All build/design happens in-session.
2. **KYC provider commitment.** ID Analyzer (free) for testing → Shufti Pro for launch.
3. **Platform commission rate** for paid access (recommend 10–20%).
4. **Nepal payment gateway** choice (eSewa / Khalti / connectIPS) + NRB compliance path.
5. **Registry coverage for KYB** beyond US/Nepal as membership widens.

*(Resolved: auth = Supabase; unverified access; team attachment; posting; channel structure.)*

*(Resolved: unverified access, team-member attachment, business/posting permissions, channel structure — all locked in §5.)*

---

## 11. Decision log (see CLAUDE.md for full history)

- D-003: Atomic Network pivot — community-first sequencing.
- D-004: Corridor palette; view colors carry country meaning.
- D-006: Architecture = blend (verified profiles + directory + feed as front door; channels + DMs as core).
- D-007: Membership = apply OR invite, then tiered verification + endorsement for VIP/Diplomat.
- D-008: Identity verification = Shufti Pro (primary) + ID Analyzer (testing) + human endorsement layer.
- D-009: Launch anchored to NABIS 2026; segments from the NABIS profile.
- D-010: Business onboarding = person-first + KYB-in-parallel + invite fast-track + two-sided pull; country-first verification with full every-country coverage (hard requirement); Verified Business badge/tier.
- D-011 (2026-07-18): **Signup opened** to standard email/phone + password + Google/Apple SSO; **verification moved into the Profile menu** ("Verify your profile"), not a gate at entry. "What describes you" = sector/channel names. **Channels became sector directories of registered businesses; businesses carry teams** (owner/professional/assistant/employee, invite-only attachment). Main screen **toggles Feed (content) ↔ Messages.** Added **Freelancers / Outsourcing** channel. Added notifications, global search, content composer, team management (previously missing).
- D-012 (2026-07-18): Unverified = **browse-only**; post/message require verification (exclusivity enforced post-signup). **Two verification types: Person and Business.** For a business, **only the owner adds/removes team members; employees are auto-verified under the owner's responsibility** (no per-employee KYC; badged "verified via business"). **Each business configures who can post;** posts show the poster's avatar (business logo or employee photo). **Channels are directories; channel owners can add a group discussion and have their own group.** Added **channel-owner** role.
- D-013 (2026-07-18): **Auth = Supabase (locked).**
- D-014 (2026-07-18): **Paid access & service pricing** — verified providers (Immigration/Legal, Freelancers, Outsourcing IT, Founders, and any service business) can set an upfront access fee; paying unlocks contacting/engaging them; **platform takes a revenue-share commission** (rec. 10–20%). First monetization layer; requires Stripe + Nepal gateway + NRB compliance. GitHub repo for the project: `kcdream0913-hub/NABIS-Project`.
- D-015 (2026-07-20): **Tiered KYB** — registration number is NOT required to join; Tier 1 "Listed" businesses need only name/sector/bio/country. Tier 2 "Verified Business" adds the registry number, is required to enable paid access, and the raw number is never displayed anywhere (encrypted at rest, outcome-only display) — resolves founder security concern about businesses being asked for EIN/tax numbers.
