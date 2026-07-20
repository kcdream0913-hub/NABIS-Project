# BridgeLink / NABIS-Project — Build Handoff (Claude Code)

Everything is specified and the backend is **live**. This is how to build the real app.

## What's already done for you
- **Authoritative spec:** `docs/SPECIFICATION.md` (v1) — build to this.
- **Supabase backend (LIVE):** project `nabis-bridgelink` — 16 tables, RLS enabled,
  8 sector channels seeded, signup trigger that auto-creates a profile. Connection is
  pre-filled in `.env.local.example`. Full DDL in `supabase/schema.sql`.
- **Operating contract:** `CLAUDE.md` (read the "BUILD HANDOFF" banner at the top).
- **Subagents + hooks:** `.claude/` (verifier, safety-reviewer, researcher; a verify
  stop-hook and a kill switch).
- **Design system:** `app/globals.css` (the corridor palette) + existing component
  style — reuse it. The current screens are an early mock-data prototype; replace them
  with real Supabase-backed features per the spec.

## Step 1 — Put this project into your GitHub repo
Repo: https://github.com/kcdream0913-hub/NABIS-Project

Easiest, no terminal — **GitHub Desktop**:
1. Install GitHub Desktop and sign in.
2. File -> Clone repository -> select `NABIS-Project` -> clone it to your computer.
3. Unzip this package and copy everything inside the `bridgelink` folder into the
   cloned repo folder.
4. In GitHub Desktop you'll see all the files listed. Type a summary
   ("initial project + spec + supabase") and click **Commit to main**, then **Push origin**.

(Alternative: github.com -> your repo -> Add file -> Upload files -> drag the files in -> Commit.)

## Step 2 — Install Claude Code
- macOS / Linux / WSL: `curl -fsSL https://claude.ai/install.sh | bash`
- Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`
- Or use the Claude desktop app's **Code** tab.
Check: `claude --version`

## Step 3 — Environment
Copy `.env.local.example` to `.env.local` (Supabase values are already filled in).
When you're ready for server-side admin actions, add the **service-role key** from the
Supabase dashboard (Project Settings -> API).

## Step 4 — Open Claude Code in the project folder and paste this kickoff prompt

Run `claude` inside the project folder, then paste:

> Read CLAUDE.md and docs/SPECIFICATION.md in full. The Supabase backend is already
> provisioned (details in CLAUDE.md and .env.local): 16 tables, RLS with starter
> policies, 8 seeded channels, and a signup trigger. Install the Supabase client and
> wire it from .env.local.
>
> Build the app to docs/SPECIFICATION.md, reusing the corridor design system in
> app/globals.css. The existing screens are an early mock-data prototype — replace them
> with real, Supabase-backed features that match the current spec. Go phase by phase,
> committing after each with `npm run build` passing:
>
> 1. Auth — email/phone + password + Google/Apple SSO (Supabase Auth). Unverified users
>    can browse the Feed and directories; posting and messaging require verification.
> 2. Profile + "Verify your profile" (KYC) inside the Profile menu — country-first
>    document selection (every country), camera capture, tiered checks. Put the Shufti
>    call behind an interface and stub it until keys exist.
> 3. Businesses + KYB + teams — owner adds/removes members; employees are auto-verified
>    under the owner (verified_via = business). Channels are sector directories of
>    businesses -> open a business -> see its bio + team.
> 4. Main screen Feed / Messages toggle; sector channels, direct messages, content
>    composer (posts show business logo or employee photo per posted_as).
> 5. Member + business directory with search and filters.
> 6. Events + RSVP.
> 7. Admin review + reports queue + audit logging.
> 8. Paid access (spec §5.13) — per-provider upfront access price + platform revenue
>    share; stub Stripe behind an interface until keys are added.
>
> As you build each feature, COMPLETE and HARDEN the RLS policies for the tables it
> touches (§6.2 / §7.1) and run the Supabase security advisor. Use the @verifier
> subagent before marking a phase done, and update the status block in CLAUDE.md after
> each phase.

## Step 5 — Deploy (when a phase is worth showing)
Connect the repo to **Vercel** (vercel.com -> Add New -> Project -> Import
`NABIS-Project` -> add the same env vars -> Deploy). Vercel auto-detects Next.js and
gives you a live URL — no terminal.

## Handy while building
- Watch data appear live in the Supabase dashboard -> Table editor as you test.
- `.env.local` is gitignored — never commit the service-role key.
