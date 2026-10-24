import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'tmp/**',
      'docs/**',
      // Throwaway debug scripts: one has an unterminated string literal.
      'scripts/_debug-regex.mjs',
      'scripts/debug-parser.mjs',
      // Truncated mid-statement in its only commit; cannot be parsed. Tracked
      // separately: the Home and Shop CLS assertions must be restored first.
      'tests/clsRegression.test.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // TypeScript already checks globals and undefined names.
      'no-undef': 'off',
      // Real defects: keep as errors.
      'react-hooks/rules-of-hooks': 'error',
      'no-async-promise-executor': 'error',
      'no-case-declarations': 'error',
      'prefer-const': 'error',
      // Style-level findings that exist across the codebase: report, don't block.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'no-useless-escape': 'warn',
      'no-regex-spaces': 'warn',
      '@typescript-eslint/triple-slash-reference': 'warn',
    },
  },
  {
    // CommonJS and plain-JS scripts run under Node, not the TS module graph.
    files: ['**/*.{cjs,mjs,js}', 'worker.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.serviceworker },
      sourceType: 'commonjs',
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Node tooling: ES modules and CommonJS scripts reuse __dirname/__filename
    // and Node globals by design, and swallow cleanup errors with empty catch
    // blocks on purpose. These are not the app source.
    files: ['scripts/**', 'services/**/*.cjs', '**/*.cjs'],
    rules: {
      'no-redeclare': 'off',
      'no-empty': 'off',
      'no-control-regex': 'off',
    },
  },
);
