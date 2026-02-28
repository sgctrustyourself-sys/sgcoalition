-- Account Linking System - Database Migration
-- Enables wallet users to link to email accounts for full feature access

-- Table: wallet_accounts
-- Links wallet addresses to Supabase auth users (1 wallet = 1 email)
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_address ON wallet_accounts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts(user_id);

-- Row Level Security
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet links
CREATE POLICY "Users can view own wallet links"
  ON wallet_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can link their own wallets
CREATE POLICY "Users can link their own wallets"
  ON wallet_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlink their own wallets
CREATE POLICY "Users can unlink their own wallets"
  ON wallet_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Function: Get linked user ID from wallet address
CREATE OR REPLACE FUNCTION get_linked_user_id(p_wallet_address VARCHAR(42))
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM wallet_accounts
  WHERE LOWER(wallet_address) = LOWER(p_wallet_address);
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Link wallet to current user
CREATE OR REPLACE FUNCTION link_wallet_to_user(p_wallet_address VARCHAR(42))
RETURNS BOOLEAN AS $$
DECLARE
  v_existing_link UUID;
BEGIN
  -- Check if wallet is already linked
  SELECT user_id INTO v_existing_link
  FROM wallet_accounts
  WHERE LOWER(wallet_address) = LOWER(p_wallet_address);
  
  IF v_existing_link IS NOT NULL THEN
    RAISE EXCEPTION 'Wallet already linked to another account';
  END IF;
  
  -- Check if current user already has a wallet linked
  SELECT user_id INTO v_existing_link
  FROM wallet_accounts
  WHERE user_id = auth.uid();
  
  IF v_existing_link IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a wallet linked';
  END IF;
  
  -- Create the link
  INSERT INTO wallet_accounts (wallet_address, user_id)
  VALUES (p_wallet_address, auth.uid());
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_linked_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_linked_user_id TO anon;
GRANT EXECUTE ON FUNCTION link_wallet_to_user TO authenticated;

-- Comments
COMMENT ON TABLE wallet_accounts IS 'Links wallet addresses to Supabase auth users (1-to-1)';
COMMENT ON FUNCTION get_linked_user_id IS 'Returns the user_id linked to a wallet address';
COMMENT ON FUNCTION link_wallet_to_user IS 'Links a wallet address to the current authenticated user';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Wallet accounts table and functions created successfully!';
END $$;
