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

describe('api catch-all router', () => {
    it.each(marketingRoutes)('registers /api/%s', (route) => {
        expect(routerSource).toContain(`'${route}': () => import('./_handlers/${route}')`);
    });
});
