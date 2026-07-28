# BL-STRATEGY-04 — Referral & Partner Program

**Date:** 2026-07-28 · **Status:** strategy, not scheduled · **Owner:** hub
**Research basis:** two parallel research sweeps (mechanics/benchmarks/fraud/tooling; marketplace/diaspora/cross-border compliance), July 2026. Every load-bearing number below is sourced. Where evidence is thin, it says so.

> Ratified as **D-045** (see CLAUDE.md decision log). This is the full sourced
> handoff, preserved in-repo so the eventual build session has the reasoning, not
> just the one-line decision. Strategy only — nothing here is scheduled work.

---

## The recommendation, first

**Build a member referral program that pays in platform entitlements — never cash — and do not launch it until you have 100–200 genuinely active users. Defer the vendor/affiliate cash program entirely until partners exist who would earn real money.**

Three things drive that, in order of strength:

**1. Cash to Nepal is effectively blocked, and this decides the whole design.** Stripe Connect cross-border payouts do not support Nepal — the supported set is US, UK, EEA, Canada, Switzerland, and Nepal is absent from the country minimums table too. PayPal Payouts does not list Nepal, and PayPal is not operational in Nepal for *receiving* at all. Tremendous reaches Nepal by no verified method. Wise is the one rail that positively verifies — US→NPR, individual bank accounts only, explicitly *not* to businesses in Nepal, 1,000,000 NPR per transfer — but whether the Wise Business API supports NPR as a programmatic payout currency is unverified and is the single question to answer in writing before anyone designs around it.

On top of that, Nepal's Foreign Exchange (Regulation) Act requires individuals to be licensed to deal in foreign exchange, with penalties up to three times the amount and up to three years' imprisonment above Rs 10 million — and a replacement bill introduced 13 July 2026 explicitly prohibits value transfer "through channels other than recognized institutions" and bans crypto/stablecoin rails. The law is tightening, not loosening, right now.

The tell that this is the right read: **Remitly — a company whose entire business is moving cash across borders — pays its referral rewards in transfer credit, not cash.** Faire pays cash to its supply side and non-redeemable credit to its demand side. These are not accidents.

**2. Because the reward is an entitlement, the expensive half of the build disappears.** For a feature-unlock product, "reward" means writing a `paid_until` timestamp and a boost-credit row. There is no money movement, so there is no payout rail, no W-9/W-8BEN collection, no 1099 filing, no FX exposure, and no NRB question. That collapses the build-vs-buy analysis: the genuinely hard parts of a referral system — commission accounting against subscription lifecycle, mass payouts, tax forms — are structurally absent. What remains (code generation, link routing, server-side attribution capture, vesting rules, velocity caps, a review queue) is roughly 2–3 engineer-weeks on infrastructure BridgeLink already has.

**3. Launching now would mostly buy users you were going to get free.** The US Nepali diaspora is 185,000–215,000 people, 68.3% arrived post-2010, and it is densely networked through hometown associations and the NRNA. Andrew Chen's cannibalization argument bites hardest exactly here: in a small, tight network where most members will hear about you through existing social ties regardless, referral bounties disproportionately pay for adoption that was already coming, and they pull in "a different type of marginal user… less qualified, more discount seeking," with LTV and engagement often half as good. Ambassador-program practitioners put the prerequisite at 100–200 active members before launch, and launching below that is the dominant documented failure mode.

**Runner-up, and why it lost:** buy GrowSurf or Referral Factory now and ship in a week. It loses on two counts. GrowSurf does not list Stripe among its integrations at all — its story is Zapier/webhooks/Tango Card — and Referral Factory touches Stripe only to create customers and issue coupons, reading no subscription events. So the tool you'd be renting at $179–200/month does not integrate with the system your entitlements live in, and you'd still be writing the entitlement grant yourself. You would be paying to rent the easy part.

---

## Design, when you do build it

### Layer 1 — Member referral (build in-house)

**Asymmetric, not symmetric.** The strongest replicated finding in the literature is that pro-social schemes beat selfish ones, and that the entire lift comes from the *recipient* leg — pro-social schemes "significantly increase the invitee's likelihood to accept referrals" (Bapna, Jung, Gupta & Sen, *JMIS* 38(1) 2021; independently in Gershon, Cryder & John, *JMR* 57(1) 2020). Symmetric "give a month, get a month" is therefore the worst available shape for a freemium product: half the budget lands on the leg that generates the lift, and lands there as something the recipient could nearly get by just signing up for the free tier.

So: **the referee gets the larger, certain, clearly-better-than-free-trial reward** — 60 days of full paid tier plus a boost credit, legible as "your friend got you this." **The referrer gets a smaller expected value delivered with uncertainty** — a guaranteed month plus, say, a 10% chance of six months or a large boost pack. That last mechanic is the one recent, well-powered result available: in a 162,266-user factorial experiment, making the *sender's* reward uncertain raised total referrals 20.9% and the odds of a successful referral 66.7%, while making the *recipient's* reward uncertain cut successful-referral odds 37.3% (Belo et al., forthcoming *Management Science*). Gamble on the referrer's side; never on the referee's.

**Never cash at this layer.** Beyond the Nepal problem, monetary rewards underperform in-kind ones because cash "introduces economic considerations into social relationships" and makes the referee question the referrer's motives (Jin & Huang, *IJRM* 31(1) 2014). In a diaspora product where referrals travel along real family and community ties, that effect should be stronger than baseline, not weaker.

**Honest caveat, and it matters:** subscription-time-as-reward has, as far as the research could establish, *no* controlled study behind it. Every claim traces to Dropbox retrospectives and vendor blogs. The recommendation above is inference from the cash-vs-in-kind and recipient-vs-sender literature. It is the highest-value A/B test available once there is traffic to test on.

### Layer 2 — Vendor / partner (defer, then buy)

Vendors bringing their own customer base is a commercial relationship, not a member referral, and it needs different fraud posture, different terms, and different rails. Faire is the closest structural analogue and its design transfers directly: an activation bounty plus a per-order bounty during a bounded accrual window, hard-capped — and **different currency to different sides**, cash to supply, credit to demand.

For BridgeLink the cross-border constraint forces a variant: **Nepal-side vendors get commission holidays, not cash** — "0% platform commission on your first N orders," or waived subscription months. That is not a payment, not a remittance, not FX, and not reportable. Cash is reserved for US-side commercial affiliates where the rail is trivial and the 2026 1099-NEC/MISC threshold sits at $2,000 (raised from $600 by the One Big Beautiful Bill Act, effective for payments made in 2026 — worth confirming with an accountant against an IRS primary page).

Rate benchmarks, reconciled across two disagreeing vendor datasets: 20% is the median for B2B SaaS, 15% for B2C SaaS, 10% for marketplaces and fintech. Rewardful's 30% figure comes from a customer base skewing to high-gross-margin pure SaaS. **For BridgeLink, 20% recurring for 12 months on subscription revenue and 10% one-time on marketplace GMV is the defensible starting point** — 60-day first-touch cookie, dropping to 14 days for any coupon or deal traffic. First-touch matters: the Honey dismissal (Nov 2025) established that courts will not police last-click attribution hijacking, and the Phia suspension (July 2026) established that networks will. First-touch plus server-side conversion capture is the structural defense.

When you do buy, **buy the one that files tax forms.** Tolt Growth ($99/mo) and Dub Partners Business ($90/mo) are the only two at this price point that collect W-9/W-8 *and* file 1099s. Rewardful — the category default, and the best Stripe data integration by some distance — does not mention tax forms anywhere on its pricing page and its managed-payouts FAQ never names W-9, W-8BEN, or 1099 filing. That is a real switching cost discovered late. But do not buy any of it at zero affiliates; it is $1,200/year of nothing.

### Ambassador layer — the cheapest thing here, and probably the first thing

Airbnb's Local Host Clubs are explicitly volunteer with no monetary compensation. What leaders get is early access to features and policy, exclusive feedback channels, professional development, a global peer network — and, most usefully, **local data insights they can share with their own groups**. That last one converts platform data into social capital the ambassador spends in their own community, at zero marginal cost to you. Notion's ambassador program reached 200+ ambassadors across 23 countries on swag, closed channels, AMAs, and recognition — no cash, no credits, no tiers.

For BridgeLink the natural counterparties are not individuals but **hometown associations and NRNA chapters**, which already have leadership, treasuries, and meeting cadences. That is a partner conversation, not a referral link.

Two failure modes to design against. First, **do not staff ambassadors and Community Notes moderators from the same pool** — volunteer moderator burnout is empirically documented, driven by interpersonal conflict among moderators, time constraints, and daily toxicity exposure, with researchers comparing the psychological load to crisis-hotline volunteering. People doing both burn out roughly twice as fast. Second, **the risk is not that ambassadors quit, it is that they coordinate** — the 2023 Reddit blackout is the canonical case, and Airbnb host forums already carry "asking for more free labour" sentiment about expanded community-leader asks.

---

## Fraud controls — where BridgeLink's existing KYC is the asset

**Gate the payout behind full KYC, not the participation.** Anyone can share a link; the reward vests only for a fully-verified referrer whose status is re-validated *at vest time*, not trusted from signup. Kraken's implementation is the reference — rewards require the account to be "active, verified, and in good standing at the time of issuance," with a document-country match requirement. This costs nothing (the tier system exists), adds zero friction to the sharing loop, and attacks the attacker's unit economics directly. The practical constraint will be document coverage and pass rates for Nepali IDs, not the policy.

**Vest on the second or third meaningful action, not the first.** Stripe's own guidance is to tie payout to the second or third purchase. Revolut's design is instructive for what it *excludes* from qualifying activity — currency exchange, internal transfers, gambling, gift cards — because those are the transaction types that are cheap to fake and reversible. Airbnb's host referral gates on a published listing plus a completed booking above a $100 minimum, not cancelled by either party at any time. The anti-gaming design lives in the qualification conditions, not the reward amount.

**The cheapest high-precision control you already have: the Stripe card fingerprint.** It is stable across a PAN regardless of which PaymentMethod wraps it, so the same fingerprint on referrer and referee is near-dispositive for self-referral, and it costs one join. Route to review rather than auto-block — family card-sharing is real in this user base.

**🔴 The calibration trap that would actually hurt you.** Roughly one in five identification events involved a VPN in 2025 (one in three on desktop Chromium). For a Nepal–US diaspora product, Nepali users sit behind carrier-grade NAT and families genuinely share devices, addresses, and payment cards. **IP and device collision must be a clustering weight feeding a review queue, never a blocking rule** — a naive "block on IP collision" would flag a large fraction of legitimate users. Any graph-density scoring needs a community-adjusted baseline. Buy the fraud *signals* if needed; write the *rules* yourself, because no vendor default is calibrated for this population.

Two operational notes: your review SLA must be shorter than your payout cycle, or held items miss the cycle and need manual intervention. And **publish your terms, not your thresholds** — both PartnerStack and Rewardful decline to publish their threat models, correctly.

---

## What to expect — and what not to believe

There is no independent, current, representative benchmark dataset for referral program performance. The top-ranking "2026 referral statistics" pages attribute figures to OpenView, McKinsey, and ProfitWell with no dates, no links, and no methodology, and several of those organizations no longer publish in the area. The widely-quoted "referred customers convert 3–5× better" (attributed to McKinsey) could not be traced to an original — do not cite it.

The two figures with real denominators behind them: **2.35%** average referral rate across thousands of ecommerce stores with 6+ months live (4.75% for the software/digital-goods subset), and **23.1%** of users acquired via referral in a 162,266-user telco app census with an aggressive points economy. They measure different things in different categories. Note that the ecommerce benchmark includes only merchants surviving six months — programs killed at month two are invisible, as is every company that never launched.

**Planning number: 2–8% of new signups from referrals in the first two quarters.** Anything above 15% is a tail outcome requiring the referral loop to be structurally central to the business. Lenny Rachitsky's "15–50% for marketplaces" is explicitly conditioned on "companies where referrals work best" — that is the survivorship filter stated honestly.

For participation, the usable model is roughly 10% of active users ever *share*, ~4% ever produce a *successful* referral, and average direct referrals per user ≈ 0.183. That last number is the one to internalize: **average referrals per user is well under one, so the viral coefficient of a referral program is essentially always below one.** This is a CAC-reduction channel, not a growth engine.

One counterintuitive finding worth weighting up because it is a vendor undermining its own pitch: Rewardful, across 2,600+ programs, found no clear correlation between payout size and campaign performance, and concluded the most successful campaigns weren't those paying the most. Airbnb independently found that doubling referral bonuses in some markets "occasionally didn't make a big dent."

---

## The strongest objection to all of this

*If referral programs have a viral coefficient below one and mostly cannibalize organic growth in a dense network, why build one at all?*

It holds partially, and the answer is that the mechanism worth building is not the bounty. It is **attribution and instrumentation**. The diaspora referral channel already exists — migrant networks exchange "information, money, persuasion, influence, and aid" through pre-existing ties, and members minimize risk by moving toward places where they already know someone. You are not creating that channel; you are instrumenting it. Knowing which users, which hometown associations, and which vendors actually drive signups is worth building even if the reward attached to it turns out to be worth little. That argues for building the attribution layer early and cheap, and holding the incentive economics until there is a user base to test on — which is exactly the sequencing above.

Where this recommendation would be wrong: if a small number of high-volume vendor partners turn out to drive most marketplace supply, the vendor-affiliate layer becomes urgent well before the 100–200 active member threshold, and the sequencing inverts. Affiliate programs are extreme power laws — top 1% of affiliates ≈ 34% of revenue, top 10% ≈ 71%, bottom 50% ≈ 2%. Watch for that shape in the pilot; if it appears, this doc's ordering is the thing to revisit first.

---

## Open questions that need a human, not a search

1. **Does Wise Business / Wise Platform support NPR as a programmatic API payout currency?** The consumer page confirms US→Nepal individual transfers and the business-restrictions page confirms business-originated funds may reach Nepali individuals, but neither confirms API batch payout support. Get this in writing before any cash design. *(Only matters if cash is ever reintroduced — the recommendation above avoids it.)*
2. **Is a referral bounty paid to a Nepali individual US-source income?** The "services performed abroad ⇒ no withholding" analysis is well-sourced but addresses *compensation for services*. A referral reward may instead be characterized as a prize, other income, or a purchase-price adjustment — and the characterization determines sourcing, which determines whether 30% withholding applies. **CPA question, in writing.**
3. **Do Nepali individuals need NRB authorization to receive recurring foreign commission income?** Personal remittance from family and commission income from a foreign company are plausibly different transaction types under the FX Act. No NRB circular was accessible. **Nepali counsel question.**
4. **Would BridgeLink paying Nepali vendors commissions make it an unlicensed payment operator under the pending July 2026 bill?** Same counsel.
5. **FTC exposure on Boost, independent of the referral program.** Under the 2023 Endorsement Guides, affiliate fees are permissible with adequate disclosure, but paid *rankings* are treated as deceptive even when disclosed. Boost raises ranking in exchange for payment. Get counsel on how it is labeled. Separately, the Consumer Reviews & Testimonials Rule is under live enforcement — the FTC sent warning letters to ten companies in December 2025 specifically over incentives offered for *positive* reviews, with penalties up to $53,088 per violation. **Direct read-across to Community Notes: any reward must be conditioned on an honest rating, never a positive one.**

---

## Decision record

**D-045.** Referral and partner program adopted as strategy, not scheduled work. Rewards are platform entitlements (subscription time, boost credits, commission holidays), never cash — driven primarily by verified cross-border payout and Nepal FX constraints, secondarily by fraud economics and the in-kind conversion literature. Member referral is built in-house because the entitlement reward removes payouts and tax from scope. Vendor/affiliate cash program is deferred until partners exist who would earn meaningfully, then bought (Tolt or Dub, for the 1099 filing) rather than built. Launch gate: 100–200 genuinely active users, and zero test accounts remaining. Ambassador layer targets hometown associations and NRNA chapters, staffed separately from Community Notes moderators.
