-- 20261027_fix_admin_users_rls_recursion.sql
--
-- FIX: "infinite recursion detected in policy for relation admin_users" (42P17).
--
-- WHAT WAS WRONG
-- admin_users carried a policy whose expression selected FROM admin_users:
--
--     USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
--
-- Evaluating any read of admin_users re-entered that same policy, so Postgres
-- aborted with 42P17. Because every admin check on every other table is written
-- as `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())`, a single
-- recursive policy on admin_users poisoned all of them: authenticated reads of
-- sgcoin_admin_grants, brain_entries and subscribe_emails failed alongside a
-- plain read of admin_users itself. (Signed-out reads still returned [] because
-- the policy was scoped to authenticated, which is why the failure only showed
-- up with a real session.)
--
-- THE FIX
--   1. Keep public.is_admin(uuid) as a SECURITY DEFINER helper. It performs the
--      membership read as its owner, so admin checks can bypass RLS entirely
--      instead of re-entering it. The live database already has this function;
--      this file makes it reproducible on a fresh database.
--   2. Drop every policy on admin_users whose expression mentions admin_users.
--      Names were assigned ad hoc in the dashboard, so they are discovered from
--      pg_policy rather than guessed.
--   3. Recreate the one policy the app relies on: a signed-in user may read
--      their own admin_users row (pages/Profile.tsx, context/useAuth.ts). That
--      expression does not reference the table, so it cannot recurse.
--
-- WHY NO "admins can read all admin users" POLICY
-- Such a policy would have to call public.is_admin() and would work as long as
-- the helper's owner bypasses RLS — but the moment anyone sets FORCE ROW LEVEL
-- SECURITY on this table, that policy becomes self-referential again. The admin
-- roster is managed through the service-role client (api/_adminAuth.ts), which
-- bypasses RLS, so no client-side policy is needed. Keeping this table's only
-- policy self-scoped makes recursion structurally impossible.
--
-- WHY NOT REWRITE EVERY OTHER TABLE'S POLICY
-- Those policies are `EXISTS (SELECT 1 FROM admin_users …)`. With admin_users
-- holding only the self-scoped SELECT policy below, that subquery is evaluated
-- against exactly one candidate row and returns true only for an admin. They
-- keep working unchanged; rewriting them to public.is_admin() would be a larger
-- migration for no behavioural gain.

-- ============================================
-- 1. Admin membership helper (created only when absent)
-- ============================================
-- SECURITY DEFINER lets the membership read run as the function owner, which is
-- what stops the RLS re-entry. search_path is pinned to '' so no caller-controlled
-- schema can shadow public.admin_users; every name below is qualified.
--
-- The live project already defines this helper, so it is NOT replaced here: its
-- body predates this repo and may carry role semantics that cannot be inspected
-- through the API. A fresh database gets the canonical shape instead.
DO $do$
BEGIN
    IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
        EXECUTE $fn$
            CREATE FUNCTION public.is_admin(check_user_id uuid)
            RETURNS boolean
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = ''
            AS 'SELECT EXISTS (
                SELECT 1
                FROM public.admin_users
                WHERE user_id = check_user_id
            )'
        $fn$;
    END IF;
END
$do$;

COMMENT ON FUNCTION public.is_admin(uuid) IS
    'True when the user id is listed in public.admin_users. SECURITY DEFINER so RLS admin checks do not recurse.';

-- Policies execute the function as the requesting role, so that role needs
-- EXECUTE. PUBLIC keeps the default grant from the original definition; make
-- the PostgREST roles explicit for a fresh database.
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;

-- ============================================
-- 2. Drop the self-referential policies
-- ============================================
-- The offending policy was created through the dashboard, so its name differs
-- between environments. Match on the expression instead of the name: any policy
-- on admin_users that selects from admin_users is recursive by definition.
DO $do$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT p.polname
        FROM pg_policy p
        WHERE p.polrelid = 'public.admin_users'::regclass
          AND (
              COALESCE(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%admin_users%'
              OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') ILIKE '%admin_users%'
          )
    LOOP
        EXECUTE format('DROP POLICY %I ON public.admin_users', pol.polname);
        RAISE NOTICE 'dropped self-referential policy "%" on admin_users', pol.polname;
    END LOOP;
END
$do$;

-- ============================================
-- 3. The only policy this table needs: read your own row
-- ============================================
-- `(select auth.uid())` is evaluated once per statement instead of once per row,
-- matching the performance guidance for RLS predicates. `TO authenticated` is
-- tighter than the old PUBLIC-scoped policy and still lets signed-in users ask
-- "am I an admin?"; signed-out callers get no rows, as before.
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;
CREATE POLICY "Users can check own admin status"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE policy is declared. Admin membership is written by
-- api/_adminAuth.ts and api/_handlers/admin-*.ts through the service-role client,
-- never from a browser session; with RLS enabled and no permissive write policy,
-- a client-side write fails closed.
