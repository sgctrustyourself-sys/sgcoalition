// scripts/test-buy-label.ts
//
// One-shot smoke test for services/shipping.ts — runs a REAL label purchase
// against a REAL order using the SHIPPO_API_TOKEN already in .env.
//
// Use a Shippo TEST key (shippo_test_...) first: the full API flow runs and a
// label URL is produced, but nothing is billed. Once the output looks right,
// swap to the live key — the next real paid order buys real postage.
//
// USAGE:
//   npx tsx scripts/test-buy-label.ts <order_id>          # real run
//   npx tsx scripts/test-buy-label.ts <order_id> --dry    # gates + rates only, no purchase
//
// Magic tokens (grep-able outcome): LABEL_PURCHASED, LABEL_SKIPPED,
// LABEL_RETRYABLE, LABEL_FAILED, LABEL_DRY_RATES.

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const orderId = process.argv[2];
const dry = process.argv.includes('--dry');

if (!orderId) {
    console.error('Usage: npx tsx scripts/test-buy-label.ts <order_id> [--dry]');
    process.exit(1);
}

if (!process.env.SHIPPO_API_TOKEN) {
    console.error('SHIPPO_API_TOKEN is not set in .env — add it first (test key: shippo_test_...).');
    process.exit(1);
}

if (!process.env.SHIP_FROM_STREET1 || !process.env.SHIP_FROM_CITY || !process.env.SHIP_FROM_STATE || !process.env.SHIP_FROM_ZIP) {
    console.error('Ship-from is incomplete. Set SHIP_FROM_NAME, SHIP_FROM_STREET1, SHIP_FROM_CITY, SHIP_FROM_STATE, SHIP_FROM_ZIP (York PA), SHIP_FROM_PHONE in .env.');
    process.exit(1);
}

if (dry) {
    // Dry mode: reuse the service's gates by importing it, but stop before the
    // purchase. Simplest honest approach: load the order + validate address,
    // create the shipment for RATES ONLY (no transaction), print them.
    const { createClient } = await import('@supabase/supabase-js');
    const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!u || !k) { console.error('Supabase env missing.'); process.exit(1); }
    const s = createClient(u, k);
    const { data: order, error } = await s.from('orders')
        .select('id,order_number,payment_status,paid_amount,balance_due,total,shipping_address,shipping_info,items,customer_name,customer_email')
        .eq('id', orderId)
        .maybeSingle();
    if (error || !order) { console.error('Order lookup failed:', error?.message || 'not found'); process.exit(1); }

    const { isOrderPaid, normalizeAddress, shipToCountry } = await import('../services/shipping');
    console.log('Order:', order.order_number || order.id, '| status:', order.payment_status, '| paid:', order.paid_amount, '| due:', order.balance_due);
    console.log('Paid gate:', isOrderPaid(order as never) ? 'PASS' : 'FAIL');

    const addr = normalizeAddress(order as never);
    if (!addr) {
        console.log('Address gate: FAIL — street1/city/state/zip incomplete, the real run would mark the shipment failed.');
        process.exit(1);
    }
    console.log('Address gate: PASS ->', [addr.name, addr.street1, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(' | '));
    console.log('Country gate:', shipToCountry(addr) === 'US' ? 'PASS (US)' : 'FAIL (non-US — manual customs flow)');

    const weightOz = Number(process.env.SHIPPO_PARCEL_WEIGHT_OZ || 8);
    const res = await fetch('https://api.goshippo.com/shipments', {
        method: 'POST',
        headers: { Authorization: 'ShippoToken ' + process.env.SHIPPO_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            address_from: {
                name: process.env.SHIP_FROM_NAME || 'SG Coalition',
                street1: process.env.SHIP_FROM_STREET1,
                city: process.env.SHIP_FROM_CITY,
                state: process.env.SHIP_FROM_STATE,
                zip: process.env.SHIP_FROM_ZIP,
                country: 'US',
                phone: process.env.SHIP_FROM_PHONE || '',
            },
            address_to: { name: addr.name || 'Customer', street1: addr.street1, city: addr.city, state: addr.state, zip: addr.zip, country: 'US', phone: addr.phone || '' },
            parcels: [{ length: '10', width: '7', height: '1', distance_unit: 'in', weight: String(weightOz), mass_unit: 'oz' }],
            async: false,
        }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.error('Shippo shipment create failed:', res.status, JSON.stringify(body).slice(0, 400));
        process.exit(1);
    }
    const shipment = await res.json() as { rates?: Array<{ objectId: string; amount: string; provider: string; servicelevel?: { name?: string; token?: string } }> };
    const { pickGroundAdvantageRate } = await import('../services/shipping');
    const maxCents = Math.round(Number(process.env.SHIPPO_MAX_RATE_USD || 15) * 100);
    const rate = pickGroundAdvantageRate(shipment.rates || [], maxCents);
    console.log('Rates returned:', (shipment.rates || []).length);
    for (const r of (shipment.rates || []).slice(0, 8)) {
        console.log('  -', r.provider, r.servicelevel?.name, '$' + r.amount);
    }
    if (!rate) {
        console.log('LABEL_DRY_RATES: no Ground Advantage rate within the $' + (maxCents / 100).toFixed(2) + ' cap — the real run would fail permanently.');
        process.exit(1);
    }
    console.log('LABEL_DRY_RATES: would buy', rate.provider, rate.servicelevel?.name, 'at $' + rate.amount, '(within cap). Re-run without --dry to purchase.');
    process.exit(0);
}

// Real run — the same idempotent path the webhook uses. Safe to re-run: the
// shipments claim row makes any repeat a no-op (LABEL_SKIPPED / already_claimed).
const { purchaseLabelForOrder } = await import('../services/shipping');
const result = await purchaseLabelForOrder(orderId);
console.log('Outcome:', result.outcome.toUpperCase());
console.log('Reason:', result.reason);
if (result.shipment) {
    console.log('LABEL_PURCHASED');
    console.log('  Tracking:', result.shipment.trackingNumber);
    console.log('  Label PDF:', result.shipment.labelUrl);
    console.log('  Service: ', result.shipment.carrier, result.shipment.service, '— $' + (result.shipment.rateCents / 100).toFixed(2));
} else if (result.outcome === 'skipped') {
    console.log('LABEL_SKIPPED');
} else if (result.outcome === 'retryable') {
    console.log('LABEL_RETRYABLE');
} else {
    console.log('LABEL_FAILED');
}
