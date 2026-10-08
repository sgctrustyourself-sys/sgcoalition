// tests/dropRegistry.test.ts
//
// Guards on scripts/story-reveal-specs/drops.ts — the single owner of every
// drop's data. The registry replaced a hand `sed` pass across three documents
// plus a cloned Supabase script per release, and the failure mode that made that
// dangerous was SILENT: a poster could advertise $40 while the PDP charged $75,
// or a five-slide campaign could render four slides with no error.
//
// So these assert the cross-surface agreements rather than the implementation:
//   - the render contract (exactly 5 slides, hero → cta, in order)
//   - the price the poster prints equals the price the storefront charges
//   - the run size the scarcity slide claims equals the inventory actually held
//   - the copy stays inside the platform limits it will be pasted into
//   - a SHIPPED release still has its source images in the repo
//
// The last one is deliberately not applied to the newest drop group: assets are
// photographed and added while a drop is in flight, so requiring them on day one
// would mean either a red suite or a convention nobody enforces.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    DROPS,
    assetBase,
    assetRelPath,
    dropsInGroup,
    formatPrice,
    getDrop,
    listDropGroups,
    listDropSlugs,
} from '../scripts/story-reveal-specs/drops';

const projectRoot = path.resolve(__dirname, '..');
const SLIDE_ORDER = ['hero', 'detail', 'scarcity', 'manifesto', 'cta'] as const;
const releases = Object.values(DROPS);
const newestGroup = listDropGroups()[0];

const assetExists = (spec: (typeof releases)[number]['spec'], which: 'front' | 'back') =>
    fs.existsSync(path.join(projectRoot, assetRelPath(spec, which)));

describe('drop registry', () => {
    it('is not empty and every slug round-trips', () => {
        expect(releases.length).toBeGreaterThan(0);
        for (const slug of listDropSlugs()) {
            expect(getDrop(slug).spec.slug).toBe(slug);
        }
    });

    it('rejects an unknown slug instead of rendering the wrong drop', () => {
        expect(() => getDrop('not-a-drop')).toThrow(/Unknown drop slug/);
        expect(() => getDrop('Not Kebab')).toThrow(/Invalid slug/);
    });

    it('gives every release exactly the five slides the templates expect, in order', () => {
        for (const release of releases) {
            const layouts = release.spec.slides.map((s) => s.layout);
            expect(layouts, `${release.spec.slug} slide order`).toEqual([...SLIDE_ORDER]);
        }
    });

    it('prints the price the storefront charges', () => {
        for (const release of releases) {
            expect(
                release.spec.price,
                `${release.spec.slug}: the poster says ${release.spec.price}, the listing charges $${release.listing.price}`,
            ).toBe(formatPrice(release.listing.price));
        }
    });

    it('claims a run size the inventory can actually hold', () => {
        for (const release of releases) {
            const release_ = release.spec;
            const stock = Object.values(release.listing.sizeInventory).reduce((sum, n) => sum + Number(n || 0), 0);
            const scarcity = release.spec.slides.find((s) => s.layout === 'scarcity');
            expect(release_.x, `${release_.slug} numerator`).toBeLessThanOrEqual(release_.y);
            // grey-wave is the sold-out worked example: its row is archived with 0
            // left, so the claim is historical rather than current.
            if (release.listing.sizeInventory['One Size'] === 0) continue;
            expect(stock, `${release_.slug} claims 1 OF ${release_.y} but holds ${stock} units`).toBe(release_.y);
            if (scarcity?.headline) {
                expect(scarcity.headline).toContain(`${release_.x} OF ${release_.y}`);
            }
        }
    });

    it('keeps sizes and sizeInventory as the same set', () => {
        for (const release of releases) {
            expect(
                [...release.listing.sizes].sort(),
                `${release.spec.slug} sizes vs sizeInventory keys`,
            ).toEqual(Object.keys(release.listing.sizeInventory).sort());
        }
    });

    it('keeps the copy inside the limits it will be pasted into', () => {
        for (const release of releases) {
            const { copy, spec } = release;
            expect(copy.igCaptionLong.length, `${spec.slug} IG long`).toBeLessThanOrEqual(2200);
            expect(copy.igCaptionShort.length, `${spec.slug} IG short`).toBeLessThanOrEqual(2200);
            expect(copy.xSingle.length, `${spec.slug} X single`).toBeLessThanOrEqual(280);
            expect(copy.xThread, `${spec.slug} thread length`).toHaveLength(3);
            for (const [i, tweet] of copy.xThread.entries()) {
                expect(tweet.length, `${spec.slug} tweet ${i + 1}`).toBeLessThanOrEqual(280);
            }
            expect(copy.slackOneLiner.length, `${spec.slug} slack one-liner`).toBeLessThanOrEqual(200);
            expect(copy.hashtagsCanonical.length).toBeGreaterThan(0);
            for (const tag of [...copy.hashtagsCanonical, ...copy.hashtagsTier2]) {
                expect(tag.startsWith('#'), `${spec.slug} hashtag "${tag}"`).toBe(true);
            }
            expect(copy.postBody).not.toMatch(/\{\{|\}\}/);
            expect(copy.postBody.length).toBeGreaterThan(0);
        }
    });

    it('declares image paths the renderer can resolve', () => {
        for (const release of releases) {
            const base = assetBase(release.spec);
            for (const which of ['front', 'back'] as const) {
                const rel = assetRelPath(release.spec, which);
                expect(rel.startsWith('public/images/'), `${release.spec.slug} ${which} path`).toBe(true);
                expect(rel.endsWith('.png'), `${release.spec.slug} ${which} must be a PNG`).toBe(true);
                expect(rel).toContain(base);
            }
            expect(release.spec.images.front).not.toBe(release.spec.images.back);
        }
    });

    it('has distinct post slugs', () => {
        const slugs = releases.map((r) => r.copy.postSlug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('groups releases by drop day, newest first', () => {
        const groups = listDropGroups();
        expect(groups.length).toBeGreaterThan(0);
        expect(groups).toEqual([...groups].sort((a, b) => b.localeCompare(a)));
        const total = groups.reduce((sum, id) => sum + dropsInGroup(id).length, 0);
        expect(total).toBe(releases.length);
    });

    it('has source images on disk for every SHIPPED release', () => {
        const missing: string[] = [];
        for (const release of releases) {
            // The newest drop group is still being photographed; drafts the
            // registry marks awaitingPhotos are mid-shoot the same way.
            if (release.dropId === newestGroup || release.awaitingPhotos) continue;
            for (const which of ['front', 'back'] as const) {
                if (!assetExists(release.spec, which)) missing.push(`${release.spec.slug} ${which}`);
            }
        }
        expect(
            missing,
            `Shipped releases are missing their source images: ${missing.join(', ')}. ` +
                'Add public/images/<name>-{front,back}.png (or the drop cannot be re-rendered).',
        ).toEqual([]);
    });
});

describe('generated drop docs', () => {
    const docPath = (name: string) => path.join(projectRoot, 'docs', name);

    const generated = releases
        .map((r) => ({
            slug: r.spec.slug,
            files: [
                `drop-kit-${r.spec.slug}-${r.spec.x}-${r.spec.y}.md`,
                `drop-copy-${r.spec.slug}-${r.spec.x}-${r.spec.y}.md`,
                `storyboard-${r.spec.slug}-${r.spec.x}-${r.spec.y}.html`,
            ],
        }))
        .filter((entry) => entry.files.every((f) => fs.existsSync(docPath(f))));

    it('has at least one fully documented release (anti-vacuity)', () => {
        expect(generated.length).toBeGreaterThan(0);
    });

    it('leaves no unresolved template tokens behind', () => {
        // The hand `sed` pass this replaced could miss a token silently, and a
        // deck that still says {{price}} is worse than no deck.
        const offenders: string[] = [];
        for (const entry of generated) {
            for (const file of entry.files) {
                const text = fs.readFileSync(docPath(file), 'utf8');
                if (/\{\{[a-z_]+\}\}/.test(text)) offenders.push(file);
            }
        }
        expect(offenders, `Generated docs with unresolved {{tokens}}: ${offenders.join(', ')}`).toEqual([]);
    });

    it('quotes the registry price in the kit and the copy deck', () => {
        for (const entry of generated) {
            const release = getDrop(entry.slug);
            for (const file of entry.files.filter((f) => f.endsWith('.md'))) {
                const text = fs.readFileSync(docPath(file), 'utf8');
                expect(text, `${file} must quote ${release.spec.price}`).toContain(release.spec.price);
            }
        }
    });

    it('is listed in the drops registry ledger', () => {
        const ledger = fs.readFileSync(docPath('drops-registry.md'), 'utf8');
        for (const entry of generated) {
            expect(ledger, `drops-registry.md is missing a row for ${entry.slug}`).toContain(
                `drop-kit-${entry.slug}-`,
            );
        }
    });
});

// The publish path writes into constants/products.ts, which it shares with the
// admin Sync Code button and with `npm run products:sync`. It may only rewrite
// the listing it owns, so it must name that listing — and may never fall back to
// a whole-file mirror, which is what silently deleted five seed-only products.
describe('the drop publish writes only its own listing', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'scripts', 'upsertDropProduct.ts'), 'utf8');

    it('names the listing it may rewrite', () => {
        expect(source, 'drop:list --confirm must target its own listing').toContain("'--only'");
    });

    it('reaches the rule through the script that owns it, not by editing the seed itself', () => {
        expect(source, 'the publish must go through the owner of the seed merge').toContain('syncProducts.ts');
        expect(source, 'and must never rebuild the array itself').not.toMatch(/INITIAL_PRODUCTS\s*[:=]/);
    });
});
