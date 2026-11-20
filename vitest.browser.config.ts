import { defineConfig } from 'vitest/config';

// The browser suite: tests that launch Chromium (and, in this case, a Vite dev
// server) instead of rendering into jsdom.
//
// WHY A SEPARATE CONFIG. The default `npm test` suite is run in places that have
// no browser binary at all — most importantly the release path: vite.config.ts
// installs utils/bareCheckoutGate.mjs, which runs `npm test` as the build's first
// act, so a browser test inside the default suite would fail every Vercel build
// for want of a Chromium that the build never installs. Keeping browser tests out
// of vitest.config.ts's `include` (rather than out of its results) is what makes
// that impossible.
//
// It is not the exclude list in vitest.config.ts: vitest 4 drops the positional
// file filter through that list, so an excluded file cannot be run on its own
// either. This config selects the browser tests positively.
//
// Callers:
//   npm run test:sgcoin-reverse    (.github/workflows/post-deploy-gate.yml)
//   npx vitest run --config vitest.browser.config.ts
export default defineConfig({
    test: {
        // Node, not jsdom: these drive a real Chromium over CDP and boot a Vite
        // server in-process. Rendering React into jsdom here would trip the
        // esbuild TextEncoder invariant in an isolated single-file run.
        environment: 'node',
        include: ['tests/sgcoinReverseButton.test.ts'],
    },
});
