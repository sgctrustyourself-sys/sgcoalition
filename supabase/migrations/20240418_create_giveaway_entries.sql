-- Create giveaway_entries table
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.giveaway_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    giveaway_id TEXT NOT NULL,
    entry_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user_id ON public.giveaway_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway_id ON public.giveaway_entries(giveaway_id);

-- Enable RLS
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view entries" ON public.giveaway_entries;
CREATE POLICY "Anyone can view entries" ON public.giveaway_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert entries" ON public.giveaway_entries;
CREATE POLICY "Anyone can insert entries" ON public.giveaway_entries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can update entries" ON public.giveaway_entries;
CREATE POLICY "Only admins can update entries" ON public.giveaway_entries FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete entries" ON public.giveaway_entries;
CREATE POLICY "Only admins can delete entries" ON public.giveaway_entries FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

COMMENT ON TABLE public.giveaway_entries IS 'Stores giveaway entries from users';