# BL-BRAND-02 — Sangamline rename: applied record

**Status: APPLIED + SHIPPED TO PRODUCTION 2026-08-03.** Merged to `main` and pushed;
Vercel production deploy flips `sangamline.com` from the D-080 build ("BridgeLink") to
Sangamline. Decision + evidence live in `BL-BRAND-01` (v3.0, KC) and decision-log row
**D-081** in `CLAUDE.md`. This file is the *implementation* record — what actually
changed in code — not the rationale.

## The decision, in one line
The product is **`Sangamline`** (KC's pick; `sangamline.com` bought via Cloudflare
Registrar $10.46/yr, live on Vercel apex + `www`). BridgeLink could not be kept: every
usable domain is third-party-registered (only `.io` was free) and there are **9 live
exact-match `BRIDGELINK` trademark registrations**, two colliding with this product's
classes (PayNation — ACH/EFT/electronic-payments middleware; Marlink — internet platform
services), plus an actively-claimed Innovar Healthcare mark (filed Feb 2026). Trademark
exposure attaches to *using* a mark in commerce, so buying `bridgelink.io` would have
bought a URL and none of the safety.

## What shipped (commits)
- **`bcf43e7`** `feat(brand): rename BridgeLink -> Sangamline across user-facing surfaces` — 20 files.
- **`1e6d19a`** `fix(brand): swap the 7 "B" monogram tiles to "S"; sync lockfile for npm ci` — 7 files.
- **(this record + the D-081 log row)** — `docs:` commit on the same branch, merged with the above.

### Files changed — `bcf43e7` (20)
Public wordmark + copy: `messages/en.json`, `messages/ne.json` (38 lines each),
`components/Sidebar.tsx`, `app/[locale]/(marketing)/{home,guidelines,welcome-tour}/page.tsx`,
`app/[locale]/(marketing)/theme.css`, `app/globals.css`, `lib/data.ts` (seed copy).
Legal + metadata: `app/[locale]/{terms,privacy}/page.tsx` (entity refs),
`app/[locale]/layout.tsx` (title + `metadataBase` → `sangamline.com`).
Machinery: `lib/calendar.ts` (ICS PRODID/UID `@bridgelink` → `@sangamline`),
`app/[locale]/(app)/settings/data/export/route.ts` (download filename),
`app/[locale]/(app)/settings/support/page.tsx` (comment + subject),
`public/assets/favicon.svg` (mark `BL` → `S`),
`e2e/smoke.spec.ts` (assertion copy),
`app/[locale]/(app)/business/new/_lib/{websiteGuards.ts,website.server.ts,__tests__/websiteGuards.test.ts}`
(crawler token pair → `SangamlineBot` / `https://sangamline.com/about/bot`, +2 tests).

### Files changed — `1e6d19a` (7)
Monogram tiles `"B"` → `"S"` (a bare JSX letter a grep-on-`BridgeLink` can't catch — the
shell was reading "[B] Sangamline"): `components/Sidebar.tsx` and the `(auth)` pages
`login`, `signup` (×2), `forgot-password`, `update-password`, `pair`. Plus
`package-lock.json` — the nested `node_modules/next-intl/node_modules/@swc/helpers` entry
+ `fsevents` `dev:true`, so `npm ci` passes under CI's npm 10 (strict), which local npm 11
(lenient) does not surface (see the `ci-lockfile-npm-major-drift` note).

## Deliberately NOT changed (and why)
- **Silent-break trio — must never be renamed:** the `KEK_INFO` HKDF constant in
  `lib/e2ee/crypto.ts` (renaming it breaks E2EE decryption of every existing thread);
  the `inviteToBridgeLink` i18n **key** (the *value* was changed to "Sangamline", the key
  is a stable identifier code references); the crawler UA/robots **token pair** (renamed
  in lockstep to `SangamlineBot`, but it is one coupled pair — guard code and UA string
  must match).
- **Infra identifiers (cosmetic only, high churn if touched):** `BL-` doc prefixes, DB
  table names, the `nabis-bridgelink` Supabase project ref, the GitHub repo name, migration
  filenames, internal enums.
- **Product vocabulary, not the brand:** `Bridge View` (the third US/Nepal/**Bridge**
  view) and `Bridge Verified` (the both-tracks trust tier). Renaming these is a separate
  product-vocabulary decision; D-081 does **not** touch them.

## Gates (at ship)
`tsc 0 · vitest 396/396 · next build 0 (both locales)`. i18n en/ne parity held; the
`ne.json` Devanagari strings still render the wordmark **"Sangamline" in Latin script**
inside Nepali sentences — not a regression (BridgeLink was Latin there too), but it means
Layer 3 (a Devanagari community name) is unbuilt (see risks).

## Unresolved risk (recorded, not accepted-with-evidence)
The root word *Sangam* is **not a blank slate** — it names the Tamil Sangam literary
tradition, a 1964 Bollywood film, a Girl Guides world centre, and countless Indian
restaurants; it reads pan-South-Asian, **leaning Indian, not Nepali-specific.** No native
Nepali speaker was ever asked. The compound *Sangamline* is coined (zero prior usage or
registration anywhere), and no country name is in the mark, so the legal/domain position
is clean across five TLDs — but the **brand-perception** question is open. **KC chose
ship-now over validate-first** knowing this. If the name lands wrong with Nepali users,
the fix is **not another rename** — it is building Layer 3: a Devanagari community name
carrying the warmth, under the `Sangamline` wordmark.

## Open items (post-ship, none block operating)
1. **Native-speaker panel** — 8–10 Nepali speakers (US + Nepal side), unprompted. Never run.
2. **Formal trademark clearance** before filing / before real brand spend (USPTO $350/class post-Jan-2025; ~3 classes ≈ $1,050 gov fees). Deferrable — operating needs no registration.
3. **Devanagari brand form** (naming-architecture Layer 3).
4. **Real logo** — the mark is currently the letter **S** in a rounded tile (favicon + monogram positions). Placeholder.
5. **`support@sangamline.com`** — no mailbox; support still routes to `kcdream0913@gmail.com` and the code comment says so. Do not publish the address until it receives mail.
