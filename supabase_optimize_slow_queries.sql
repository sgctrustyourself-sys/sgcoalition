-- ============================================
-- FIX SLOW QUERIES - ADD INDEXES
-- ============================================
-- Optimizes the slow queries shown in Supabase dashboard
-- Run this AFTER the search_path fixes

-- ============================================
-- 1. Optimize timezone_names query
-- ============================================

-- This is a system table query, already optimized by PostgreSQL
-- No action needed

-- ============================================
-- 2. Optimizewal->5 queries (Write-Ahead Log)
-- ============================================

-- These are internal PostgreSQL queries
-- Ensure you have proper indexes on frequently queried columns

-- ============================================
-- 3. Add indexes for common query patterns
-- ============================================

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Index for admin checks (RLS performance)
CREATE INDEX IF NOT EXISTS idx_admin_users_id ON admin_users(id);

-- Index for referral lookups
CREATE INDEX IF NOT EXISTS idx_referral_stats_user_id ON referral_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_stats_code ON referral_stats(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Index for orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Index for products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at DESC);

-- Index for giveaway entries
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user_id ON giveaway_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway_id ON giveaway_entries(giveaway_id);

-- Index for coalition signal subscribers
CREATE INDEX IF NOT EXISTS idx_coalition_signal_email ON coalition_signal_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_coalition_signal_created_at ON coalition_signal_subscribers(created_at DESC);

-- ============================================
-- 4. Optimize RLS policies with indexes
-- ============================================

-- Add composite indexes for common RLS checks
CREATE INDEX IF NOT EXISTS idx_profiles_id_email ON profiles(id, email);

-- ============================================
-- VACUUM AND ANALYZE
-- ============================================

-- Update statistics for query planner
ANALYZE profiles;
ANALYZE admin_users;
ANALYZE referral_stats;
ANALYZE referrals;
ANALYZE orders;
ANALYZE products;
ANALYZE giveaway_entries;
ANALYZE coalition_signal_subscribers;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as rows_read,
    idx_tup_fetch as rows_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
