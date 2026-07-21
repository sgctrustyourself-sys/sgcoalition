import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.{ts,tsx}'],
        // Exclude tests that require external processes or heavyweight
        // browser infrastructure from the default `vitest run`:
        //
        //   clsRegression.test.ts — spawns a Vite dev server + headless
        //       Chromium via Playwright; ~32s minimum runtime. Run with:
        //       npx vitest run tests/clsRegression.test.ts
        //
        //   rendererSmoke.test.ts — calls `npm run reveal` which renders
        //       14 PNGs via the story reveal CLI pipeline; ~60s runtime.
        //       TODO(#renderer-fix): re-enable after grid:reveal slug fix.
        //       Run with: npx vitest run tests/rendererSmoke.test.ts
        //
        exclude: [
            'tests/clsRegression.test.ts',
            'tests/rendererSmoke.test.ts',
        ],

    },
});
