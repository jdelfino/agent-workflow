const { test } = require('node:test');
const assert = require('node:assert');
const { extractFilePaths, isInScope } = require('../../.github/agent-workflow/scripts/lib/scope-matcher.js');

test('extractFilePaths - backtick-wrapped paths', () => {
  const text = 'Modify `src/index.js` and `lib/utils.ts`';
  const paths = extractFilePaths(text);
  assert.deepStrictEqual(paths, ['src/index.js', 'lib/utils.ts']);
});

test('extractFilePaths - bare paths with slashes', () => {
  const text = 'Files: src/app/main.py and lib/helper.go';
  const paths = extractFilePaths(text);
  assert.ok(paths.includes('src/app/main.py'));
  assert.ok(paths.includes('lib/helper.go'));
});

test('extractFilePaths - common root directories', () => {
  const text = 'Update src/index.js, test/unit.js, and .github/workflows/ci.yml';
  const paths = extractFilePaths(text);
  assert.ok(paths.includes('src/index.js'));
  assert.ok(paths.includes('test/unit.js'));
  assert.ok(paths.includes('.github/workflows/ci.yml'));
});

test('extractFilePaths - no duplicates', () => {
  const text = 'File `src/index.js` and src/index.js again';
  const paths = extractFilePaths(text);
  assert.strictEqual(paths.filter(p => p === 'src/index.js').length, 1);
});

test('extractFilePaths - empty text', () => {
  assert.deepStrictEqual(extractFilePaths(''), []);
  assert.deepStrictEqual(extractFilePaths(null), []);
  assert.deepStrictEqual(extractFilePaths(undefined), []);
});

test('isInScope - exact match', () => {
  const scopeFiles = ['src/index.js', 'lib/utils.ts'];
  assert.strictEqual(isInScope('src/index.js', scopeFiles), true);
  assert.strictEqual(isInScope('lib/utils.ts', scopeFiles), true);
  assert.strictEqual(isInScope('other/file.js', scopeFiles), false);
});

test('isInScope - directory prefix', () => {
  const scopeFiles = ['src/', 'lib/auth/'];
  assert.strictEqual(isInScope('src/index.js', scopeFiles), true);
  assert.strictEqual(isInScope('src/app/main.js', scopeFiles), true);
  assert.strictEqual(isInScope('lib/auth/handler.js', scopeFiles), true);
  assert.strictEqual(isInScope('lib/other/file.js', scopeFiles), false);
});

test('isInScope - prefix without trailing slash', () => {
  const scopeFiles = ['src/auth'];
  assert.strictEqual(isInScope('src/auth/handler.js', scopeFiles), true);
  assert.strictEqual(isInScope('src/auth.ts', scopeFiles), false);
});
