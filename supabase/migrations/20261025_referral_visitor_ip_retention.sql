-- Referral visitor IP retention.
--
-- Resolves the GDPR TODO in 20260711_referral_v2_columns_and_rpc.sql: visitor
-- IPs are personal data, so they are cleared once they are older than the
-- retention window. The rows themselves are kept, so referral counts, tiers
-- and commission history are unaffected. Only the IP columns are nulled.
--
-- Columns cleared:
--   referral_analytics.visitor_ip      (by created_at)
--   referrals.visitor_ip               (by created_at)
--   referral_stats.last_referral_ip    (by last_referral_event_at)
--
-- Scheduling uses pg_cron, which Supabase provides as an extension. If it is
-- not available on the project, the function still installs and can be run by
-- hand or from any scheduler:  SELECT * FROM purge_referral_visitor_ips(90);

-- ---------------------------------------------------------------------------
-- 1. The purge. Returns how many rows each table had cleared.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_referral_visitor_ips(p_retention_days INTEGER DEFAULT 90)
RETURNS TABLE (analytics_rows INTEGER, referral_rows INTEGER, stats_rows INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff    TIMESTAMP WITH TIME ZONE := NOW() - make_interval(days => p_retention_days);
    v_analytics INTEGER := 0;
    v_referrals INTEGER := 0;
    v_stats     INTEGER := 0;
BEGIN
    IF p_retention_days IS NULL OR p_retention_days < 1 THEN
        RAISE EXCEPTION 'retention must be at least 1 day, got %', p_retention_days;
    END IF;

    UPDATE referral_analytics
       SET visitor_ip = NULL
     WHERE visitor_ip IS NOT NULL
       AND created_at < v_cutoff;
    GET DIAGNOSTICS v_analytics = ROW_COUNT;

    UPDATE referrals
       SET visitor_ip = NULL
     WHERE visitor_ip IS NOT NULL
       AND created_at < v_cutoff;
    GET DIAGNOSTICS v_referrals = ROW_COUNT;

    UPDATE referral_stats
       SET last_referral_ip = NULL
     WHERE last_referral_ip IS NOT NULL
       AND last_referral_event_at < v_cutoff;
    GET DIAGNOSTICS v_stats = ROW_COUNT;

    RETURN QUERY SELECT v_analytics, v_referrals, v_stats;
END;
$$;

-- Only the scheduler and the service role may run the purge. Clients must not
-- be able to call it, and it must not be callable by anon or authenticated.
REVOKE ALL ON FUNCTION purge_referral_visitor_ips(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_referral_visitor_ips(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION purge_referral_visitor_ips(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION purge_referral_visitor_ips(INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Nightly schedule (03:30 UTC, 90-day window). Guarded so the migration
--    still applies on a database where pg_cron is not installed.
-- ---------------------------------------------------------------------------
DO $referral_ip_schedule$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;

        -- Re-running the migration replaces the job rather than duplicating it.
        PERFORM cron.unschedule(jobid)
           FROM cron.job
          WHERE jobname = 'purge-referral-visitor-ips';

        PERFORM cron.schedule(
            'purge-referral-visitor-ips',
            '30 3 * * *',
            'SELECT * FROM public.purge_referral_visitor_ips(90)'
        );
    ELSE
        RAISE NOTICE 'pg_cron is not available; purge_referral_visitor_ips is installed but not scheduled.';
    END IF;
END
$referral_ip_schedule$;
