/**
 * Check if a file is a test file
 * @param {string} filename
 * @returns {boolean}
 */
function isTestFile(filename) {
  return /\.(test|spec)\.(js|ts|jsx|tsx|py|go|rs)$/.test(filename) ||
         /__tests__\//.test(filename) ||
         /(^|\/)tests?\//.test(filename) ||
         /_test\.(go|rs)$/.test(filename);
}

/**
 * Check if a file is a code file
 * @param {string} filename
 * @returns {boolean}
 */
function isCodeFile(filename) {
  return /\.(js|ts|jsx|tsx|py|go|rs|java|rb|php|c|cpp|h|hpp)$/.test(filename) &&
         !isTestFile(filename);
}

/**
 * Check if a file is a dependency manifest
 * @param {string} filename
 * @returns {boolean}
 */
function isDependencyFile(filename) {
  const depFiles = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'requirements.txt',
    'Pipfile',
    'Pipfile.lock',
    'go.mod',
    'go.sum',
    'Cargo.toml',
    'Cargo.lock',
    'pom.xml',
    'build.gradle',
    'Gemfile',
    'Gemfile.lock',
    'composer.json',
    'composer.lock'
  ];

  const basename = filename.split('/').pop();
  return depFiles.includes(basename);
}

module.exports = { isTestFile, isCodeFile, isDependencyFile };
