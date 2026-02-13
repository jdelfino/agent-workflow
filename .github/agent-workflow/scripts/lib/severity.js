/**
 * Detect severity level from review comment text
 * @param {string} comment - Review comment text
 * @returns {string} - 'blocking', 'should-fix', or 'suggestion'
 */
function detectSeverity(comment) {
  if (!comment) return 'should-fix';

  const lower = comment.toLowerCase();

  // Blocking keywords
  const blockingPatterns = [
    /\bblocking\b/,
    /\bcritical\b/,
    /\bmust\s+(?:be\s+)?fix/,
    /\bmust\s+(?:be\s+)?change/
  ];

  for (const pattern of blockingPatterns) {
    if (pattern.test(lower)) return 'blocking';
  }

  // Suggestion keywords
  const suggestionPatterns = [
    /^nit:/,
    /\bnit\b/,
    /\boptional\b/,
    /\bconsider\b/,
    /\bsuggestion\b/,
    /\bminor\b/
  ];

  for (const pattern of suggestionPatterns) {
    if (pattern.test(lower)) return 'suggestion';
  }

  return 'should-fix';
}

module.exports = { detectSeverity };
