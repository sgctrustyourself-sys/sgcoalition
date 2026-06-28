import { supabase } from './supabase';
import type { Product, NumberedPiece } from '../types';

export interface PaidCountsByProduct {
    [productId: string]: number;
}

export interface ActiveTierInfo {
    activeIndex: number;
    activePrice: number;
    activeUntilCount: number | null;
    nextPrice: number | null;
    nextUntilCount: number | null;
    /**
     * Tier-aware copy fragment: "Tier 1 (first 44 units)" for the headlined
     * numbered tier; "Tier 2 (catch-all)" for the post-numbered tier; or a
     * positional string for malformed tier lists.
     */
    label: string;
}

/**
 * Batch-fetch paid-quantity counts for the given product ids via the
 * public.get_product_paid_count RPC. Used by AppContext.fetchProducts to
 * enrich the cached Product list with editionSoldCount so the storefront
 * can render "X/44 minted at $75" without re-querying every PDP render.
 *
 * Failures on individual ids degrade to 0 + a console warning so a single
 * bad rpc doesn't break the whole products list.
 */
export async function fetchPaidCountsByProduct(productIds: string[]): Promise<PaidCountsByProduct> {
    const out: PaidCountsByProduct = {};
    if (productIds.length === 0) return out;
    await Promise.all(productIds.map(async (id) => {
        try {
            const { data, error } = await supabase.rpc('get_product_paid_count', { p_id: id });
            if (error) {
                // Bumped from console.warn to console.error so a Supabase outage
                // surfaces in operator dashboards. The PDP will still render "0/N
                // minted" as a safe-degradation copy; the loud log is what the
                // operator needs.
                console.error('[numberedPieces] get_product_paid_count failed for', id, error);
                out[id] = 0;
                return;
            }
            out[id] = Number(data ?? 0);
        } catch (e) {
            console.error('[numberedPieces] get_product_paid_count threw for', id, e);
            out[id] = 0;
        }
    }));
    return out;
}

/**
 * Fetch the numbered_pieces rows bound to a given order_id. Calls
 * `supabase.from('numbered_pieces').select('*').eq('order_id', orderId)`.
 *
 * The order may include both inventory pieces (auto-bound by the server on
 * order-paid) AND operator-minted pieces (still bound if a refund is in
 * flight -- refunds do NOT release a piece per the schema comment so the
 * customer's NFT twin remains theirs).
 */
export async function fetchPiecesByOrder(orderId: string): Promise<NumberedPiece[]> {
    try {
        const { data, error } = await supabase
            .from('numbered_pieces')
            .select('*')
            .eq('order_id', orderId)
            .order('piece_index');
        if (error) {
            console.warn('[numberedPieces] fetchPiecesByOrder failed:', error);
            return [];
        }
        return (data ?? []).map(mapDbRow);
    } catch (e) {
        console.warn('[numberedPieces] fetchPiecesByOrder threw:', e);
        return [];
    }
}

/**
 * Editorial helper for the admin OrderDetails inline NFT/NFC editor.
 * Routes the write through /api/admin/update-piece-metadata (server-side
 * service-role JWT) rather than direct supabase.from(...).update(...).
 *
 * WHY SERVER-ROUTED (reviewer note):
 * The admin UPDATE policy on numbered_pieces requires
 *   EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
 * -- which fails for Coalition admins because the admin login flow
 * (sessionStorage.coalition_admin_token + /api/admin/verify) does NOT mint
 * a Supabase auth session. Anonymous UPDATE returns 403 with an opaque
 * error and the operator can't tell whether the migration is wrong or auth
 * is missing. The server-side handler uses ADMIN_SESSION_TOKEN as the
 * gate and SUPABASE_SERVICE_ROLE_KEY for the write, mirroring the
 * api/complete-order.ts order-write pattern.
 *
 * UPDATEs ONLY nft_token_id + nfc_tag_url; order_id / piece_index / id are
 * admin-protected and bound by the server on order-paid. Strip empty
 * strings to NULL so the PDP looks up the fallback openseaUrl instead.
 * Pass undefined for any field you don't want to mutate.
 */
export async function updatePieceMetadata(
    pieceId: string,
    updates: { nftTokenId?: string | null; nfcTagUrl?: string | null }
): Promise<{ ok: boolean; error?: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof sessionStorage !== 'undefined') {
        const token = sessionStorage.getItem('coalition_admin_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch('/api/admin/update-piece-metadata', {
            method: 'POST',
            headers,
            body: JSON.stringify({ pieceId, ...updates }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, error: body.error || `HTTP ${res.status}` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
    }
}

/**
 * Tier-presentation copy used by the PDP tier callout. Returns the
 * headline + sub-line strings so the JSX doesn't have to nest three
 * conditional `<span>` rows. Pure function, no network.
 *
 * Three terminal states:
 *   1. Numbered tier active with N > 0 remaining and a next-tier price.
 *   2. Numbered tier just sold out (no remaining at this price).
 *   3. Numbered tier already closed (catch-all tier active).
 *
 * Edge case: tierInfo being null fires only when the product has no tier
 * schema, in which case the PDP shouldn't render the callout at all.
 */
export interface TierCalloutCopy {
    headline: string;
    subline: string | null;
}

export function formatTierCalloutCopy(
    product: Product,
    soldCount: number
): TierCalloutCopy | null {
    const info = getActiveTierInfo(product, soldCount);
    if (!info) return null;

    // No RPC reply yet -> fall back to "edition exists" copy.
    if (soldCount == null || Number.isNaN(soldCount)) {
        return {
            headline: `Numbered edition · ${product.editionSize ?? '?'} pieces total`,
            subline: null,
        };
    }

    const headline = `${soldCount} / ${product.editionSize ?? '?'} minted at $${info.activePrice}`;
    let subline: string | null = null;

    if (info.activeUntilCount != null) {
        const remaining = Math.max(0, info.activeUntilCount - soldCount);
        if (remaining > 0 && info.nextPrice != null) {
            subline = `${remaining} left at $${info.activePrice} · then $${info.nextPrice}`;
        } else if (remaining === 0 && info.nextPrice != null) {
            subline = `Numbered tier fully claimed · next $${info.nextPrice}`;
        }
    } else {
        subline = `Numbered tier closed · $${info.activePrice} for any new units`;
    }

    return { headline, subline };
}

/**
 * Tier resolution copy: returns the active tier + the next-step boundary so
 * the PDP can render "12 / 44 minted at $75 -- 32 left at this price, then
 * 100". Pure function -- no network. Defensive against malformed
 * pricingTiers rows or products with no tier list (returns null).
 */
export function getActiveTierInfo(product: Product, currentSold: number): ActiveTierInfo | null {
    if (!product.pricingTiers || product.pricingTiers.length === 0) return null;
    const tierIndex = product.pricingTiers.findIndex((t) =>
        t.untilCount === null || currentSold < t.untilCount
    );
    if (tierIndex === -1) {
        // Past every defined + open-ended tier. Snapshot the last tier's price
        // so the PDP doesn't render $0 if the operator forgot the catch-all.
        const last = product.pricingTiers[product.pricingTiers.length - 1];
        return {
            activeIndex: product.pricingTiers.length - 1,
            activePrice: last.price,
            activeUntilCount: last.untilCount,
            nextPrice: null,
            nextUntilCount: null,
            label: `Tier ${product.pricingTiers.length}`,
        };
    }
    const active = product.pricingTiers[tierIndex];
    const next = product.pricingTiers[tierIndex + 1] ?? null;
    return {
        activeIndex: tierIndex,
        activePrice: active.price,
        activeUntilCount: active.untilCount,
        nextPrice: next?.price ?? null,
        nextUntilCount: next?.untilCount ?? null,
        label: active.untilCount == null
            ? `Tier ${tierIndex + 1} (catch-all)`
            : `Tier ${tierIndex + 1} (first ${active.untilCount} units)`,
    };
}

/**
 * Translate the snake_case DB row into the camelCase TypeScript shape used
 * by the rest of the app. Mapping is defensive: a missing column returns
 * null/0 instead of `undefined` so consumers don't trip on truthy checks.
 */
function mapDbRow(row: any): NumberedPiece {
    return {
        id: row.id,
        productId: row.product_id,
        pieceIndex: Number(row.piece_index ?? 0),
        orderId: row.order_id ?? null,
        nftTokenId: row.nft_token_id ?? null,
        nfcTagUrl: row.nfc_tag_url ?? null,
        assignedAt: row.assigned_at ?? null,
        createdAt: row.created_at ?? new Date().toISOString(),
    };
}
