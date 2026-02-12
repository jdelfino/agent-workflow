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

<!-- TODO: List your project's key commands, e.g.:
npm install / pip install -e . / go mod download
npm test / pytest / go test ./...
npm run lint / ruff check . / golangci-lint run
-->

## Quality Gates

Quality gates are enforced automatically via pre-commit hooks and CI. See `.pre-commit-config.yaml` and `.github/workflows/` for the configured checks.

## Testing

<!-- TODO: Adjust these guidelines to match your project's testing standards. -->

<!-- Write failing tests first, then implement (TDD). Prefer the narrowest test
that properly covers a change:
- Unit tests for pure logic, calculations, data transformations
- Integration tests for cross-boundary behavior (API routes + DB, service + external API)
- End-to-end tests for critical user flows (login → action → result)

Tests must be deterministic — no flaky tests, no real network calls without mocks. -->

## Key Conventions

<!-- TODO: Add any project-specific conventions (naming, patterns, etc.). -->
<!-- Example:
- Use `camelCase` for variables, `PascalCase` for types/classes
- All API endpoints return `{ data, error }` shape
- Database access only through repository classes
-->

---

## Workflow

This project uses [agent-workflow](https://github.com/jdelfino/agent-workflow). Use `/plan` to decompose features into issues and `/work #N` to implement them. See `.claude/skills/` for detailed agent instructions.

## GitHub Issues Conventions

Work is tracked with GitHub Issues using sub-issues and `blocked-by` dependencies.

- **Epics** are parent issues with child tasks; each child is scoped to one agent session
- **Review findings** are filed as children of the reviewed issue during automated PR review
- Labels: `blocking` (blocks merge), `should-fix` (important, non-blocking), `suggestion` (optional)
- Branches mirror issue hierarchy: `feat/{N}-{slug}`, leaf tasks commit to parent branch
