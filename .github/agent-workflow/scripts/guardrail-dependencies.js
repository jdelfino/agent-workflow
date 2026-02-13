const { parseGuardrailConfig } = require('./lib/config.js');
const { hasNonStaleApproval } = require('./lib/approval.js');
const { isDependencyFile } = require('./lib/file-patterns.js');

module.exports = async function({ github, context, core }) {
  const fs = require('fs');
  const CHECK_NAME = 'guardrail/dependency-changes';

  const JUSTIFICATION_KEYWORDS = [
    'dependency', 'dependencies',
    'added', 'adding',
    'requires', 'required',
    'needed for', 'needed by',
    'introduced',
    'new package', 'new library', 'new module',
    'upgrade', 'upgraded', 'upgrading',
    'update', 'updated', 'updating',
    'migration', 'migrate', 'migrating',
    'replace', 'replaced', 'replacing',
    'security fix', 'security patch', 'vulnerability',
    'CVE-'
  ];

  // Read config
  let checkEnabled = true;
  let configuredConclusion = 'action_required';
  try {
    const configPath = '.github/agent-workflow/config.yaml';
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = parseGuardrailConfig(content, 'dependency-changes');
      checkEnabled = config.enabled;
      configuredConclusion = config.conclusion;
    }
  } catch (e) {
    core.warning(`Failed to read config: ${e.message}. Using defaults.`);
  }

  // If check is disabled, report success and exit
  if (!checkEnabled) {
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.sha,
      name: CHECK_NAME,
      status: 'completed',
      conclusion: 'success',
      output: {
        title: 'Dependency changes: check disabled',
        summary: 'This guardrail check is disabled in config.yaml.'
      }
    });
    return;
  }

  // Check for non-stale approving PR review (override mechanism)
  const { data: reviews } = await github.rest.pulls.listReviews({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number
  });

  const lastCommitSha = context.payload.pull_request.head.sha;
  const hasValidApproval = hasNonStaleApproval(reviews, lastCommitSha);

  if (hasValidApproval) {
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.sha,
      name: CHECK_NAME,
      status: 'completed',
      conclusion: 'success',
      output: {
        title: 'Dependency changes: approved by reviewer',
        summary: 'A non-stale PR approval overrides dependency change violations.'
      }
    });
    return;
  }

  // Get PR changed files
  const files = await github.paginate(
    github.rest.pulls.listFiles,
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      per_page: 100
    }
  );

  const changedDependencyFiles = files.filter(f => isDependencyFile(f.filename));

  // No dependency files changed: success
  if (changedDependencyFiles.length === 0) {
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.sha,
      name: CHECK_NAME,
      status: 'completed',
      conclusion: 'success',
      output: {
        title: 'Dependency changes: no dependency files modified',
        summary: 'No dependency manifest or lock files were changed in this PR.'
      }
    });
    return;
  }

  // Dependency files changed: check for justification
  const prBody = (context.payload.pull_request.body || '').toLowerCase();

  function hasJustification(text) {
    const lowerText = text.toLowerCase();
    return JUSTIFICATION_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  let justified = hasJustification(prBody);

  // If not justified in PR body, check linked issue body
  if (!justified) {
    const issueMatch = (context.payload.pull_request.body || '').match(
      /(?:fixes|closes|resolves)\s+#(\d+)/i
    );
    if (issueMatch) {
      try {
        const { data: issue } = await github.rest.issues.get({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: parseInt(issueMatch[1], 10)
        });
        if (issue.body) {
          justified = hasJustification(issue.body);
        }
      } catch (e) {
        core.warning(`Failed to fetch linked issue #${issueMatch[1]}: ${e.message}`);
      }
    }
  }

  // Build annotations for changed dependency files
  const annotations = changedDependencyFiles.map(f => ({
    path: f.filename,
    start_line: 1,
    end_line: 1,
    annotation_level: 'warning',
    message: justified
      ? `Dependency file changed. Justification found in PR or linked issue.`
      : `Dependency file changed without justification. Add context about why dependencies were changed to the PR description or linked issue.`
  }));

  // Report result
  if (justified) {
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.sha,
      name: CHECK_NAME,
      status: 'completed',
      conclusion: 'success',
      output: {
        title: `Dependency changes: ${changedDependencyFiles.length} file(s) changed with justification`,
        summary: `Dependency files were modified and justification was found in the PR body or linked issue.\n\n**Changed dependency files:**\n${changedDependencyFiles.map(f => '- `' + f.filename + '`').join('\n')}`,
        annotations: annotations
      }
    });
  } else {
    const fileList = changedDependencyFiles.map(f => '- `' + f.filename + '`').join('\n');
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.sha,
      name: CHECK_NAME,
      status: 'completed',
      conclusion: configuredConclusion,
      output: {
        title: `Dependency changes: ${changedDependencyFiles.length} file(s) changed without justification`,
        summary: `Dependency files were modified but no justification was found.\n\n**Changed dependency files:**\n${fileList}\n\n**To resolve:** Add context about dependency changes to the PR description using keywords like: ${JUSTIFICATION_KEYWORDS.slice(0, 8).map(k => '"' + k + '"').join(', ')}, etc.\n\nAlternatively, a PR approval will override this check.`,
        annotations: annotations
      }
    });
  }
};
