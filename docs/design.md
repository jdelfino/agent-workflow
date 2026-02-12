# Agent-Friendly Development Workflow Framework

## Design Document — Draft

---

## Problem

AI coding agents forget instructions as context grows. The current approach to solving this — better prompts, better CLAUDE.md files, smaller tasks — helps but is fundamentally probabilistic. Agents will still occasionally skip tests, commit to main, bundle unrelated changes, or add unnecessary dependencies.

The solution isn't better instructions. It's structural enforcement — a development environment where the rules are enforced by the platform, not by the agent's memory. The same way CI/CD pipelines solved "developers forgetting to run tests" a decade ago.

The secondary problem: mature development processes (branch protection, automated review, structured task decomposition, dependency tracking) exist at well-run companies but are absent from most solo developer and small team workflows. The setup cost and ongoing overhead don't make sense at small scale — unless agents are doing the work, in which case the overhead is near zero.

## Core Thesis

Ship a GitHub template repo that gives any project a production-grade, agent-friendly development workflow. The enforcement is structural (GitHub branch protection, Actions, status checks). The intelligence is in skills (planning, implementation, review prompts). The result: agents work autonomously when things are clean, and humans get pulled in with focused context only when something needs judgment.

## GitHub Issues Model

The entire workflow is built on GitHub Issues with native sub-issue and dependency relationships. This section explains the model before diving into the architecture that operates on it.

### Issue Hierarchy

```
#20 Parent Issue: "Add rate limiting to the API"          [epic/feature]
 ├── #21 Child: "Add rate limiting middleware"            [task, no deps]
 ├── #22 Child: "Add rate limit configuration"            [task, blocked by #21]
 ├── #23 Child: "Add rate limit headers to responses"     [task, blocked by #21]
 ├── #24 Child: "Add rate limit exceeded error handling"  [task, blocked by #22, #23]
 ├── #25 Child: "Add rate limiting documentation"         [task, blocked by #24]
 │
 │   [After PR opened and reviewed...]
 │
 ├── #26 Child: "Missing null check on request.ip"        [review finding, blocking]
 ├── #27 Child: "No test for concurrent request handling" [review finding, blocking]
 └── #28 Child: "Rate limit store should be injected"     [review finding, should-fix]
```

### Three Types of Child Issues

**Task issues** are created during planning. They represent work to be done — discrete, agent-session-sized units with clear acceptance criteria. Task issues have dependencies on each other (expressed via GitHub's native `blocked-by` relationship).

**Review finding issues** are created by reviewer agents during PR review. They represent problems discovered in the implementation. Review findings are children of the parent issue, not the task issue, because they relate to the feature as a whole. Critical findings are marked as `blocking` the parent issue.

**Follow-up issues** (v2) are non-blocking improvements identified during review — `should-fix` and `suggestion` severity. They stay in the backlog attached to the parent for future cleanup passes.

### Issues and PRs

Each non-leaf issue gets its own branch and PR. The PR's `fixes #N` references the issue it implements, and review findings attach to that issue.

- **PR links to its issue:** The PR for feature #20 includes `fixes #20`. The PR for epic #10 includes `fixes #10`.
- **Reviewers file against the PR's issue:** When reviewing #20's PR, findings become children of #20.
- **Blocking is local:** Critical review findings block #20. The PR can't merge while #20 has open blocking children.
- **Merge closes the issue:** When #20's PR merges, `fixes #20` closes #20.

For leaf tasks (issues with no children), work happens as commits on the parent's branch rather than separate PRs — unless you want the granularity of per-task PRs, in which case the same model applies recursively.

### Why This Model

**Branch hierarchy mirrors issue hierarchy.** The structure is predictable — given an issue number, you know where its branch lives and what it targets. No ad-hoc decisions about branch naming or PR targets.

**Each level is self-contained.** The orchestrator check for #20's PR only cares about #20's blocking children. It doesn't need to understand the full hierarchy. This makes the system composable — add more levels without changing the logic.

**Review findings don't get lost.** By attaching findings to the issue being reviewed, they stay associated with that unit of work through its lifecycle.

**Blocking is explicit and queryable.** GitHub's native dependency API lets the orchestrator check ask: "Does #N have any open children with the `blocking` label?" This is the gate that prevents premature merge.

**Transitive unblocking works.** When a task completes, sibling tasks that depended on it become unblocked. GitHub tracks this natively — the `/work` command queries for unblocked children when deciding what to spawn.

### Dependencies: Native GitHub vs. Labels

GitHub Issues now supports native sub-issues and `blocked-by`/`blocking` relationships (via the GraphQL API and UI). The workflow uses these where possible:

- **Parent/child hierarchy:** Native sub-issues
- **Task-to-task dependencies:** Native `blocked-by` relationships (set during planning)
- **Review-finding-blocks-parent:** Native `blocking` relationship (set when reviewer creates a `blocking`-severity finding)

Labels are used for status and metadata, not for expressing dependencies:
- `blocking` / `should-fix` / `suggestion` — severity of review findings

### Hierarchical Branching

Issue hierarchy maps directly to branch hierarchy. Each issue with children gets its own branch; child branches branch off their parent's branch, not main. PRs target their parent's branch.

**Example: Three-level hierarchy**

```
Issues:                                          Branches:
─────────────────────────────────────────────────────────────────────────────
#10 Epic: "API overhaul"                         feat/10-api-overhaul (off main)
 │                                                │
 ├── #20 Feature: "Add rate limiting"            ├── feat/20-rate-limiting (off feat/10)
 │    ├── #21 Task: "Add middleware"             │    (commits on feat/20, or sub-branch)
 │    ├── #22 Task: "Add configuration"          │    (commits on feat/20, or sub-branch)
 │    └── #26 Review finding (blocks #20)        │
 │                                                │
 └── #30 Feature: "Add authentication"           └── feat/30-authentication (off feat/10)
      ├── #31 Task: "Add JWT validation"              (commits on feat/30)
      └── #32 Task: "Add refresh tokens"              (commits on feat/30)
```

**PR targets:**

| PR | Source Branch | Target Branch | `fixes` |
|----|---------------|---------------|---------|
| PR for #10 | `feat/10-api-overhaul` | `main` | `fixes #10` |
| PR for #20 | `feat/20-rate-limiting` | `feat/10-api-overhaul` | `fixes #20` |
| PR for #30 | `feat/30-authentication` | `feat/10-api-overhaul` | `fixes #30` |

**`/work #N` behavior:**

1. Find #N's parent issue (if any)
2. Determine base branch:
   - If #N has a parent with issue number P → base is `feat/{P}-{slug}`
   - If #N has no parent → base is `main`
3. Create branch `feat/{N}-{slug}` off the base branch
4. If #N is a leaf (no children): do the implementation work
5. If #N has children: create the branch and PR, then wait for child work to fill it
6. Open PR targeting the base branch with `fixes #N` in description

**Merge flow (bottom-up):**

1. Leaf tasks complete → commits land on parent feature branch
2. Feature PR passes checks (no blocking children) → merges into epic branch
3. When all feature PRs have merged → epic PR passes checks → merges into main

**Review findings attach to the PR's issue.** When reviewing the PR for #20, findings become children of #20. They block #20's PR from merging into `feat/10-api-overhaul`. They don't directly block #10 — that's handled by the fact that #20's PR hasn't merged yet.

**The orchestrator check is scoped to one level.** For #20's PR, it asks: "Does #20 have open blocking children?" It doesn't look up at #10 or down into task-level details. Each PR/issue pair is self-contained.

**Opt-in complexity.** Simple projects don't need this. If every issue is top-level, every branch comes off main, every PR targets main. The hierarchy exists for projects that need to organize larger efforts — you use as many levels as make sense for your work.

## System Architecture

### Layer 1: Enforcement (GitHub Configuration)

This is the skeleton. Non-negotiable, deterministic, platform-enforced.

- **Branch protection on main.** No direct pushes. PRs required. Status checks required. No exceptions.
- **Required status checks.** Tests, linting, the orchestrator check (see Layer 3), and all enabled guardrail checks must pass before merge. Guardrail checks use native GitHub check run conclusions (`success`, `neutral`, `action_required`) to report results — no custom schema needed.
- **Auto-merge enabled.** When all checks pass and required reviews (if any) are satisfied, the PR merges automatically. The default path is fully automated.
- **`/configure` command.** An interactive Claude Code command that sets up all of the above: branch protection via `gh api`, git hooks (Layer 0), Claude authentication (`/install-github-app`), guardrail configuration, and CLAUDE.md population. Run once from a Claude Code terminal after installing the workflow files.

### Layer 2: Intelligence (Skills)

Prompts and conventions that define how agents interact with the project. Generic defaults ship with the template; projects tune them over time.

#### Planning Skill

Human-in-the-loop, run from a Claude Code terminal. Takes a feature description or problem statement and decomposes it into:

- A **parent issue** describing the feature/epic
- **Child issues** for each task, structured with:
  - What to change and why
  - Acceptance criteria
  - Relevant files
  - Dependencies on other issues (using GitHub's native `blocked-by` / `blocking` relationships)
- **Sub-issue hierarchy** for complex decomposition (grandchildren, etc.)

Each child issue is scoped to be completable in a single agent session with fresh context. This is the key constraint — if a task can't be done in one session, the planning is wrong.

#### Implementation Skill

Triggered by `/work #N` from a Claude Code terminal. The skill is recursive and handles initial implementation, fixes, and rebasing:

1. Find #N's parent issue (if any) to determine the base branch
2. **If branch doesn't exist:** create `feat/{N}-{slug}` off the base branch, open PR targeting base with `fixes #N`
3. **If branch exists:** check out the existing branch
4. **If branch is behind its base:** rebase onto base, resolve conflicts if possible (stop and ask human if not)
5. Find all open, unblocked children of #N (tasks, review findings, or human-filed issues for guardrail fixes)
6. **If #N is a leaf issue (no children):** spawn implementer subagents for the actual work
7. **If #N has unblocked children:** spawn `/work #child` for each (recursive)
8. **If no unblocked children remain:** work is complete, push any commits (including rebase)
9. Push commits to the branch

The recursion bottoms out at leaf issues, where implementation actually happens. There's no distinction between "initial work," "fixing review feedback," or "rebasing" — `/work` handles whatever the issue needs.

One issue, one branch, one PR. The branch hierarchy mirrors the issue hierarchy.

#### Reviewer Skills

Three specialized reviewers, each a separate skill:

- **Correctness reviewer** — bugs, error handling, security issues, logic errors
- **Test reviewer** — test coverage, edge cases, test quality, integration coverage
- **Architecture reviewer** — duplication, pattern consistency, separation of concerns, unnecessary complexity

Each reviewer creates child issues under the PR's linked issue (parsed from `fixes #N`) with severity labels: `blocking`, `should-fix`, or `suggestion`. Critical findings are set as blocking that issue using GitHub's native dependency API.

### Layer 3: Orchestration (GitHub Actions)

Event-driven workflows that wire everything together. Each Action is stateless and triggered by GitHub events.

#### PR Review Workflow

**Trigger:** PR opened or synchronized (new commits pushed)

**Action:**
1. Run three reviewer skills in parallel via `claude -p`
2. Each reviewer creates child issues under the parent issue (parsed from `fixes #N` in PR description)
3. Issues are labeled by severity: `blocking`, `should-fix`, `suggestion`
4. `blocking` issues are set as blocking the parent issue using GitHub's native dependency API

#### Orchestrator Status Check

**Trigger:** Issue events (opened, closed, labeled, unlabeled) and PR pushes

This is the brain of the system. Single Action that:

1. Parses `fixes #N` from the PR description
2. Checks if the referenced parent issue has any open `blocking` child issues
3. **If blockers exist:** Report failing status check. PR cannot merge.
4. **If no blockers and this is a new "all clear":** Run a lightweight `claude -p` call to assess whether fixes since last review warrant a re-review (based on diff size, complexity, scope of changes)
5. **If re-review warranted and under the cycle cap (default: 3 rounds):** Trigger the PR Review Workflow again
6. **If re-review not warranted, or cap reached:** Report passing status check. Auto-merge proceeds (unless human review is required).

#### Guardrail Checks

**Trigger:** PR opened or synchronized

Each guardrail check runs as an independent GitHub Actions job and reports its result as a native GitHub check run. Guardrails are stateless and simple — they detect, report, and nothing more. They don't file issues or manage overrides.

**Check run conclusions:**

- **`success`** → check passed, or human has approved (see override mechanism below)
- **`neutral`** → warning-level finding; visible in PR checks UI but non-blocking
- **`action_required`** → escalation-level finding; blocks merge until resolved or overridden

Checks attach **annotations** to specific files and lines in the PR diff, so findings appear inline where they matter.

**Override mechanism:** Guardrail checks query for a non-stale approving PR review. If one exists, the check reports `success` even if violations are present — the human has reviewed the current state and accepted it. Any new commits make the approval stale, and guardrails go back to `action_required` until re-approved.

**Human workflow when guardrails fail:**

1. Human sees guardrail failure in checks tab (with annotations pointing to specific issues)
2. Human decides: fix or accept?
3. **If fix:** Human files an issue as a child of the PR's parent issue, describing what to fix. `/work #N` picks it up like any other child.
4. **If accept:** Human submits approving PR review (with comment explaining why the violations are acceptable). Guardrails re-run, see non-stale approval, report `success`.

This keeps guardrails simple (detect and report only) while ensuring all fix work is tracked as issues and human overrides use the native PR review mechanism.

### Layer 4: Guardrail Check Library

Deterministic checks that catch things agents do wrong more often than humans. Each check is an independent GitHub Actions job that reports its findings using native GitHub check runs.

#### Shipped with v1

**Scope enforcement.** Compare files changed in the PR against files listed in the issue. Flag changes to files not mentioned in the task description. Catches agent scope creep — the "helpful" refactoring of nearby code.

**Test-to-code ratio.** Ratio of test lines to implementation lines in the PR. Configurable threshold (default: 0.5). Catches the most common agent failure: skipping or phoning in tests.

**Dependency change detection.** Diff `package.json`, `requirements.txt`, `go.mod`, etc. against main. New dependencies require justification in the PR body or linked issue. Agents add dependencies like candy.

**API surface change detection.** Detect changes to exported functions, public interfaces, API endpoints. These have outsized downstream impact that agents don't understand without organizational context.

**Single-concern validation.** Analyze the PR diff for multiple unrelated changes. Can be a simple heuristic (common directory prefix) or an LLM-assisted assessment.

**File creation gate.** Flag new files created outside approved directories or new top-level modules. Prevents agents from creating `utils/helpers/misc.py`.

**Commit message structure.** Enforce format (conventional commits, issue reference, max length). Deterministic, zero ambiguity.

**Configuration drift detection.** Flag changes to `.env`, config files, infrastructure definitions. These changes have outsized impact and agents modify them casually.

#### Check Architecture

Each check is a standalone GitHub Actions job that uses the [Checks API](https://docs.github.com/en/rest/checks) to report results. No custom schema — checks use GitHub's native primitives:

**Check run conclusions:**

| Finding | Check Run Conclusion | Effect |
|---------|---------------------|--------|
| No violations | `success` | No action needed |
| Violations + non-stale approval | `success` | Human has accepted |
| Minor violations | `neutral` | Visible in checks UI, non-blocking |
| Significant violations, no approval | `action_required` | Blocks merge |

**Annotations** attach findings to specific files and lines:
```yaml
# Example: scope enforcement check reports via GitHub check run
- name: Report scope check
  uses: actions/github-script@v7
  with:
    script: |
      // Check for non-stale approval first
      const reviews = await github.rest.pulls.listReviews({...});
      const lastCommit = context.sha;
      const hasValidApproval = reviews.data.some(r => 
        r.state === 'APPROVED' && r.commit_id === lastCommit
      );
      
      if (hasValidApproval) {
        // Human has reviewed current state, pass even with violations
        return github.rest.checks.create({
          conclusion: 'success',
          output: { title: 'Scope enforcement: approved by reviewer' }
        });
      }
      
      // No approval, report the violation
      await github.rest.checks.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        head_sha: context.sha,
        name: 'guardrail/scope-enforcement',
        conclusion: 'action_required',
        output: {
          title: 'Scope enforcement: 2 files outside task scope',
          summary: 'PR modifies files not listed in issue #17. Fix the violation or approve the PR to override.',
          annotations: [
            {
              path: 'src/auth/middleware.ts',
              start_line: 1, end_line: 1,
              annotation_level: 'warning',
              message: 'This file is not listed in the task scope for issue #17'
            }
          ]
        }
      });
```

**Configuration:** Each check has a config entry in `.github/agent-workflow/checks.yaml`. The config controls which checks are enabled and what conclusion they report:
```yaml
scope-enforcement:
  enabled: true
  conclusion: action_required  # or "neutral" or disabled

test-ratio:
  enabled: true
  conclusion: action_required
  threshold: 0.5

dependency-changes:
  enabled: true
  conclusion: action_required
```

This architecture allows the check library to grow over time. Contributing a new check means writing a GitHub Actions job that analyzes the PR and reports a check run — standard GitHub API, no framework to learn.

### Layer 5: Human Escalation

Human escalation uses native GitHub mechanisms: PR reviews and check run conclusions. No custom labels or comment parsing.

**When humans get involved:**

1. **Guardrail failures.** Human sees `action_required` check with annotations. Decides to fix (files issue) or accept (approves PR).
2. **Reviewer findings.** Human sees blocking child issues. `/work` addresses them, or human intervenes.
3. **Re-review cap exceeded.** Orchestrator reports `action_required` after too many review cycles.
4. **Agent self-escalation.** Agent can request human review by leaving a PR comment (human then decides whether to approve or provide guidance).

**The approval as override:**

A non-stale PR approval serves as the universal override. When a human approves:
- Guardrail checks see the approval and report `success` despite violations
- The orchestrator sees the approval as a signal that remaining issues are accepted
- The approval comment provides audit trail for why violations were accepted

New commits stale the approval. All checks re-run and will block again until either fixed or re-approved. This is intentionally friction — the human must re-engage after any change.

**Escalation gradient:**

| Situation | What Blocks | Human Action |
|-----------|-------------|--------------|
| Clean PR, no issues | Nothing | Auto-merge |
| Guardrail violations | `action_required` check | Fix (file issue) or approve |
| Blocking reviewer findings | Orchestrator check | `/work` or approve |
| Re-review cap exceeded | Orchestrator check | Review and approve |

## Workflow: End to End

### 1. Planning (Human + Claude Code terminal)

```
human> /plan "Add rate limiting to the API"
```

Claude Code explores the codebase, discusses tradeoffs with the human, then creates:
- Parent issue #20: "Add rate limiting to the API"
  - Child issue #21: "Add rate limiting middleware" (no dependencies)
  - Child issue #22: "Add rate limit configuration" (blocked by #21)
  - Child issue #23: "Add rate limit headers to responses" (blocked by #21)
  - Child issue #24: "Add rate limit exceeded error handling" (blocked by #22, #23)
  - Child issue #25: "Add rate limiting documentation" (blocked by #24)

### 2. Implementation (Human + Claude Code terminal)

```
human> /work #20
```

Coordinator determines #20 has no parent, so base branch is `main`. Creates branch `feat/20-rate-limiting` off main. Opens PR targeting main with `fixes #20` in the description. Since #20 has children, the coordinator then works through unblocked leaf tasks.

```
human> /work #21
```

Coordinator determines #21's parent is #20. Creates branch `feat/21-rate-limiting-middleware` off `feat/20-rate-limiting` (or, for simple projects, just commits directly to `feat/20-rate-limiting`). Spawns implementer subagents for the work. If using sub-branches, opens PR targeting `feat/20-rate-limiting` with `fixes #21`.

For this example, assume leaf tasks are commits on the parent branch (simpler model). The work for #21 lands as commits on `feat/20-rate-limiting`.

### 3. Automated Review (GitHub Actions)

PR open (or new commits) triggers the review workflow on #20's PR. Three reviewers run in parallel via `claude -p`. Findings:

- Correctness reviewer creates issue #26: "Missing null check on request.ip" → severity: `blocking` → set as blocking #20
- Test reviewer creates issue #27: "No test for concurrent request handling" → severity: `blocking` → set as blocking #20
- Architecture reviewer creates issue #28: "Rate limit store should be injected, not hardcoded" → severity: `should-fix` → child of #20 but not blocking

Status check runs: #20 has blocking children #26 and #27. Check fails. PR can't merge.

### 4. Guardrail Checks (GitHub Actions)

Guardrail checks run in parallel with review, each as an independent check run. All report `success` — implementation stayed in scope, test ratio is good, no new dependencies, no API surface changes. All checks show green in the PR checks UI. No human review required.

### 5. Fixes (Human + Claude Code terminal)

```
human> /work #20
```

Since the branch and PR already exist, `/work` picks up where it left off. It finds blocking children #26 and #27, works through them, pushes commits to `feat/20-rate-limiting`, and closes both issues.

### 6. Re-evaluation (GitHub Actions)

Issue close events trigger the status check. #20 has no more open blockers. Status check runs `claude -p` to assess: fixes were small and surgical (null check + one new test). Re-review not warranted. Check goes green.

### 7. Continue Implementation

With review findings addressed, continue with remaining tasks:

```
human> /work #22
```

#22 was blocked by #21. Now that #21's work is done (commits landed on `feat/20-rate-limiting`), #22 is unblocked. Work continues on the same branch.

This repeats for #23, #24, #25. Each task adds commits to `feat/20-rate-limiting`. Reviews may trigger again on significant changes.

### 8. Merge

When all tasks are complete and no blocking issues remain, #20's PR auto-merges into main. `fixes #20` closes #20. Non-blocking issue #28 (dependency injection refactor) remains in the backlog with full context.

## Template Repo Contents

```
agent-workflow-template/
├── .github/
│   ├── workflows/
│   │   ├── pr-review.yml              # Triggers reviewers on PR open
│   │   ├── orchestrator-check.yml     # Status check: blocker evaluation + re-review
│   │   ├── guardrail-scope.yml        # Scope enforcement (native check run)
│   │   ├── guardrail-test-ratio.yml   # Test-to-code ratio (native check run)
│   │   ├── guardrail-dependencies.yml # Dependency change detection (native check run)
│   │   ├── guardrail-api-surface.yml  # API surface change detection (native check run)
│   │   └── guardrail-commits.yml      # Commit message structure (native check run)
│   ├── agent-workflow/
│   │   └── config.yaml                # Workflow configuration (re-review cap, check thresholds, etc.)
│   └── ISSUE_TEMPLATE/
│       ├── task.yml                    # Structured task template for agent consumption
│       └── review-finding.yml         # Template for reviewer-created issues
├── .claude/
│   ├── settings.json
│   ├── skills/
│   │   ├── planner.md                 # Planning skill
│   │   ├── coordinator.md             # Implementation coordinator
│   │   ├── implementer.md             # Implementation agent
│   │   ├── reviewer-correctness.md    # Correctness review skill
│   │   ├── reviewer-tests.md          # Test quality review skill
│   │   └── reviewer-architecture.md   # Architecture review skill
│   └── commands/
│       ├── plan.md                    # /plan command
│       ├── work.md                    # /work command
│       └── configure.md              # /configure command (interactive setup)
├── CLAUDE.md                          # Starter project context (fill in per project)
└── README.md
```

## What Ships in v1

- `/configure` command for interactive setup: branch protection, git hooks, Claude auth, guardrails, CLAUDE.md
- Orchestrator status check Action (the brain — blocker evaluation, re-review assessment)
- PR review workflow invoking three reviewer skills via `claude -p`
- Guardrail checks as independent workflow files using native GitHub check runs (scope, test ratio, dependency changes, API surface, commit messages)
- Human escalation via `action_required` check conclusion + PR approval as override
- Planning and implementation skills (adapted from devcontainer-template)
- Issue templates for tasks and review findings
- Starter CLAUDE.md and workflow configuration
- README explaining the philosophy and setup

## What's v2

- **Autonomous fix agents in Actions.** Fix agents running on the Actions runner directly, with a dev environment set up in the workflow. When review findings are filed, an Action automatically invokes `/work` to address them without human intervention.
- **Autonomous planning trigger.** File a GitHub issue to kick off planning without a terminal. Human reviews the plan (approve/reject the issue decomposition) before work begins.
- **Autonomous task dispatch.** When an issue becomes unblocked (no open blockers), an Action automatically invokes `/work` via `claude -p`. The full pipeline runs without human intervention for straightforward tasks. (Requires GitHub to add filtering by dependency status, or a custom query workflow.)
- **Expanded check library.** Community-contributed guardrail checks for specific frameworks, languages, and domains. Each check is just a GitHub Actions workflow file that reports a check run — no framework to learn. Django migration checks, TypeScript type export checks, security-focused checks for regulated industries, etc.
- **Maintenance passes.** Periodic workflows that sweep `should-fix` and `suggestion` issues from the backlog, group them by file or concern, and open cleanup PRs.
- **Metrics and reporting.** Track review cycle counts, guardrail trip rates, fix success rates. Surface patterns — if the same guardrail trips repeatedly, the CLAUDE.md or skills need tuning.

## Open Questions

1. **Authentication for `claude -p` in Actions.** Two supported paths: (a) `ANTHROPIC_API_KEY` — a Console API key with per-token billing, stored as a GitHub Secret. This is the recommended path: unambiguous ToS compliance, no ban risk, predictable billing. (b) `CLAUDE_CODE_OAUTH_TOKEN` — generated via `claude setup-token`, bills against Pro/Max subscription allocation. Officially supported by claude-code-action but closer to the patterns that have triggered false-positive bans. Use API key for CI/CD, keep subscription for interactive development. Need to validate cost predictability — a busy repo could generate significant API spend from automated reviews.

2. **False-positive ban risk.** Even with legitimate API key usage, rapid-fire `claude -p` invocations from Actions runners could theoretically trip Anthropic's abuse filters. Need to test this at realistic volumes and potentially add rate limiting between invocations.

3. **Re-review assessment prompt quality.** The `claude -p` call that decides whether fixes warrant re-review is a judgment call. Needs careful prompt engineering and testing to avoid both over-triggering (every fix gets re-reviewed, wasting cycles) and under-triggering (bad fixes slip through).

4. **Check library contribution model.** Contributing a check is just adding a workflow file that reports a GitHub check run — low barrier. But curation still matters. Bad checks that generate false `action_required` conclusions will erode trust in the system. Need a review process for contributed checks and clear guidelines on when to use `neutral` vs `action_required`.

5. **Multi-repo / monorepo support.** v1 assumes one repo, one project. Monorepos with multiple services would need per-path configuration for guardrails and potentially separate review workflows per service.

6. **Cost model.** Each reviewer is a `claude -p` call. Three reviewers per PR, plus re-review assessments, plus potential re-review rounds. For a solo dev doing 5 PRs/day, this could be $10-50/day in API costs depending on diff sizes. Need to surface cost estimates clearly.
