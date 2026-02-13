const { hasNonStaleApproval } = require('./lib/approval.js');
const { detectAPIChanges } = require('./lib/api-patterns.js');

module.exports = async function({ github, context, core }) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const prNumber = context.payload.pull_request.number;
  const headSha = context.payload.pull_request.head.sha;
  const checkName = 'guardrail/api-surface';
  const configuredConclusion = process.env.CONCLUSION || 'action_required';

  // Check for non-stale PR approval override
  const reviews = await github.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  });
  const hasValidApproval = hasNonStaleApproval(reviews.data, headSha);

  if (hasValidApproval) {
    await github.rest.checks.create({
      owner,
      repo,
      head_sha: headSha,
      name: checkName,
      status: 'completed',
      conclusion: 'neutral',
      output: {
        title: 'API surface check: approved by reviewer',
        summary: 'A non-stale PR approval overrides this guardrail.',
      },
    });
    return;
  }

  // Get PR files and scan for API surface changes
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
  });

  // OpenAPI / Swagger file patterns
  const openApiFilePatterns = [
    /openapi\.(ya?ml|json)$/i,
    /swagger\.(ya?ml|json)$/i,
    /api-spec\.(ya?ml|json)$/i,
  ];

  const annotations = [];
  let totalApiChanges = 0;

  for (const file of files) {
    // Skip removed files
    if (file.status === 'removed') continue;

    // Check if this is an OpenAPI/Swagger spec file
    const isOpenApiFile = openApiFilePatterns.some((p) => p.test(file.filename));
    if (isOpenApiFile) {
      totalApiChanges++;
      annotations.push({
        path: file.filename,
        start_line: 1,
        end_line: 1,
        annotation_level: 'warning',
        message: `OpenAPI/Swagger spec file modified: ${file.filename}. API contract changes require careful review.`,
      });
      continue;
    }

    // Use API pattern detection from shared library
    if (!file.patch) continue;

    const apiChanges = detectAPIChanges(file.patch, file.filename);
    if (apiChanges.length > 0) {
      totalApiChanges += apiChanges.length;

      // Parse patch for line numbers
      const lines = file.patch.split('\n');
      let currentLine = 0;
      let changeIndex = 0;

      for (const line of lines) {
        // Track line numbers from hunk headers
        const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
        if (hunkMatch) {
          currentLine = parseInt(hunkMatch[1], 10);
          continue;
        }

        // Only look at added lines
        if (line.startsWith('+') && !line.startsWith('+++')) {
          if (changeIndex < apiChanges.length) {
            annotations.push({
              path: file.filename,
              start_line: currentLine,
              end_line: currentLine,
              annotation_level: 'warning',
              message: `API surface change: ${apiChanges[changeIndex]} - ${line.substring(1).trim()}`,
            });
            changeIndex++;
          }
        }

        // Advance line counter for added and context lines
        if (!line.startsWith('-')) {
          currentLine++;
        }
      }
    }
  }

  // Report results
  if (totalApiChanges === 0) {
    await github.rest.checks.create({
      owner,
      repo,
      head_sha: headSha,
      name: checkName,
      status: 'completed',
      conclusion: 'success',
      output: {
        title: 'API surface check: no changes detected',
        summary: 'No API surface changes found in this PR.',
      },
    });
  } else {
    // GitHub API limits annotations to 50 per call
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < annotations.length; i += batchSize) {
      batches.push(annotations.slice(i, i + batchSize));
    }

    const summary = [
      `Found ${totalApiChanges} API surface change(s) across the PR.`,
      '',
      'API surface changes have outsized downstream impact. Review these changes carefully.',
      '',
      'To override: approve the PR to signal these changes are intentional.',
    ].join('\n');

    // Create the check run with the first batch of annotations
    const checkRun = await github.rest.checks.create({
      owner,
      repo,
      head_sha: headSha,
      name: checkName,
      status: 'completed',
      conclusion: configuredConclusion,
      output: {
        title: `API surface check: ${totalApiChanges} change(s) detected`,
        summary,
        annotations: batches[0] || [],
      },
    });

    // If there are more annotations, update the check run with additional batches
    for (let i = 1; i < batches.length; i++) {
      await github.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRun.data.id,
        output: {
          title: `API surface check: ${totalApiChanges} change(s) detected`,
          summary,
          annotations: batches[i],
        },
      });
    }
  }
};
