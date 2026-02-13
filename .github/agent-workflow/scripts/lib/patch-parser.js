/**
 * Parse line numbers of added/modified lines from a unified diff patch
 * @param {string} patch - Unified diff patch content
 * @returns {number[]} - Array of line numbers that were added or modified
 */
function parseLineNumbers(patch) {
  if (!patch) return [];

  const lines = patch.split('\n');
  const lineNumbers = [];
  let currentLine = 0;

  for (const line of lines) {
    // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    // Skip if we haven't seen a hunk header yet
    if (currentLine === 0) continue;

    // Added line (+)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNumbers.push(currentLine);
      currentLine++;
    }
    // Context line (space) or modified line
    else if (line.startsWith(' ')) {
      currentLine++;
    }
    // Deleted line (-) - don't increment current line in new file
    else if (line.startsWith('-') && !line.startsWith('---')) {
      // Don't increment - this line doesn't exist in new version
    }
  }

  return lineNumbers;
}

module.exports = { parseLineNumbers };
