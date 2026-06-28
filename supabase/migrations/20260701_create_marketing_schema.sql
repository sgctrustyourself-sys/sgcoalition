-- 20260701_create_marketing_schema.sql
-- SMS + email marketing system: unified audience, campaigns, sends, consent log.
-- Mirrors the 20260629_create_subscribe_emails.sql pattern (UUID PKs, RLS via
-- admin_users lookup, updated_at trigger, RAISE NOTICE finish). The admin
-- composer (components/admin/MarketingManager.tsx) reads from these tables
-- UNION with coalition_signal_subscribers + subscribe_emails + orders at read
-- time so existing prod data is never blocked.

CREATE TABLE IF NOT EXISTS marketing_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    phone_e164 TEXT,
    country_code TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'both')),
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT marketing_contacts_has_channel CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_contacts_email_unique
    ON marketing_contacts (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_contacts_phone_unique
    ON marketing_contacts (phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_contacts_token
    ON marketing_contacts (unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_active
    ON marketing_contacts (unsubscribed_at) WHERE unsubscribed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_source
    ON marketing_contacts (source);

ALTER TABLE IF EXISTS marketing_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can opt-in" ON marketing_contacts;
CREATE POLICY "Anyone can opt-in" ON marketing_contacts
    FOR INSERT WITH CHECK (
        (email IS NULL OR (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 320))
        AND (phone_e164 IS NULL OR phone_e164 ~* '^\+[1-9]\d{6,14}$')
        AND channel IN ('sms', 'email', 'both')
    );

DROP POLICY IF EXISTS "Admins can read contacts" ON marketing_contacts;
CREATE POLICY "Admins can read contacts" ON marketing_contacts
    FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage contacts" ON marketing_contacts;
CREATE POLICY "Admins can manage contacts" ON marketing_contacts
    FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
           WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION trg_marketing_contacts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketing_contacts_set_updated_at ON marketing_contacts;
CREATE TRIGGER marketing_contacts_set_updated_at
    BEFORE UPDATE ON marketing_contacts
    FOR EACH ROW
    EXECUTE FUNCTION trg_marketing_contacts_set_updated_at();

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT,
    body_html TEXT,
    body_text TEXT,
    sms_body TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'partial', 'failed')),
    audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_sent_at ON marketing_campaigns (sent_at);

ALTER TABLE IF EXISTS marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage campaigns" ON marketing_campaigns;
CREATE POLICY "Admins can manage campaigns" ON marketing_campaigns
    FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
           WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION trg_marketing_campaigns_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketing_campaigns_set_updated_at ON marketing_campaigns;
CREATE TRIGGER marketing_campaigns_set_updated_at
    BEFORE UPDATE ON marketing_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION trg_marketing_campaigns_set_updated_at();

CREATE TABLE IF NOT EXISTS marketing_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES marketing_contacts(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
    message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'delivered', 'failed', 'bounced', 'replied_stop')),
    error TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign ON marketing_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_contact ON marketing_sends (contact_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_status ON marketing_sends (status);

ALTER TABLE IF EXISTS marketing_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage sends" ON marketing_sends;
CREATE POLICY "Admins can manage sends" ON marketing_sends
    FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
           WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS marketing_consent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES marketing_contacts(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
    action TEXT NOT NULL CHECK (action IN ('subscribe', 'unsubscribe', 'send', 'bounce', 'complaint')),
    source TEXT,
    recipient_copy TEXT,
    ip TEXT,
    user_agent TEXT,
    consent_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_consent_log_contact ON marketing_consent_log (contact_id);
CREATE INDEX IF NOT EXISTS idx_marketing_consent_log_action ON marketing_consent_log (action);

ALTER TABLE IF EXISTS marketing_consent_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read consent log" ON marketing_consent_log;
CREATE POLICY "Admins can read consent log" ON marketing_consent_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can write consent log via service" ON marketing_consent_log;
CREATE POLICY "Anyone can write consent log via service" ON marketing_consent_log
    FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Admins can manage consent log" ON marketing_consent_log;
CREATE POLICY "Admins can manage consent log" ON marketing_consent_log
    FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
           WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- CRITICAL review fixes (round 1): idempotency + delivery-count indexes.
-- A partial UNIQUE index on (campaign_id, contact_id, channel) makes the
-- ON CONFLICT DO NOTHING upsert in /api/marketing-send safe: a double-confirmed
-- send cannot produce duplicate Twilio/Resend dispatches or duplicate
-- marketing_sends rows. Rows where contact_id is null (legacy recipients from
-- coalition_signal_subscribers / subscribe_emails / orders that have no
-- marketing_contacts row yet) are intentionally excluded so first-time dispatches
-- from those sources can still cross the bridge.
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_sends_no_dup
    ON marketing_sends (campaign_id, contact_id, channel)
    WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign_status
    ON marketing_sends (campaign_id, status);

-- Back the GET-side unsubscribe-token window check. Tokens older than 365d
-- (i.e. contacts with no engagement in over a year) rejected by /api/marketing-optout.
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_token_active
    ON marketing_contacts (unsubscribe_token, updated_at);

DO $$ BEGIN RAISE NOTICE 'marketing_* tables + RLS + updated_at triggers + idempotency index ready'; END $$;
