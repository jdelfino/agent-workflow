const { test } = require('node:test');
const assert = require('node:assert');
const { parseFixesReferences } = require('../../.github/agent-workflow/scripts/lib/fixes-parser.js');

test('parseFixesReferences - single fixes reference', () => {
  const body = 'This PR fixes #123';
  const result = parseFixesReferences(body);
  assert.deepStrictEqual(result, [123]);
});

test('parseFixesReferences - multiple fixes references', () => {
  const body = 'Fixes #10\nFixes #20\nFixes #30';
  const result = parseFixesReferences(body);
  assert.deepStrictEqual(result, [10, 20, 30]);
});

test('parseFixesReferences - case insensitive', () => {
  const body = 'fixes #1\nFIXES #2\nFiXeS #3';
  const result = parseFixesReferences(body);
  assert.deepStrictEqual(result, [1, 2, 3]);
});

test('parseFixesReferences - no matches', () => {
  const body = 'This PR does not fix anything';
  const result = parseFixesReferences(body);
  assert.deepStrictEqual(result, []);
});

test('parseFixesReferences - null or undefined body', () => {
  assert.deepStrictEqual(parseFixesReferences(null), []);
  assert.deepStrictEqual(parseFixesReferences(undefined), []);
  assert.deepStrictEqual(parseFixesReferences(''), []);
});

test('parseFixesReferences - deduplicates issue numbers', () => {
  const body = 'Fixes #10\nFixes #10\nFixes #20';
  const result = parseFixesReferences(body);
  assert.deepStrictEqual(result, [10, 20]);
});
