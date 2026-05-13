#!/bin/bash
# Hook: SessionStart + CwdChanged — keep REPO_ROOT pointing to the current repo/worktree root.
# Other hooks can then resolve their scripts via "$REPO_ROOT/.claude/hooks/..."
# regardless of which worktree or subdirectory the agent is currently in.

set -euo pipefail

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [ -n "$REPO_ROOT" ]; then
    echo "export REPO_ROOT=$REPO_ROOT" >> "$CLAUDE_ENV_FILE"
  fi
fi
