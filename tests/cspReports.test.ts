// tests/cspReports.test.ts
//
// Locks the CSP-report pipeline:
//   1. the handler still returns 204 for a valid report — including when the
//      insert fails, because the browser must never see a persistence error;
//   2. the insert is bounded (browser-authored strings are attacker-shaped);
//   3. the migration enables RLS with no policies and indexes recency;
//   4. the route table, rate-limit read exemption and dashboard card stay wired.
//
// The Supabase client is mocked, so these tests assert the shape of the row and
// the response contract, not a live database.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const insert = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: () => ({ insert }),
    }),
}));

import handler from '../api/_handlers/csp-report';

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

describe('POST /api/csp-report persistence', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        insert.mockReset();
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
