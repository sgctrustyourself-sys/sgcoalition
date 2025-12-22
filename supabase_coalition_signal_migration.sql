-- Coalition Signal Subscribers Table
-- Tracks email and SMS signups for Coalition notifications and rewards
-- Includes opt-in/opt-out management with rewards warning

CREATE TABLE IF NOT EXISTS coalition_signal_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_type TEXT NOT NULL CHECK (subscriber_type IN ('sms', 'email')),
    contact_value TEXT NOT NULL, -- phone number or email
    country_code TEXT, -- for SMS subscribers (e.g., '+1')
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    source TEXT DEFAULT 'website', -- where they signed up from
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- linked user account if any
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: One contact per type (can have same email for both types)
    CONSTRAINT unique_contact_per_type UNIQUE (subscriber_type, contact_value)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signal_subs_type ON coalition_signal_subscribers(subscriber_type);
CREATE INDEX IF NOT EXISTS idx_signal_subs_status ON coalition_signal_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_signal_subs_created ON coalition_signal_subscribers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_subs_contact ON coalition_signal_subscribers(contact_value);

-- Enable Row Level Security
ALTER TABLE coalition_signal_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for public signup)
CREATE POLICY "Allow public signups" ON coalition_signal_subscribers
    FOR INSERT WITH CHECK (true);

-- Policy: Only admins can view/update/delete
CREATE POLICY "Admin full access" ON coalition_signal_subscribers
    FOR ALL 
    TO authenticated
    USING (is_admin(auth.uid()));

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_coalition_signal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_coalition_signal_updated_at
    BEFORE UPDATE ON coalition_signal_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_coalition_signal_updated_at();

-- Verification query (run after migration)
-- SELECT subscriber_type, status, COUNT(*) as count 
-- FROM coalition_signal_subscribers 
-- GROUP BY subscriber_type, status;
