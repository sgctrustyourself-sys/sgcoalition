-- Referral System v2 -- additive migration
-- Adds the columns referenced in the TS code (code_customized, code_customized_at,
-- last_referral_ip, last_referral_event_at, referrals.visitor_ip) and hardens
-- the track_referral_event RPC: it now blocks self-referrals, stores the
-- visitor IP, and atomically recomputes the commission tier based on
-- successful_referrals using the same exponential progression the client
-- uses in utils/referralSystem.ts.
--
-- SAFE to run on databases that already have the v1 schema -- every change
-- is IF NOT EXISTS guarded.

-- ---------------------------------------------------------------------------
-- 1. New columns on referral_stats
-- ---------------------------------------------------------------------------
ALTER TABLE referral_stats
    ADD COLUMN IF NOT EXISTS code_customized        BOOLEAN        DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS code_customized_at     TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_referral_ip       VARCHAR(45),
    ADD COLUMN IF NOT EXISTS last_referral_event_at TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------------------------
-- 2. New column on referrals (links each commission back to the IP that
--    triggered the conversion -- essential for fraud review)
-- TODO(gdpr): visitor_ip is PII under GDPR. A retention job is required
--             before this column is populated by EU users. Truncate to
--             /24 (IPv4) or /32 (IPv6) at write time, OR schedule a
--             nightly job that nulls visitor_ip older than the legal
--             retention window. Do not enable IP capture for EU users
--             until this is wired up.
-- ---------------------------------------------------------------------------
ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS visitor_ip VARCHAR(45);

-- ---------------------------------------------------------------------------
-- 3. Indexes for the new IP lookup path
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_referrals_visitor_ip
    ON referrals(visitor_ip)
    WHERE visitor_ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_stats_last_ip
    ON referral_stats(last_referral_ip)
    WHERE last_referral_ip IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Banned-words guard for customizeReferralCode (defense-in-depth).
--    The client also validates; this prevents direct-API squatting.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_banned_codes (
    code VARCHAR(20) PRIMARY KEY,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE referral_banned_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read banned codes" ON referral_banned_codes;
CREATE POLICY "Anyone can read banned codes"
    ON referral_banned_codes FOR SELECT
    USING (true);

-- Only the service role can mutate the banned-words table; clients read
-- through the is_referral_code_available RPC.
REVOKE INSERT, UPDATE, DELETE ON referral_banned_codes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON referral_banned_codes FROM anon;

INSERT INTO referral_banned_codes (code, reason) VALUES
    ('ADMIN',     'Reserved'),
    ('ADMIN1',    'Reserved variant'),
    ('ADMIN2',    'Reserved variant'),
    ('ADMIN3',    'Reserved variant'),
    ('SUPPORT',   'Reserved'),
    ('STAFF',     'Reserved'),
    ('HELP',      'Reserved'),
    ('INFO',      'Reserved'),
    ('ROOT',      'Reserved'),
    ('API',       'Reserved'),
    ('ABOUT',     'Reserved'),
    ('LOGIN',     'Reserved'),
    ('SIGNUP',    'Reserved'),
    ('PAY',       'Reserved'),
    ('PASSWORD',  'Reserved'),
    ('RESET',     'Reserved'),
    ('SG',        'Brand prefix'),
    ('SGC',       'Brand prefix'),
    ('NULL',      'Reserved'),
    ('TEST',      'Reserved'),
    ('COALITION', 'Brand')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Hardened track_referral_event RPC
--    - blocks self-referrals (p_user_id == referrer)
--    - captures visitor IP
--    - atomically recomputes tier + rate
--    - updates last_referral_ip / last_referral_event_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_referral_event(
    p_referral_code VARCHAR(20),
    p_event_type    VARCHAR(20),
    p_user_id       UUID         DEFAULT NULL,
    p_visitor_ip    VARCHAR(45)  DEFAULT NULL,
    p_user_agent    TEXT         DEFAULT NULL,
    p_referrer_url  TEXT         DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_referrer_id            UUID;
    v_total_clicks           INTEGER;
    v_total_views            INTEGER;
    v_successful_referrals   INTEGER;
    v_conversion_rate        DECIMAL(5,2);
    v_new_tier               INTEGER;
    v_new_rate               DECIMAL(5,2);
BEGIN
    SELECT user_id INTO v_referrer_id
    FROM referral_stats
    WHERE referral_code = p_referral_code;

    IF v_referrer_id IS NULL THEN
        RETURN;
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id = v_referrer_id THEN
        RETURN;
    END IF;

    INSERT INTO referral_analytics (
        referral_code, referrer_id, event_type,
        visitor_ip, user_agent, referrer_url
    ) VALUES (
        p_referral_code, v_referrer_id, p_event_type,
        p_visitor_ip, p_user_agent, p_referrer_url
    );

    UPDATE referral_stats
    SET last_referral_ip       = COALESCE(p_visitor_ip, last_referral_ip),
        last_referral_event_at = NOW()
    WHERE user_id = v_referrer_id;

    CASE p_event_type
        WHEN 'click' THEN
            UPDATE referral_stats
            SET total_clicks = total_clicks + 1
            WHERE user_id = v_referrer_id;

        WHEN 'view' THEN
            UPDATE referral_stats
            SET total_views = total_views + 1
            WHERE user_id = v_referrer_id;

        WHEN 'signup' THEN
            UPDATE referral_stats
            SET total_referrals = total_referrals + 1
            WHERE user_id = v_referrer_id;

        WHEN 'purchase' THEN
            UPDATE referral_stats
            SET successful_referrals = successful_referrals + 1
            WHERE user_id = v_referrer_id;

            UPDATE referral_analytics
            SET converted_to_sale = TRUE
            WHERE referral_code = p_referral_code
              AND event_type = 'signup'
              AND created_at = (
                  SELECT MAX(created_at)
                  FROM referral_analytics
                  WHERE referral_code = p_referral_code
                    AND event_type = 'signup'
              );
    END CASE;

    SELECT total_clicks, total_views, successful_referrals
      INTO v_total_clicks, v_total_views, v_successful_referrals
    FROM referral_stats
    WHERE user_id = v_referrer_id;

    IF v_total_clicks > 0 THEN
        v_conversion_rate := (v_successful_referrals::DECIMAL / v_total_clicks::DECIMAL) * 100;
    ELSE
        v_conversion_rate := 0.00;
    END IF;

    CASE
        WHEN v_successful_referrals >= 100 THEN v_new_tier := 8; v_new_rate := 40.00;
        WHEN v_successful_referrals >=  50 THEN v_new_tier := 7; v_new_rate := 35.00;
        WHEN v_successful_referrals >=  30 THEN v_new_tier := 6; v_new_rate := 30.00;
        WHEN v_successful_referrals >=  15 THEN v_new_tier := 5; v_new_rate := 25.00;
        WHEN v_successful_referrals >=   7 THEN v_new_tier := 4; v_new_rate := 20.00;
        WHEN v_successful_referrals >=   3 THEN v_new_tier := 3; v_new_rate := 15.00;
        WHEN v_successful_referrals >=   1 THEN v_new_tier := 2; v_new_rate := 10.00;
        ELSE v_new_tier := 1; v_new_rate := 5.00;
    END CASE;

    UPDATE referral_stats
    SET conversion_rate        = v_conversion_rate,
        current_tier           = v_new_tier,
        current_commission_rate = v_new_rate
    WHERE user_id = v_referrer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION track_referral_event TO authenticated;
GRANT EXECUTE ON FUNCTION track_referral_event TO anon;

-- ---------------------------------------------------------------------------
-- 6. Helper RPC: validate a custom-code claim in a single round-trip
--    Returns false if the code is taken, banned, or malformed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_referral_code_available(p_code VARCHAR(20))
RETURNS BOOLEAN AS $$
BEGIN
    IF p_code IS NULL OR LENGTH(p_code) < 4 OR LENGTH(p_code) > 12 THEN
        RETURN FALSE;
    END IF;
    IF p_code !~ '^[A-Z0-9-]+$' THEN
        RETURN FALSE;
    END IF;
    IF EXISTS (SELECT 1 FROM referral_banned_codes WHERE code = p_code) THEN
        RETURN FALSE;
    END IF;
    -- Reject obvious reserved prefixes (ADMIN-, STAFF-, SUPPORT-, TEST-)
    -- plus the literal reserved words. Mirrors the client-side guard in
    -- utils/customizeReferralCode.ts.
    IF p_code ~ '^(ADMIN|STAFF|SUPPORT|TEST)([0-9-].*)?$' THEN
        RETURN FALSE;
    END IF;
    IF EXISTS (SELECT 1 FROM referral_stats WHERE referral_code = p_code) THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_referral_code_available TO authenticated;
GRANT EXECUTE ON FUNCTION is_referral_code_available TO anon;

-- ---------------------------------------------------------------------------
-- 7. Success notice
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE 'Referral v2 migr
