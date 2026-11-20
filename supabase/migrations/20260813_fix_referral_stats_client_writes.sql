-- 20260812_fix_referral_stats_client_writes.sql
--
-- Production drift fix: the live `referral_stats` policies were created
-- service_role-only (`system_can_manage_stats` TO service_role), but the
-- app writes referral_stats CLIENT-SIDE with the anon key:
--
--   * Trust Circle admin flow (components/admin/TrustCircleManager) —
--     approve/invite/revoke update referral_stats after the passphrase
--     login, which creates NO Supabase session (browser role = anon)
--   * utils/referralSystem.ts self-heal — inserts a missing referral_stats
--     row for a signed-in user
--
-- With service_role-only policies those writes silently match 0 rows:
-- approving a Trust Circle application marked it approved but never
-- promoted the member, and the members list (SELECT all) came back empty.
--
-- The migration source (create_referral_system.sql) intended a PUBLIC
-- `FOR ALL USING (true)` policy ("System can manage stats") — the codebase's
-- documented lax posture (cf. custom_inquiries, coupons). This restores
-- exactly that. HARDEN LATER by moving admin writes behind a SECURITY
-- DEFINER RPC or minting a real auth session for the passphrase flow.
--
-- SAFE to run twice: DROP IF EXISTS both the repo's spaced name and the
-- drifted snake_case name, then CREATE IF NOT EXISTS-equivalent policy.

DROP POLICY IF EXISTS "System can manage stats" ON public.referral_stats;
DROP POLICY IF EXISTS "system_can_manage_stats" ON public.referral_stats;

CREATE POLICY "System can manage stats"
    ON public.referral_stats
    FOR ALL
    USING (true)
    WITH CHECK (true);
