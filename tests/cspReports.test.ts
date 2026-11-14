// tests/cspReports.test.ts
//
// Locks the CSP-report pipeline:
//   1. the handler still returns 204 for a valid report — including when the
//      insert fails, because the browser must never see a persistence error;
//   2. the insert is bounded (browser-authored strings are attacker-shaped);
//   3. Stripe checkout violations alert the ops inbox, deduped by directive +
//      host, and only after a row actually persisted;
//   4. the migration enables RLS with no policies and indexes recency;
//   5. the route table, rate-limit read exemption and dashboard card stay wired.
//
// The Supabase client and the ops-email owner are mocked, so these tests assert
// the shape of the row, the alert decision, and the response contract — not a
// live database or inbox.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const db = vi.hoisted(() => {
    const state: {
        rows: Array<{
            violated_directive?: string | null;
            effective_directive?: string | null;
            blocked_uri?: string | null;
        }>;
        error: { message: string } | null;
    } = { rows: [], error: null };

    const insert = vi.fn();
    const builder = {
        select: vi.fn(),
        gte: vi.fn(),
        like: vi.fn(),
        limit: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.gte.mockReturnValue(builder);
    builder.like.mockReturnValue(builder);
    builder.limit.mockImplementation(async () => ({ data: state.rows, error: state.error }));

    const from = vi.fn(() => ({ insert, ...builder }));
    return { state, insert, from, builder };
});

const alerts = vi.hoisted(() => ({ notifyAdminCspViolation: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: db.from }),
}));

vi.mock('../services/orderIntake', () => ({
    notifyAdminCspViolation: alerts.notifyAdminCspViolation,
}));

import handler, { CSP_ALERT_DEDUPE_MINUTES } from '../api/_handlers/csp-report';
import { classifyStripeCspAlert } from '../utils/cspAlerts';

const insert = db.insert;

const read = (relativePath: string): string =>
    readFileSync(path.join(process.cwd(), relativePath), 'utf8');

interface FakeResponse {
    statusCode: number;
    body: unknown;
    ended: boolean;
    status: (code: number) => FakeResponse;
    json: (payload: unknown) => FakeResponse;
    end: () => FakeResponse;
}

const makeResponse = (): FakeResponse => {
    const res: FakeResponse = {
        statusCode: 0,
        body: undefined,
        ended: false,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(payload) {
            res.body = payload;
            return res;
        },
        end() {
            res.ended = true;
            return res;
        },
    };
    return res;
};

const makeRequest = (method: string, body: unknown) =>
    ({ method, body, headers: {} }) as never;

const stripeReport = (overrides: Record<string, unknown> = {}) =>
    makeRequest('POST', {
        'csp-report': {
            'document-uri': 'https://sgcoalition.test/checkout',
            'effective-directive': 'frame-src',
            'blocked-uri': 'https://hooks.stripe.com/3ds/challenge',
            ...overrides,
        },
    });

describe('POST /api/csp-report persistence', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        insert.mockReset();
        db.state.rows = [];
        db.state.error = null;
        Object.values(db.builder).forEach((mock) => mock.mockClear());
        alerts.notifyAdminCspViolation.mockReset();
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('inserts a mapped row and returns 204', async () => {
        insert.mockResolvedValue({ error: null });
        const res = makeResponse();

        await handler(
            makeRequest('POST', {
                'csp-report': {
                    'document-uri': 'https://sgcoalition.test/shop',
                    'effective-directive': 'script-src-elem',
                    'blocked-uri': 'https://tracker.test/x.js',
                    'source-file': 'https://sgcoalition.test/assets/app.js',
                    'line-number': 120,
                    'column-number': 9,
                    sample: 'alert(1)',
                    disposition: 'enforce',
                },
            }),
            res as never,
        );

        expect(res.statusCode).toBe(204);
        expect(res.ended).toBe(true);
        expect(insert).toHaveBeenCalledTimes(1);
        expect(insert).toHaveBeenCalledWith({
            document_uri: 'https://sgcoalition.test/shop',
            violated_directive: 'script-src-elem',
            effective_directive: 'script-src-elem',
            blocked_uri: 'https://tracker.test/x.js',
            source_file: 'https://sgcoalition.test/assets/app.js',
            line_number: 120,
            column_number: 9,
            sample: 'alert(1)',
            disposition: 'enforce',
        });
    });

    it('falls back to violated-directive when the spec key is absent', async () => {
        insert.mockResolvedValue({ error: null });
        const res = makeResponse();

        await handler(
            makeRequest('POST', {
                'csp-report': { 'violated-directive': 'img-src', 'document-uri': 'https://sgcoalition.test/' },
            }),
            res as never,
        );

        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({ violated_directive: 'img-src', effective_directive: null }),
        );
        expect(res.statusCode).toBe(204);
    });

    it('truncates browser-authored fields before insert', async () => {
        insert.mockResolvedValue({ error: null });
        const res = makeResponse();

        await handler(
            makeRequest('POST', {
                'csp-report': {
                    'document-uri': `https://x.test/${'a'.repeat(5000)}`,
                    'effective-directive': 'd'.repeat(2000),
                    sample: 's'.repeat(5000),
                },
            }),
            res as never,
        );

        const row = insert.mock.calls[0][0] as Record<string, unknown>;
        expect(String(row.document_uri)).toHaveLength(2048);
        expect(String(row.violated_directive)).toHaveLength(256);
        expect(String(row.sample)).toHaveLength(500);
    });

    it('still returns 204 when the insert reports an error', async () => {
        insert.mockResolvedValue({ error: { message: 'relation "csp_reports" does not exist' } });
        const res = makeResponse();

        await handler(
            makeRequest('POST', { 'csp-report': { 'document-uri': 'https://sgcoalition.test/' } }),
            res as never,
        );

        expect(res.statusCode).toBe(204);
        expect(res.ended).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
    });

    it('still returns 204 when the insert throws', async () => {
        insert.mockRejectedValue(new Error('network down'));
        const res = makeResponse();

        await handler(
            makeRequest('POST', { 'csp-report': { 'document-uri': 'https://sgcoalition.test/' } }),
            res as never,
        );

        expect(res.statusCode).toBe(204);
        expect(res.ended).toBe(true);
    });

    it('returns 400 when the body carries no report', async () => {
        const res = makeResponse();

        await handler(makeRequest('POST', { hello: 'world' }), res as never);

        expect(res.statusCode).toBe(400);
        expect(insert).not.toHaveBeenCalled();
    });

    it('rejects non-POST methods with 405', async () => {
        const res = makeResponse();

        await handler(makeRequest('GET', undefined), res as never);

        expect(res.statusCode).toBe(405);
        expect(insert).not.toHaveBeenCalled();
    });
});

describe('Stripe CSP alert classification', () => {
    it('normalizes script-src-elem to script-src and resolves the host', () => {
        expect(classifyStripeCspAlert({
            effectiveDirective: 'script-src-elem',
            blockedUri: 'https://js.stripe.com/v3/',
        })).toEqual({
            directive: 'script-src',
            host: 'js.stripe.com',
            key: 'script-src|js.stripe.com',
        });
    });

    it('classifies frame-src and connect-src hosts', () => {
        expect(classifyStripeCspAlert({
            effectiveDirective: 'frame-src',
            blockedUri: 'https://hooks.stripe.com/3ds',
        })?.key).toBe('frame-src|hooks.stripe.com');

        expect(classifyStripeCspAlert({
            effectiveDirective: 'connect-src',
            blockedUri: 'https://api.stripe.com/v1/payment_intents',
        })?.key).toBe('connect-src|api.stripe.com');
    });

    it('accepts a scheme-less blocked URI', () => {
        expect(classifyStripeCspAlert({
            effectiveDirective: 'frame-src',
            blockedUri: 'js.stripe.com:443/3ds',
        })?.host).toBe('js.stripe.com');
    });

    it('ignores non-checkout directives and non-Stripe hosts', () => {
        expect(classifyStripeCspAlert({
            effectiveDirective: 'img-src',
            blockedUri: 'https://js.stripe.com/icon.png',
        })).toBeNull();

        expect(classifyStripeCspAlert({
            effectiveDirective: 'frame-src',
            blockedUri: 'https://example.test/frame',
        })).toBeNull();

        expect(classifyStripeCspAlert({
            effectiveDirective: 'script-src',
            blockedUri: 'inline',
        })).toBeNull();

        // Suffix must be a real subdomain boundary.
        expect(classifyStripeCspAlert({
            effectiveDirective: 'script-src',
            blockedUri: 'https://notstripe.com/x.js',
        })).toBeNull();
    });
});

describe('Stripe CSP alert delivery and dedupe', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        insert.mockReset();
        insert.mockResolvedValue({ error: null });
        db.state.rows = [];
        db.state.error = null;
        Object.values(db.builder).forEach((mock) => mock.mockClear());
        alerts.notifyAdminCspViolation.mockReset();
        alerts.notifyAdminCspViolation.mockResolvedValue(undefined);
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('emails once for a persisted Stripe frame-src block', async () => {
        const res = makeResponse();
        await handler(stripeReport(), res as never);

        expect(res.statusCode).toBe(204);
        expect(insert).toHaveBeenCalledTimes(1);
        expect(alerts.notifyAdminCspViolation).toHaveBeenCalledTimes(1);
        expect(alerts.notifyAdminCspViolation).toHaveBeenCalledWith(
            expect.objectContaining({
                directive: 'frame-src',
                host: 'hooks.stripe.com',
                blockedUri: 'https://hooks.stripe.com/3ds/challenge',
                documentUri: 'https://sgcoalition.test/checkout',
                dedupeMinutes: CSP_ALERT_DEDUPE_MINUTES,
            }),
        );
        expect(db.builder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
        expect(db.builder.like).toHaveBeenCalledWith('violated_directive', 'frame-src%');
    });

    it('persists a repeat but suppresses the email inside the window', async () => {
        db.state.rows = [{
            violated_directive: 'frame-src',
            effective_directive: 'frame-src',
            // Different path, same host — still the same offender.
            blocked_uri: 'https://hooks.stripe.com/3ds/earlier-attempt',
        }];

        const res = makeResponse();
        await handler(stripeReport(), res as never);

        expect(res.statusCode).toBe(204);
        expect(insert).toHaveBeenCalledTimes(1);
        expect(alerts.notifyAdminCspViolation).not.toHaveBeenCalled();
    });

    it('alerts for a different Stripe host in the same directive', async () => {
        db.state.rows = [{
            violated_directive: 'script-src',
            effective_directive: 'script-src',
            blocked_uri: 'https://js.stripe.com/v3/',
        }];

        await handler(stripeReport({
            'effective-directive': 'script-src-elem',
            'violated-directive': 'script-src-elem',
            'blocked-uri': 'https://m.stripe.com/4',
        }), makeResponse() as never);

        expect(alerts.notifyAdminCspViolation).toHaveBeenCalledWith(
            expect.objectContaining({ directive: 'script-src', host: 'm.stripe.com' }),
        );
    });

    it('does not query or alert for a Stripe img-src violation', async () => {
        await handler(stripeReport({
            'effective-directive': 'img-src',
            'blocked-uri': 'https://js.stripe.com/icon.png',
        }), makeResponse() as never);

        expect(db.builder.select).not.toHaveBeenCalled();
        expect(insert).toHaveBeenCalledTimes(1);
        expect(alerts.notifyAdminCspViolation).not.toHaveBeenCalled();
    });

    it('does not alert when persistence failed', async () => {
        insert.mockResolvedValue({ error: { message: 'insert failed' } });

        await handler(stripeReport(), makeResponse() as never);

        expect(alerts.notifyAdminCspViolation).not.toHaveBeenCalled();
    });

    it('fails open when the dedupe lookup errors', async () => {
        db.state.error = { message: 'dedupe query down' };

        await handler(stripeReport(), makeResponse() as never);

        expect(warnSpy).toHaveBeenCalledWith(
            '[csp-report] alert dedupe query failed:',
            'dedupe query down',
        );
        expect(alerts.notifyAdminCspViolation).toHaveBeenCalledTimes(1);
    });

    it('still returns 204 when the alert transport rejects', async () => {
        alerts.notifyAdminCspViolation.mockRejectedValue(new Error('mail down'));

        const res = makeResponse();
        await handler(stripeReport(), res as never);

        expect(res.statusCode).toBe(204);
        expect(res.ended).toBe(true);
    });
});

describe('csp_reports migration', () => {
    const sql = read('supabase/migrations/20261114_create_csp_reports.sql');

    it('creates the table idempotently', () => {
        expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.csp_reports/);
        expect(sql).toMatch(/id\s+BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY/);
        expect(sql).toContain('violated_directive');
        expect(sql).toContain('created_at');
    });

    it('enables RLS and grants nobody a policy', () => {
        expect(sql).toMatch(/ALTER TABLE public\.csp_reports ENABLE ROW LEVEL SECURITY/);
        // Service-role-only table: a policy would open it to anon/authenticated.
        expect(sql).not.toMatch(/CREATE POLICY/i);
        expect(sql).not.toMatch(/GRANT .* TO (anon|authenticated)/i);
    });

    it('indexes recency and directive aggregation', () => {
        expect(sql).toMatch(/csp_reports_created_at_idx\s+ON public\.csp_reports \(created_at DESC\)/);
        expect(sql).toMatch(/csp_reports_directive_created_at_idx/);
    });
});

describe('CSP report wiring', () => {
    const routes = read('api/[...slug].ts');

    it('registers the admin summary route', () => {
        expect(routes).toContain("'admin-csp-reports': () => import('./_handlers/admin-csp-reports.js')");
    });

    it('meters the admin read (GET is exempt by default)', () => {
        const block = routes.match(/const READ_LIMITED_SLUGS = new Set\(\[([\s\S]*?)\]\)/);
        expect(block?.[1]).toContain("'admin-csp-reports'");
    });

    it('renders the card on the Command Center', () => {
        const dashboard = read('components/admin/EcosystemCommandCenter.tsx');
        expect(dashboard).toContain("import CspReportCard from './CspReportCard'");
        expect(dashboard).toContain('<CspReportCard />');
    });

    it('guards the summary endpoint with admin auth', () => {
        const endpoint = read('api/_handlers/admin-csp-reports.ts');
        expect(endpoint).toContain('withAdminAuth');
        expect(endpoint).toContain("from('csp_reports')");
        // Count-only queries keep the windows cheap as the table grows.
        expect(endpoint).toContain("select('id', { count: 'exact', head: true })");
    });
});
