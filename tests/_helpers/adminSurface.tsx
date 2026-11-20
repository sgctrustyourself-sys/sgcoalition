// tests/_helpers/adminSurface.tsx
//
// Shared mount harness for the admin render/flow tests.
//
// WHY THIS EXISTS
// ---------------
// Admin surfaces read two contexts: `useApp()` (context/AppContext) and
// `useToast()` (context/ToastContext). AppContext's real provider boots
// Supabase, auth, the catalog and the cart, so tests stub `useApp`;
// ToastContext is stubbed only because these components call `useToast()`
// outside a provider and the real hook throws.
//
// Two admin tests broke the day AdminLayout started calling `useToast()`:
// both rendered `pages/Admin` with an AppContext stub and no ToastContext
// stub, so the mount threw "useToast must be used within a ToastProvider" —
// a message that points at the component, not at the stub that was missing.
// Every other admin test then re-declared the same factory shapes, the same
// MOCK_USER, the same container/root create-and-unmount pair and the same
// `afterEach` teardown.
//
// THE ONE THING VITEST WILL NOT LET THIS FILE DO
// ----------------------------------------------
// This harness cannot register the stubs for you. Vitest binds module mocking
// to the module context of the file that calls it: `vi.mock`/`vi.doMock` in
// this file is a silent no-op for the test file that imports it. That was
// measured, not assumed — a helper-origin `vi.doMock` + dynamic import
// resolved the REAL contexts, while the same call written in the test file
// resolved the stubs. So the test file supplies exactly two lines, and this
// harness supplies everything else.
//
// USAGE
// -----
//   import { appContextStub, mockAppContext, renderAdminSurface, toastContextStub } from './_helpers/adminSurface';
//
//   // Once, at the top of the test file's body — not inside a test.
//   vi.doMock('../context/AppContext', appContextStub);
//   vi.doMock('../context/ToastContext', toastContextStub);
//
//   it('renders the orders tab', async () => {
//       const { container } = await renderAdminSurface(() => import('../pages/Admin'), {
//           initialEntries: ['/admin?tab=orders'],
//       });
//       expect(container.innerHTML).toContain('orders-body');
//   });
//
//   it('reports the failure with an error toast', async () => {
//       mockAppContext({ orders: [orderFixture] });
//       await renderAdminSurface(() => import('../components/admin/OrderManager'));
//       expect(addToast).toHaveBeenCalledWith('…', 'error');
//   });
//
// `vi.doMock` (not `vi.mock`) is the right half of that pair: it applies to the
// next import of the module, which is the loader's.
//
// The surface must arrive as a LOADER — `() => import('...')` — because a
// static `import Admin from '../pages/Admin'` is evaluated while the test
// file's imports run, before the file body reaches those two lines. If the
// stubs are missing, `renderAdminSurface` refuses to mount and tells you the
// two lines to add, rather than letting React report a missing provider.
//
// WHAT THE DEFAULTS ARE (AND ARE NOT)
// -----------------------------------
// `mockAppContext()` installs the baseline a mount needs and nothing more: a
// signed-in admin, the three collections admin surfaces read on first paint
// (empty), and a no-op `logoutAdmin`. Everything else is deliberately absent:
// a test that needs `isSupabaseConfigured`, a mutation or a fixture passes it
// to `mockAppContext`, and a component that then crashes on an absent field is
// telling the truth about what the test forgot to provide. `setAdminUser` is
// the sugar for the single most common override.

import { act, createElement, Fragment, type ComponentType, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import type { useApp } from '../../context/AppContext';

/** The shape `useApp()` returns, borrowed from the real hook's signature. */
export type AdminAppValue = ReturnType<typeof useApp>;

// React's act() reads this global; without it every render logs "The current
// testing environment is not configured to support act(...)" to stderr. The
// admin tests used to mute that with a console.error spy — configuring the
// environment is the honest fix and it keeps a genuine error visible.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const spies = {
    useApp: vi.fn(),
    addToast: vi.fn(),
    removeToast: vi.fn(),
};

/**
 * Module stub for context/AppContext:
 * `vi.doMock('../context/AppContext', appContextStub)`.
 *
 * `useApp` is the `useAppMock` spy itself, so `mockAppContext` configures
 * exactly the function the component calls.
 */
export const appContextStub = () => ({ useApp: spies.useApp });

/**
 * Module stub for context/ToastContext:
 * `vi.doMock('../context/ToastContext', toastContextStub)`.
 *
 * `useToast` is a plain function on purpose: several tests call
 * `vi.restoreAllMocks()` in their own teardown, and a `vi.fn()` here could be
 * reset to a no-op underneath a mounted surface. The spies are the sinks.
 */
export const toastContextStub = () => ({
    useToast: () => ({
        addToast: spies.addToast,
        removeToast: spies.removeToast,
        toasts: [],
    }),
});

/** Raw `useApp` stub, for assertions and for anything `mockAppContext` can't express. */
export const useAppMock = spies.useApp;

/** Toast sink the mounted surface reports through. Shared by every test in the file. */
export const addToast = spies.addToast;

/** Dismissal sink, so a surface that clears a toast finds a function. */
export const removeToast = spies.removeToast;

/** The signed-in admin the baseline value carries. */
export const DEFAULT_ADMIN_USER = { uid: 'admin-test-user', walletAddress: '0xabc' };

/**
 * Whether `useApp` still has a value to hand back.
 *
 * Read off the mock rather than tracked in a flag: a test file that calls
 * `vi.resetAllMocks()` or `vi.restoreAllMocks()` in its own hooks wipes the
 * return value, and a flag would then lie — the surface would mount against a
 * `useApp()` that returns undefined.
 */
const appValueIsInstalled = (): boolean => spies.useApp.getMockImplementation() !== undefined;

/**
 * Replace `useApp()`'s return value for the current test.
 *
 * The merge is deliberately shallow and the cast deliberate too: admin
 * surfaces read a handful of the ~60 fields on the real value, and demanding a
 * complete one would make every fixture a lie.
 */
export function mockAppContext(overrides: Partial<AdminAppValue> = {}): void {
    spies.useApp.mockReturnValue({
        user: DEFAULT_ADMIN_USER,
        orders: [],
        products: [],
        giveaways: [],
        logoutAdmin: vi.fn(),
        ...overrides,
    } as unknown as AdminAppValue);
}

/**
 * Point the stubbed `useApp()` at another admin. `object` rather than a
 * `Partial<UserProfile>` because a test's minimal fixture (`{ uid }`) is the
 * normal case and the fields it omits are unread by the surface under test.
 */
export function setAdminUser(user: object = DEFAULT_ADMIN_USER): void {
    mockAppContext({ user: user as unknown as AdminAppValue['user'] });
}

export interface AdminSurfaceOptions<P extends object> {
    /** Initial history for the MemoryRouter the surface is mounted inside. */
    initialEntries?: string[];
    /** Props for the surface, typed from the loader's own component. */
    props?: P;
    /**
     * Extra nodes rendered inside the router and before the surface — the
     * probe pattern (`pages/Admin` tests read the location this way).
     */
    prepend?: ReactNode;
}

export interface AdminSurface {
    container: HTMLDivElement;
    root: Root;
    unmount: () => void;
}

let liveSurface: { container: HTMLDivElement; root: Root } | null = null;

/** Tear down the current surface, if any. Safe to call when nothing is mounted. */
export function unmountAdminSurface(): void {
    if (!liveSurface) return;
    const { container, root } = liveSurface;
    liveSurface = null;
    act(() => {
        root.unmount();
    });
    if (container.parentNode === document.body) document.body.removeChild(container);
}

const MISSING_STUBS = [
    'renderAdminSurface: the AppContext/ToastContext stubs are not installed.',
    '',
    'Vitest scopes module mocks to the test file that calls them, so this harness cannot',
    'register them for the file that imports it. Add these two lines to the test file\'s',
    'body (module scope, not inside a test) and pass the surface as a loader:',
    '',
    "    import { appContextStub, mockAppContext, renderAdminSurface, toastContextStub } from './_helpers/adminSurface';",
    "    vi.doMock('../context/AppContext', appContextStub);",
    "    vi.doMock('../context/ToastContext', toastContextStub);",
].join('\n');

/**
 * Refuse to mount against the real contexts.
 *
 * Without this the failure surfaces as React reporting a missing provider from
 * inside the component — the message that sent two admin tests on a hunt
 * through AdminLayout for a bug that was in the test file.
 */
async function assertContextsAreStubbed(): Promise<void> {
    const app = await import('../../context/AppContext');
    if (vi.isMockFunction(app.useApp)) return;
    throw new Error(MISSING_STUBS);
}

/**
 * Mount an admin surface with both contexts stubbed.
 *
 * The loader is called here — after the test file's `vi.doMock` lines ran and
 * after the baseline value was installed — so the surface and everything it
 * imports resolve against the stubs no matter how the test file ordered its
 * other imports.
 *
 * One surface per test: a second call unmounts the first, so a test that
 * re-renders cannot leave a stray tree in `document.body` for the next one.
 */
export async function renderAdminSurface<P extends object>(
    load: () => Promise<{ default: ComponentType<P> }>,
    options: AdminSurfaceOptions<P> = {},
): Promise<AdminSurface> {
    unmountAdminSurface();
    await assertContextsAreStubbed();
    if (!appValueIsInstalled()) mockAppContext();

    const { default: Surface } = await load();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    liveSurface = { container, root };

    const tree = createElement(
        MemoryRouter,
        { initialEntries: options.initialEntries ?? ['/'] },
        options.prepend
            ? createElement(Fragment, null, options.prepend, createElement(Surface, options.props))
            : createElement(Surface, options.props),
    );

    try {
        await act(async () => {
            root.render(tree);
        });
        // Lazy chunks (React.lazy backs every tab in pages/Admin, and most
        // managers load their own data) resolve on a later microtask; let
        // Suspense settle before the test asserts.
        await act(async () => {});
    } catch (error) {
        unmountAdminSurface();
        const original = error instanceof Error ? error.message : String(error);
        throw new Error(
            `${original}\n\nrenderAdminSurface: the surface threw while mounting. If the message above reports a `
            + 'missing provider, the surface reached the real context through some earlier import — pass it as a '
            + "loader (`() => import('...')`) and keep the context stubs above.",
            { cause: error },
        );
    }

    return { container, root, unmount: unmountAdminSurface };
}

// Auto-cleanup, the @testing-library pattern: registered once per test file
// when this module is first imported (imports evaluate before the test file's
// body, so the hook lands in that file's root suite). Teardown resets the
// stubs as well, so a fixture one test configured is not still installed for
// the next.
afterEach(() => {
    unmountAdminSurface();
    spies.addToast.mockClear();
    spies.removeToast.mockClear();
    mockAppContext();
});
