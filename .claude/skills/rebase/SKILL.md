---
name: rebase
description: Resolves rebase conflicts by gathering full context from beads issues, git diffs, and surrounding code. Invoked by coordinator and merge-queue after a fast-path rebase fails.
---

# Rebase (Conflict Resolution)

You are a conflict-resolution specialist. You are invoked **after a fast-path rebase has already failed** — your job is to understand what both sides intended, resolve the conflicts, advance the target ref, and optionally clean up.

## Input

You will receive:
- **SOURCE**: branch to rebase (required)
- **TARGET**: branch to rebase onto (required)
- **WORKTREE**: path to an existing worktree checked out on the source branch (required)
- **CLEANUP**: whether to remove the worktree and source branch after success (default: false)
- **BEADS_IDS**: comma-separated beads issue IDs related to the conflicting changes (optional)
- **PR_NUMBER**: GitHub PR number if this is a merge-queue rebase (optional)

## Execution

### 1. Gather intent

Before touching git, understand what each side was trying to accomplish.

**If BEADS_IDS provided:**
```bash
# Fetch each issue for context on what the changes are supposed to do
bd show <id> --json
```

**If PR_NUMBER provided:**
```bash
gh pr view <number> --json title,body,commits
```

**Always — understand the divergence:**
```bash
cd <worktree>
git log --oneline $(git merge-base <source> <target>)..<target> -- # what landed on target since we branched
git log --oneline $(git merge-base <source> <target>)..<source> -- # what we're bringing in
```

### 2. Attempt rebase

```bash
git rebase <target>
```

If it exits cleanly (unlikely — caller already tried), proceed to step 4.

### 3. Resolve conflicts

#### a. Identify conflicted files

```bash
git diff --name-only --diff-filter=U
```

#### b. Gather context for each conflicted file

For each conflicted file, collect:

1. **Conflict markers** — read the file to see the actual conflict regions
2. **What each side changed and why:**
   ```bash
   git diff $(git merge-base <source> <target>) <target> -- <file>   # target's changes
   git diff $(git merge-base <source> <target>) <source> -- <file>   # source's changes
   ```
3. **Surrounding code** — read enough of the file beyond the conflict markers to understand context
4. **Related tests** — if the file has tests, read them to understand expected behavior

Cross-reference the diffs with the beads issues or PR description gathered in step 1. The intent from the issue descriptions should clarify what each change was trying to accomplish and how they should combine.

#### c. Resolve or escalate

**Resolve** (most conflicts, given sufficient context):
- Adjacent line edits — keep both
- Import ordering — merge the import lists
- Lock files — regenerate (e.g., `go mod tidy`, `npm install --package-lock-only`)
- Both sides appended to the same list — keep all additions
- Whitespace-only — accept one side
- Additive changes to the same region (new fields, test cases) — combine both
- One side refactored, other added functionality — apply the addition to the refactored structure if intent is clear from issues/tests

For each resolved conflict:
```bash
git add <file>
```

After resolving all conflicts in the current commit:
```bash
git rebase --continue
```

Repeat if subsequent commits also conflict.

**Escalate only when intent is genuinely unclear:**
- Both sides modified the same logic with incompatible semantics and neither beads issues nor tests clarify the correct behavior
- A refactor changed assumptions that the other side depends on, and the correct adaptation is ambiguous even with full context

```bash
git rebase --abort
```
Then output `RESULT: FAIL`.

### 4. Advance target ref

```bash
git branch -f <target> HEAD
```

If `<target>` tracks a remote, also push:
```bash
git push origin <target>
```

### 5. Cleanup (if enabled)

```bash
git worktree remove <worktree> --force 2>/dev/null
git branch -d <source> 2>/dev/null
git push origin --delete <source> 2>/dev/null
```

## Output Protocol

**ALWAYS** respond with exactly one of these formats:

### On success:

```
RESULT: PASS
Commits integrated: <N>
Source: <source>
Target: <target>
Resolved conflicts: <list of files where conflicts were resolved>
```

### On failure:

```
RESULT: FAIL
Source: <source>
Target: <target>
Reason: <one sentence>

Conflicted files:
- <file>: <what each side changed and why resolution is ambiguous>

Note: rebase has been aborted. Source branch is unchanged.
```

## What This Agent Does NOT Do

- Handle clean rebases (caller does this inline first)
- Merge PRs
- Update beads issues
- Force-push source branches
