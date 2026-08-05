// utils/featuredExclusivity.ts
//
// Shared helper that mirrors the post-write hook in
// api/_handlers/admin-products.ts so add*Product.ts / update*Product.ts
// scripts enforce the same `products.is_featured` exclusivity (at most one
// row = true at any time) the admin API endpoint already enforces.
//
// BACKGROUND
// ----------
// admin-products.ts runs the clear step AFTER a successful insert/update:
//
//     const { data, error } = await supabase.from('products').insert(...);
//     if (dbProduct.is_featured) {
//         await supabase
//             .from('products')
//             .update({ is_featured: false })
//             .eq('is_featured', true)
//             .neq('id', product.id);
//     }
//
// The ordering is deliberate: a failed pre-clear followed by a failed upsert
// would leave the catalog with NO featured product, which is worse than a
// transient duplicate. The same reasoning applies here.
//
// The CLI scripts (scripts/addUnityPolo.ts, addChromeHeartsWallet.ts,
// addSkyyWallet.ts, addAboveAsBelowSet.ts, updateWalletImgur.ts) call
// supabase directly and bypass this hook — so before this helper they
// could leave multiple `is_featured: true` rows in the live shop. This
// helper closes that gap so a single `npx tsx scripts/addXxx.ts` keeps the
// catalog invariant intact.
//
// NOT A TRANSACTION
// -----------------
// The supabase-js client does not support multi-statement transactions;
// admin-products.ts uses the same sequential pattern. A failed clear is
// logged but does NOT throw — the product write is kept and a warning
// surfaces in the script output so the operator can re-run if needed.
// "Transient duplicate featured product" is a better failure mode than
// "no featured product at all" for the storefront.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClearOtherFeaturedOptions {
    /** Logger for warnings on partial failure. Defaults to `console.warn`. */
    warn?: (message: string) => void;
    /** Logger for informational messages. Defaults to `console.log`. */
    log?: (message: string) => void;
}

export interface ClearOtherFeaturedResult {
    /** True iff the helper actually issued a clear write AND it succeeded. */
    cleared: boolean;
    /** Supabase error object if the clear write failed; null on success or no-op. */
    error: unknown | null;
    /** Number of other rows where `is_featured` was set to false. */
    clearedCount: number;
}

/**
 * Mirror of admin-products.ts' featured-exclusivity hook.
 *
 * If `isFeatured` is true, set `is_featured = false` on every OTHER row in
 * `products`. If `isFeatured` is false or undefined, no network call is made.
 *
 * MUST be called AFTER the product write (insert / upsert / update) has
 * succeeded — see the file header for the rationale.
 *
 * @param supabase          Any authenticated Supabase client. The helper
 *                          does not verify RLS — the caller is responsible
 *                          (scripts use VITE_SUPABASE_ANON_KEY with admin
 *                          auth, admin-products.ts uses service-role).
 * @param currentProductId  The id of the row that was just written. Used as
 *                          `neq('id', ...)` so the new featured row keeps
 *                          its flag. REQUIRED — throws if missing, since
 *                          omitting it would self-clear the row we just wrote.
 * @param isFeatured        The value the caller wrote. Falsy → early return.
 *
 * @example
 *   const { error } = await supabase.from('products').upsert([product]);
 *   if (!error && product.is_featured) {
 *       await clearOtherFeaturedProducts(supabase, product.id, product.is_featured);
 *   }
 */
export async function clearOtherFeaturedProducts(
    supabase: SupabaseClient,
    currentProductId: string,
    isFeatured: boolean | undefined,
    options: ClearOtherFeaturedOptions = {}
): Promise<ClearOtherFeaturedResult> {
    if (!isFeatured) {
        return { cleared: false, error: null, clearedCount: 0 };
    }

    const trimmedId = String(currentProductId || '').trim();
    if (!trimmedId) {
        throw new Error(
            'clearOtherFeaturedProducts: currentProductId is required so the new featured row is not self-cleared.'
        );
    }

    const warn = options.warn ?? ((message: string) => console.warn(message));
    const log = options.log ?? ((message: string) => console.log(message));

    // Supabase-js typically returns `{ data, error }` rather than throwing,
    // but network/transport failures CAN throw (the fetch promise rejects
    // before supabase-js can shape the response). Wrap the entire call so
    // a throw doesn't escape — this is a true "never-throws on supabase
    // failures" contract for callers, including retryQueue.ts whose outer
    // catch path would otherwise spuriously loop on insert-then-clear-throw
    // scenarios. Programmer errors (empty currentProductId) still throw
    // above; that's intentional.
    let clearError: unknown = null;
    let count: number | null = null;
    try {
        const result = await supabase
            .from('products')
            .update({ is_featured: false }, { count: 'exact' })
            .eq('is_featured', true)
            .neq('id', trimmedId);
        clearError = result.error;
        count = result.count;
    } catch (err) {
        clearError = err;
    }

    if (clearError) {
        const message =
            (clearError as { message?: string })?.message ?? String(clearError);
        warn(
            `[featured-exclusivity] Failed to clear is_featured on other products after writing ${trimmedId}: ${message}`
        );
        return { cleared: false, error: clearError, clearedCount: 0 };
    }

    const clearedCount = typeof count === 'number' ? count : 0;
    if (clearedCount > 0) {
        log(
            `[featured-exclusivity] Cleared is_featured on ${clearedCount} other product(s); ${trimmedId} is now the sole featured.`
        );
    }
    return { cleared: true, error: null, clearedCount };
}
