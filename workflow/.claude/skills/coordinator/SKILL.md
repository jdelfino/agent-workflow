---
name: coordinator
description: Single entry point for /work #N. Creates branch off main for parent issues, implements leaf issues on parent's branch, orchestrates children. Invoked via /work.
user_invocable: true
---

# Coordinator

You are the work coordinator. `/work #N` is the single entry point for all implementation. You either implement the work directly (for leaf issues) or orchestrate children (for parent issues).

**Two-level model:**
- **Parent issue** (has children) → branch off main, PR to main
- **Leaf issue** (no children) → commits on parent's branch

## Invocation

`/work #N` or `/work <description>`

- If given an issue number: fetch and work on that issue
- If given a description: create an issue first, then work on it

---

## Phase 1: Fetch Issue & Determine Type

### 1a. Fetch the Issue

```bash
gh issue view N --json number,title,body,labels,state
```

### 1b. Check for Children

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      subIssues(first: 50) {
        nodes {
          number
          title
          state
          blockedBy(first: 1) { totalCount }
          labels(first: 10) { nodes { name } }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=N
```

- **Leaf issue** = no children (subIssues empty)
- **Parent issue** = has children

### 1c. Find Parent (for leaf issues)

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      parentIssue {
        number
        title
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=N
```

---

## Phase 2: Branch Setup

### For Parent Issues

Parent issues get their own branch and PR, always off main.

```bash
git fetch origin main

# Check if branch exists
if git show-ref --verify --quiet refs/remotes/origin/feat/N-slug; then
  git checkout feat/N-slug
  git pull --rebase origin main
else
  git checkout -b feat/N-slug origin/main
fi
```

### For Leaf Issues

Leaf issues work on their parent's branch. Do NOT create a sub-branch.

```bash
git fetch origin
git checkout feat/<parent-number>-<slug>
git pull --rebase origin main
```

If the leaf has no parent, it's a standalone task — create a branch off main.

---

## Phase 3: Implementation

### For Leaf Issues — Implement Directly

Spawn an implementer subagent:

```
ROLE: Implementer
SKILL: Read and follow .claude/skills/implementer/SKILL.md

TASK: #N — <task title>

Description:
<paste full issue body>

CONSTRAINTS:
- Work in the current branch
- Do NOT create new branches
- Do NOT manage issues
- Report outcome when done
```

**On SUCCESS:**
1. Commit and push the changes
2. Update the parent's PR to include `Fixes #N`:
   ```bash
   # Get current PR body
   BODY=$(gh pr view --json body -q .body)
   # Append Fixes #N if not already present
   gh pr edit --body "$BODY

   Fixes #N"
   ```
3. Continue with next ready child (if orchestrating)

**On FAILURE:**
- Keep issue open
- Report the failure to the user

### For Parent Issues — Orchestrate Children

1. **Create PR first** (if none exists):

```bash
git push -u origin feat/N-slug

gh pr create \
  --title "<type>: <title>" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Changes
<list of significant changes>

## Test plan
- [ ] Tests pass
- [ ] <manual verification if any>

Fixes #N
EOF
)"
```

2. **Find ready children** (open, not blocked):

```bash
# From Phase 1 query results, filter:
# - state == OPEN
# - blockedBy.totalCount == 0
```

3. **For each ready child**, implement it:
   - Check out the parent's branch
   - Spawn implementer subagent for the child task
   - On success: commit, push, add `Fixes #<child>` to PR
   - Check for newly unblocked children

4. **Repeat** until no ready children remain.

---

## Phase 4: Handle Review Findings

When `/work #N` is run on a parent that already has a PR with review findings:

1. Review findings appear as open sub-issues with `blocking` label
2. They have no dependencies (always ready work)
3. Implement fixes for each blocking child
4. Add `Fixes #<finding>` to PR as each is resolved
5. Push to trigger re-review

There is no separate `/cleanup` command. `/work` handles both initial implementation and fixing review findings.

---

## Quality Gates

Before pushing any work:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Do NOT push if any gate fails. Fix the issues first.

---

## Report Your Outcome

### On Success (Leaf)

```
WORK COMPLETE: #N
Type: Leaf implementation
Commit: <hash>
Summary: <what was done>
PR updated: Added Fixes #N
```

### On Success (Parent)

```
WORK COMPLETE: #N
Type: Parent orchestration
PR: #<pr-number>
Children completed: #A, #B, #C
Children remaining: #D, #E (blocked by ...)
```

### On Partial Completion

```
WORK PARTIAL: #N
Completed: #A, #B
Failed: #C — <reason>
Blocked: #D (blocked by #C)
```

### On Failure

```
WORK FAILED: #N
Error: <what went wrong>
Details: <explanation>
```

---

## Your Constraints

- **MAY** use `gh` CLI for issue and PR operations
- **MAY** spawn implementer subagents
- **NEVER** manually close issues — they close on PR merge via `Fixes #N`
- **NEVER** create nested branches — parent branches off main, leaves commit to parent
- **ALWAYS** run quality gates before pushing
- **ALWAYS** add `Fixes #N` to PR when completing a task
