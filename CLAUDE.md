# CLAUDE.md

## Project Overview

Agent-workflow: a reusable framework that gives any GitHub project a production-grade, agent-friendly development workflow. Two commands (`/plan`, `/work`), automated review via GitHub Actions, guardrail checks, and auto-merge.

## Repository Structure

```
agent-workflow/
├── .claude/
│   ├── skills/                   # Agent skill prompts (8 skills)
│   │   ├── coordinator/          # /work entry point
│   │   ├── planner/              # /plan entry point
│   │   ├── implementer/          # Test-first development (subagent)
│   │   ├── github-issues/        # GitHub API reference for sub-issues/deps
│   │   ├── reviewer-correctness/ # Bugs, security, error handling
│   │   ├── reviewer-tests/       # Test quality and coverage
│   │   ├── reviewer-architecture/# Duplication, patterns
│   │   └── reviewer-plan/        # Plan validation
│   └── commands/                 # Slash commands (/plan, /work, /configure)
├── .github/
│   ├── workflows/                # GitHub Actions (review, orchestrator, guardrails)
│   ├── agent-workflow/           # Workflow configuration
│   └── ISSUE_TEMPLATE/           # Issue templates for tasks and review findings
├── templates/
│   └── CLAUDE.md                 # Starter CLAUDE.md for target projects
├── install.sh                    # curl-able installer (copies files only)
├── docs/
│   └── design.md                 # Full design document
└── README.md
```

## Key Design Decisions

- **GitHub Issues with sub-issues** for task hierarchy and dependency tracking
- **Hierarchical branching** — branch structure mirrors issue structure
- **Leaf tasks commit to parent branch** (no sub-branch per leaf)
- **PR approval as universal override** for guardrail checks
- **Three commands:** `/plan`, `/work`, and `/configure`

## Design Reference

See [docs/design.md](docs/design.md) for the full architecture and rationale.
