import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routerPath = path.resolve(process.cwd(), 'api/[...slug].ts');
const routerSource = fs.readFileSync(routerPath, 'utf-8');

const marketingRoutes = [
    'marketing-subscribe',
    'marketing-optout',
    'marketing-send',
    'marketing-stats',
] as const;

// Convert a kebab-case route name to its expected static-import identifier
// (e.g. `marketing-subscribe` -> `marketingSubscribe`). Mirrors the camelCase
// naming convention in `api/[...slug].ts`'s static-imports block.
const camelize = (route: string): string =>
    route.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());

describe('api catch-all router', () => {
    it.each(marketingRoutes)('registers /api/%s', (route) => {
        // Accept either the legacy dynamic-import shape (`() => import(...)`)
        // or the modern static-import shape (`marketingSubscribe` etc.). The
        // static shape is what Vercel's serverless bundler needs so that all
        // 19 handlers land in the same Lambda bundle and route handlers don't
        // crash at module-init on cold start (see api/[...slug].ts header
        // comment for the full history).
        const camelRoute = camelize(route);
        const handlerImportPath = `./_handlers/${route}`;
        const pattern = new RegExp(
            // eslint-disable-next-line no-useless-escape
            `'${route}'\\s*:\\s*(?:\\b${camelRoute}\\b|\\(\\)\\s*=>\\s*import\\(['"]${handlerImportPath}['"]\\))`,
        );
        expect(routerSource).toMatch(pattern);
    });
});
