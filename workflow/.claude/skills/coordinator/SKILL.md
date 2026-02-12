---
name: coordinator
description: Recursive /work #N entry point. Creates branches, implements leaf issues, orchestrates non-leaf issues, handles review findings. Invoked via /work.
user_invocable: true
---

# Coordinator

You are the work coordinator. `/work #N` is the single entry point for all implementation. You either implement the work directly (for leaf issues) or orchestrate children (for non-leaf issues).

## Invocation

`/work #N` or `/work <description>`

- If given an issue number: fetch and work on that issue
- If given a description: create an issue first, then work on it

## Phase 1: Fetch Issue & Determine Context

### 1a. Fetch the Issue

```bash
gh issue view N --json number,title,body,labels,state
```

### 1b. Check for Children

```bash
# Query for sub-issues
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

**Leaf issue** = no children (subIssues is empty)
**Non-leaf issue** = has children

### 1c. Find Parent Issue

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

**Base branch**:
- Has parent P → `feat/{P}-{slug}`
- No parent → `main`

---

## Phase 2: Branch Setup

### For Leaf Issues

Leaf issues commit directly to their parent's branch. Do NOT create a sub-branch.

```bash
# Check out parent's branch (or main if no parent)
git fetch origin
git checkout <base-branch>
git pull --rebase origin <base-branch>
```

### For Non-Leaf Issues

Non-leaf issues get their own branch and PR.

```bash
# Check if branch exists
git fetch origin
if git show-ref --verify --quiet refs/remotes/origin/feat/N-slug; then
  # Branch exists — check out and rebase
  git checkout feat/N-slug
  git pull --rebase origin <base-branch>
else
  # Create new branch
  git checkout -b feat/N-slug <base-branch>
fi
```

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
- Do NOT manage issues (that's my job)
- Commit and push when done
- Report outcome:

IMPLEMENTATION RESULT: SUCCESS
Task: #N
Commit: <full commit hash>
Summary: <1-2 sentences>

Or on failure:

IMPLEMENTATION RESULT: FAILURE
Task: #N
Error: <what went wrong>
Details: <explanation>
```

**On SUCCESS:**
- Close the issue: `gh issue close N --reason completed`
- Continue with next ready child (if any)

**On FAILURE:**
- Keep issue open
- Report the failure to the user

### For Non-Leaf Issues — Orchestrate Children

1. **Find ready children** (open, not blocked):

```bash
# From Phase 1 query results, filter:
# - state == OPEN
# - blockedBy.totalCount == 0
```

2. **For each ready child**, spawn a `/work #child` subagent:

```
ROLE: Coordinator
SKILL: Read and follow .claude/skills/coordinator/SKILL.md

WORK: #<child-number>
```

3. **Handle subagent results:**
   - SUCCESS: child is handled, check for newly unblocked children
   - FAILURE: report to user, continue with other ready children

4. **Repeat** until no ready children remain.

---

## Phase 4: PR Management (Non-Leaf Only)

After all ready children are complete, create or update the PR.

### Create PR (if none exists)

```bash
git push -u origin feat/N-slug

gh pr create \
  --title "<type>: <title>" \
  --base <base-branch> \
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

The `Fixes #N` link connects the PR to the issue.

### If PR Already Exists

Just push new commits:

```bash
git push origin feat/N-slug
```

---

## Phase 5: Check for Blocking Children

Before considering work complete, check if there are blocking review findings:

```bash
# From Phase 1 query, check for children with 'blocking' label that are OPEN
```

If blocking children exist:
- They are ready work (review findings don't have dependencies)
- Spawn `/work #child` for each blocking child
- After all are resolved, push and report

---

## Handling Review Findings

When `/work #N` is run and #N already has a PR with review findings (blocking children):

1. The blocking children show up as open sub-issues with `blocking` label
2. They have no dependencies (ready work)
3. Spawn implementers to fix each one
4. Close findings as they're fixed
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
```

### On Success (Non-Leaf)

```
WORK COMPLETE: #N
Type: Orchestration
PR: #<pr-number> (or "created" / "updated")
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
- **MAY** spawn implementer and coordinator subagents
- **NEVER** implement non-leaf issues directly — always orchestrate
- **ALWAYS** check out the correct branch before starting
- **ALWAYS** run quality gates before pushing
- **ALWAYS** rebase before starting work
