# BridgeLink — Approved Phase 1 Scope (Atomic Network)

Approved by founder 2026-07-17. This document governs current sequencing.

## Sequencing strategy
1. **Phase 1 — Atomic Network (Community first)** ← we are here
2. Phase 2 — Utility layer (Trip Planner + content)
3. Phase 3 — Transaction layer (Marketplace + payments)

## Phase 1 goal
A high-signal, invite-only professional community for Nepali business owners (Nepal +
US), entrepreneurs, investors, and serious diaspora members interested in travel,
business, and collaboration.

## Design principles
Clean, professional, trustworthy (not flashy social). Mobile-responsive. High
information density without clutter. Strong hierarchy. Clear country context at all
times (US / Nepal / Bridge). Minimal friction for busy professionals.

## Global elements
- **Sidebar:** Home/Feed, Community, Members, Events, Messages, Create Post; Trip
  Planner (secondary), Vendor Dashboard (locked), Marketplace (locked); profile +
  settings at bottom.
- **Topbar:** prominent functional view toggle (US | Nepal | Bridge), global search,
  notifications, AI Assistant (disabled in Phase 1).
- **View logic:** switching updates feed label + filters content; default US View.

## Phase 1 pages
A. Home/Feed — personalized per view; post cards (author, role, location, time);
quick actions; clean empty states.
B. Community — sections: Welcome, Business Opportunities, Travel Plans, Vendor
Showcase, Events, Ask the Network, Resources; post into a chosen section.
C. Members directory — search + filters (location US/Nepal, role); cards with name,
role, location, short bio.
D. Events — upcoming online + offline; simple RSVP.
E. Create Post — clean composer; choose section; text + images.
F. Profile & Settings — edit profile; default view; notification prefs; invite link.
G. Onboarding — welcome → profile → choose view → guidelines → introduce yourself →
suggested members/sections.

## Constraints
No marketplace or payments yet. Trip Planner secondary/coming-soon. Community must
feel exclusive, professional, useful. Clarity over visual complexity.

## Tech
Next.js 15 (App Router) + TypeScript + Tailwind. Clean component architecture,
expandable to Phases 2–3. Proper empty/loading states, responsive. Teal/green
primary (refined into the corridor palette — see CLAUDE.md D-004).
