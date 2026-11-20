// api/_marketingAudience.ts
//
// THE SINGLE OWNER OF "WHO IS REACHABLE".
//
// The reachable audience is a union of four sources, and it is the same list
// whether you are SENDING to it (/api/marketing-send) or LOOKING at it
// (/api/marketing-stats). Before this module each endpoint built its own answer:
// marketing-send unioned four tables, while marketing-stats counted only
// marketing_contacts — so the admin UI could report 120 reachable contacts for a
// campaign that actually went to 400. That class of disagreement is why this
// lives in one place now.
//
// Sources, and why each one counts:
//   - marketing_contacts          opted-in through the newer unified form
//   - subscribe_emails            the legacy drop list
//   - coalition_signal_subscribers opted-in by SMS/email signal
//   - orders.customer_email       past buyers (last 12 months)
//
// Rows are de-duplicated by lowercased email (or phone for SMS-only contacts),
// and unsubscribed rows are excluded at the query level so an unsubscribe is
// never overridden by a row from another source.
//
// The verified-customer rules (which test campaigns may not reach) live in
// utils/marketingAudience.ts — this module calls that policy, it does not
// re-implement it.

import type { SupabaseClient } from '@supabase/supabase-js';
import { filterVerifiedCustomers } from '../utils/marketingAudience.js';
import type { MarketingAudienceRow, MarketingChannel } from './_types.js';

/** A reachable contact plus the fields the admin UI groups by. */
export interface ReachableContact extends MarketingAudienceRow {
    /** Which source first claimed this contact — drives the UI's source filter. */
    source: string;
}

export interface AudienceResult {
    rows: ReachableContact[];
    excludedVerifiedCustomers: number;
}

const ORDER_LOOKBACK_DAYS = 365;

/**
 * Build the reachable audience for a channel.
 *
 * `excludeVerified` drops verified buyers (manual_seed / past_customer) — the
 * test-campaign guard. Callers derive it from the campaign name via
 * isTestCampaignName(); this module never guesses.
 */
export async function fetchAudience(
    admin: SupabaseClient,
    channel: MarketingChannel,
    options: { excludeVerified?: boolean } = {},
): Promise<AudienceResult> {
    const rows = new Map<string, ReachableContact>();

    if (channel === 'email' || channel === 'both') {
        const [dropRes, mcRes, cssRes, ordersRes] = await Promise.all([
            admin.from('subscribe_emails').select('email, unsubscribe_at').is('unsubscribe_at', null),
            admin.from('marketing_contacts').select('id, email, phone_e164, source, unsubscribed_at, unsubscribe_token')
                .is('unsubscribed_at', null).not('email', 'is', null),
            admin.from('coalition_signal_subscribers').select('contact_value, subscriber_type, status')
                .eq('subscriber_type', 'email').eq('status', 'active'),
            admin.from('orders').select('customer_email, customer_name, created_at')
                .not('customer_email', 'is', null)
                .gte('created_at', new Date(Date.now() - ORDER_LOOKBACK_DAYS * 86400_000).toISOString()),
        ]);
        if (dropRes.data) for (const r of dropRes.data) if (r.email) rows.set(`drop:${r.email.toLowerCase()}`, { email: r.email, phone: null, source: 'drop_list', unsubscribe_token: null });
        if (mcRes.data) for (const r of mcRes.data) if (r.email) {
            const key = `mc:${r.email.toLowerCase()}`;
            if (!rows.has(key)) rows.set(key, { id: r.id, email: r.email, phone: null, source: r.source || 'marketing_contacts', unsubscribe_token: r.unsubscribe_token || null });
        }
        if (cssRes.data) for (const r of cssRes.data) if (r.contact_value) {
            const k = `css:${r.contact_value.toLowerCase()}`;
            if (!rows.has(k)) rows.set(k, { email: r.contact_value, phone: null, source: 'sms_signup_email', unsubscribe_token: null });
        }
        if (ordersRes.data) for (const o of ordersRes.data) if (o.customer_email) {
            const k = `order:${o.customer_email.toLowerCase()}`;
            if (!rows.has(k)) rows.set(k, { email: o.customer_email, phone: null, source: 'past_customer', unsubscribe_token: null });
        }
    }

    if (channel === 'sms' || channel === 'both') {
        const [cssRes, mcRes] = await Promise.all([
            admin.from('coalition_signal_subscribers').select('contact_value, status')
                .eq('subscriber_type', 'sms').eq('status', 'active'),
            admin.from('marketing_contacts').select('id, email, phone_e164, source, unsubscribed_at, unsubscribe_token')
                .is('unsubscribed_at', null).not('phone_e164', 'is', null),
        ]);
        if (cssRes.data) for (const r of cssRes.data) if (r.contact_value) {
            const k = `css:${r.contact_value}`;
            if (!rows.has(k)) rows.set(k, { email: null, phone: r.contact_value, source: 'sms_signup', unsubscribe_token: null });
        }
        if (mcRes.data) for (const r of mcRes.data) if (r.phone_e164) {
            const k = `mc:${r.phone_e164}`;
            if (!rows.has(k)) rows.set(k, { id: r.id, email: r.email, phone: r.phone_e164, source: r.source || 'marketing_contacts', unsubscribe_token: r.unsubscribe_token || null });
        }
    }

    const rawAudience = Array.from(rows.values());
    if (!options.excludeVerified) {
        return { rows: rawAudience, excludedVerifiedCustomers: 0 };
    }
    const { rows: filtered, excluded } = filterVerifiedCustomers(rawAudience, { excludeVerified: true });
    if (excluded > 0) {
        console.warn(`[marketing-audience] test campaign excluded ${excluded} verified-customer rows (manual_seed/past_customer)`);
    }
    return { rows: filtered, excludedVerifiedCustomers: excluded };
}

/**
 * Audience summary for the admin UI. Counts and source breakdown come from the
 * SAME union the sender uses, so the number on screen is the number that will
 * receive the campaign.
 */
export function summariseAudience(rows: ReachableContact[]) {
    const bySource: Record<string, number> = {};
    for (const row of rows) {
        bySource[row.source] = (bySource[row.source] || 0) + 1;
    }
    return {
        total: rows.length,
        email: rows.filter((r) => r.email).length,
        sms: rows.filter((r) => r.phone).length,
        by_source: bySource,
    };
}
