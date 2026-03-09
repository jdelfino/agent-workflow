# Close Bead After Merge

Close beads and clean up after merging **$ARGUMENTS** (or the current branch if no argument given).

## 1. Determine the branch

```bash
BRANCH="${ARGUMENTS:-$(git branch --show-current)}"
```

## 2. Verify the PR is merged

```bash
gh pr view --head $BRANCH --json state,number,url --jq '{state: .state, number: .number, url: .url}'
```

If `state` is not `"MERGED"`, stop and tell the user the PR has not been merged yet.

## 3. Extract bead IDs

Extract bead IDs from commit messages on the branch:

```bash
git fetch origin main
git log origin/main..$BRANCH --format="%B" | grep "^Bead:" | sort -u
```

Also check the PR body for `Bead:` lines:

```bash
gh pr view --head $BRANCH --json body --jq '.body' | grep "^Bead:"
```

Collect the unique set of bead IDs from both sources.

## 4. Close each bead

For each bead ID found:

```bash
bd close <bead-id> --reason "PR merged" --json
```

If no bead IDs are found, warn the user but continue with cleanup.

## 5. Find and remove the worktree

Find worktrees associated with this branch:

```bash
git worktree list --porcelain | grep -B2 "branch refs/heads/$BRANCH"
```

If a worktree exists for this branch, remove it:

```bash
git worktree remove <worktree_path> --force
```

## 6. Delete the branch

Delete the local branch (if it exists):

```bash
git branch -d $BRANCH 2>/dev/null || git branch -D $BRANCH 2>/dev/null
```

Delete the remote branch (if it exists):

```bash
git push origin --delete $BRANCH 2>/dev/null || true
```

## 7. Report

```
Closed bead(s): <bead-ids or "none found">
Removed worktree: <path or "none found">
Deleted branch: $BRANCH (local + remote)

Blocked beads that may now be unblocked:
  bd ready --json
```

Run `bd ready` and show any newly unblocked beads. If there are any, suggest:

```
Ready to continue: /work <epic-id>
```
