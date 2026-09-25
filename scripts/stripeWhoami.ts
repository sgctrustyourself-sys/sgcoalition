/**
 * scripts/stripeWhoami.ts — which Stripe account is this environment pointed at,
 * and is the key behind it actually alive?
 *
 * Why it exists: a rolled or revoked secret key fails silently until something
 * else breaks and gets blamed for it. A stale local key was read here as
 * "expired" for a day because two candidate files were probed in one loop and the
 * results were read back out of order — an exit code and an account line make that
 * mistake impossible. It also runs the check a bare key test cannot: that the
 * secret key belongs to the same account as this environment's publishable key,
 * and whether that is the account the deployed site actually serves. A valid key
 * for the wrong account passes every naive test while checkout cannot complete —
 * the browser mounts one account's Element and the server charges another.
 *
 * Read-only by construction: GET /v1/account, /v1/balance, /v1/webhook_endpoints,
 * plus a plain GET of the deployed bundle for its public publishable key. It never
 * creates, confirms, refunds or charges anything, and it prints fingerprints
 * (prefix, length, hash) rather than key material.
 *
 * Exit codes, so it can gate a debugging session:
 *   0 healthy · 2 missing or malformed key · 3 key unusable · 4 key for another account
 *
 * The code is set via process.exitCode rather than process.exit(): a forced exit
 * while stdout is still flushing trips a libuv assertion on Windows and hands the
 * shell a bogus status (a real run of this script reported 127 for a Stripe
 * rejection until that was changed), which is exactly the kind of lie this script
 * exists to stop.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The two files that decide what local dev sees, in Vite's precedence: `.env`,
// then `.env.local` overriding it. In a deployment Vercel sets these itself.
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, '.env.local'), override: true, quiet: true });

const fp = (value: string): string =>
    `${value.slice(0, 9)}… len=${value.length} sha256=${createHash('sha256').update(value).digest('hex').slice(0, 10)}`;

/** A key's own prefix carries its account: `sk_live_51TDxz…` is account `acct_1TDxz…`. */
const keySegment = (key: string): string => key.replace(/^(?:sk|pk|rk)_(?:live|test)_/, '');
const accountSegment = (accountId: string): string => `5${accountId.replace(/^acct_/, '')}`;
const sameAccount = (key: string, accountId: string): boolean =>
    keySegment(key).slice(0, 8) === accountSegment(accountId).slice(0, 8);
const accountFromKey = (key: string): string => `acct_${keySegment(key).slice(1, 13)}…`;

const stripeGet = async (key: string, endpoint: string): Promise<any> => {
    const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
    });
    return res.json();
};

const fetchText = async (url: string): Promise<string> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return res.ok ? res.text() : '';
};

/** The publishable key the deployed site serves — public by definition. */
const deployedPublishableKey = async (base: string): Promise<string | null> => {
    const entry = /\/assets\/index-[A-Za-z0-9._-]+\.js/.exec(await fetchText(`${base}/`))?.[0];
    if (!entry) return null;
    const chunks = [...new Set((await fetchText(base + entry)).match(/assets\/[A-Za-z0-9._-]+\.js/g) ?? [])];
    // The publishable key sits in the lazy checkout chunk; look there first, then
    // elsewhere, capped so a big build cannot turn this into a crawl.
    const ordered = [...chunks.filter((c) => /checkout/i.test(c)), ...chunks.filter((c) => !/checkout/i.test(c))].slice(0, 8);
    for (const chunk of ordered) {
        const pk = /pk_(?:live|test)_[A-Za-z0-9]{20,}/.exec(await fetchText(`${base}/${chunk}`))?.[0];
        if (pk) return pk;
    }
    return null;
};

const main = async (): Promise<number> => {
    const key = (process.env.STRIPE_SECRET_KEY ?? '').trim();
    const publishable = (process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim();
    const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
    const site = (process.env.SITE_URL ?? 'https://sgcoalition.xyz').replace(/\/$/, '');

    console.log(`Stripe configuration — read-only  [source: ${process.env.VERCEL ? `Vercel (${process.env.VERCEL_ENV ?? 'deployment'})` : '.env (+ .env.local)'}]`);

    if (!key) {
        console.log('FAIL  no STRIPE_SECRET_KEY in this environment — every server route that touches Stripe throws at import.');
        return 2;
    }
    if (!/^(?:sk|rk)_live_[A-Za-z0-9]+$/.test(key)) {
        console.log(`FAIL  STRIPE_SECRET_KEY ${fp(key)} is not a live secret key (sk_live_… or rk_live_…).`);
        return 2;
    }
    console.log(`key     ${fp(key)}${key.startsWith('rk_') ? '  (restricted)' : ''}`);
    if (webhookSecret) console.log(`whsec   ${fp(webhookSecret)}  (Stripe returns an endpoint secret only at creation, so it cannot be verified here)`);

    const account = await stripeGet(key, 'account').catch((e: unknown) => ({ error: { message: String((e as Error)?.message ?? e) } }));
    if (account.error) {
        console.log(`FAIL  Stripe rejected this key: ${account.error.type ?? 'error'} — ${String(account.error.message).slice(0, 90)}`);
        return 3;
    }
    console.log(`account ${account.id}  "${account.settings?.dashboard?.display_name ?? '(unnamed)'}"  country=${account.country}  charges=${account.charges_enabled}  payouts=${account.payouts_enabled}`);

    const balance = await stripeGet(key, 'balance').catch(() => null);
    if (balance && !balance.error) {
        const available = (balance.available ?? []).map((b: any) => `${b.currency} ${(b.amount / 100).toFixed(2)}`).join(', ');
        console.log(`live read ok — balance ${available || '(none)'}`);
    }

    const endpoints = await stripeGet(key, 'webhook_endpoints?limit=10').catch(() => null);
    if (endpoints && !endpoints.error) {
        const urls: string[] = (endpoints.data ?? []).map((e: any) => e.url as string);
        const wired = urls.find((u: string) => u.includes(new URL(site).hostname));
        console.log(`webhooks ${urls.length} on this account${wired ? ` — including ${wired}` : ` — none for ${new URL(site).hostname}`}`);
    }

    let misconfigured = false;
    if (!publishable) {
        console.log('warn  no VITE_STRIPE_PUBLISHABLE_KEY here — the Stripe Element cannot mount against this environment.');
    } else if (!sameAccount(publishable, account.id)) {
        console.log(`FAIL  VITE_STRIPE_PUBLISHABLE_KEY ${publishable.slice(0, 14)}… is ${accountFromKey(publishable)}, but the secret key is ${account.id}.`);
        misconfigured = true;
    } else {
        console.log(`ok    publishable key is the same account (${publishable.slice(0, 14)}…)`);
    }

    try {
        const deployed = await deployedPublishableKey(site);
        if (!deployed) {
            console.log(`skip  could not read the deployed publishable key from ${site} (offline, or no bundle)`);
        } else if (sameAccount(deployed, account.id)) {
            console.log(`ok    ${site} serves the same account (${deployed.slice(0, 14)}…)`);
        } else {
            console.log(`warn  ${site} serves ${accountFromKey(deployed)}, but this environment's secret key is ${account.id} — local work would not reflect production.`);
        }
    } catch {
        console.log(`skip  could not reach ${site}`);
    }

    if (misconfigured) {
        console.log('\nFAILED — this environment is misconfigured (see above).');
        return 4;
    }
    console.log('\nOK — key alive, and pointed at a consistent account.');
    return 0;
};

process.exitCode = await main();
