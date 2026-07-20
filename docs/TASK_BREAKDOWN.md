# BridgeLink Project — Detailed Task Breakdown & Execution Plan (v3)

Prabhat | Founder — July 16, 2026
Converted from `BridgeLink_Detailed_Task_Breakdown_Execution_Plan.pdf` (Google Drive)
on 2026-07-16. **This file is the sole source of truth for task IDs, dependencies,
and Definitions of Done** (see CLAUDE.md D-001).

**Document Purpose:** The actionable, drill-down task plan for building BridgeLink v3.
Use alongside `docs/SPEC_v3.md` (single source of truth for features, architecture,
and requirements).

**Execution Approach:** MVP-First + Phased (start narrow: tourism/hospitality focus,
then expand). Agile: 2-week sprints; dual-track for AI (discovery experiments first).
Reference the v3 Spec in every task. Maintain a living task board. Validate with early
pilots (NABIS/Chamber). Tools: GitHub (code/docs), Notion/Linear (tasks), Figma
(design), MLflow/LangSmith (AI experiments).

**Each task has:** Objective, Granular Subtasks, Dependencies, Priority/Effort, Owner,
Tools, Definition of Done, Risks, Notes.

## High-Level Phases Overview (rough timeline — adjust for team)

1. **Phase 0: Foundation & Planning** — 1–2 weeks
2. **Phase 1: MVP Core** (Community + Planner + Basic Marketplace + Basic Safety) — 4–8 weeks
3. **Phase 2: Trust & Safety Layer** (Full KYC + Community Notes System) — 3–6 weeks (parallel possible)
4. **Phase 3: AI Chatbot & Boost Features** (for Paid Users) — 4–8 weeks
5. **Phase 4: Advanced Marketplace & Supply Chain** — ongoing post-MVP
6. **Phase 5: Launch, Marketing & Iteration** — from MVP onward

**Critical Path:** Phase 0 → Phase 1 Core → Phase 2 Safety → Phase 3 (Chatbot + Boost) → Launch.

---

## Phase 0: Foundation & Planning (1–2 Weeks)

**Goal:** Align vision, validate demand, set up infrastructure, and de-risk compliance.

### Task 0.1: Finalize Scope, Vision & Documentation (High Priority)

- **Objective:** Lock MVP boundaries and create living project artifacts.
- **Subtasks:**
  - Review and internalize the v3 Spec (all sections: features, architecture,
    workflows, monetization, KYC, Community Notes, Chatbot, Boost).
  - Define strict MVP scope (e.g., tourism/hospitality vertical + initial products
    like apparel/crafts; core flows only: discover/plan/book/pay/share).
  - Create Project Charter in Notion (vision, success metrics, constraints, team roles).
  - Set up project board (Notion database or Linear) with this task breakdown imported.
  - Create decision log for scope choices.
- **Dependencies:** None. **Priority:** High. **Effort:** 3–5 days.
- **Owner:** Founder (Prabhat) + core team input. **Tools:** v3 Spec, Notion, Google Drive.
- **Definition of Done:** Charter approved; board live with all phases/tasks; scope
  document signed off.
- **Risks:** Scope creep — Mitigation: written freeze date before coding starts.
- **Notes:** Tie every future task back to v3 Spec sections.

### Task 0.2: User & Stakeholder Validation (High Priority)

- **Objective:** Validate problem/solution with real users before building.
- **Subtasks:**
  - Join Greater New York Nepali Chamber of Commerce (membership + networking).
  - Prepare NABIS 2026 outreach materials (use v3 Spec for one-pager/pitch).
  - Conduct 8–12 discovery interviews/pilot conversations with tourism/hospitality
    business owners, diaspora travelers, and potential vendors.
  - Document pain points (planning friction, discovery, payments, trust, content
    needs) and feature priorities.
  - Synthesize feedback into a "User Insights" doc linked to the v3 Spec.
  - Identify 5–10 early pilot partners for MVP testing.
- **Dependencies:** 0.1 (scope clarity). **Priority:** High. **Effort:** 1 week.
- **Owner:** Founder + any available team member. **Tools:** Google Forms/Notion,
  Zoom, v3 Spec.
- **Definition of Done:** Insights document complete; 5+ pilot commitments; feedback
  mapped to features.
- **Risks:** Low response — Mitigation: leverage Chamber events and personal network.
- **Notes:** Focus on KYC friction, chatbot usefulness, and boost value.

### Task 0.3: Technical Audit, Stack Finalization & Infrastructure Setup (High Priority)

- **Objective:** Assess assets and prepare development environment.
- **Subtasks:**
  - Audit existing assets: Parijaat codebase, GitHub repos (patterns from
    Affiliate-Marketing / Vitaltrack), IT/DevOps/AI team skills, content creator network.
  - Finalize tech stack (confirm: frontend, backend Node/Supabase or equivalent, AI
    models for chatbot/recommendations, PostgreSQL with view scoping). See the locked
    stack in CLAUDE.md.
  - Set up GitHub organization/repos (main app, backend services, AI experiments, docs).
  - Initialize project structure (monorepo or modular).
  - Choose and set up task/project management tool (Linear or Notion).
  - Basic CI/CD pipeline skeleton.
- **Dependencies:** 0.1. **Priority:** High. **Effort:** 3–5 days.
- **Owner:** Technical lead / DevOps + Founder. **Tools:** GitHub, existing repos, Notion.
- **Definition of Done:** Repos live; stack decision documented; basic pipeline running.
- **Risks:** Integration complexity — Mitigation: start modular.
- **Notes:** Leverage AI/DevOps strengths for chatbot and moderation components.

### Task 0.4: Legal, Compliance & KYC Provider Research (High Priority)

- **Objective:** De-risk regulatory aspects early.
- **Subtasks:**
  - Research US KYC/AML requirements (BSA/CIP for platforms handling payments/transactions).
  - Research Nepal requirements (NRB AML Act, e-KYC, FATF considerations).
  - Shortlist KYC providers (Jumio, Sumsub, Onfido/Entrust, Veriff, Persona, Trulioo) —
    evaluate coverage for US + Nepal, pricing, integration ease, privacy.
  - Outline high-level compliance plan (tiered KYC, record-keeping, STR processes).
  - Engage lawyer for platform terms of service, privacy policy, and KYC flow review.
  - Document findings in the Compliance section of project Notion (and `docs/research/`).
- **Dependencies:** None (can start in parallel). **Priority:** High. **Effort:** 4–7 days.
- **Owner:** Founder + legal/compliance support. **Tools:** Web research, provider
  demos, lawyer.
- **Definition of Done:** Provider shortlist + integration plan; legal review initiated.
- **Risks:** Regulatory changes — Mitigation: choose flexible providers; phased rollout.
- **Notes:** Full KYC integration is Phase 2; start research now.

### Task 0.5: Team Roles, Communication & Tooling Setup (Medium Priority)

- **Objective:** Establish clear ownership and workflows.
- **Subtasks:**
  - Define roles (Founder: Vision/Product; Tech Lead: Architecture/Dev; AI Specialist:
    Chatbot/Recommendations/Moderation AI; Designer: UX/UI; Ops: Compliance/Moderation).
  - Set up communication (Slack/Discord channels: #general, #dev, #ai-experiments,
    #content-community, #safety-kyc).
  - Create RACI matrix for major areas.
  - Set up design tool (Figma) and shared assets.
- **Dependencies:** 0.3. **Priority:** Medium. **Effort:** 2 days. **Owner:** Founder.
- **Tools:** Slack, Figma, Notion.
- **Definition of Done:** Roles documented; channels active; first team sync held.

---

## Phase 1: MVP Core Build (Community + Planner + Basic Marketplace + Basic Safety) — 4–8 Weeks

**Goal:** A functional MVP where users can join the community, plan simple trips,
discover/book basic experiences/products, and have basic safety.

### Task 1.1: Country Separation & Core Navigation (High Priority)

- **Objective:** Implement US/Nepal/Bridge views with filtering.
- **Subtasks:**
  - Design and implement persistent view toggle (UI/UX in Figma first).
  - Backend: tag content/listings/users with view (US/Nepal/Bridge) and filtering logic.
  - Frontend: adaptive feeds, search, and recommendations based on current view.
  - "Explore other view" prompts and seamless switching.
  - Testing: cross-view consistency.
- **Dependencies:** Phase 0 infrastructure. **Priority:** High. **Effort:** 1–2 weeks.
- **Owner:** Frontend + Backend devs. **Tools:** Figma, app framework, Supabase/PostgreSQL.
- **Definition of Done:** Toggle works; content filters correctly; basic E2E tests pass.
- **Risks:** Over-engineering — Mitigation: start simple (tags + queries).
- **Notes:** See Spec §Country-Aware Navigation.

### Task 1.2: Community Hub — Core Sections (High Priority)

- **Objective:** Build engaging community features.
- **Subtasks:**
  - Activity Feed: post creation (text + rich media), display, likes/comments/shares.
  - Content Studio: upload/edit photos/videos/stories/reels; basic editing tools; tagging.
  - Groups & Discussions: create/join groups; threaded discussions/forums.
  - Basic Events: calendar view, RSVPs.
  - Connections & Messaging: follow, direct/group chat (basic).
  - Basic moderation hooks (reporting).
- **Dependencies:** 1.1 (views). **Priority:** High. **Effort:** 2–3 weeks.
- **Owner:** Full-stack team. **Tools:** Supabase Realtime for feed/chat; Storage for media.
- **Definition of Done:** Users can post, interact in feed/groups, and message; basic
  safety reporting works.
- **Risks:** Engagement low — Mitigation: seed with pilot content/creators.
- **Notes:** Deep integration with Content Creation (see Spec).

### Task 1.3: Smart Trip Planner MVP (High Priority)

- **Objective:** Core planning tool with recommendations.
- **Subtasks:**
  - Planner UI: inputs (dates, budget, interests, group size, view).
  - Budget estimator with breakdowns.
  - Basic recommendations engine (rule-based initially, pulling from marketplace/content).
  - Add-to-itinerary and simple booking hooks.
  - Shareable itineraries (basic collaboration).
- **Dependencies:** 1.1, 1.4 (marketplace data). **Priority:** High. **Effort:** 2 weeks.
- **Owner:** Backend (recommendations) + Frontend. **Tools:** AI for later enhancement;
  current data from marketplace.
- **Definition of Done:** Users can build and share a basic itinerary with recommendations.
- **Risks:** Recommendation quality — Mitigation: rule-based + manual curation for MVP.
- **Notes:** Will integrate with Chatbot in Phase 3.

### Task 1.4: Basic Marketplace & Vendor Onboarding (High Priority)

- **Objective:** Allow vendors to list and users to discover/book.
- **Subtasks:**
  - Vendor registration & basic profile.
  - Listing creation (experiences + initial products): title, description, media,
    pricing, availability.
  - Buyer discovery: search, filters (view-aware), detail pages with reviews.
  - Simple booking/purchase flow + basic payments integration.
  - Basic order confirmation and notifications.
- **Dependencies:** 1.1, payments setup from Phase 0. **Priority:** High. **Effort:** 2–3 weeks.
- **Owner:** Marketplace-focused devs. **Tools:** Payment gateway (Stripe + Nepal partner).
- **Definition of Done:** End-to-end flow: vendor lists → user discovers/books →
  payment processes.
- **Risks:** Low initial supply — Mitigation: onboard pilot vendors manually.
- **Notes:** Foundation for Supply Chain (Phase 4) and Boost (Phase 3). See Spec §Marketplace.

### Task 1.5: Basic Safety & Moderation MVP (High Priority)

- **Objective:** Foundational trust layer.
- **Subtasks:**
  - Basic user reporting for content/listings.
  - Simple AI spam/fraud detection (initial rules or lightweight model).
  - Basic reputation scoring (e.g., based on activity/verification).
  - Admin/moderation dashboard for review.
- **Dependencies:** Phase 0 compliance research. **Priority:** High. **Effort:** 1–2 weeks.
- **Owner:** Backend + AI specialist. **Tools:** AI models for detection.
- **Definition of Done:** Reporting works; obvious spam is caught; basic admin tools available.
- **Risks:** False positives — Mitigation: human review queue.
- **Notes:** Expanded in Phase 2 to the full Community Notes system.

---

## Phase 2: Trust & Safety Layer (3–6 Weeks, Overlap with Phase 1)

**Goal:** Robust KYC and advanced moderation to enable safe paid features and
high-trust transactions.

### Task 2.1: Tiered KYC Verification System (High Priority)

- **Objective:** Compliant, tiered identity verification.
- **Subtasks:**
  - Integrate chosen KYC provider API(s) (document upload + biometric flows).
  - Build tiered logic: Basic (email/phone) for free; Full KYC (docs + biometrics +
    screening) for paid plans, vendors, high-value transactions.
  - UI flows for verification (guided, in-app).
  - Backend: status tracking, approval workflows, record storage (compliance).
  - Gating: unlock paid features/chatbot/boosts/vending upon verification.
  - Testing: US and Nepal document types; edge cases (rejections, appeals).
  - Privacy: data minimization and consent flows.
- **Dependencies:** 0.4 (provider choice); Phase 1 basic auth. **Priority:** High.
  **Effort:** 2–4 weeks.
- **Owner:** Backend + Compliance specialist. **Tools:** KYC provider SDKs; secure storage.
- **Definition of Done:** Users can complete KYC; tiers enforce correctly; compliance
  audit trail exists.
- **Risks:** User drop-off — Mitigation: clear value communication ("Unlock chatbot &
  boosts"); fast approval.
- **Notes:** Critical for safety in paid features and transactions. See Spec §KYC.
  Research: US BSA/CIP, Nepal NRB requirements.

### Task 2.2: Community Notes-Style Moderation & Reputation System (High Priority)

- **Objective:** Crowdsourced + AI + human safety layer.
- **Subtasks:**
  - UI for proposing "Notes" or flags on posts, listings, reviews, transactions.
  - Rating system for notes (helpful/not).
  - Bridging algorithm implementation (notes visible only with cross-perspective agreement).
  - Contributor reputation scoring (based on helpfulness across diverse raters).
  - Eligibility gates (verified accounts for contributors).
  - AI layer: pattern detection for coordinated abuse, spam, fake reviews, fraud signals.
  - Human review queue + escalation for high-severity items.
  - Apply across content, marketplace listings/reviews, and transactions.
  - Transparency: public guidelines; appeal process.
  - Analytics: moderation metrics, false positive rates.
- **Dependencies:** Phase 1 core content/marketplace; 2.1 (KYC for trusted contributors).
  **Priority:** High. **Effort:** 2–3 weeks.
- **Owner:** AI/Backend specialist + moderation team. **Tools:** Custom algorithm or
  open-source inspiration from X Community Notes; AI models.
- **Definition of Done:** Notes system functional; reputation impacts visibility; AI
  assists detection; high-severity items escalated.
- **Risks:** Manipulation or low participation — Mitigation: strong eligibility +
  reputation; seed with trusted users.
- **Notes:** Inspired by X Community Notes (bridging, reputation). Critical for
  preventing fraud/abuse in marketplace and content. See Spec §Safety.

---

## Phase 3: AI Chatbot & Boost Features (4–8 Weeks)

**Goal:** Premium AI assistance and visibility tools for paid users.

### Task 3.1: Dedicated AI Chatbot Assistant (High Priority)

- **Objective:** Intelligent, context-aware assistant for paid users.
- **Subtasks:**
  - Define detailed capabilities & prompts (trip planning, recommendations, content
    ideas, vendor ops, safety/KYC guidance) — map to the v3 Spec.
  - Architecture: chat service with conversation history; RAG (retrieval from platform
    data: marketplace, content, user profile, planner).
  - Integration: frontend chat UI (persistent for paid users); backend hooks to
    planner/marketplace/actions.
  - Personalization: context from current view, profile, history, KYC status.
  - Quality: prompt engineering, evals (target >70–80% helpfulness), hallucination
    mitigation, escalation to human.
  - Gating: full access for paid tiers; usage limits or unlimited in higher tiers.
  - Analytics: usage, satisfaction, conversion impact (e.g., bookings from recommendations).
  - Testing: various query types, edge cases, multilingual (English/Nepali priority).
  - Deployment: scalable inference; monitoring.
- **Dependencies:** Phase 1 (data sources); Phase 2 (KYC context); AI team readiness.
  **Priority:** High. **Effort:** 3–5 weeks (including tuning).
- **Owner:** AI specialist + Full-stack. **Tools:** LangChain/LangGraph or equivalent;
  chosen models; evaluation frameworks.
- **Definition of Done:** Chatbot responds helpfully in context; integrated with key
  flows; gated correctly; positive pilot feedback.
- **Risks:** Quality issues — Mitigation: RAG + evals + human escalation; iterative tuning.
- **Notes:** Major paid-user value driver. See Spec §Chatbot. Research: RAG for
  accuracy; multi-agent patterns for complex queries.

### Task 3.2: Content Boost Feature (High Priority)

- **Objective:** 24-hour visibility amplification for paid users' content.
- **Subtasks:**
  - Pricing & packaging: tiered options (standard vs. premium reach); discounts for
    higher subscriptions.
  - Purchase flow: in-app from content creation or dashboard; payment integration.
  - Boost Engine: algorithmic prioritization (visibility multiplier in
    feeds/recommendations within view); 24h timer.
  - Analytics: performance dashboard (impressions, engagement, downstream actions
    like bookings/sales).
  - Fair use: limits per user/time, cooldowns.
  - Transparency: clear labeling of boosted content where appropriate.
  - Integration: with Content Studio, Marketplace listings, and Community Notes
    (boosted items still moderated).
  - A/B testing: impact on overall engagement.
- **Dependencies:** Phase 1 content/marketplace; Phase 2 moderation. **Priority:** High.
  **Effort:** 2–3 weeks.
- **Owner:** Backend (algorithm) + Frontend + Billing. **Tools:** Recommendation engine
  updates; billing system.
- **Definition of Done:** Users can purchase/activate boosts; visibility increases
  measurably; analytics available; moderation applies.
- **Risks:** Perceived unfairness or spam — Mitigation: limits + labeling + strong moderation.
- **Notes:** New monetization + engagement tool. See Spec §Boost.

---

## Phase 4: Advanced Marketplace & Supply Chain (Ongoing, Post-MVP)

### Task 4.1: Vendor Dashboard & Operations Tools (Medium-High Priority)

- **Subtasks:** Advanced inventory sync, order management with tracking, fulfillment
  options, detailed analytics, AI-assisted suggestions (via chatbot integration).
- **Dependencies:** Phase 1 marketplace.

### Task 4.2: Supply Chain Enhancements (Medium Priority)

- **Subtasks:** Logistics coordination options, basic routing, potential 3PL integrations.
- **Dependencies:** 4.1.

---

## Phase 5: Launch, Marketing & Iteration (From MVP Onward)

### Task 5.1: MVP Launch Preparation (High Priority)

- **Subtasks:** Beta with pilots; bug/performance fixes; onboarding polish; monitoring setup.
- **Dependencies:** Phase 3.

### Task 5.2: Marketing & Go-to-Market Execution (High Priority)

- **Subtasks:** Chamber/NABIS activation using v3 Spec; content marketing via
  creators; affiliate launch; paid acquisition testing.
- **Dependencies:** MVP ready.

### Task 5.3: Full Monetization & Growth Features (High Priority)

- **Subtasks:** Complete subscription flows, boost sales optimization, affiliate
  payouts at scale.
- **Dependencies:** Phase 3.

### Task 5.4: Continuous Improvement (Ongoing)

- **Subtasks:** User feedback loops, A/B tests, feature expansion based on data and
  the v3 Spec roadmap.

---

## Cross-Cutting & Supporting Tasks

- **Task C.1: Design System & UX Polish (High Priority, Parallel)** — Figma design
  system; wireframes for all major flows (chatbot, boost, KYC, vendor dashboard);
  usability testing.
- **Task C.2: Payments & Billing Infrastructure (High Priority)** — full gateway
  integrations; subscription management; boost/checkout flows; payout automation.
- **Task C.3: Analytics, Monitoring & Admin Tools (Medium-High Priority)** — key
  metrics dashboards (user growth, engagement, GMV, moderation stats, chatbot usage);
  admin tools for KYC/moderation.
- **Task C.4: Documentation & Knowledge Base (Medium Priority, Ongoing)** —
  user-facing help/docs; internal runbooks; update the v3 Spec as features evolve.
- **Task C.5: Security, Compliance & Auditing (High Priority, Ongoing)** — regular
  audits; penetration testing; compliance reporting for KYC/AML.

## Dependencies, Critical Path & Sequencing Notes

- **Strong dependencies:** Safety (Phase 2) before advanced paid features (Phase 3);
  core data (Phase 1) before AI/Chatbot quality.
- **Parallel work:** Design + validation can run early; backend services modularized.
- **Critical path:** 0 → 1 Core → 2 Safety → 3 Chatbot/Boost → Launch.
- Use critical path method in the project tool to track.

## Recommended Processes & Best Practices

- **Sprints & ceremonies:** planning, daily standups, retrospectives; scope freeze 1
  week before sprint.
- **AI-specific:** experiment tracking; eval-driven development; thin AI slices for
  quick validation.
- **Quality:** Definition of Done includes tests, documentation, and spec alignment.
- **Communication:** weekly cross-team sync referencing this plan + the v3 Spec.
- **Memory/context:** always link tasks to v3 Spec sections; use decision logs.

## Risk Register (Summary)

- Scope creep → strict freezes + MVP focus.
- AI quality (chatbot) → early evals + RAG + human escalation.
- User adoption of KYC → clear value + smooth UX.
- Moderation manipulation → strong eligibility + bridging + monitoring (as in
  Community Notes research).
- Compliance delays → early legal/KYC provider engagement.

## Immediate Next Steps (Start This Week)

1. Import this task breakdown into the project management tool.
2. Complete Phase 0 tasks (especially validation and KYC research).
3. Set up the first sprint focused on Task 1.1 or 1.2.
4. Schedule team kickoff referencing the v3 Spec.
5. Begin NABIS outreach.

**Success Metrics Overall:** user growth/retention, paid conversion, GMV through
marketplace, engagement (content + community), moderation effectiveness, chatbot
satisfaction/impact, boost ROI.

*End of Detailed Task Breakdown. Update as the project evolves.*
