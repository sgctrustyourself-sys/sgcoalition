// tests/chromeAccessibleName.test.tsx
//
// Runtime half of the accessible-name guard for the chrome that sits outside
// every dialog: the navbar, the footer, and the two share surfaces
// (SocialShare's icon row and WishlistShare's panel).
//
// tests/iconControlName.test.ts proves statically that each of those controls
// declares a name. This file mounts them and asks the rendered DOM for the name
// a screen reader would announce, which catches what source cannot: a control
// that only *looks* named because a badge number or an icon label leaked into
// its contents, a name that comes from aria-hidden text, or a link whose label
// is built from an empty string.
//
// Two assertions per surface:
//
//   1. the sweep — no rendered button or link has an empty accessible name,
//   2. spot checks — the controls that carry meaning (cart, menu toggle, the
//      sharing link) resolve to the exact announced name, so a rename cannot
//      pass silently.
//
// Name computation (labelledby, aria-label, contents, title) is shared with the
// dialog tests through tests/_helpers/accessibleName.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';
import {
    accessibleName,
    controlByText,
    controlsWithoutName,
} from './_helpers/accessibleName';
import { MAIN_SHARING_LABEL } from '../utils/sharingLinks';

vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const loadNavbar = () => import('../components/Navbar');
const loadFooter = () => import('../components/Footer');
const loadSocialShare = () => import('../components/SocialShare');
const loadWishlistShare = () => import('../components/WishlistShare');

const SHARE_LINK_NAME = `Portfolio and all links (opens ${MAIN_SHARING_LABEL})`;

const CLICKABLE = 'button, a';

const mount = async <P extends object>(
    load: () => Promise<{ default: import('react').ComponentType<P> }>,
    props?: P,
) => renderAdminSurface(load, { props });

const clickElement = async (element: Element | null, description: string): Promise<void> => {
    expect(element, description).toBeTruthy();
    await act(async () => {
        (element as HTMLElement).click();
    });
};

/** Fail with the offending markup, so the fix is obvious from the report. */
const expectNoUnnamedControls = (host: ParentNode): void => {
    const offenders = controlsWithoutName(host);
    expect(
        offenders,
        'Controls rendered with no accessible name:\n' +
            offenders.map((entry) => `<${entry.tag}> ${entry.html}`).join('\n'),
    ).toEqual([]);
};

const nameOf = (host: ParentNode, text: string): string =>
    accessibleName(controlByText(host, text));

const buttonByLabel = (host: ParentNode, label: string): HTMLButtonElement => {
    const match = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    expect(match, `no button with aria-label="${label}"`).toBeTruthy();
    return match!;
};

/** Both cart launchers, found by the tooltip so the label is not assumed. */
const cartLaunchers = (host: ParentNode): HTMLButtonElement[] => {
    const found = [...host.querySelectorAll<HTMLButtonElement>('button[title="Open Cart"]')];
    expect(found.length, 'expected the desktop and mobile cart launchers').toBeGreaterThan(0);
    return found;
};

beforeEach(() => {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = vi.fn();
});

describe('Navbar control names', () => {
    const guestNavbar = (): void => {
        mockAppContext({
            user: null,
            cart: [],
            setCartOpen: vi.fn(),
            logout: vi.fn(),
            isAdminMode: false,
            logoutAdmin: vi.fn(),
        } as never);
    };

    it('announces a name for every link and button as a guest', async () => {
        guestNavbar();
        const { container } = await mount(loadNavbar);

        expectNoUnnamedControls(container);

        expect(nameOf(container, 'COALITION')).toBe('COALITION');
        expect(nameOf(container, 'HOME')).toBe('HOME');
        expect(nameOf(container, 'RESOURCES')).toBe('RESOURCES');
        expect(nameOf(container, 'LOGIN')).toBe('LOGIN');

        // The two icon-only controls name themselves through aria-label/title.
        // With nothing in the cart there is no count to append.
        for (const cart of cartLaunchers(container)) {
            expect(accessibleName(cart)).toBe('Open Cart');
        }
        const mobileToggle = container.querySelector('button[title="Toggle Menu"]');
        expect(mobileToggle).toBeTruthy();
        expect(accessibleName(mobileToggle!)).toBe('Toggle Menu');
    });

    it('announces the badge count inside the cart name', async () => {
        mockAppContext({
            user: null,
            cart: [{ id: 'p1', quantity: 3 }],
            setCartOpen: vi.fn(),
            logout: vi.fn(),
            isAdminMode: false,
            logoutAdmin: vi.fn(),
        } as never);
        const { container } = await mount(loadNavbar);

        // Two launchers (desktop row + mobile row) render the same badge. The
        // count is part of the name — "Open Cart, 3 items" says what the control
        // does and how many items are in it — while the badge itself is hidden
        // so the number is not announced twice in browse mode.
        const cartButtons = cartLaunchers(container);
        expect(cartButtons).toHaveLength(2);
        for (const button of cartButtons) {
            expect(accessibleName(button)).toBe('Open Cart, 3 items');
            const badge = button.querySelector('span');
            expect(badge?.textContent?.trim()).toBe('3');
            expect(badge?.getAttribute('aria-hidden')).toBe('true');
        }
        expect(container.textContent).toContain('3');
        expectNoUnnamedControls(container);
    });

    it('uses the singular for a one-item cart', async () => {
        mockAppContext({
            user: null,
            cart: [{ id: 'p1', quantity: 1 }],
            setCartOpen: vi.fn(),
            logout: vi.fn(),
            isAdminMode: false,
            logoutAdmin: vi.fn(),
        } as never);
        const { container } = await mount(loadNavbar);

        for (const button of cartLaunchers(container)) {
            expect(accessibleName(button)).toBe('Open Cart, 1 item');
        }
    });

    it('announces names inside the mobile menu once it is open', async () => {
        mockAppContext({
            user: null,
            cart: [],
            setCartOpen: vi.fn(),
            logout: vi.fn(),
            isAdminMode: false,
            logoutAdmin: vi.fn(),
        } as never);
        const { container } = await mount(loadNavbar);

        await clickElement(
            container.querySelector('button[title="Toggle Menu"]'),
            'no mobile menu toggle',
        );

        expectNoUnnamedControls(container);
        expect(nameOf(container, 'Login')).toBe('Login');
        expect(nameOf(container, 'Migrate to V2')).toBe('Migrate to V2');
        expect(nameOf(container, 'Help Center')).toBe('Help Center');
    });

    it('announces a name for the signed-in admin controls', async () => {
        mockAppContext({
            user: { uid: 'user_admin', walletAddress: '0xabc', sgCoinBalance: 10, v2Balance: 20 },
            cart: [],
            setCartOpen: vi.fn(),
            logout: vi.fn(),
            isAdminMode: true,
            logoutAdmin: vi.fn(),
        } as never);
        const { container } = await mount(loadNavbar);

        expectNoUnnamedControls(container);
        // Content wins over the title for a control that has visible text.
        expect(nameOf(container, 'Exit')).toBe('Exit');
        expect(accessibleName(controlByText(container, 'LOGOUT'))).toBe('LOGOUT');
    });
});

describe('Footer control names', () => {
    it('announces a name for every quick link and community link', async () => {
        mockAppContext({ isAdminMode: false } as never);
        const { container } = await mount(loadFooter);

        expectNoUnnamedControls(container);

        const sharingLinks = [...container.querySelectorAll(`a[aria-label="${SHARE_LINK_NAME}"]`)];
        expect(sharingLinks.length).toBeGreaterThan(0);
        for (const link of sharingLinks) {
            expect(accessibleName(link)).toBe(SHARE_LINK_NAME);
        }

        expect(nameOf(container, 'Instagram')).toBe('Instagram');
        expect(nameOf(container, 'Shop on Whop')).toBe('Shop on Whop');
        expect(nameOf(container, 'Join Discord')).toBe('Join Discord');
        expect(nameOf(container, 'Cookie Settings')).toBe('Cookie Settings');
        expect(nameOf(container, 'Contact Us')).toBe('Contact Us');
        expect(nameOf(container, 'Privacy Policy')).toBe('Privacy Policy');
    });
});

describe('SocialShare control names', () => {
    const props = {
        productName: 'Pink Silver Crop Top',
        productDescription: 'One of one, hand cut.',
        productImage: 'https://example.test/product.png',
        url: 'https://example.test/product/p1',
    };

    it('names each icon-only share button with its destination', async () => {
        const { container } = await mount(loadSocialShare, props);

        expectNoUnnamedControls(container);

        expect(accessibleName(buttonByLabel(container, 'Share on X (Twitter)'))).toBe(
            'Share on X (Twitter)',
        );
        expect(accessibleName(buttonByLabel(container, 'Share on Pinterest'))).toBe(
            'Share on Pinterest',
        );
        expect(accessibleName(buttonByLabel(container, 'Copy Link'))).toBe('Copy Link');
        expect(container.querySelectorAll(CLICKABLE)).toHaveLength(3);
    });
});

describe('WishlistShare control names', () => {
    it('names the trigger and every control in the share panel', async () => {
        const { container } = await mount(loadWishlistShare, { favoriteIds: ['p1', 'p2'] });

        expectNoUnnamedControls(container);
        expect(nameOf(container, 'Share Wishlist')).toBe('Share Wishlist');

        await clickElement(
            controlByText(container, 'Share Wishlist'),
            'no Share Wishlist trigger',
        );

        expectNoUnnamedControls(container);
        // The icon tiles carry a visible one-word label, which is their name.
        expect(nameOf(container, 'X')).toBe('X');
        expect(nameOf(container, 'Pinterest')).toBe('Pinterest');
        expect(nameOf(container, 'Facebook')).toBe('Facebook');
        expect(nameOf(container, 'Copy Link')).toBe('Copy Link');
        expect(accessibleName(buttonByLabel(container, 'Close modal'))).toBe('Close modal');
    });
});
