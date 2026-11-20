// api/_handlers/crypto-verify.ts
// Server-side verifier for direct USDC-on-Polygon checkout payments.
//   POST /api/crypto-verify  { orderRef, txHash } — check one customer-
//         submitted transfer against the chain. Idempotent: a paid order
//         answers 'confirmed' without touching the chain.
//   GET  /api/crypto-verify?orderRef=... — read-only derived status for
//         the checkout polling UI (never writes).
//
// Verdicts: 'confirmed' (match — order flips to paid), 'underpaid'
// (transfer found but short — stays pending, queued for manual review),
// 'awaiting' (hash not among the merchant's recent receipts yet — unmined,
// wrong hash, or outside the paged window; the client keeps polling, then
// falls back to the manual email flow).
//
// Fail-closed everywhere: no explorer key, chain error, or non-crypto
// order never confirms. Stripe paths are untouched — this handler only
// ever transitions crypto orders from pending to paid.
//
// Storage (migration-tolerant): the crypto_* order columns
// (supabase/migrations/20261020_crypto_verify_columns.sql) are written
// when they exist; when the migration has not landed the update falls back
// to payment_reference + notes markers, which is exactly how crypto orders
// already record the tx hash today. The tx-reuse check reads
// payment_reference only, so it holds pre- and post-migration.
//
// Observe-only mode: when the `?observe=true` query param is supplied, the
// POST handler skips all DB writes and simply logs the verdict to the console.
// This enables safe validation on live traffic without risking accidental
// order state changes. The query param is also accepted on GET requests and
// echoed back in the response body as `observe: true`.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { errorMessage } from '../../utils/errorMessage.js';
import {
    createHttpError,
    parseBody,
    setCorsHeaders,
} from '../_helpers.js';
import {
    baseUnitsToUsdc,
    evaluateUsdcTransfer,
    explorerApiKey,
    findUsdcTransferByHash,
    isValidTxHash,
    loadMerchantCryptoConfig,
    usdcDollarsToBaseUnits,
} from '../../services/cryptoWatcher.js';

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }
    return createClient(supabaseUrl, serviceRoleKey);
}

type OrderRecord = Record<string, any>;

async function loadOrder(supabase: SupabaseClient, orderRef: string): Promise<OrderRecord | null> {
    const ref = String(orderRef || '').trim();
    if (!ref) return null;
    const byId = await supabase.from('orders').select('*').eq('id', ref).maybeSingle();
    if (byId.error) throw createHttpError(500, byId.error.message || 'Order lookup failed.');
    if (byId.data) return byId.data as OrderRecord;
    const byNumber = await supabase.from('orders').select('*').eq('order_number', ref).maybeSingle();
    if (byNumber.error) throw createHttpError(500, byNumber.error.message || 'Order lookup failed.');
    return (byNumber.data as OrderRecord) || null;
}

// The crypto_* columns may not exist yet (migration not applied). Detect a
// missing-column failure so the write can fall back to the pre-migration
// payment_reference + notes markers.
function isColumnError(e: unknown): boolean {
    const details = (e ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
    const t = String((details.code || '') + ' ' + (details.message || '') + ' ' + (details.details || '')).toLowerCase();
    return t.includes('crypto_') || t.includes('schema cache') || t.includes('does not exist');
}

function appendNote(notes: unknown, line: string): string {
    const combined = [String(notes || '').trim(), line].filter(Boolean).join('\n');
    // Notes are unbounded operator text; keep the marker history from
    // growing a row without limit on repeated verify attempts.
    return combined.length > 4000 ? combined.slice(combined.length - 4000) : combined;
}

// Best-effort crypto_* marker write: applied when the migration columns
// exist, silently skipped when they do not (the payment_reference + notes
// markers below are the durable record either way).
async function tryCryptoMarker(
    supabase: SupabaseClient,
    orderId: string,
    marker: Record<string, unknown>,
): Promise<void> {
    try {
        const { error } = await supabase.from('orders').update(marker).eq('id', orderId);
        if (error && !isColumnError(error)) throw new Error(error.message);
    } catch {
        // Pre-migration schema or transient write failure — the base
        // payment_reference/notes update is what the flow depends on.
    }
}

function derivedStatus(order: OrderRecord): string {
    if (String(order.payment_status || '').toLowerCase() === 'paid') return 'confirmed';
    if (String(order.crypto_status || '').toLowerCase() === 'underpaid') return 'underpaid';
    if (/crypto underpaid/i.test(String(order.notes || ''))) return 'underpaid';
    if (order.payment_reference || order.crypto_tx_hash) return 'submitted';
    return 'awaiting';
}

// ---------------------------------------------------------------------------
// Observe-only mode
// ---------------------------------------------------------------------------

function isObserveMode(req: ApiRequest): boolean {
    return String(req.query?.observe || '').toLowerCase() === 'true';
}

// ---------------------------------------------------------------------------
// verifyTransfer — with observe-only support
// ---------------------------------------------------------------------------

async function verifyTransfer(req: ApiRequest, res: ApiResponse): Promise<void> {
    const observe = isObserveMode(req);
    const body = parseBody(req);
    const orderRef = String(body.orderRef ?? body.orderId ?? body.orderNumber ?? '').trim();
    const txHash = String(body.txHash ?? '').trim();
    if (!orderRef) throw createHttpError(400, 'orderRef is required.');
    if (!isValidTxHash(txHash)) throw createHttpError(400, 'A valid transaction hash (0x + 64 hex chars) is required.');

    const supabase = getSupabaseAdmin();
    const order = await loadOrder(supabase, orderRef);
    if (!order) throw createHttpError(404, 'Order not found.');
    if (String(order.payment_method || '').toLowerCase() !== 'crypto') {
        throw createHttpError(409, 'Only USDC (crypto) orders can be verified here.');
    }
    // Idempotent: an already-paid order answers without a chain call, so
    // poll retries after confirmation are free and harmless.
    if (String(order.payment_status || '').toLowerCase() === 'paid') {
        if (observe) {
            console.log('[crypto-verify-observe] order already paid, status=confirmed, txHash=' + txHash);
            res.status(200).json({ status: 'confirmed', expectedUsdc: Number(order.total || 0).toFixed(2), observe: true });
            return;
        }
        res.status(200).json({ status: 'confirmed', expectedUsdc: Number(order.total || 0).toFixed(2) });
        return;
    }

    // One payment confirms one order: a hash already recorded on another
    // order's payment_reference is rejected.
    const reuse = await supabase.from('orders').select('id').eq('payment_reference', txHash).limit(2);
    if (reuse.error) throw createHttpError(500, reuse.error.message || 'Duplicate check failed.');
    const otherUse = ((reuse.data as Array<{ id: string }> | null) || []).some(r => String(r.id) !== String(order.id));
    if (otherUse) throw createHttpError(409, 'This transaction is already recorded on another order.');

    const config = await loadMerchantCryptoConfig(supabase);
    const apiKey = explorerApiKey();
    if (!apiKey) throw createHttpError(503, 'On-chain verification is not configured — your order is pending manual confirmation.');

    const createdMs = Date.parse(String(order.created_at || ''));
    const windowStartMs = Number.isFinite(createdMs) ? createdMs : Date.now();
    const windowEndMs = windowStartMs + config.windowHours * 3_600_000;

    let transfer;
    try {
        transfer = await findUsdcTransferByHash({
            merchantAddress: config.merchantAddress,
            usdcContract: config.usdcContract,
            apiKey,
            txHash,
            windowStartMs,
        });
    } catch (e) {
        throw createHttpError(502, errorMessage(e) || 'Chain lookup failed.');
    }

    // Not among the merchant's recent receipts: unmined, mistyped hash, or
    // outside the paged window. 'awaiting', never a verdict — the client
    // keeps polling, then falls back to the manual email flow.
    if (!transfer) {
        if (observe) {
            console.log('[crypto-verify-observe] hash=' + txHash + ' not found among recent receipts; status=awaiting, orderRef=' + orderRef);
            res.status(202).json({ status: 'awaiting', expectedUsdc: Number(order.total || 0).toFixed(2), observe: true });
            return;
        }
        await tryCryptoMarker(supabase, String(order.id), {
            crypto_status: 'submitted',
            crypto_tx_hash: txHash,
            crypto_expected_usdc: Number(order.total || 0),
            crypto_merchant_address: config.merchantAddress,
        });
        res.status(202).json({ status: 'awaiting', expectedUsdc: Number(order.total || 0).toFixed(2) });
        return;
    }

    const expectedBaseUnits = usdcDollarsToBaseUnits(order.total);
    const { verdict } = evaluateUsdcTransfer(
        { to: transfer.to, contractAddress: transfer.contractAddress, valueBaseUnits: transfer.valueBaseUnits, timestampMs: transfer.timestampMs },
        {
            merchantAddress: config.merchantAddress,
            usdcContract: config.usdcContract,
            expectedBaseUnits,
            windowStartMs,
            windowEndMs,
        },
    );
    const receivedUsdc = baseUnitsToUsdc(transfer.valueBaseUnits);
    const expectedUsdc = Number(order.total || 0).toFixed(2);
    const now = new Date().toISOString();

    if (verdict === 'confirmed') {
        if (observe) {
            console.log('[crypto-verify-observe] confirmed: ' + receivedUsdc + ' USDC tx=' + txHash + ' orderRef=' + orderRef);
            res.status(200).json({ status: 'confirmed', expectedUsdc, receivedUsdc, txHash, observe: true });
            return;
        }
        const baseUpdate: Record<string, unknown> = {
            payment_status: 'paid',
            paid_at: now,
            payment_reference: txHash,
            notes: appendNote(order.notes, `Crypto confirmed: ${receivedUsdc} USDC (tx ${txHash})`),
        };
        const fullUpdate: Record<string, unknown> = {
            ...baseUpdate,
            crypto_status: 'confirmed',
            crypto_tx_hash: txHash,
            crypto_expected_usdc: Number(order.total || 0),
            crypto_merchant_address: config.merchantAddress,
            crypto_confirmed_amount: receivedUsdc,
            crypto_confirmed_at: now,
        };
        const first = await supabase.from('orders').update(fullUpdate).eq('id', order.id);
        if (first.error) {
            if (!isColumnError(first.error)) throw createHttpError(500, first.error.message || 'Order confirm failed.');
            const second = await supabase.from('orders').update(baseUpdate).eq('id', order.id);
            if (second.error) throw createHttpError(500, second.error.message || 'Order confirm failed.');
        }
        res.status(200).json({ status: 'confirmed', expectedUsdc, receivedUsdc, txHash });
        return;
    }

    if (verdict === 'underpaid') {
        // Stays pending: the buyer tops up (same order — a later verify of
        // the top-up hash confirms) or the operator triages manually.
        // payment_reference is deliberately NOT set — the short payment
        // must not satisfy the tx-reuse check for another order.
        if (observe) {
            console.log('[crypto-verify-observe] underpaid: received ' + receivedUsdc + ' of ' + expectedUsdc + ' USDC tx=' + txHash + ' orderRef=' + orderRef);
            res.status(200).json({ status: 'underpaid', expectedUsdc, receivedUsdc, txHash, observe: true });
            return;
        }
        const baseUpdate: Record<string, unknown> = {
            notes: appendNote(order.notes, `Crypto underpaid: received ${receivedUsdc} of ${expectedUsdc} USDC (tx ${txHash}) — awaiting top-up / manual review`),
        };
        const { error } = await supabase.from('orders').update(baseUpdate).eq('id', order.id);
        if (error) throw createHttpError(500, error.message || 'Order update failed.');
        await tryCryptoMarker(supabase, String(order.id), { crypto_status: 'underpaid', crypto_tx_hash: txHash });
        res.status(200).json({ status: 'underpaid', expectedUsdc, receivedUsdc, txHash });
        return;
    }

    // 'no_match' on a transfer that IS to the merchant in USDC can only be
    // the window (stale hash from an old order) — report awaiting so the UI
    // does not present a definitive failure for a timing edge.
    if (observe) {
        console.log('[crypto-verify-observe] no_match tx=' + txHash + ' orderRef=' + orderRef + ' status=awaiting');
        res.status(202).json({ status: 'awaiting', expectedUsdc, observe: true });
        return;
    }
    res.status(202).json({ status: 'awaiting', expectedUsdc });
}

// ---------------------------------------------------------------------------
// readStatus — with observe-only echo
// ---------------------------------------------------------------------------

async function readStatus(req: ApiRequest, res: ApiResponse): Promise<void> {
    const ref = String(req.query?.orderRef ?? req.query?.orderId ?? '').trim();
    if (!ref) throw createHttpError(400, 'orderRef is required.');
    const supabase = getSupabaseAdmin();
    const order = await loadOrder(supabase, ref);
    if (!order) throw createHttpError(404, 'Order not found.');
    const config = await loadMerchantCryptoConfig(supabase);
    const observe = isObserveMode(req);
    res.status(200).json({
        status: derivedStatus(order),
        expectedUsdc: Number(order.total || 0).toFixed(2),
        txHash: order.payment_reference || order.crypto_tx_hash || null,
        merchantAddress: config.merchantAddress,
        observe: observe,
    });
}

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        if (req.method === 'POST') { await verifyTransfer(req, res); return; }
        if (req.method === 'GET') { await readStatus(req, res); return; }
        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[crypto-verify]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Verification request failed.' });
    }
}