const { test } = require('node:test');
const assert = require('node:assert');
const { hasNonStaleApproval } = require('./approval.js');

test('hasNonStaleApproval - approved at head SHA', () => {
  const reviews = [
    { state: 'APPROVED', commit_id: 'abc123' },
    { state: 'COMMENTED', commit_id: 'abc123' }
  ];
  assert.strictEqual(hasNonStaleApproval(reviews, 'abc123'), true);
});

test('hasNonStaleApproval - no approvals', () => {
  const reviews = [
    { state: 'COMMENTED', commit_id: 'abc123' },
    { state: 'CHANGES_REQUESTED', commit_id: 'abc123' }
  ];
  assert.strictEqual(hasNonStaleApproval(reviews, 'abc123'), false);
});

test('hasNonStaleApproval - stale approval (different SHA)', () => {
  const reviews = [
    { state: 'APPROVED', commit_id: 'old123' }
  ];
  assert.strictEqual(hasNonStaleApproval(reviews, 'new456'), false);
});

test('hasNonStaleApproval - multiple approvals, at least one non-stale', () => {
  const reviews = [
    { state: 'APPROVED', commit_id: 'old123' },
    { state: 'APPROVED', commit_id: 'new456' }
  ];
  assert.strictEqual(hasNonStaleApproval(reviews, 'new456'), true);
});

test('hasNonStaleApproval - empty reviews', () => {
  assert.strictEqual(hasNonStaleApproval([], 'abc123'), false);
});
