// tests/trustCirclePage.test.tsx
//
// REGRESSION CATCH for pages/TrustCircle.tsx — the brand-voice application
// form for the Trust Circle.
//
// Replicates the createRoot + act + explicit-DOM-assertions pattern. Two
// contracts:
//   1. FORM_SUBMIT: the form renders, submitApplication is called with the
//      entered values, and the "Application received" confirmation shows.
//   2. PENDING_GUARD: a user with an existing pending application sees the
//      "already under review" state instead of the form.
//
// Mock surface:
//   - ../context/AppContext -> useApp vi.fn() (stable user object per test)
//   - ../context/ToastContext -> no-op
//   - ../services/trustCircle -> getMyApplication + submitApplication stubbed;
//     the real module's types/constants are preserved via importOriginal.
//
// The page uses <Link>, so renders are wrapped in <MemoryRouter>.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock('../services/trustCircle', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/trustCircle')>();
    return {
        ...actual,
        getMyApplication: vi.fn(async () => null),
        submitApplication: vi.fn(async () => ({ success: true })),
    };
});

// Static imports below the vi.mock block (established hoisting pattern).
import { MemoryRouter } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TrustCircle from '../pages/TrustCircle';
import { getMyApplication, submitApplication } from '../services/trustCircle';

const MOCK_USER = { uid: 'u1', displayName: 'Tester' };

describe('TrustCircle application page', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useApp).mockReturnValue({ user: MOCK_USER } as any);
        vi.mocked(getMyApplication).mockResolvedValue(null);
        vi.mocked(submitApplication).mockResolvedValue({ success: true });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('FORM_SUBMIT: renders the brand-voice form, submits, shows confirmation', async () => {
        await act(async () => {
            root.render(createElement(MemoryRouter, null, createElement(TrustCircle)));
        });
        const html0 = container.innerHTML;
        expect(html0).toContain('Join the Trust Circle');
        expect(html0).toContain('Why do you want in?');

        // Fill the two required fields + one handle, then submit.
        await act(async () => {
            const whyJoin = document.body.querySelector('#whyJoin') as HTMLTextAreaElement | null;
            const whatCreate = document.body.querySelector('#whatYouCreate') as HTMLTextAreaElement | null;
            const insta = document.body.querySelector('#instagram') as HTMLInputElement | null;
            expect(whyJoin).toBeTruthy();
            expect(whatCreate).toBeTruthy();
            expect(insta).toBeTruthy();

            const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype, 'value',
            )!.set!;
            setter.call(whyJoin, 'I rep the city');
            whyJoin!.dispatchEvent(new Event('input', { bubbles: true }));
            setter.call(whatCreate, 'Fit content');
            whatCreate!.dispatchEvent(new Event('input', { bubbles: true }));

            const inputSetter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype, 'value',
            )!.set!;
            inputSetter.call(insta, '@sg_rep');
            insta!.dispatchEvent(new Event('input', { bubbles: true }));
        });

        await act(async () => {
            const submitBtn = Array.from(document.body.querySelectorAll('button')).find(
                (b) => (b.textContent || '').toUpperCase().includes('SUBMIT APPLICATION'),
            );
            expect(submitBtn).toBeTruthy();
            submitBtn!.click();
        });

        // Confirmation state.
        expect(container.innerHTML).toContain('Application received');

        // submitApplication was called with the entered values + user id.
        expect(submitApplication).toHaveBeenCalledTimes(1);
        const [payload, uid] = vi.mocked(submitApplication).mock.calls[0]!;
        expect(uid).toBe('u1');
        expect(payload.whyJoin).toBe('I rep the city');
        expect(payload.whatYouCreate).toBe('Fit content');
        expect(payload.handles.instagram).toBe('@sg_rep');
        expect(payload.platforms).toEqual(['instagram']);
    });

    it('PENDING_GUARD: existing pending application shows "already under review"', async () => {
        vi.mocked(getMyApplication).mockResolvedValue({
            id: 'app-1',
            user_id: 'u1',
            status: 'pending',
            why_join: 'x',
            what_you_create: 'y',
            platforms: ['instagram'],
            handles: {},
            audience_size: null,
            portfolio_url: null,
            created_at: '2026-08-01T00:00:00Z',
            reviewed_at: null,
            reviewed_by: null,
            review_note: null,
        } as any);

        await act(async () => {
            root.render(createElement(MemoryRouter, null, createElement(TrustCircle)));
        });
        const html = container.innerHTML;

        expect(html).toContain('already under review');
        expect(html).not.toContain('Why do you want in?');
        // The form must NOT have been submitted.
        expect(submitApplication).not.toHaveBeenCalled();
    });
});
