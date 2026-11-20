// tests/contextDialogAccessibleName.test.tsx
//
// Runtime half of the accessible-name guard for the three dialogs that no
// rendered-surface test reached before: they live behind context-heavy shells
// (AIChatWidget, AccountLinking) or need a File and an object URL
// (ImageCropperModal), so only the source-level guard
// (tests/iconControlName.test.ts and tests/modalOverlayFocusTrapCoverage.test.ts)
// covered them.
//
// Each test proves no dialog is in the tree first, then opens the surface the
// way a user does. That order matters: a dialog that is only named in source
// can still render unnamed — a label built from a possibly-empty prop, a name
// that never reaches the open state, a conditional dialog that mounts before
// its label is available.
//
// Name computation is shared with the other dialog tests through
// tests/_helpers/accessibleName.ts (aria-labelledby references first, then
// aria-label). Where a visible heading exists, the test also asserts the
// heading TEXT is not mistaken for the name.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';
import { accessibleName, dialogNames, dialogsNamed } from './_helpers/accessibleName';

// Vitest scopes module mocks per test file, so the two context stubs are
// registered here and every surface arrives as a loader (see the harness).
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

// The chat widget reaches the AI API and the linking panel reaches Supabase on
// mount. Stubbing both keeps these mounts offline and deterministic: only the
// rendered dialog names are under test.
const services = vi.hoisted(() => ({
    getWelcomeMessage: vi.fn(() => 'Welcome to Coalition Support.'),
    sendChatMessage: vi.fn(),
    verifyFullAIPassword: vi.fn(),
    getLinkedAccount: vi.fn(),
    linkWalletToExistingAccount: vi.fn(),
    createAccountAndLinkWallet: vi.fn(),
    unlinkWallet: vi.fn(),
}));

vi.mock('../services/aiChat', () => ({
    getWelcomeMessage: services.getWelcomeMessage,
    sendChatMessage: services.sendChatMessage,
    verifyFullAIPassword: services.verifyFullAIPassword,
}));

vi.mock('../services/accountLinking', () => ({
    getLinkedAccount: services.getLinkedAccount,
    linkWalletToExistingAccount: services.linkWalletToExistingAccount,
    createAccountAndLinkWallet: services.createAccountAndLinkWallet,
    unlinkWallet: services.unlinkWallet,
}));

const loadAIChatWidget = () => import('../components/AIChatWidget');
const loadAccountLinking = () => import('../components/AccountLinking');
const loadImageCropperModal = () => import('../components/ui/ImageCropperModal');

/** Click a button whose rendered text is exactly `text`. */
const clickButton = async (host: ParentNode, text: string): Promise<void> => {
    const match = [...host.querySelectorAll('button')].find(
        (button) => (button.textContent || '').replace(/\s+/g, ' ').trim() === text,
    );
    expect(match, `no button labelled "${text}"`).toBeTruthy();
    await act(async () => {
        (match as HTMLButtonElement).click();
    });
};

const clickElement = async (element: Element | null, description: string): Promise<void> => {
    expect(element, description).toBeTruthy();
    await act(async () => {
        (element as HTMLElement).click();
    });
};

beforeEach(() => {
    services.getLinkedAccount.mockResolvedValue(null);
    // jsdom has neither of these: the widget scrolls its message list and the
    // cropper turns the File into an object URL.
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:test-image');
    URL.revokeObjectURL = vi.fn();
});

describe('AIChatWidget password dialog accessible name', () => {
    it('names the unlock dialog only after Open Full AI Portal is used', async () => {
        const { container } = await renderAdminSurface(loadAIChatWidget);

        expect(dialogNames(container)).toEqual([]);

        // Closed widget: the floating launcher is the only button in the tree.
        await clickElement(container.querySelector('button'), 'no floating chat launcher');

        // The chat window itself is a region of the page, not a dialog.
        expect(dialogNames(container)).toEqual([]);

        await clickButton(container, 'Open Full AI Portal');

        expect(dialogsNamed(container, 'Open AI portal')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Open AI portal']);
        // The heading is the visible title, but the label that names the dialog
        // is the aria-label — pinning this keeps a later heading change from
        // silently redefining the name.
        expect(dialogsNamed(container, 'Open AI Portal')).toHaveLength(0);
    });
});

describe('AccountLinking dialogs accessible names', () => {
    const WALLET_USER = {
        uid: 'user_eth_test',
        walletAddress: '0x1111111111111111111111111111111111111111',
    };

    const mockWalletUser = (): void => {
        mockAppContext({
            user: WALLET_USER,
            linkSocialAccount: vi.fn(),
            unlinkSocialAccount: vi.fn(),
        } as never);
    };

    it('names the email dialog only while Link Email Account has it open', async () => {
        mockWalletUser();
        const { container } = await renderAdminSurface(loadAccountLinking);

        expect(dialogNames(container)).toEqual([]);

        await clickButton(container, 'Link Email Account');

        expect(dialogsNamed(container, 'Link email account')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Link email account']);

        // Cancel closes it, so the name cannot linger from a previous mount.
        await clickButton(container, 'Cancel');
        expect(dialogNames(container)).toEqual([]);
    });

    it('names the Instagram dialog only while Link Instagram Account has it open', async () => {
        mockWalletUser();
        const { container } = await renderAdminSurface(loadAccountLinking);

        expect(dialogNames(container)).toEqual([]);

        await clickButton(container, 'Link Instagram Account');

        expect(dialogsNamed(container, 'Link Instagram account')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Link Instagram account']);
        // The step link keeps the dialog's own text out of its name.
        expect(dialogsNamed(container, 'Link Instagram Account')).toHaveLength(0);
    });
});

describe('ImageCropperModal accessible name', () => {
    const FILE = new File(['pixels'], 'photo.png', { type: 'image/png' });

    it('takes its name from the title prop, not from a hardcoded string', async () => {
        const { container } = await renderAdminSurface(loadImageCropperModal, {
            props: { file: FILE, open: true, onCancel: vi.fn(), onConfirm: vi.fn() },
        });

        expect(dialogsNamed(container, 'Crop Image')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Crop Image']);

        const close = container.querySelector('button[aria-label="Close cropper"]');
        expect(close).toBeTruthy();
        expect(accessibleName(close!)).toBe('Close cropper');
    });

    it('follows a custom title and stays unnamed when closed', async () => {
        const closed = await renderAdminSurface(loadImageCropperModal, {
            props: {
                file: FILE,
                open: false,
                title: 'Crop Wallet Photos',
                onCancel: vi.fn(),
                onConfirm: vi.fn(),
            },
        });
        expect(dialogNames(closed.container)).toEqual([]);

        const open = await renderAdminSurface(loadImageCropperModal, {
            props: {
                file: FILE,
                open: true,
                title: 'Crop Wallet Photos',
                onCancel: vi.fn(),
                onConfirm: vi.fn(),
            },
        });

        expect(dialogsNamed(open.container, 'Crop Wallet Photos')).toHaveLength(1);
        expect(dialogNames(open.container)).toEqual(['Crop Wallet Photos']);
        expect(dialogsNamed(open.container, 'Crop Image')).toHaveLength(0);
    });
});

afterEach(() => {
    vi.clearAllMocks();
});
