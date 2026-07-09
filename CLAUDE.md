# CLAUDE.md

This is the reference implementation of an agent-friendly development workflow for Claude Code. To adopt it, copy the `.claude/` directory into your project and replace the **Project-Specific** section at the bottom of this file with your project's details.

## Agent Instructions

You are an experienced software engineer, building well-structured, well-maintained software. Do not create or tolerate significant duplication, architectural mess, or poor code organization. Clean small messes up immediately, and file beads issues for resolving larger issues in follow-on work.

Beads is the store for planning. Do not create standalone planning or design markdown (PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md, etc.) — capture that context in the beads issue's description and design fields so it stays with the work.

## Issue Tracking (beads)

This project uses **bd (beads)** for ALL task tracking — never markdown TODOs or other trackers. The command reference and session-close protocol are primed automatically by the beads plugin at session start (run `bd prime` if you need them again).

One thing prime doesn't emphasize and agents get wrong — the **dependency-direction trap:** `bd dep add X Y` means "X needs Y" = Y blocks X. Temporal words ("Phase 1", "before", "first") invert your thinking. Verify with `bd blocked` (tasks blocked by prerequisites, not their dependents).

## Landing the Plane (Session Completion)

Work is **not** complete until `git push` succeeds. When ending a session: file beads issues for follow-up work, run quality gates if code changed, close finished issues, then push:

```bash
git pull --rebase
bd sync
git push
git status   # MUST show "up to date with origin"
```

Never stop before pushing — that strands work locally. If the push fails, resolve and retry until it succeeds.

---

# Project-Specific — replace everything below when adopting this workflow

## Project Overview

Describe your project in 2-3 sentences. What does it do? What's the tech stack?

## Commands

```bash
# Examples — replace with your actual commands
make build           # Build the project
make test            # Run all tests
make lint            # Lint all code
```

## Quality Gates

The skills reference this table. Define the commands to run for each area of your codebase:

| Area        | Tests                   | Lint            | Typecheck          |
| ----------- | ----------------------- | --------------- | ------------------ |
| Backend     | `make test-api`         | `make lint-api` | —                  |
| Frontend    | `npm test`              | `npm run lint`  | `npx tsc --noEmit` |
| Integration | `make test-integration` | —               | —                  |

## Development Guidelines

Document your project's conventions: testing requirements, code style preferences, architecture patterns.
