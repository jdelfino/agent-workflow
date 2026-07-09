---
name: implementer
description: Pure development workflow with required test coverage and a coverage audit. Used by coordinator as a subagent. Commits work but never manages beads issues.
---

# Implementer

Work through these phases in order. Don't skip a phase's gate.

This skill covers development only — no issue tracking, no pushes. The coordinator handles those.

## Principles

- Never silently work around problems. Throw errors for missing env vars, invalid state, missing dependencies.
- Mock properly in tests. Do not add production fallbacks to make tests pass.
- No type casts that bypass the type system.
- No optional chaining on required properties.
- **Every production code change requires tests.** No exceptions for migrations, refactors, copy-paste, or "just wiring things up." If you wrote or modified production code, you must write tests for it. Never defer tests to a follow-up issue.
- **Test cases from the issue are your spec.** When the planner has defined concrete test cases on the task, implement those first, then add high-value coverage for gaps.
- **Delegate quality-gate runs to a test-runner sub-agent.** Verbose test output consumes your context window — see Phase 2.
- **If your project enforces lint/typecheck via git hooks** (e.g., lefthook, husky), do not re-run those gates manually. Focus on tests in Phase 3 and let the hooks do their job at commit/push time.
- **If a hook blocks a tool call, stop.** Never work around it with scripts, `sed`, or other indirect tricks. Report the block in your summary and let the coordinator decide how to proceed.

## Phase 1: Implement & Test

Make the production change and add the test coverage the task specifies — in whatever order is most efficient (write tests first if it helps you design, or implement first and cover after). Keep changes minimal and focused on the task.

1. Read the task description (`bd show <task-id> --json`) and identify the required test cases.
2. Read the relevant production code to understand current behavior.
3. Make the change and implement each specified test case. Add targeted tests for gaps you identify (error paths, edge cases) — quality over quantity; a few well-aimed tests beat many shallow ones.

**Test documentation:** Planned and critical tests (integration, e2e, non-obvious unit tests) should include a docstring answering: what contract is verified, why it matters, what breaks if violated. Tests with descriptive names in table-driven style are often self-documenting — use judgment.

**Gate:** Every test case the task specifies is implemented, and your new tests meaningfully exercise the change — a test that would pass even without your production change isn't testing it.

## Phase 2: Verify

**Delegate quality-gate runs to a test-runner sub-agent** to preserve your context window. Do NOT run these commands directly with the Bash tool — test output is verbose and wastes context you need for later phases. Use the Task tool with `subagent_type: "Bash"` and `model: "haiku"`:

```
ROLE: Test Runner
SKILL: Read and follow .claude/skills/test-runner/SKILL.md

WORKTREE: <worktree-path>
COMMANDS:
- <test commands from the Quality Gates table in CLAUDE.md matching changed code>
```

**Only run gates not already enforced by git hooks.** If your project's pre-commit/pre-push hooks already run lint/typecheck/unit-test, do not duplicate them here — your gate runs should focus on what's *not* in the hooks (typically integration and e2e tests).

**Gate:** Sub-agent reports PASS. If FAIL, read the error summary, fix the issue, and re-delegate. Only run quality gates directly in your own context if you need to debug a failure interactively.

After Phase 2 (Verify) passes, stage and commit all your changes on the current branch.

## Phase 3: Test Coverage Audit

This is an audit, not a formality. Evaluate whether your tests actually cover the changes you made.

### Step 1: List what changed

```bash
git diff --name-only
```

Separate the output into production files and test files.

### Step 2: For each changed production file, evaluate

- **What behavior changed?** (new feature, bug fix, removed feature, refactored logic)
- **What existing tests cover this file?** Read the corresponding test file if one exists.
- **Are there gaps?** Specifically:
  - Happy path for new/changed behavior
  - Error paths and edge cases
  - Regression test if this is a bug fix (a test that would have caught the original bug)
  - Boundary conditions

### Step 3: Evaluate integration test needs

Integration tests are needed when changes affect:
- Repository/persistence layer (database queries, data mapping)
- API routes that combine multiple services
- Auth flows or permission checks
- Data flowing across multiple layers

If integration tests are needed, write them.

### Step 4: Fill gaps

Write any missing tests identified above. Then re-run quality gates via the test-runner sub-agent.

**Gate:** All tests pass, including your new coverage additions. If you identified no gaps in Steps 2-3, document your reasoning (e.g., "Changes were purely deletions; added regression tests in Phase 1 confirming removed elements no longer render").

## Phase 4: Summary

**This must be the very last thing you output.** The coordinator reads your result — keep it concise to avoid polluting its context.

Produce exactly this and nothing else after it:

```
IMPLEMENTATION RESULT: SUCCESS | FAILURE

Task: <task-id or "N/A" if not provided>
Commit: <full commit hash, or "N/A" on failure>

## What changed
- <1 bullet per logical change, max 5>

## Files modified
- <path> — <what changed in 1 phrase>

## Test coverage
- <1 bullet per test file added/modified, what it covers>

## Concerns
- <anything the coordinator should know, or "None">
```

If implementation failed, replace "What changed" with:

```
## Error
<what went wrong — 1-3 sentences>

## Attempted
- <what you tried>
```
