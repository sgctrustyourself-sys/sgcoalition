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
        //   viewContractButton.test.ts — boots Vite dev server + headless
        //       Chromium to click-test the Ecosystem 'View Contract' anchor.
        //       ~10-15s runtime + ~3s Chromium launch. Catches regressions
        //       if the anchor drifts back to href='#', loses target='_blank',
        //       or points to the wrong URL. Run directly:
        //       npx vitest run tests/viewContractButton.test.ts
        //
        //       soldYetBuyableAudit.test.ts is NOT excluded — exclusion also
        //       blocks an explicit `vitest run <file>` (CLI --exclude appends
        //       to this list). It self-gates instead: skipped unless
        //       RUN_LIVE_AUDIT=1, because it reads the live Supabase
        //       products + orders tables. Run with:
        //       npm run audit:live   (scripts/runLiveAudit.mjs arms the var —
        //       cmd.exe cannot run inline `VAR=1 cmd`, hence the wrapper)
        //       raw form: RUN_LIVE_AUDIT=1 npx vitest run tests/soldYetBuyableAudit.test.ts
        //
        exclude: [
            'tests/clsRegression.test.ts',
            'tests/rendererSmoke.test.ts',
            'tests/viewContractButton.test.ts',
        ],

    },
});
