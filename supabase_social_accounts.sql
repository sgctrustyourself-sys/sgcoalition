-- Instagram Account Linking - Database Setup
-- This allows users to link their Instagram accounts and claim rewards

-- Create social_accounts table
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'tiktok')),
    username TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    reward_sent BOOLEAN DEFAULT FALSE,
    reward_sent_at TIMESTAMPTZ,
    notes TEXT,
    UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own social accounts
CREATE POLICY "Users can view own social accounts"
    ON social_accounts FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own social accounts
CREATE POLICY "Users can insert own social accounts"
    ON social_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own social accounts (username only)
CREATE POLICY "Users can update own social accounts"
    ON social_accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all social accounts
-- Note: You'll need to add admin role checking here based on your setup

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_reward_sent ON social_accounts(reward_sent);

-- Comments for documentation
COMMENT ON TABLE social_accounts IS 'Stores linked social media accounts for users';
COMMENT ON COLUMN social_accounts.platform IS 'Social media platform: instagram, twitter, or tiktok';
COMMENT ON COLUMN social_accounts.username IS 'Username on the platform (without @ symbol)';
COMMENT ON COLUMN social_accounts.verified IS 'Whether we have verified the account belongs to the user';
COMMENT ON COLUMN social_accounts.reward_sent IS 'Whether the admin has sent the SGCoin reward';
COMMENT ON COLUMN social_accounts.reward_sent_at IS 'Timestamp when admin sent the reward';
COMMENT ON COLUMN social_accounts.notes IS 'Admin notes about the account or reward';
