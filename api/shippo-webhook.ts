// api/shippo-webhook.ts
//
// Dedicated top-level Vercel route for Shippo tracking webhooks
// (tracking-status updates for labels bought via services/shipping.ts).
//
// AUTH: a shared-token URL capability, same trust level as Stripe's signed
// webhook: Shippo's track-update POSTs carry ?token=<SHIPPO_WEBHOOK_TOKEN>
// (or the X-Shippo-Token header); anything else is 401 and never touches
// Supabase. The token is operator-provisioned in Vercel env.
//
// DISPATCH: services/shippingMilestones.ts owns everything — status
// normalization, per-milestone claims (shipped/delivered), emails, and the
// fail-open policy. This handler adds only token gating and HTTP mapping:
//   200 — update accepted (action taken or correctly none)
//   401 — missing/wrong token
//   405 — non-POST
//   400 — malformed body / tracking number (Shippo retries; the next
//         delivery with a well-formed body succeeds)
//   500 — transient DB failure (Shippo retries; claims make redeliveries safe)
//
// Body shape: the handler is tolerant of both the event-envelope and
// bare-payload shapes Shippo has used across API versions — the tracking
// fields are found whether they sit at the top level or under data/.

import { handleTrackingUpdate, type TrackingUpdate } from '../services/shippingMilestones.js';

export const config = {
    api: {
        bodyParser: true,
    },
};

/** Token comparison without early-exit timing leaks. */
function tokenOk(received: string | undefined, expected: string): boolean {
    if (!received || received.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
        diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
}

function pickTrackingNumber(body: any): string {
    const b = body || {};
    return String(
        b.tracking_number
        || b.trackingNumber
        || b.data?.tracking_number
        || b.data?.trackingNumber
        || '',
    ).trim();
}

/**
 * tracking_status is a NESTED OBJECT in Shippo's track payloads
 * ({ status, status_details, status_date }), not a string — stringifying it
 * yields "[object Object]". Read the object when present, fall back to flat
 * fields for the bare-payload shape.
 */
function pickStatus(body: any): { status: string; statusDetails: string; statusDate: string } {
    const b = body || {};
    const ts = b.tracking_status ?? b.data?.tracking_status;
    if (ts && typeof ts === 'object') {
        return {
            status: String(ts.status ?? '').trim(),
            statusDetails: String(ts.status_details ?? '').trim(),
            statusDate: String(ts.status_date ?? '').trim(),
        };
    }
    return {
        status: pickField(b, 'status'),
        statusDetails: pickField(b, 'status_details'),
        statusDate: pickField(b, 'status_date'),
    };
}

function pickField(body: any, ...keys: string[]): string {
    const b = body || {};
    for (const k of keys) {
        const v = b[k] ?? b.data?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
}

/**
 * Structured pickup location when the carrier provides one (Shippo nests it
 * under `location` on some exception payloads): read city/state/zip and pass
 * through only what exists.
 */
function pickLocation(body: any): { city?: string; state?: string; zip?: string } | undefined {
    const b = body || {};
    const loc = b.location ?? b.data?.location;
    if (!loc || typeof loc !== 'object') return undefined;
    const out: { city?: string; state?: string; zip?: string } = {};
    for (const k of ['city', 'state', 'zip'] as const) {
        const v = (loc as Record<string, unknown>)[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = String(v).trim();
    }
    return Object.keys(out).length ? out : undefined;
}

export default async function handler(
    req: { method?: string; headers: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown },
    res: { status: (code: number) => { json: (b: unknown) => void; end: () => void }; setHeader: (k: string, v: string) => void },
): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const expected = String(process.env.SHIPPO_WEBHOOK_TOKEN || '');
    if (!expected) {
        // Unconfigured deployment: accept nothing rather than everything.
        console.error('[shippo-webhook] SHIPPO_WEBHOOK_TOKEN is not configured');
        res.status(500).json({ error: 'Webhook token not configured' });
        return;
    }
    const received = String(req.query?.token || req.headers['x-shippo-token'] || '');
    if (!tokenOk(received, expected)) {
        console.warn('[shippo-webhook] rejected: bad or missing token');
        res.status(401).json({ error: 'Token rejected' });
        return;
    }

    const body = req.body;
    const trackingNumber = pickTrackingNumber(body);
    if (!trackingNumber) {
        res.status(400).json({ error: 'tracking_number required' });
        return;
    }

    try {
        const st = pickStatus(body);
        const ev: TrackingUpdate = {
            carrier: pickField(body, 'carrier', 'tracking_provider') || 'USPS',
            trackingNumber,
            status: st.status,
            statusDetails: st.statusDetails,
            statusDate: st.statusDate,
            eta: pickField(body, 'eta'),
            location: pickLocation(body),
        };
        const result = await handleTrackingUpdate(ev);
        // A transient failure inside the service (claim/lookup) must ask
        // Shippo to redeliver — 200 would silently drop the milestone.
        if (result.retryable) {
            res.status(500).json({ received: true, action: result.action, reason: result.reason, retry: true });
            return;
        }
        res.status(200).json({ received: true, action: result.action, reason: result.reason });
        return;
    } catch (e) {
        // handleTrackingUpdate resolves every known path; a throw here is a
        // bug or a transient infra failure — 500 so Shippo retries it.
        console.error('[shippo-webhook] handling error:', (e as Error)?.message || e);
        res.status(500).json({ error: 'Webhook handling failed' });
        return;
    }
}
