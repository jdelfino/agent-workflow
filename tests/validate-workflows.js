const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflowsDir = path.join(__dirname, '../.github/workflows');

// Get all workflow files
const workflowFiles = fs.readdirSync(workflowsDir)
  .filter(f => f.endsWith('.yml') && f !== '.gitkeep')
  .map(f => path.join(workflowsDir, f));

// Expected workflow files
const expectedWorkflows = [
  'guardrail-api-surface.yml',
  'guardrail-commits.yml',
  'guardrail-dependencies.yml',
  'guardrail-scope.yml',
  'guardrail-test-ratio.yml',
  'human-review.yml',
  'orchestrator-check.yml',
  'pr-review.yml'
];

test('All expected workflow files exist', () => {
  const actualFiles = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.yml') && f !== '.gitkeep');

  for (const expected of expectedWorkflows) {
    assert.ok(actualFiles.includes(expected), `Missing workflow: ${expected}`);
  }
});

test('All workflow files are valid YAML', () => {
  for (const file of workflowFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // Should not throw
    const parsed = yaml.load(content);
    assert.ok(parsed, `Failed to parse ${path.basename(file)}`);
  }
});

test('All workflows have required top-level fields', () => {
  for (const file of workflowFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const workflow = yaml.load(content);
    const name = path.basename(file);

    assert.ok(workflow.name, `${name}: missing 'name' field`);
    assert.ok(workflow.on, `${name}: missing 'on' field`);
    assert.ok(workflow.permissions, `${name}: missing 'permissions' field`);
    assert.ok(workflow.jobs, `${name}: missing 'jobs' field`);
  }
});

test('All workflows have at least one job', () => {
  for (const file of workflowFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const workflow = yaml.load(content);
    const name = path.basename(file);

    const jobNames = Object.keys(workflow.jobs);
    assert.ok(jobNames.length > 0, `${name}: no jobs defined`);
  }
});

test('All jobs have required fields', () => {
  for (const file of workflowFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const workflow = yaml.load(content);
    const workflowName = path.basename(file);

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      assert.ok(job['runs-on'], `${workflowName}:${jobName}: missing 'runs-on' field`);
      assert.ok(job.steps, `${workflowName}:${jobName}: missing 'steps' field`);
      assert.ok(Array.isArray(job.steps), `${workflowName}:${jobName}: 'steps' must be an array`);
      assert.ok(job.steps.length > 0, `${workflowName}:${jobName}: must have at least one step`);
    }
  }
});

test('Guardrail workflows have correct structure', () => {
  const guardrailFiles = workflowFiles.filter(f => path.basename(f).startsWith('guardrail-'));

  for (const file of guardrailFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const workflow = yaml.load(content);
    const name = path.basename(file);

    // Check trigger
    assert.ok(workflow.on.pull_request, `${name}: should trigger on pull_request`);

    // Check permissions
    assert.ok(workflow.permissions.checks === 'write', `${name}: should have checks: write permission`);
    assert.ok(workflow.permissions.contents === 'read', `${name}: should have contents: read permission`);
    assert.ok(workflow.permissions['pull-requests'] === 'read', `${name}: should have pull-requests: read permission`);

    // Check that job uses github-script action
    const jobs = Object.values(workflow.jobs);
    const hasGithubScript = jobs.some(job =>
      job.steps.some(step => step.uses && step.uses.includes('actions/github-script'))
    );
    assert.ok(hasGithubScript, `${name}: should use actions/github-script`);
  }
});

test('PR review workflow has correct structure', () => {
  const file = workflowFiles.find(f => path.basename(f) === 'pr-review.yml');
  assert.ok(file, 'pr-review.yml not found');

  const content = fs.readFileSync(file, 'utf8');
  const workflow = yaml.load(content);

  // Check triggers
  assert.ok(workflow.on.pull_request, 'should trigger on pull_request');
  assert.ok(workflow.on.workflow_dispatch, 'should support workflow_dispatch');

  // Check permissions
  assert.ok(workflow.permissions.contents === 'read', 'should have contents: read');
  assert.ok(workflow.permissions.issues === 'write', 'should have issues: write');
  assert.ok(workflow.permissions['pull-requests'] === 'write', 'should have pull-requests: write');
  assert.ok(workflow.permissions['id-token'] === 'write', 'should have id-token: write');

  // Check for resolve-context job
  assert.ok(workflow.jobs['resolve-context'], 'should have resolve-context job');

  // Check for reviewer jobs
  assert.ok(workflow.jobs['review-correctness'], 'should have review-correctness job');
  assert.ok(workflow.jobs['review-tests'], 'should have review-tests job');
  assert.ok(workflow.jobs['review-architecture'], 'should have review-architecture job');

  // Check job dependencies
  assert.ok(workflow.jobs['review-correctness'].needs === 'resolve-context', 'review-correctness should depend on resolve-context');
  assert.ok(workflow.jobs['review-tests'].needs === 'resolve-context', 'review-tests should depend on resolve-context');
  assert.ok(workflow.jobs['review-architecture'].needs === 'resolve-context', 'review-architecture should depend on resolve-context');
});

test('Orchestrator workflow has correct structure', () => {
  const file = workflowFiles.find(f => path.basename(f) === 'orchestrator-check.yml');
  assert.ok(file, 'orchestrator-check.yml not found');

  const content = fs.readFileSync(file, 'utf8');
  const workflow = yaml.load(content);

  // Check triggers
  assert.ok(workflow.on.issues, 'should trigger on issues events');
  assert.ok(workflow.on.pull_request, 'should trigger on pull_request events');

  // Check permissions
  assert.ok(workflow.permissions.checks === 'write', 'should have checks: write');
  assert.ok(workflow.permissions.issues === 'read', 'should have issues: read');
  assert.ok(workflow.permissions['pull-requests'] === 'read', 'should have pull-requests: read');
  assert.ok(workflow.permissions.contents === 'read', 'should have contents: read');
  assert.ok(workflow.permissions.actions === 'write', 'should have actions: write');

  // Check for orchestrator job
  assert.ok(workflow.jobs.orchestrator, 'should have orchestrator job');

  // Check for CLAUDE_CODE_OAUTH_TOKEN in env
  const orchestratorJob = workflow.jobs.orchestrator;
  const hasTokenEnv = orchestratorJob.steps.some(step =>
    step.env && step.env.CLAUDE_CODE_OAUTH_TOKEN
  );
  assert.ok(hasTokenEnv, 'should have CLAUDE_CODE_OAUTH_TOKEN in env');
});

test('Human review workflow has correct structure', () => {
  const file = workflowFiles.find(f => path.basename(f) === 'human-review.yml');
  assert.ok(file, 'human-review.yml not found');

  const content = fs.readFileSync(file, 'utf8');
  const workflow = yaml.load(content);

  // Check trigger
  assert.ok(workflow.on.pull_request_review, 'should trigger on pull_request_review');

  // Check permissions
  assert.ok(workflow.permissions.issues === 'write', 'should have issues: write');
  assert.ok(workflow.permissions.contents === 'read', 'should have contents: read');
  assert.ok(workflow.permissions['pull-requests'] === 'write', 'should have pull-requests: write');
});

test('All workflow steps have names', () => {
  for (const file of workflowFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const workflow = yaml.load(content);
    const workflowName = path.basename(file);

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      for (let i = 0; i < job.steps.length; i++) {
        const step = job.steps[i];
        assert.ok(step.name, `${workflowName}:${jobName}:step[${i}]: missing 'name' field`);
      }
    }
  }
});

test('Workflows using github-script reference correct script paths', () => {
  for (const file of workflowFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const workflow = yaml.load(content);
    const workflowName = path.basename(file);

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      for (const step of job.steps) {
        if (step.uses && step.uses.includes('actions/github-script')) {
          assert.ok(step.with && step.with.script,
            `${workflowName}:${jobName}: github-script step must have 'with.script'`);

          // Check if script references a file
          if (step.with.script.includes('require(')) {
            const scriptPath = step.with.script.match(/require\('([^']+)'\)/)?.[1];
            if (scriptPath && scriptPath.startsWith('./.github/agent-workflow/scripts/')) {
              const scriptFile = path.join(__dirname, '..', scriptPath);
              assert.ok(fs.existsSync(scriptFile),
                `${workflowName}:${jobName}: referenced script ${scriptPath} does not exist`);
            }
          }
        }
      }
    }
  }
});
