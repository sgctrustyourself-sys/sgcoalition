// Flat ESLint config for SG Coalition.
// - typescript-eslint recommended rules for type-aware safety net.
// - React + React Hooks recommendations for the SPA surface area.
// - Node globals for API handlers and scripts, Vitest globals for tests.
// - Known noisy/high-volume rules are demoted to `warn` (or `off`) so the first
//   lint run surfaces issues without flooding the report; tighten over time as
//   the existing 226 `any` types and similar smells are addressed.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            '.vercel/**',
            '.git/**',
            'public/**',
            // Documentation/copy is hand-curated prose; lints only the typed source.
            'docs/**',
        ],
    },

    js.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['**/*.{ts,tsx,jsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2022,
            },
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            // React 17+ JSX transform doesn't need React in scope; we're a TypeScript
            // project so prop-types is off. Both behaviors already come from the
            // recommended React spread above.
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,

            // --- High-volume existing smells: warn, not error. Tighten later. ---
            // ~226 occurrences; address via the broader "reduce `any`" workstream.
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            // Allow consistent `console.warn` / `console.error`; discourage `console.log`.
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'warn',
            'no-empty': ['error', { allowEmptyCatch: true }],
            // React hooks hygiene.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },

    // Server APIs: Node runtime, may use either module or commonjs patterns.
    {
        files: ['api/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
        rules: {
            'no-process-env': 'off',
        },
    },

    // CommonJS server-side files — explicit commonjs so `import.meta` / top-level
    // await rules don't misfire. scripts/*.ts keep the default module sourceType
    // because they're run via `tsx` as ESM.
    {
        files: ['server.cjs', 'scripts/**/*.cjs', 'scripts/**/*.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
    },

    // ESM Node scripts (e.g. scripts/generateSeoArtifacts.mjs).
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
    },

    // scripts/*.ts are run via `tsx` as ESM Node. They use process.env / require /
    // __dirname, so they need Node globals — otherwise `no-undef` would false-flag
    // every script.
    {
        files: ['scripts/**/*.ts'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
        rules: {
            'no-process-env': 'off',
        },
    },

    // Vitest test contexts.
    {
        files: ['tests/**/*.{ts,tsx}', 'tests/setup.ts', '**/*.test.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.vitest,
                ...globals.node,
            },
        },
        rules: {
            // Test files can use `any`.
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },
);
