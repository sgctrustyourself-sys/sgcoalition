-- Enable CDN and optimize Supabase Storage for product images
-- Run this in Supabase SQL Editor

-- 1. Update products bucket with optimal settings
UPDATE storage.buckets
SET
    public = true,
    file_size_limit = 52428800,  -- 50MB max
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/gif'
    ]
WHERE id = 'products';

-- 2. Enable CDN on the bucket (requires Supabase Pro or manual via Dashboard)
-- Note: CDN is enabled per-bucket in Dashboard → Storage → products → Settings → Enable CDN
-- This SQL documents the intent; actual toggle is in Dashboard or via Management API

-- 3. Set cache headers for images via Edge Function (optional, for fine-grained control)
-- This creates an Edge Function that adds cache headers to storage responses
-- See: https://supabase.com/docs/guides/storage/serving/image-resizing#caching

-- 4. Verify bucket configuration
SELECT
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'products';

-- 5. Example: Transform image on-the-fly via URL parameters
-- https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/image.png?format=webp&quality=80&width=800
-- Supported parameters:
--   format: webp, avif, jpg, png
--   quality: 1-100
--   width: pixels
--   height: pixels
--   resize: cover, contain, fill
--   fit: cover, contain, fill, inside, outside