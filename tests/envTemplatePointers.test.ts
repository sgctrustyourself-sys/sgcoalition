// @vitest-environment node
//
// README sends operators into `.env.production.template > <banner>`, and a
// banner that was renamed or removed turns that pointer into an instruction
// nobody can follow. That is the drift that left README citing `$env.example`
// for months: `.gitignore` excludes `.env*`, so the file it named was not even
// in the tree, and nothing noticed because a pointer is prose.
//
// The template groups its variables under `# ====` banners, so the pointer can
// be checked mechanically: read both files, and fail when a pointer names a
// banner the template does not have. A pointer is allowed to be prose-shaped,
// but the heading it quotes has to exist.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (relativePath: string) => readFileSync(path.join(projectRoot, relativePath), 'utf8');

const TEMPLATE = '.env.production.template';
const README = 'README.md';

/** Whitespace- and case-insensitive, because a pointer is written for humans. */
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

const BANNER_RULE = /^#\s*={3,}\s*$/;

/**
 * Banner titles from the template's three-line blocks:
 *
 *     # ============================================
 *     # SENTRY — production error reporting (optional)
 *     # ============================================
 */
const bannerTitles = (source: string): string[] => {
    const lines = source.split(/\r?\n/);
    const titles: string[] = [];

    for (let index = 0; index < lines.length - 2; index += 1) {
        if (!BANNER_RULE.test(lines[index])) continue;
        const title = lines[index + 1];
        if (!title.startsWith('# ') || !BANNER_RULE.test(lines[index + 2])) continue;
        titles.push(title.slice(2).trim());
    }

    return titles;
};

/**
 * Every `.env.production.template > …` pointer in the README, with the heading
 * as written. A pointer inside backticks ends at the closing backtick; one in
 * prose ends at the line. A trailing full stop is punctuation, not a title.
 */
const pointerHeadings = (source: string): string[] =>
    [...source.matchAll(/\.env\.production\.template\s*>\s*([^\n`]+)/g)]
        .map((match) => match[1].replace(/\.\s*$/, '').trim())
        .filter(Boolean);

describe('README pointers into .env.production.template', () => {
    const template = readText(TEMPLATE);
    const readme = readText(README);
    const banners = bannerTitles(template);
    const pointers = pointerHeadings(readme);

    it('parses the template banners', () => {
        // Anti-vacuity floor: a broken banner rule would otherwise let the
        // pointer check pass while comparing against nothing.
        expect(banners.length, 'no banners parsed out of the template — the banner rule is broken').toBeGreaterThan(5);
        expect(banners.filter((title) => title.length === 0)).toEqual([]);
    });

    it('finds at least one pointer to check', () => {
        // Also anti-vacuity: if the pointer shape changes, the regex must be
        // updated rather than silently checking zero pointers.
        expect(pointers.length, 'no `template > heading` pointers found in README.md').toBeGreaterThan(0);
    });

    it('every pointer names a banner that exists', () => {
        const known = new Set(banners.map(normalize));
        const dangling = pointers.filter((heading) => !known.has(normalize(heading)));

        expect(
            dangling,
            'README points at `.env.production.template > …` banners that do not exist. '
                + 'Either the banner was renamed/removed, or the pointer is wrong.',
        ).toEqual([]);
    });
});
