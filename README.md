# agent-workflow

An agent-friendly development workflow for [Claude Code](https://claude.ai/code). Decomposes large changes into small, focused tasks that fit comfortably within a context window, then orchestrates those tasks to complete bigger chunks of work. Three commands, specialized review agents, and structured issue tracking.

## What You Get

**Three commands:**
- `/plan <description>` — Collaboratively design, review, and refine an approach, then decompose it into issues with dependencies
- `/work <id>` — Implement, review, and open a PR — all from one command
- `/merge` — Process open PRs: merge when CI passes, rebase when behind, file issues for failures

**Automated pre-PR review:** Three specialized reviewers (correctness, tests, architecture) run in parallel before every PR is created.

**Structured issue tracking:** Uses [beads](https://github.com/jdelfino/beads) (`bd`) for dependency-aware issue tracking that auto-syncs to git.

## Quick Start

1. Copy `.claude/` and `AGENTS.md` into your project
2. Replace `CLAUDE.md` with your project-specific version (see the template in this repo)
3. Install [beads](https://github.com/jdelfino/beads): `cargo install beads`
4. Start working: `/plan "Add user authentication"` then `/work <epic-id>`

## How It Works

### Planning (`/plan`)

```
you> /plan "Add rate limiting to the API"
```

The planner explores your codebase, discusses tradeoffs with you, then creates an epic with subtasks — each scoped to a single implementation session, with dependencies between them.

### Implementation (`/work`)

```
you> /work bd-42
```

The coordinator creates a feature branch and worktree, implements tasks via test-first development (spawning implementer subagents), runs three parallel code reviews, then opens a PR.

### Merge Queue (`/merge`)

```
you> /merge
```

Run in a dedicated window. Scans open PRs, merges what's ready (choosing squash vs merge based on commit quality), rebases what's behind, and files issues for CI failures.

## Architecture

### Skills (`.claude/skills/`)

| Skill | Role |
|-------|------|
| **coordinator** | Entry point for `/work`. Triages, sets up worktrees, delegates to implementers, runs reviews, creates PRs. |
| **implementer** | Test-first development. Writes failing tests, implements, verifies, audits coverage. Never manages issues. |
| **planner** | Entry point for `/plan`. Explores codebase, discusses with user, files structured issues. |
| **merge-queue** | Entry point for `/merge`. Merges, rebases, handles CI failures. |
| **reviewer-correctness** | Reviews for bugs, security issues, error handling gaps. |
| **reviewer-tests** | Reviews test quality — meaningful coverage, not just line count. |
| **reviewer-architecture** | Reviews for duplication, pattern divergence, structural issues. |
| **reviewer-plan** | Validates filed issues against codebase before implementation. |
| **playwright-debugging** | Guide for writing and debugging Playwright E2E tests. |

### Commands (`.claude/commands/`)

| Command | Action |
|---------|--------|
| `/work <id>` | Invoke coordinator |
| `/plan <desc>` | Invoke planner |
| `/merge` | Invoke merge queue |
| `/epic <id>` | Redirects to `/work` |
| `/gh-issue <num>` | Work on a GitHub issue end-to-end |

### Issue Tracking (`AGENTS.md`)

Uses [beads](https://github.com/jdelfino/beads) for all task tracking:
- Dependency-aware (tracks blockers between issues)
- Git-friendly (auto-syncs to `.beads/issues.jsonl`)
- Agent-optimized (JSON output, ready work detection)

See `AGENTS.md` for the full beads workflow documentation.

### Settings (`.claude/settings.json`)

- Enables the beads MCP plugin
- Auto-permissions for `bd` and `git` commands
- SessionStart hook loads `AGENTS.md` into every conversation

## Customization

### Quality Gates

The skills reference a **Quality Gates** table in your project's `CLAUDE.md`. Define what commands to run for each area of your codebase. See the CLAUDE.md template in this repo.

### Protected vs. Unprotected Main

By default, the coordinator supports both direct commits (small changes) and branch/PR workflows (larger changes). To require all changes go through PRs, remove the "Direct Mode" section from the coordinator skill and add branch protection to your repo.

### Adding Project-Specific Skills

Create new skills in `.claude/skills/<name>/SKILL.md` with a YAML frontmatter header. Reference them from commands in `.claude/commands/`.

## Requirements

- [Claude Code](https://claude.ai/code) CLI
- [beads](https://github.com/jdelfino/beads) (`cargo install beads`)
- `gh` CLI (authenticated)
- Git

## License

MIT
