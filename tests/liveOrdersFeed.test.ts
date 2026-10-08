// tests/liveOrdersFeed.test.ts
//
// REGRESSION CATCH: locks the three-layer /live-orders map feed contract
// documented in README.md > Recently Ordered Live Map.
//
// Layer 1 - real orders (Supabase or INITIAL_ORDERS fallback).
// Layer 2 - PUBLIC_RECENT_ORDER_SEEDS, deduped against Layer 1 by order.id.
// Layer 3 - DEMO_TRACKED_ORDER_SEEDS, DEV-only fallback.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildLiveOrdersFeed } from '../utils/liveOrdersFeed';

const FROZEN_NOW = new Date('2026-07-16T12:00:00Z');

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('buildLiveOrdersFeed - Layer 2 seed surfacing', () => {
    describe('wholesale bundle seed (public-md-wholesale-wallets-2026_05_22)', () => {
        it('surfaces in the 90d window when no Layer 1 order matches', () => {
            const feed = buildLiveOrdersFeed([], '90d');
            const mdState = feed.states.find((s) => s.id === 'MD');
            expect(mdState).toBeDefined();
            expect(mdState!.name).toBe('Maryland');
            expect(mdState!.count).toBeGreaterThanOrEqual(1);

            const wholesaleTicker = feed.recentActivity.find(
                (item) => item.id === 'public-md-wholesale-wallets-2026_05_22',
            );
            expect(wholesaleTicker).toBeDefined();
            expect(wholesaleTicker!.text).toContain('GREEN CAMO WALLET');
            expect(wholesaleTicker!.text).toContain('+ 6 more items');
            expect(wholesaleTicker!.text).toContain('Abingdon');
            expect(wholesaleTicker!.text).toContain('Maryland');
            expect(wholesaleTicker!.productLink).toBe('/product/GreenCamoWallet');
        });

        it('surfaces in the all window', () => {
            const feed = buildLiveOrdersFeed([], 'all');
            const wholesaleTicker = feed.recentActivity.find(
                (item) => item.id === 'public-md-wholesale-wallets-2026_05_22',
            );
            expect(wholesaleTicker).toBeDefined();
            expect(feed.summary.totalOrders).toBeGreaterThanOrEqual(1);
        });

        it('does NOT surface in the 30d window (minutesAgo ~55d exceeds 30d)', () => {
            const feed = buildLiveOrdersFeed([], '30d');
            // NOTE: in DEV mode, demo seeds (demo-md-1, 12 min ago) DO fire
            // and create an MD entry, so we only assert on the wholesale
            // seed id, not on mdState being undefined.
            const wholesaleTicker = feed.recentActivity.find(
                (item) => item.id === 'public-md-wholesale-wallets-2026_05_22',
            );
            expect(wholesaleTicker).toBeUndefined();
        });

        it('does NOT surface in the 24h window', () => {
            const feed = buildLiveOrdersFeed([], '24h');
            const wholesaleTicker = feed.recentActivity.find(
                (item) => item.id === 'public-md-wholesale-wallets-2026_05_22',
            );
            expect(wholesaleTicker).toBeUndefined();
        });
    });
});

describe('buildLiveOrdersFeed - Layer 1 to Layer 2 dedup contract', () => {
    it('DROPS the Layer 2 seed when a Layer 1 order with the same id survives the window', () => {
        const layer1Order: any = {
            id: 'public-md-wholesale-wallets-2026_05_22',
            createdAt: new Date(FROZEN_NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'MD', city: 'Baltimore' },
            items: [
                {
                    productId: 'layer1-only-product',
                    productName: 'LAYER 1 OVERRIDE PRODUCT',
                    productImage: 'https://example.com/layer1.jpg',
                    selectedSize: 'One Size',
                    quantity: 1,
                    price: 100,
                    total: 100,
                },
            ],
        };

        const feed = buildLiveOrdersFeed([layer1Order], '90d');
        const matchingTicker = feed.recentActivity.filter(
            (item) => item.id === 'public-md-wholesale-wallets-2026_05_22',
        );
        expect(matchingTicker).toHaveLength(1);
        expect(matchingTicker[0]!.text).toContain('LAYER 1 OVERRIDE PRODUCT');
        expect(matchingTicker[0]!.text).not.toContain('GREEN CAMO WALLET');
        expect(matchingTicker[0]!.text).toContain('Baltimore');

        // MD has the Layer 1 order (1) + the hat seed (84d, in 90d) = 2.
        // The wholesale seed is dropped by dedup; the denim patchwork seed
        // (601d) is outside the 90d window.
        const mdState = feed.states.find((s) => s.id === 'MD');
        expect(mdState).toBeDefined();
        expect(mdState!.count).toBe(2);
    });

    it('keeps both when Layer 1 and Layer 2 have DIFFERENT ids', () => {
        const layer1Order: any = {
            id: 'a-completely-different-order-id',
            createdAt: new Date(FROZEN_NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'NY', city: 'Brooklyn' },
            items: [
                {
                    productId: 'some-product',
                    productName: 'Some Product',
                    productImage: 'https://example.com/some.jpg',
                    selectedSize: 'One Size',
                    quantity: 1,
                    price: 50,
                    total: 50,
                },
            ],
        };

        const feed = buildLiveOrdersFeed([layer1Order], '90d');
        const nyState = feed.states.find((s) => s.id === 'NY');
        const mdState = feed.states.find((s) => s.id === 'MD');
        expect(nyState).toBeDefined();
        expect(mdState).toBeDefined();
        // 1 Layer 1 (NY) + 4 Layer 2 seeds in 90d (Grey Wave 2/2 PA,
        // Grey Wave 1/2 PA, wholesale MD, hat MD) = 5.
        expect(feed.summary.totalOrders).toBe(5);
    });
});

describe('buildLiveOrdersFeed - all 6 seeds in the all window', () => {
    it('surfaces all 6 seeds in the all window with correct states', () => {
        const feed = buildLiveOrdersFeed([], 'all');

        // PA: Grey Wave 2/2 + Grey Wave 1/2 = 2
        const paState = feed.states.find((s) => s.id === 'PA');
        expect(paState).toBeDefined();
        expect(paState!.count).toBe(2);

        // MD: wholesale + hat + denim patchwork = 3
        const mdState = feed.states.find((s) => s.id === 'MD');
        expect(mdState).toBeDefined();
        expect(mdState!.count).toBe(3);

        // NY: True Religion S1 = 1
        const nyState = feed.states.find((s) => s.id === 'NY');
        expect(nyState).toBeDefined();
        expect(nyState!.count).toBe(1);

        // Total = 6
        expect(feed.summary.totalOrders).toBe(6);
    });

    it('Grey Wave 2/2 surfaces in 24h (12 min ago)', () => {
        const feed = buildLiveOrdersFeed([], '24h');
        const ticker = feed.recentActivity.find(
            (item) => item.id === 'public-pa-grey-wave-wallet-2-2',
        );
        expect(ticker).toBeDefined();
        expect(ticker!.text).toContain('York');
        expect(ticker!.text).toContain('Pennsylvania');
        expect(ticker!.productLink).toBe('/product/Coalition_Grey_Wave_Wallet_2_2');
    });

    it('Grey Wave 1/2 does NOT surface in 24h (7d ago) but DOES in 7d', () => {
        const feed24h = buildLiveOrdersFeed([], '24h');
        const ticker24h = feed24h.recentActivity.find(
            (item) => item.id === 'public-pa-grey-wave-wallet-1-2',
        );
        expect(ticker24h).toBeUndefined();

        const feed7d = buildLiveOrdersFeed([], '7d');
        const ticker7d = feed7d.recentActivity.find(
            (item) => item.id === 'public-pa-grey-wave-wallet-1-2',
        );
        expect(ticker7d).toBeDefined();
    });

    it('hat seed does NOT surface in 30d (84d ago) but DOES in 90d', () => {
        const feed30d = buildLiveOrdersFeed([], '30d');
        const ticker30d = feed30d.recentActivity.find(
            (item) => item.id === 'public-md-trust-yourself-hat-01',
        );
        expect(ticker30d).toBeUndefined();

        const feed90d = buildLiveOrdersFeed([], '90d');
        const ticker90d = feed90d.recentActivity.find(
            (item) => item.id === 'public-md-trust-yourself-hat-01',
        );
        expect(ticker90d).toBeDefined();
    });

    it('denim patchwork and True Religion S1 surface ONLY in the all window', () => {
        const feed90d = buildLiveOrdersFeed([], '90d');
        expect(feed90d.recentActivity.find((i) => i.id === 'public-md-denim-patchwork-2024_11_08')).toBeUndefined();
        expect(feed90d.recentActivity.find((i) => i.id === 'public-ny-true-religion-s1')).toBeUndefined();

        const feedAll = buildLiveOrdersFeed([], 'all');
        expect(feedAll.recentActivity.find((i) => i.id === 'public-md-denim-patchwork-2024_11_08')).toBeDefined();
        expect(feedAll.recentActivity.find((i) => i.id === 'public-ny-true-religion-s1')).toBeDefined();
    });
});

describe('buildLiveOrdersFeed - Layer 1 filtering', () => {
    it('drops orders with excluded statuses (cancelled, failed, refunded)', () => {
        const cancelledOrder: any = {
            id: 'cancelled-1',
            createdAt: new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString(),
            paymentStatus: 'cancelled',
            shippingAddress: { state: 'CA' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };
        const failedOrder: any = {
            id: 'failed-1',
            createdAt: new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString(),
            paymentStatus: 'failed',
            shippingAddress: { state: 'TX' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };
        const refundedOrder: any = {
            id: 'refunded-1',
            createdAt: new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString(),
            paymentStatus: 'refunded',
            shippingAddress: { state: 'FL' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([cancelledOrder, failedOrder, refundedOrder], '24h');
        const excludedIds = feed.recentActivity.filter(
            (item) => ['cancelled-1', 'failed-1', 'refunded-1'].includes(item.id),
        );
        expect(excludedIds).toHaveLength(0);
    });

    it('drops orders with no resolvable US state code', () => {
        const noStateOrder: any = {
            id: 'no-state-1',
            createdAt: new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };
        const garbageStateOrder: any = {
            id: 'garbage-state-1',
            createdAt: new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'Atlantis' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([noStateOrder, garbageStateOrder], '24h');
        const droppedIds = feed.recentActivity.filter(
            (item) => ['no-state-1', 'garbage-state-1'].includes(item.id),
        );
        expect(droppedIds).toHaveLength(0);
    });

    it('drops orders with an unparseable createdAt', () => {
        const badDateOrder: any = {
            id: 'bad-date-1',
            createdAt: 'not-a-date',
            paymentStatus: 'paid',
            shippingAddress: { state: 'CA' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([badDateOrder], '24h');
        const dropped = feed.recentActivity.filter((item) => item.id === 'bad-date-1');
        expect(dropped).toHaveLength(0);
    });

    it('accepts a full state NAME (not just the 2-letter code)', () => {
        const fullNameOrder: any = {
            id: 'full-name-1',
            createdAt: new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'California' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([fullNameOrder], '24h');
        const caState = feed.states.find((s) => s.id === 'CA');
        expect(caState).toBeDefined();
        expect(caState!.name).toBe('California');
    });
});

describe('buildLiveOrdersFeed - empty / edge input', () => {
    it('does not throw on an empty orders array in the 90d window', () => {
        expect(() => buildLiveOrdersFeed([], '90d')).not.toThrow();
        const feed = buildLiveOrdersFeed([], '90d');
        expect(feed.states.length).toBeGreaterThanOrEqual(1);
        expect(feed.summary.totalOrders).toBeGreaterThanOrEqual(1);
    });

    it('returns a well-formed feed object even when no orders survive', () => {
        const feed = buildLiveOrdersFeed([], '24h');
        expect(feed).toHaveProperty('states');
        expect(feed).toHaveProperty('recentActivity');
        expect(feed).toHaveProperty('summary');
        expect(Array.isArray(feed.states)).toBe(true);
        expect(Array.isArray(feed.recentActivity)).toBe(true);
        expect(feed.summary).toHaveProperty('totalOrders');
        expect(feed.summary).toHaveProperty('activeStates');
    });
});

describe('buildLiveOrdersFeed - window boundaries', () => {
    it('includes a Layer 1 order exactly at the window edge (24h)', () => {
        const order: any = {
            id: 'edge-23h',
            createdAt: new Date(FROZEN_NOW.getTime() - 23 * 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'WA' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([order], '24h');
        const waState = feed.states.find((s) => s.id === 'WA');
        expect(waState).toBeDefined();
    });

    it('excludes a Layer 1 order just outside the 24h window', () => {
        const order: any = {
            id: 'edge-25h',
            createdAt: new Date(FROZEN_NOW.getTime() - 25 * 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'OR' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([order], '24h');
        const orState = feed.states.find((s) => s.id === 'OR');
        expect(orState).toBeUndefined();
    });
});

describe('buildLiveOrdersFeed - ticker product links', () => {
    it('includes a productLink pointing to /product/<productId> for the first item', () => {
        const order: any = {
            id: 'link-test-1',
            createdAt: new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'GA' },
            items: [
                {
                    productId: 'prod_link_test',
                    productName: 'Link Test Product',
                    productImage: 'https://example.com/test.jpg',
                    selectedSize: 'M',
                    quantity: 1,
                    price: 30,
                    total: 30,
                },
            ],
        };

        const feed = buildLiveOrdersFeed([order], '24h');
        const ticker = feed.recentActivity.find((item) => item.id === 'link-test-1');
        expect(ticker).toBeDefined();
        expect(ticker!.productLink).toBe('/product/prod_link_test');
    });

    it('includes a productLink on the wholesale seed ticker entry', () => {
        const feed = buildLiveOrdersFeed([], '90d');
        const wholesaleTicker = feed.recentActivity.find(
            (item) => item.id === 'public-md-wholesale-wallets-2026_05_22',
        );
        expect(wholesaleTicker).toBeDefined();
        expect(wholesaleTicker!.productLink).toBe('/product/GreenCamoWallet');
    });
});

describe('buildLiveOrdersFeed - tiered formatRelativeTime', () => {
    // The README documents four tiers above 24h so the "All time" view
    // doesn't print "847d ago" for a 121-week sale. Each tier is pinned
    // here so a future refactor can't silently revert to flat "Xd ago".
    //
    //   <7d   -> 'Xd ago'
    //   <30d  -> 'Xw ago'
    //   <365d -> 'Xmo ago'
    //   >=365d-> 'Xy ago'

    it('renders "Xd ago" for a 3-day-old order', () => {
        const order: any = {
            id: 'tier-3d',
            createdAt: new Date(FROZEN_NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'NV' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([order], '30d');
        const ticker = feed.recentActivity.find((i) => i.id === 'tier-3d');
        expect(ticker).toBeDefined();
        expect(ticker!.time).toMatch(/^3d ago$/);
    });

    it('renders "Xw ago" for a 14-day-old order', () => {
        const order: any = {
            id: 'tier-14d',
            createdAt: new Date(FROZEN_NOW.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            paymentStatus: 'paid',
            shippingAddress: { state: 'AZ' },
            items: [{ productId: 'p', productName: 'P', quantity: 1, price: 10, total: 10 }],
        };

        const feed = buildLiveOrdersFeed([order], '90d');
        const ticker = feed.recentActivity.find((i) => i.id === 'tier-14d');
        expect(ticker).toBeDefined();
        expect(ticker!.time).toMatch(/^2w ago$/);
    });

    it('renders "Xmo ago" for a 90-day-old order', () => {
        // 90 days = ~3 months. Use a seed so we don't need a Layer 1 order.
        // The wholesale seed is ~40d (renders as '5w ago'), the hat seed is
        // ~84d (renders as '2mo ago'). Use the hat seed to pin the month tier.
        const feed = buildLiveOrdersFeed([], '90d');
        const hatTicker = feed.recentActivity.find(
            (i) => i.id === 'public-md-trust-yourself-hat-01',
        );
        expect(hatTicker).toBeDefined();
        // 84 days = 12 weeks but the month tier (days < 365) takes over
        // at days >= 30, so 84d -> floor(84/30) = 2mo.
        expect(hatTicker!.time).toMatch(/^2mo ago$/);
    });

    it('renders "Xy ago" for the 121-week True Religion seed in the all window', () => {
        const feed = buildLiveOrdersFeed([], 'all');
        const trTicker = feed.recentActivity.find(
            (i) => i.id === 'public-ny-true-religion-s1',
        );
        expect(trTicker).toBeDefined();
        // 1,219,680 minutes = 847 days = ~2.32 years -> floor(847/365) = 2y.
        expect(trTicker!.time).toMatch(/^2y ago$/);
    });

    it('renders "Xy ago" for the 601-day Denim Patchwork seed in the all window', () => {
        const feed = buildLiveOrdersFeed([], 'all');
        const dpTicker = feed.recentActivity.find(
            (i) => i.id === 'public-md-denim-patchwork-2024_11_08',
        );
        expect(dpTicker).toBeDefined();
        // 865,440 minutes = 601 days = ~1.65 years -> floor(601/365) = 1y.
        expect(dpTicker!.time).toMatch(/^1y ago$/);
    });
});
