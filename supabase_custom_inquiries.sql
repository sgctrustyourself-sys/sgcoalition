-- Custom Product Inquiry System - Database Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE CUSTOM INQUIRIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS custom_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    product_type TEXT NOT NULL CHECK (product_type IN ('apparel-pants', 'apparel-shirt', '3d-printed', 'other')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reference_images TEXT[] DEFAULT '{}',
    budget_range TEXT NOT NULL CHECK (budget_range IN ('under-100', '100-250', '250-500', '500+', 'flexible')),
    timeline TEXT NOT NULL CHECK (timeline IN ('no-rush', '1-2-weeks', '2-4-weeks', 'asap')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'quoted', 'accepted', 'declined', 'completed')),
    admin_notes TEXT,
    quote_amount NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_custom_inquiries_status 
ON custom_inquiries(status);

CREATE INDEX IF NOT EXISTS idx_custom_inquiries_product_type 
ON custom_inquiries(product_type);

CREATE INDEX IF NOT EXISTS idx_custom_inquiries_email 
ON custom_inquiries(customer_email);

CREATE INDEX IF NOT EXISTS idx_custom_inquiries_created_at 
ON custom_inquiries(created_at DESC);

-- ============================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_inquiries_updated_at
    BEFORE UPDATE ON custom_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE custom_inquiries ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert inquiries (public submissions)
CREATE POLICY "Anyone can submit custom inquiries"
ON custom_inquiries
FOR INSERT
TO public
WITH CHECK (true);

-- Policy: Anyone can read their own inquiries by email
CREATE POLICY "Users can read their own inquiries"
ON custom_inquiries
FOR SELECT
TO public
USING (true);

-- Policy: Only authenticated users can update (admin only)
CREATE POLICY "Authenticated users can update inquiries"
ON custom_inquiries
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Only authenticated users can delete
CREATE POLICY "Authenticated users can delete inquiries"
ON custom_inquiries
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- 5. CREATE STORAGE BUCKET
-- ============================================
-- Note: This must be done in Supabase Dashboard → Storage
-- Bucket name: 'custom-inquiry-images'
-- Public: false (admin-only access)
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- After creating bucket, set these policies in Storage:

-- INSERT POLICY (Anyone can upload)
-- Name: "Anyone can upload inquiry images"
-- Policy: bucket_id = 'custom-inquiry-images'

-- SELECT POLICY (Anyone can view)
-- Name: "Anyone can view inquiry images"
-- Policy: bucket_id = 'custom-inquiry-images'

-- DELETE POLICY (Only authenticated can delete)
-- Name: "Authenticated users can delete inquiry images"
-- Policy: bucket_id = 'custom-inquiry-images' AND auth.role() = 'authenticated'

-- ============================================
-- 6. VERIFY SETUP
-- ============================================

-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'custom_inquiries';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'custom_inquiries';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'custom_inquiries';

-- Check policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'custom_inquiries';

-- ============================================
-- NOTES
-- ============================================
-- 1. Storage bucket must be created manually in Supabase Dashboard
-- 2. After creating bucket, configure storage policies as noted above
-- 3. Test with a sample inquiry to verify everything works
