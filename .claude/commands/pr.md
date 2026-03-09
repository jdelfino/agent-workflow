# Open or Update Pull Request

Create or update the PR for **$ARGUMENTS** (or the current branch if no argument given) with an AI-generated summary.

The coordinator auto-creates a PR when it pushes a branch. Use this command to regenerate or update the PR summary after additional commits, or to manually create a PR for a branch the coordinator didn't push. This command is idempotent — running it multiple times on the same branch always regenerates from the latest diff.

## 1. Determine the branch

```bash
BRANCH="${ARGUMENTS:-$(git branch --show-current)}"
```

If `$ARGUMENTS` is empty, use the current branch.

## 2. Read the diff

```bash
git fetch origin main
git log origin/main..$BRANCH --oneline
git diff origin/main...$BRANCH
```

## 3. Pull beads context

Extract bead IDs from commit messages on the branch:

```bash
git log origin/main..$BRANCH --format="%B" | grep "^Bead:" | sort -u
```

For each bead ID found, fetch its description:

```bash
bd show <bead-id> --json
```

## 4. Check for GitHub issue linkage

If any commit message contains `gh-issue:` or `Closes #N`, note the issue number — include `Closes #<N>` in the PR body.

## 5. Check if a PR already exists

```bash
gh pr list --head $BRANCH --json number,url --jq '.[0]'
```

If a PR already exists, note its number — you will **update** it instead of creating a new one.

## 6. Generate the PR body and create or update

Read the diff and beads context, then generate a rich, accurate PR body.

**If no PR exists — create:**
```bash
gh pr create --title "<type>: <concise title>" --body "<generated body>"
```

**If PR already exists — update:**
```bash
gh pr edit <number> --title "<type>: <concise title>" --body "<generated body>"
```

**PR body template:**
```
## Summary
<2-4 bullets — what this PR does and why, written from the diff>

## Changes
<list of significant files changed and what changed in each>

## Test plan
- [ ] Tests pass
- [ ] <any manual verification steps specific to this change>

Beads: <comma-separated bead IDs, or omit if none>

Closes #<github-issue-number>  ← include only if applicable

Generated with Claude Code
```

**Title format:** Use conventional commits — `feat:`, `fix:`, `refactor:`, `chore:`, etc.

**Summary quality bar:** The summary should be written from reading the actual diff — not generic. If the diff adds a caching layer, say what it caches, why, and what the TTL is. If it fixes a bug, name the bug.

**Idempotent:** Running `/pr` multiple times on the same branch always regenerates the summary from the latest diff. Safe to re-run after the agent pushes fixes.
