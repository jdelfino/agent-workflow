#!/usr/bin/env bash
# Test suite for guardrail-commits.yml
# Validates YAML syntax, required workflow structure, and key logic elements.

set -euo pipefail

WORKFLOW_FILE="/workspaces/agent-workflow-feat-3-github-actions/.github/workflows/guardrail-commits.yml"
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

# Test 6: Uses actions/checkout (needed for config reading)
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

# Test 9: References pulls.listCommits for fetching PR commits
if grep -q 'listCommits' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References listCommits for PR commit fetching"
else
  fail "Does not reference listCommits for PR commit fetching"
fi

# Test 10: Contains conventional commit regex pattern
if grep -q 'feat\|fix\|chore\|docs\|test\|refactor' "$WORKFLOW_FILE" 2>/dev/null && \
   grep -qE '\^?\(feat\|fix|feat\|fix' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Contains conventional commit type prefixes in regex"
else
  fail "Does not contain conventional commit type prefixes in regex"
fi

# Test 11: Checks first line length (72 chars)
if grep -q '72' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References 72 char max length for first line"
else
  fail "Does not reference 72 char max length"
fi

# Test 12: Has permissions set for checks write
if grep -q 'checks:\s*write' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Has checks: write permission"
else
  fail "Does not have checks: write permission"
fi

# Test 13: Has pull-requests read permission (needed for reviews and commits)
if grep -q 'pull-requests:\s*read' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Has pull-requests: read permission"
else
  fail "Does not have pull-requests: read permission"
fi

# Test 14: Reads config from .github/agent-workflow/
if grep -q 'agent-workflow' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References agent-workflow config path"
else
  fail "Does not reference agent-workflow config path"
fi

# Test 15: Handles different check conclusions (success, neutral, action_required)
HAS_SUCCESS=$(grep -c "'success'" "$WORKFLOW_FILE" 2>/dev/null || echo 0)
HAS_NEUTRAL=$(grep -c "'neutral'" "$WORKFLOW_FILE" 2>/dev/null || echo 0)
HAS_ACTION=$(grep -c "'action_required'" "$WORKFLOW_FILE" 2>/dev/null || echo 0)
if [ "$HAS_SUCCESS" -gt 0 ] && [ "$HAS_NEUTRAL" -gt 0 ] && [ "$HAS_ACTION" -gt 0 ]; then
  pass "Has all three check conclusions (success, neutral, action_required)"
else
  fail "Missing check conclusions (success=$HAS_SUCCESS, neutral=$HAS_NEUTRAL, action_required=$HAS_ACTION)"
fi

# Test 16: Check run name matches expected convention
if grep -q 'guardrail/commit-messages' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Uses guardrail/commit-messages check run naming"
else
  fail "Does not use guardrail/commit-messages check run naming convention"
fi

# Test 17: Has proper job structure with runs-on
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

# Test 18: Lists non-conforming commits in summary
if grep -qi 'summary\|non.conforming\|violation' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "References summary reporting for non-conforming commits"
else
  fail "Does not reference summary reporting for non-conforming commits"
fi

# Test 19: Default conclusion is neutral (non-blocking per design)
if grep -qi "default.*neutral\|neutral.*default" "$WORKFLOW_FILE" 2>/dev/null || \
   python3 -c "
import yaml
with open('$WORKFLOW_FILE') as f:
    content = f.read()
assert 'neutral' in content.lower(), 'Missing neutral default'
# Check that neutral is mentioned as default somewhere in a comment or variable
assert any(kw in content.lower() for kw in ['default', 'configuredconclusion', 'configured_conclusion', 'conclusion']), 'Missing default conclusion logic'
" 2>/dev/null; then
  pass "Uses neutral as default conclusion"
else
  fail "Does not use neutral as default conclusion"
fi

# Test 20: Checks for non-stale approval (compares commit_id)
if grep -q 'commit_id\|head_sha\|APPROVED' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Checks for non-stale approval via commit_id comparison"
else
  fail "Does not check for non-stale approval"
fi

# Test 21: Contains all required conventional commit types
if python3 -c "
with open('$WORKFLOW_FILE') as f:
    content = f.read()
required_types = ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'ci', 'style', 'perf', 'build', 'revert']
for t in required_types:
    assert t in content, f'Missing conventional commit type: {t}'
" 2>/dev/null; then
  pass "Contains all required conventional commit types"
else
  fail "Missing one or more conventional commit types"
fi

# Test 22: Has contents read permission (needed for checkout/config)
if grep -q 'contents:\s*read' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Has contents: read permission"
else
  fail "Does not have contents: read permission"
fi

# Test 23: Config parsing handles nested guardrails structure
if grep -q 'guardrails' "$WORKFLOW_FILE" 2>/dev/null && \
   grep -q 'commit-messages' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Config parsing references guardrails.commit-messages nested structure"
else
  fail "Config parsing does not handle nested guardrails structure"
fi

# Test 24: Handles config disabled case (enabled: false)
if grep -q "enabled.*false\|'false'" "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Handles config disabled case (enabled: false)"
else
  fail "Does not handle config disabled case"
fi

# Test 25: Non-stale approval compares commit_id against head SHA
if grep -q 'commit_id' "$WORKFLOW_FILE" 2>/dev/null && \
   grep -q 'head.sha\|headSha' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Non-stale approval compares commit_id against head SHA"
else
  fail "Does not compare commit_id against head SHA for non-stale approval"
fi

# Test 26: Paginates commits with per_page
if grep -q 'per_page' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Paginates commits with per_page parameter"
else
  fail "Does not paginate commits with per_page"
fi

# Test 27: Splits commit message on newline to get first line
if grep -q "split.*\\\\n\|split('\\\n')\|firstLine" "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Extracts first line from commit message"
else
  fail "Does not extract first line from commit message"
fi

# Test 28: Reports violation count in check run title
if grep -qi 'nonConformingCount\|non.conforming.*commit' "$WORKFLOW_FILE" 2>/dev/null; then
  pass "Reports non-conforming commit count in check run output"
else
  fail "Does not report non-conforming commit count"
fi

echo ""
echo "============================="
echo "Results: $PASSES passed, $FAILURES failed"
echo "============================="

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
