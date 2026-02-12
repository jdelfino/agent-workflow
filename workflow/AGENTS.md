# AGENTS.md

This file provides workflow conventions and API references for AI agents using agent-workflow.

## Workflow Overview

```
/plan → /work → automated review → fix → auto-merge
```

1. **Plan**: Decompose work into GitHub Issues with sub-issues and dependencies
2. **Work**: Create branch, implement, open PR
3. **Review**: Three reviewers run automatically, filing issues for findings
4. **Fix**: Address blocking issues (same `/work` command)
5. **Merge**: Auto-merge when all checks pass

## Two Commands

| Command | Purpose |
|---------|---------|
| `/plan <description-or-#N>` | Explore codebase, discuss tradeoffs, file issues |
| `/work #N` | Implement, fix, or orchestrate children |

There is no separate `/cleanup` or `/fix` command. Running `/work #N` after review findings are filed works through them like any other child issues.

## GitHub Issues Model

### Hierarchy

GitHub Issues with native sub-issues form the task hierarchy:

```
#20 Parent: "Add rate limiting"                    [epic/feature]
 ├── #21 Child: "Add rate limiting middleware"     [task]
 ├── #22 Child: "Add rate limit configuration"     [task, blocked by #21]
 ├── #23 Child: "Add rate limit headers"           [task, blocked by #21]
 │
 │   [After PR opened and reviewed...]
 │
 ├── #26 Child: "Missing null check on request.ip" [review finding, blocking]
 └── #27 Child: "No test for concurrent handling"  [review finding, blocking]
```

### Issue Types

**Task issues** are created during planning. They represent discrete units of work completable in a single agent session.

**Review finding issues** are created by reviewers during PR review. They represent problems discovered in the implementation. Findings are children of the parent issue being reviewed.

### Labels

Use labels for severity and metadata:
- `blocking` — critical finding that must be fixed before merge
- `should-fix` — important but not blocking
- `suggestion` — optional improvement

### Dependencies

Use GitHub's native `blocked-by`/`blocking` relationships for task ordering:
- Task #22 blocked by #21 means #22 can't start until #21 is done
- A `blocking` review finding blocks the parent issue's PR from merging

## Hierarchical Branching

Branch structure mirrors issue structure. Each non-leaf issue gets its own branch and PR.

```
Issues:                                    Branches:
──────────────────────────────────────────────────────────────
#10 Epic: "API overhaul"                   feat/10-api-overhaul (off main)
 │                                          │
 ├── #20 Feature: "Add rate limiting"       ├── feat/20-rate-limiting (off feat/10)
 │    ├── #21 Task: "Add middleware"        │    (commits on feat/20)
 │    └── #22 Task: "Add configuration"     │    (commits on feat/20)
 │                                          │
 └── #30 Feature: "Add authentication"      └── feat/30-authentication (off feat/10)
      └── #31 Task: "Add JWT validation"         (commits on feat/30)
```

**Key rules:**
- **Non-leaf issues** (issues with children) get their own branch: `feat/{N}-{slug}`
- **Leaf issues** (no children) commit directly to their parent's branch
- PRs target the parent's branch (or `main` if no parent)
- PR description includes `fixes #N` to link the issue

**Merge flow (bottom-up):**
1. Leaf task commits land on parent branch
2. Child PRs pass checks → merge into parent branch
3. When all children merge → parent PR passes checks → merges into its parent (or main)

## Issue Structure Requirements

Every task issue must be **self-contained** — readable without any external context.

### Required Sections

```markdown
## Summary
What and why in 1-2 sentences.

## Files to modify
- `path/to/file.ts` — what changes
- `path/to/other.ts:42` — specific line if relevant

## Implementation steps
1. First specific action
2. Second specific action
3. ...

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

A future agent session must understand the task completely from its description alone.

## Quality Gates

Before pushing any work, run:

```bash
npm test           # All tests pass
npx tsc --noEmit   # No type errors
npm run lint       # No lint errors (warnings OK)
```

Do not push if any gate fails. Fix the issues first.

## Session Completion Checklist

Every session must complete these steps before ending:

1. **File issues** for any discovered or remaining work
2. **Run quality gates** (if code changed)
3. **Update issue status** via `gh` CLI
4. **Push to remote** — this is mandatory:
   ```bash
   git pull --rebase
   git push
   git status  # Must show "up to date with origin"
   ```
5. **Clean up** — clear stashes, verify all changes committed

Work is NOT complete until `git push` succeeds.

---

## GitHub API Reference

The `gh` CLI does not natively support sub-issues or blocked-by relationships. Use the GraphQL and REST APIs instead.

### Query: List Sub-Issues with Blocking Status

Find children of issue #N and check if they're blocked:

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
          labels(first: 10) {
            nodes { name }
          }
          blockedBy(first: 1) {
            totalCount
          }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=N
```

**Ready children** = `state == OPEN && blockedBy.totalCount == 0`

### Query: Get Parent Issue

Find the parent of issue #N:

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

### Query: Check for Blocking Children

Check if issue #N has any open children with the `blocking` label:

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      subIssues(first: 50, filterBy: {states: OPEN}) {
        nodes {
          number
          labels(first: 10) {
            nodes { name }
          }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=N
```

Filter client-side for labels containing `blocking`.

### Mutation: Create Issue as Sub-Issue

First create the issue, then add it as a sub-issue:

```bash
# 1. Create the issue
gh issue create --title "Task title" --body "Description" --label "task"
# Note the returned issue number

# 2. Get issue node IDs
gh api graphql -f query='
query($owner: String!, $repo: String!, $parentNum: Int!, $childNum: Int!) {
  repository(owner: $owner, name: $repo) {
    parent: issue(number: $parentNum) { id }
    child: issue(number: $childNum) { id }
  }
}' -f owner=OWNER -f repo=REPO -F parentNum=PARENT -F childNum=CHILD

# 3. Add as sub-issue
gh api graphql -f query='
mutation($parentId: ID!, $childId: ID!) {
  addSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
    issue { number }
    subIssue { number }
  }
}' -f parentId=PARENT_ID -f childId=CHILD_ID
```

### REST API: Dependencies

Add/remove blocked-by relationships:

```bash
# List what blocks issue #N
gh api repos/OWNER/REPO/issues/N/dependencies/blocked_by

# List what issue #N blocks
gh api repos/OWNER/REPO/issues/N/dependencies/blocking

# Add a blocker (issue #B blocks issue #N)
gh api repos/OWNER/REPO/issues/N/dependencies/blocked_by \
  -X POST \
  -f blocked_by_issue_id=ISSUE_NODE_ID

# Remove a blocker
gh api repos/OWNER/REPO/issues/N/dependencies/blocked_by/DEPENDENCY_ID \
  -X DELETE
```

### Recommended Approach

| Operation | Use |
|-----------|-----|
| Query sub-issues, parent, blocked-by counts | GraphQL (single call) |
| Add/remove dependencies | REST API (simpler) |
| Create issues | `gh issue create` CLI |
| Add sub-issue relationship | GraphQL mutation |
