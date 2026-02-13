/**
 * Replace or add a section in PR body
 * @param {string} body - Current PR body
 * @param {string} sectionHeader - Section header (e.g., '## Fixes')
 * @param {string} newContent - New content for the section
 * @returns {string} - Updated PR body
 */
function replaceSection(body, sectionHeader, newContent) {
  if (!body) {
    return `${sectionHeader}\n${newContent}\n`;
  }

  // Escape special regex characters in header
  const escapedHeader = sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match the section from header to next ## or end of string
  const sectionRegex = new RegExp(
    `(${escapedHeader}\\n)[\\s\\S]*?(?=\\n## |$)`,
    'i'
  );

  if (sectionRegex.test(body)) {
    // Replace existing section
    return body.replace(sectionRegex, `$1${newContent}\n`);
  } else {
    // Append new section
    return `${body.trim()}\n\n${sectionHeader}\n${newContent}\n`;
  }
}

module.exports = { replaceSection };
