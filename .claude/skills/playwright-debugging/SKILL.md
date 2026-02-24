---
name: playwright-debugging
description: Guide for writing, running, and debugging Playwright E2E tests.
---

# Playwright Debugging

Guide for writing, running, and debugging Playwright E2E tests.

## Core Principles

1. **Failing tests indicate real bugs.** The tests interact with the real app. If a test fails, the app is broken — investigate the app, not the test.
2. **Debug locally first.** Read error messages, check screenshots/video, check browser console logs. Most issues are obvious once you look at the artifacts.
3. **Fix the app, not the test.** If the test exposes a real bug, fix the production code. Only change the test if the test itself is wrong (wrong selector, wrong expectation, race condition in the test).
4. **Tests must be independent.** Each test should manage its own state. Never depend on state from another test.

## Debugging Approach

When a test fails, follow this sequence:

### 1. Read the Error Message

Playwright error messages are descriptive. They tell you exactly what selector failed and why. Start there.

### 2. Check Page Structure Output

Failed tests generate `test-results/<test-name>/error-context.md` with a YAML representation of the page structure:

```yaml
- heading "Dashboard" [level=1] [ref=e10]
- paragraph [ref=e11]: Enter your section code to get started
- textbox "Section Join Code" [active] [ref=e15]
- button "Join Section" [disabled] [ref=e16]
```

This shows the actual DOM state at failure time — often more useful than screenshots for understanding what elements are rendered and their states.

### 3. Check Failure Artifacts

On failure, Playwright captures:
- **Screenshots** — `test-results/<test-name>/` — shows what the page looked like
- **Video** — same directory — shows the full test interaction leading up to the failure
- **Trace** — if enabled, provides a full timeline of actions, network requests, and DOM snapshots

Open the HTML report:
```bash
npx playwright show-report
```

### 4. Check API Responses

Look for non-200 responses or unexpected error bodies in the browser console logs or network tab of the trace viewer.

### 5. Trace Back to the Bug

Common failure patterns:
- **Element not found** — check if the selector changed, or if the page didn't load (API error, auth issue)
- **Timeout waiting for element** — usually means the feature is broken or the page never navigated
- **Text mismatch** — check if the API returned unexpected data
- **Setup failures** — API or database setup failed; check that backend services are running

### 6. Run in Headed Mode

For interactive debugging:
```bash
# Run a single test with browser visible
npx playwright test e2e/your-test.spec.ts --headed

# Or with Playwright Inspector (step-by-step debugging)
npx playwright test e2e/your-test.spec.ts --debug
```

## Running Tests

### Full Suite

```bash
npx playwright test
```

### Single Test File

```bash
npx playwright test e2e/your-test.spec.ts
```

### Single Test by Name

```bash
npx playwright test -g "test name substring"
```

## Writing Tests

### Test Structure

Every test file follows this pattern:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('what it does', async ({ page }) => {
    // 1. SETUP — create test data (via API helpers or fixtures)

    // 2. UI INTERACTION — navigate and interact
    await page.goto('/some-page');

    // 3. ASSERTIONS — verify expected state
    await expect(page.locator('h1')).toHaveText('Expected Title');
  });
});
```

### Key Patterns

- **Setup via API helpers, not UI clicks.** Creating test data through API calls is faster and more reliable. Only use UI interactions to test the UI flow you're actually verifying.
- **Separate browser contexts for multi-user tests.** Use `browser.newContext()` when testing interactions between different users.
- **Use Playwright auto-waiting.** `expect(...).toBeVisible()`, `page.waitForURL()` etc. handle retries automatically. Avoid `waitForTimeout` except for debounce windows.
- **Set explicit timeouts for long operations.** `test.setTimeout(60000)` for complex multi-step tests; `{ timeout: 15000 }` for slow assertions.

### Multi-User Tests

Use separate browser contexts for different users:

```typescript
test('multi-user flow', async ({ page, browser }) => {
  // Create a separate browser context for user B
  const userBContext = await browser.newContext();
  const userBPage = await userBContext.newPage();

  try {
    // ... user A actions on `page` ...
    // ... user B actions on `userBPage` ...
  } finally {
    await userBContext.close();
  }
});
```

## What This Skill Does NOT Do

- Increase timeouts as a fix (if something takes 30 seconds, there's a bug)
- Skip verifying something that should be happening
- Ignore assertions that seem "flaky"
- Push to CI to debug (always debug locally first)
