#!/usr/bin/env bash
# Verification gate (Stop hook): Claude may not finish a turn while verification fails.
# - No-ops until a package.json with a "verify" script exists (so Phase 0 isn't blocked).
# - Escape hatch: `touch .claude/SKIP_VERIFY` disables the gate (use sparingly; delete after).
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0

[ -f .claude/SKIP_VERIFY ] && exit 0
[ -f package.json ] || exit 0

node -e "const s=require('./package.json').scripts||{};process.exit(s.verify?0:1)" 2>/dev/null || exit 0

OUT="$(npm run -s verify 2>&1)"
STATUS=$?
if [ $STATUS -ne 0 ]; then
  {
    echo "VERIFICATION FAILED (npm run verify, exit $STATUS). Fix before finishing the turn:"
    echo "$OUT" | tail -50
  } >&2
  exit 2
fi
exit 0
