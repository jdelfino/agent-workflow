const { parseFixesReferences } = require('./lib/fixes-parser.js');

module.exports = async function({ github, context, core }) {
  let prNumber;
  let prData;

  if (context.eventName === 'workflow_dispatch') {
    // workflow_dispatch input is passed via environment variable
    prNumber = parseInt(process.env.PR_NUMBER, 10);
    const { data } = await github.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
    });
    prData = data;
  } else {
    prNumber = context.payload.pull_request.number;
    prData = context.payload.pull_request;
  }

  // Parse "fixes #N" or "Fixes #N" from PR body
  const body = prData.body || '';
  const issueNumbers = parseFixesReferences(body);
  const parentIssue = issueNumbers.length > 0 ? issueNumbers[0].toString() : '';

  if (!parentIssue) {
    console.log('No parent issue found — PR body has no "Fixes #N" reference.');
  }

  core.setOutput('pr-number', prNumber.toString());
  core.setOutput('parent-issue', parentIssue);
  core.setOutput('base-branch', prData.base.ref);
  core.setOutput('pr-title', prData.title);
};
