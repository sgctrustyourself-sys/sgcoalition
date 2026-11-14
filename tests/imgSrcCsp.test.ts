/**
 * img-src used to be the policy's loosest clause: `'self' data: https:`, i.e.
 * every HTTPS host on the internet was allowed to serve an image. That is not a
 * capability the storefront needs — catalog photography lives on exactly two
 * hosts (Imgur originals and Supabase Storage copies), local assets are `'self'`,
 * and the wizard dashboard reads IPFS images through one gateway.
 *
 * This test is the lock, in both directions:
 *   - every image URL the catalog or wizard data carries must be permitted by
 *     `img-src`, so a host swap cannot silently break product photography when
 *     the browser refuses the request;
 *   - every host `img-src` permits must be one the data actually uses, so the
 *     allowlist cannot quietly grow back into a wildcard;
 *   - the directive must keep `'self'` and `data:` and must never regain a bare
 *     `https:` or `*` token.
 *
 * The live `products.images` column is not readable from CI. Its two writers —
 * the seed in `constants/products.ts` / `constants.ts` and the admin upload path
 * (`services/productUpload.ts` → Supabase Storage) — are, and both are covered.
 * `scripts/auditImagePaths.ts` is the operator check against the live table.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INITIAL_PRODUCTS } from '../constants/products';
import { PRODUCT_IMAGE_URLS } from '../utils/localImageAssets';
import { MOCK_WIZARDS } from '../data/mockWizards';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string): string => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

/** The `img-src` value of a config file's CSP header (vercel.json or netlify.toml). */
const imgSrcDirective = (config: string): string => {
    const match = config.match(/img-src([^;"\\]*)/);
    return match ? match[1].trim() : '';
};

const tokensOf = (directive: string): string[] => directive.split(/\s+/).filter(Boolean);

/** Every value of a nested literal, so PRODUCT_IMAGE_URLS keeps working if it grows a level. */
const flattenStrings = (value: unknown, into: string[] = []): string[] => {
    if (typeof value === 'string') {
        into.push(value);
    } else if (value && typeof value === 'object') {
        for (const nested of Object.values(value)) flattenStrings(nested, into);
    }
    return into;
};

/**
 * Every image URL the product catalog and the wizard dashboard can render:
 *   - `constants/products.ts` INITIAL_PRODUCTS `images` arrays (the Supabase-
 *     backed seed the storefront falls back to),
 *   - `constants.ts` INITIAL_PRODUCTS `productImage` fields (the legacy catalog),
 *   - `utils/localImageAssets.ts` PRODUCT_IMAGE_URLS (local paths + Imgur
 *     originals referenced directly by checkout and the live-order feed),
 *   - `data/mockWizards.ts` images (rendered by pages/WizardsDashboard.tsx).
 */
const catalogImageUrls = (): string[] => {
    const urls: string[] = [];

    for (const product of INITIAL_PRODUCTS) {
        urls.push(...(product.images || []));
    }

    for (const match of read('constants.ts').matchAll(/productImage:\s*["']([^"']+)["']/g)) {
        urls.push(match[1]);
    }

    urls.push(...flattenStrings(PRODUCT_IMAGE_URLS));
    urls.push(...MOCK_WIZARDS.map((wizard) => wizard.image).filter(Boolean));

    return urls;
};

const policyTokens = tokensOf(imgSrcDirective(read('vercel.json')));
const allowedHosts = policyTokens
    .filter((token) => token.startsWith('https://'))
    .map((token) => new URL(token).hostname);

describe('img-src allowlist vs catalog images', () => {
    it('is an enumerated host list, not a wildcard', () => {
        expect(policyTokens.length).toBeGreaterThan(3);
        expect(policyTokens).toContain("'self'");
        expect(policyTokens).toContain('data:');
        // components/ui/ImageCropperModal.tsx previews the selected file through
        // URL.createObjectURL() + new Image(); without blob: the admin cropper
        // silently shows nothing once the wildcard is gone.
        expect(policyTokens).toContain('blob:');
        expect(policyTokens).not.toContain('https:');
        expect(policyTokens.some((token) => token.includes('*'))).toBe(false);
        // Pinned deliberately: widening the clause means adding a host both here
        // and to the data that needs it, in the same commit.
        expect([...allowedHosts].sort()).toEqual([
            'gateway.pinata.cloud',
            'i.imgur.com',
            'tvacscfbzcmjlcekjcsn.supabase.co',
        ]);
    });

    it('permits every image URL the catalog and wizard data carry', () => {
        const urls = catalogImageUrls();
        // Anti-vacuity: the scan must actually see the catalog, not silently
        // match nothing after a data-file move.
        expect(urls.length).toBeGreaterThan(100);

        for (const url of urls) {
            if (url.startsWith('/') || url.startsWith('data:')) continue; // 'self' / data:
            const parsed = new URL(url);
            expect(parsed.protocol, `${url} must be https`).toBe('https:');
            expect(
                allowedHosts,
                `${url} points at ${parsed.hostname}, which img-src does not permit`,
            ).toContain(parsed.hostname);
        }
    });

    it('permits no host the data does not use', () => {
        const usedHosts = new Set(
            catalogImageUrls()
                .filter((url) => url.startsWith('http'))
                .map((url) => new URL(url).hostname),
        );
        for (const host of allowedHosts) {
            expect(usedHosts.has(host), `img-src allows ${host} but no catalog image uses it`).toBe(true);
        }
    });

    it('keeps the Netlify mirror on the same img-src', () => {
        // netlify.toml is not the deploy target, but a stale wildcard there is a
        // policy drift waiting to bite whichever host serves the site next.
        expect(tokensOf(imgSrcDirective(read('netlify.toml'))).sort()).toEqual([...policyTokens].sort());
    });
});
