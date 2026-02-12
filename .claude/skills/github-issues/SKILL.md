---
name: github-issues
description: GitHub API reference for sub-issues and dependencies. Used by planner, coordinator, and reviewer skills.
---

# GitHub Issues API Reference

The `gh` CLI does not natively support sub-issues or `blocked-by` relationships. Use these GraphQL and REST patterns.

## Query: Sub-Issues with Blocking Status

Find children of issue #N and whether they're blocked:

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
          body
          labels(first: 10) { nodes { name } }
          blockedBy(first: 5) {
            totalCount
            nodes { number title state }
          }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=N
```

**Ready children** = `state == OPEN && blockedBy.totalCount == 0`

## Query: Parent Issue

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      parentIssue { number title }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=N
```

## Query: Issue Node ID

Required for mutations. Get the node ID for issue #N:

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $num: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $num) { id }
  }
}' -f owner=OWNER -f repo=REPO -F num=N --jq '.data.repository.issue.id'
```

## Mutation: Add Sub-Issue

Link CHILD as a sub-issue of PARENT:

```bash
PARENT_ID=$(gh api graphql -f query='query($o: String!, $r: String!, $n: Int!) { repository(owner: $o, name: $r) { issue(number: $n) { id } } }' -f o=OWNER -f r=REPO -F n=PARENT_NUM --jq '.data.repository.issue.id')
CHILD_ID=$(gh api graphql -f query='query($o: String!, $r: String!, $n: Int!) { repository(owner: $o, name: $r) { issue(number: $n) { id } } }' -f o=OWNER -f r=REPO -F n=CHILD_NUM --jq '.data.repository.issue.id')

gh api graphql -f query='
mutation($parentId: ID!, $childId: ID!) {
  addSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
    issue { number }
    subIssue { number }
  }
}' -f parentId="$PARENT_ID" -f childId="$CHILD_ID"
```

## REST: Add Blocked-By Dependency

Make BLOCKER_NUM block BLOCKED_NUM:

```bash
BLOCKER_ID=$(gh api graphql -f query='query($o: String!, $r: String!, $n: Int!) { repository(owner: $o, name: $r) { issue(number: $n) { id } } }' -f o=OWNER -f r=REPO -F n=BLOCKER_NUM --jq '.data.repository.issue.id')

gh api repos/OWNER/REPO/issues/BLOCKED_NUM/dependencies/blocked_by \
  -X POST \
  -f blocked_by_issue_id="$BLOCKER_ID"
```

## Recommended Approach

| Operation | Use |
|-----------|-----|
| Query sub-issues, parent, blocked-by counts | GraphQL (single call) |
| Add/remove dependencies | REST API (simpler) |
| Create issues | `gh issue create` CLI |
| Add sub-issue relationship | GraphQL mutation |
