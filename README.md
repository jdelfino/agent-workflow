# agent-workflow

Production-grade, agent-friendly development workflow for any GitHub project.

## The Problem

AI coding agents forget instructions as context grows. They skip tests, commit to main, bundle unrelated changes, and add unnecessary dependencies. Better prompts help but are fundamentally probabilistic.

The solution isn't better instructions — it's **structural enforcement**. A development environment where the rules are enforced by the platform, not by the agent's memory.

## What You Get

**Two commands:**
- `/plan <description>` — Collaboratively decompose work into GitHub Issues with sub-issues and dependencies
- `/work <issue-number>` — Implement, review, fix, and merge — all from one command

**Automated review:** Three specialized reviewers (correctness, tests, architecture) run on every PR via GitHub Actions, filing findings as child issues.

**Guardrail checks:** Deterministic checks that catch common agent mistakes — scope creep, missing tests, unauthorized dependencies, API surface changes, commit message format.

**Auto-merge:** When all checks pass and no blocking issues remain, PRs merge automatically.

## Quick Start

```bash
# Install into your project
curl -fsSL https://raw.githubusercontent.com/jdelfino/agent-workflow/main/install.sh | bash

# Configure branch protection and required checks
./setup.sh
```

## How It Works

### Planning
```
you> /plan "Add rate limiting to the API"
```

Claude explores your codebase, discusses tradeoffs, then creates a parent issue with child tasks — each scoped to a single agent session.

### Implementation
```
you> /work #20
```

The coordinator creates a branch, works through unblocked child tasks, opens a PR. Leaf tasks get implemented by a test-first implementer agent. Non-leaf issues orchestrate their children recursively.

### Automated Review

When a PR is opened, three reviewers run in parallel:
- **Correctness** — bugs, error handling, security issues
- **Tests** — coverage, edge cases, test quality
- **Architecture** — duplication, pattern consistency, unnecessary complexity

Findings are filed as child issues. Blocking findings prevent merge.

### Guardrails

Deterministic checks run on every PR:
- **Scope enforcement** — flags changes to files not listed in the task
- **Test-to-code ratio** — configurable threshold (default: 0.5)
- **Dependency changes** — flags new dependencies without justification
- **API surface changes** — flags changes to exports and public interfaces
- **Commit messages** — enforces conventional commit format

### Merge

When all checks pass and no blocking issues remain, auto-merge proceeds. A human can override any guardrail by approving the PR — the approval serves as acknowledgment that the violations are acceptable.

## Architecture

The system has five layers:

1. **Enforcement** — GitHub branch protection, required status checks
2. **Intelligence** — Claude Code skills for planning, implementation, and review
3. **Orchestration** — GitHub Actions wiring events to skills
4. **Guardrails** — Deterministic checks reporting via GitHub Check Runs
5. **Human escalation** — PR approval as universal override

See [docs/design.md](docs/design.md) for the full design document.

## Configuration

After installation, configure guardrails in `.github/agent-workflow/config.yaml`:

```yaml
re-review-cycle-cap: 3

guardrails:
  scope-enforcement:
    enabled: true
    conclusion: action_required
  test-ratio:
    enabled: true
    conclusion: action_required
    threshold: 0.5
  dependency-changes:
    enabled: true
    conclusion: action_required
  api-surface:
    enabled: true
    conclusion: action_required
  commit-messages:
    enabled: true
    conclusion: neutral  # warning only
```

## Requirements

- GitHub repository
- [Claude Code](https://claude.ai/code) CLI installed
- `gh` CLI authenticated with repo access
- `ANTHROPIC_API_KEY` as a GitHub Secret (for automated reviews)

## License

MIT
