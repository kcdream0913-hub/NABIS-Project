# BL-FEEDBACK-01 — where in-app client/business feedback fits, and what to build first

**Hub-authored strategy, 2026-08-04. Recommendation-gated (like D-045), NOT scheduled work.**
Preserved per KC's direction (recorded as D-086). The coding session independently re-queried the
load-bearing facts against prod `dhnggnxwjgqvghbxelvw` on 2026-08-04 and confirmed them (one drift:
**10** accounts have ever signed in, not 9 — does not change the conclusion).

**KC's answers (2026-08-04), which resolve the two open questions below:**
- **"Feedback" = platform feedback from pilot users to KC**, NOT in-app reviews → built as
  **BL-FEEDBACK-02** (`/settings/support` capture; see D-087). In-app reviews (this doc) stay
  **parked behind `inquiries`**.
- **Pilot size = unknown, work to 20–40.** The whole §2 volume argument is sized to the smaller
  number **deliberately** (the small-number plan doesn't break at 200, so it's the safe default);
  revisit Layer 3 only when recruitment numbers are real.

---

## 0. Verdict

Build the feedback *surface* when it's time; **do not build star ratings**. The credible version
of "client feedback" at this size is a written, attested testimonial plus a computed
response-time signal — and the object both hang off, the `inquiries` table, **still does not
exist** (BL-MKT-01 P0, unbuilt). Sequence: **`inquiries` first, testimonials second, stars third
— and stars probably never in the form you're picturing.** Runner-up rejected: ship written
testimonials immediately without `inquiries` — an unattested testimonial is just a post with a
border, and you already have posts.

## 1. What was checked (live, 2026-08-04; coding session re-confirmed)

| | |
|---|---|
| Reviews / ratings table anywhere in prod | none — 0 tables, 0 columns |
| `inquiries` table (BL-MKT-01 P0) | does not exist |
| `offerings` | 1 |
| `access_purchases` — transactions, ever | 0 |
| `reports` rows | 0 (table exists, never used) |
| `businesses` | 16, all `import_source='manual'`, owner-assigned, 10 verified, **0 with a phone** |
| accounts / **ever signed in** | 36 / **10** (hub said 9; most seeded) |

Two arguments the hub discarded after checking: the 16 businesses are NOT Google-imported
(`import_source='manual'`, all owned) → the "reviewing an unclaimed business is defamation"
argument is dead; and the 50 RSVPs are across the seeded cohort → they attest to nothing real.
**What survives: there is not one real client↔business interaction in production to review.**

## 2. Why stars are the wrong instrument at this size

1. **The math needs volume this doesn't have.** Almost all reputation value is in reviews 1–25
   (Livingston: +$20.42 on a $409.96 average, ~5%; nothing beyond); the first negative is
   catastrophic and permanent-feeling (Cabral & Hortaçsu: weekly sales growth +5% → −8% on a
   seller's first negative); ranking on thin data fits noise (Nosko & Tadelis: 0.30 correlation
   between visible score and a better quality measure, *at eBay scale*). With ≤10 possible
   reviewers, every "average" is one person's opinion rendered with a decimal point — false
   precision, worse than an empty state because it looks authoritative.
2. **Nothing to attest to.** A review with no linked inquiry/purchase/booking is exactly as
   verifiable as a Facebook comment — you'd ship your competitor's product with your logo on it.
   Hamro App demonstrates the failure mode live: two of the three reviews on their own App Store
   listing are byte-identical text under different usernames.
3. **🔴 The FTC rule is live enforcement.** The Consumer Reviews and Testimonials Rule is under
   active enforcement — warning letters to ten companies in December 2025 over incentives for
   positive reviews, penalties up to $53,088 per violation. The natural launch move ("ask the 16
   seeded owners to get reviews up", or writing them yourself) is the violation. Any incentive
   must be conditioned on an **honest** review, never a positive one, in the copy — not the intent.
   *(Assumed, to confirm before any solicitation: that the rule reaches a platform soliciting
   reviews for third-party businesses, not just for itself — the conservative reading.)*

## 3. What to build instead — three layers, gated on evidence

- **Layer 1 (ship first): `inquiries` + computed responsiveness.** The one credibility signal
  that needs no transaction history and no reviews: *does this business answer?* Facebook's
  criterion (≥80% answered within an hour) is the low-volume-honest badge. The `inquiries` table
  (BL-MKT-01 §5 P0, incl. `first_response_at` set server-side) gives `response_rate_30d` +
  `median_response_hours` for free. "Typically replies in 4 hours, answers 9 of 10" is a claim
  backed by rows.
- **Layer 2 (at pilot): attested written testimonials, no stars, no aggregate.** LinkedIn
  recommendation, not Yelp review: eligibility is attested (an `inquiries` row that reached
  `closed_won`, or a completed purchase — no inquiry, no testimonial); written + attributed (real
  name + avatar, D-083; no anonymous option — attribution is the anti-fraud mechanism); a 14-day
  cooling window; provider right of reply; **no score/average/sort-by-rating**, newest first.
  Community Notes applies (a takedown path must exist first; `reports` has never been exercised).
- **Layer 3 (only at ≥10 real completed transactions): two-dimension ratings.** Verified-
  transaction-only, two dimensions (accuracy of description, communication), never display an
  aggregate under 3 reviews ("New on Sangamline" until then), never an empty star row.

## 4. Placement (when built)

- **`business/[id]/page.tsx`** — a "Working with them" block **between the header and the team
  section** (credibility above the description). Order: (1) responsiveness chip — omit entirely
  if no inquiries yet, never "no data"; (2) testimonials — newest 3 + "See all N", else "New on
  Sangamline" + verification badge + member-since, never an empty star row; (3) leave-feedback
  CTA — rendered **only** for a viewer with an attested relationship.
- **`people/[id]/page.tsx`** — same component; professionals need it more (an immigration
  lawyer/tax preparer picked from a Facebook comment is the fraud vector).
- **`offerings/[id]/page.tsx`** — responsiveness chip only; testimonials belong to the provider,
  not the listing.
- **Feed (`PostCard.tsx`)** — nothing. A testimonial may generate a notification, never a post.
- **Directory / member cards** — responsiveness chip once it has data; no rating badge ever at
  this size (a card badge is a ranking signal, and §2.1 says you can't rank yet).

## 5. The other reading (what KC actually meant) → BUILT as BL-FEEDBACK-02

Platform feedback from pilot users to KC (Task 0.2): a form on the existing `/settings/support`
route writing to a table (not a silent-failing mailto). ~1 day, needed before the pilot, not
gated on `inquiries`. **This is what KC meant — see D-087 / BL-FEEDBACK-02.**

## 6. The strongest objection, answered

"Hamro App has ratings; without them I look less finished than a 12-week-old solo app." — Their
ratings are farmable and visibly farmed (duplicate text under different usernames on their own
store listing). Matching them means competing at 1/300th their volume with a metric that is noise
at your n, adopting their weakest property as your headline feature. What you have that they don't
is **verification + a moderation system**. "Verified · replies in ~4h · 3 named clients said
this" beats "4.6★ (51 ratings, two copy-pasted)." Where this changes: 200+ real members + 40+
providers weakens §2.1 fast (Layer 3 moves up); and if pilot users say unprompted they won't
trust a business without stars, that beats this reasoning — ask them.

## 7. Sequencing

Reviews need pilot users, and the pre-pilot hard blocker (E2E/prod split) gates onboarding. So
this whole feature is downstream of the baseline dump. Order: **E2E split → BL-MKT-01 P0
`inquiries` → BL-FEEDBACK-01 Layer 2 testimonials (only after `reports` moderation is exercised)
→ Layer 3 ratings (≥10 real transactions).** BL-FEEDBACK-02 (platform feedback, §5) is independent
and built now.

---

**Sources:** Livingston (eBay reputation returns); Cabral & Hortaçsu (first-negative sales
impact); Nosko & Tadelis (score-vs-quality correlation at eBay scale); FTC Consumer Reviews and
Testimonials Rule (Dec 2025 enforcement, $53,088/violation); BL-COMPETE-01 (Hamro App).
