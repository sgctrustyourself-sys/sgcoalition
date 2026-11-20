// utils/orderAge.ts
//
// One owner for "how long has this order been open" and "when does a pending
// order stop being a checkout in flight?" — shared by the admin OrderManager
// (visible age on every row, red STALE marker on rotting pendings) and
// tests/soldYetBuyableAudit.test.ts (the live audit's STALE warning). One
// threshold, two surfaces: they can never disagree about what "stale" means,
// and neither can drift the way duplicated constants do.
//
// Why 30 days: cashapp/crypto verification completes in hours, at most a
// couple of days — anything a month old is an abandoned checkout, not a
// transfer waiting to land. Deliberately generous so a long-but-legitimate
// verification never trips it: the two QA rows that sat on the Above as Below
// set for seven weeks (cancelled 2026-10-03, README "QA checkout orders")
// would have been marked STALE from their first week.
export const STALE_PENDING_DAYS = 30;

/**
 * Whole days since the order was created; null when the timestamp is missing
 * or unparsable (a row without a date must render no age at all rather than
 * a wrong one — negative ages from clock skew are clamped to 0).
 */
export const ageDays = (iso: string | null | undefined): number | null => {
    const t = Date.parse(iso || '');
    return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86_400_000)) : null;
};
