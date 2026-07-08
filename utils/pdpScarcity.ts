import { Product } from '../types';

/**
 * Severity used by PDP rendering to pick a banner color and decide
 * whether to inject a narrative line above the buy box.
 *
 * - quiet    -> plenty of stock; no narrative needed.
 * - notice   -> low stock but still in stock; one strong line.
 * - sold     -> sold out or archived; mirror the existing PDP switch.
 * - numbered -> numbered edition with an X/N story to tell.
 */
export type ScarcitySeverity = 'quiet' | 'notice' | 'sold' | 'numbered';

export interface ScarcityCopy {
    label: string;
    detail: string;
    narrative: string | null;
    /**
     * Optional founder-voice line that wraps the WHY of a limited drop.
     * Mirrors the verbatim message on pages/About.tsx: "I want to keep
     * items limited for now so I can get my hands on each piece
     * directly." Only set when there's a scarcity story to tell
     * (notice / numbered). Renders as a small italic line under the
     * detail in components/ScarcityNarrative.tsx. Always null on
     * 'quiet' so well-stocked PDPs don't pick up banner copy.
     */
    founderNote: string | null;
    severity: ScarcitySeverity;
}

/**
 * Build the scarcity story for a PDP hero. Pure - safe in tests.
 *
 * Order of precedence:
 *   1. Sold / archived -> 'sold'.
 *   2. Numbered edition -> 'numbered' with X/N narrative.
 *   3. totalStock <= 3 -> 'notice' with explicit count.
 *   4. totalStock <= 10 -> 'notice' with milder line.
 *   5. else -> 'quiet' (no narrative).
 */
export function getScarcityCopy(
    product: Pick<Product, 'editionSize' | 'editionSoldCount' | 'pricingTiers' | 'soldAt' | 'archived'>,
    totalStock: number
): ScarcityCopy {
    const isSold = !!product.archived && !!product.soldAt;
    const isArchived = !!product.archived && !isSold;

    if (isSold) {
        return {
            label: 'Sold',
            detail: 'Archived piece',
            narrative: 'This exact piece has already found a home - check the archive or request a similar build.',
            severity: 'sold',
            founderNote: null,
        };
    }

    if (isArchived) {
        return {
            label: 'Archived',
            detail: 'Archive piece',
            narrative: null,
            severity: 'sold',
            founderNote: null,
        };
    }

    if (
        product.editionSize && Number.isFinite(product.editionSize) &&
        product.pricingTiers && product.pricingTiers.length > 0
    ) {
        const editionSize = product.editionSize;
        const soldCount = product.editionSoldCount ?? 0;
        const remaining = Math.max(editionSize - soldCount, 0);
        const nextPieceIndex = soldCount + 1;

        if (remaining === 0) {
            return {
                label: 'Sold Out',
                detail: `${soldCount}/${editionSize} minted`,
                narrative: 'Every piece has been claimed - request a similar build for the next drop.',
                severity: 'sold',
                founderNote: null,
            };
        }

        if (remaining === 1) {
            return {
                label: `Last 1 of ${editionSize}`,
                detail: `Piece ${nextPieceIndex}/${editionSize} is the final make.`,
                narrative: `This is the last piece of an edition of ${editionSize}. When it's gone, it's gone - same fabric, same dye lot, same hand-finish.`,
                severity: 'numbered',
                founderNote: FOUNDER_LIMIT_NOTE,
            };
        }

        if (remaining <= Math.max(2, Math.floor(editionSize * 0.2))) {
            return {
                label: `Only ${remaining} of ${editionSize} left`,
                detail: `${soldCount}/${editionSize} already claimed.`,
                narrative: `Just ${remaining} pieces remain in an edition of ${editionSize}. Each one carries its own piece number - first come, first served.`,
                severity: 'numbered',
                founderNote: FOUNDER_LIMIT_NOTE,
            };
        }

        return {
            label: `${editionSize} piece edition`,
            detail: `${soldCount}/${editionSize} claimed so far.`,
            narrative: `Numbered edition of ${editionSize}. Your piece is the ${nextOrdinal(nextPieceIndex)} made.`,
            severity: 'numbered',
            founderNote: FOUNDER_LIMIT_NOTE,
        };
    }

    if (totalStock === 0) {
        return {
            label: 'Sold Out',
            detail: 'Request a similar custom',
            narrative: 'This drop has no remaining inventory, but a similar custom can be requested.',
            severity: 'sold',
            founderNote: null,
        };
    }

    if (totalStock <= 3) {
        return {
            label: `Only ${totalStock} left`,
            detail: `${totalStock} available total`,
            narrative: `Only ${totalStock} left across all sizes - once they're gone, the next batch carries a different dye lot.`,
            severity: 'notice',
            founderNote: FOUNDER_LIMIT_NOTE,
        };
    }

    if (totalStock <= 10) {
        return {
            label: 'Selling fast',
            detail: `${totalStock} left total`,
            narrative: `Moving quickly - ${totalStock} left across the run.`,
            severity: 'notice',
            founderNote: FOUNDER_LIMIT_NOTE,
        };
    }

    return {
        label: 'Available',
        detail: `${totalStock} available`,
        narrative: null,
        severity: 'quiet',
        founderNote: null,
    };
}

/**
 * Verbatim copy of the founder's About-page note, kept in lock-step with
 * pages/About.tsx > "From the Founder". Same words on both surfaces so a
 * future edit cannot silently drift the catalog and PDP story. The unit
 * tests in tests/pdpScarcity.test.ts pin the verbatim phrase on both
 * sides (the constant here AND the source of pages/About.tsx) so the two
 * surfaces stay synchronized.
 */
const FOUNDER_LIMIT_NOTE = 'I want to keep items limited for now so I can get my hands on each piece directly.';

function nextOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
