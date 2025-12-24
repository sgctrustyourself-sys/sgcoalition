-- ============================================
-- Find all tables that actually exist
-- ============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Then show policies for tables with auth.uid() issues
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND (
    qual LIKE '%auth.uid()%' 
    OR with_check LIKE '%auth.uid()%'
)
AND NOT (
    qual LIKE '%(SELECT auth.uid())%' 
    OR with_check LIKE '%(SELECT auth.uid())%'
)
ORDER BY tablename, policyname;
