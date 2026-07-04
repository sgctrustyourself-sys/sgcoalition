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
});
