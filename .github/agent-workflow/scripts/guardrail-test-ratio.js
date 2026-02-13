const { parseGuardrailConfig } = require('./lib/config.js');
const { hasNonStaleApproval } = require('./lib/approval.js');
const { isTestFile, isCodeFile } = require('./lib/file-patterns.js');

module.exports = async function({ github, context, core }) {
  // Load configuration
  const fs = require('fs');
  const configPath = '.github/agent-workflow/config.yaml';
  let config = { enabled: true, conclusion: 'action_required', threshold: 0.5 };

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    config = { ...config, ...parseGuardrailConfig(content, 'test-ratio') };
  } catch (e) {
    core.info(`Could not read config from ${configPath}, using defaults: ${e.message}`);
  }

  if (!config.enabled) {
    core.info('Test-ratio guardrail is disabled in config. Skipping.');
    return;
  }

  const threshold = config.threshold || 0.5;

  // Get PR files
  const prNumber = context.payload.pull_request.number;
  const allFiles = [];
  let page = 1;
  while (true) {
    const { data: files } = await github.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      per_page: 100,
      page: page,
    });
    allFiles.push(...files);
    if (files.length < 100) break;
    page++;
  }

  // Categorize files and count lines
  let testLines = 0;
  let implLines = 0;
  const implFilesWithNoTests = [];

  for (const file of allFiles) {
    if (file.status === 'removed') continue;
    if (!isCodeFile(file.filename)) continue;

    const additions = file.additions || 0;

    if (isTestFile(file.filename)) {
      testLines += additions;
    } else {
      implLines += additions;
      implFilesWithNoTests.push({
        filename: file.filename,
        additions: additions,
      });
    }
  }

  core.info(`Test lines added: ${testLines}`);
  core.info(`Implementation lines added: ${implLines}`);

  // Handle edge case: no implementation lines
  if (implLines === 0) {
    core.info('No implementation lines in this PR. Reporting success.');
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.payload.pull_request.head.sha,
      name: 'guardrail/test-ratio',
      status: 'completed',
      conclusion: 'success',
      output: {
        title: 'Test-to-code ratio: no implementation changes',
        summary: 'This PR contains no implementation line additions. Test ratio check is not applicable.',
      },
    });
    return;
  }

  // Calculate ratio
  const ratio = testLines / implLines;
  const passed = ratio >= threshold;

  core.info(`Test-to-code ratio: ${ratio.toFixed(2)} (threshold: ${threshold})`);

  // Check for non-stale PR approval override
  const { data: reviews } = await github.rest.pulls.listReviews({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
  });

  const headSha = context.payload.pull_request.head.sha;
  const hasValidApproval = hasNonStaleApproval(reviews, headSha);

  // Determine conclusion
  let conclusion;
  let title;
  let summary;

  if (passed) {
    conclusion = 'success';
    title = `Test-to-code ratio: ${ratio.toFixed(2)} (threshold: ${threshold})`;
    summary = `PR has ${testLines} test lines and ${implLines} implementation lines added. Ratio ${ratio.toFixed(2)} meets the threshold of ${threshold}.`;
  } else if (hasValidApproval) {
    conclusion = 'success';
    title = `Test-to-code ratio: ${ratio.toFixed(2)} — approved by reviewer`;
    summary = `PR has ${testLines} test lines and ${implLines} implementation lines added. Ratio ${ratio.toFixed(2)} is below the threshold of ${threshold}, but a non-stale approval exists. Human has accepted the current state.`;
  } else {
    conclusion = config.conclusion;
    title = `Test-to-code ratio: ${ratio.toFixed(2)} (threshold: ${threshold})`;
    summary = `PR has ${testLines} test lines and ${implLines} implementation lines added. Ratio ${ratio.toFixed(2)} is below the threshold of ${threshold}. Add more tests or approve the PR to override.`;
  }

  // Build annotations for implementation files lacking test coverage
  const annotations = [];
  if (!passed && !hasValidApproval) {
    for (const file of implFilesWithNoTests) {
      if (file.additions > 0) {
        annotations.push({
          path: file.filename,
          start_line: 1,
          end_line: 1,
          annotation_level: 'warning',
          message: `This implementation file has ${file.additions} added lines. The overall test-to-code ratio (${ratio.toFixed(2)}) is below the threshold (${threshold}). Consider adding corresponding tests.`,
        });
      }
    }
  }

  const truncatedAnnotations = annotations.slice(0, 50);

  // Report check run
  await github.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    head_sha: headSha,
    name: 'guardrail/test-ratio',
    status: 'completed',
    conclusion: conclusion,
    output: {
      title: title,
      summary: summary,
      annotations: truncatedAnnotations,
    },
  });

  core.info(`Check run created with conclusion: ${conclusion}`);
};
