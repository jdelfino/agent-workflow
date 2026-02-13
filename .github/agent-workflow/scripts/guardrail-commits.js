const { parseGuardrailConfig } = require('./lib/config.js');
const { hasNonStaleApproval } = require('./lib/approval.js');
const { isValidCommit } = require('./lib/commit-validator.js');

module.exports = async function({ github, context, core }) {
  const fs = require('fs');
  const path = require('path');

  // Read config - default conclusion for commit message guardrail is 'neutral' (non-blocking warning)
  let configuredConclusion = 'neutral';
  const configPath = path.join(process.env.GITHUB_WORKSPACE, '.github', 'agent-workflow', 'config.yaml');

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = parseGuardrailConfig(configContent, 'commit-messages');

    if (config.enabled === false) {
      await github.rest.checks.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        head_sha: context.sha,
        name: 'guardrail/commit-messages',
        conclusion: 'success',
        output: {
          title: 'Commit message check: disabled',
          summary: 'This guardrail check is disabled in config.yaml.'
        }
      });
      return;
    }

    if (config.conclusion) {
      configuredConclusion = config.conclusion;
    }
  } catch (e) {
    core.info(`No config.yaml found at ${configPath}, using default conclusion: neutral`);
  }

  // Check for non-stale PR approval override
  const reviews = await github.rest.pulls.listReviews({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number
  });

  const headSha = context.payload.pull_request.head.sha;
  const hasValidApproval = hasNonStaleApproval(reviews.data, headSha);

  if (hasValidApproval) {
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.sha,
      name: 'guardrail/commit-messages',
      conclusion: 'success',
      output: {
        title: 'Commit message check: approved by reviewer',
        summary: 'A non-stale PR approval overrides this guardrail check.'
      }
    });
    return;
  }

  // Get PR commits
  const commits = await github.rest.pulls.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
    per_page: 100
  });

  // Validate each commit message
  const maxFirstLineLength = 72;
  const violations = [];

  for (const commit of commits.data) {
    const message = commit.commit.message;
    const firstLine = message.split('\n')[0];
    const sha = commit.sha.substring(0, 7);
    const commitViolations = [];

    // Check conventional commit format
    if (!isValidCommit(message, { maxLength: maxFirstLineLength })) {
      if (firstLine.length > maxFirstLineLength) {
        commitViolations.push(
          `First line exceeds ${maxFirstLineLength} characters (${firstLine.length} chars)`
        );
      }
      // Check if it's a format issue
      const conventionalCommitRegex = /^(feat|fix|chore|docs|test|refactor|ci|style|perf|build|revert)(\(.+\))?!?: .+/;
      if (!conventionalCommitRegex.test(firstLine)) {
        commitViolations.push(
          `Does not follow conventional commit format (expected: type(scope)?: description)`
        );
      }
    }

    if (commitViolations.length > 0) {
      violations.push({
        sha: sha,
        fullSha: commit.sha,
        firstLine: firstLine,
        issues: commitViolations
      });
    }
  }

  // Report results
  const totalCommits = commits.data.length;
  const nonConformingCount = violations.length;

  if (nonConformingCount === 0) {
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.sha,
      name: 'guardrail/commit-messages',
      conclusion: 'success',
      output: {
        title: `Commit message check: all ${totalCommits} commits conform`,
        summary: `All ${totalCommits} commit(s) follow conventional commit format with first line <= ${maxFirstLineLength} characters.`
      }
    });
    return;
  }

  // Build summary with non-conforming commits
  let summary = `## Non-conforming commits\n\n`;
  summary += `Found **${nonConformingCount}** of ${totalCommits} commit(s) with violations:\n\n`;

  for (const v of violations) {
    summary += `### \`${v.sha}\` — ${v.firstLine}\n`;
    for (const issue of v.issues) {
      summary += `- ${issue}\n`;
    }
    summary += '\n';
  }

  summary += `\n## Expected format\n\n`;
  summary += '```\n';
  summary += 'type(optional-scope): description (max 72 chars)\n';
  summary += '```\n\n';
  summary += `Valid types: \`feat\`, \`fix\`, \`chore\`, \`docs\`, \`test\`, \`refactor\`, \`ci\`, \`style\`, \`perf\`, \`build\`, \`revert\`\n\n`;
  summary += `**Configured conclusion:** \`${configuredConclusion}\`\n`;
  summary += `\nTo override: submit an approving PR review. The approval must be on the current head commit to be non-stale.\n`;

  await github.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    head_sha: context.sha,
    name: 'guardrail/commit-messages',
    conclusion: configuredConclusion,
    output: {
      title: `Commit message check: ${nonConformingCount} non-conforming commit(s)`,
      summary: summary
    }
  });
};
