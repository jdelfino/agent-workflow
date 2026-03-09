# agent-workflow

An agent-friendly development workflow for [Claude Code](https://claude.ai/code). Decomposes large changes into small, focused tasks that fit comfortably within a context window, then orchestrates those tasks to complete bigger chunks of work. Three commands, specialized review agents, and structured issue tracking.

## What You Get

**Four commands:**
- `/plan <description>` — Collaboratively design, review, and refine an approach, then decompose it into issues with dependencies
- `/work <id>` — Implement, review, and open a PR per bead — all from one command. Human merges.
- `/merged [branch]` — After merging a PR on GitHub: closes the bead, removes the worktree, deletes the branch. This unblocks dependent beads.
- `/pr [branch]` — Regenerate or update a PR summary. The coordinator auto-creates PRs; use this to refresh after additional commits.

**Automated pre-PR review:** Three specialized reviewers (correctness, tests, architecture) run in parallel before every PR is created.

**Structured issue tracking:** Uses [beads](https://github.com/jdelfino/beads) (`bd`) for dependency-aware issue tracking that auto-syncs to git.

## Quick Start

1. Copy `.claude/` and `AGENTS.md` into your project
2. Replace `CLAUDE.md` with your project-specific version (see the template in this repo)
3. Install [beads](https://github.com/jdelfino/beads) (see [installation instructions](https://github.com/jdelfino/beads#installation))
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

The coordinator identifies which beads are ready (no open blocking dependencies), creates a dedicated worktree and branch per bead, implements via test-first development (spawning implementer subagents), runs three parallel code reviews, and auto-creates a PR. Dependent beads stay blocked until you merge and run `/merged`.

### Post-merge (`/merged`)

```
you> /merged feature/bd-42-add-users-table
```

After merging a PR on GitHub, run `/merged` with the branch name. It verifies the merge, closes the bead, removes the worktree, and deletes the branch — unblocking any beads that were waiting on it.

## Architecture

### Skills (`.claude/skills/`)

| Skill | Role |
|-------|------|
| **coordinator** | Entry point for `/work`. Triages, sets up worktrees, delegates to implementers, runs reviews, creates PRs. |
| **implementer** | Test-first development. Writes failing tests, implements, verifies, audits coverage. Never manages issues. |
| **planner** | Entry point for `/plan`. Explores codebase, discusses with user, files structured issues. |
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
| `/merged [branch]` | Close bead and clean up after PR is merged |
| `/pr [branch]` | Regenerate or update a PR summary |
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

### Adding Project-Specific Skills

Create new skills in `.claude/skills/<name>/SKILL.md` with a YAML frontmatter header. Reference them from commands in `.claude/commands/`.

## Requirements

- [Claude Code](https://claude.ai/code) CLI
- [beads](https://github.com/jdelfino/beads) (see [installation instructions](https://github.com/jdelfino/beads#installation))
- `gh` CLI (authenticated)
- Git

## License

MIT
