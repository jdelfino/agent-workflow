/**
 * Detect API surface changes in a diff
 * @param {string} diff - Unified diff content
 * @param {string} filename - File being changed
 * @returns {string[]} - Array of detected API changes
 */
function detectAPIChanges(diff, filename) {
  if (!diff) return [];

  const changes = [];
  const lines = diff.split('\n');

  // Language-specific patterns for API surface detection
  const patterns = {
    js: [
      /^\+\s*export\s+(function|const|let|var|class|interface|type|enum)\s+(\w+)/,
      /^\+\s*export\s+default/,
      /^\+\s*export\s*{/
    ],
    ts: [
      /^\+\s*export\s+(function|const|let|var|class|interface|type|enum)\s+(\w+)/,
      /^\+\s*export\s+default/,
      /^\+\s*export\s*{/,
      /^\+\s*export\s+interface\s+(\w+)/
    ],
    py: [
      /^\+\s*class\s+(\w+)/,
      /^\+\s*def\s+(\w+)/,
      /^\+\s*async\s+def\s+(\w+)/
    ],
    go: [
      /^\+\s*func\s+(\w+)/,
      /^\+\s*type\s+(\w+)\s+(?:struct|interface)/
    ],
    rs: [
      /^\+\s*pub\s+fn\s+(\w+)/,
      /^\+\s*pub\s+struct\s+(\w+)/,
      /^\+\s*pub\s+enum\s+(\w+)/,
      /^\+\s*pub\s+trait\s+(\w+)/
    ]
  };

  // Determine language from file extension
  const ext = filename.split('.').pop();
  const langPatterns = patterns[ext] || patterns.js;

  for (const line of lines) {
    // Only look at added lines
    if (!line.startsWith('+')) continue;

    for (const pattern of langPatterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[2] || match[1] || 'exported item';
        changes.push(`Added/modified export: ${name}`);
        break;
      }
    }
  }

  // Also check for removed exports
  for (const line of lines) {
    if (!line.startsWith('-')) continue;

    for (const pattern of langPatterns) {
      // Adjust pattern for removal (- instead of +)
      const removePattern = new RegExp(pattern.source.replace(/^\\\+/, '-'));
      const match = line.match(removePattern);
      if (match) {
        const name = match[2] || match[1] || 'exported item';
        changes.push(`Removed export: ${name}`);
        break;
      }
    }
  }

  return changes;
}

module.exports = { detectAPIChanges };
