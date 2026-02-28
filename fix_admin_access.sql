-- Fix Admin Access for Founder Wallet
-- Run this in the Supabase SQL Editor

-- 1. Ensure the wallet is linked (if not already)
-- This assumes you have a user ID. If you don't know your ID, 
-- this script will try to find it via the profiles or wallet_accounts table.

DO $$
DECLARE
    target_wallet TEXT := '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4';
    target_user_id UUID;
BEGIN
    -- Try to find the user_id by wallet address
    SELECT user_id INTO target_user_id FROM wallet_accounts WHERE LOWER(wallet_address) = LOWER(target_wallet);
    
    IF target_user_id IS NULL THEN
        -- If not in wallet_accounts, try to find in profiles by some other means or just warn
        RAISE NOTICE 'User ID not found for wallet %. Please ensure you have logged in at least once.', target_wallet;
    ELSE
        -- Insert into admin_users
        INSERT INTO admin_users (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
        
        -- Also ensure profile is marked (if your app uses profiles table for admin flags)
        UPDATE profiles SET is_vip = true WHERE id = target_user_id;
        
        RAISE NOTICE 'Admin access granted to User ID: %', target_user_id;
    END IF;
END $$;
