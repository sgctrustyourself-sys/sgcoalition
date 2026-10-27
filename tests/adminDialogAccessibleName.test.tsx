// tests/adminDialogAccessibleName.test.tsx
//
// RUNTIME half of the accessible-name guard.
//
// tests/modalOverlayFocusTrapCoverage.test.ts proves statically that every
// element with a modal role carries aria-label or an aria-labelledby whose ids
// exist in the same file. That check cannot prove three things a screen reader
// depends on:
//
//   1. the label survives rendering (conditional labels, props, template
//      strings), and
//   2. for aria-labelledby, the referenced heading is actually in the tree, and
//   3. the name comes from that heading's TEXT, not from the id itself.
//
// This file mounts the dialogs whose name only exists at render time — the
// ones that name themselves by reference (ConfirmationModal, Invoice,
// PaymentRecordModal), by a template string (CustomerLinkModal), or by a fixed
// label that the source guard cannot type-check (RefundExceptionModal,
// PhotoLightbox, SecurityModal) — and asks the rendered DOM for the dialog's
// accessible name. It also unit-tests the small name computation in
// tests/_helpers/accessibleName.ts, because a bug there would make every
// component assertion below meaningless.
//
// The admin overlays already mounted for the Escape/focus-return contract
// (SignalManager, OutreachTracker, MarketingManager, CustomInquiryManager and
// the three entry/proof sheets) assert the same role + name query inside
// tests/adminOverlayEscapeFocusReturn.test.tsx.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, type ComponentType } from 'react';
import { appContextStub, renderAdminSurface, toastContextStub } from './_helpers/adminSurface';
import { accessibleName, dialogNames, dialogsNamed } from './_helpers/accessibleName';

// The harness cannot register the contexts for us — vitest scopes module mocks
// to the file that calls them (see the harness header). Two lines, once per
// file, and the surfaces arrive as loaders so they resolve against them.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

// The dialogs below are read-only on mount, but three of them import write
// paths (proof upload, partial-payment replay, refund) and the customer lookup
// reaches Supabase. Stubbing them keeps the mount offline and makes the
// customer name fixture deterministic.
const services = vi.hoisted(() => ({
    validatePaymentProofFile: vi.fn(),
    uploadPaymentProof: vi.fn(),
    recordPartialPayment: vi.fn(),
    processRefund: vi.fn(),
    buildCustomerProfile: vi.fn(),
    buildCustomerProfileByEmail: vi.fn(),
}));

vi.mock('../services/paymentProofUpload', () => ({
    validatePaymentProofFile: services.validatePaymentProofFile,
    uploadPaymentProof: services.uploadPaymentProof,
}));
vi.mock('../services/reconcilePayment', () => ({
    recordPartialPayment: services.recordPartialPayment,
}));
vi.mock('../services/refunds', () => ({ processRefund: services.processRefund }));
vi.mock('../utils/customerProfile', () => ({
    buildCustomerProfile: services.buildCustomerProfile,
    buildCustomerProfileByEmail: services.buildCustomerProfileByEmail,
}));

const loadConfirmationModal = () => import('../components/admin/ConfirmationModal');
const loadInvoice = () => import('../components/Invoice');
const loadPaymentRecordModal = () => import('../components/admin/PaymentRecordModal');
const loadRefundExceptionModal = () => import('../components/admin/RefundExceptionModal');
const loadCustomerLinkModal = () => import('../components/admin/CustomerLinkModal');
const loadPhotoLightbox = () => import('../components/ui/PhotoLightbox');
const loadSecurityModal = () => import('../components/tutorial/SecurityModal');
const loadWizardDetailModal = () => import('../components/dashboard/WizardDetailModal');
const loadManualOrderForm = () => import('../components/ManualOrderForm');

let container: HTMLDivElement;

const mount = async <P extends object>(
    load: () => Promise<{ default: ComponentType<P> }>,
    props?: P,
) => {
    const surface = await renderAdminSurface(load, { props });
    container = surface.container;
    return surface;
};

const ORDER = {
    id: 'o-102',
    orderNumber: 'SG-102',
    userId: 'user-cara',
    customerName: 'Cara',
    customerEmail: 'cara@example.com',
    customerPhone: null,
    paymentMethod: 'paypal',
    paymentStatus: 'paid',
    orderType: 'online',
    subtotal: 200,
    tax: 0,
    discount: 0,
    total: 200,
    items: [
        {
            productName: 'Tee',
            productImage: '/t.png',
            selectedSize: 'S',
            quantity: 1,
            price: 200,
            total: 200,
        },
    ],
    createdAt: '2026-07-14T08:00:00Z',
    paidAt: '2026-07-14T09:00:00Z',
    shippingAddress: null,
    notes: null,
};

// ---------- name computation ----------

describe('accessibleName', () => {
    const hosts: HTMLDivElement[] = [];

    const fixture = (html: string): HTMLDivElement => {
        const host = document.createElement('div');
        host.innerHTML = html;
        document.body.appendChild(host);
        hosts.push(host);
        return host;
    };

    afterEach(() => {
        for (const host of hosts.splice(0)) host.remove();
    });

    it('reads labelledby headings in order, ahead of aria-label', () => {
        const host = fixture(
            '<h2 id="action">Delete order?</h2>' +
                '<h2 id="scope">This cannot be undone</h2>' +
                '<div role="dialog" aria-labelledby="action scope" aria-label="Fallback"></div>',
        );

        expect(accessibleName(host.querySelector('[role="dialog"]')!)).toBe(
            'Delete order? This cannot be undone',
        );
    });

    it('collapses the whitespace of a multi-line heading', () => {
        const host = fixture('<h2 id="title">\n    Payout\n    details\n</h2>' +
            '<div role="dialog" aria-labelledby="title"></div>');

        expect(accessibleName(host.querySelector('[role="dialog"]')!)).toBe('Payout details');
    });

    it('falls back to aria-label when every reference is missing, and to nothing when unnamed', () => {
        const host = fixture(
            '<div role="dialog" aria-labelledby="gone" aria-label="Still here"></div>' +
                '<div role="alertdialog"></div>',
        );

        expect(accessibleName(host.querySelector('[role="dialog"]')!)).toBe('Still here');
        expect(accessibleName(host.querySelector('[role="alertdialog"]')!)).toBe('');
    });

    it('finds dialogs by role and name, and never treats the id as the name', () => {
        const host = fixture(
            '<h2 id="order-details-title">Order SG-102</h2>' +
                '<div role="dialog" aria-labelledby="order-details-title"></div>' +
                '<div role="alertdialog" aria-label="Delete order?"></div>' +
                '<div aria-label="Not a dialog"></div>',
        );

        expect(dialogsNamed(host, 'Order SG-102')).toHaveLength(1);
        expect(dialogsNamed(host, 'Delete order?')).toHaveLength(1);
        expect(dialogsNamed(host, 'order-details-title')).toHaveLength(0);
        expect(dialogsNamed(host, 'Not a dialog')).toHaveLength(0);
        expect(dialogNames(host)).toEqual(['Order SG-102', 'Delete order?']);
    });
});

// ---------- rendered admin dialogs ----------

describe('ConfirmationModal accessible name', () => {
    it('takes its rendered name from the referenced heading', async () => {
        await mount(loadConfirmationModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            title: 'Delete order?',
            message: 'This cannot be undone.',
        });

        expect(dialogsNamed(container, 'Delete order?')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Delete order?']);
        // The id is wiring, not a name.
        expect(dialogsNamed(container, 'modal-title')).toHaveLength(0);

        const close = container.querySelector('[role="dialog"] button[aria-label="Close modal"]');
        expect(close).toBeTruthy();
        expect(accessibleName(close!)).toBe('Close modal');
    });

    it('the name disappears with the heading it points at', async () => {
        await mount(loadConfirmationModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            title: 'Delete order?',
            message: 'This cannot be undone.',
        });

        // The heading is the only thing naming the dialog: with the reference
        // intact the name is present, and breaking it removes the name.
        expect(dialogsNamed(container, 'Delete order?')).toHaveLength(1);
        container.querySelector('#modal-title')?.removeAttribute('id');

        expect(dialogsNamed(container, 'Delete order?')).toHaveLength(0);
        expect(dialogNames(container)).toEqual(['']);
    });
});

describe('Invoice accessible name', () => {
    it('is named by its rendered heading', async () => {
        await mount(loadInvoice, { order: ORDER as never, onClose: vi.fn() });

        expect(dialogsNamed(container, 'Invoice')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Invoice']);
        expect(dialogsNamed(container, 'invoice-dialog-title')).toHaveLength(0);
    });
});

// ---------- the remaining modal dialogs ----------

describe('PaymentRecordModal accessible name', () => {
    it('resolves the referenced heading text, not the id', async () => {
        await mount(loadPaymentRecordModal, {
            orderId: 'o-102',
            orderNumber: 'SG-102',
            customerName: 'Cara',
            balanceDue: 30,
            paidAmount: 170,
            total: 200,
            onClose: vi.fn(),
            onRecorded: vi.fn(),
        });

        expect(dialogsNamed(container, 'Record Payment')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Record Payment']);
        expect(dialogsNamed(container, 'record-payment-title')).toHaveLength(0);
    });

    it('names the icon-only remove controls on the proof field', async () => {
        services.validatePaymentProofFile.mockReturnValue({ valid: true });

        try {
            await mount(loadPaymentRecordModal, {
                orderId: 'o-102',
                orderNumber: 'SG-102',
                customerName: 'Cara',
                balanceDue: 30,
                paidAmount: 170,
                total: 200,
                onClose: vi.fn(),
                onRecorded: vi.fn(),
            });

            const input = container.querySelector<HTMLInputElement>('input[type="file"]');
            expect(input).toBeTruthy();

            const file = new File(['%PDF-1.4'], 'proof.pdf', { type: 'application/pdf' });
            Object.defineProperty(input!, 'files', { value: [file], configurable: true });
            await act(async () => {
                input!.dispatchEvent(new Event('change', { bubbles: true }));
            });

            const remove = container.querySelector('button[aria-label="Remove payment proof"]');
            expect(remove).toBeTruthy();
            expect(accessibleName(remove!)).toBe('Remove payment proof');
        } finally {
            services.validatePaymentProofFile.mockReset();
        }
    });
});

describe('RefundExceptionModal accessible name', () => {
    it('carries its own label', async () => {
        await mount(loadRefundExceptionModal, {
            orderId: 'o-102',
            orderNumber: 'SG-102',
            orderTotal: 200,
            adminWalletAddress: '0xabc',
            onClose: vi.fn(),
            onSuccess: vi.fn(),
        });

        expect(dialogsNamed(container, 'Issue refund exception')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Issue refund exception']);
    });
});

describe('CustomerLinkModal accessible name', () => {
    afterEach(() => {
        services.buildCustomerProfile.mockReset();
        services.buildCustomerProfileByEmail.mockReset();
    });

    it('names the dialog after the customer it was opened for', async () => {
        services.buildCustomerProfileByEmail.mockResolvedValue({
            email: 'ada@example.com',
            orderCount: 0,
            totalSpend: 0,
            firstOrderDate: null,
            lastOrderDate: null,
            isVerifiedBuyer: false,
        });

        await mount(loadCustomerLinkModal, {
            orderId: 'ord_0001',
            customerEmail: 'ada@example.com',
            customerName: 'Ada Lovelace',
            onClose: vi.fn(),
        });

        expect(dialogsNamed(container, 'Customer details for Ada Lovelace')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Customer details for Ada Lovelace']);
        // The name follows the prop, so another customer's dialog is not it.
        expect(dialogsNamed(container, 'Customer details for Grace Hopper')).toHaveLength(0);
    });
});

describe('PhotoLightbox accessible name', () => {
    it('is a named modal viewer', async () => {
        await mount(loadPhotoLightbox, {
            photos: ['/a.png', '/b.png'],
            onClose: vi.fn(),
        });

        expect(dialogsNamed(container, 'Photo viewer')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Photo viewer']);
    });
});

describe('SecurityModal accessible name', () => {
    it('names the warning it renders', async () => {
        await mount(loadSecurityModal, { isOpen: true, onClose: vi.fn() });

        expect(dialogsNamed(container, 'Important security warning')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Important security warning']);
    });
});

describe('WizardDetailModal accessible name', () => {
    it('includes the wizard it was opened for', async () => {
        await mount(loadWizardDetailModal, {
            wizard: {
                id: 'w-1',
                name: 'Ember',
                image: '/ember.png',
                tokenUri: 'ipfs://ember',
                attributes: [{ trait_type: 'Element', value: 'Fire' }],
                element: 'Fire',
                level: 3,
                power: 120,
                isLegacy: false,
            },
            isOpen: true,
            onClose: vi.fn(),
            onUpgrade: vi.fn(),
        });

        expect(dialogsNamed(container, 'Ember details')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Ember details']);
    });
});

describe('ManualOrderForm accessible name', () => {
    it('resolves its referenced heading', async () => {
        await mount(loadManualOrderForm, { onClose: vi.fn(), onSuccess: vi.fn() });

        expect(dialogsNamed(container, 'Create Manual Order')).toHaveLength(1);
        expect(dialogNames(container)).toEqual(['Create Manual Order']);
        expect(dialogsNamed(container, 'manual-order-title')).toHaveLength(0);
    });
});
