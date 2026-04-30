#!/bin/bash
# Hook: Block git checkout/switch to feature branches in main workspace.
# Allows: checkout -b (create), checkout -- (restore), checkout main
# Allows: all checkouts inside worktrees (they're already isolated)

# Allow everything inside a worktree
MAIN_REPO=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||')
CURRENT_TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$MAIN_REPO" ] && [ -n "$CURRENT_TOPLEVEL" ] && [ "$CURRENT_TOPLEVEL" != "$MAIN_REPO" ]; then
  echo '{}'
  exit 0
fi

cmd=$(jq -r '.tool_input.command')
if echo "$cmd" | grep -qE '^git (checkout|switch)' \
   && ! echo "$cmd" | grep -qE '^git checkout (-b |-- )' \
   && ! echo "$cmd" | grep -qE '^git (checkout|switch) main$'; then
  echo '{"decision":"block","reason":"BLOCKED: Do not switch branches in the main workspace. Use: git worktree add ../<name> <branch>. Read .claude/skills/coordinator/SKILL.md for the full worktree workflow."}'
else
  echo '{}'
fi
