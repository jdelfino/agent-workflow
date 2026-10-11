# CLAUDE.md

This is a reference implementation of an agent-friendly development workflow for Claude Code. Copy the `.claude/` directory and `AGENTS.md` into your project, then customize this file for your project.

## Customizing for Your Project

Replace this file with your project's CLAUDE.md. It should include:

### Project Overview

Describe your project in 2-3 sentences. What does it do? What's the tech stack?

### Commands

Document your build, test, and lint commands:

```bash
# Examples — replace with your actual commands
make build           # Build the project
make test            # Run all tests
make lint            # Lint all code
```

### Quality Gates

The skills reference a **Quality Gates** table in CLAUDE.md. Define what commands to run for each area of your codebase:

| Area | Tests | Lint | Typecheck |
|------|-------|------|-----------|
| Backend | `make test-api` | `make lint-api` | — |
| Frontend | `npm test` | `npm run lint` | `npx tsc --noEmit` |
| Integration | `make test-integration` | — | — |

**Local vs. CI scope:** Locally, agents run only the **changed package(s) and their dependents** — never the whole monorepo. The full / timing-sensitive suite is **CI's job**, run on push on a clean machine; scoped-local is allowed to miss cross-package breaks by design because CI is the authoritative gate. If your build tool supports affected-scope test selection, put that command in the table above (e.g. `turbo run test --filter=...[origin/main]` — replace for your stack).

### Development Guidelines

Document your project's conventions:
- Testing requirements
- Code style preferences
- Architecture patterns

## Compact Instructions

Keep this section when you replace this file. Claude Code reads it when it compacts the conversation, and the harness treats the result as a handoff (see "Auto-handoff at 256k tokens" in the README). Compaction cannot run skills or tools, so the handoff format lives here as text.

Write the summary so the next agent starts where we ended, not where we began. Assume the reader has no memory of this conversation and cannot ask questions. Use absolute paths. Use these sections in order, writing "none" for an empty one:

```
# Session Handoff: <one-line title>
## Where it started
## Ruled out, do not retry (approach, symptom, root cause)
## Running state (background shell/agent IDs + how to stop, dev servers, worktrees)
## Key files for next session
## Verified this session, and how (each fact with the command/file/probe that proved it)
## Deferred + open questions (each open item with its single next action)
## Pick up here
```

End with this block, filled in:

```
TLDR: <2-4 lines: what exists now, its state, what is blocking; real paths, IDs, branches>
Next: <the single next action, as an instruction>
Do not re-verify anything under "Verified this session", and do not retry anything
under "Ruled out"; both were settled and the reasons are recorded.
```

## Workflow

This project uses an agent-friendly development workflow. Use `/plan` to decompose features into issues and `/work` to implement them. See `AGENTS.md` for full documentation and `.claude/skills/` for agent instructions.
