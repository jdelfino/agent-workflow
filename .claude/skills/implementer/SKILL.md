---
name: implementer
description: Pure development workflow with test-first development and coverage review. Used by coordinator as a subagent. Never manages beads issues or commits.
---

# Implementer

Follow these phases **in strict order**. Do not skip phases. Do not proceed until the current phase's gate is satisfied.

This skill covers development only — no issue tracking, no commits, no pushes. The coordinator handles those.

## Principles

- Never silently work around problems. Throw errors for missing env vars, invalid state, missing dependencies.
- Mock properly in tests. Do not add production fallbacks to make tests pass.
- No type casts that bypass the type system.
- No optional chaining on required properties.
- **Every production code change requires tests.** No exceptions for migrations, refactors, copy-paste, or "just wiring things up." If you wrote or modified production code, you must write tests for it. Never defer tests to a follow-up issue.

## Phase 0: Announce Approach

Before writing any code or tests, output a brief statement of your plan. This is informational — do **not** wait for approval. Continue immediately to Phase 1.

```
APPROACH: <task-id or "N/A">
Files to touch: <list of files you expect to modify>
Strategy: <1-3 sentences — what you'll do and why>
Key decisions: <any non-obvious choices, or "N/A">
```

Keep it short. The human may read it async and interrupt only if something looks wrong.

## Phase 1: Write Failing Tests

Write tests for the behavior you are about to change or add. Do this **before** touching any production code.

**This phase is NOT optional.** Common excuses that do NOT exempt you from writing tests:
- "It's just a migration" — migrated code has new integration points that need testing
- "It's just wiring up an API client" — API client calls, error handling, and auth headers need tests
- "The old code didn't have tests" — that's a reason to add them, not skip them
- "I'll add tests later" — no, tests ship with the code, always

1. Read the relevant production code to understand current behavior
2. Write new test cases that describe the desired behavior after your change
3. Run the tests using the appropriate test command (see **Quality Gates** in CLAUDE.md)

**Gate:** Your new tests **fail** (or, for pure deletions/removals, you can write tests asserting the old behavior is gone — these will pass after implementation). If your new tests already pass, they are not testing anything new. Rewrite them.

## Phase 2: Implement

Make the production code changes. Keep changes minimal and focused on the task.

## Phase 3: Verify

Run quality gates matching the code you changed. See the **Quality Gates** table in CLAUDE.md for all targets.

**Gate:** All quality gate commands pass with zero errors. If any fails, fix the issues before proceeding.

## Phase 4: Test Coverage Review

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

Write any missing tests identified above. Then re-run quality gates.

**Gate:** All tests pass, including your new coverage additions. If you identified no gaps in Steps 2-3, document your reasoning (e.g., "Changes were purely deletions; added regression tests in Phase 1 confirming removed elements no longer render").

## Phase 5: Summary

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
