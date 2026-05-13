#!/bin/bash
# Hook: WorktreeCreate — set up a worktree branched from the caller's HEAD.
# Fires when an agent runs EnterWorktree(name: ...) or spawns a subagent with
# isolation: "worktree". Stdout is consumed as the worktree path.
#
# Customize the post-create section for your project's per-worktree setup
# (symlinking node_modules, fetching generated files, downloading deps, etc.).

set -euo pipefail

INPUT=$(cat)

# Resolve the main repo root (follows symlinks through worktrees)
MAIN_REPO=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||')
[ -z "$MAIN_REPO" ] && MAIN_REPO=$(git rev-parse --show-toplevel 2>/dev/null)

NAME=$(echo "$INPUT" | jq -r '.name // empty')
[ -z "$NAME" ] && { echo ""; exit 0; }

WORKTREE_PATH="$MAIN_REPO/.claude/worktrees/$NAME"

# Branch from the caller's HEAD so subagent worktrees inherit the
# coordinator's feature branch (rather than always branching from main).
BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")

if [ ! -d "$WORKTREE_PATH" ]; then
  git -C "$MAIN_REPO" worktree add "$WORKTREE_PATH" -b "worktree-$NAME" "$BASE_BRANCH" >/dev/null 2>&1 || true
fi

# Project-specific setup: customize the block below for your project.
# Common patterns:
#   ln -s "$MAIN_REPO/node_modules" "$WORKTREE_PATH/node_modules" 2>/dev/null || true
#   (cd "$WORKTREE_PATH" && go mod download) >/dev/null 2>&1 || true
#   cp "$MAIN_REPO/.env.local" "$WORKTREE_PATH/.env.local" 2>/dev/null || true

echo "$WORKTREE_PATH"
