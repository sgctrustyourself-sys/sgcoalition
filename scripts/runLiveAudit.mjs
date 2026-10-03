// scripts/runLiveAudit.mjs
//
// Runs the live catalog audit (tests/soldYetBuyableAudit.test.ts) with
// RUN_LIVE_AUDIT=1 armed — the one command an operator needs:
//
//   npm run audit:live
//
// WHY a wrapper instead of `"audit:live": "RUN_LIVE_AUDIT=1 vitest run ..."`:
// npm executes scripts through cmd.exe on Windows, where inline `VAR=value`
// syntax is a syntax error, and cross-env is not a dependency of this repo.
// The variable is set here and inherited by the vitest child process, which
// is exactly what the audit's self-gate (const LIVE = Boolean(process.env.RUN_LIVE_AUDIT))
// reads when it decides to run instead of skip.
//
// Read-only by contract: the audit never writes to products or orders. It
// still needs .env credentials (service-role key) the same way the raw
// command does.
//
// USAGE:  npm run audit:live
//         node scripts/runLiveAudit.mjs        (same thing)

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vitest', 'run', 'tests/soldYetBuyableAudit.test.ts'], {
    stdio: 'inherit',
    env: { ...process.env, RUN_LIVE_AUDIT: '1' },
    // npx is a .cmd shim on Windows and cannot be spawned without a shell.
    shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
