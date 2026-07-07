import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const routerPath = path.resolve(process.cwd(), 'api/[...slug].ts');
const routerSource = fs.readFileSync(routerPath, 'utf-8');

describe('api catch-all router — customer profile handers', () => {
    it('registers /api/credit-customer-reward', () => {
        expect(routerSource).toContain(`'credit-customer-reward': () => import('./_handlers/credit-customer-reward')`);
    });

    it('registers /api/attribute-order-to-facebook', () => {
        expect(routerSource).toContain(`'attribute-order-to-facebook': () => import('./_handlers/attribute-order-to-facebook')`);
    });
});
