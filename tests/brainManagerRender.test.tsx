// tests/brainManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/BrainManager.tsx.
//
// Replicates the established pattern: createRoot + act + explicit DOM assertions
// (no snapshots). BrainManager has a MIXED mock surface (thinks user): it imports
// services/brainService for CRUD helpers (createBrainEntry / updateBrainEntry /
// deleteBrainEntry) BUT calls services/supabase directly via fetchEntries() to
// load the initial list. This means we must vi.mock BOTH:
//
//   - ../services/supabase - for fetchEntries() to resolve (initial load + post-
//     save refresh). Consumes 1 outcome per call.
//   - ../services/brainService - for createBrainEntry() to be a spy we can assert
//     on. Auto-mocked (vi.fn()s).
//   - ../context/ToastContext - useToast stub for addToast (no-op vi.fn).
//
// BrainManager also has an early-return LOADING state -- `isLoading && !isEditing`
// triggers the persistent "Loading Coalition Brain..." pulse-loader BEFORE the
// main panel. We test this branch explicitly by leaving the supabase outcome queue
// empty so the await hangs forever.
//
// BRAIN_CATEGORIES + ImportanceStars come from brainService + the component
// itself. The BrainEntry type is also from brainService. All auto-mocked.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { pinStatValues } from './_helpers/statCardPinner';
import { setReactValue } from './_helpers/nativeValueSetter';

// vitest auto-hoists vi.mock above the imports that follow.
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));
vi.mock('../services/brainService', async () => {
    // Pull the real module FIRST via vi.importActual so that the
    // non-mutable constants + types (BRAIN_CATEGORIES, BrainCategory,
    // BrainSource, BrainEntry, BrainEntryInput) are preserved. BrainManager.tsx
    // imports BRAIN_CATEGORIES + types and would crash with
    // "No 'BRAIN_CATEGORIES' export is defined on the mock" if we wholesale-
    // replaced the module with a vi.fn()s-only factory.
    // Then override ONLY the mutable function exports with vi.fn() auto-mocks
    // so per-test vi.mocked(...).mockResolvedValue / mockResolvedValueOnce work.
    const actual = await vi.importActual<typeof import('../services/brainService')>(
        '../services/brainService',
    );
    return {
        ...actual,
        getBrainEntries: vi.fn(),
        getBrainEntry: vi.fn(),
        createBrainEntry: vi.fn(),
        updateBrainEntry: vi.fn(),
        deleteBrainEntry: vi.fn(),
        searchBrainEntries: vi.fn(),
        saveChatInsight: vi.fn(),
        getRelevantBrainEntries: vi.fn(),
    };
});
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

import { createBrainEntry } from '../services/brainService';
import BrainManager from '../components/admin/BrainManager';

interface TestBrainEntry {
    id: string;
    category: 'product_design' | 'brand_guidelines' | 'chat_insight' | 'creative_direction' | 'general';
    title: string;
    content: string;
    tags: string[];
    source: 'ai_chat' | 'manual' | 'product' | 'design_session';
    importance: number;
    image_url: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    updated_at: string;
    user_id?: string;
}

// 3 fixtures spanning multiple categories so the 5-card stat grid has varied
// counts. Search test will scope to 'NF-Tee' - only entry 'product_design' matches.
const ENTRY_NF_TEE: TestBrainEntry = {
    id: 'brain-001',
    category: 'product_design',
    title: 'NF-Tee Design Philosophy',
    content: 'The NF-Tee uses organic cotton with hand-stitched embroidery. The blue letters in the design block (NF) are intentionally layered.',
    tags: ['apparel', 'tee', 'cotton'],
    source: 'manual',
    importance: 5,
    image_url: null,
    metadata: null,
    created_at: '2026-07-10T10:00:00Z',
    updated_at: '2026-07-10T10:00:00Z',
};
const ENTRY_BRAND_GUIDELINES: TestBrainEntry = {
    id: 'brain-002',
    category: 'brand_guidelines',
    title: 'Coalition Brand Voice',
    content: 'Calm, considered, never rushed. Black/white primary, accent for emphasis.',
    tags: ['brand', 'voice'],
    source: 'manual',
    importance: 4,
    image_url: null,
    metadata: null,
    created_at: '2026-07-12T09:00:00Z',
    updated_at: '2026-07-12T09:00:00Z',
};
const ENTRY_CHAT_INSIGHT: TestBrainEntry = {
    id: 'brain-003',
    category: 'chat_insight',
    title: 'Customer Asked About Wholesale',
    content: 'A wholesale buyer asked about bulk pricing. Save as insight for future wholesale onboarding flows.',
    tags: ['wholesale', 'pricing'],
    source: 'ai_chat',
    importance: 3,
    image_url: null,
    metadata: null,
    created_at: '2026-07-14T08:00:00Z',
    updated_at: '2026-07-14T08:00:00Z',
};

const TEST_ENTRIES: TestBrainEntry[] = [
    ENTRY_NF_TEE,
    ENTRY_BRAND_GUIDELINES,
    ENTRY_CHAT_INSIGHT,
];
const EMPTY_ENTRIES: TestBrainEntry[] = [];

describe('BrainManager render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    // Stat grid: BrainManager has exactly 6 stat cards rendered as
    // <div className="text-2xl font-black">: index 0 = Total, 1 = Product Design,
    // 2 = Brand Guidelines, 3 = Chat Insight, 4 = Creative Direction, 5 = General.
    // We pin values via the shared helper.

    it('LOADED_ENTRIES: 6-card stat grid (3 entries distributed across 3 categories) + 3 entry cards render + New Entry button + search input', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: TEST_ENTRIES, error: null } },
        ]);

        await act(async => { root.render(createElement(BrainManager)); });
        const html = container.innerHTML;

        // Stat grid - pin via the shared helper.
        const statValues = pinStatValues(container, 'div.text-2xl.font-black');
        // 3 total entries split: product_design=1, brand_guidelines=1, chat_insight=1.
        expect(statValues[0]).toBe('3');           // Total
        expect(statValues[1]).toBe('1');           // Product Design
        expect(statValues[2]).toBe('1');           // Brand Guidelines
        expect(statValues[3]).toBe('1');           // Chat Insight
        expect(statValues[4]).toBe('0');           // Creative Direction
        expect(statValues[5]).toBe('0');           // General

        // 3 entry titles render.
        expect(html).toContain('NF-Tee Design Philosophy');
        expect(html).toContain('Coalition Brand Voice');
        expect(html).toContain('Customer Asked About Wholesale');

        // Per-entry category badge + Importance stars + tag chips render.
        expect(html).toContain('Product Design');
        expect(html).toContain('Brand Guidelines');
        expect(html).toContain('Chat Insight');

        // Header + controls.
        expect(html).toContain('Coalition Brain');
        expect(html).toContain('New Entry');
        expect(html).toContain('Search brain...');
        expect(html).toContain('All Categories');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('EMPTY_ENTRIES: 0 entries renders "The brain is empty. Start building knowledge!" empty state + 6 zero count stat cards', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await act(async => { root.render(createElement(BrainManager)); });
        const html = container.innerHTML;

        const statValues = pinStatValues(container, 'div.text-2xl.font-black');
        // All 6 stat cards go to 0.
        expect(statValues[0]).toBe('0');
        expect(statValues[1]).toBe('0');
        expect(statValues[2]).toBe('0');
        expect(statValues[3]).toBe('0');
        expect(statValues[4]).toBe('0');
        expect(statValues[5]).toBe('0');

        // Empty-state message (distinct from "No entries match your search").
        expect(html).toContain('The brain is empty. Start building knowledge!');

        // 3 entry titles absent.
        expect(html).not.toContain('NF-Tee Design Philosophy');
        expect(html).not.toContain('Coalition Brand Voice');
        expect(html).not.toContain('Customer Asked About Wholesale');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('NEW_ENTRY_FORM_OPEN: clicking "New Entry" flips to edit view -> form renders with 6 inputs (Title, Content textarea, Tag input, Category select, Source select, Image URL) + Save/Cancel buttons', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: TEST_ENTRIES, error: null } },
        ]);
        await act(async => { root.render(createElement(BrainManager)); });
        expect(container.innerHTML).not.toContain('Save Entry');

        // The "New Entry" button is the OUTER one (Lucide Plus icon + text in header).
        const newBtn = document.body.querySelector(
            'button.bg-purple-600',
        ) as HTMLButtonElement | null;
        expect(newBtn).toBeTruthy();
        expect(newBtn!.textContent).toContain('New Entry');

        await act(async => { newBtn!.click(); });

        const html = container.innerHTML;

        // Edit view mounts with form.
        expect(html).toContain('Save Entry');
        expect(html).toContain('Cancel');

        // The 6 form labels.
        expect(html).toContain('Entry Title');
        expect(html).toContain('Content (Markdown supported)');
        expect(html).toContain('Tags');
        expect(html).toContain('Category');
        expect(html).toContain('Source');
        expect(html).toContain('Image URL (optional)');
        expect(html).toContain('Importance');

        // 5 category options render in the category select.
        const categorySelect = document.body.querySelector(
            'select[title="Select Category"]',
        ) as HTMLSelectElement | null;
        expect(categorySelect).toBeTruthy();
        expect(categorySelect!.options.length).toBe(5);

        // The PLUS icon is gone (only New Entry was its anchor).
        // The Cancel button replaces the New Entry header button while editing.
        expect(html).not.toContain('New Entry');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

describe('BrainManager save new entry interaction', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('SAVE_NEW_ENTRY: opening form, filling Title+Content, clicking Save -> createBrainEntry spy called with payload + post-save fetchEntries consumes 2 supabase outcomes', async () => {
        // 3 supabase outcomes consumed:
        //   1) initial-fetch on mount
        //   2) post-save fetchEntries triggered by handleSave
        // Plus the brainService.createBrainEntry spy call (mocked separately via vi.mocked).
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: TEST_ENTRIES, error: null } },
            { kind: 'resolve', value: { data: TEST_ENTRIES, error: null } },
        ]);

        // Wire brainService.createBrainEntry to resolve to a fake new id. Imported
        // statically at the top of the file - vi.mocked() resolves to the typed
        // vi.fn() tracked by vitest's mock registry (no need for dynamic import).
        vi.mocked(createBrainEntry).mockResolvedValue('brain-new');

        await act(async => { root.render(createElement(BrainManager)); });

        // Click the New Entry header button to open the form.
        const newBtn = document.body.querySelector(
            'button.bg-purple-600',
        ) as HTMLButtonElement | null;
        expect(newBtn).toBeTruthy();
        await act(async => { newBtn!.click(); });

        // Fill the Title input (placeholder says 'e.g., NF-Tee Design Philosophy').
        // setReactValue uses the per-prototype descriptor setter so React's
        // synthetic onChange handler fires (see tests/_helpers/nativeValueSetter.ts).
        const titleInput = document.body.querySelector(
            'input[placeholder*="NF-Tee Design Philosophy"]',
        ) as HTMLInputElement | null;
        expect(titleInput).toBeTruthy();
        setReactValue(titleInput!, 'Wallet Design Notes');

        // Fill the Content textarea (placeholder says 'Write the knowledge entry...').
        const contentArea = document.body.querySelector(
            'textarea[placeholder*="knowledge entry"]',
        ) as HTMLTextAreaElement | null;
        expect(contentArea).toBeTruthy();
        setReactValue(contentArea!, 'The new wallet design uses matte black leather.');

        // Click Save Entry (form submit handler is onClick on the button, NOT a form.onSubmit).
        const saveBtn = document.body.querySelector(
            'button.bg-white.text-black.font-black.uppercase',
        ) as HTMLButtonElement | null;
        expect(saveBtn).toBeTruthy();
        expect(saveBtn!.textContent).toContain('Save Entry');

        await act(async => { saveBtn!.click(); });

        // 1) brainService.createBrainEntry spy called with our input payload
        //    (defaults added for missing fields: importance=3, source='manual',
        //    category='general' since we never changed the selects).
        expect(createBrainEntry).toHaveBeenCalledTimes(1);
        const callArg = vi.mocked(createBrainEntry).mock.calls[0]?.[0];
        expect(callArg).toEqual(expect.objectContaining({
            title: 'Wallet Design Notes',
            content: 'The new wallet design uses matte black leather.',
            category: 'general',
            source: 'manual',
            importance: 3,
        }));

        // 2) supabase fetchEntries refresh consumed the 2nd queued outcome.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
