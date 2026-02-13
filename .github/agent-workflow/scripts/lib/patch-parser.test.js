const { test } = require('node:test');
const assert = require('node:assert');
const { parseLineNumbers } = require('./patch-parser.js');

test('parseLineNumbers - simple addition', () => {
  const patch = `
@@ -10,5 +10,6 @@
 line 10
 line 11
+added line 12
 line 13
  `;
  const lines = parseLineNumbers(patch);
  assert.ok(lines.includes(12));
});

test('parseLineNumbers - multiple hunks', () => {
  const patch = `
@@ -10,3 +10,4 @@
 line 10
+added line 11
 line 12
@@ -20,2 +21,3 @@
 line 21
+added line 22
  `;
  const lines = parseLineNumbers(patch);
  assert.ok(lines.includes(11));
  assert.ok(lines.includes(22));
});

test('parseLineNumbers - deletions not included', () => {
  const patch = `
@@ -10,4 +10,3 @@
 line 10
-deleted line 11
 line 12
  `;
  const lines = parseLineNumbers(patch);
  assert.ok(!lines.includes(11));
});

test('parseLineNumbers - empty patch', () => {
  const lines = parseLineNumbers('');
  assert.deepStrictEqual(lines, []);
});
