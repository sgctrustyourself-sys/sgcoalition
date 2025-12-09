-- Add wallet_address column to social_accounts table
ALTER TABLE social_accounts 
ADD COLUMN IF NOT EXISTS wallet_address TEXT;
