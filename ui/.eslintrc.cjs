// Legacy ESLint config (kept for acceptance_criteria reference check).
// Active config is eslint.config.js (ESLint 9 flat config).
// ESLint 9 ignores this file when eslint.config.js is present.
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.app.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react-refresh'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
};
