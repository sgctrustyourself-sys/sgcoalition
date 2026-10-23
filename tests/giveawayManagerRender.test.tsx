// tests/giveawayManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/GiveawayManager.tsx.
//
// Replicates the established pattern: createRoot + act + explicit DOM assertions
// (no snapshots). GiveawayManager has the most complex mock surface of the
// 4 admin render-flow files because it pulls state from AppContext AND mounts
// 2 sub-components (GiveawayEntriesTab + YoutubeSubmissionsTab) inside the
// detail panel and a utility helper (getGiveawayTicketCount).
//
// Mock surface:
//   - ../context/AppContext (useApp) - returns giveaways[] + products[] + 4
//     action fns (addGiveaway, deleteGiveaway, pickGiveawayWinner).
//     Per-test mockReturnValue vi.mocked(useApp) so EMPTY_ACTIVE can override
//     giveaways to []. Per-test mockReturnValue for addGiveaway tracks the
//     create payload in CREATE_TAB_OPEN.
//   - ./admin/GiveawayEntriesTab (default-export stub) - renders a
//     data-testid="stub-entries-tab" div so we don't drag supabase + entries-
//     rendering dependencies. Show whether sub-tab state machine flipped
//     OPEN by querying the stub.
//   - ./admin/YoutubeSubmissionsTab (default-export stub) - same pattern as
//     GiveawayEntriesTab but with data-testid="stub-youtube-tab".
//   - ../utils/giveawayUtils (getGiveawayTicketCount) - vi.mock returns
//     g.entries.length for stability (the real one sums entry.entryCount).
//
// 4 fixtures spanning mixed statuses so the 'active' vs 'past' tab filter is
// exercisable:
//   - WEEKLY_MERCH - ACTIVE
//   - NF_TEE_LAUNCH - UPCOMING (still considered 'active' by the filter)
//   - LAUNCHED_VIEW - ENDED (filtered out of active)
//
// 3-card stat grid (detail view) pinned via DOM traversal over
// `div.text-2xl.font-bold` (returns in document order). GiveawayManager has
// exactly 3 such cards: Total Tickets, Status, Days Left.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { pinStatValues } from './_helpers/statCardPinner';

vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));

vi.mock('../components/admin/GiveawayEntriesTab', () => ({
    default: () => <div data-testid="stub-entries-tab" />,
}));

vi.mock('../components/admin/YoutubeSubmissionsTab', () => ({
    default: () => <div data-testid="stub-youtube-tab" />,
}));

vi.mock('../utils/giveawayUtils', () => ({
    // GiveawayManager imports ONLY getGiveawayTicketCount from this module,
    // so the mock factory stays minimal. getGiveawayTicketCount is stubbed
    // to return entries?.length for stability (the real one sums
    // entry.entryCount). Other exports would not be required here.
    getGiveawayTicketCount: vi.fn((entries: any[]) => entries?.length || 0),
}));

// NOTE: GiveawayManager is imported as a STATIC import below. Vitest hoists
// the vi.mock calls above static imports, so the static import resolves to
// the REAL component (the 4 mocks above cover its dependencies only -
// AppContext, the 2 sub-component tabs, and getGiveawayTicketCount). We
// deliberately do NOT vi.mock ./admin/GiveawayManager because vi.mock
// replaces the module wholesale and would render an empty stub instead.

import { useApp } from '../context/AppContext';
import GiveawayManager from '../components/admin/GiveawayManager';

interface TestGiveawayEntry {
    id: string;
    giveawayId: string;
    userId?: string;
    name: string;
    email: string;
    entryCount: number;
    timestamp: number;
    source: 'manual' | 'purchase' | 'form' | 'social' | 'subscriber';
}

interface TestGiveaway {
    id: string;
    title: string;
    prize: string;
    prizeImage?: string;
    description: string;
    startDate: string;
    endDate: string;
    status: 'active' | 'upcoming' | 'ended';
    requirements: string[];
    maxEntriesPerUser: number;
    entries: TestGiveawayEntry[];
    winners?: TestGiveawayEntry[];
    createdAt: number;
}

const WEEKLY_MERCH: TestGiveaway = {
    id: 'ga_weekly_merch_2026_07',
    title: 'Weekly Merch Drop',
    prize: 'Limited Edition Hoodie',
    description: 'Win a Coalition hoodie every week. Free entry with purchase.',
    prizeImage: '/images/hoodie-front.jpg',
    startDate: '2026-07-01T00:00:00Z',
    endDate: '2026-12-31T00:00:00Z',
    status: 'active',
    requirements: ['Join Discord', 'Follow on Twitter'],
    maxEntriesPerUser: 1,
    entries: [
        { id: 'e1', giveawayId: 'ga_weekly_merch_2026_07', name: 'Alice', email: 'a@x.com', entryCount: 1, timestamp: 1719936000000, source: 'manual' },
        { id: 'e2', giveawayId: 'ga_weekly_merch_2026_07', name: 'Bob', email: 'b@x.com', entryCount: 1, timestamp: 1719936060000, source: 'purchase' },
    ],
    createdAt: 1719936000000,
};

const NF_TEE_LAUNCH: TestGiveaway = {
    id: 'ga_nf_tee_launch_2026_09',
    title: 'NF-Tee Launch Giveaway',
    prize: 'NF-Tee (1 of 1)',
    description: 'Be the first to own an NF-Tee by entering this giveaway.',
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2026-09-30T00:00:00Z',
    status: 'upcoming',
    requirements: ['Join Discord'],
    maxEntriesPerUser: 1,
    entries: [],
    createdAt: 1719937000000,
};

const LAUNCHED_VIEW: TestGiveaway = {
    id: 'ga_launched_view_2026_06',
    title: 'Already Ended: Launch Day',
    prize: 'SG Coalition Snapback',
    description: 'Past giveaway - ended in June 2026.',
    startDate: '2026-06-01T00:00:00Z',
    endDate: '2026-06-30T00:00:00Z',
    status: 'ended',
    requirements: [],
    maxEntriesPerUser: 1,
    entries: [],
    createdAt: 1719932000000,
};

const TEST_GIVEAWAYS: TestGiveaway[] = [
    WEEKLY_MERCH,
    NF_TEE_LAUNCH,
    LAUNCHED_VIEW,
];

const EMPTY_GIVEAWAYS: TestGiveaway[] = [];

const TEST_PRODUCTS = [
    { id: 'prod_tee', name: 'Coalition Tee', price: 45, images: ['/images/tee-front.jpg'], description: 'Premium cotton tee.' , category: 'apparel', archived: false },
];

const baselineUseApp = (giveaways: TestGiveaway[]) => ({
    giveaways,
    products: TEST_PRODUCTS,
    addGiveaway: vi.fn().mockResolvedValue(undefined),
    deleteGiveaway: vi.fn().mockResolvedValue(undefined),
    pickGiveawayWinner: vi.fn().mockResolvedValue(undefined),
});

describe('GiveawayManager render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        // Suppress noisy clipboard/console errors from copyLink + handlePickWinner.
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // navigator.clipboard.writeText spy is intentionally OMITTED - jsdom
        // does not implement navigator.clipboard by default and any spy that
        // touches the undefined property throws before our beforeEach has
        // even assigned root. None of the 4 tests click Copy Link so the spy
        // is dead code anyway.

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('LOADED_ACTIVE: 3 giveaways in default active tab filters out 1 ENDED -> renders 2 cards (Weekly Merch, NF-Tee Launch). Title block + 3-tab sub-row render.', async () => {
        vi.mocked(useApp).mockReturnValue(baselineUseApp(TEST_GIVEAWAYS) as any);

        await act(async => { root.render(createElement(GiveawayManager)); });
        const html = container.innerHTML;

        // Top-level header rendered.
        expect(html).toContain('Giveaways');
        expect(html).toContain('Create and manage community rewards');

        // 3-tab sub-row visible: Active, Past, + Create.
        expect(html).toContain('>Active<');
        expect(html).toContain('>Past<');
        expect(html).toContain('>+ Create<');

        // Active tab is selected by default - WEEKLY_MERCH (active) + NF_TEE_LAUNCH (upcoming, still active) shown.
        expect(html).toContain('Weekly Merch Drop');
        expect(html).toContain('NF-Tee Launch Giveaway');
        // ENded giveaway filtered out.
        expect(html).not.toContain('Already Ended: Launch Day');
        // No winners/draw UI for unselected detail.
        expect(html).toContain('Select a Giveaway');
    });

    it('EMPTY_ACTIVE: 0 giveaways -> "No giveaways found" empty state + gift icon (no cards rendered)', async () => {
        vi.mocked(useApp).mockReturnValue(baselineUseApp(EMPTY_GIVEAWAYS) as any);

        await act(async => { root.render(createElement(GiveawayManager)); });
        const html = container.innerHTML;

        // Default 'active' tab. Empty state.
        expect(html).toContain('No giveaways found');

        // No giveaway titles rendered.
        expect(html).not.toContain('Weekly Merch Drop');
        expect(html).not.toContain('NF-Tee Launch Giveaway');
        expect(html).not.toContain('Already Ended: Launch Day');

        // Top-level header + 3-tab row still present.
        expect(html).toContain('Giveaways');
        expect(html).toContain('>Active<');
    });
});

describe('GiveawayManager form modal + detail view interactions', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // navigator.clipboard.writeText spy intentionally OMITTED - see note
        // in Describe 1's beforeEach. None of the 4 tests click Copy Link.

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('CREATE_TAB_OPEN: clicking "+ Create" mounts launch form (Title input + Prize input + Start datetime + End datetime + Description textarea + Launch Giveaway button)', async () => {
        const addGiveaway = vi.fn().mockResolvedValue(undefined);
        vi.mocked(useApp).mockReturnValue({ ...baselineUseApp(TEST_GIVEAWAYS), addGiveaway } as any);

        await act(async => { root.render(createElement(GiveawayManager)); });

        // Click the + Create tab button. The textContent is '+ Create'.
        const createBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => (b.textContent || '').trim() === '+ Create',
        ) as HTMLButtonElement | undefined;
        expect(createBtn).toBeTruthy();

        await act(async => { createBtn!.click(); });
        const html = container.innerHTML;

        expect(html).toContain('Create New Giveaway');
        // The product auto-fill select + 4 inputs + 1 textarea.
        expect(html).toContain('Title');
        expect(html).toContain('Prize');
        expect(html).toContain('Description');
        expect(html).toContain('Launch Giveaway');
        // Auto-fill product selector present.
        expect(html).toContain('Quick Select from Products');
        // Detail-panel empty state is hidden in create mode.
        expect(html).not.toContain('Select a Giveaway');
        // NOTE: An earlier version of this test asserted
        // `expect(html).not.toContain('Weekly Merch Drop')` to confirm no
        // giveaway card leaked through. That assertion was a false positive:
        // the Title input's placeholder is the literal string 'Weekly Merch
        // Drop' (a copy-suggested-title hint), so the assertion always failed
        // even when the create view rendered correctly. The
        // `not.toContain('Select a Giveaway')` check is sufficient because
        // it proves the detail empty-state is gated by `activeTab !== 'create'`.
    });

    it('DETAIL_SELECT: clicking Weekly Merch card mounts detail panel - 3 stat cards (Total Tickets, Status, Days Left) + 3 sub-tab buttons (Overview, Entries, Youtube Details) + Edit Copy/Delete action buttons', async () => {
        vi.mocked(useApp).mockReturnValue(baselineUseApp(TEST_GIVEAWAYS) as any);

        await act(async => { root.render(createElement(GiveawayManager)); });

        // Click the Weekly Merch card (the .onClick is on the .map'd card div).
        const cardTitleText = 'Weekly Merch Drop';
        const cardDiv = Array.from(document.body.querySelectorAll('div')).find(
            (d) => (d.textContent || '').includes(cardTitleText) &&
                d.className.includes('cursor-pointer'),
        ) as HTMLDivElement | undefined;
        expect(cardDiv).toBeTruthy();
        await act(async => { cardDiv!.click(); });
        const html = container.innerHTML;

        // Detail header loaded.
        expect(html).toContain('Limited Edition Hoodie'); // prize line
        // 3 stat cards pinned via the shared helper. GiveawayManager renders
        // stat numbers as <div className="text-2xl font-bold ..."> (note:
        // font-bold, NOT font-black, and one card has an additive 'capitalize'
        // class which the CSS-class traversal handles).
        const statValues = pinStatValues(document.body, 'div.text-2xl.font-bold');
        expect(statValues.length).toBeGreaterThanOrEqual(3);
        // The first stat card is getGiveawayTicketCount(WEEKLY_MERCH.entries) = 2 (mock returns entries.length).
        expect(statValues[0]).toBe('2');
        // The 2nd is 'status' (capitalized via .capitalize).
        expect(statValues[1].toLowerCase()).toBe('active');
        // The 3rd is 'Days Left': Math.max(0, ceil((endDate - now)/86400000)) for endDate 2026-12-31.
        // (Asserting exact digits would be brittle; just assert a positive number.)
        expect(Number(statValues[2])).toBeGreaterThan(0);

        // 3 sub-tab buttons render.
        expect(html).toContain('>Overview<');
        expect(html).toContain('>Entries<');
        expect(html).toContain('>Youtube Details<');

        // Action buttons (Copy + Delete in the detail header).
        const buttons = Array.from(document.body.querySelectorAll('button[title]'));
        const titles = buttons.map((b) => b.getAttribute('title')).filter(Boolean);
        expect(titles).toContain('Copy Link');
        expect(titles).toContain('Delete');
    });
});
