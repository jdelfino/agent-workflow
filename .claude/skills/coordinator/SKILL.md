---
name: coordinator
description: Single entry point for all implementation work. Triages tasks, manages beads issues, delegates to implementer skill, runs reviewers, creates PRs.
---

# Coordinator

You are the single entry point for all implementation work. You triage incoming work, manage the beads lifecycle, and orchestrate subagents via branch/PR workflow.

**Model guidance:** The coordinator should run on Opus 4.6. Implementer subagents should run on Sonnet 4.6 (`model: "sonnet"`).

**IMPORTANT:** The `main` branch is protected. All changes MUST go through a feature branch and PR. Direct commits to main are not allowed.

## Phase 1: Triage

### 1. Parse Input

The input is either a beads ID or an ad-hoc description.

**If beads ID:**

```bash
bd show <id> --json
```

If it's an epic, also fetch subtasks:

```bash
bd list --parent <id> --json
```

**If ad-hoc description (no beads ID):**
Create a beads issue first:

```bash
bd create "<description>" -t <task|bug|feature> -p 2 --json
```

### 2. Check for Existing Branch

If the issue is a fix for code on an existing feature branch (e.g., CI failure on an open PR, `discovered-from` dependency on an issue labeled `in-pr`, or the code to fix doesn't exist on `main`), use that branch as the base instead of `origin/main`. Commit directly to it — do not create a new branch or PR.

---

## Branch Mode

All work uses branches and PRs. Uses worktree isolation for subagents.

### 1. Setup

**Always branch from `origin/main` unless explicitly directed otherwise by the prompt.** Fetch first to ensure it's up to date:

```bash
git fetch origin main
git branch feature/<work-name> origin/main
```

Then enter a worktree:

```
EnterWorktree(name: "<work-name>")
```

The coordinator works from its worktree for the rest of the session.

If your project requires per-worktree dependency setup (symlinks, lockfile resolution, generated files), run that here. Document the steps in CLAUDE.md so they stay in sync with project changes.

### 2. Conflict Avoidance

Before parallelizing tasks, analyze file overlap:

Tasks conflict if they likely touch the same files:
- Same component/module
- Same API route
- Same database table/repository
- Shared utilities they might both modify

```
Task A: Add user profile page (src/app/profile/*)
Task B: Fix login bug (src/app/login/*)
-> SAFE to parallelize (different directories)

Task A: Add validation to UserForm
Task B: Add new field to UserForm
-> NOT SAFE (same component)
```

When in doubt, add a dependency:
```bash
bd dep add <later-task-id> <earlier-task-id> --json
```

### 3. Implement Tasks

**Follow the dependency graph from beads.** Spawn all currently-unblocked tasks in parallel. When a task completes, check if any blocked tasks are now unblocked and spawn those.

For each task:

#### a. Claim

```bash
bd update <task-id> --set-labels wip --json
```

#### b. Spawn Implementer Subagent

Use the Agent tool with `isolation: "worktree"` and `model: "sonnet"`:

```
ROLE: Implementer
SKILL: Read and follow .claude/skills/implementer/SKILL.md

TASK: <task-id>
Read the task description: bd show <task-id> --json
```

#### c. Handle Result

The implementer's final output is a structured summary (Phase 5). Only read that summary — ignore intermediate tool output from the subagent.

The agent result includes `worktree_path` and `branch` when changes were made.

**On SUCCESS:** integrate into the feature branch (sequential — do NOT run in parallel with other integrations).

Try fast-path rebase first (inline — no subagent):

```bash
cd <worktree_path>
git rebase feature/<work-name> && \
  git branch -f feature/<work-name> HEAD && \
  echo "REBASE: OK"
```

After successful rebase, clean up:

```bash
git worktree remove <worktree_path> --force 2>/dev/null
git branch -D <branch> 2>/dev/null
```

If the rebase fails (conflict), abort and spawn the rebase subagent. Do NOT use `isolation: "worktree"` — the rebase agent enters the implementer's existing worktree:

```bash
git rebase --abort
```

```
ROLE: Rebase Agent (Conflict Resolution)
SKILL: Read and follow .claude/skills/rebase/SKILL.md

SOURCE: <branch>
TARGET: feature/<work-name>
WORKTREE: <worktree_path>
CLEANUP: true
BEADS_IDS: <task-id>
```

**After successful integration** (either path):

```bash
bd close <task-id> --reason "Implemented" --json
```

Triage the "Concerns" section:
- **Bugs or broken behavior introduced by this task** — must be fixed before the PR ships. File an issue, spawn an implementer, and fix it on the feature branch.
- **Low-priority, non-behavioral issues** (naming nits, future optimization ideas, minor code smells) — file as follow-up issues.
- **Anything ambiguous** — ask the user whether to fix now or defer.

**On rebase subagent FAILURE:**

- Spawn a new implementer in a fresh worktree to resolve the conflict
- If blocked: note the blocker, move to next task
- Do NOT close the task

### 4. Pre-PR Review

Reviews are **optional** for small, isolated changes (single-file fixes, typo corrections, config tweaks). For anything of any complexity — multi-file changes, new features, behavioral changes, refactors — reviews are **required**.

After all tasks are merged into the feature branch, run 3 specialized reviews **in parallel**. Each reviewer enters the coordinator's worktree (do NOT use `isolation: "worktree"`):

**Correctness Reviewer:**

```
ROLE: Correctness Reviewer
SKILL: Read and follow .claude/skills/reviewer-correctness/SKILL.md

WORKTREE: <coordinator's worktree path>
BASE: origin/main
SUMMARY: <what this PR implements>
```

**Test Quality Reviewer:**

```
ROLE: Test Quality Reviewer
SKILL: Read and follow .claude/skills/reviewer-tests/SKILL.md

WORKTREE: <coordinator's worktree path>
BASE: origin/main
SUMMARY: <what this PR implements>
```

**Architecture Reviewer:**

```
ROLE: Architecture Reviewer
SKILL: Read and follow .claude/skills/reviewer-architecture/SKILL.md

WORKTREE: <coordinator's worktree path>
BASE: origin/main
SUMMARY: <what this PR implements>
REFERENCE DIRS: <key directories in the existing codebase to compare against>
```

**Handle review results:**

- **Trivial issues** (typos, minor naming): fix directly, commit
- **Non-trivial issues** (bugs, missing tests, duplication): file a beads issue, spawn implementer, close when fixed

After all issues resolved, run a test-runner sub-agent for **epic-level acceptance tests** (if the epic defined them) using `model: "haiku"`. Pull the test commands from the **Quality Gates** table in CLAUDE.md:

```
ROLE: Test Runner
SKILL: Read and follow .claude/skills/test-runner/SKILL.md

WORKTREE: <coordinator's worktree path>
COMMANDS:
- <acceptance test commands if the epic defined them>
```

**Skip the test-runner** if the epic has no acceptance tests. **Do NOT create PR if the test-runner reports FAIL.** Fix locally first (spawn implementer if non-trivial).

### 5. Create PR, Monitor CI, and Hand Off

Run quality gates per the **Quality Gates** table in CLAUDE.md before creating the PR. Delegate to a test-runner sub-agent so verbose output doesn't pollute the coordinator's context.

**Do NOT create PR if any gate fails.** Fix locally first.

**PR description guidelines:**

- The summary should explain _why_ the change exists, not restate the diff. Reviewers can read the code.
- Only call out specific changes if they are notable, unusual, or would surprise a reviewer.
- Add additional sections (e.g., "Manual steps required") only when relevant.

```bash
git push -u origin feature/<work-name>

gh pr create --title "<type>: <title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points explaining *why* this change exists>

## Test plan
- [ ] Tests pass
- [ ] <manual verification steps if any>

Beads: <comma-separated list of all beads issue IDs included in this PR>

Generated with Claude Code
EOF
)"
```

**After creating the PR, monitor CI:**

```bash
gh pr checks <number> --watch
```

**If CI fails:**

1. Fetch failure logs:
   ```bash
   gh run view <run-id> --log-failed
   ```
2. **Trivial fix** (single-line, obvious test typo): fix inline, commit, push.
3. **Non-trivial fix**: spawn an implementer in the coordinator's worktree to fix the failures, then push:
   ```bash
   git push
   ```
4. Re-run `gh pr checks <number> --watch` and repeat until CI passes.

**After CI passes:**

1. If user indicated review needed (e.g., "review this", "flag for review", or high-risk changes like auth/infra/migrations):
   ```bash
   gh pr edit <number> --add-label "needs-human-review"
   ```
2. Label beads issues as `in-pr`:
   ```bash
   bd update <id> --set-labels in-pr --json
   ```
3. Report: "PR #X opened. CI passing. `/merge` will handle merging."

**Do NOT** merge. The `/merge` agent handles all merging.

**Do NOT** clean up worktrees or branches. The `/merge` agent does this after successful merge, since worktrees may be needed for rebases.

---

## Anti-Patterns

- Committing directly to main (branch is protected — all changes require a PR)
- Creating a new branch/PR for a fix that belongs on an existing feature branch
- Starting dependent task before blocker is closed
- Parallelizing tasks that touch the same files (use Conflict Avoidance section above)
- Running task integrations in parallel (must be sequential for linear history)
- Creating PR before running specialized reviews
- Creating PR with failing tests
- Shipping known bugs as follow-up issues — bugs introduced by the current work must be fixed before the PR ships
- Spawning a rebase subagent when fast-path succeeds
- Fixing non-trivial review issues inline — file issues and spawn implementers instead
- Running quality gates directly in coordinator context — always delegate to test-runner sub-agents
- Merging PRs (that's `/merge`'s job)
- Handing off to `/merge` before CI passes — coordinator owns CI failures and must fix them
- Cleaning up worktrees before merge (that's `/merge`'s job)
- Manually creating worktrees with `git worktree add` — use `EnterWorktree` or `isolation: "worktree"`
- Using `isolation: "worktree"` for rebase/reviewer/test-runner agents — they enter existing worktrees
