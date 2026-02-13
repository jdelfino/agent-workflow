const { hasNonStaleApproval } = require('./lib/approval.js');
const { isDependencyFile } = require('./lib/file-patterns.js');

module.exports = async function({ github, context, core }) {
  const CHECK_NAME = 'guardrail/dependency-changes';
  const configuredConclusion = process.env.CONCLUSION || 'action_required';

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
      conclusion: 'neutral',
      output: {
        title: 'Dependency changes: approved by reviewer',
        summary: 'A non-stale PR approval overrides this guardrail check.'
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

  // Dependency files changed: requires human review
  const fileList = changedDependencyFiles.map(f => '- `' + f.filename + '`').join('\n');
  const annotations = changedDependencyFiles.map(f => ({
    path: f.filename,
    start_line: 1,
    end_line: 1,
    annotation_level: 'warning',
    message: 'Dependency file modified. Human review required before merge.'
  }));

  await github.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    head_sha: context.sha,
    name: CHECK_NAME,
    status: 'completed',
    conclusion: configuredConclusion,
    output: {
      title: `Dependency changes: ${changedDependencyFiles.length} file(s) modified`,
      summary: `Dependency files were modified and require human review before merge.\n\n**Changed dependency files:**\n${fileList}\n\n**To resolve:** A maintainer must submit an approving PR review. The approval must be on the current head commit (non-stale).`,
      annotations: annotations
    }
  });
};
