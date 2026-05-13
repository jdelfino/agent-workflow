#!/bin/bash
# Hook: Require user approval for Edit/Write/NotebookEdit targeting files in
# the main checkout. Worktrees under .claude/worktrees/ are silently allowed.
#
# Checks the file_path argument rather than cwd — an agent can be inside a
# worktree but use an absolute path that points into the main repo, and that
# is the most common failure mode.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

# No file_path — nothing to gate.
[ -z "$FILE_PATH" ] && echo '{}' && exit 0

ABS_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

MAIN_REPO=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||' || true)
[ -z "$MAIN_REPO" ] && echo '{}' && exit 0

# Outside the repo entirely — allow.
case "$ABS_PATH" in
  "$MAIN_REPO"/*) ;;
  *) echo '{}'; exit 0 ;;
esac

# Inside a worktree — allow.
case "$ABS_PATH" in
  "$MAIN_REPO"/.claude/worktrees/*) echo '{}'; exit 0 ;;
esac

# Edit targets the main checkout — ask the user.
REASON="This edit targets the main checkout ($ABS_PATH). Any change going into the repo should be made on a feature branch in a worktree (see .claude/commands/work.md). Approve only if this is a local-testing edit that will not be committed."

jq -n --arg reason "$REASON" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: $reason
  }
}'
