#!/usr/bin/env bash
# SessionStart: if pwd is inside a worktree, drop a marker so the
# block-stale-worktree PreToolUse hook can block tool calls until the agent
# acknowledges the worktree via ExitWorktree or EnterWorktree.
#
# The marker lives in the worktree's working tree (.claude/.stale-worktree)
# and is excluded by .gitignore so it doesn't leak into commits or new
# worktree checkouts.

set -euo pipefail

GIT_COMMON=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||' || true)
GIT_TOP=$(git rev-parse --show-toplevel 2>/dev/null || true)

[ -z "$GIT_COMMON" ] && exit 0
[ -z "$GIT_TOP" ] && exit 0

# In a worktree iff working-tree root differs from the main repo root.
if [ "$GIT_TOP" != "$GIT_COMMON" ]; then
  mkdir -p "$GIT_TOP/.claude" 2>/dev/null || true
  touch "$GIT_TOP/.claude/.stale-worktree" 2>/dev/null || true
fi
