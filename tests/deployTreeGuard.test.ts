// @vitest-environment node
//
// The deploy tree is the actual filesystem output, not a description of it.
// These tests build a temporary repository/public/dist tree and exercise the
// same assertion and Vite closeBundle hook the production build uses.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';
import {
    PLUGIN_NAME,
    assertDeployTree,
    deployTreeGuard,
    findDeployTreeOffenders,
} from '../utils/deployTreeGuard.mjs';

let tempRoot = '';
let outDir = '';
let publicDir = '';

const write = (relative: string, content = 'fixture') => {
    const absolute = path.join(tempRoot, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
};

const offendersFor = () => findDeployTreeOffenders({
    outDir,
    publicDir,
    projectRoot: tempRoot,
});

beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coalition-deploy-tree-'));
    outDir = path.join(tempRoot, 'dist');
    publicDir = path.join(tempRoot, 'public');

    // Repository-root entries that must not be copied into the deploy tree.
    write('README.md');
    write('package.json');
    write('src/app.ts');
    write('docs/index.html');
    write('scripts/build.mjs');
    write('tests/old.test.ts');
    write('pages/index.html');

    // Public assets, including a generic public directory name that a broad
    // segment denylist used to reject unnecessarily.
    write('public/fonts/inter-latin.woff2');
    write('public/blog/post.html');
    write('public/assets/arcade/game.json');
    write('public/data/catalog.json');
    write('public/robots.txt');

    // Vite output and the public tree copied into dist.
    write('dist/index.html');
    write('dist/assets/app.js');
    write('dist/gate-verdict.json');
    write('dist/fonts/inter-latin.woff2');
    write('dist/blog/post.html');
    write('dist/assets/arcade/game.json');
    write('dist/data/catalog.json');
    write('dist/robots.txt');

    // The SEO postbuild runs after Vite and emits route directories that are
    // not in public/. These are generated output, not repository content.
    write('dist/about/index.html');
    write('dist/shop/index.html');
});

afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('deploy-tree guard', () => {
    it('accepts public assets, Vite output, and postbuild route pages', () => {
        expect(offendersFor()).toEqual([]);
        expect(() => assertDeployTree({ outDir, publicDir, projectRoot: tempRoot })).not.toThrow();
    });

    it('rejects repository directories, repository-root copies, and dotenv files', () => {
        write('dist/docs/index.html');
        write('dist/scripts/build.mjs');
        write('dist/tests/deployTreeGuard.test.ts');
        write('dist/.env');
        write('dist/assets/.env.production');
        write('dist/src/app.ts');
        write('dist/package.json');
        write('dist/README.md');
        write('dist/assets/docs/hidden.html');
        write('dist/assets/tests/hidden.js');
        write('dist/pages/index.html');
        write('public/docs/leak.html');
        write('dist/docs/leak.html');

        const paths = offendersFor().map((offender) => offender.path);

        expect(paths).toEqual(
            expect.arrayContaining([
                'docs',
                'scripts',
                'tests',
                '.env',
                'assets/.env.production',
                'src',
                'package.json',
                'README.md',
                'assets/docs',
                'assets/tests',
                'pages',
            ]),
        );
        expect(() => assertDeployTree({ outDir, publicDir, projectRoot: tempRoot })).toThrow(
            /refusing to publish repository-only content/,
        );
    });

    it('rejects forbidden content nested inside a generated postbuild page', () => {
        write('dist/about/docs/private.html');
        write('dist/about/src/app.ts');
        write('dist/about/.env.local');

        expect(offendersFor().map((offender) => offender.path)).toEqual(
            expect.arrayContaining(['about/docs', 'about/src', 'about/.env.local']),
        );
    });

    it('lets public/ provide a top-level name that also exists in the repository', () => {
        write('public/pages/index.html');
        write('dist/pages/index.html');

        expect(offendersFor()).toEqual([]);
        expect(() => assertDeployTree({ outDir, publicDir, projectRoot: tempRoot })).not.toThrow();
    });

    it('fails when the output directory is missing', () => {
        fs.rmSync(outDir, { recursive: true, force: true });

        expect(() => assertDeployTree({ outDir, publicDir, projectRoot: tempRoot })).toThrow(
            /output directory does not exist/,
        );
    });

    it('runs from the Vite closeBundle hook with the resolved paths', () => {
        write('dist/about/docs/private.html');

        const plugin = deployTreeGuard() as {
            configResolved: (config: { root: string; build: { outDir: string }; publicDir: string }) => void;
            closeBundle: () => void;
        };
        plugin.configResolved({
            root: tempRoot,
            build: { outDir: 'dist' },
            publicDir,
        });

        expect(() => plugin.closeBundle()).toThrow(/about\/docs/);
    });

    it('runs the same assertion after the SEO postbuild', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

        expect(pkg.scripts.postbuild).toContain('generateSeoArtifacts.mjs');
        expect(pkg.scripts.postbuild).toContain('checkDeployTree.mjs');
    });

    it('is installed in the build config and has a closeBundle hook', () => {
        const config = (viteConfig as unknown as (env: { command: string; mode: string }) => {
            plugins?: unknown[];
        })({ command: 'build', mode: 'production' });
        const plugins = ((config.plugins ?? []) as unknown[]).flat(Infinity) as Array<Record<string, unknown>>;
        const guard = plugins.filter((plugin) => plugin?.name === PLUGIN_NAME);

        expect(guard).toHaveLength(1);
        expect(guard[0].apply).toBe('build');
        expect(typeof guard[0].closeBundle).toBe('function');
    });
});
