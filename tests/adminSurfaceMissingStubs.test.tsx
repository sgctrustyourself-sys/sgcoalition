// tests/adminSurfaceMissingStubs.test.tsx
//
// The negative path of tests/_helpers/adminSurface.tsx, and the reason the
// harness is worth having rather than merely convenient.
//
// This file deliberately omits the two `vi.doMock` lines every other admin
// test file carries. What is being pinned is the consequence: the harness
// refuses to mount instead of letting React report "useToast must be used
// within a ToastProvider" from inside the component — the message that sent
// two admin tests hunting through AdminLayout for a bug that was in the test
// file. The assertion checks the remedy is in the error, because an error that
// only says "something is missing" is what we are replacing.
//
// The surface (AdminLayout) is passed as a loader like everywhere else; this
// file is about the missing stubs, not about a missing loader.

import { describe, it, expect } from 'vitest';

import { renderAdminSurface } from './_helpers/adminSurface';

describe('adminSurface harness without the context stubs', () => {
    it('refuses to mount and names the two lines to add', async () => {
        const failure = await renderAdminSurface(() => import('../components/admin/AdminLayout'), {
            initialEntries: ['/admin'],
            props: { activeTab: 'orders', children: null },
        }).then(
            () => null,
            (error: Error) => error,
        );

        expect(failure).toBeInstanceOf(Error);
        const message = failure?.message ?? '';
        expect(message).toContain('the AppContext/ToastContext stubs are not installed');
        // The remedy has to be pasteable, not a pointer to documentation.
        expect(message).toContain("vi.doMock('../context/AppContext', appContextStub);");
        expect(message).toContain("vi.doMock('../context/ToastContext', toastContextStub);");
        // Nothing was mounted on the way out.
        expect(document.body.childElementCount).toBe(0);
    });
});
