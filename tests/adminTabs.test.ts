import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN_TABS, isAdminTab } from '../components/admin/adminTabs';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Pull the ids out of the sidebar's nav definitions, e.g. `{ id: 'git', ...}`.
const navIds = (): string[] =>
    [...read('components/admin/AdminLayout.tsx').matchAll(/\{ id: '([a-z-]+)'/g)].map((m) => m[1]);

// Pull the ids the page renders, i.e. the `case '<id>':` labels of its switch.
const caseIds = (): string[] =>
    [...read('pages/Admin.tsx').matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]);

describe('admin tab registry', () => {
    it('recognises every declared tab and rejects anything else', () => {
        for (const tab of ADMIN_TABS) expect(isAdminTab(tab)).toBe(true);
        expect(isAdminTab('settings')).toBe(false);
        expect(isAdminTab('')).toBe(false);
        expect(isAdminTab(null)).toBe(false);
    });

    it('has no duplicate ids', () => {
        expect(new Set(ADMIN_TABS).size).toBe(ADMIN_TABS.length);
    });

    it('every sidebar item is a declared tab', () => {
        const declared = new Set<string>(ADMIN_TABS);
        const unknown = navIds().filter((id) => !declared.has(id));
        expect(unknown).toEqual([]);
    });

    it('every declared tab renders its own page, not the Products fallback', () => {
        const rendered = new Set(caseIds());
        const missing = ADMIN_TABS.filter((tab) => !rendered.has(tab));
        expect(missing).toEqual([]);
    });

    it('every sidebar item renders a page', () => {
        const rendered = new Set(caseIds());
        const dead = navIds().filter((id) => !rendered.has(id));
        expect(dead).toEqual([]);
    });
});
