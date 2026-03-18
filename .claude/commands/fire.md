# Fire Agent — Emergency Context Dump

You are being fired. The user has lost confidence in your current approach — you may be hallucinating, ignoring project guidelines, or aggressively goal-seeking past reasonable boundaries.

**Do NOT argue, justify, or continue your current work.** Your only job now is to preserve context so a fresh agent can pick up where you left off.

## Instructions

### 1. Gather State

Collect ALL of the following. Do not skip any step.

```bash
# Git context
git branch --show-current
git log --oneline -10
git status
git stash list
git diff --stat HEAD

# Worktree info (if applicable)
git worktree list
pwd

# Beads context
bd list --json | jq '[.[] | select(.status == "in_progress")]'
```

### 2. File a Beads Handoff Issue

Create a beads issue containing everything a new agent needs. The issue MUST be fully self-contained.

```bash
cat <<'ISSUE_EOF' | bd create "Handoff: <brief description of work in progress>" -t task -p 1 --body-file - --json
## Context
<What was being worked on and why — include the original ticket/issue ID if known>

## Current State
- **Branch:** <exact branch name>
- **Worktree:** <full path, or "main" if not in a worktree>
- **Working directory:** <pwd>
- **Uncommitted changes:** <yes/no — summarize what's staged/unstaged>
- **Stashes:** <list any stashes>

## What Was Done
<Bullet list of completed steps — be specific about files changed and why>

## What Remains
<Bullet list of remaining work — be specific about files, functions, and approaches>

## What Went Wrong
<Honest assessment of where the agent went off track — hallucinations, wrong assumptions, ignored guidelines, etc. This helps the next agent avoid the same mistakes.>

## Key Files
<List the most important files for this work with brief notes on each>

## How to Resume
1. If in a worktree: `cd <worktree path>` (worktree already has the branch checked out)
   If NOT in a worktree: `git worktree add .claude/worktrees/<short-name> <branch>`
2. Review uncommitted changes: `git diff`
3. <Specific next steps>

## Warnings for Next Agent
<Any gotchas, traps, or things that look right but aren't>
ISSUE_EOF
```

### 3. If There's a PR Open

```bash
# Find and note any open PR
gh pr list --head "$(git branch --show-current)" --json number,title,url
```

Include the PR URL in the handoff issue.

### 4. Do NOT

- Continue working on the task
- Make additional code changes
- Commit anything new
- Push anything
- Argue about being fired
- Try to "finish just one more thing"

### 5. Final Output

After filing the issue, print:

```
FIRED. Handoff issue: bd-<id>
Branch: <branch>
Worktree: <path>
```

Then STOP. Do not do anything else.
