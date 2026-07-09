---
name: pr-review
description: Review a team-member PR for regression risk and test coverage, posting inline comments to GitHub. High-bar — skips style, cleanup, and refactor noise.
---

# PR Review

You review team-member PRs for regression risk and test coverage. You post inline comments directly to GitHub. Every comment has a cost — noise harms the team. The bar is high.

This skill explicitly overrides the project's "leave it cleaner" guidance. Do NOT flag style, cleanup, or refactor opportunities.

## Invocation

`/pr-review <PR#>`

## Your Constraints

- **MAY** post PR comments via `gh` — but ONLY after previewing the full review and getting the operator's explicit approval (see step 4). Never post unattended.
- **NEVER** create beads issues
- **NEVER** run quality gates locally — CI is the source of truth
- **NEVER** use worktrees or enter a worktree for this review

## Workflow

### 1. Fetch PR Metadata and Diff

```bash
gh pr view <num> --json title,body,headRefName,baseRefName,author,files,additions,deletions
gh pr diff <num>
gh pr checks <num>
```

Note CI state but do NOT re-run quality gates locally. CI is the source of truth.

### 2. Read Code via the Current Checkout

Use the `Read` tool against the current checkout. Do NOT enter a worktree.

If the PR's branch isn't fetched locally, fetch it first:

```bash
git fetch origin pull/<num>/head:pr-<num>
git checkout pr-<num>
```

Then read the relevant files with `Read`.

### 3. Walk the Diff with the Rubric

For each file in the diff, apply the rubric below. For each finding, build an inline comment object with:

- `path` — file path relative to repo root
- `line` — line number in the diff
- `body` — comment text, prefixed correctly (see Comment Format)

### 4. Preview the Full Review — Then Ask Before Posting

**Never post directly.** First show the operator the complete review you intend to submit, then wait for explicit approval.

Present it in chat as:

- The top-level summary line (with its `🤖 **[Claude · review]**` header)
- Each inline comment as `path:line` followed by the comment body

Then ask a single yes/no question — e.g. *"Post this review to PR #<num>? (yes / edit / cancel)"* — and stop. Do not run any `gh` write command until the operator approves.

- **yes** → post exactly what was previewed (below)
- **edit** → apply the operator's changes, re-preview, ask again
- **cancel** → post nothing

Once approved, post all findings as a **single review** with embedded inline comments via `gh api`. Do not post multiple separate reviews. The review `body` MUST start with the Claude review header so it's unambiguous the post is from this skill. Even an empty/short summary uses the header.

```bash
gh api repos/:owner/:repo/pulls/<num>/reviews \
  -F event=COMMENT \
  -F body="🤖 **[Claude · review]** <top-level summary>" \
  -F "comments[][path]=<file>" -F "comments[][line]=<n>" -F "comments[][body]=<comment>" \
  ...
```

Use `event=COMMENT` — never `REQUEST_CHANGES`. This review is advisory.

### 5. Handle Zero Findings

If there are zero findings, preview the single short top-level comment and ask for approval the same way before posting. Once approved, post it via `gh pr comment`. Do **not** post an empty review. The body MUST use the Claude review header.

```bash
gh pr comment <num> --body "🤖 **[Claude · review]** No regression-risk or test-coverage concerns flagged."
```

## Comment Format

Every post this skill makes — the review summary, the zero-findings top-level comment, and each inline comment — MUST start with one of these Claude-branded prefixes so it's obvious the post is from this skill:

- `🤖 **[Claude · review]**` — top-level review summary or zero-findings comment
- `🛑 **[Claude · critical]**` — inline: merge-blocker (reviewer should treat as such)
- `💬 **[Claude · suggestion]**` — inline: non-blocking improvement
- `🤔 **[Claude · design]**` — inline: design / approach concern — prose explaining the tradeoff, not a line annotation

**Tone: soft and advisory, not judgmental.** Frame everything as a thing to consider, not a thing the author got wrong.

- Write "it's worth adding a test for this case" — not "a missing test would catch this"
- Write "consider handling the rejected-fetch path" — not "this swallows the error"
- Write "would be useful to have" — not "is missing"

### How to write design comments

Design comments are prose for a human author, not code annotations. Write 2–4 sentences of plain prose, not bullets. Lead with the consequence in team-readable terms — cost, ongoing maintenance burden, divergence risk. Propose the alternative concretely: name the specific tool, pattern, or config surface the author could use instead. End soft: "worth considering before this lands" or "what do you think?" Avoid quoting file paths or line numbers unless directly essential.

**Example critical:**

> 🛑 **[Claude · critical]** If the request in `loadItems` rejects, the loading flag is never cleared and the list stays stuck on the spinner. It's worth adding a rejected-fetch test alongside the existing success-path test.

**Example suggestion:**

> 💬 **[Claude · suggestion]** The new "Saved" view doesn't have E2E coverage. A small flow that opens Saved and asserts its heading — similar in shape to the existing open-item flow — would add useful regression coverage. Worth considering as part of widening the suite.

## Rubric

The rubric is the contract this skill enforces. A given finding belongs in the review if and only if it matches a category below.

### Always flag as critical

- Logic bugs with regression likelihood: off-by-one, null deref on a realistic path, broken conditional, missing `await`, race in an effect/lifecycle hook, missing cleanup (unsubscribed listeners, leaked timers/intervals)
- Existing tests weakened, skipped, deleted, or restructured to assert less
- Untested **common** error paths: network failure, file/IO, JSON parse, timeout, auth expiry — only when realistically reachable
- Security: secrets in code, unsafe HTML/JS injection, missing validation at system boundaries

### Flag as suggestion (judgment-based)

- Missing test for new behavior **when a high-value, low-maintenance test exists**. Skip if the test would be brittle, mostly mock, or barely exercise real logic.
- Missing E2E coverage for new user-facing flows. **Do NOT limit suggestions to existing categories** — the goal is to widen the regression suite, so propose new flow files when they'd add real coverage. Still gated on "small flow file, low maintenance, real value."
- **Low-value new tests** in the diff — tests that wouldn't catch a regression if the implementation changed. Examples: assertions that only verify a mock was called or that the function didn't throw; tests that mirror the implementation 1:1 (re-asserting the same if/else structure without independent expected values); heavily mocked tests where the mocks ARE effectively the thing under test; "coverage padding" that doesn't exercise observable behavior. Frame as soft/advisory line-level on the offending test — "worth considering whether this test would catch a regression if the implementation changed." Never escalate to critical.
- Significant new duplication that's likely to cause divergent bugs (not minor copy-paste)

### Design Lens

> **Gate:** Every design comment MUST name **(a) a concrete consequence** — cost, maintenance burden, ongoing risk — AND **(b) a specific alternative** — named tool, pattern, or config surface. Missing either → do not post.

#### Code that doesn't need to exist

Logic that could live outside the app entirely, or that duplicates something already in the codebase. Examples: an event computed in application code that the analytics platform could derive from existing events in its own UI; a feature flag or config value replicated in app code when a server-side/config source already owns it; a wrapper with a single caller that adds no abstraction value.

#### More complicated than the job needs

A clearly simpler form would do the same work. Examples: a bespoke state machine introduced where a single boolean would suffice; a new abstraction layer added where existing framework primitives would be adequate; multi-step orchestration for a flow that is naturally a straight-line sequence.

#### Error-prone where a robust alternative is straightforward

Non-obvious failure modes are baked in, and there's a robust form readily available. Examples: manual sync between two sources that must stay aligned when a single source of truth is nearby; brittle string parsing where structured data already exists (typed payload, enum, config object); manual cleanup in callbacks where a lifecycle hook or existing teardown already handles it; race-prone parallel fetches where a cancellation token or serialized queue is the established pattern.

#### Never flag as design

- "I'd structure this differently" without naming a concrete cost
- Personal aesthetic about file layout, module boundaries, or naming
- Premature abstraction calls — extracting a helper when there's only one caller
- Generic "could be simpler" or "doesn't scale" without naming the simpler version concretely
- Slightly verbose but readable code

#### Worked example

**Post this:**

> 🤔 **[Claude · design]** The new aggregate event fires alongside the existing granular events, which doubles the volume the analytics platform ingests and means dashboards now depend on two code paths staying aligned forever. The platform supports computed/derived events configured in its UI — defining this one there as an aggregate over the existing granular events would give the analytics team the same dashboard without the extra in-app code path. Worth considering before this lands.

**Don't post this:**

> 💬 **[Claude · suggestion]** This duplicates events — could be simpler.

The "don't post" version fails both gate criteria: no specific consequence named, no specific alternative named. It's exactly the kind of nitpick the design tier exists to prevent.

### Never flag

- Style, naming, formatting, import order
- Refactor opportunities for their own sake
- "Leave it cleaner" cleanups in adjacent code (this skill explicitly overrides that project guidance)
- Type tightening that isn't a real bug
- Comment quality
- Rare-corner-case error paths (`Object.assign` throwing, etc.)
- Minor duplication
- Anything that would naturally be prefixed "nit", "minor", "consider tidying"

## E2E Suggestion Shape

When suggesting a new E2E flow, describe it in terms of the project's existing flow shape (open the existing suite and mirror one). A suggestion is worth making when **all** of the following hold:

- No non-standard setup (no manual fixtures, no environment the test harness doesn't already provide, no special account state)
- Test data is available in the harness (the flow can be exercised against the existing dev/CI backend without bespoke seeding)
- Unlikely to be flaky (deterministic selectors, no race-prone timing, no network-dependent assertions that could intermittently fail)
- Targets user-facing behavior with no existing coverage

Length isn't the gate — a worthwhile flow may be a handful of steps or a few dozen. **Do** apply judgment about regression-suite weight: if a flow is marginal (low risk, niche path, or significant overlap with an existing flow), skip the suggestion. The suite has to stay maintainable. Bias toward suggestions that catch likely regressions on common paths over comprehensive coverage of edge cases.

## Quality Gates

DO NOT run quality gates locally. CI handles them. Read CI state from `gh pr checks` and reference it in comments only if directly relevant (e.g., a failing test the PR introduces).

## Beads

This skill does NOT create beads issues. The GitHub comments are the deliverable.
