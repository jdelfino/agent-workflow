/**
 * Extract file paths and glob patterns from issue text
 * @param {string} text - Issue body or comment text
 * @returns {string[]} - Array of unique file paths and patterns
 */
function extractFilePaths(text) {
  if (!text) return [];

  const filePathPatterns = [
    // Backtick-wrapped paths with extension or glob patterns (now includes *)
    /`([a-zA-Z0-9_./*-]+\.[a-zA-Z0-9]+)`/g,
    // Backtick-wrapped paths with wildcards
    /`([a-zA-Z0-9_./*-]+\/\*+[a-zA-Z0-9_./*-]*)`/g,
    // Bare paths with at least one slash and an extension (including *)
    /(?:^|\s)((?:[a-zA-Z0-9_.*-]+\/)+[a-zA-Z0-9_.*-]+\.[a-zA-Z0-9]+)(?:\s|$|[,;)])/gm,
    // Paths starting with ./ or common root dirs (including *)
    /(?:^|\s)(\.?(?:src|lib|app|test|tests|spec|pkg|cmd|internal|\.github)\/[a-zA-Z0-9_./*-]+)(?:\s|$|[,;)])/gm
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
 * Convert a glob pattern to a regular expression
 * @param {string} pattern - Glob pattern (supports * and **)
 * @returns {RegExp} - Regular expression matching the pattern
 */
function globToRegex(pattern) {
  // Escape special regex characters except * and /
  let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Use placeholders to protect our regex patterns from later replacements
  const PLACEHOLDER_A = '\x00A\x00'; // For **/
  const PLACEHOLDER_B = '\x00B\x00'; // For /**
  const PLACEHOLDER_C = '\x00C\x00'; // For **

  // Replace **/ with a pattern that matches zero or more path segments
  // This allows lib/**/*.js to match both lib/file.js and lib/sub/file.js
  regexStr = regexStr.replace(/\*\*\//g, PLACEHOLDER_A);

  // Replace /** at the end with a pattern that matches anything
  regexStr = regexStr.replace(/\/\*\*$/g, PLACEHOLDER_B);

  // Replace remaining ** with .* (matches anything including /)
  regexStr = regexStr.replace(/\*\*/g, PLACEHOLDER_C);

  // Replace single * with regex that matches anything except /
  regexStr = regexStr.replace(/\*/g, '[^/]*');

  // Now replace placeholders with actual regex patterns
  regexStr = regexStr.replace(new RegExp(PLACEHOLDER_A, 'g'), '(?:(?:[^/]+/)*)');
  regexStr = regexStr.replace(new RegExp(PLACEHOLDER_B, 'g'), '(?:/.*)?');
  regexStr = regexStr.replace(new RegExp(PLACEHOLDER_C, 'g'), '.*');

  // Anchor the pattern to match the full path
  return new RegExp('^' + regexStr + '$');
}

/**
 * Check if a changed file path is within scope
 * @param {string} changedPath - Path of changed file
 * @param {string[]} scopeFiles - Array of scope file paths/prefixes/patterns
 * @returns {boolean}
 */
function isInScope(changedPath, scopeFiles) {
  for (const scopePath of scopeFiles) {
    // Check if this is a glob pattern (contains * or **)
    if (scopePath.includes('*')) {
      const regex = globToRegex(scopePath);
      if (regex.test(changedPath)) return true;
    } else {
      // Exact match
      if (changedPath === scopePath) return true;

      // Scope entry is a directory prefix
      const prefix = scopePath.endsWith('/') ? scopePath : scopePath + '/';
      if (changedPath.startsWith(prefix)) return true;
    }
  }

  return false;
}

module.exports = { extractFilePaths, isInScope, globToRegex };
