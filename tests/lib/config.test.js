const { test } = require('node:test');
const assert = require('node:assert');
const { parseGuardrailConfig } = require('../../.github/agent-workflow/scripts/lib/config.js');

test('parseGuardrailConfig - parses enabled and conclusion', () => {
  const yaml = `
guardrails:
  scope-enforcement:
    enabled: true
    conclusion: action_required
  `;
  const config = parseGuardrailConfig(yaml, 'scope-enforcement');
  assert.deepStrictEqual(config, { enabled: true, conclusion: 'action_required' });
});

test('parseGuardrailConfig - disabled guardrail', () => {
  const yaml = `
guardrails:
  test-ratio:
    enabled: false
    conclusion: neutral
  `;
  const config = parseGuardrailConfig(yaml, 'test-ratio');
  assert.deepStrictEqual(config, { enabled: false, conclusion: 'neutral' });
});

test('parseGuardrailConfig - missing section uses defaults', () => {
  const yaml = `
guardrails:
  other-check:
    enabled: true
  `;
  const config = parseGuardrailConfig(yaml, 'scope-enforcement');
  assert.deepStrictEqual(config, { enabled: true, conclusion: 'action_required' });
});

test('parseGuardrailConfig - empty yaml uses defaults', () => {
  const config = parseGuardrailConfig('', 'scope-enforcement');
  assert.deepStrictEqual(config, { enabled: true, conclusion: 'action_required' });
});

test('parseGuardrailConfig - partial config uses defaults', () => {
  const yaml = `
guardrails:
  scope-enforcement:
    enabled: false
  `;
  const config = parseGuardrailConfig(yaml, 'scope-enforcement');
  assert.deepStrictEqual(config, { enabled: false, conclusion: 'action_required' });
});

test('parseGuardrailConfig - with threshold', () => {
  const yaml = `
guardrails:
  test-ratio:
    enabled: true
    conclusion: action_required
    threshold: 0.7
  `;
  const config = parseGuardrailConfig(yaml, 'test-ratio');
  assert.deepStrictEqual(config, { enabled: true, conclusion: 'action_required', threshold: 0.7 });
});
