/**
 * ── Deploy-tree content guard ──────────────────────────────────────────────
 *
 * The deploy root is built from two sources: Vite's generated bundle and the
 * contents of `public/`. Repository source, notes, tests, scripts, docs, and
 * environment files must never end up there. A wrong public directory, a copied
 * tree, or a future build step can put them in `dist` while the build still
 * exits green, so this guard inspects the actual output tree.
 *
 * The guard is installed as a Vite `closeBundle` hook, not only as an npm
 * lifecycle hook. Vite loads its config for every `vite build`, including a
 * platform build command that skips npm lifecycle hooks, so `npx vite build`
 * cannot route around the check. The full `npm run build` invokes the same
 * assertion once more from postbuild, after SEO route pages are written.
 *
 * The rule is intentionally narrow:
 *   - explicit repository-only directories and dotenv files are rejected at any
 *     depth;
 *   - top-level entries supplied by `public/` or Vite are allowed, even when a
 *     source directory has the same name;
 *   - any other top-level entry that also exists at the repository root is
 *     rejected;
 *   - everything else is generated output, including postbuild route pages such
 *     as `dist/about/index.html`, and is allowed.
 *
 * That last point matters: the SEO postbuild runs after Vite, so its route
 * directories are not in `public/` and are not repository entries. A root
 * allowlist would reject them; this rule does not.
 */

import fs from 'node:fs';
import path from 'node:path';

/** The plugin's name, and the handle the wiring test looks for in the built config. */
export const PLUGIN_NAME = 'deploy-tree-guard';

/** Vite's own top-level outputs that do not come from public/. */
const ALLOWED_ROOT_ENTRIES = new Set(['assets', 'index.html', 'gate-verdict.json']);

/**
 * Repository/control directories that are never deployable at any depth.
 * Keep this list about repository ownership, not about generic public asset
 * names: `public/data/` and similar directories are valid public content and
 * must not be rejected just because a source tree may use a broad name.
 */
const FORBIDDEN_SEGMENTS = new Set([
  '.agent',
  '.claude',
  '.codex',
  '.freebuff',
  '.git',
  '.github',
  '.githooks',
  '.idea',
  '.netlify',
  '.vercel',
  '.vscode',
  '__tests__',
  'bundle-analysis',
  'coverage',
  'docs',
  'node_modules',
  'playwright-report',
  'scripts',
  'src',
  'test-results',
  'tests',
  'test',
]);

const toDeployPath = (relative) => relative.split(path.sep).join('/');
const isEnvFile = (name) => /^\.env(?:$|\.)/i.test(name);

/**
 * Find every path in `outDir` that is repository-only content.
 *
 * @param {{ outDir: string, publicDir?: string, projectRoot?: string }} options
 * @returns {Array<{ path: string, reason: string }>}
 */
export function findDeployTreeOffenders({ outDir, publicDir = '', projectRoot = process.cwd() }) {
  if (!outDir || !fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
    return [{ path: outDir || '(missing outDir)', reason: 'output directory does not exist' }];
  }

  const publicRoot = publicDir && fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory()
    ? publicDir
    : '';
  const publicTopLevel = new Set(
    publicRoot
      ? fs.readdirSync(publicRoot).map((name) => name.toLowerCase())
      : [],
  );
  const repositoryTopLevel = fs.existsSync(projectRoot) && fs.statSync(projectRoot).isDirectory()
    ? new Set(fs.readdirSync(projectRoot).map((name) => name.toLowerCase()))
    : new Set();

  const offenders = new Map();
  const add = (relative, reason) => {
    if (!offenders.has(relative)) offenders.set(relative, reason);
  };

  const inspect = (absolute, relative) => {
    const entry = fs.lstatSync(absolute);
    const name = path.basename(relative);

    if (isEnvFile(name)) {
      add(relative, 'dotenv file');
      return;
    }

    if (entry.isSymbolicLink()) {
      add(relative, 'symbolic link');
      return;
    }

    if (FORBIDDEN_SEGMENTS.has(name.toLowerCase())) {
      add(relative, `repository directory "${name}"`);
      return;
    }

    if (entry.isDirectory()) {
      for (const child of fs.readdirSync(absolute)) {
        inspect(path.join(absolute, child), `${relative}/${child}`);
      }
    }
  };

  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    const relative = toDeployPath(entry.name);
    const lowerName = entry.name.toLowerCase();

    if (
      isEnvFile(entry.name)
      || entry.isSymbolicLink()
      || FORBIDDEN_SEGMENTS.has(lowerName)
    ) {
      inspect(path.join(outDir, entry.name), relative);
      continue;
    }

    if (ALLOWED_ROOT_ENTRIES.has(lowerName)) {
      inspect(path.join(outDir, entry.name), relative);
      continue;
    }

    // public/ may legitimately use a name that also exists at the repository
    // root (for example, public/pages/). Vite copied it here intentionally.
    if (publicTopLevel.has(lowerName)) {
      inspect(path.join(outDir, entry.name), relative);
      continue;
    }

    // A repository entry that was not supplied by public/ was copied into the
    // deploy tree and is not deployable. Vite's own outputs above are exempt
    // because they necessarily share names with repository files.
    if (repositoryTopLevel.has(lowerName)) {
      add(relative, 'repository root entry');
      continue;
    }

    // A generated postbuild route is allowed. It is not a repository entry,
    // and the recursive check below still rejects forbidden descendants.
    inspect(path.join(outDir, entry.name), relative);
  }

  return [...offenders].map(([relative, reason]) => ({ path: relative, reason }));
}

/**
 * Throw when the deploy tree contains repository-only content.
 *
 * @param {{ outDir: string, publicDir?: string, projectRoot?: string }} options
 */
export function assertDeployTree({ outDir, publicDir = '', projectRoot = process.cwd() }) {
  const offenders = findDeployTreeOffenders({ outDir, publicDir, projectRoot });
  if (offenders.length === 0) return;

  throw new Error(
    `deploy-tree-guard: refusing to publish repository-only content from ${outDir}:\n` +
      offenders.map(({ path: relative, reason }) => `  ${relative} (${reason})`).join('\n') +
      '\nOnly public/ assets and generated build output may be in the deploy tree.',
  );
}

/**
 * The guard, as a Vite plugin. `closeBundle` runs after Vite has copied
 * public/ and written the bundle, so it checks the actual deploy tree.
 *
 * @returns {import('vite').Plugin}
 */
export function deployTreeGuard() {
  let outDir = '';
  let publicDir = '';
  let projectRoot = '';

  return {
    name: PLUGIN_NAME,
    apply: 'build',
    configResolved(config) {
      projectRoot = path.resolve(config.root);
      outDir = path.resolve(projectRoot, config.build.outDir);
      publicDir = config.publicDir ? path.resolve(projectRoot, config.publicDir) : '';
    },
    closeBundle() {
      assertDeployTree({ outDir, publicDir, projectRoot });
    },
  };
}
