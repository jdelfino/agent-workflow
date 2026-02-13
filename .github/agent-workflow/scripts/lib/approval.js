/**
 * Check if there is a non-stale PR approval
 * @param {Array} reviews - Array of review objects from GitHub API
 * @param {string} headSha - Current head SHA of the PR
 * @returns {boolean}
 */
function hasNonStaleApproval(reviews, headSha) {
  if (!reviews || reviews.length === 0) return false;

  return reviews.some(
    review => review.state === 'APPROVED' && review.commit_id === headSha
  );
}

module.exports = { hasNonStaleApproval };
