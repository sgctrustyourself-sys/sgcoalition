-- FIX: Enable public enrollment for the Coalition Signal (Newsletter)
-- This table stores phone numbers for SMS updates/rewards

CREATE TABLE IF NOT EXISTS public.coalition_signal_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    country_code TEXT DEFAULT '+1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_signal_sent_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security
ALTER TABLE public.coalition_signal_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone (anon) to subscribe
DROP POLICY IF EXISTS "Public can subscribe to signal" ON public.coalition_signal_subscribers;
CREATE POLICY "Public can subscribe to signal" ON public.coalition_signal_subscribers
    FOR INSERT WITH CHECK (true);

-- Policy: Only service role can view/update/delete subscribers (Admin side)
DROP POLICY IF EXISTS "Service role management" ON public.coalition_signal_subscribers;
CREATE POLICY "Service role management" ON public.coalition_signal_subscribers
    FOR ALL TO service_role USING (true);

-- Add to Realtime for admin monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE coalition_signal_subscribers;
