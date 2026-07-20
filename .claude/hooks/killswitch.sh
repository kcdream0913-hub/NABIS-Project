#!/usr/bin/env bash
# Kill switch: if .claude/STOP exists, block every tool call.
# Create the file to halt an autonomous run; delete it to resume.
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ -f "$ROOT/.claude/STOP" ]; then
  echo "KILL SWITCH ACTIVE: $ROOT/.claude/STOP exists. All tool use is blocked until the file is removed. Stop working and tell the user." >&2
  exit 2
fi
exit 0
