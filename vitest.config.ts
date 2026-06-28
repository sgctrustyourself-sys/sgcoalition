import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Split the suite into two projects so jest-dom matchers only load
        // for React component tests in *.test.tsx. Pure-logic .ts suites
        // (noRefundsPolicy, rendererSmoke) keep the same jsdom environment
        // (noRefundsPolicy redefines `window.navigator.userAgent` in its
        // beforeEach) but skip the setupFiles hook so jest-dom globals
        // can't leak into suites that don't import @testing-library.
        // Future .ts tests that genuinely need a DOM can opt in per-file
        // via `// @vitest-environment jsdom`.
        projects: [
            {
                test: {
                    name: 'react-components',
                    environment: 'jsdom',
                    include: ['tests/**/*.test.tsx'],
                    setupFiles: ['tests/setup.ts'],
                },
            },
            {
                test: {
                    name: 'jsdom-utils',
                    environment: 'jsdom',
                    include: ['tests/**/*.test.ts'],
                },
            },
        ],
    },
});
