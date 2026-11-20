-- ============================================
-- CSP REPORTS
--
-- /api/csp-report used to console.warn() every violation, which nobody reads:
-- the endpoint existed, browsers posted to it, and the reports went to a log tail
-- no operator opens. This table is where they land now, and
-- /api/admin-csp-reports reads them back for the Command Center card.
--
-- WHO CAN DO WHAT
--   browser   POST /api/csp-report         -> service_role INSERT, no read
--   operator  GET  /api/admin-csp-reports  -> service_role SELECT, behind
--                                             withAdminAuth (api/_adminAuth.ts)
--   nobody else. RLS is enabled with NO policies, so an anon or authenticated
--   client cannot select, insert, update or delete; only the service-role client
--   the two handlers construct can touch the table.
--
-- EVERY COLUMN IS ATTACKER-SHAPED. A violation report is a browser-authored
-- body, so each field is bounded text (the handler truncates before insert),
-- rendered as text by the admin card, and bound as a parameter by PostgREST —
-- never concatenated into SQL.
-- ============================================

CREATE TABLE IF NOT EXISTS public.csp_reports (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 'document-uri' as the browser sent it; '' when the report omitted it.
    document_uri        TEXT NOT NULL DEFAULT '',
    -- 'violated-directive' (legacy key) or 'effective-directive' (spec key).
    -- The handler writes whichever the report carried, preferring the effective
    -- one, so a report never lands with an empty directive by accident.
    violated_directive  TEXT NOT NULL DEFAULT '',
    effective_directive TEXT,
    blocked_uri         TEXT,
    source_file         TEXT,
    line_number         INTEGER,
    column_number       INTEGER,
    sample              TEXT,
    disposition         TEXT
);

ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

-- The card asks "how many in the last 24h / 7d / 30d" and "which directives are
-- firing now", both of which sort by recency; both indexes lead with created_at.
CREATE INDEX IF NOT EXISTS csp_reports_created_at_idx
    ON public.csp_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS csp_reports_directive_created_at_idx
    ON public.csp_reports (violated_directive, created_at DESC);
