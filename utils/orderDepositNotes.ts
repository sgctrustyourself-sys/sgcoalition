// utils/orderDepositNotes.ts
//
// Pure helper for extracting deposit / balance amounts from an order's
// `notes` text. Used when admins backfill pending orders by hand (e.g.
// "DEP $30 paid / BAL $10 owes. Custom Coalition Shirt (bespoke). @tag")
// and we want consistent parsing across the SQL migration,
// `scripts/addPaidAmountBalanceDueToOrders.cjs`, and the live `api/`
// handlers.
//
// ONE REGEX = ONE SOURCE OF TRUTH
// The exported `DEPOSIT_NOTES_RE` is the same shape that
// `supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql`
// runs against the `notes` column. If the regex is changed here, mirror it
// in the SQL migration AND the migration's documentation comment — there
// are tests in `tests/orderDepositNotes.test.ts` that lock the contract.
//
// FORMAT (single-line, anchored on each digit run):
//   "DEP $X paid / BAL $Y owes"
// where X and Y are non-negative decimals (one or two-digit cents).
// Trailing prose is allowed (Travis's notes include a custom-shirt
// description and a backfill tag after the deposit sentence).
//
// NON-MATCHES (all return null):
//   ""                                            -> null
//   "DEP $30 paid"                                -> null (no BAL/BAL amount)
//   "BAL $10 owes"                                -> null (no DEP/DEP amount)
//   "DEP $30.50 paid"                             -> null (no BAL pair)
//   "DEP £30 paid / BAL £10 owes"                 -> null (currency must be $)
//   "DEP -30 paid / BAL -10 owes"                 -> null (regex has no `-` class)

/**
 * Capture-group layout of `DEPOSIT_NOTES_RE`:
 *   group 1: paid amount string (numeric, decimal OK)
 *   group 2: balance amount string (numeric, decimal OK)
 *
 * Mirrored in supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql
 * as two SEPARATE `regexp_match` calls (one anchored on DEP, one anchored
 * on BAL) because PostgreSQL `substring(string FROM pattern)` only
 * returns the first capture group. The TS regex captures both in one
 * pass because JS regex exposes all groups via `.exec()`.
 *
 * `\$` escapes the literal `$` sign. POSIX ERE and PCRE both understand
 * this; PostgreSQL's `regexp_match` reads the same regex string verbatim.
 */
export const DEPOSIT_NOTES_RE =
    /DEP \$(\d+(?:\.\d+)?) paid \/ BAL \$(\d+(?:\.\d+)?) owes/;

export interface ParsedDepositNotes {
    paidAmount: number;
    balanceDue: number;
}

/**
 * Parses a `notes` string for the deposit-line marker. Returns the parsed
 * paid/balance pair or `null` if the marker is absent or malformed.
 *
 * @example
 *   parseDepositNotes('DEP $30 paid / BAL $10 owes. Custom Coalition Shirt.')
 *   // { paidAmount: 30, balanceDue: 10 }
 *
 *   parseDepositNotes('DEP $30.5 paid / BAL $9.5 owes.')
 *   // { paidAmount: 30.5, balanceDue: 9.5 }
 *
 *   parseDepositNotes('Payment confirmed.')
 *   // null
 */
export function parseDepositNotes(notes: string | null | undefined): ParsedDepositNotes | null {
    if (typeof notes !== 'string' || notes.length === 0) {
        return null;
    }
    const match = DEPOSIT_NOTES_RE.exec(notes);
    if (!match) {
        return null;
    }
    const paid = Number(match[1]);
    const balance = Number(match[2]);
    // Defensive: regex already ensures these are non-negative digit runs,
    // but fail closed if a future caller passes a custom string.
    if (!Number.isFinite(paid) || !Number.isFinite(balance) || paid < 0 || balance < 0) {
        return null;
    }
    return { paidAmount: paid, balanceDue: balance };
}

/**
 * Computes the canonical (paid_amount, balance_due) pair for any order:
 * - If `notes` embeds the deposit marker, return exactly what it says (highest
 *   priority; admins use "DEP $X paid / BAL $Y owes" to override defaults).
 * - Otherwise, infer from `paymentStatus`:
 *     paid/completed/shipped/delivered -> money captured
 *         -> paid_amount=total, balance_due=0
 *     pending/null/unknown -> money NOT captured (customer intent only)
 *         -> paid_amount=0, balance_due=total
 *     failed/cancelled/canceled/refunded -> money blocked (refunded/canceled)
 *         -> paid_amount=0, balance_due=total
 *   Note that pending and failed both default to {0, total} — the
 *   distinction is operationally meaningful (admin can tell from
 *   payment_status which one it is), so we don't need to differentiate in
 *   the numeric columns. Reviews of this surface flag TODO #4: introduce
 *   a third status "partial" once an admin tool exists to flip rows.
 *
 * Total must be a finite non-negative number; defensive guards return
 * {0, 0} when callers pass invalid input.
 */
export function resolvePaymentState(
    notes: string | null | undefined,
    paymentStatus: string | null | undefined,
    total: number | null | undefined,
): ParsedDepositNotes {
    if (typeof total === 'number' && Number.isFinite(total) && total >= 0) {
        const parsed = parseDepositNotes(notes);
        if (parsed) return parsed;

        const status = String(paymentStatus || '').toLowerCase();
        const isFullyPaid = [
            'paid',
            'completed',
            'shipped',
            'delivered',
        ].includes(status);
        // Money-not-captured set: pending (customer intent only — money has
        // not moved yet) joined with terminal customer-network states
        // (failed = network decline, cancelled/canceled = operator or buyer
        // terminated, refunded = money was returned). All of these resolve
        // to paid_amount=0, balance_due=total — the row truthfully shows the
        // full total still owed regardless of why payment did not land.
        // NULL/empty/unknown statuses fall through to the catch-all below,
        // which also returns unpaid — DRY catch-all for future status names.
        const isMoneyNotCaptured = [
            'pending',
            'failed',
            'cancelled',
            'canceled',
            'refunded',
        ].includes(status);
        if (isFullyPaid) {
            return { paidAmount: total, balanceDue: 0 };
        }
        if (isMoneyNotCaptured) {
            return { paidAmount: 0, balanceDue: total };
        }
        // Unknown status string — default to unpaid. Better to over-report
        // a balance owed than to claim a payment we can't verify.
        return { paidAmount: 0, balanceDue: total };
    }
    return { paidAmount: 0, balanceDue: 0 };
}
