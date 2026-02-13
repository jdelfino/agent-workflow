/**
 * Extract file paths from issue text
 * @param {string} text - Issue body or comment text
 * @returns {string[]} - Array of unique file paths
 */
function extractFilePaths(text) {
  if (!text) return [];

  const filePathPatterns = [
    // Backtick-wrapped paths with extension
    /`([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)`/g,
    // Bare paths with at least one slash and an extension
    /(?:^|\s)((?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)(?:\s|$|[,;)])/gm,
    // Paths starting with ./ or common root dirs
    /(?:^|\s)(\.?(?:src|lib|app|test|tests|spec|pkg|cmd|internal|\.github)\/[a-zA-Z0-9_./-]+)(?:\s|$|[,;)])/gm
  ];

  const paths = new Set();
  for (const pattern of filePathPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const filePath = match[1].replace(/^\//, ''); // strip leading slash
      paths.add(filePath);
    }
  }

  return Array.from(paths);
}

/**
 * Check if a changed file path is within scope
 * @param {string} changedPath - Path of changed file
 * @param {string[]} scopeFiles - Array of scope file paths/prefixes
 * @returns {boolean}
 */
function isInScope(changedPath, scopeFiles) {
  for (const scopePath of scopeFiles) {
    // Exact match
    if (changedPath === scopePath) return true;

    // Scope entry is a directory prefix
    const prefix = scopePath.endsWith('/') ? scopePath : scopePath + '/';
    if (changedPath.startsWith(prefix)) return true;
  }

  return false;
}

module.exports = { extractFilePaths, isInScope };
