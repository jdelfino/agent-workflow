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

### Step 3 — `/work bd-a3f8` (run 1)

**What runs:** `.claude/commands/work.md`

Router. Runs `bd show bd-a3f8 --json` and `bd list --parent bd-a3f8 --json` to fetch the epic and all subtasks from beads. Then: load `coordinator/SKILL.md`.

**What runs next:** `coordinator/SKILL.md` (running on Opus 4.6)

The coordinator reads all three tasks. It immediately filters: which are ready? Only `bd-a3f8.1` has no open blocking dependencies. The other two are blocked. The coordinator works only on what's ready — it does not queue or speculatively start blocked work.

For `bd-a3f8.1`, the coordinator:

1. **Analyzes file overlap** — which files will this touch? Only one bead is running this round, so no parallelism question arises. (If two independent beads were ready simultaneously, the coordinator would run them in parallel in separate worktrees if they don't share files.)
2. **Creates a dedicated worktree and branch** for this bead:

```bash
git fetch origin main
git worktree add ../myapp-bd-a3f8.1-users-table -b feature/bd-a3f8.1-users-table origin/main
```

One bead, one worktree, one branch. Commits for `bd-a3f8.1` accumulate here only.

---

**Coordinator — Task bd-a3f8.1 (users table)**

**Spawn implementer subagent** (Sonnet 4.6):

```
Task(
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: "ROLE: Implementer
           SKILL: read .claude/skills/implementer/SKILL.md
           WORKTREE: ../myapp-bd-a3f8.1-users-table
           TASK: bd-a3f8.1
           Read the task description: bd show bd-a3f8.1 --json"
)
```

New agent. Clean context window. `implementer/SKILL.md` loads. Five phases, strictly ordered:

- **Phase 1 — Write failing tests.** Before touching the schema, write tests that describe the desired behavior. They fail because nothing exists yet. No exceptions, ever.
- **Phase 2 — Implement.** Create the Prisma schema and migration. Make the tests pass.
- **Phase 3 — Verify.** Run all quality gate commands from `CLAUDE.md`. Zero errors required.
- **Phase 4 — Coverage review.** Run `git diff --name-only` to see what changed. Map changes to tests. Find gaps (error cases, edge cases). Write missing tests. Rerun quality gates.
- **Phase 5 — Commit and summary.** Commit all changes. Output structured result: what changed, what was tested, any concerns. Return to coordinator.

**Spawn 3 reviewers in parallel** (skipped for single-file or config-only changes — required for anything of any complexity):

```
Task → SKILL: reviewer-correctness/SKILL.md   ─┐
Task → SKILL: reviewer-tests/SKILL.md          ├─ simultaneous
Task → SKILL: reviewer-architecture/SKILL.md  ─┘
```

Three fresh context windows. Each reads its SKILL.md and the git diff in the worktree:

- **Correctness**: is the logic right? Any edge cases missed?
- **Tests**: are the tests actually testing behavior, or just line coverage?
- **Architecture**: does this fit existing patterns? Structural concerns?

**Coordinator processes review findings:**

- **Trivial issues** (typos, minor naming) → coordinator fixes directly, commits to the same branch
- **Non-trivial issues** (bugs, missing tests, duplication) → coordinator files a beads issue, spawns an implementer to fix it, closes the issue when done

After all review findings are resolved, quality gates pass. The coordinator pushes the branch and creates a PR:

```bash
git -C ../myapp-bd-a3f8.1-users-table push -u origin feature/bd-a3f8.1-users-table
gh pr create --title "feat: create users table and Prisma schema" \
  --body "<generated summary with bead context>"
```

The coordinator marks the bead `in-review` and outputs a handoff:

```
## Ready for Review — bd-a3f8.1: Create users table and Prisma schema

PR: https://github.com/org/repo/pull/42
Branch: feature/bd-a3f8.1-users-table

Review the diff, then merge when satisfied.
After merging: /merged feature/bd-a3f8.1-users-table
```

**The coordinator stops here.** `bd-a3f8.2` and `bd-a3f8.3` are still blocked. It does not proceed.

---

### Step 4 — Human review and merge

You review the PR on GitHub. A few things can happen:

**If the tests or implementation need changes:**

```
/work bd-a3f8.1
```

The coordinator picks up the existing branch, spawns an implementer in the same worktree, pushes the fixes. The PR auto-updates (the `/pr` logic is idempotent — it regenerates the summary and runs `gh pr edit`). Review again.

**When satisfied:** squash merge the PR on GitHub.

---

### Step 5 — `/merged feature/bd-a3f8.1-users-table`

After merging:

1. Verifies the PR is actually merged: `gh pr view --head feature/bd-a3f8.1-users-table --json state`
2. Extracts bead IDs from commit messages and PR body
3. Closes the bead: `bd close bd-a3f8.1 --reason "PR merged"`
4. Removes the worktree: `git worktree remove ../myapp-bd-a3f8.1-users-table`
5. Deletes the branch locally and remotely

**This is the gate.** Until `/merged` runs and `bd-a3f8.1` is closed, `bd-a3f8.2` stays blocked. If you merge but forget to run `/merged`, the next `/work bd-a3f8` will show `bd-a3f8.2` still blocked — which is the right behavior until the lifecycle is explicitly completed.

---

### Step 6 — `/work bd-a3f8` (run 2)

The coordinator fetches the epic and subtasks again. `bd-a3f8.1` is now closed. `bd-a3f8.2` has no remaining open blockers — it's ready. `bd-a3f8.3` is still blocked by `bd-a3f8.2`.

Critically: `bd-a3f8.2`'s worktree branches from the current `origin/main`, which now contains bead 1's merged code. The implementer inherits exactly the state it depends on.

Same cycle: new worktree, new branch (`feature/bd-a3f8.2-post-login`), implementer, reviewers, push, PR created. Coordinator stops and hands off.

`bd-a3f8.3` follows after `bd-a3f8.2` is merged.

---

## Path 2: Lightweight (small, well-understood tasks)

Use this when you already know exactly what needs to be built and don't need the planning ceremony.

```
/work "add rate limiting to the login endpoint"
```

The coordinator sees this isn't a beads ID. It creates a bead inline:

```bash
bd create "add rate limiting to the login endpoint" -t feature --json
```

Then runs the full per-bead cycle: worktree, branch, implementer, reviewers, push, PR. Same output as the full path — just no planning ceremony. After you merge, `/merged <branch>` closes the bead and cleans up.

The two paths compared:

```
Full ceremony (big/uncertain):
  /plan → discuss → beads filed → reviewer-plan → /work <epic-id>
  → (per-bead loop) → /merged → /work again for next bead

Lightweight (small/clear):
  /work "description" → coordinator creates bead inline → implements → PR
  → /merged
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

/work bd-a3f8  (run 1 — only bd-a3f8.1 is ready)
  → work.md (router, fetches epic + subtasks from beads)
  → coordinator/SKILL.md (Opus 4.6)
      identify ready beads → bd-a3f8.1 only (.2, .3 blocked)
      create worktree + branch: feature/bd-a3f8.1-users-table (from origin/main)
      Task → implementer/SKILL.md (Sonnet 4.6)
                write failing tests → implement → verify → coverage review → commit
      Task → reviewer-correctness/SKILL.md  ─┐
      Task → reviewer-tests/SKILL.md         ├─ parallel
      Task → reviewer-architecture/SKILL.md ─┘
      fix trivial findings, file issues for non-trivial, rerun quality gates
      push branch → gh pr create (auto-generated summary)
      label bd-a3f8.1 in-review → STOP

  ↓ human reviews PR on GitHub ↓

  [if changes needed] /work bd-a3f8.1 → fixes pushed → PR auto-updates
  [when satisfied] squash merge on GitHub

/merged feature/bd-a3f8.1-users-table
  → verify PR merged → bd close bd-a3f8.1
  → git worktree remove → delete branch

/work bd-a3f8  (run 2 — bd-a3f8.2 now unblocked, branches from updated origin/main)
  → same cycle for bd-a3f8.2
  → STOP

  ↓ human reviews, merges ↓

/merged feature/bd-a3f8.2-post-login
/work bd-a3f8  (run 3 — bd-a3f8.3)
  ...
```

The human gate between beads is intentional. `bd-a3f8.2` cannot start until `bd-a3f8.1`'s PR is reviewed, merged, and explicitly closed via `/merged`. This prevents cascading failures where a broken foundation silently propagates into dependent work before anyone has a chance to catch it.

Every box is either a file loaded into a context window, or a fresh subagent spawned via the Task tool. Nothing is implicit. Every agent's behavior is determined entirely by which SKILL.md it was told to read at the moment it was spawned.
