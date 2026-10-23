// tests/headerOverflow.test.ts
//
// Guards the header against horizontal overflow.
//
// The nav is `position: sticky`, and a sticky element only sticks vertically.
// When the header row is wider than the viewport, the document can be scrolled
// sideways, which drags the header off screen and leaves a half-cut nav over
// the content (the bug reported on /ecosystem).
//
// Layout cannot be measured in jsdom, so these assertions pin the class names
// that keep the row inside the viewport:
//
//   - the desktop nav starts at `lg` (1024px), not `md` (768px): the fixed
//     nav content (logo + six links + account cluster + cart) needs ~800px,
//     which does not fit next to a search field at tablet widths
//   - the search wrapper and the input carry `min-w-0`, so the search shrinks
//     instead of forcing the row wider
//   - the burger menu and its panel switch at the same `lg` breakpoint, and
//     the menu carries its own search field
//   - `html { overflow-x: clip }` is the guard rail that stops any page from
//     scrolling sideways (clip, not hidden, so `position: sticky` still works)

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const navbar = read('components/Navbar.tsx');
const searchBar = read('components/SearchBar.tsx');
const css = read('index.css');

describe('header layout', () => {
    it('switches the desktop nav to the lg breakpoint', () => {
        expect(navbar).toMatch(/hidden lg:flex items-center space-x-/);
        // The old md breakpoint is what let the row overflow.
        expect(navbar).not.toMatch(/hidden md:flex items-center space-x-/);
    });

    it('keeps the burger menu and the desktop nav on the same breakpoint', () => {
        expect(navbar).toMatch(/lg:hidden flex items-center space-x-4/);
        expect(navbar).toMatch(/lg:hidden bg-black\/95 backdrop-blur-xl/);
    });

    it('lets the header search shrink instead of widening the row', () => {
        expect(navbar).toMatch(/hidden lg:block flex-1 min-w-0/);
        expect(searchBar).toMatch(/className="w-full min-w-0 /);
    });

    it('gives the mobile menu its own search field', () => {
        expect(navbar).toMatch(/id="mobile-search-bar"/);
        expect(searchBar).toMatch(/id=\{id\}/);
    });

    it('blocks sideways page scrolling without breaking sticky positioning', () => {
        expect(css).toMatch(/overflow-x: clip/);
        expect(css).not.toMatch(/overflow-x: hidden/);
    });
});
