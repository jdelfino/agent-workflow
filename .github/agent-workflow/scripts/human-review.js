const { detectSeverity } = require('./lib/severity.js');
const { parseFixesReferences } = require('./lib/fixes-parser.js');

module.exports = async function({ github, context, core }) {
  const review = context.payload.review;
  const pr = context.payload.pull_request;

  // Parse parent issue from PR body
  const issueNumbers = parseFixesReferences(pr.body);
  if (issueNumbers.length === 0) {
    console.log('No parent issue found — PR body has no "Fixes #N" reference. Skipping.');
    return;
  }
  const parentIssueNumber = issueNumbers[0];

  // Fetch comments for this specific review
  const { data: reviewComments } = await github.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments',
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
      review_id: review.id,
    }
  );

  if (reviewComments.length === 0) {
    console.log('Review has no line-level comments. Skipping.');
    return;
  }

  // Get parent issue node_id for GraphQL sub-issue linking
  const { data: parentIssue } = await github.rest.issues.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: parentIssueNumber,
  });
  const parentNodeId = parentIssue.node_id;

  // Ensure labels exist
  const severityLabels = ['blocking', 'should-fix', 'suggestion'];
  const labelColors = {
    'blocking': 'B60205',
    'should-fix': 'D93F0B',
    'suggestion': '0E8A16',
  };

  for (const label of severityLabels) {
    try {
      await github.rest.issues.getLabel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: label,
      });
    } catch {
      await github.rest.issues.createLabel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: label,
        color: labelColors[label],
      });
    }
  }

  // Process each comment
  const createdIssues = [];
  let hasBlockingComments = false;

  for (const comment of reviewComments) {
    const severity = detectSeverity(comment.body);
    const filePath = comment.path;
    const line = comment.original_line || comment.line || 0;

    // Build issue body with file/line context
    const issueBody = [
      `## Review Finding`,
      ``,
      `**Severity:** \`${severity}\``,
      `**File:** \`${filePath}\`${line ? ` (line ${line})` : ''}`,
      `**PR:** #${pr.number}`,
      `**Reviewer:** @${review.user.login}`,
      ``,
      `### Comment`,
      ``,
      comment.body,
      ``,
      `---`,
      `_Created automatically from a PR review comment._`,
    ].join('\n');

    const issueTitle = `[${severity}] ${filePath}${line ? `:${line}` : ''}: ${comment.body.split('\n')[0].substring(0, 80)}`;

    // Create the child issue
    const { data: newIssue } = await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: issueTitle,
      body: issueBody,
      labels: [severity],
    });

    console.log(`Created issue #${newIssue.number}: ${newIssue.title}`);

    // Link as sub-issue via GraphQL addSubIssue mutation
    try {
      await github.graphql(`
        mutation($parentId: ID!, $childId: ID!) {
          addSubIssue(input: { issueId: $parentId, subIssueId: $childId }) {
            issue { id }
            subIssue { id }
          }
        }
      `, {
        parentId: parentNodeId,
        childId: newIssue.node_id,
      });
      console.log(`Linked issue #${newIssue.number} as sub-issue of #${parentIssueNumber}`);
    } catch (err) {
      console.log(`Warning: Could not link sub-issue via GraphQL: ${err.message}`);
    }

    // If blocking, set as blocking the parent issue
    if (severity === 'blocking') {
      hasBlockingComments = true;
      try {
        await github.request(
          'POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority',
          {
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: parentIssueNumber,
            sub_issue_id: newIssue.id,
          }
        );
      } catch (err) {
        console.log(`Note: Could not set blocking dependency via REST: ${err.message}`);
      }
    }

    createdIssues.push({
      number: newIssue.number,
      severity,
    });
  }

  // Update PR description with Fixes references
  if (createdIssues.length > 0) {
    const fixesLines = createdIssues
      .map(i => `Fixes #${i.number}`)
      .join('\n');

    const newSection = [
      '<!-- human-review-issues-start -->',
      '### Review Finding Issues',
      fixesLines,
      '<!-- human-review-issues-end -->',
    ].join('\n');

    // Replace existing section or append, for idempotent updates
    let currentBody = pr.body || '';
    const sectionRegex = /<!-- human-review-issues-start -->[\s\S]*?<!-- human-review-issues-end -->/;
    let updatedBody;
    if (sectionRegex.test(currentBody)) {
      updatedBody = currentBody.replace(sectionRegex, newSection);
    } else {
      updatedBody = currentBody + '\n\n' + newSection;
    }

    await github.rest.pulls.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
      body: updatedBody,
    });

    console.log(`Updated PR #${pr.number} body with ${createdIssues.length} Fixes references`);
  }

  // Summary
  const blockingCount = createdIssues.filter(i => i.severity === 'blocking').length;
  const shouldFixCount = createdIssues.filter(i => i.severity === 'should-fix').length;
  const suggestionCount = createdIssues.filter(i => i.severity === 'suggestion').length;

  console.log(`\nDone. Created ${createdIssues.length} issues from review comments:`);
  console.log(`  blocking: ${blockingCount}`);
  console.log(`  should-fix: ${shouldFixCount}`);
  console.log(`  suggestion: ${suggestionCount}`);

  if (hasBlockingComments) {
    console.log(`\nBlocking issues were created — parent issue #${parentIssueNumber} has new blockers.`);
  }
};
