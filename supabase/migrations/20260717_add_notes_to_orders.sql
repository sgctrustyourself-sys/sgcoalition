-- Add notes column to orders table
-- Run this migration in Supabase SQL Editor

ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.orders.notes IS 'Order notes including deposit/balance info';