# CLAUDE.md

## Project Overview

Agent-workflow: a reusable framework that gives any GitHub project a production-grade, agent-friendly development workflow. Two commands (`/plan`, `/work`), automated review via GitHub Actions, guardrail checks, and auto-merge.

## Repository Structure

```
agent-workflow/
├── workflow/                     # Files copied by the installer into target projects
│   ├── .claude/
│   │   ├── skills/               # Agent skill prompts (7 skills)
│   │   └── commands/             # Slash commands (/plan, /work)
│   ├── .github/
│   │   ├── workflows/            # GitHub Actions (review, orchestrator, guardrails)
│   │   ├── agent-workflow/       # Workflow configuration
│   │   └── ISSUE_TEMPLATE/       # Issue templates for tasks and review findings
│   └── CLAUDE.md                 # Starter CLAUDE.md for target projects
├── install.sh                    # curl-able installer
├── setup.sh                      # Branch protection setup via gh api
├── docs/
│   └── design.md                 # Full design document
└── README.md
```

## Key Design Decisions

- **GitHub Issues with sub-issues** for task hierarchy and dependency tracking
- **Hierarchical branching** — branch structure mirrors issue structure
- **Leaf tasks commit to parent branch** (no sub-branch per leaf)
- **PR approval as universal override** for guardrail checks
- **Two commands only:** `/plan` and `/work`

## Design Reference

See [docs/design.md](docs/design.md) for the full architecture and rationale.
