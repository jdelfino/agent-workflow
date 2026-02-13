const { test } = require('node:test');
const assert = require('node:assert');
const { detectAPIChanges } = require('../../.github/agent-workflow/scripts/lib/api-patterns.js');

test('detectAPIChanges - JavaScript export changes', () => {
  const diff = `
+export function newAPI() {}
-export function oldAPI() {}
+export const API_CONSTANT = 42;
  `;
  const changes = detectAPIChanges(diff, 'file.js');
  assert.ok(changes.length > 0);
  assert.ok(changes.some(c => c.includes('newAPI')));
});

test('detectAPIChanges - TypeScript interface changes', () => {
  const diff = `
+export interface NewInterface {
+  field: string;
+}
  `;
  const changes = detectAPIChanges(diff, 'types.ts');
  assert.ok(changes.length > 0);
  assert.ok(changes.some(c => c.includes('NewInterface')));
});

test('detectAPIChanges - Python class changes', () => {
  const diff = `
+class PublicAPI:
+    def __init__(self):
+        pass
  `;
  const changes = detectAPIChanges(diff, 'module.py');
  assert.ok(changes.length > 0);
});

test('detectAPIChanges - no API changes', () => {
  const diff = `
+// Internal helper function
+function helper() {}
+const internal = 123;
  `;
  const changes = detectAPIChanges(diff, 'file.js');
  assert.strictEqual(changes.length, 0);
});

test('detectAPIChanges - empty diff', () => {
  const changes = detectAPIChanges('', 'file.js');
  assert.strictEqual(changes.length, 0);
});
