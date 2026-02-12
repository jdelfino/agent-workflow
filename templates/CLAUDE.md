# CLAUDE.md

<!-- TODO: Replace this file's placeholder content with your project's details. -->
<!-- Sections marked with TODO need your input. Pre-populated sections describe -->
<!-- the agent-workflow conventions and should be kept as-is unless you've -->
<!-- customized the workflow. -->

## Project Overview

<!-- TODO: Describe your project in 2-3 sentences. What does it do? Who is it for? -->

## Repository Structure

<!-- TODO: List the key directories and files an agent needs to know about. -->
<!-- Example:
```
src/
├── api/          # REST API routes
├── models/       # Database models
├── services/     # Business logic
└── utils/        # Shared helpers
tests/
├── unit/
└── integration/
```
-->

## Commands

<!-- TODO: Fill in the commands for your project. Remove any that don't apply. -->

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Quality Gates

<!-- TODO: List the checks that must pass before code is merged. -->
<!-- These should match your CI pipeline and pre-commit hooks. -->

| Gate | Command | Required |
|------|---------|----------|
| Tests | `npm test` | Yes |
| Lint | `npm run lint` | Yes |
| Type check | `npx tsc --noEmit` | Yes |
| Build | `npm run build` | No |

## Testing Rules

<!-- TODO: Adjust these rules to match your project's testing standards. -->

- All production code changes must include tests.
- Prefer unit tests; use integration tests for cross-boundary behavior.
- Tests must be deterministic (no flaky tests, no network calls without mocks).

## Key Conventions

<!-- TODO: Add any project-specific conventions (naming, patterns, etc.). -->
<!-- Example:
- Use `camelCase` for variables, `PascalCase` for types/classes
- All API endpoints return `{ data, error }` shape
- Database access only through repository classes
-->

---

## Workflow

This project uses [agent-workflow](https://github.com/jdelfino/agent-workflow) for AI-assisted development.

| Command | Purpose |
|---------|---------|
| `/plan <description>` | Explore codebase, discuss tradeoffs, create GitHub Issues |
| `/work #N` | Implement a task, fix review findings, or orchestrate child issues |

### How It Works

- **`/plan`** decomposes a feature into a parent issue with child task issues, each scoped to a single agent session.
- **`/work #N`** creates a branch and PR for issue N, then implements leaf tasks or delegates to child issues recursively.
- **Automated reviewers** run on every PR, filing review findings as child issues with severity labels.
- **Guardrail checks** enforce scope, test coverage, dependency hygiene, and other structural rules.
- **Auto-merge** proceeds when all checks pass and no blocking issues remain.

See the skill files in `.claude/skills/` for detailed agent instructions.

## GitHub Issues Conventions

This project uses GitHub Issues with sub-issues and dependencies to track all work.

### Issue Hierarchy

```
#10 Epic / Feature          (parent issue — gets a branch and PR)
 ├── #11 Task               (child — scoped to one agent session)
 ├── #12 Task               (child — blocked by #11)
 ├── #13 Task               (child — blocked by #12)
 ├── #20 Review finding      (created by automated review)
 └── #21 Review finding      (created by automated review)
```

### Issue Types

- **Task issues** are created during `/plan`. Each is a discrete unit of work with clear acceptance criteria and dependency relationships.
- **Review finding issues** are created by reviewer agents during PR review. They are children of the parent issue being reviewed.
- **Follow-up issues** are non-blocking improvements (`should-fix`, `suggestion`) that remain in the backlog.

### Labels

| Label | Meaning |
|-------|---------|
| `blocking` | Critical review finding — blocks PR merge |
| `should-fix` | Important but non-blocking review finding |
| `suggestion` | Optional improvement identified during review |

### Dependencies

- **Parent/child:** Native GitHub sub-issues
- **Task ordering:** Native `blocked-by` relationships (set during planning)
- **Review blocks parent:** `blocking` label + native dependency (set by reviewers)

### Branching Model

Branch hierarchy mirrors issue hierarchy:

- Non-leaf issues get a branch: `feat/{N}-{slug}` off the parent's branch (or `main`)
- Leaf tasks commit directly to their parent's branch
- PRs target the parent's branch and include `fixes #N`
