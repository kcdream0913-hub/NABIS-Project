# BridgeLink Dashboard — IA, Layout & Component Reference

## Sitemap (Phase 1)
/                 Home feed (view-filtered) + quick actions + right rail (xl)
/community        7 sections as tabs; per-section feed + "post here"
/members          Directory: search, location filter, role filter
/events           Chronological list + RSVP
/messages         Two-pane inbox (threads | conversation) — mock delivery
/create           Composer (section + audience selects); ?section= deep link
/profile          Profile edit, default view, notifications, invite link
/onboarding       6 steps; finishing posts the intro to Welcome
/trip-planner     Phase 2 preview (inputs shown disabled)
/marketplace      Locked (Phase 3) → routes to community
/vendor           Locked (Phase 3) → routes to Vendor Showcase

## Layout structure
Desktop: fixed 240px sidebar · 56px topbar + 2px context rail · content max-w-5xl.
Home uses a 1fr/280px split at xl (feed + rail). Mobile: sidebar becomes an overlay
drawer via the topbar hamburger; toggle collapses to short labels.

## The context system (signature)
Country context is the product's core concept, so it is encoded in color everywhere:
- View toggle segments (dot + tint)  - Topbar context rail (2px, active view color)
- Post/member/event chips             - Default-view pickers (profile + onboarding)
US = denim #2B4C8C · Nepal = rhodo #C2412F · Bridge/brand = pine #0F5C55.

## Component inventory
Shell:    AppShell, Sidebar, Topbar, ViewToggle
Content:  PostCard, EventCard, MemberCard, QuickActions (inline on Home),
          EmptyState, Locked
State:    lib/store.tsx (view + localStorage, posts, RSVPs, drawer)
Data:     lib/data.ts (VIEW_META, SECTIONS, MEMBERS, SEED_POSTS, EVENTS, THREADS)
Types:    lib/types.ts (View, Role, Member, Post, EventItem, Section, Thread)

## Phase 1 vs prepared-for-later
Built now: everything above, fully responsive, empty states, a11y focus states.
Prepared: Post.view + Section slugs match the future DB schema; audience select in
the composer anticipates cross-view publishing rules; locked pages already carry the
phase narrative; the store is a drop-in seam for Supabase queries.
Deliberately absent: checkout, listings, payments, KYC flows, real-time delivery.
