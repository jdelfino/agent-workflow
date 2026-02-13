/**
 * Validate commit message follows conventional commit format
 * @param {string} message - Commit message (first line)
 * @param {object} options - Validation options
 * @param {number} options.maxLength - Maximum subject length (default: 72)
 * @returns {boolean}
 */
function isValidCommit(message, options = {}) {
  if (!message) return false;

  const { maxLength = 72 } = options;

  // Extract first line (subject)
  const subject = message.split('\n')[0];

  // Check length
  if (subject.length > maxLength) return false;

  // Conventional commit format: type(scope)?: description
  // Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
  const conventionalRegex = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\([a-z0-9-]+\))?: .+/;

  return conventionalRegex.test(subject);
}

module.exports = { isValidCommit };
