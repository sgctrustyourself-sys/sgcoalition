-- ============================================
-- SYSTEM CONFIGURATION & CONSTANTS
-- ============================================

-- 1. Create system_config table
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Public can read all config
DROP POLICY IF EXISTS "Public can view config" ON public.system_config;
CREATE POLICY "Public can view config" ON public.system_config
    FOR SELECT USING (true);

-- Only admins can modify config
DROP POLICY IF EXISTS "Admins can modify config" ON public.system_config;
CREATE POLICY "Admins can modify config" ON public.system_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_users 
            WHERE user_id = auth.uid()
        )
    );

-- 4. Insert Locked Migration Constants
INSERT INTO public.system_config (key, value, description)
VALUES 
    ('migration_ratio', '1000000'::jsonb, 'The fair 1,000,000:1 ratio for SGCOIN V1 to V2 migration.'),
    ('v1_supply_baseline', '10000000000000'::jsonb, 'The 10 Trillion baseline for SGCOIN V1 total supply.')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 5. Verification
-- SELECT * FROM public.system_config WHERE key = 'migration_ratio';
