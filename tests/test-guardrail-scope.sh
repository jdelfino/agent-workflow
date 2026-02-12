#!/usr/bin/env bash
# Test suite for guardrail-scope.yml
# Validates YAML syntax, required workflow structure, and key logic elements.

set -euo pipefail

WORKFLOW_FILE="/workspaces/agent-workflow-feat-3-github-actions/.github/workflows/guardrail-scope.yml"
FAILURES=0
PASSES=0

fail() {
  echo "FAIL: $1"
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "PASS: $1"
  PASSES=$((PASSES + 1))
}

# Test 1: File exists
if [ -f "$WORKFLOW_FILE" ]; then
  pass "Workflow file exists"
else
  fail "Workflow file does not exist at $WORKFLOW_FILE"
  echo ""
  echo "Results: $PASSES passed, $FAILURES failed"
  exit 1
fi

# Test 2: Valid YAML syntax
if python3 -c "import yaml; yaml.safe_load(open('$WORKFLOW_FILE'))" 2>/dev/null; then
  pass "Valid YAML syntax"
else
  fail "Invalid YAML syntax"
fi

# Test 3: Has required trigger events (pull_request opened and synchronize)
if python3 -c "
import yaml
with open('$WORKFLOW_FILE') as f:
    wf = yaml.safe_load(f)
assert 'on' in wf or True in wf, 'Missing on: trigger'
triggers = wf.get('on') or wf.get(True)
assert 'pull_request' in triggers, 'Missing pull_request trigger'
pr = triggers['pull_request']
types = pr.get('types', [])
assert 'opened' in types, 'Missing opened type'
assert 'synchronize' in types, 'Missing synchronize type'
" 2>/dev/null; then
  pass "Has pull_request trigger with opened and synchronize types"
else
  fail "Missing pull_request trigger with opened and synchronize types"
fi

# Test 4: Workflow has a name
if python3 -c "
import yaml
with open('$WORKFLOW_FILE') as f:
    wf = yaml.safe_load(f)
assert 'name' in wf, 'Missing name'
assert wf['name'], 'Name is empty'
" 2>/dev/null; then
  pass "Workflow has a name"
else
  fail "Workflow has no name"
fi

# Test 5: Uses actions/github-script@v7
if grep -q 'actions/github-script@v7' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Uses actions/github-script@v7"
else
  fail "Does not use actions/github-script@v7"
fi

# Test 6: Uses actions/checkout
if grep -q 'actions/checkout' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Uses actions/checkout"
else
  fail "Does not use actions/checkout (needed for config reading)"
fi

# Test 7: References Check Run API (checks.create)
if grep -q 'checks.create' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References checks.create API"
else
  fail "Does not reference checks.create API"
fi

# Test 8: Handles PR approval override (listReviews)
if grep -q 'listReviews' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References listReviews for approval override"
else
  fail "Does not reference listReviews for approval override"
fi

# Test 9: Parses issue references (fixes #N pattern)
if grep -qi 'fixes\s*#' "$WORKFLOW_FILE" 2>/dev/null || grep -qi 'fixes.*#' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References 'fixes #N' pattern parsing"
else
  fail "Does not reference 'fixes #N' pattern parsing"
fi

# Test 10: Compares changed files against issue scope
if grep -q 'listFiles\|changed_files\|files changed\|changedFiles' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References PR file listing"
else
  fail "Does not reference PR file listing"
fi

# Test 11: Has permissions set for checks write
if grep -q 'checks:\s*write' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Has checks: write permission"
else
  fail "Does not have checks: write permission"
fi

# Test 12: Reports annotations on out-of-scope files
if grep -q 'annotation' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References annotations for out-of-scope files"
else
  fail "Does not reference annotations"
fi

# Test 13: Reads config from .github/agent-workflow/
if grep -q 'agent-workflow' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References agent-workflow config path"
else
  fail "Does not reference agent-workflow config path"
fi

# Test 14: Handles different check conclusions (success, neutral, action_required)
HAS_SUCCESS=$(grep -c "'success'" "$WORKFLOW_FILE" 2>/dev/null || echo 0)
HAS_NEUTRAL=$(grep -c "'neutral'" "$WORKFLOW_FILE" 2>/dev/null || echo 0)
HAS_ACTION=$(grep -c "'action_required'" "$WORKFLOW_FILE" 2>/dev/null || echo 0)
if [ "$HAS_SUCCESS" -gt 0 ] && [ "$HAS_NEUTRAL" -gt 0 ] && [ "$HAS_ACTION" -gt 0 ]; then
  pass "Has all three check conclusions (success, neutral, action_required)"
else
  fail "Missing check conclusions (success=$HAS_SUCCESS, neutral=$HAS_NEUTRAL, action_required=$HAS_ACTION)"
fi

# Test 15: Check run name matches expected convention
if grep -q 'guardrail/scope' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Uses guardrail/scope check run naming"
else
  fail "Does not use guardrail/scope check run naming convention"
fi

# Test 16: Has proper job structure with runs-on
if python3 -c "
import yaml
with open('$WORKFLOW_FILE') as f:
    wf = yaml.safe_load(f)
jobs = wf.get('jobs', {})
assert len(jobs) > 0, 'No jobs defined'
for job_name, job in jobs.items():
    assert 'runs-on' in job, f'Job {job_name} missing runs-on'
    assert 'steps' in job, f'Job {job_name} missing steps'
" 2>/dev/null; then
  pass "Has proper job structure with runs-on and steps"
else
  fail "Missing proper job structure"
fi

# Test 17: Has issues read permission (needed to read issue body)
if grep -q 'issues:\s*read' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Has issues: read permission"
else
  fail "Does not have issues: read permission"
fi

# Test 18: Has pull-requests read permission (needed for reviews)
if grep -q 'pull-requests:\s*read' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Has pull-requests: read permission"
else
  fail "Does not have pull-requests: read permission"
fi

# Test 19: Handles config disabled case
if grep -q 'config.enabled' "$WORKFLOW_FILE" 2>/dev/null && grep -q 'disabled' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Handles config disabled case"
else
  fail "Does not handle config disabled case"
fi

# Test 20: Handles missing PR body (null/empty)
if grep -q "context.payload.pull_request.body || ''" "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Handles null/empty PR body"
else
  fail "Does not handle null/empty PR body"
fi

# Test 21: Handles issue read failure gracefully
if grep -q 'issue not found' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Handles issue read failure gracefully"
else
  fail "Does not handle issue read failure"
fi

# Test 22: Handles no files in issue body gracefully
if grep -q 'no files listed in issue' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Handles no file paths in issue body"
else
  fail "Does not handle missing file paths in issue"
fi

# Test 23: Paginates changed files (per_page: 100)
if grep -q 'per_page: 100' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Paginates changed files with per_page 100"
else
  fail "Does not paginate changed files"
fi

# Test 24: Non-stale approval uses commit_id check
if grep -q 'commit_id.*headSha\|r.commit_id === headSha' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Non-stale approval checks commit_id against head SHA"
else
  fail "Non-stale approval does not check commit_id"
fi

# Test 25: Check run status is set to 'completed'
if grep -q "status: 'completed'" "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Check run status set to completed"
else
  fail "Check run status not set to completed"
fi

# Test 26: Limits annotations to 50 (GitHub API limit)
if grep -q 'slice(0, 50)' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Limits annotations to 50 per API limit"
else
  fail "Does not limit annotations to 50"
fi

# Test 27: Supports backtick-wrapped file paths in issue body
if grep -q 'backtick\|Backtick\|`(' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Supports backtick-wrapped file path extraction"
else
  fail "Does not support backtick-wrapped file paths"
fi

# Test 28: Minor violations (1-2 files) report neutral instead of action_required
if grep -q 'isMinor' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Distinguishes minor from significant violations"
else
  fail "Does not distinguish minor from significant violations"
fi

echo ""
echo "============================="
echo "Results: $PASSES passed, $FAILURES failed"
echo "============================="

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
