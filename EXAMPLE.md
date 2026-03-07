# A Concrete Workflow

This walks through a real feature e2e: **JWT authentication with a login endpoint**. The goal is to make the mental model concrete.

---

## The Core Idea

The context window is the fundamental constraint. A single agent can't hold an entire project in memory. This harness solves that by:

1. **Decomposing** large work into small, self-contained tasks ([beads](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a))
2. **Persisting state outside context windows** — in beads and git, not in any agent's memory
3. **Spawning focused subagents** that each get a clean context window with just enough information to do one thing

Every agent in this system only knows what it was explicitly given at spawn time. The harness — commands, beads, worktrees — is what stitches them together.

---

## Setup — on Project Setup

`CLAUDE.md` — loaded at the start of every agent session. The permanent briefing.

```markdown
# CLAUDE.md

## Project
Node.js REST API. TypeScript, Express, Prisma, PostgreSQL.

## Quality gates (must pass before any PR)
- `npm test`
- `npm run lint`
...etc

## Conventions
- All endpoints in `src/routes/`
...etc

## Never do this
(empty for now — grows as mistakes happen)
This is a feedback loop. When an agent makes a mistake, you add it here so every future agent reads it before starting work.
```

**AGENTS.md** — loaded automatically via a `SessionStart` hook configured in `settings.json`. Every agent session starts knowing what other agents exist and how they interact, without the coordinator needing to pass this manually.

**Model guidance:** The coordinator runs on Opus 4.6 (orchestration decisions require stronger reasoning). Implementer subagents run on Sonnet 4.6 (implementation work is well-scoped enough for a faster model).

---

## Path 1: Full Flow

Use this when you're not sure exactly what needs to be built, or the feature touches multiple files.

### Step 1 — `/plan "add JWT authentication with a login endpoint"`

**What runs:** `.claude/commands/plan.md`

This file is a router. Its only job: receive your description, and tell Claude to load `.claude/skills/planner/SKILL.md`. The command itself has no logic.

**What runs next:** `planner/SKILL.md` loads into the agent's context. Four phases, strictly ordered.

---

**Planner Phase 1 — Explore**

The planner reads your actual codebase before proposing anything. It's looking for: how are other routes structured? What does the existing user model look like? What shared types exist? What would this touch?

This is ground truth collection. The planner is forbidden from writing code or filing issues here.

---

**Planner Phase 2 — Discuss**

The planner surfaces its findings and asks you questions before deciding anything. Things like: refresh tokens or access token only? Cookie or Authorization header? Should login return a user object or just a token?

You answer. It iterates. When you've reached consensus, it writes the agreed plan and pauses for your approval. Nothing gets filed until you say yes.

---

**Planner Phase 3 — File issues**

You approve. The planner creates beads issues:

```
epic: bd-a3f8   "JWT Authentication"
  └── bd-a3f8.1  "Create users table and Prisma schema"
  └── bd-a3f8.2  "POST /login endpoint"                  ← depends on bd-a3f8.1
  └── bd-a3f8.3  "JWT middleware for protected routes"   ← depends on bd-a3f8.2
```

Each task is **self-contained** — the implementer that runs it spawns in a fresh context window with no memory of this conversation. So every task includes: what to build, why, which files to touch, and what done looks like.

Beads stores these as JSONL in `.beads/` — versioned with git, surviving across sessions.

---

**Planner Phase 4 — Plan review**

The planner spawns a subagent:

```
Task(
  prompt: "ROLE: Plan Reviewer
           SKILL: read .claude/skills/reviewer-plan/SKILL.md
           EPIC: bd-a3f8"
)
```

Fresh context window. `reviewer-plan/SKILL.md` loads. This agent reads the filed beads issues *and* the codebase and checks: do tasks follow existing patterns? Are dependencies in the right order? Are there gaps? Is each task self-contained enough for a future implementer?

Returns `APPROVED` or `CHANGES NEEDED` with specific task-level feedback. Planner iterates if needed. Once approved, planning is done.

---

### Step 2 — See what's runnable: `bd ready`

```
$ bd ready
bd-a3f8.1  Create users table and Prisma schema
```

Only `bd-a3f8.1` shows because the other two are blocked by dependencies. Beads surfaces only what can actually run right now — you never have to track the dependency graph yourself.

---

### Step 3 — `/work bd-a3f8` (the epic ID)

You pass the epic ID. The coordinator handles sequencing of all subtasks.

**What runs:** `.claude/commands/work.md`

Router. Runs `bd show bd-a3f8 --json` and `bd list --parent bd-a3f8 --json` to fetch the epic and all subtasks from beads. Then: load `coordinator/SKILL.md`.

**What runs next:** `coordinator/SKILL.md` (running on Opus 4.6)

The coordinator reads all three tasks and their dependencies. Before anything else, it:

1. **Installs dependencies** — runs `npm install` (or equivalent) in the main repo. This must happen before spawning any subagents so they have a working environment.
2. **Analyzes file overlap** — checks which files each task will touch. Tasks that share files must run sequentially. Tasks with no overlap can run in parallel. Since this chain has strict dependencies, all three run sequentially.
3. **Creates one worktree and one branch** for the entire work unit:

```bash
git worktree add ../myapp-jwt-authentication -b feature/jwt-authentication
```

One branch. All three subtasks will accumulate commits here. One PR at the end. No merges between subtasks.

---

**Coordinator — Task bd-a3f8.1 (users table)**

**Spawn implementer subagent** (Sonnet 4.6):

```
Task(
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: "ROLE: Implementer
           SKILL: read .claude/skills/implementer/SKILL.md
           WORKTREE: ../myapp-jwt-authentication
           TASK: bd-a3f8.1"
)
```

New agent. Clean context window. It wakes up knowing only these four things. `implementer/SKILL.md` loads. Five phases, strictly ordered:

- **Phase 1 — Write failing tests.** Before touching the schema, write tests that describe the desired behavior. They fail because nothing exists yet. No exceptions, ever.
- **Phase 2 — Implement.** Create the Prisma schema and migration. Make the tests pass.
- **Phase 3 — Verify.** Run all quality gate commands from `CLAUDE.md`. Zero errors required.
- **Phase 4 — Coverage review.** Run `git diff --name-only` to see what changed. Map changes to tests. Find gaps (error cases, edge cases). Write missing tests. Rerun quality gates.
- **Phase 5 — Summary.** Output structured result: what changed, what was tested, any concerns. Return to coordinator.

**Spawn 3 reviewers in parallel** (skipped for single-file or config-only changes):

```
Task → SKILL: reviewer-correctness/SKILL.md   ─┐
Task → SKILL: reviewer-tests/SKILL.md          ├─ simultaneous
Task → SKILL: reviewer-architecture/SKILL.md  ─┘
```

Three fresh context windows. Each reads its SKILL.md and the git diff since the last commit:

- **Correctness**: is the logic right? Any edge cases missed?
- **Tests**: are the tests actually testing behavior, or just line coverage?
- **Architecture**: does this fit existing patterns? Structural concerns?

**Coordinator processes review findings:**

- **Trivial issues** (typos, minor naming) → coordinator fixes directly, commits to the same branch
- **Non-trivial issues** (bugs, missing tests, duplication) → coordinator files a beads issue, spawns an implementer to fix it, closes the issue when done

No PR yet. bd-a3f8.1 work is committed to `feature/jwt-authentication`. The coordinator moves on to the next task in the same worktree.

---

**Coordinator — Tasks bd-a3f8.2 and bd-a3f8.3**

Same cycle for each remaining task: claim → spawn implementer → run reviewers → process findings. The coordinator already knows the full task list and dependency order from the initial `bd list --parent` call — it doesn't poll `bd ready` between tasks.

Since all three tasks share the same worktree (`../myapp-jwt-authentication`), each implementer picks up where the previous one left off. Commits accumulate on `feature/jwt-authentication`.

After all three tasks are complete, the coordinator runs quality gates one final time, pushes the branch, and creates a single PR covering the entire epic.

---

### Step 4 — `/merge`

Separate command, separate agent. `merge-queue/SKILL.md` loads. Eight steps:

1. **Scan** — check CI status on `main` (failing main blocks everything), list all open PRs
2. **Categorize** — each PR is: ready to merge, awaiting review, CI pending, CI failing, or needs rebase
3. **Decide merge order** — when multiple PRs are ready, prioritize by impact and conflict risk
4. **Choose strategy per PR** — inspect commit quality: squash (messy/WIP commits), merge commit (clean distinct commits worth preserving), or rebase cleanup (mixed quality)
5. **Merge** — execute the chosen strategy, close beads issues referenced in the PR body, remove worktree, delete feature branch, pull main
6. **Rebase** — PRs behind main get rebased; trivial conflicts resolved inline, non-trivial filed as issues
7. **Handle CI failures** — fetch failure logs, file a beads issue with details, never rerun (test failures are real)
8. **Report** — summary of all PR states with beads issue IDs for any work that needs `/work`

The coordinator does not own CI or merging. The merge agent does. This is an explicit boundary.

---

## Path 2: Lightweight (small, well-understood tasks)

Use this when you already know exactly what needs to be built and don't need the planning ceremony.

```
/work "add rate limiting to the login endpoint"
```

The coordinator sees this isn't a beads ID. It runs:

```bash
bd create "add rate limiting to the login endpoint" -t feature --json
```

Creates a bead on the fly, then runs the full cycle — installs dependencies, creates worktree, spawns implementer, runs reviewers (unless it's a single-file change), creates PR. Same output as the full path, just without the planning ceremony.

The two paths compared:

```
Full ceremony (big/uncertain):
  /plan → discuss → beads filed → reviewer-plan → /work <epic-id>

Lightweight (small/clear):
  /work "description" → coordinator creates bead inline → implements
```

---

## Full picture in one view

```
/plan "JWT authentication"
  → plan.md (router)
  → planner/SKILL.md (Opus 4.6)
      Phase 1: explore codebase
      Phase 2: discuss with you → AskUserQuestion
      Phase 3: file beads issues (bd-a3f8.1, .2, .3 with dependencies)
      Phase 4: Task → reviewer-plan/SKILL.md → APPROVED

/work bd-a3f8  (epic ID — coordinator handles all subtasks)
  → work.md (router, fetches epic + subtasks from beads)
  → coordinator/SKILL.md (Opus 4.6)
      install dependencies
      create ONE worktree + branch: feature/jwt-authentication
      analyze file overlap → run tasks sequentially (chain dependency)
      For each task (in dependency order, same worktree):
        Task → implementer/SKILL.md (Sonnet 4.6)
                  write failing tests → implement → verify → coverage review → summary
        Task → reviewer-correctness/SKILL.md  ─┐
        Task → reviewer-tests/SKILL.md         ├─ parallel
        Task → reviewer-architecture/SKILL.md ─┘
        fix trivial findings, file issues for non-trivial
      after all tasks: push branch, open ONE PR

/merge
  → merge-queue/SKILL.md
      scan PRs → categorize → choose strategy → merge/rebase → report
```

Every box is either a file loaded into a context window, or a fresh subagent spawned via the Task tool. Nothing is implicit. Every agent's behavior is determined entirely by which SKILL.md it was told to read at the moment it was spawned.