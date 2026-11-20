// scripts/rate-comparison.ts
//
// USPS Ground Advantage vs UPS Ground — is the auto-label default actually
// the cheapest tracked option, per zone, from the York PA origin?
//
// Two modes:
//   npx tsx scripts/rate-comparison.ts --samples   rates-only quotes for a
//       zone-spanning destination set (FREE — no labels bought, works today)
//   npx tsx scripts/rate-comparison.ts --live      same comparison against the
//       destinations we ACTUALLY bought labels for (shipments ⨝ orders), plus
//       what was paid vs what the alternative would have cost
//
// Rates-only shipment creation costs nothing on Shippo; only /transactions
// buys postage. This script never calls /transactions.
//
// Zones are ESTIMATED with a state-band map from the 17404 origin — good
// enough to group the comparison, not a postal-grade zone chart.

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const SHIPPO_API = 'https://api.goshippo.com';

// ---- Zone estimation (state bands from York PA 17404) ----------------------

const STATE_ZONE_BAND: Record<string, string> = {
    PA: 'z1-2',
    NY: 'z3', NJ: 'z3', MD: 'z3', DE: 'z3', DC: 'z3', CT: 'z3', RI: 'z3', MA: 'z3',
    VT: 'z3', NH: 'z3', ME: 'z3', VA: 'z3', WV: 'z3', OH: 'z3',
    NC: 'z4', SC: 'z4', GA: 'z4', FL: 'z4', MI: 'z4', IN: 'z4', KY: 'z4', TN: 'z4',
    IL: 'z4', WI: 'z4', AL: 'z4', MS: 'z4',
    IA: 'z5', MO: 'z5', MN: 'z5', AR: 'z5', LA: 'z5',
    KS: 'z6', NE: 'z6', OK: 'z6', TX: 'z6', SD: 'z6', ND: 'z6',
    CO: 'z6', NM: 'z6', AZ: 'z6', UT: 'z6', ID: 'z6', MT: 'z6', WY: 'z6',
    NV: 'z7', CA: 'z7', OR: 'z7', WA: 'z7',
    AK: 'z8-9', HI: 'z8-9', PR: 'z8-9',
};
const zoneFor = (state: string) => STATE_ZONE_BAND[String(state || '').toUpperCase()] || '?';

// ---- Shippo rates-only quote ------------------------------------------------

interface Rate { provider: string; amount: string; servicelevel?: { name?: string; token?: string } }

async function quoteRates(dest: { name: string; street1: string; city: string; state: string; zip: string }) {
    const res = await fetch(SHIPPO_API + '/shipments', {
        method: 'POST',
        headers: {
            Authorization: 'ShippoToken ' + String(process.env.SHIPPO_API_TOKEN || ''),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            address_from: {
                name: process.env.SHIP_FROM_NAME || 'SG Coalition',
                street1: process.env.SHIP_FROM_STREET1 || '',
                city: process.env.SHIP_FROM_CITY || '',
                state: process.env.SHIP_FROM_STATE || '',
                zip: process.env.SHIP_FROM_ZIP || '',
                country: 'US',
                phone: process.env.SHIP_FROM_PHONE || '',
            },
            address_to: { ...dest, country: 'US' },
            parcels: [{ length: '10', width: '7', height: '1', distance_unit: 'in', weight: '8', mass_unit: 'oz' }],
            async: false,
        }),
    });
    if (!res.ok) throw new Error('shippo_' + res.status);
    const body = await res.json() as { rates?: Rate[] };
    return body.rates || [];
}

const gaRate = (rates: Rate[]) => rates.find((r) =>
    String(r.servicelevel?.token || '').toLowerCase() === 'usps_ground_advantage'
    || (String(r.provider || '').toUpperCase() === 'USPS' && String(r.servicelevel?.name || '').toUpperCase().includes('GROUND ADVANTAGE')));
const upsGroundRate = (rates: Rate[]) => rates.find((r) =>
    String(r.provider || '').toUpperCase() === 'UPS' && /GROUND/.test(String(r.servicelevel?.name || '').toUpperCase())
    && !/SUR|SAVER|EXPRESS|AIR/i.test(String(r.servicelevel?.name || '')));

// ---- Modes ------------------------------------------------------------------

const SAMPLES = [
    { label: 'Local', street1: '1500 Market St', city: 'Philadelphia', state: 'PA', zip: '19107' },
    { label: 'NYC', street1: '350 5th Ave', city: 'New York', state: 'NY', zip: '10118' },
    { label: 'Boston', street1: '1 Beacon St', city: 'Boston', state: 'MA', zip: '02108' },
    { label: 'Virginia Beach', street1: '1 Atlantic Ave', city: 'Virginia Beach', state: 'VA', zip: '23451' },
    { label: 'Chicago', street1: '233 S Wacker Dr', city: 'Chicago', state: 'IL', zip: '60606' },
    { label: 'Atlanta', street1: '265 Peachtree St NE', city: 'Atlanta', state: 'GA', zip: '30303' },
    { label: 'Miami', street1: '100 Biscayne Blvd', city: 'Miami', state: 'FL', zip: '33132' },
    { label: 'Austin', street1: '1100 Congress Ave', city: 'Austin', state: 'TX', zip: '78701' },
    { label: 'Denver', street1: '1701 Wewatta St', city: 'Denver', state: 'CO', zip: '80202' },
    { label: 'Los Angeles', street1: '800 N Alameda St', city: 'Los Angeles', state: 'CA', zip: '90012' },
    { label: 'Seattle', street1: '400 Broad St', city: 'Seattle', state: 'WA', zip: '98109' },
];

interface Dest { label: string; city: string; state: string; zip: string; street1?: string }

async function compare(dests: Dest[]) {
    const rows: Array<{ dest: Dest; zone: string; ga?: number; ups?: number }> = [];
    for (const dest of dests) {
        try {
            const rates = await quoteRates({ name: dest.label, street1: dest.street1 || '1 Main St', city: dest.city, state: dest.state, zip: dest.zip });
            const ga = gaRate(rates);
            const ups = upsGroundRate(rates);
            rows.push({
                dest, zone: zoneFor(dest.state),
                ga: ga ? Math.round(Number(ga.amount) * 100) : undefined,
                ups: ups ? Math.round(Number(ups.amount) * 100) : undefined,
            });
        } catch (e) {
            console.log(`  ! ${dest.label}: quote failed (${(e as Error).message})`);
        }
    }

    console.log('\nDestination            Zone   USPS GA   UPS Ground   Winner');
    console.log('---------------------- ---- --------- ------------   ------');
    let gaSum = 0, upsSum = 0, gaWins = 0, upsWins = 0, ties = 0;
    for (const r of rows) {
        const ga = r.ga != null ? '$' + (r.ga / 100).toFixed(2) : 'n/a';
        const ups = r.ups != null ? '$' + (r.ups / 100).toFixed(2) : 'n/a';
        let winner = 'tie';
        if (r.ga != null && r.ups != null) {
            if (r.ga < r.ups) { winner = 'USPS GA'; gaWins++; }
            else if (r.ups < r.ga) { winner = 'UPS'; upsWins++; }
            else ties++;
            gaSum += r.ga; upsSum += r.ups;
        } else if (r.ga != null) { gaSum += r.ga; }
        else if (r.ups != null) { upsSum += r.ups; }
        console.log(
            `${(r.dest.label + ', ' + r.dest.state).padEnd(22)} ${r.zone.padEnd(4)} ${ga.padStart(9)} ${ups.padStart(12)}   ${winner}`,
        );
    }
    if (rows.length) {
        console.log('---------------------- ---- --------- ------------');
        console.log(`Totals (${rows.length} dests)          $${(gaSum / 100).toFixed(2)}   $${(upsSum / 100).toFixed(2)}`);
        console.log(`\nVerdict: USPS GA cheaper on ${gaWins}, UPS Ground cheaper on ${upsWins}, ties ${ties}.`);
        console.log(`If every shipment had gone UPS Ground instead of GA: ${upsSum <= gaSum ? 'cheaper' : 'MORE expensive'} by $${(Math.abs(upsSum - gaSum) / 100).toFixed(2)} across this set.`);
    }
}

async function main() {
    if (!process.env.SHIPPO_API_TOKEN) { console.error('SHIPPO_API_TOKEN missing.'); process.exit(1); }
    if (!process.env.SHIP_FROM_STREET1) { console.error('SHIP_FROM_* missing.'); process.exit(1); }

    if (process.argv.includes('--live')) {
        // Destinations actually purchased, from shipments ⨝ orders (service role).
        const { createClient } = await import('@supabase/supabase-js');
        const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (!u || !k) { console.error('Service-role key required for --live.'); process.exit(1); }
        const s = createClient(u, k);
        const { data, error } = await s.from('shipments')
            .select('order_id,rate_cents,created_at,orders!inner(shipping_address)')
            .eq('status', 'purchased')
            .limit(500);
        if (error) { console.error('shipments read failed:', error.message); process.exit(1); }
        // PostgREST returns the !inner join as an ARRAY; unwrap the first row.
        type JoinedRow = { order_id: string; rate_cents: number | null; orders: { shipping_address: Record<string, unknown> } | Array<{ shipping_address: Record<string, unknown> }> };
        const raw = (data || []) as unknown as JoinedRow[];
        const rows = raw.map((r) => {
            const joined = Array.isArray(r.orders) ? r.orders[0] : r.orders;
            return { order_id: r.order_id, rate_cents: r.rate_cents, addr: joined?.shipping_address || {} };
        });
        if (!rows.length) {
            console.log('No purchased labels yet — run with --samples for the zone-spanning quote comparison, or rerun --live after live orders accumulate.');
            process.exit(0);
        }
        const dests: Dest[] = rows.map((r) => {
            const a = r.addr || {};
            return { label: String(a.city || '?'), city: String(a.city || '?'), state: String(a.state || '?'), zip: String(a.zip || '') };
        });
        console.log(`Live purchased labels: ${rows.length}. Re-quoting the same destinations (rates only, free):`);
        await compare(dests);
        const paid = rows.reduce((sum, r) => sum + Number(r.rate_cents || 0), 0);
        console.log(`Actually paid for the ${rows.length} live labels: $${(paid / 100).toFixed(2)}.`);
        return;
    }

    await compare(SAMPLES as Dest[]);
}

main();
