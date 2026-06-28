-- 20260629_create_subscribe_emails.sql
-- Drop-notification subscribers: single-opt-in via /api/subscribe-drop,
-- with a per-row unsubscribe token so the confirmation email can carry a
-- working one-click opt-out link that /api/unsubscribe honors.
--
-- Anti-tricky-brand posture: anyone can opt in, no one but admins can read
-- the email list. The /api/subscribe-drop endpoint writes via
-- SUPABASE_SERVICE_ROLE_KEY so the anon INSERT check stays narrow on purpose.

CREATE TABLE IF NOT EXISTS subscribe_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('home', 'shop', 'about', 'footer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
    unsubscribe_at TIMESTAMPTZ
);

-- Hot-path indexes: equality lookups on email and unsubscribe_token.
CREATE INDEX IF NOT EXISTS idx_subscribe_emails_email ON subscribe_emails (email);
CREATE INDEX IF NOT EXISTS idx_subscribe_emails_unsubscribe_token ON subscribe_emails (unsubscribe_token);
-- Skips rows that have already opted out when listing active subscribers.
CREATE INDEX IF NOT EXISTS idx_subscribe_emails_active ON subscribe_emails (unsubscribe_at) WHERE unsubscribe_at IS NULL;

ALTER TABLE IF EXISTS subscribe_emails ENABLE ROW LEVEL SECURITY;

-- Narrow INSERT: anyone can opt in, but only a workable email shape is accepted.
-- /api/subscribe-drop is the real gatekeeper; this policy is just defense-in-depth.
DROP POLICY IF EXISTS "Anyone can subscribe" ON subscribe_emails;
CREATE POLICY "Anyone can subscribe" ON subscribe_emails
    FOR INSERT WITH CHECK (
        email IS NOT NULL
        AND length(email) <= 320
        AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    );

-- Admins can pull the list for /admin or future segment-aware sends.
DROP POLICY IF EXISTS "Admins can view subscribers" ON subscribe_emails;
CREATE POLICY "Admins can view subscribers" ON subscribe_emails
    FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Admins own update + delete (e.g. manual scrub, compliance takedowns).
DROP POLICY IF EXISTS "Admins can manage subscribers" ON subscribe_emails;
CREATE POLICY "Admins can manage subscribers" ON subscribe_emails
    FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
           WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- updated_at auto-bump on every UPDATE so admin reads of the list can sort
-- by "last re-engagement" timestamp.
CREATE OR REPLACE FUNCTION trg_subscribe_emails_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscribe_emails_set_updated_at ON subscribe_emails;
CREATE TRIGGER subscribe_emails_set_updated_at
    BEFORE UPDATE ON subscribe_emails
    FOR EACH ROW
    EXECUTE FUNCTION trg_subscribe_emails_set_updated_at();

DO $$ BEGIN RAISE NOTICE 'subscribe_emails table + RLS + updated_at trigger ready'; END $$;
