# CLAUDE.md

<!-- TODO: Replace this file's placeholder content with your project's details. -->
<!-- Sections marked with TODO need your input. Sections between              -->
<!-- "auto-generated" markers are populated by /configure and can be refreshed -->
<!-- at any time. Pre-populated workflow sections should be kept as-is unless  -->
<!-- you've customized the workflow.                                           -->

## Project Overview

<!-- TODO: Describe your project in 2-3 sentences. What does it do? Who is it for? -->

## Repository Structure

<!-- auto-generated -->
<!-- Run /configure to populate this from your codebase, or fill in manually. -->
<!-- end auto-generated -->

## Commands

<!-- auto-generated -->
<!-- Run /configure to populate this from your codebase, or fill in manually. -->
<!-- end auto-generated -->

## Git Hooks

Pre-commit hooks enforce quality gates on every commit. These commands must be fast (<30s). Slow suites belong in CI, not the hook.

<!-- auto-generated -->
<!-- Run /configure to detect your project's tooling and populate these. -->

| Hook | Command | Description |
|------|---------|-------------|
| Compile | | e.g. `tsc --noEmit`, `go build ./...` — leave blank if no compile step |
| Fast tests | | e.g. `npm test -- --bail`, `pytest -x -q` — unit tests only |
| Lint | | e.g. `npm run lint`, `ruff check .` |

<!-- end auto-generated -->

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
