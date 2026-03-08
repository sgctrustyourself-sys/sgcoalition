-- Coalition Signal Broadcast System Setup
-- Allows admins to broadcast messages/alerts across the entire platform

CREATE TABLE IF NOT EXISTS public.coalition_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'alert', 'success', 'process', 'urgent')),
    is_active BOOLEAN DEFAULT TRUE,
    action_url TEXT,
    action_label TEXT DEFAULT 'LEARN MORE',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.coalition_signals ENABLE ROW LEVEL SECURITY;

-- Policy: Public can view active signals
DROP POLICY IF EXISTS "Public can view active signals" ON public.coalition_signals;
CREATE POLICY "Public can view active signals" ON public.coalition_signals
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Policy: Service role can manage all signals
DROP POLICY IF EXISTS "Service role management" ON public.coalition_signals;
CREATE POLICY "Service role management" ON public.coalition_signals
    FOR ALL TO service_role USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE coalition_signals;

-- Trigger to update 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coalition_signals_updated_at
    BEFORE UPDATE ON coalition_signals
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
