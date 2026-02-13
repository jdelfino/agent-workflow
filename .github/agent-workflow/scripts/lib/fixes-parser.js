/**
 * Parse "Fixes #N" references from PR body
 * @param {string} body - PR body text
 * @returns {number[]} - Array of issue numbers
 */
function parseFixesReferences(body) {
  if (!body) return [];

  const regex = /fixes\s+#(\d+)/gi;
  const matches = [];
  const seen = new Set();

  let match;
  while ((match = regex.exec(body)) !== null) {
    const issueNum = parseInt(match[1], 10);
    if (!seen.has(issueNum)) {
      matches.push(issueNum);
      seen.add(issueNum);
    }
  }

  return matches;
}

module.exports = { parseFixesReferences };
