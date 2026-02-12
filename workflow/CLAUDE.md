# CLAUDE.md

This project uses [agent-workflow](https://github.com/jdelfino/agent-workflow) for AI-assisted development.

## Workflow

| Command | Purpose |
|---------|---------|
| `/plan <description>` | Explore codebase, discuss tradeoffs, file GitHub Issues |
| `/work #N` | Implement, fix, or orchestrate children |

See [AGENTS.md](AGENTS.md) for full workflow documentation.

## Project Overview

<!-- TODO: Describe your project here -->

## Key Files

<!-- TODO: List important files and directories -->

## Commands

```bash
# Development
npm run dev

# Testing
npm test

# Quality checks
npm run lint
npx tsc --noEmit
```

## Testing Rules

All production code changes must include tests.

## Issue Tracking

This project uses GitHub Issues with sub-issues and dependencies:
- Sub-issues for task hierarchy (epic → features → tasks)
- `blocked-by` relationships for task ordering
- Labels: `blocking`, `should-fix`, `suggestion` for review findings
