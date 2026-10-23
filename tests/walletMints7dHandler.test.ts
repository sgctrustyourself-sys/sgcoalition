import { describe, it, expect } from 'vitest';
import { applyWalletMintsUpdate } from '../context/useWallets';

// ---------------------------------------------------------------------------
// applyWalletMintsUpdate — pure reducer for wallet_mints_7d realtime
// payloads. This test pins down the SLA contract for the User Experience:
// the counter increments inside a re-render whenever a valid UPDATE payload
// arrives on the wallet_mints_7d_sync channel, and never flickers to 0
// on a malformed payload transit.
// ---------------------------------------------------------------------------
describe('applyWalletMintsUpdate (pure reducer for wallet_mints_7d realtime)', () => {
    it('updates 4 → 7 on a valid UPDATE payload', () => {
        expect(applyWalletMintsUpdate(4, { new: { mint_count: 7 } })).toBe(7);
    });
    it('updates 0 → 1 on a valid UPDATE payload (initial bootstrap)', () => {
        expect(applyWalletMintsUpdate(0, { new: { mint_count: 1 } })).toBe(1);
    });
    it('updates null → 5 when first payload arrives before GET resolves', () => {
        expect(applyWalletMintsUpdate(null, { new: { mint_count: 5 } })).toBe(5);
    });
    it('accepts string mint_count (PostgREST bigint serialises as string)', () => {
        expect(applyWalletMintsUpdate(4, { new: { mint_count: '12' } })).toBe(12);
    });
    it('accepts large mint_count values without precision loss for wallet volumes', () => {
        expect(applyWalletMintsUpdate(99, { new: { mint_count: 1234 } })).toBe(1234);
    });

    describe('malformed payload → keep prev (no silent-0 flicker)', () => {
        it('null payload', () => {
            expect(applyWalletMintsUpdate(4, null)).toBe(4);
        });
        it('undefined payload', () => {
            expect(applyWalletMintsUpdate(4, undefined)).toBe(4);
        });
        it('payload without new', () => {
            expect(applyWalletMintsUpdate(4, {})).toBe(4);
        });
        it('payload with null new', () => {
            expect(applyWalletMintsUpdate(4, { new: null })).toBe(4);
        });
        it('payload with empty mint_count', () => {
            expect(applyWalletMintsUpdate(4, { new: { mint_count: '' } })).toBe(4);
        });
        it('payload with NaN mint_count', () => {
            expect(applyWalletMintsUpdate(4, { new: { mint_count: 'NaN' } })).toBe(4);
        });
        it('payload with non-numeric mint_count', () => {
            expect(applyWalletMintsUpdate(4, { new: { mint_count: 'xyz' } })).toBe(4);
        });
        it('null mint_count', () => {
            expect(applyWalletMintsUpdate(4, { new: { mint_count: null } })).toBe(4);
        });
        it('null prev + malformed payload → still null (no zero flicker)', () => {
            expect(applyWalletMintsUpdate(null, { new: { mint_count: '' } })).toBe(null);
        });
        it('null prev + bad payload → still null (no zero flicker)', () => {
            expect(applyWalletMintsUpdate(null, null)).toBe(null);
        });
    });

    it('is reference-stable shape (1 in, 1 out, no throws)', () => {
        // Defensive contract — no matter the input combination, the reducer
        // returns either a number or null. No exceptions thrown, no side effects.
        const inputs: Array<Parameters<typeof applyWalletMintsUpdate>[1]> = [
            null,
            undefined,
            {},
            { new: null },
            { new: {} },
            { new: { mint_count: null } },
            { new: { mint_count: undefined } },
            { new: { mint_count: '' } },
            { new: { mint_count: 'NaN' } },
            { new: { mint_count: '1.5' } },          // not an int but Number.isFinite — accept
            { new: { mint_count: 1.5 } },           
            { new: { mint_count: -3 } },            // not realistic but accept (it's a number that's finite)
            { new: { mint_count: 0 } },             // accept (depleted counter is honest)
            { new: { mint_count: 1 } },
            { new: { mint_count: 9999 } },
            { new: { mint_count: '9999' } },
        ];
        for (const payload of inputs) {
            const out = applyWalletMintsUpdate(5, payload);
            expect(out === null || typeof out === 'number').toBe(true);
        }
    });
});
