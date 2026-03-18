# agent-workflow

An agent-friendly development workflow for [Claude Code](https://claude.ai/code). Decomposes large changes into small, focused tasks that fit comfortably within a context window, then orchestrates those tasks to complete bigger chunks of work. Three commands, specialized review agents, and structured issue tracking.

## What You Get

**Five commands:**
- `/plan <description>` — Collaboratively design, review, and refine an approach, then decompose it into issues with dependencies
- `/work <id>` — Implement, review, and open a PR — all from one command
- `/merge` — Process open PRs: merge when CI passes, rebase when behind, file issues for failures
- `/bug <description>` — Investigate a bug methodically, file an issue with root cause, then fix it
- `/fire` — Emergency stop: dump all context into a beads issue so a fresh agent can resume

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
| **rebase** | Conflict resolution specialist. Invoked by coordinator and merge-queue when fast-path rebase fails. |
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
| `/bug <desc>` | Investigate and fix a bug |
| `/fire` | Emergency agent handoff |
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

## GitHub App Identity (Optional)

Give the agent its own GitHub identity instead of using your personal credentials. PRs are authored by the app, and you review/approve them as yourself.

**Benefits:**
- Sandboxed permissions — scoped to specific repos with specific access
- Clean separation — agent PRs require your approval to merge
- No personal tokens in devcontainers

**Setup:**
```bash
./scripts/setup-github-app.sh [app-name] [owner/repo]
```

The script walks you through creating a GitHub App, generating a private key, and installing it. Idempotent — safe to re-run.

The script handles everything: creates the app, wires a SessionStart hook into `.claude/settings.json` to auto-refresh tokens every session, updates your shell profile so `GH_TOKEN` is always set, and adds secrets to `.gitignore`.

**Token refresh** (called automatically by the SessionStart hook, or manually):
```bash
./scripts/generate-github-app-token.sh
```

**Human review gate:** Copy `.github/workflows/human-review-gate.yml` into your project. Add `human-review-gate` as a required status check in branch protection. PRs labeled `needs-human-review` are blocked until a human approves.

## Requirements

- [Claude Code](https://claude.ai/code) CLI
- [beads](https://github.com/jdelfino/beads) (see [installation instructions](https://github.com/jdelfino/beads#installation))
- `gh` CLI (authenticated, or using a GitHub App token)
- Git

## License

MIT
