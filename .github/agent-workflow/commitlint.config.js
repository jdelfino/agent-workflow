module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce 72 char limit on subject line
    'header-max-length': [2, 'always', 72],
  }
};
