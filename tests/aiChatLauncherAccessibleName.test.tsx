// tests/aiChatLauncherAccessibleName.test.tsx
//
// GUARD: the floating support launcher is an icon button whose visible copy is
// a hover tooltip. Before this test the tooltip node was its only name, so the
// button was announced as "💬 Need Help? AI-Powered Support" — copy written to
// sell the feature, with an emoji, and only present because the tooltip is
// always in the DOM.
//
// Rule: the name is explicit (aria-label) and independent of the tooltip, and
// the tooltip is decorative to assistive tech because its words are already in
// the name. The second test proves the independence by deleting the tooltip
// from the rendered tree and re-reading the name.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    appContextStub,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';
import { accessibleName, controlsWithoutName } from './_helpers/accessibleName';

vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

// The widget reaches the AI API on mount. Stubbing it keeps this mount offline
// and deterministic: only the rendered launcher is under test.
const services = vi.hoisted(() => ({
    getWelcomeMessage: vi.fn(() => 'Welcome to Coalition Support.'),
    sendChatMessage: vi.fn(),
    verifyFullAIPassword: vi.fn(),
}));

vi.mock('../services/aiChat', () => ({
    getWelcomeMessage: services.getWelcomeMessage,
    sendChatMessage: services.sendChatMessage,
    verifyFullAIPassword: services.verifyFullAIPassword,
}));

const LAUNCHER_NAME = 'Open Coalition AI support chat';
const loadAIChatWidget = () => import('../components/AIChatWidget');

const flatText = (element: Element): string =>
    (element.textContent || '').replace(/\s+/g, ' ').trim();

beforeEach(() => {
    // The widget scrolls its message list on mount; jsdom has no layout.
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = vi.fn();
});

describe('AIChatWidget floating launcher accessible name', () => {
    it('names the closed widget’s launcher explicitly', async () => {
        const { container } = await renderAdminSurface(loadAIChatWidget);

        const buttons = [...container.querySelectorAll('button')];
        // Closed widget: the launcher is the only button in the tree, so this
        // cannot accidentally read a control inside the chat window.
        expect(buttons).toHaveLength(1);

        const launcher = buttons[0];
        expect(launcher.getAttribute('aria-label')).toBe(LAUNCHER_NAME);
        expect(accessibleName(launcher)).toBe(LAUNCHER_NAME);
        expect(controlsWithoutName(container)).toEqual([]);

        // The tooltip copy is still rendered for sighted users, but out of the
        // name (and out of browse mode, since the name already says it).
        const tooltip = [...launcher.children].find((child) =>
            flatText(child).includes('Need Help'),
        );
        expect(tooltip, 'the hover tooltip copy disappeared').toBeTruthy();
        expect(flatText(tooltip!)).toContain('AI-Powered Support');
        expect(tooltip!.getAttribute('aria-hidden')).toBe('true');
        expect(accessibleName(launcher)).not.toContain('Need Help');
    });

    it('keeps its name when the tooltip is not in the tree', async () => {
        const { container } = await renderAdminSurface(loadAIChatWidget);

        const launcher = container.querySelector('button');
        expect(launcher).toBeTruthy();

        const tooltip = [...launcher!.children].find((child) =>
            flatText(child).includes('Need Help'),
        );
        expect(tooltip, 'the hover tooltip copy disappeared').toBeTruthy();
        tooltip!.remove();

        // A name taken from contents would now be the pulse dot's (empty) text;
        // an explicit label is unaffected.
        expect(accessibleName(launcher!)).toBe(LAUNCHER_NAME);
    });
});
