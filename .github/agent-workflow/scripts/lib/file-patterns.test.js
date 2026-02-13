const { test } = require('node:test');
const assert = require('node:assert');
const { isTestFile, isCodeFile, isDependencyFile } = require('./file-patterns.js');

test('isTestFile - recognizes test files', () => {
  assert.strictEqual(isTestFile('src/foo.test.js'), true);
  assert.strictEqual(isTestFile('src/foo.spec.ts'), true);
  assert.strictEqual(isTestFile('__tests__/foo.js'), true);
  assert.strictEqual(isTestFile('tests/integration/bar.py'), true);
  assert.strictEqual(isTestFile('lib/foo_test.go'), true);
});

test('isTestFile - rejects non-test files', () => {
  assert.strictEqual(isTestFile('src/index.js'), false);
  assert.strictEqual(isTestFile('lib/utils.ts'), false);
  assert.strictEqual(isTestFile('README.md'), false);
});

test('isCodeFile - recognizes code files', () => {
  assert.strictEqual(isCodeFile('src/index.js'), true);
  assert.strictEqual(isCodeFile('lib/utils.ts'), true);
  assert.strictEqual(isCodeFile('app/main.py'), true);
  assert.strictEqual(isCodeFile('cmd/server.go'), true);
  assert.strictEqual(isCodeFile('pkg/auth/handler.rs'), true);
});

test('isCodeFile - rejects non-code files', () => {
  assert.strictEqual(isCodeFile('README.md'), false);
  assert.strictEqual(isCodeFile('package.json'), false);
  assert.strictEqual(isCodeFile('.gitignore'), false);
  assert.strictEqual(isCodeFile('docs/guide.txt'), false);
});

test('isDependencyFile - recognizes dependency files', () => {
  assert.strictEqual(isDependencyFile('package.json'), true);
  assert.strictEqual(isDependencyFile('package-lock.json'), true);
  assert.strictEqual(isDependencyFile('requirements.txt'), true);
  assert.strictEqual(isDependencyFile('go.mod'), true);
  assert.strictEqual(isDependencyFile('go.sum'), true);
  assert.strictEqual(isDependencyFile('Cargo.toml'), true);
  assert.strictEqual(isDependencyFile('Cargo.lock'), true);
  assert.strictEqual(isDependencyFile('pom.xml'), true);
  assert.strictEqual(isDependencyFile('Gemfile'), true);
  assert.strictEqual(isDependencyFile('Gemfile.lock'), true);
});

test('isDependencyFile - rejects non-dependency files', () => {
  assert.strictEqual(isDependencyFile('src/index.js'), false);
  assert.strictEqual(isDependencyFile('README.md'), false);
  assert.strictEqual(isDependencyFile('config.json'), false);
});
