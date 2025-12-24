-- ============================================
-- CONSOLIDATE coalition_signal_subscribers POLICIES
-- ============================================
-- Combines two INSERT policies into one for better performance
-- "Admin full access" + "Allow public signups"

-- Drop the two separate INSERT policies
DROP POLICY IF EXISTS "Admin full access" ON coalition_signal_subscribers;
DROP POLICY IF EXISTS "Allow public signups" ON coalition_signal_subscribers;

-- Create single consolidated INSERT policy
CREATE POLICY "authenticated_can_insert_subscribers" ON coalition_signal_subscribers
FOR INSERT
TO authenticated
WITH CHECK (
    -- Admins can always insert
    is_admin((SELECT auth.uid()))
    -- OR anyone can sign up (public signups allowed)
    OR true
);

-- Since the condition simplifies to "true" (anyone can insert), 
-- we could actually just use:
-- WITH CHECK (true);
-- But keeping is_admin check explicit for clarity and future modifications

-- Verify the new policy
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'coalition_signal_subscribers'
ORDER BY cmd, policyname;

-- Expected: One INSERT policy for authenticated role
