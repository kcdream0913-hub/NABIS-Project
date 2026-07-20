# BridgeLink Loop — Setup (do these in order)

## 1. Install Claude Code

Native installer (recommended by Anthropic; no Node.js required):

- macOS / Linux / WSL: `curl -fsSL https://claude.ai/install.sh | bash`
- Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`
- Alternative via npm: `npm install -g @anthropic-ai/claude-code` (needs Node 22+)
- Or use the Claude Desktop app's Code tab.

Verify: `claude --version`, then `claude doctor` if anything looks off.
Docs: https://docs.claude.com/en/docs/claude-code/overview

## 2. Create the repo from this kit

```bash
mkdir bridgelink && cd bridgelink
# copy/unzip the contents of this starter kit into the folder (including .claude/)
chmod +x .claude/hooks/*.sh
git init -b main
git add -A && git commit -m "chore: bootstrap BridgeLink loop (CLAUDE.md, docs, agents, hooks)"
```

Create a GitHub repo and push (GitHub is the loop's cold memory — every session ends
with a push):

```bash
gh repo create bridgelink --private --source=. --push
# or create it on github.com, then: git remote add origin <url> && git push -u origin main
```

## 3. First session

```bash
claude
```

First message to Claude Code:

> Read CLAUDE.md and docs/TASK_BREAKDOWN.md. Confirm the source-of-truth hierarchy
> and current status, then Start Task 0.3.

(Task 0.3 = scaffold + infrastructure. Tasks 0.1/0.2/0.5 are founder-led; run 0.4 KYC
research via `@researcher` in parallel whenever you like.)

## 4. What's already wired

- **CLAUDE.md** — loaded automatically every session: workflow, stack lock, safety
  rails, status, decision log. "Breakthrough <instructions>" remains the pivot passphrase.
- **Stop-hook verification** (`.claude/hooks/verify.sh`) — once the app has a
  `verify` script in package.json (typecheck + lint + tests; created in Task 0.3),
  Claude cannot end a turn while it fails. Escape hatch: `touch .claude/SKIP_VERIFY`
  (delete it after).
- **Kill switch** (`.claude/hooks/killswitch.sh`) — `touch .claude/STOP` blocks all
  tool use, interactive or headless. `rm .claude/STOP` resumes.
- **Subagents** — `@safety-reviewer` (after auth/payments/KYC/moderation/boost/chatbot
  changes), `@verifier` (before closing any task), `@researcher` (external research →
  `docs/research/`).

## 5. Autonomy rollout — in order, no skipping

1. **Interactive (weeks 1–2):** you trigger each task, review each completion.
2. **Assisted:** proceed only after the Stop hook has caught at least one real
   failure and safety-reviewer findings have proven accurate — evidence the checks
   work, not hope.
3. **Headless (the "while you sleep" stage):** n8n (already in your stack) runs on a
   schedule:
   ```bash
   cd /path/to/bridgelink && git pull && \
   claude -p "Read CLAUDE.md. Pick the next ready task from docs/TASK_BREAKDOWN.md whose dependencies are met and that contains no human-checkpoint items; execute it per the workflow; commit and update CLAUDE.md." \
     --permission-mode acceptEdits && git push
   ```
   Keep human checkpoints absolute: KYC provider code, payment flows, prod deploys,
   prod migrations, architecture changes — headless runs stop and leave a note in
   CLAUDE.md instead of proceeding. Check flag syntax against
   https://docs.claude.com/en/docs/claude-code/overview before first use — CLI flags
   change between versions.

## 6. Session discipline

Every session ends with: status block updated in CLAUDE.md, decisions logged, work
committed and pushed. If a session dies mid-task, the next one recovers from
CLAUDE.md + `git log` — that is the whole point of the design.
