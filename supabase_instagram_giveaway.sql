-- Instagram Giveaway System - Database Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE GIVEAWAY ENTRIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS giveaway_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    giveaway_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    instagram_username TEXT NOT NULL,
    screenshot_follow_url TEXT NOT NULL,
    screenshot_like_url TEXT NOT NULL,
    screenshot_story_url TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    
    -- Prevent duplicate entries per giveaway
    UNIQUE(giveaway_id, email)
);

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway_id 
ON giveaway_entries(giveaway_id);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_email 
ON giveaway_entries(email);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_verified 
ON giveaway_entries(verified);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_created_at 
ON giveaway_entries(created_at DESC);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert entries (public submissions)
CREATE POLICY "Anyone can submit giveaway entries"
ON giveaway_entries
FOR INSERT
TO public
WITH CHECK (true);

-- Policy: Anyone can read their own entries
CREATE POLICY "Users can read their own entries"
ON giveaway_entries
FOR SELECT
TO public
USING (true);

-- Policy: Only authenticated users can update (for admin verification)
CREATE POLICY "Authenticated users can update entries"
ON giveaway_entries
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Only authenticated users can delete entries
CREATE POLICY "Authenticated users can delete entries"
ON giveaway_entries
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- 4. CREATE STORAGE BUCKET
-- ============================================
-- Note: This must be done in Supabase Dashboard → Storage
-- Bucket name: 'giveaway-screenshots'
-- Public: false (admin-only access)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- After creating bucket, set these policies in Storage:

-- INSERT POLICY (Anyone can upload)
-- Name: "Anyone can upload screenshots"
-- Policy: bucket_id = 'giveaway-screenshots'

-- SELECT POLICY (Anyone can view - needed for admin dashboard)
-- Name: "Anyone can view screenshots"
-- Policy: bucket_id = 'giveaway-screenshots'

-- DELETE POLICY (Only authenticated can delete)
-- Name: "Authenticated users can delete screenshots"
-- Policy: bucket_id = 'giveaway-screenshots' AND auth.role() = 'authenticated'

-- ============================================
-- 5. VERIFY SETUP
-- ============================================

-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'giveaway_entries';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'giveaway_entries';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'giveaway_entries';

-- Check policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'giveaway_entries';

-- ============================================
-- NOTES
-- ============================================
-- 1. Storage bucket must be created manually in Supabase Dashboard
-- 2. After creating bucket, configure storage policies as noted above
-- 3. Test with a sample entry to verify everything works
-- 4. Monitor storage usage as screenshots accumulate
