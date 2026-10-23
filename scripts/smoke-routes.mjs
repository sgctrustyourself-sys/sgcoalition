// scripts/smoke-routes.mjs
//
// Shell smoke test for every client route declared in App.tsx. The app is a
// single-page app on BrowserRouter, so a fresh deploy must answer each route
// with HTTP 200, text/html, and the app shell (the #root mount point from
// index.html). Without a SPA fallback the host returns its own 404 page for
// deep links such as /checkout, which is what the Netlify deploy did before
// public/_redirects / netlify.toml added the fallback.
//
// Usage:
//   SMOKE_BASE_URL=https://<deploy>.netlify.app npm run smoke:routes
//   npm run build && npm run preview -- --port 4173     # then:
//   SMOKE_BASE_URL=http://127.0.0.1:4173 npm run smoke:routes
//
// GET requests only. Dynamic segments such as /product/:id are filled with a
// placeholder, so parameterised routes are covered by the same fallback check.
// Exit codes: 0 every route returned the shell, 1 a route failed,
// 2 the target is missing or App.tsx could not be parsed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL_MARKER = '<div id="root"';
const PLACEHOLDER = 'smoke-test';
const TIMEOUT_MS = 15000;

function readRoutes() {
  const source = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  // `<Route` followed by whitespace, `/` or `>` — excludes <Routes> and
  // <RouteErrorBoundary>, which are not route declarations.
  const declared = [...source.matchAll(/<Route(?=[\s/>])/g)].length;
  const paths = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length !== declared) {
    throw new Error(
      `Parsed ${paths.length} of ${declared} <Route> declarations in App.tsx; ` +
        'a route uses an attribute order this script does not handle.',
    );
  }
  return [...new Set(paths)];
}

async function main() {
  const raw = process.env.SMOKE_BASE_URL;
  if (!raw) {
    console.error('SMOKE_BASE_URL is required, e.g. https://sgcoalition.netlify.app');
    process.exit(2);
  }
  let base;
  try {
    base = new URL(raw);
  } catch {
    console.error(`SMOKE_BASE_URL is not a valid URL: ${raw}`);
    process.exit(2);
  }
  if (!['http:', 'https:'].includes(base.protocol)) {
    console.error(`SMOKE_BASE_URL must be http(s): ${raw}`);
    process.exit(2);
  }

  let routes;
  try {
    routes = readRoutes();
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const concrete = routes.filter((route) => {
    if (route.includes('*')) {
      console.log(`skip ${route} (wildcard, not a concrete route)`);
      return false;
    }
    return true;
  });

  const failures = [];
  for (const route of concrete) {
    const url = new URL(route.replace(/:[A-Za-z]+/g, PLACEHOLDER), base.origin);
    const problems = [];
    let status = 'error';
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { accept: 'text/html' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      const body = await res.text();
      const type = res.headers.get('content-type') ?? '';
      if (res.status !== 200) problems.push(`status ${res.status}`);
      if (!type.includes('text/html')) problems.push(`content-type ${type || 'none'}`);
      if (!body.includes(SHELL_MARKER)) problems.push('app shell not found (no #root)');
    } catch (err) {
      problems.push(err.message);
    }
    const label = problems.length ? 'FAIL' : 'ok  ';
    const detail = problems.length ? ` — ${problems.join('; ')}` : '';
    console.log(`${label} ${String(status).padEnd(5)} ${route}${detail}`);
    if (problems.length) failures.push({ route, problems });
  }

  const passed = concrete.length - failures.length;
  console.log(`\n${passed}/${concrete.length} client routes returned the app shell at ${base.origin}.`);
  process.exit(failures.length ? 1 : 0);
}

main();
