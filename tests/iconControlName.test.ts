// tests/iconControlName.test.ts
//
// GUARD: a control must say what it does, whether or not it sits in a dialog.
//
// tests/modalOverlayFocusTrapCoverage.test.ts proves every dialog is named, and
// tests/*DialogAccessibleName.test.tsx prove specific controls inside dialogs
// are named. This guard covers the rest of the surface — and so the dialogs
// too — navbar, footer, share rows, media lightboxes, cart drawer, empty states
// and page headers. An X, arrow or share icon with no text is announced as just
// "button"/"link", and there are many of those on a single page, so the role
// alone gives a screen-reader user no way to pick one.
//
// Rule: every icon-only <button> or <a> anywhere under the app must carry an
// accessible name — a non-empty aria-label, aria-labelledby, title, or an
// <img alt> — unless its own content renders text. Content counts when the
// control has:
//   - a non-whitespace JSX text child (`Cancel`),
//   - a JSX expression child (`{label}`, `{busy ? 'Saving' : 'Save'}`),
//     because an expression can render text and the guard cannot know which,
//   - an <img alt> descendant, which is the link image's own name.
// Icon children are JSX elements with no text children, so a control whose only
// child is <X /> or an <svg> is flagged.
//
// <a> is included because the failure is worse for a link: an icon-only link
// with no name is announced as "link", and a link that leaves the page should
// say so. `target="_blank"` is not an accessible name.
//
// Files are parsed with the TypeScript parser the project already ships, the
// same tool the overlay coverage guard uses, so apostrophes in attribute
// expressions and nested JSX cannot fool the scan.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');

/** Directories that never contain production UI surfaces. */
const EXCLUDED_DIRS = new Set([
    'node_modules',
    'dist',
    'docs',
    'tests',
    'public',
    'coverage',
    '.git',
    '.freebuff',
    '.hyperframes',
    '.vercel',
]);

/** Elements that act as controls and therefore need a name. */
const CONTROL_TAGS = new Set(['button', 'a']);

interface Offender {
    file: string;
    line: number;
    tag: string;
}

function tsxFiles(dir: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) tsxFiles(full, found);
        else if (entry.name.endsWith('.tsx')) found.push(full);
    }
    return found;
}

const NAME_ATTRIBUTES = new Set(['aria-label', 'aria-labelledby', 'title']);

function attributeName(node: ts.JsxAttribute): string | null {
    return ts.isIdentifier(node.name) ? node.name.text : null;
}

/** True when the control supplies its own accessible name. */
function hasAccessibleName(
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    file: ts.SourceFile,
): boolean {
    for (const property of node.attributes.properties) {
        if (!ts.isJsxAttribute(property)) continue;
        const name = attributeName(property);
        if (!name || !NAME_ATTRIBUTES.has(name)) continue;
        if (!property.initializer) return true;
        const value = property.initializer.getText(file);
        // aria-label="" / title='' is the same as no name.
        if (value === '""' || value === "''" || value === '``') continue;
        return true;
    }
    return false;
}

/** True when this <img> gives its surrounding control a name. */
function imageNamesControl(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    file: ts.SourceFile,
): boolean {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    if (opening.tagName.getText(file) !== 'img') return false;

    const alt = opening.attributes.properties.find(
        (property): property is ts.JsxAttribute =>
            ts.isJsxAttribute(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'alt',
    );

    if (!alt?.initializer) return false;
    const value = alt.initializer.getText(file);
    return value !== '""' && value !== "''" && value !== '``';
}

/** True when the control's own content can render text or name it. */
function contentRendersText(node: ts.JsxElement, file: ts.SourceFile): boolean {
    const scan = (children: readonly ts.JsxChild[]): boolean =>
        children.some((child) => {
            if (ts.isJsxText(child)) return child.getText(file).trim().length > 0;
            if (ts.isJsxExpression(child)) return Boolean(child.expression);
            if (ts.isJsxElement(child)) {
                return imageNamesControl(child, file) || scan(child.children);
            }
            if (ts.isJsxSelfClosingElement(child)) return imageNamesControl(child, file);
            if (ts.isJsxFragment(child)) return scan(child.children);
            return false;
        });

    return scan(node.children);
}

function unnamedIconControls(source: string, filePath: string): Offender[] {
    const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const offenders: Offender[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isJsxElement(node)) {
            const opening = node.openingElement;
            const tag = opening.tagName.getText(file);
            if (
                CONTROL_TAGS.has(tag) &&
                !hasAccessibleName(opening, file) &&
                !contentRendersText(node, file)
            ) {
                const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
                offenders.push({
                    file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
                    line: line + 1,
                    tag: opening.getText(file).replace(/\s+/g, ' ').slice(0, 160),
                });
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(file);
    return offenders;
}

describe('icon-only controls', () => {
    const files = tsxFiles(ROOT);

    it('all carry an accessible name', () => {
        const offenders = files.flatMap((filePath) =>
            unnamedIconControls(fs.readFileSync(filePath, 'utf8'), filePath),
        );

        const report = offenders
            .map((entry) => `${entry.file}:${entry.line} — ${entry.tag}`)
            .join('\n');

        expect(
            offenders,
            `Icon-only buttons/links with no accessible name. Add aria-label (for a\n` +
                `dismissal use "Close modal"; otherwise name the action, e.g. "Share on X"):\n${report}`,
        ).toEqual([]);
    });

    it('scans every surface that prompted this guard', () => {
        const scanned = files.map((file) => path.relative(ROOT, file).replace(/\\/g, '/'));
        expect(scanned.length).toBeGreaterThan(100);
        for (const surface of [
            'components/Navbar.tsx',
            'components/Footer.tsx',
            'components/SocialShare.tsx',
            'components/WishlistShare.tsx',
            'components/MobileBottomNav.tsx',
            'components/CartDrawer.tsx',
            'components/AnnouncementBar.tsx',
            'components/FloatingHelpButton.tsx',
            'components/ProductReviews.tsx',
            'components/ui/PhotoLightbox.tsx',
            'pages/AIPortal.tsx',
            'pages/ProductPage.tsx',
        ]) {
            expect(scanned).toContain(surface);
        }
    });
});
