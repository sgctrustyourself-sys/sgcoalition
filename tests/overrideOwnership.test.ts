// tests/overrideOwnership.test.ts
//
// Guards PRODUCT_LOCAL_OVERRIDES against dead keys — the quiet way this overlay rots.
//
// useCatalog (context/useCatalog.ts) applies an override only to a product that
// already exists, on both the Supabase path and the seed fallback path. An override
// keyed to an id that is in neither can therefore never render: no error, no blank
// spot on the page, just prose nobody reads and a comment nobody checks. Four such
// keys had accumulated (prod_wallet_004, Coalition_Kustom_Co_Wallet_1_1,
// Coalition_Denim_Patchwork_S1, Coalition_Denim_Patchwork_X_Meks) before they were
// found by audit; they are removed, and the tombstones are listed in constants.ts
// above the overlay.
//
// This test is the reason they cannot come back: every key in the overlay must
// name a product the seed knows. It keys only on INITIAL_PRODUCTS, so re-adding a
// tombstoned id fails the same way as adding a brand-new dead one — resurrecting
// one of those requires a seed entry first, which is the actual prerequisite for
// the override to mean anything.

import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS, PRODUCT_LOCAL_OVERRIDES } from '../constants';

const seedIds = new Set(INITIAL_PRODUCTS.map((p) => String(p.id)));
const overrideIds = Object.keys(PRODUCT_LOCAL_OVERRIDES);

describe('PRODUCT_LOCAL_OVERRIDES only keys products that exist', () => {
    it('has a seed entry behind every override key', () => {
        const dead = overrideIds.filter((id) => !seedIds.has(id));
        expect(
            dead,
            `these overrides can never apply — useCatalog only merges onto an existing product: ${dead.join(', ')}`,
        ).toEqual([]);
    });

    it('is actually populated, so the check above cannot pass vacuously', () => {
        // If the overlay were emptied wholesale, every archiveNote the Archive
        // page reads from it would vanish with no failing test to explain why.
        expect(overrideIds.length).toBeGreaterThan(0);
        expect(seedIds.size).toBeGreaterThan(0);
    });
});
