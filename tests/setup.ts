// Vitest global setup — registers @testing-library/jest-dom custom matchers
// (toBeInTheDocument, toHaveTextContent, toBeVisible, etc.) so they show up
// on `expect()` without per-test imports. Loaded once via vitest.config.ts
// `setupFiles: ['tests/setup.ts']`.
//
// Keep this file side-effect-only: do not export anything and do not import
// the React component under test here — the per-test file should drive that
// so setup changes don't accidentally leak into unrelated suites.

import '@testing-library/jest-dom/vitest';
