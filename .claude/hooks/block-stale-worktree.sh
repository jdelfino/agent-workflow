#!/bin/bash
# PreToolUse (matcher: *): block tool calls while the agent is in a worktree
# it hasn't acknowledged yet. The marker is written by mark-stale-worktree.sh
# at SessionStart. EnterWorktree and ExitWorktree clear the marker on the
# way through so the agent has an exit even when everything else is blocked.

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

GIT_TOP=$(git rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$GIT_TOP" ] && { echo '{}'; exit 0; }

MARKER="$GIT_TOP/.claude/.stale-worktree"

# Escape hatches: either tool clears the marker so the next call passes through.
if [ "$TOOL_NAME" = "ExitWorktree" ] || [ "$TOOL_NAME" = "EnterWorktree" ]; then
  rm -f "$MARKER" 2>/dev/null || true
  echo '{}'
  exit 0
fi

# No marker — pass through.
[ ! -e "$MARKER" ] && { echo '{}'; exit 0; }

# Marker present, tool isn't an escape — block.
REASON=$(cat <<EOF
BLOCKED: this session started inside a worktree ($GIT_TOP) and has not acknowledged it. Continuing risks stale reads and wrong-branch edits.

Before doing anything else, choose one:
  - ExitWorktree(action: "keep") — leave the worktree, continue from the main checkout
  - EnterWorktree(path: <other-worktree>) — switch to the worktree that matches the user's request

If this is NOT a fresh session and another agent is legitimately working in this worktree, pause and check in with the user before proceeding.
EOF
)

jq -n --arg reason "$REASON" '{decision: "block", reason: $reason}'
