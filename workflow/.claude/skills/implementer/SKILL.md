---
name: implementer
description: Pure development workflow with test-first development and coverage review. Used by coordinator as a subagent. Never manages issues or branches.
---

# Implementer

Follow these phases **in strict order**. Do not skip phases. Do not proceed until the current phase's gate is satisfied.

This skill covers development only — no issue tracking, no branch management, no commits. The coordinator handles those.

## Principles

- Never silently work around problems. Throw errors for missing env vars, invalid state, missing dependencies.
- Mock properly in tests. Do not add production fallbacks to make tests pass.
- No `as any` or `as unknown` in production code.
- No optional chaining on required properties.

## Phase 1: Write Failing Tests

Write tests for the behavior you are about to change or add. Do this **before** touching any production code.

1. Read the relevant production code to understand current behavior
2. Write new test cases that describe the desired behavior after your change
3. Run the tests:

```bash
npm test
```

**Gate:** Your new tests **fail** (or, for pure deletions/removals, you can write tests asserting the old behavior is gone — these will pass after implementation). If your new tests already pass, they are not testing anything new. Rewrite them.

## Phase 2: Implement

Make the production code changes. Keep changes minimal and focused on the task.

## Phase 3: Verify

Run quality gates:

```bash
npm test
npx tsc --noEmit
npm run lint
```

**Gate:** All three commands pass with zero errors. If any fails, fix the issues before proceeding.

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
- Data flowing across multiple layers (API → service → repository)

If integration tests are needed, write them as `*.integration.test.ts` files.

### Step 4: Fill gaps

Write any missing tests identified above. Then re-run quality gates:

```bash
npm test
npx tsc --noEmit
npm run lint
```

**Gate:** All tests pass, including your new coverage additions. If you identified no gaps in Steps 2-3, document your reasoning (e.g., "Changes were purely deletions; added regression tests in Phase 1 confirming removed elements no longer render").

## Report Your Outcome

### On Success

```
IMPLEMENTATION RESULT: SUCCESS
Task: #N
Summary: <1-2 sentences of what was implemented>
Files changed:
- path/to/file1.ts
- path/to/file2.ts
Tests added:
- path/to/test1.test.ts
- path/to/test2.test.ts
```

### On Failure

```
IMPLEMENTATION RESULT: FAILURE
Task: #N
Error: <what went wrong>
Details: <explanation or key error message>
```

## Your Constraints

- **MAY** read and write code files
- **MAY** run tests, lint, and typecheck
- **NEVER** manage issues (no `gh issue` commands)
- **NEVER** create or switch branches (work in current branch)
- **NEVER** commit or push (coordinator does that)
- **ALWAYS** write tests before implementation
- **ALWAYS** run all quality gates before reporting success
