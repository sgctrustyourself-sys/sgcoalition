-- Migration: Add extra fields for YouTube Giveaway and Shirt Size tracking
-- Run this in your Supabase SQL Editor

ALTER TABLE public.giveaway_entries 
ADD COLUMN IF NOT EXISTS shirt_size TEXT,
ADD COLUMN IF NOT EXISTS youtube_handle TEXT,
ADD COLUMN IF NOT EXISTS claimed_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS screenshot_yt_sub_url TEXT,
ADD COLUMN IF NOT EXISTS screenshot_yt_comment_url TEXT,
ADD COLUMN IF NOT EXISTS screenshot_bonus_urls TEXT[];

-- Update RLS if necessary (usually not needed if already setup for entries)
COMMENT ON COLUMN public.giveaway_entries.shirt_size IS 'Selected shirt size for physical prize giveaways';
COMMENT ON COLUMN public.giveaway_entries.youtube_handle IS 'YouTube account identifier for verification';
