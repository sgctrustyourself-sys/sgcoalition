// tests/orderDepositNotes.test.ts
//
// REGRESSION CATCH: locks the parser contract of
// utils/orderDepositNotes.ts so the source-of-truth regex that backs the
// SQL migration in supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql
// stays in lockstep with the TS helper. If the TS regex drifts away from
// what's in the SQL runner, the Travis row (and any future $X paid / $Y
// owes orders) will silently fall back to paid_amount=0, balance_due=0.
//
// Contracts being locked:
//
//   DEPOSIT_NOTES_RE
//     1. Matches the canonical "DEP $X paid / BAL $Y owes" format.
//     2. Has exactly two capture groups (paid, balance).
//     3. Allows optional decimals for cents (one or two digits).
//     4. Rejects alt currencies, missing BAL, missing DEP.
//
//   parseDepositNotes(notes)
//     1. Returns { paidAmount, balanceDue } on Travis's exact backfill string.
//     2. Returns { paidAmount, balanceDue } on decimal-cents strings.
//     3. Returns null on empty / wrong-format / half-format / null-arg.
//     4. Returns null when notes have alt currency or are missing either
//        half of the marker.

import { describe, it, expect } from 'vitest';
import {
    DEPOSIT_NOTES_RE,
    parseDepositNotes,
    resolvePaymentState,
} from '../utils/orderDepositNotes';

// Travis's actual notes text, written verbatim — this is the live anchor
// the SQL migration backfills against.
const TRAVIS_NOTES =
    'DEP $30 paid / BAL $10 owes. Custom Coalition Shirt (bespoke). @sgcoalition-backfill-travis-2026-07-25';

describe('utils/orderDepositNotes — DEPOSIT_NOTES_RE source-of-truth', () => {
    it('captures two groups: paid and balance', () => {
        const match = DEPOSIT_NOTES_RE.exec(TRAVIS_NOTES);
        expect(match).not.toBeNull();
        expect(match!.length).toBe(3); // [0]=full, [1]=paid, [2]=balance
        expect(match![1]).toBe('30');
        expect(match![2]).toBe('10');
    });

    it('anchors on "DEP $X paid / BAL $Y owes" verbatim', () => {
        // Slight format drift should NOT match — guards against accidental
        // parser greediness that would silent-misfire on future notes.
        expect(DEPOSIT_NOTES_RE.test('DEP $30 paid / BAL $10 owns')).toBe(false); // owns != owes
        expect(DEPOSIT_NOTES_RE.test('DEP $30PAID / BAL $10OWES')).toBe(false);
        expect(DEPOSIT_NOTES_RE.test('BAL $10 owes / DEP $30 paid')).toBe(false);
        expect(DEPOSIT_NOTES_RE.test('DEP £30 paid / BAL £10 owes')).toBe(false);
    });
});

describe('utils/orderDepositNotes — parseDepositNotes', () => {
    it('parses Travis exact backfill string', () => {
        expect(parseDepositNotes(TRAVIS_NOTES)).toEqual({
            paidAmount: 30,
            balanceDue: 10,
        });
    });

    it('parses decimal-cents values', () => {
        expect(parseDepositNotes('DEP $30.50 paid / BAL $9.50 owes.')).toEqual({
            paidAmount: 30.5,
            balanceDue: 9.5,
        });
        expect(parseDepositNotes('DEP $1.00 paid / BAL $0.00 owes.')).toEqual({
            paidAmount: 1,
            balanceDue: 0,
        });
    });

    it('returns null on empty / null / undefined input', () => {
        expect(parseDepositNotes('')).toBeNull();
        expect(parseDepositNotes(null)).toBeNull();
        expect(parseDepositNotes(undefined)).toBeNull();
        expect(parseDepositNotes('Payment confirmed')).toBeNull();
    });

    it('returns null when marker is only half-present', () => {
        expect(parseDepositNotes('DEP $30 paid')).toBeNull();
        expect(parseDepositNotes('BAL $10 owes')).toBeNull();
        expect(parseDepositNotes('DEP $30 paid / BAL')).toBeNull();
        expect(parseDepositNotes('DEP / BAL $10 owes')).toBeNull();
    });

    it('returns null when amount is missing', () => {
        expect(parseDepositNotes('DEP $ paid / BAL $ owes')).toBeNull();
        expect(parseDepositNotes('DEP paid / BAL owes')).toBeNull();
    });
});

describe('utils/orderDepositNotes — resolvePaymentState', () => {
    it('returns parsed deposit when notes embed the marker (priority over status)', () => {
        // even with payment_status='paid' the explicit marker wins
        expect(
            resolvePaymentState(TRAVIS_NOTES, 'paid', 40),
        ).toEqual({ paidAmount: 30, balanceDue: 10 });
    });

    it('fully-paid statuses when no marker → paid_amount=total, balance_due=0', () => {
        expect(
            resolvePaymentState('Backfilled from INITIAL_ORDERS seed.', 'paid', 85),
        ).toEqual({ paidAmount: 85, balanceDue: 0 });
        expect(
            resolvePaymentState('Backfilled from INITIAL_ORDERS seed.', 'completed', 25),
        ).toEqual({ paidAmount: 25, balanceDue: 0 });
        expect(
            resolvePaymentState('Backfilled from INITIAL_ORDERS seed.', 'shipped', 200),
        ).toEqual({ paidAmount: 200, balanceDue: 0 });
        expect(
            resolvePaymentState('Backfilled from INITIAL_ORDERS seed.', 'delivered', 99),
        ).toEqual({ paidAmount: 99, balanceDue: 0 });
    });

    it('pending/unknown status with no marker → paid_amount=0, balance_due=total (money not captured)', () => {
        // Pending = customer intent only; no money has moved. The buyer
        // may intend to pay in full, but the row truthfully shows the
        // operator that the full total is still owed. Admins who want to
        // document an explicit partial split write the DEP/BAL marker
        // into notes, which parseDepositNotes short-circuits above.
        expect(
            resolvePaymentState('Pending Stripe verification.', 'pending', 50),
        ).toEqual({ paidAmount: 0, balanceDue: 50 });
        expect(
            resolvePaymentState('Awaiting custom-shirt cash deposit.', 'pending', 40),
        ).toEqual({ paidAmount: 0, balanceDue: 40 });
        expect(
            resolvePaymentState('Awaiting reconciliation.', '', 75),
        ).toEqual({ paidAmount: 0, balanceDue: 75 });
    });

    it('hard-unpaid statuses → paid_amount=0, balance_due=total', () => {
        // The only branches that actively block a customer.
        expect(
            resolvePaymentState('Card declined.', 'failed', 50),
        ).toEqual({ paidAmount: 0, balanceDue: 50 });
        expect(
            resolvePaymentState('Cancelled by admin.', 'cancelled', 50),
        ).toEqual({ paidAmount: 0, balanceDue: 50 });
        expect(
            resolvePaymentState('Cancelled by admin.', 'canceled', 50),
        ).toEqual({ paidAmount: 0, balanceDue: 50 });
        expect(
            resolvePaymentState('Order refunded.', 'refunded', 50),
        ).toEqual({ paidAmount: 0, balanceDue: 50 });
    });

    it('returns {0, 0} when total is invalid', () => {
        expect(resolvePaymentState(null, 'paid', NaN)).toEqual({ paidAmount: 0, balanceDue: 0 });
        expect(resolvePaymentState(null, 'paid', -5)).toEqual({ paidAmount: 0, balanceDue: 0 });
    });

    it('unknown status string falls through to unpaid via the catch-all branch', () => {
        // The catch-all `return { paidAmount: 0, balanceDue: total }` at
        // the bottom of resolvePaymentState covers any status not in either
        // isFullyPaid or isMoneyNotCaptured. Lock the contract so a future
        // refactor that adds 'partial' / 'awaiting_payment' / 'manual_hold'
        // status strings still gets the safe unpaid default.
        expect(
            resolvePaymentState('Hidden hold by ops.', 'awaiting_payment', 60),
        ).toEqual({ paidAmount: 0, balanceDue: 60 });
        expect(
            resolvePaymentState('Custom operator hold.', 'manual_hold', 80),
        ).toEqual({ paidAmount: 0, balanceDue: 80 });
        expect(
            resolvePaymentState('Future partial status.', 'partial', 100),
        ).toEqual({ paidAmount: 0, balanceDue: 100 });
    });
});

