// tests/adminOverlayEscapeFocusReturn.test.tsx
//
// The keyboard contract for the seven admin overlays that had no Escape /
// focus-return test of their own:
//
//   components/admin/CustomInquiryManager.tsx   -> inquiry detail sheet
//   components/admin/InstagramEntriesTab.tsx    -> entry detail sheet
//   components/admin/GiveawayEntriesTab.tsx     -> entry detail sheet
//   components/admin/YoutubeSubmissionsTab.tsx  -> proof viewer
//   components/admin/SignalManager.tsx          -> create/edit signal form
//   components/admin/OutreachTracker.tsx        -> log/edit contact form
//   components/admin/MarketingManager.tsx       -> "Send to live audience?" gate
//
// Each case mounts the REAL component, opens the overlay the way an admin does,
// and asserts the three things useFocusTrap promises:
//
//   1. Focus moves INTO the overlay on open.
//   2. Escape runs that component's own close handler.
//   3. Focus returns to the control that opened it — not to <body>, which is
//      what a modal that forgets the hook leaves behind.
//
// Every case also asserts the overlay's destructive action did NOT fire.
// Escape is a cancel: a detail sheet must not delete, a composer must not send,
// and a form must not save just because the keyboard asked to close it.
//
// Each mount additionally queries the dialog by role AND accessible name in the
// rendered DOM (`dialogsNamed`), so the label is proven to reach the tree, not
// just to exist in the source the static guard scans.
//
// Every overlay pins the converse too: while a write is in flight the trap
// pauses, so Escape is inert until the request settles. SignalManager and
// OutreachTracker disable their visible close controls (Cancel, header X)
// rather than leaving them clickable-but-ignored; the four detail sheets have
// no in-panel close control, so their backdrop is gated as well. That is the
// same gate MarketingManager puts on its send confirmation. The final block
// holds each sheet's write open and proves both dismiss paths are inert — and
// that the resolved update does not reopen a sheet closed mid-write.
//
// Mounting goes through tests/_helpers/adminSurface.tsx. This file supplies the
// two `vi.doMock` lines and loaders (see that helper's header for why vitest
// forces that split).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import type { ComponentType } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { setReactValue } from './_helpers/nativeValueSetter';
import { accessibleName, dialogsNamed } from './_helpers/accessibleName';

// ---------- LOADERS ----------
// Loaders, not static imports: the contexts must be stubbed before the surface
// (and everything it imports) resolves.

const loadCustomInquiryManager = () => import('../components/admin/CustomInquiryManager');
const loadInstagramEntriesTab = () => import('../components/admin/InstagramEntriesTab');
const loadGiveawayEntriesTab = () => import('../components/admin/GiveawayEntriesTab');
const loadYoutubeSubmissionsTab = () => import('../components/admin/YoutubeSubmissionsTab');
const loadSignalManager = () => import('../components/admin/SignalManager');
const loadOutreachTracker = () => import('../components/admin/OutreachTracker');
const loadMarketingManager = () => import('../components/admin/MarketingManager');

// ---------- HOISTED MOCKS ----------

const m = vi.hoisted(() => ({
    getAllInquiries: vi.fn(),
    updateInquiry: vi.fn(),
    deleteInquiry: vi.fn(),
}));

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

// CustomInquiryManager owns its data; the detail sheet must close without
// touching it.
vi.mock('../services/customInquiry', () => ({
    getAllInquiries: m.getAllInquiries,
    updateInquiry: m.updateInquiry,
    deleteInquiry: m.deleteInquiry,
}));

// YoutubeSubmissionsTab imports the confirmation sender at module scope.
vi.mock('../services/emailService', () => ({
    sendGiveawayValidationEmail: vi.fn().mockResolvedValue(undefined),
}));

// The harness cannot register the contexts for us — vitest scopes module mocks
// to the file that calls them (see the harness header). Two lines, once per
// file, and every surface below arrives as a loader so it resolves against them.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

// ---------- FIXTURES ----------

const INQUIRY = {
    id: 'inq-1',
    customer_name: 'Ada Lovelace',
    customer_email: 'ada@example.com',
    customer_phone: null,
    product_type: 'apparel-shirt',
    title: 'Two-sided run',
    description: 'Screen print both faces.',
    reference_images: [],
    budget_range: '$100 – $200',
    timeline: 'Two weeks',
    status: 'new',
    admin_notes: null,
    quote_amount: null,
    created_at: '2026-07-10T10:00:00Z',
};

const INSTAGRAM_ROW = {
    id: 'ig-1',
    giveaway_id: 'g-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    instagram_username: 'ada',
    screenshot_follow_url: 'https://example.com/follow.png',
    screenshot_like_url: 'https://example.com/like.png',
    screenshot_story_url: 'https://example.com/story.png',
    verified: true,
    created_at: '2026-07-10T10:00:00Z',
    ip_address: '127.0.0.1',
};

const GIVEAWAY_ROW = {
    id: 'ga-1',
    giveaway_id: 'g-1',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    instagram_username: 'grace',
    youtube_handle: null,
    shirt_size: 'M',
    screenshot_sub_url: 'https://example.com/sub.png',
    screenshot_comment_url: 'https://example.com/comment.png',
    screenshot_story_url: null,
    screenshot_follow_url: null,
    screenshot_like_url: null,
    screenshot_bonus_urls: [],
    claimed_points: 3,
    verified: false,
    email_sent: false,
    ip_address: '127.0.0.1',
    created_at: '2026-07-10T10:00:00Z',
};

const YOUTUBE_ROW = {
    id: 'yt-1',
    giveaway_id: 'g-1',
    name: 'Katherine Johnson',
    email: 'katherine@example.com',
    instagram_username: 'katherine',
    youtube_handle: 'kjohnson',
    shirt_size: 'L',
    screenshot_sub_url: 'https://example.com/sub.png',
    screenshot_comment_url: 'https://example.com/comment.png',
    screenshot_story_url: null,
    screenshot_bonus_urls: [],
    claimed_points: 5,
    verified: false,
    email_sent: false,
    ip_address: '127.0.0.1',
    created_at: '2026-07-10T10:00:00Z',
};

const MARKETING_STATS = {
    audience: { total: 1, email: 1, sms: 0, by_source: { drop_list: 1 } },
    contacts: [{ id: 'c1', email: 'buyer@example.com', phone: null, source: 'drop_list' }],
    campaigns: [],
};

const jsonResponse = (body: unknown, status = 200) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as unknown as Response;

// ---------- SHARED HARNESS ----------

let container: HTMLDivElement;

const flush = async () => {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

const mount = async <P extends object>(
    load: () => Promise<{ default: ComponentType<P> }>,
    props?: P,
) => {
    const surface = await renderAdminSurface(load, { props });
    container = surface.container;
    return surface;
};

const press = async (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(event); });
    return event;
};

/** The deepest overlay currently mounted. */
const topDialog = (): HTMLElement => {
    const dialogs = [...container.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')];
    expect(dialogs.length).toBeGreaterThan(0);
    return dialogs[dialogs.length - 1];
};

const buttonByText = (text: string, scope: ParentNode = container): HTMLButtonElement => {
    const match = [...scope.querySelectorAll('button')].find((b) =>
        (b.textContent || '').trim().includes(text),
    );
    expect(match, `no button containing "${text}"`).toBeTruthy();
    return match as HTMLButtonElement;
};

const buttonByTitle = (title: string, scope: ParentNode = container): HTMLButtonElement => {
    const match = scope.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
    expect(match, `no button titled "${title}"`).toBeTruthy();
    return match as HTMLButtonElement;
};

/** Focus the control, then activate it — a real click does not move focus. */
const activate = async (el: HTMLButtonElement) => {
    el.focus();
    await act(async () => { el.click(); });
    await flush();
};

const expectFocusReturnedTo = (opener: HTMLElement) => {
    expect(document.activeElement).toBe(opener);
};

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.setOutcomes([]);
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    m.getAllInquiries.mockResolvedValue([INQUIRY]);
    m.updateInquiry.mockResolvedValue(undefined);
    m.deleteInquiry.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// ------------------------------------------------------------------
// components/admin/CustomInquiryManager.tsx
// ------------------------------------------------------------------

describe('CustomInquiryManager inquiry sheet', () => {
    it('Escape closes the sheet, returns focus to View Details, and deletes nothing', async () => {
        await mount(loadCustomInquiryManager);

        const eye = buttonByTitle('View Details');
        await activate(eye);

        const panel = topDialog();
        expect(dialogsNamed(container, 'Inquiry Two-sided run')).toEqual([panel]);
        expect(panel.contains(document.activeElement)).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Inquiry Two-sided run"]')).toBeNull();
        expectFocusReturnedTo(eye);
        expect(m.deleteInquiry).not.toHaveBeenCalled();
    });

    it('names every reference image link by the action it performs', async () => {
        m.getAllInquiries.mockResolvedValue([
            {
                ...INQUIRY,
                reference_images: [
                    'https://example.com/ref-1.png',
                    'https://example.com/ref-2.png',
                ],
            },
        ]);

        await mount(loadCustomInquiryManager);
        await activate(buttonByTitle('View Details'));

        const links = [
            ...topDialog().querySelectorAll<HTMLAnchorElement>('a[target="_blank"]'),
        ];
        expect(links).toHaveLength(2);
        // The image alt is a description, not the action; the label says what
        // following the link does and that it leaves the page.
        expect(links.map((link) => accessibleName(link))).toEqual([
            'Open reference 1 in a new tab',
            'Open reference 2 in a new tab',
        ]);
    });
});

// ------------------------------------------------------------------
// components/admin/InstagramEntriesTab.tsx
// ------------------------------------------------------------------

describe('InstagramEntriesTab entry sheet', () => {
    it('Escape closes the sheet, returns focus to View Details, and deletes nothing', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [INSTAGRAM_ROW], error: null } },
        ]);

        await mount(loadInstagramEntriesTab, { giveawayId: 'g-1' });

        const eye = buttonByTitle('View Details');
        await activate(eye);

        const panel = topDialog();
        expect(dialogsNamed(container, 'Instagram entry Ada Lovelace')).toEqual([panel]);
        expect(panel.contains(document.activeElement)).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Instagram entry Ada Lovelace"]')).toBeNull();
        expectFocusReturnedTo(eye);
        // Deleting an entry goes through the service-role client; Escape is a
        // cancel, so no delete chain may have started.
        expect(mockSupabase.deleteSpy).not.toHaveBeenCalled();
    });
});

// ------------------------------------------------------------------
// components/admin/GiveawayEntriesTab.tsx
// ------------------------------------------------------------------

describe('GiveawayEntriesTab entry sheet', () => {
    it('Escape closes the sheet, returns focus to View Details, and deletes nothing', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [GIVEAWAY_ROW], error: null } },
        ]);

        await mount(loadGiveawayEntriesTab, { giveawayId: 'g-1' });

        const eye = buttonByTitle('View Details');
        await activate(eye);

        const panel = topDialog();
        expect(dialogsNamed(container, 'Giveaway entry Grace Hopper')).toEqual([panel]);
        expect(panel.contains(document.activeElement)).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Giveaway entry Grace Hopper"]')).toBeNull();
        expectFocusReturnedTo(eye);
        expect(mockSupabase.deleteSpy).not.toHaveBeenCalled();
    });
});

// ------------------------------------------------------------------
// components/admin/YoutubeSubmissionsTab.tsx
// ------------------------------------------------------------------

describe('YoutubeSubmissionsTab proof viewer', () => {
    it('Escape closes the viewer, returns focus to View Details, and deletes nothing', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [YOUTUBE_ROW], error: null } },
        ]);

        await mount(loadYoutubeSubmissionsTab, { giveawayId: 'g-1', giveawayTitle: 'October drop' });

        const eye = buttonByTitle('View Details');
        await activate(eye);

        const panel = topDialog();
        expect(dialogsNamed(container, 'YouTube entry Katherine Johnson')).toEqual([panel]);
        expect(panel.contains(document.activeElement)).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="YouTube entry Katherine Johnson"]')).toBeNull();
        expectFocusReturnedTo(eye);
        expect(mockSupabase.deleteSpy).not.toHaveBeenCalled();
    });
});

// ------------------------------------------------------------------
// components/admin/SignalManager.tsx
// ------------------------------------------------------------------

describe('SignalManager signal form', () => {
    it('Escape closes the form, returns focus to New Signal, and inserts nothing', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await mount(loadSignalManager);

        const newSignal = buttonByText('New Signal');
        await activate(newSignal);

        const panel = topDialog();
        expect(dialogsNamed(container, 'Create signal')).toEqual([panel]);
        expect(panel.contains(document.activeElement)).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Create signal"]')).toBeNull();
        expectFocusReturnedTo(newSignal);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
    });

    it('Escape is inert while the signal is being saved', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } }, // mount fetch
            { kind: 'resolve', value: { data: [], error: null } }, // refetch after save
        ]);

        await mount(loadSignalManager);
        await activate(buttonByText('New Signal'));

        const panel = topDialog();
        const title = container.querySelector<HTMLInputElement>('input[placeholder="System Alert"]');
        const message = container.querySelector<HTMLTextAreaElement>(
            'textarea[placeholder="Enter the signal content..."]',
        );
        expect(title && message).toBeTruthy();

        await act(async () => {
            setReactValue(title!, 'Downtime tonight');
            setReactValue(message!, 'Deploys pause at 02:00 UTC.');
        });

        // Hold the insert open, so Escape below lands mid-write.
        let settleInsert: () => void = () => {};
        mockSupabase.fromSpy.mockImplementationOnce(() => ({
            insert: () =>
                new Promise((resolve) => {
                    settleInsert = () => resolve({ error: null });
                }),
        }));

        await activate(buttonByText('Deploy Signal'));
        expect(panel.querySelector<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(true);

        const cancel = buttonByText('Cancel');
        const closeButton = panel.querySelector<HTMLButtonElement>('button[aria-label="Close modal"]');
        expect(cancel.disabled).toBe(true);
        expect(closeButton?.disabled).toBe(true);

        await press('Escape');

        // Still open: the save was not abandoned, and focus was not handed back
        // to the page while the request was outstanding.
        expect(container.querySelector('[aria-label="Create signal"]')).toBeTruthy();
        expect(panel.contains(document.activeElement)).toBe(true);

        // The visible close controls agree with Escape: neither dismisses the
        // form while the write is outstanding.
        await activate(cancel);
        await activate(closeButton!);
        expect(container.querySelector('[aria-label="Create signal"]')).toBeTruthy();

        settleInsert();
        await flush();

        // Once the write settles the form closes the normal way.
        expect(container.querySelector('[aria-label="Create signal"]')).toBeNull();
    });
});

// ------------------------------------------------------------------
// components/admin/OutreachTracker.tsx
// ------------------------------------------------------------------

describe('OutreachTracker contact form', () => {
    it('Escape closes the form, returns focus to Log Contact, and saves nothing', async () => {
        // The local-storage branch keeps this test on the form itself rather than
        // on the upsert chain.
        mockAppContext({ isSupabaseConfigured: false });

        await mount(loadOutreachTracker);

        const logContact = buttonByText('Log Contact');
        await activate(logContact);

        const panel = topDialog();
        expect(dialogsNamed(container, 'Log new contact')).toEqual([panel]);
        expect(panel.contains(document.activeElement)).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Log new contact"]')).toBeNull();
        expectFocusReturnedTo(logContact);
        expect(mockSupabase.upsertSpy).not.toHaveBeenCalled();
        // Escape is a cancel, not a save: the draft never reached local storage
        // under a new id.
        expect(localStorage.getItem('coalition_outreach_contacts')).toBeNull();
    });

    it('Escape is inert while the contact is being saved', async () => {
        mockAppContext({ isSupabaseConfigured: true });
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } }, // mount load
            { kind: 'resolve', value: { data: [], error: null } }, // reload after save
        ]);

        await mount(loadOutreachTracker);
        await activate(buttonByText('Log Contact'));

        const panel = topDialog();
        const name = container.querySelector<HTMLInputElement>('input[placeholder="Example Boutique"]');
        const handle = container.querySelector<HTMLInputElement>('input[placeholder="@exampleboutique"]');
        expect(name && handle).toBeTruthy();

        await act(async () => {
            setReactValue(name!, 'Example Boutique');
            setReactValue(handle!, '@exampleboutique');
        });

        // Hold the upsert open, so Escape below lands mid-write.
        let settleUpsert: () => void = () => {};
        mockSupabase.fromSpy.mockImplementationOnce(() => ({
            upsert: () =>
                new Promise((resolve) => {
                    settleUpsert = () => resolve({ error: null });
                }),
        }));

        await activate(buttonByText('Save Contact'));
        expect(panel.querySelector<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(true);

        // The header close control is found by the name every admin dialog
        // gives its dismissal X, not by button order.
        const cancel = buttonByText('Cancel');
        const closeButton = panel.querySelector<HTMLButtonElement>('button[aria-label="Close modal"]');
        expect(closeButton).toBeTruthy();
        expect(cancel.disabled).toBe(true);
        expect(closeButton?.disabled).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Log new contact"]')).toBeTruthy();
        expect(panel.contains(document.activeElement)).toBe(true);

        await activate(cancel);
        await activate(closeButton!);
        expect(container.querySelector('[aria-label="Log new contact"]')).toBeTruthy();

        settleUpsert();
        await flush();

        expect(container.querySelector('[aria-label="Log new contact"]')).toBeNull();
    });
});

// ------------------------------------------------------------------
// components/admin/MarketingManager.tsx
// ------------------------------------------------------------------

describe('MarketingManager send confirmation', () => {
    it('Escape closes the confirmation, returns focus to Send Now, and sends nothing', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(MARKETING_STATS));
        vi.stubGlobal('fetch', fetchMock);

        await mount(loadMarketingManager);

        const composerTab = buttonByText('Composer');
        await activate(composerTab);

        const name = container.querySelector<HTMLInputElement>('input[placeholder="Spring drop reminder"]');
        const subject = container.querySelector<HTMLInputElement>('input[placeholder="Spring drop is live"]');
        const body = container.querySelector<HTMLTextAreaElement>(
            'textarea[placeholder="<h1>Spring drop is live</h1><p>...</p>"]',
        );
        expect(name && subject && body).toBeTruthy();

        await act(async () => {
            setReactValue(name!, 'October drop');
            setReactValue(subject!, 'Three new pieces');
            setReactValue(body!, '<h1>October drop</h1>');
        });

        const sendNow = buttonByText('Send Now');
        expect(sendNow.disabled).toBe(false);
        await activate(sendNow);

        const confirm = topDialog();
        expect(dialogsNamed(container, 'Confirm send to live audience')).toEqual([confirm]);
        expect(confirm.contains(document.activeElement)).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Confirm send to live audience"]')).toBeNull();
        expectFocusReturnedTo(sendNow);
        expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain('/api/marketing-send');
    });
});

// ------------------------------------------------------------------
// Detail sheets: a write must not be dismissed out from under itself
// ------------------------------------------------------------------
//
// Each sheet starts its verify/save request while the sheet stays open. Before
// the `isSaving` gate, Escape and a backdrop click closed it mid-write, and the
// resolved update then restored the selection from the closure snapshot — so
// the sheet reappeared after the admin had dismissed it. These cases hold the
// request open, exercise both dismiss paths, resolve it, and assert the sheet
// stayed put (and still closes afterwards).

/** Keep the next supabase update's terminal await pending until `settle()`. */
const deferNextUpdate = () => {
    let settle: () => void = () => {};
    mockSupabase.fromSpy.mockImplementationOnce(() => ({
        update: () => ({
            eq: () =>
                new Promise((resolve) => {
                    settle = () => resolve({ error: null });
                }),
        }),
    }));
    return () => settle();
};

/**
 * The click-to-dismiss surface for a sheet: the backdrop is either the panel's
 * previous sibling (YouTube's absolute scrim) or its parent (the other three).
 */
const backdropOf = (panel: HTMLElement): HTMLElement => {
    const sibling = panel.previousElementSibling as HTMLElement | null;
    if (sibling?.className.includes('absolute inset-0')) return sibling;
    return panel.parentElement as HTMLElement;
};

const dismissThroughBackdrop = async (panel: HTMLElement) => {
    await act(async () => {
        backdropOf(panel).click();
    });
    await flush();
};

describe('detail sheets hold the keyboard and the backdrop while saving', () => {
    it('InstagramEntriesTab: inert mid-write, patched in place, closes once settled', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [INSTAGRAM_ROW], error: null } },
        ]);

        await mount(loadInstagramEntriesTab, { giveawayId: 'g-1' });
        await activate(buttonByTitle('View Details'));
        const panel = topDialog();

        const settle = deferNextUpdate();
        const verify = buttonByText('Verified', panel);
        await activate(verify);
        expect(verify.disabled).toBe(true);

        await press('Escape');
        expect(container.querySelector('[aria-label="Instagram entry Ada Lovelace"]')).toBeTruthy();
        expect(panel.contains(document.activeElement)).toBe(true);

        await dismissThroughBackdrop(panel);
        expect(container.querySelector('[aria-label="Instagram entry Ada Lovelace"]')).toBeTruthy();

        await act(async () => { settle(); });
        await flush();

        // Still the same sheet, now showing the resolved state: the update
        // patched the open row instead of reopening a stale snapshot.
        expect(dialogsNamed(container, 'Instagram entry Ada Lovelace')).toEqual([panel]);
        expect(buttonByText('Mark Verified', panel)).toBeTruthy();

        await press('Escape');
        expect(container.querySelector('[aria-label="Instagram entry Ada Lovelace"]')).toBeNull();
        expect(mockSupabase.deleteSpy).not.toHaveBeenCalled();
    });

    it('GiveawayEntriesTab: inert mid-write, patched in place, closes once settled', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [GIVEAWAY_ROW], error: null } },
        ]);

        await mount(loadGiveawayEntriesTab, { giveawayId: 'g-1' });
        await activate(buttonByTitle('View Details'));
        const panel = topDialog();

        const settle = deferNextUpdate();
        const verify = buttonByText('Mark Verified', panel);
        await activate(verify);
        expect(verify.disabled).toBe(true);

        await press('Escape');
        expect(container.querySelector('[aria-label="Giveaway entry Grace Hopper"]')).toBeTruthy();

        await dismissThroughBackdrop(panel);
        expect(container.querySelector('[aria-label="Giveaway entry Grace Hopper"]')).toBeTruthy();

        await act(async () => { settle(); });
        await flush();

        expect(dialogsNamed(container, 'Giveaway entry Grace Hopper')).toEqual([panel]);
        expect(buttonByText('✅ Verified', panel)).toBeTruthy();

        await press('Escape');
        expect(container.querySelector('[aria-label="Giveaway entry Grace Hopper"]')).toBeNull();
    });

    it('YoutubeSubmissionsTab: inert mid-write, patched in place, closes once settled', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [YOUTUBE_ROW], error: null } },
        ]);

        await mount(loadYoutubeSubmissionsTab, { giveawayId: 'g-1', giveawayTitle: 'October drop' });
        await activate(buttonByTitle('View Details'));
        const panel = topDialog();

        const settle = deferNextUpdate();
        const verify = buttonByText('Verify Now', panel);
        await activate(verify);
        expect(verify.disabled).toBe(true);

        await press('Escape');
        expect(container.querySelector('[aria-label="YouTube entry Katherine Johnson"]')).toBeTruthy();

        await dismissThroughBackdrop(panel);
        expect(container.querySelector('[aria-label="YouTube entry Katherine Johnson"]')).toBeTruthy();

        await act(async () => { settle(); });
        await flush();

        expect(dialogsNamed(container, 'YouTube entry Katherine Johnson')).toEqual([panel]);
        expect(buttonByText('Verified ✓', panel)).toBeTruthy();

        await press('Escape');
        expect(container.querySelector('[aria-label="YouTube entry Katherine Johnson"]')).toBeNull();
    });

    it('CustomInquiryManager: notes save holds Escape and the backdrop until it settles', async () => {
        await mount(loadCustomInquiryManager);
        await activate(buttonByTitle('View Details'));
        const panel = topDialog();

        let settleSave: () => void = () => {};
        m.updateInquiry.mockImplementationOnce(
            () => new Promise<void>((resolve) => { settleSave = resolve; }),
        );

        const save = buttonByText('Save Changes', panel);
        await activate(save);
        expect(save.disabled).toBe(true);

        await press('Escape');
        expect(container.querySelector('[aria-label="Inquiry Two-sided run"]')).toBeTruthy();
        expect(panel.contains(document.activeElement)).toBe(true);

        await dismissThroughBackdrop(panel);
        expect(container.querySelector('[aria-label="Inquiry Two-sided run"]')).toBeTruthy();

        await act(async () => { settleSave(); });
        await flush();

        expect(dialogsNamed(container, 'Inquiry Two-sided run')).toEqual([panel]);
        expect(buttonByText('Save Changes', panel).disabled).toBe(false);

        await press('Escape');
        expect(container.querySelector('[aria-label="Inquiry Two-sided run"]')).toBeNull();
        expect(m.deleteInquiry).not.toHaveBeenCalled();
    });
});
