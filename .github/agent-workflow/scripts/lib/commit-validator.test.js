const { test } = require('node:test');
const assert = require('node:assert');
const { isValidCommit } = require('./commit-validator.js');

test('isValidCommit - valid conventional commits', () => {
  assert.strictEqual(isValidCommit('feat: add new feature'), true);
  assert.strictEqual(isValidCommit('fix: resolve bug'), true);
  assert.strictEqual(isValidCommit('chore: update dependencies'), true);
  assert.strictEqual(isValidCommit('docs: improve README'), true);
  assert.strictEqual(isValidCommit('test: add unit tests'), true);
  assert.strictEqual(isValidCommit('refactor: simplify logic'), true);
});

test('isValidCommit - with scope', () => {
  assert.strictEqual(isValidCommit('feat(auth): add OAuth support'), true);
  assert.strictEqual(isValidCommit('fix(api): handle edge case'), true);
});

test('isValidCommit - with issue reference', () => {
  assert.strictEqual(isValidCommit('feat: add feature (#123)'), true);
  assert.strictEqual(isValidCommit('fix: resolve issue\n\nFixes #456'), true);
});

test('isValidCommit - invalid commits', () => {
  assert.strictEqual(isValidCommit('Add new feature'), false);
  assert.strictEqual(isValidCommit('FEAT: bad caps'), false);
  assert.strictEqual(isValidCommit('feat:missing space'), false);
  assert.strictEqual(isValidCommit(''), false);
});

test('isValidCommit - maximum length enforcement', () => {
  const longMsg = 'feat: ' + 'a'.repeat(100);
  assert.strictEqual(isValidCommit(longMsg, { maxLength: 72 }), false);
  assert.strictEqual(isValidCommit('feat: short msg', { maxLength: 72 }), true);
});
