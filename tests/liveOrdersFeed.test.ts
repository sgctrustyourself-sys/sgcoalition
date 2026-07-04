import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLiveOrdersFeed } from '../utils/liveOrdersFeed';

afterEach(() => {
    vi.useRealTimers();
});

describe('buildLiveOrdersFeed public recent order seeds', () => {
    it('shows both Grey Wave wallet York, PA sales in the 7d window with product links', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T14:12:00.000Z'));

        const feed = buildLiveOrdersFeed([], '7d');

        expect(feed.recentActivity.map(item => item.text)).toEqual([
            "Coalition 'Grey Wave' Wallet 2/2 ordered in York, PA",
            "Coalition 'Grey Wave' Wallet 1/2 ordered in York, PA",
        ]);
        expect(feed.recentActivity.map(item => item.productUrl)).toEqual([
            '/product/Coalition_Grey_Wave_Wallet_2_2',
            '/product/Coalition_Grey_Wave_Wallet_1_2',
        ]);
        expect(feed.states).toEqual([
            {
                id: 'PA',
                name: 'Pennsylvania',
                count: 2,
                lastActive: '12m ago',
            },
        ]);
    });

    it('only shows the newest Grey Wave wallet sale in the 24h window', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T14:12:00.000Z'));

        const feed = buildLiveOrdersFeed([], '24h');

        expect(feed.recentActivity.map(item => item.text)).toEqual([
            "Coalition 'Grey Wave' Wallet 2/2 ordered in York, PA",
        ]);
    });

    it('keeps the pre-7d seeds (S1 NY + hat MD) out of the 24h and 7d windows', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T14:12:00.000Z'));

        const feed24h = buildLiveOrdersFeed([], '24h');
        const feed7d = buildLiveOrdersFeed([], '7d');

        for (const feed of [feed24h, feed7d]) {
            // Coalition_x_True_Religion_S1 public seed is 121w ago -
            // both windows filter it out (and so does 30d / 90d, so
            // it only surfaces under the "all" range).
            expect(feed.recentActivity.some(item => item.text.startsWith('Coalition x True Religion'))).toBe(false);
            expect(feed.states.some(state => state.id === 'NY')).toBe(false);
            // prod_trust_yourself_hat_01 public seed is 84d ago -
            // both windows filter it out too.
            expect(feed.recentActivity.some(item => item.text.startsWith('TRUST YOURSELF CUSTOM TRUCKER'))).toBe(false);
            expect(feed.states.some(state => state.id === 'MD')).toBe(false);
        }
    });

    it('keeps the True Religion S1 NY seed out of the 30d window (121w ago is outside)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T14:12:00.000Z'));

        const feed = buildLiveOrdersFeed([], '30d');

        // 121 weeks ago is well past the 30d cutoff - the True
        // Religion S1 seed is the oldest public sale, so it only
        // surfaces under the "all" range. The Grey Wave wallets
        // (12m + 7d) fill the 30d ticker; the Trust Yourself hat
        // (84d) also drops out at 30d.
        expect(feed.recentActivity.map(item => item.text)).toEqual([
            "Coalition 'Grey Wave' Wallet 2/2 ordered in York, PA",
            "Coalition 'Grey Wave' Wallet 1/2 ordered in York, PA",
        ]);
        expect(feed.states).toEqual([
            {
                id: 'PA',
                name: 'Pennsylvania',
                count: 2,
                lastActive: '12m ago',
            },
        ]);
    });

    it('shows the friiqy wholesale bundle (1st wallet + 6 more) plus the other within-window seeds under the 90d window', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T14:12:00.000Z'));

        const feed = buildLiveOrdersFeed([], '90d');

        // The wholesale seed sits at 40d, which lands it in the
        // 90d window. The ticker renders the first wallet
        // (GreenCamoWallet) + "6 more items" via the existing
        // buildLiveOrdersFeed "+ N more" helper. Sort order is
        // timestamp descending: Grey Wave 2/2 (12m), Grey Wave 1/2
        // (7d), wholesale (40d), hat (84d). The True Religion S1
        // (121w) is still out of 90d.
        expect(feed.recentActivity.map(item => item.text)).toEqual([
            "Coalition 'Grey Wave' Wallet 2/2 ordered in York, PA",
            "Coalition 'Grey Wave' Wallet 1/2 ordered in York, PA",
            "COALITION GREEN CAMO WALLET + 6 more items ordered in Abingdon, MD",
            "TRUST YOURSELF CUSTOM TRUCKER (1/1) ordered in Owings Mills, MD",
        ]);
        expect(feed.recentActivity.map(item => item.productUrl)).toEqual([
            '/product/Coalition_Grey_Wave_Wallet_2_2',
            '/product/Coalition_Grey_Wave_Wallet_1_2',
            '/product/GreenCamoWallet',
            '/product/prod_trust_yourself_hat_01',
        ]);
        // MD and PA both have count 2 (wholesale + hat, and
        // Grey Wave 1/2 + 2/2), so the alphabetical tiebreak
        // surfaces Maryland first. MD's lastActive is the
        // wholesale (40d = 1mo ago), not the older hat.
        expect(feed.states).toEqual([
            { id: 'MD', name: 'Maryland', count: 2, lastActive: '1mo ago' },
            { id: 'PA', name: 'Pennsylvania', count: 2, lastActive: '12m ago' },
        ]);
    });

    it('shows all six real-sale seeds under the all-time window with tiered relative times', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T14:12:00.000Z'));

        const feed = buildLiveOrdersFeed([], 'all');

        // 'all' uses Number.POSITIVE_INFINITY as RANGE_MS, so every
        // seed (including the 121w True Religion S1 and the 601d
        // denim patchwork) survives the window filter. Timestamps
        // are sorted descending: 12m, 1w (7d), 1mo (40d wholesale),
        // 2mo (84d hat), 1y (601d denim patchwork), 2y (847d S1).
        // MD now has count 3 (wholesale + hat + denim patchwork),
        // PA still has count 2 (Grey Wave 1/2 + 2/2), and NY has
        // count 1 (S1); sorted by count desc, MD wins outright.
        // MD's lastActive is the wholesale (40d = 1mo ago), not
        // the older hat or the much-older denim patchwork.
        expect(feed.recentActivity.map(item => item.text)).toEqual([
            "Coalition 'Grey Wave' Wallet 2/2 ordered in York, PA",
            "Coalition 'Grey Wave' Wallet 1/2 ordered in York, PA",
            "COALITION GREEN CAMO WALLET + 6 more items ordered in Abingdon, MD",
            "TRUST YOURSELF CUSTOM TRUCKER (1/1) ordered in Owings Mills, MD",
            "Coalition Denim Patchwork 1/1 Jeans S1 ordered in Abingdon, MD",
            "Coalition x True Religion 1/1 Jeans S1 ordered in New York, NY",
        ]);
        expect(feed.recentActivity.map(item => item.time)).toEqual([
            '12m ago',
            '1w ago',
            '1mo ago',
            '2mo ago',
            '1y ago',
            '2y ago',
        ]);
        expect(feed.recentActivity.map(item => item.productUrl)).toEqual([
            '/product/Coalition_Grey_Wave_Wallet_2_2',
            '/product/Coalition_Grey_Wave_Wallet_1_2',
            '/product/GreenCamoWallet',
            '/product/prod_trust_yourself_hat_01',
            '/product/Coalition_Denim_Patchwork_S1',
            '/product/Coalition_x_True_Religion_S1',
        ]);
        expect(feed.states).toEqual([
            { id: 'MD', name: 'Maryland', count: 3, lastActive: '1mo ago' },
            { id: 'PA', name: 'Pennsylvania', count: 2, lastActive: '12m ago' },
            { id: 'NY', name: 'New York', count: 1, lastActive: '2y ago' },
        ]);
    });

    it('deduplicates when an INITIAL_ORDERS row carries the same id as a public seed', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T14:12:00.000Z'));

        const orders = [
            {
                id: 'public-pa-grey-wave-wallet-2-2',
                paymentStatus: 'paid',
                items: [
                    {
                        productId: 'Coalition_Grey_Wave_Wallet_2_2',
                        productName: "Coalition 'Grey Wave' Wallet 2/2",
                        productImage: 'https://i.imgur.com/FVMHZoq.jpeg',
                        selectedSize: 'One Size',
                        quantity: 1,
                        price: 75,
                        total: 75,
                    },
                ],
                shippingAddress: { city: 'York', state: 'PA' },
                createdAt: '2026-07-02T10:00:00-04:00',
            },
        ];

        const feed = buildLiveOrdersFeed(orders, '7d');

        const wallet22Occurrences = feed.recentActivity.filter(
            item => item.text === "Coalition 'Grey Wave' Wallet 2/2 ordered in York, PA",
        );
        expect(wallet22Occurrences).toHaveLength(1);
        expect(feed.states).toEqual([
            {
                id: 'PA',
                name: 'Pennsylvania',
                count: 2,
                lastActive: '12m ago',
            },
        ]);
    });
});
