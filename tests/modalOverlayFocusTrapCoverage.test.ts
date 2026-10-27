// tests/modalOverlayFocusTrapCoverage.test.ts
//
// GUARD: a modal surface must be labelled, named, and own a focus trap.
//
// Three rules:
//   1. Any .tsx that renders a full-screen overlay (a `fixed inset-0` layer
//      with a dimming backdrop, including the drawer pattern where the backdrop
//      is an `absolute inset-0` sibling) must declare a modal role. An unlabelled
//      overlay is invisible to assistive tech (and to rules 2 and 3), so it fails
//      here first.
//   2. Any .tsx that renders a modal role (role="dialog", role="alertdialog",
//      role={<conditional>}, an aria-modal attribute, or a native <dialog>) must
//      also import the shared useFocusTrap hook AND call it. Importing without
//      calling is a no-op trap, so it fails too.
//   3. Every element that carries a modal role must also carry an accessible
//      name ON THAT ELEMENT: a non-empty `aria-label`, or an `aria-labelledby`
//      whose ids are defined in the same file (`id="..."` on the heading it
//      points at). The file-level name is not enough — an aria-label on the
//      close button does not name the dialog. `aria-labelledby={titleId}` is
//      accepted when `titleId` comes from useId().
//
// Decorations are ignored: full-screen layers marked `pointer-events-none`
// (backgrounds, gradients) are not overlays, and a solid full-screen takeover
// with no dimming backdrop is not a modal — that is why the intro screen does
// not appear in any of these checks.
//
// Scope: every .tsx in the repo except tests, build output, docs and vendored
// or generated directories. Comments are stripped before matching so a file
// that merely documents the pattern does not count.
//
// When a new overlay legitimately cannot follow a rule (for example a shared
// primitive that traps internally, or a deliberate non-modal takeover), add it
// to ALLOWLIST with a one-line reason. The allowlist is asserted below, so stale
// entries and empty justifications fail the suite rather than rotting.

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

/**
 * Files allowed to skip all three guards, with the reason. Keep this empty unless
 * a shared primitive owns focus and names itself internally, or a full-screen
 * layer is not a modal.
 */
const ALLOWLIST: Record<string, string> = {};

/** Strip JS line and block comments so documentation cannot satisfy the scan. */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ---------- JSX element scan ----------
// The naming rule has to look at the attributes of the element that carries the
// modal role, not anywhere in the file: `<button aria-label="Close" />` next to
// `<div role="dialog" />` must still fail. A hand-rolled tag scanner sounds
// simple until it meets an apostrophe in an attribute expression and swallows
// the rest of the file, so this uses the TypeScript parser the project already
// ships (it parses .tsx with no type-checking, which is all the guard needs).

interface JsxTag {
    /** Element name, e.g. `div` or `dialog`. */
    name: string;
    /** The complete opening element. */
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement;
}

function jsxOpeningTags(source: string): JsxTag[] {
    const file = ts.createSourceFile(
        'guard.tsx',
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );
    const tags: JsxTag[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            tags.push({ name: node.tagName.getText(file), node });
        }
        node.forEachChild(visit);
    };

    visit(file);
    return tags;
}

function attributeOf(tag: JsxTag, name: string): ts.JsxAttribute | undefined {
    return tag.node.attributes.properties.find(
        (property): property is ts.JsxAttribute =>
            ts.isJsxAttribute(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === name,
    );
}

/** True when this element is something the platform treats as a modal. */
function isModalTag(tag: JsxTag): boolean {
    if (tag.name.toLowerCase() === 'dialog') return true;
    if (attributeOf(tag, 'aria-modal')) return true;

    const role = attributeOf(tag, 'role');
    if (!role?.initializer) return false;
    // Covers role="dialog" and role={open ? "dialog" : undefined}.
    return /["'](dialog|alertdialog)["']/.test(role.initializer.getText());
}

/** True when the source renders something the platform treats as a modal. */
function hasModalRole(source: string): boolean {
    return jsxOpeningTags(source).some(isModalTag);
}

/** A static string attribute, or the raw text of a `{...}` expression. */
interface AttributeValue {
    literal?: string;
    expression?: string;
}

function attributeValue(tag: JsxTag, attribute: string): AttributeValue | null {
    const jsxAttribute = attributeOf(tag, attribute);
    if (!jsxAttribute?.initializer) return null;

    const initializer = jsxAttribute.initializer;
    if (ts.isStringLiteral(initializer)) return { literal: initializer.text };
    if (ts.isJsxExpression(initializer)) {
        return { expression: initializer.expression?.getText() ?? '' };
    }
    return null;
}

/**
 * The ids this file defines for its own headings and labels. Both quote styles
 * are accepted because JSX does not care which one an author used.
 */
function idsDefinedIn(source: string): Set<string> {
    const ids = new Set<string>();
    for (const match of source.matchAll(/\bid\s*=\s*"([^"]+)"/g)) ids.add(match[1]);
    for (const match of source.matchAll(/\bid\s*=\s*'([^']+)'/g)) ids.add(match[1]);
    return ids;
}

/** Identifiers whose value comes from the framework's stable id generator. */
function generatedIdNamesIn(source: string): Set<string> {
    return new Set(
        [...source.matchAll(/const\s+(\w+)\s*=\s*(?:React\.)?useId\(\)/g)].map((match) => match[1]),
    );
}

/**
 * True when the dialog element itself carries an accessible name.
 *
 * `aria-labelledby` is preferred over `aria-label`, but it only counts when the
 * ids it points at exist in the same file — a dangling reference names nothing.
 * An expression `aria-labelledby={titleId}` is accepted when `titleId` is a
 * useId() value, which is the only dynamic form that is provably local.
 */
function hasAccessibleName(tag: JsxTag, source: string): boolean {
    const label = attributeValue(tag, 'aria-label');
    if (label?.literal !== undefined && label.literal.trim()) return true;
    if (label?.expression !== undefined) {
        const expression = label.expression.trim();
        if (expression && expression !== 'undefined') return true;
    }

    const labelledBy = attributeValue(tag, 'aria-labelledby');
    if (!labelledBy) return false;

    if (labelledBy.literal !== undefined) {
        const ids = labelledBy.literal.trim().split(/\s+/).filter(Boolean);
        if (ids.length === 0) return false;
        const defined = idsDefinedIn(source);
        return ids.every((id) => defined.has(id));
    }

    const expression = labelledBy.expression?.trim();
    if (!expression) return false;
    return generatedIdNamesIn(source).has(expression);
}

/** True when the source both imports the shared hook and calls it. */
function hasFocusTrap(source: string): boolean {
    const importsHook = /from\s+["'][^"']*hooks\/useFocusTrap["']/.test(source);
    const callsHook = /\buseFocusTrap\s*\(/.test(source);
    return importsHook && callsHook;
}

// Class tokens, not substrings: `fixed-bg` is a background utility, not a
// fixed-position layer, and `inset-0.5` is a different offset.
const FIXED_TOKEN = /(?<![\w-])fixed(?![\w-])/;
const ABSOLUTE_TOKEN = /(?<![\w-])absolute(?![\w-])/;
const INSET_ZERO_TOKEN = /(?<![\w-])inset-0(?![\w-])/;
// A dimming layer: translucent black, a black scrim with bg-opacity, a light
// scrim, or a blur. A solid `bg-[#050505]` takeover is deliberately not a match.
const BACKDROP_TOKEN = /bg-black|bg-white\/|bg-opacity-|backdrop-blur/;

/**
 * True when the source renders a full-screen overlay with a backdrop.
 *
 * Covers both shapes in the codebase:
 *   - the backdrop on the layer itself (`fixed inset-0 bg-black/80`), and
 *   - a transparent layer wrapping an `absolute inset-0` backdrop sibling
 *     (CartDrawer, WizardDetailModal, YoutubeSubmissionsTab).
 * Layers marked `pointer-events-none` are decorative and never count.
 */
function hasFullScreenBackdrop(source: string): boolean {
    const lines = source.split(/\r?\n/);

    return lines.some((line, index) => {
        if (!FIXED_TOKEN.test(line) || !INSET_ZERO_TOKEN.test(line)) return false;
        if (/pointer-events-none/.test(line)) return false;
        if (BACKDROP_TOKEN.test(line)) return true;

        // Look a few lines past the container for the backdrop sibling.
        return lines
            .slice(index, index + 8)
            .some(
                (near) =>
                    ABSOLUTE_TOKEN.test(near) &&
                    INSET_ZERO_TOKEN.test(near) &&
                    BACKDROP_TOKEN.test(near),
            );
    });
}

/** Walk a directory tree and collect .tsx production files. */
function collectTsxFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue;
            collectTsxFiles(full, out);
        } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
            out.push(full);
        }
    }
    return out;
}

const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

describe('modal overlay focus-trap coverage', () => {
    it('recognises every modal-role spelling the guard relies on', () => {
        expect(hasModalRole('<div role="dialog" />')).toBe(true);
        expect(hasModalRole("<div role='alertdialog' />")).toBe(true);
        expect(hasModalRole('<div role={isOpen ? "dialog" : undefined} />')).toBe(true);
        expect(hasModalRole('<div aria-modal="true" />')).toBe(true);
        expect(hasModalRole('<div aria-modal={true} />')).toBe(true);
        expect(hasModalRole('<dialog open />')).toBe(true);

        expect(hasModalRole('<div role="alert" />')).toBe(false);
        expect(hasModalRole('<a href="/dialogs" role="link" />')).toBe(false);
    });

    it('treats an import without a call as no trap', () => {
        const importOnly = "import { useFocusTrap } from '../hooks/useFocusTrap';";
        const callOnly = 'useFocusTrap({ active: true, containerRef });';
        const both = `${importOnly}\n${callOnly}`;

        expect(hasFocusTrap(importOnly)).toBe(false);
        expect(hasFocusTrap(callOnly)).toBe(false);
        expect(hasFocusTrap(both)).toBe(true);
    });

    it('requires the accessible name on the dialog element and validates labelledby ids', () => {
        // True when every modal tag in the snippet is named somewhere in it.
        const named = (snippet: string) =>
            jsxOpeningTags(snippet).filter(isModalTag).every((tag) => hasAccessibleName(tag, snippet));

        expect(named('<div role="dialog" aria-label="Settings" />')).toBe(true);
        expect(named('<div role="dialog" aria-label={title} />')).toBe(true);
        expect(named('<div role="dialog" aria-label={`Inquiry ${title}`} />')).toBe(true);

        expect(named('<div role="dialog" />')).toBe(false);
        expect(named('<div role="dialog" aria-label="" />')).toBe(false);
        expect(named('<div role="dialog" aria-label={undefined} />')).toBe(false);

        // The name must sit on the dialog, not on a sibling control.
        expect(named('<button aria-label="Close" />\n<div role="dialog" />')).toBe(false);

        // aria-labelledby only counts when its ids exist in the same file.
        expect(
            named('<h2 id="settings-title">Settings</h2>\n<div role="dialog" aria-labelledby="settings-title" />'),
        ).toBe(true);
        expect(named('<div role="dialog" aria-labelledby="settings-title" />')).toBe(false);
        expect(
            named("<h2 id='other'>Other</h2>\n<div role=\"dialog\" aria-labelledby='settings-title' />"),
        ).toBe(false);

        // useId() is the only dynamic form the guard can prove is local.
        expect(
            named(
                'const titleId = useId();\n<h2 id={titleId}>Settings</h2>\n<div role="dialog" aria-labelledby={titleId} />',
            ),
        ).toBe(true);
        expect(
            named('const titleId = props.id;\n<div role="dialog" aria-labelledby={titleId} />'),
        ).toBe(false);

        // A native <dialog> is held to the same name rule.
        expect(named('<dialog aria-label="Confirm" />')).toBe(true);
        expect(named('<dialog open />')).toBe(false);
    });

    it('recognises a backdrop overlay and ignores decorative layers', () => {
        expect(hasFullScreenBackdrop('<div className="fixed inset-0 bg-black/80" />')).toBe(true);
        expect(hasFullScreenBackdrop('<div className="fixed inset-0 bg-black bg-opacity-50" />')).toBe(true);
        expect(
            hasFullScreenBackdrop(
                '<div className="fixed inset-0"><div className="absolute inset-0 bg-black/60" /></div>',
            ),
        ).toBe(true);

        expect(hasFullScreenBackdrop('<div className="fixed inset-0 pointer-events-none" />')).toBe(false);
        expect(hasFullScreenBackdrop('<div className="absolute inset-0 bg-black/80" />')).toBe(false);
        expect(hasFullScreenBackdrop('<div className="fixed-bg absolute inset-0" />')).toBe(false);
        expect(hasFullScreenBackdrop('<div className="fixed inset-0 z-50" />')).toBe(false);
        expect(hasFullScreenBackdrop('<div className="fixed inset-0 bg-[#050505]" />')).toBe(false);
    });

    it('scans the real source tree, not an empty list', () => {
        const files = collectTsxFiles(ROOT).map(relative);
        expect(files.length).toBeGreaterThan(150);
        expect(files).toContain('components/admin/ConfirmationModal.tsx');
        expect(files).toContain('components/profile/SGCoinPayoutTab.tsx');
    });

    it('finds the real overlays, so the backdrop rule cannot pass vacuously', () => {
        const overlays = collectTsxFiles(ROOT)
            .map(relative)
            .filter((rel) => hasFullScreenBackdrop(stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'))));

        // One modal, one drawer (backdrop sibling), one admin tab with a preview
        // overlay. If class conventions change, this fails before the coverage
        // rule below starts matching nothing.
        expect(overlays).toContain('components/admin/ConfirmationModal.tsx');
        expect(overlays).toContain('components/CartDrawer.tsx');
        expect(overlays).toContain('components/admin/YoutubeSubmissionsTab.tsx');
        expect(overlays.length).toBeGreaterThan(10);
    });

    it('finds real dialogs named by aria-labelledby, so the naming rule cannot pass vacuously', () => {
        const namedByReference: string[] = [];

        for (const file of collectTsxFiles(ROOT)) {
            const rel = relative(file);
            const source = stripComments(fs.readFileSync(file, 'utf8'));

            for (const tag of jsxOpeningTags(source)) {
                if (!isModalTag(tag)) continue;
                if (!attributeValue(tag, 'aria-labelledby')) continue;
                if (hasAccessibleName(tag, source)) namedByReference.push(rel);
            }
        }

        const files = new Set(namedByReference);
        expect(files.size).toBeGreaterThan(5);
        expect(files).toContain('components/admin/ConfirmationModal.tsx');
        expect(files).toContain('components/admin/OrderManager.tsx');
        expect(files).toContain('components/Invoice.tsx');
    });

    it('every full-screen backdrop overlay declares a modal role', () => {
        const offenders: string[] = [];

        for (const file of collectTsxFiles(ROOT)) {
            const rel = relative(file);
            if (ALLOWLIST[rel]) continue;

            const source = stripComments(fs.readFileSync(file, 'utf8'));
            if (hasFullScreenBackdrop(source) && !hasModalRole(source)) offenders.push(rel);
        }

        expect(
            offenders,
            'A file renders a full-screen overlay with a backdrop but no modal role. ' +
                'Add role="dialog" (or alertdialog) and aria-modal, then wire useFocusTrap; ' +
                'or add the file to ALLOWLIST with a reason.',
        ).toEqual([]);
    });

    it('every file that renders a modal role calls useFocusTrap', () => {
        const offenders: string[] = [];

        for (const file of collectTsxFiles(ROOT)) {
            const rel = relative(file);
            if (ALLOWLIST[rel]) continue;

            const source = stripComments(fs.readFileSync(file, 'utf8'));
            if (hasModalRole(source) && !hasFocusTrap(source)) offenders.push(rel);
        }

        expect(
            offenders,
            'A file renders a modal role without calling useFocusTrap. Wire the overlay ' +
                'onto the shared hook, or add the file to ALLOWLIST with a reason.',
        ).toEqual([]);
    });

    it('every element that renders a modal role carries an accessible name', () => {
        const offenders: string[] = [];

        for (const file of collectTsxFiles(ROOT)) {
            const rel = relative(file);
            if (ALLOWLIST[rel]) continue;

            const source = stripComments(fs.readFileSync(file, 'utf8'));
            for (const tag of jsxOpeningTags(source)) {
                if (!isModalTag(tag)) continue;
                if (hasAccessibleName(tag, source)) continue;
                offenders.push(`${rel} -> ${tag.node.getText().replace(/\s+/g, ' ').slice(0, 140)}`);
            }
        }

        expect(
            offenders,
            'A modal element has no accessible name. Add aria-label, or aria-labelledby ' +
                'pointing at an id defined in the same file; or add the file to ALLOWLIST ' +
                'with a reason.',
        ).toEqual([]);
    });

    it('allowlisted files still exist, still modal, with a real reason', () => {
        for (const [rel, reason] of Object.entries(ALLOWLIST)) {
            const file = path.join(ROOT, rel);
            expect(fs.existsSync(file), `${rel} is allowlisted but no longer exists`).toBe(true);
            expect(reason.trim().length, `${rel} needs a justification in ALLOWLIST`).toBeGreaterThan(0);

            const source = stripComments(fs.readFileSync(file, 'utf8'));
            expect(
                hasModalRole(source) || hasFullScreenBackdrop(source),
                `${rel} no longer matches any guard; drop it from ALLOWLIST`,
            ).toBe(true);
        }
    });
});
