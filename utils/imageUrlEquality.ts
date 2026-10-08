// utils/imageUrlEquality.ts
//
// Order-sensitive array equality for image URL lists.
//
// Used by:
//   - scripts/auditImagePaths.ts       (Local↔Remote cross-check)
//   - scripts/syncImageFieldsToSupabase.ts (diff-and-update against DB)
//
// Order-sensitivity is intentional: the PDP carousel renders images[] in
// array order, so if Local and Remote have the same URLs in a different
// order the React app's `{ ...local, ...sp }` spread merge will silently
// present different content from what the operator seeded locally.
//
// Pure utility — no I/O, no side effects. Safe to import from any context
// (browser or server).

/**
 * Strict, order-sensitive array equality with null/undefined tolerance.
 *
 * Two empty arrays are equal. Two nullish values are equal.
 * `[]` and `null` are NOT equal — those are different signals:
 * "no images configured" vs "not present in DB" — drift should surface.
 */
export function urlsEqual(
    a: string[] | null | undefined,
    b: string[] | null | undefined,
): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}
