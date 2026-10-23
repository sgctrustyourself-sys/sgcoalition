// @vitest-environment node
//
// The post-deploy check is the only thing that looks at the *live* deployment, so
// it is driven here against a real HTTP origin rather than a mocked fetch. What is
// pinned is the whole contract: what it fetches, what it refuses, and the exit code
// a workflow reacts to. Every case below is a way a deployment can be wrong while
// its build was right — which is exactly the class the check exists for, and the
// class no other check can see.
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(projectRoot, 'scripts/verify-gate-verdict.mjs');

const COMMIT = '98beb4be1af9c90bb316031a0d7df9cd55b5a2d2';
const OTHER_COMMIT = '2ef19b6f6884cc845fca4231df4c04c6aaffcb25';

const record = (overrides: Record<string, unknown> = {}) => ({
    rule: 'bare-checkout',
    ruleScript: 'scripts/bareCheckoutGuard.mjs',
    mode: 'release',
    verdict: 'passed',
    ranAt: '2026-09-19T05:54:27.826Z',
    environment: 'production',
    commit: COMMIT,
    suite: { files: { passed: 68, failed: 0 }, tests: { passed: 941, failed: 0 } },
    ...overrides,
});

let server: Server;
let origin = '';
let served = { status: 200, body: JSON.stringify(record()) };

beforeAll(async () => {
    server = createServer((_request, response) => {
        response.writeHead(served.status, { 'content-type': 'application/json' });
        response.end(served.body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

/**
 * Deliberately async, not `spawnSync`: this process is the origin the checker
 * fetches from, and a synchronous spawn blocks the event loop that has to answer
 * it — the child then waits forever on a server that cannot run, and the test
 * hangs instead of failing. A deadlock that looks like a slow test is worth
 * spelling out, since the obvious way to write this is the broken one.
 */
const runCheck = (env: Record<string, string> = {}, cwd = projectRoot) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
        const child = spawn(process.execPath, [checker], {
            cwd,
            env: {
                ...process.env,
                TEST_URL: origin,
                EXPECTED_COMMIT: COMMIT,
                EXPECTED_ENVIRONMENT: '',
                ...env,
            },
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('close', (status) => resolve({ status, stdout, stderr }));
    });

describe('post-deploy gate verdict', () => {
    it("passes on a passed verdict for the deployment's own commit", async () => {
        served = { status: 200, body: JSON.stringify(record()) };
        const result = await runCheck();

        expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
        expect(result.stdout).toContain('Gate-verdict check PASSED');
        expect(result.stdout, 'the pass output should carry the evidence it verified').toContain('941');
    });

    it('refuses a skipped verdict: off Vercel is not a release', async () => {
        served = {
            status: 200,
            body: JSON.stringify(record({ verdict: 'skipped', environment: 'local' })),
        };
        const result = await runCheck();

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('"skipped", not "passed"');
        expect(result.stderr).toContain('local build');
    });

    it("refuses a verdict for a different commit than the deployment's", async () => {
        served = { status: 200, body: JSON.stringify(record({ commit: OTHER_COMMIT })) };
        const result = await runCheck();

        expect(result.status).toBe(1);
        expect(result.stderr, 'the failure should name both commits').toContain(OTHER_COMMIT);
        expect(result.stderr).toContain(COMMIT);
        expect(result.stderr).toContain('another commit');
    });

    it('refuses a deployment that carries no verdict at all', async () => {
        served = { status: 404, body: 'Not Found' };
        const result = await runCheck();

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('no gate verdict');
        expect(result.stderr).toContain('404');
    });

    it('refuses a "passed" verdict over an empty suite', async () => {
        served = {
            status: 200,
            body: JSON.stringify(record({ suite: { files: { passed: 0, failed: 0 }, tests: { passed: 0, failed: 0 } } })),
        };
        const result = await runCheck();

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('checked nothing');
    });

    it('refuses a build from another environment answering at this origin', async () => {
        served = { status: 200, body: JSON.stringify(record({ environment: 'preview' })) };
        const result = await runCheck({ EXPECTED_ENVIRONMENT: 'production' });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('"preview", not "production"');
    });

    it('refuses to pass when it cannot tie the verdict to a commit', async () => {
        // No EXPECTED_COMMIT and no git HEAD to fall back on: a verdict nobody can
        // attribute is exactly what this check must not wave through.
        const outsideGit = mkdtempSync(path.join(tmpdir(), 'gate-verdict-'));
        served = { status: 200, body: JSON.stringify(record()) };
        try {
            const result = await runCheck({ EXPECTED_COMMIT: '' }, outsideGit);

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('no commit to compare');
        } finally {
            rmSync(outsideGit, { recursive: true, force: true });
        }
    });

    it('refuses a body that is not a verdict', async () => {
        served = { status: 200, body: '<!doctype html><html>login</html>' };
        const result = await runCheck();

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('did not return JSON');
    });
});
