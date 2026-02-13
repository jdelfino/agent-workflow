const { test } = require('node:test');
const assert = require('node:assert');
const { detectSeverity } = require('./severity.js');

test('detectSeverity - blocking keywords', () => {
  assert.strictEqual(detectSeverity('This is blocking the release'), 'blocking');
  assert.strictEqual(detectSeverity('BLOCKING: critical issue'), 'blocking');
  assert.strictEqual(detectSeverity('This must be fixed'), 'blocking');
  assert.strictEqual(detectSeverity('critical bug here'), 'blocking');
});

test('detectSeverity - suggestion keywords', () => {
  assert.strictEqual(detectSeverity('Consider refactoring this'), 'suggestion');
  assert.strictEqual(detectSeverity('nit: extra space'), 'suggestion');
  assert.strictEqual(detectSeverity('optional: could improve'), 'suggestion');
  assert.strictEqual(detectSeverity('minor: formatting'), 'suggestion');
});

test('detectSeverity - default should-fix', () => {
  assert.strictEqual(detectSeverity('This needs to be fixed'), 'should-fix');
  assert.strictEqual(detectSeverity('Bug in the implementation'), 'should-fix');
  assert.strictEqual(detectSeverity('Random comment'), 'should-fix');
});

test('detectSeverity - case insensitive', () => {
  assert.strictEqual(detectSeverity('BLOCKING issue'), 'blocking');
  assert.strictEqual(detectSeverity('Nit: formatting'), 'suggestion');
});
