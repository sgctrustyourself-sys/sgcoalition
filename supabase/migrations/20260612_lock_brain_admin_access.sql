-- Lock Coalition Brain reads to admins only.
-- This fixes the June 11 Brain bootstrap policy that allowed public SELECT.

ALTER TABLE IF EXISTS public.brain_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view brain entries" ON public.brain_entries;
DROP POLICY IF EXISTS "Only admins can view brain entries" ON public.brain_entries;

CREATE POLICY "Only admins can view brain entries"
    ON public.brain_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.admin_users
            WHERE user_id = auth.uid()
        )
    );
