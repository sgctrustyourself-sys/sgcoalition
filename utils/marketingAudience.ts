// Marketing-audience filter helpers used by /api/marketing-send.
//
// 2026-07-02 - "no test sends to verified customers" policy.
//
// Verified buyers are contacts whose `source` is one of:
//   - `manual_seed` (operator-added offline sale; written by
//     scripts/seedSmsContact.ts after the buyer paid in person)
//   - `past_customer` (anyone who placed an order through the storefront,
//     surfaced by joining orders.customer_email)
//
// Form leads (`sms_signup`, `sms_signup_email`, `drop_list`,
// `marketing_contacts`) are NOT verified buyers - they only opted in, never
// purchased, and ARE still reachable from test campaigns so the operator can
// verify Resend + Twilio wiring without paying the real-customer trust cost.
//
// Activation rule: a campaign is treated as a "test" whenever its NAME
// contains the substring "test" (case-insensitive). Words like "latest",
// "contest", "restock", and "festive" therefore also flip the switch - by
// design: if you're sending to a verified buyer and your campaign title
// could even glance at the word "test", rename it. This is the firmest
// mid-process enforcement we can apply without rejecting legitimate sends
// out of hand. See README "Test-campaign guard" for the policy plus edge
// cases.
//
// Override: none. Escape hatches were considered and rejected - the user
// instruction was to make this impossible, not inconvenient.

export const VERIFIED_CUSTOMER_SOURCES = ['manual_seed', 'past_customer'] as const;

export function isVerifiedCustomerSource(source: string | undefined | null): boolean {
    if (typeof source !== 'string') return false;
    return (VERIFIED_CUSTOMER_SOURCES as readonly string[]).includes(source);
}

export function isTestCampaignName(name: string | undefined | null): boolean {
    if (typeof name !== 'string') return false;
    return name.toLowerCase().includes('test');
}

export interface FilterOptions {
    /** When true, drop rows whose `source` is in VERIFIED_CUSTOMER_SOURCES. */
    excludeVerified?: boolean;
}

export interface FilterResult<T> {
    /** The kept rows, in original order. */
    rows: T[];
    /** How many rows were dropped (0 when excludeVerified was false). */
    excluded: number;
}

/**
 * Filter a campaign audience by source. When `excludeVerified` is true,
 * drop every contact whose `source` is a verified-customer source.
 * Otherwise, return a shallow copy of the input untouched.
 */
export function filterVerifiedCustomers<T extends { source: string }>(
    rows: T[],
    options: FilterOptions = {},
): FilterResult<T> {
    if (!options.excludeVerified) {
        return { rows: rows.slice(), excluded: 0 };
    }
    const kept: T[] = [];
    let excluded = 0;
    for (const row of rows) {
        if (isVerifiedCustomerSource(row.source)) {
            excluded += 1;
        } else {
            kept.push(row);
        }
    }
    return { rows: kept, excluded };
}
