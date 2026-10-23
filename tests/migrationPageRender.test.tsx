// tests/migrationPageRender.test.tsx
//
// Render flow for pages/MigrationPage.tsx - the console the visitor actually
// drives.
//
// The point of these tests is the sequence that used to be wrong: the old
// page approved MaxUint256 (an unlimited allowance that stayed open), previewed
// the payout through a float, and let you type more than your balance. Here
// the page is mounted with a wallet on Polygon and the console is driven:
//
//   - the balance and the quote are integer-exact
//   - an amount above the balance is refused before any transaction
//   - the CTA is "Approve <exact amount>" when the allowance does not cover
//     it, and "Migrate to SGCOIN V2" when it does
//   - the percent chips move the amount to an exact fraction of the balance
//
// Network calls are stubbed; the maths under test is the real thing.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

// React 19 only treats act() as a real act when the environment says so.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const V1_UNIT = 1_000_000_000n;
const V2_UNIT = 1_000_000_000_000_000_000n;
const WALLET = '0x1111111111111111111111111111111111111111';
const BALANCE = 1_000_000n * V1_UNIT; // 1,000,000 V1

let allowance = 0n;

vi.mock('../context/AppContext', () => ({
    useApp: () => ({
        user: { walletAddress: WALLET, connectedWalletAddress: WALLET },
        loginUser: vi.fn(),
        chainId: 137,
        switchToPolygon: vi.fn(),
        refreshBalances: vi.fn(),
    }),
}));

vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../services/priceService', () => ({
    fetchSGCoinV2Price: vi.fn(async () => null),
}));

vi.mock('../services/sgcoinMigration', async () => {
    const actual = await vi.importActual<typeof import('../services/sgcoinMigration')>('../services/sgcoinMigration');
    return {
        ...actual,
        createReadProvider: vi.fn(async () => ({})),
        getWalletProvider: vi.fn(async () => ({})),
        getV1BalanceRaw: vi.fn(async () => BALANCE),
        getV2BalanceRaw: vi.fn(async () => 500n * V2_UNIT),
        getMigrationAllowance: vi.fn(async () => allowance),
        getMigratedSupply: vi.fn(async () => 823n * V1_UNIT),
        fetchMigrationEvents: vi.fn(async (options?: { user?: string }) => {
            if (options?.user) return [];
            // Two wallets, three events: the member counter must not be 3.
            return [
                {
                    txHash: '0xaaa',
                    blockNumber: 3,
                    timestamp: null,
                    user: '0xAAAA1111111111111111111111111111111111111',
                    v1Raw: 1_000_000n * V1_UNIT,
                    v2Raw: V2_UNIT,
                    tier: 'Standard',
                },
                {
                    txHash: '0xbbb',
                    blockNumber: 2,
                    timestamp: null,
                    user: '0xaaaa1111111111111111111111111111111111111',
                    v1Raw: 1_000_000n * V1_UNIT,
                    v2Raw: V2_UNIT,
                    tier: 'Standard',
                },
                {
                    txHash: '0xccc',
                    blockNumber: 1,
                    timestamp: null,
                    user: '0xBBBB2222222222222222222222222222222222222',
                    v1Raw: 1_000_000n * V1_UNIT,
                    v2Raw: V2_UNIT,
                    tier: 'Standard',
                },
            ];
        }),
        estimateMigrationGas: vi.fn(async () => null),
    };
});

import MigrationPage from '../pages/MigrationPage';

const setInputValue = (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

const findButton = (root: HTMLElement, pattern: RegExp): HTMLButtonElement | null => {
    const buttons = Array.from(root.querySelectorAll('button'));
    return buttons.find((button) => pattern.test(button.textContent || '')) || null;
};

describe('migration console render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(async () => {
        allowance = 0n;
        // The page checks for a wallet extension before it shows the console.
        (window as any).ethereum = {
            request: vi.fn(async () => '0x89'),
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        await act(async () => {
            root.render(
                createElement(MemoryRouter, null, createElement(MigrationPage))
            );
        });
        // let the balance effect settle
        await act(async () => { await Promise.resolve(); });
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        delete (window as any).ethereum;
        vi.restoreAllMocks();
    });

    const amountInput = () => container.querySelector('#migration-amount') as HTMLInputElement;

    it('shows the wallet V1 balance and the flat ratio', () => {
        expect(container.textContent).toContain('1,000,000');
        expect(container.textContent).toContain('1,000,000:1');
    });

    it('quotes the V2 payout with integer maths', async () => {
        const input = amountInput();
        await act(async () => { setInputValue(input, '1000000'); });

        // 1,000,000 V1 at 1,000,000:1 is exactly 1 V2.
        const quote = container.querySelector('[data-testid="migration-quote"]');
        expect(quote?.textContent?.trim()).toBe('1');
    });

    it('refuses an amount larger than the balance', async () => {
        const input = amountInput();
        await act(async () => { setInputValue(input, '2000000'); });

        expect(container.textContent).toContain('more than the 1,000,000 V1 in this wallet');

        const cta = findButton(container, /approve|migrate/i);
        expect(cta?.disabled).toBe(true);
    });

    it('asks for an exact-amount approval when the allowance does not cover it', async () => {
        const input = amountInput();
        await act(async () => { setInputValue(input, '250000'); });

        const approve = findButton(container, /approve/i);
        expect(approve).not.toBeNull();
        expect(approve?.textContent).toContain('250,000');
        expect(approve?.textContent?.toLowerCase()).not.toContain('unlimited');
    });

    it('switches to the migrate action once the allowance covers the amount', async () => {
        allowance = 1_000_000n * V1_UNIT;
        // Refresh the balances so the new allowance is read.
        const refresh = container.querySelector('[aria-label="Refresh balances"]') as HTMLButtonElement;
        expect(refresh).not.toBeNull();
        await act(async () => { refresh.click(); });
        await act(async () => { await Promise.resolve(); });

        const input = amountInput();
        await act(async () => { setInputValue(input, '250000'); });
        await act(async () => { await Promise.resolve(); });

        const migrate = findButton(container, /migrate to sgcoin v2/i);
        expect(migrate).not.toBeNull();
        expect(findButton(container, /^approve/i)).toBeNull();
    });

    it('moves the amount to an exact fraction of the balance with the chips', async () => {
        const fifty = findButton(container, /^50%$/);
        expect(fifty).not.toBeNull();

        await act(async () => { fifty!.click(); });

        expect(amountInput().value).toBe('500000');
    });

    it('never shows an unlimited approval', () => {
        expect(container.textContent?.toLowerCase()).not.toContain('permanent approval');
        expect(container.textContent?.toLowerCase()).not.toContain('infinite');
    });

    it('counts members, not events, against the milestone', async () => {
        await act(async () => { await Promise.resolve(); });

        // Three events from two wallets: the milestone counter is 2 of 100.
        // The label is uppercased by CSS, not by the markup, so match the DOM
        // text case-insensitively.
        expect(container.textContent).toContain('2 / 100');
        expect(container.textContent?.toLowerCase()).toContain('milestone — 100 members migrated');
    });
});
