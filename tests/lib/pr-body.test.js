const { test } = require('node:test');
const assert = require('node:assert');
const { replaceSection } = require('../../.github/agent-workflow/scripts/lib/pr-body.js');

test('replaceSection - adds new section to empty body', () => {
  const result = replaceSection('', '## Fixes', 'Fixes #123');
  assert.ok(result.includes('## Fixes'));
  assert.ok(result.includes('Fixes #123'));
});

test('replaceSection - replaces existing section', () => {
  const body = '## Summary\nSome text\n\n## Fixes\nFixes #100\n\n## Other\nMore text';
  const result = replaceSection(body, '## Fixes', 'Fixes #200\nFixes #201');
  assert.ok(result.includes('Fixes #200'));
  assert.ok(result.includes('Fixes #201'));
  assert.ok(!result.includes('Fixes #100'));
  assert.ok(result.includes('## Summary'));
  assert.ok(result.includes('## Other'));
});

test('replaceSection - preserves other sections', () => {
  const body = '## Summary\nOriginal\n\n## Test Plan\nOriginal test plan';
  const result = replaceSection(body, '## Fixes', 'Fixes #999');
  assert.ok(result.includes('## Summary'));
  assert.ok(result.includes('Original'));
  assert.ok(result.includes('## Test Plan'));
  assert.ok(result.includes('Original test plan'));
  assert.ok(result.includes('Fixes #999'));
});

test('replaceSection - idempotent updates', () => {
  const body = '## Summary\nText\n\n## Fixes\nFixes #123';
  const result1 = replaceSection(body, '## Fixes', 'Fixes #123');
  const result2 = replaceSection(result1, '## Fixes', 'Fixes #123');
  assert.strictEqual(result1, result2);
});
