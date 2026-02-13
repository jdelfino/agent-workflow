const { hasNonStaleApproval } = require('./lib/approval.js');
const { parseFixesReferences } = require('./lib/fixes-parser.js');
const { extractFilePaths, isInScope } = require('./lib/scope-matcher.js');

module.exports = async function({ github, context, core }) {
  const checkName = 'guardrail/scope';
  const configuredConclusion = process.env.CONCLUSION || 'action_required';

  // Helper: create check run
  async function createCheckRun(conclusion, title, summary, annotations = []) {
    const output = { title, summary };
    if (annotations.length > 0) {
      output.annotations = annotations.slice(0, 50);
    }
    await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head_sha: context.payload.pull_request.head.sha,
      name: checkName,
      status: 'completed',
      conclusion,
      output
    });
  }

  // Step 1: Check for non-stale PR approval override
  const reviews = await github.rest.pulls.listReviews({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number
  });
  const headSha = context.payload.pull_request.head.sha;
  const hasValidApproval = hasNonStaleApproval(reviews.data, headSha);

  // Step 3: Parse issue reference from PR body
  const prBody = context.payload.pull_request.body || '';
  const issueNumbers = parseFixesReferences(prBody);
  if (issueNumbers.length === 0) {
    await createCheckRun(
      'success',
      'Scope enforcement: no linked issue',
      'No `fixes #N` reference found in PR description. Scope enforcement skipped.'
    );
    return;
  }
  const issueNumber = issueNumbers[0];

  // Step 4: Get the issue body + all child issue bodies
  const issueBodies = [];
  try {
    const issue = await github.rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber
    });
    issueBodies.push(issue.data.body || '');
  } catch (e) {
    await createCheckRun(
      'success',
      'Scope enforcement: issue not found',
      `Could not read issue #${issueNumber}. Scope enforcement skipped.`
    );
    return;
  }

  // Query sub-issues via GraphQL
  try {
    const subIssueResult = await github.graphql(`
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            subIssues(first: 50) {
              nodes { body }
            }
          }
        }
      }
    `, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      number: issueNumber
    });
    const children = subIssueResult.repository.issue.subIssues.nodes || [];
    for (const child of children) {
      if (child.body) issueBodies.push(child.body);
    }
  } catch (e) {
    // Sub-issues query failed — continue with parent body only
  }

  // Step 5: Extract file paths from all issue bodies
  const scopeFiles = [];
  for (const body of issueBodies) {
    scopeFiles.push(...extractFilePaths(body));
  }
  const uniqueScopeFiles = [...new Set(scopeFiles)];

  if (uniqueScopeFiles.length === 0) {
    await createCheckRun(
      'success',
      'Scope enforcement: no files listed in issues',
      `Issue #${issueNumber} and its children do not list any file paths. Scope enforcement skipped.`
    );
    return;
  }

  // Step 6: Get changed files from the PR
  const changedFiles = [];
  let page = 1;
  while (true) {
    const resp = await github.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      per_page: 100,
      page
    });
    changedFiles.push(...resp.data);
    if (resp.data.length < 100) break;
    page++;
  }

  // Step 7: Compare changed files against scope
  const outOfScope = changedFiles.filter(f => !isInScope(f.filename, uniqueScopeFiles));

  // Step 8: Report results
  if (outOfScope.length === 0) {
    await createCheckRun(
      'success',
      'Scope enforcement: all files in scope',
      `All ${changedFiles.length} changed files are within scope of issue #${issueNumber} and its children.`
    );
    return;
  }

  // There are out-of-scope files
  if (hasValidApproval) {
    await createCheckRun(
      'neutral',
      `Scope enforcement: approved by reviewer (${outOfScope.length} files outside scope)`,
      `PR modifies ${outOfScope.length} file(s) not listed in issue #${issueNumber} or its children, but a non-stale approval exists.\n\nOut-of-scope files:\n${outOfScope.map(f => '- `' + f.filename + '`').join('\n')}`
    );
    return;
  }

  // Build annotations for out-of-scope files
  const annotations = outOfScope.map(f => ({
    path: f.filename,
    start_line: 1,
    end_line: 1,
    annotation_level: 'warning',
    message: `This file is not listed in the task scope for issue #${issueNumber} or its children. If this change is intentional, approve the PR to override.`
  }));

  // Determine conclusion based on config and severity
  const isMinor = outOfScope.length <= 2;
  const conclusion = isMinor ? 'neutral' : configuredConclusion;

  const summary = [
    `PR modifies ${outOfScope.length} file(s) not listed in issue #${issueNumber} or its children.`,
    '',
    '**Out-of-scope files:**',
    ...outOfScope.map(f => `- \`${f.filename}\``),
    '',
    `**In-scope files (from issues):**`,
    ...uniqueScopeFiles.map(f => `- \`${f}\``),
    '',
    'To resolve: either update the issue to include these files, or approve the PR to override this check.'
  ].join('\n');

  await createCheckRun(
    conclusion,
    `Scope enforcement: ${outOfScope.length} file(s) outside task scope`,
    summary,
    annotations
  );
};
