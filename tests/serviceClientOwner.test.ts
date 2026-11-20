// tests/serviceClientOwner.test.ts
//
// Extends the Supabase owner guard (tests/supabaseClientOwner.test.ts) to
// Stripe, Resend, and Gemini: one owner per external service, enforced at test
// time. A handler that builds its own client fails this suite — the only
// pass-throughs are:
//
//   - api/_services.ts            — the canonical owner (allowed by design)
//   - api/_handlers/health.ts     — its Stripe probe is a deliberate runtime
//                                  auth check with apiVersion: undefined, which
//                                  is not the cached client's shape; allowed
//                                  with the reason named inline.
//
// Why this test exists: the same class of bug kept recurring across three
// services — a new handler calling `new Stripe(...)` / `new Resend(...)` /
// `new GoogleGenerativeAI(...)` somewhere it did not need to, so a future
// config rotation (new key format, new SDK major, new region) touches N files
// instead of one. The Supabase owner guard proved the shape fixes it; this is
// the same discipline for the other three.
//
// Anti-vacuity: the scan looks for the constructors it is policing, so a
// refactor that removes every sink would fail here rather than passing on
// nothing matched.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

// Server-side files only. Client code never constructs these SDK objects — the
// Stripe page code calls loadStripe (a thin RPC to js.stripe.com), the wallet
// page imports ethers, and there is no browser-side Resend or Gemini.
const SERVER_DIRS = ['api', 'services'];
const SKIP_EXTENSIONS = ['.test.ts', '.test.tsx', '.cjs'];

interface Hit {
    file: string;
    line: number;
    what: 'stripe' | 'resend' | 'gemini';
    snippet: string;
}

const STRIPE_CTOR = /\bnew\s+Stripe\s*\(/g;
const RESEND_CTOR = /\bnew\s+Resend\s*\(/g;
const GEMINI_CTOR = /\bnew\s+GoogleGenerativeAI\s*\(/g;

const findConstructors = (file: string, text: string): Hit[] => {
    const hits: Hit[] = [];
    const scan = (pattern: RegExp, what: Hit['what']) => {
        pattern.lastIndex = 0;
        for (const m of text.matchAll(pattern)) {
            const start = m.index ?? 0;
            const window = text.slice(Math.max(0, start - 60), start + 60).replace(/\n/g, ' ');
            hits.push({
                file,
                line: text.slice(0, start).split('\n').length,
                what,
                snippet: window.trim(),
            });
        }
    };
    scan(STRIPE_CTOR, 'stripe');
    scan(RESEND_CTOR, 'resend');
    scan(GEMINI_CTOR, 'gemini');
    return hits;
};

const serverFiles = (): string[] => {
    const files: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.ts$/.test(entry.name) && !SKIP_EXTENSIONS.some((e) => entry.name.endsWith(e))) {
                files.push(full);
            }
        }
    };
    for (const dir of SERVER_DIRS) {
        const full = path.join(projectRoot, dir);
        if (fs.existsSync(full)) walk(full);
    }
    return files;
};

const ALL_HITS = serverFiles()
    .map((f) => findConstructors(path.relative(projectRoot, f), fs.readFileSync(f, 'utf8')))
    .flat();

const ownerFile = 'api/_services.ts';
const allowedExceptions: Array<{ file: string; reason: string }> = [
    { file: 'api/_handlers/health.ts', reason: 'runtime Stripe auth probe with apiVersion: undefined — not the cached client' },
];

const norm = (f: string) => path.normalize(f).replace(/\\/g, '/');

describe('server-side service clients have a single owner', () => {
    it('finds the constructors it is meant to police (anti-vacuity)', () => {
        // If a refactor renames `new Stripe(...)` or the SDK stops exporting the
        // constructor shape, this fails rather than the suite passing on zero
        // matched sites. These three shapes have all shipped as second
        // constructions in this repo.
        const byWhat = new Map<string, number>();
        for (const h of ALL_HITS) byWhat.set(h.what, (byWhat.get(h.what) ?? 0) + 1);
        expect(byWhat.get('stripe')).toBeGreaterThan(0);
        expect(byWhat.get('resend')).toBeGreaterThan(0);
        expect(byWhat.get('gemini')).toBeGreaterThan(0);
        expect(ALL_HITS.length).toBeGreaterThan(3);
    });

    it('only the canonical owner and the named exceptions construct these clients', () => {
        const violations = ALL_HITS.filter(
            (h) =>
                norm(h.file) !== norm(ownerFile) &&
                !allowedExceptions.some((e) => norm(e.file) === norm(h.file)),
        );

        const report = violations
            .map(
                (h) =>
                    `  ${h.file}:${h.line}  ${h.what}  ${h.snippet}`,
            )
            .join('\n');

        expect(
            violations,
            `These server files construct their own Stripe/Resend/Gemini client instead of using the canonical owner in ${ownerFile}.\n` +
                `Add the file to the allowed-exceptions list in this test only when there is a concrete, documented reason\n` +
                `(health.ts does this for its runtime Stripe auth probe). Otherwise import from api/_services.ts:\n` +
                `  import { stripeClient } from '${ownerFile}';\n` +
                `  import { resendClient } from '${ownerFile}';\n` +
                `  import { geminiClient } from '${ownerFile}';\n\n` +
                report,
        ).toEqual([]);
    });

    it('each allowed exception is still doing the thing it is excused for', () => {
        for (const { file, reason } of allowedExceptions) {
            const hits = ALL_HITS.filter((h) => norm(h.file) === norm(file));
            expect(
                hits.length,
                `${file} is in the allowed-exceptions list (${reason}), but the file no longer constructs the client — remove it from the list.`,
            ).toBeGreaterThan(0);
        }
    });

    it('the canonical owner owns exactly the three services', () => {
        const owner = fs.readFileSync(path.join(projectRoot, ownerFile), 'utf8');
        expect(owner, 'api/_services.ts must export stripeClient').toContain('export function stripeClient');
        expect(owner, 'api/_services.ts must export resendClient').toContain('export function resendClient');
        expect(owner, 'api/_services.ts must export geminiClient').toContain('export function geminiClient');
    });
});
