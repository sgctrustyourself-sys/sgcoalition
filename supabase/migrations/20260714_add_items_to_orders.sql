-- Add items column to orders table
-- Run this migration in Supabase SQL Editor

ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';

COMMENT ON COLUMN public.orders.items IS 'Array of order items with product details and quantities';