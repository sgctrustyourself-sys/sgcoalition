-- 20260628_add_product_making_video_url.sql
-- Stores an optional process/making-of video URL for product detail pages.

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS making_video_url TEXT;

COMMENT ON COLUMN public.products.making_video_url IS
    'Optional external video URL showing the product creation process.';
