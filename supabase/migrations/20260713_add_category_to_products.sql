-- Add category column to products table
-- Run this migration in Supabase SQL Editor

ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.products.category IS 'Product category for filtering';