-- Fix Admin Access for Founder Wallet (v2)
-- Run this in the Supabase SQL Editor

DO $$
DECLARE
    target_wallet TEXT := '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4';
    target_user_id UUID;
BEGIN
    -- 1. Try to find the user_id by wallet address in wallet_accounts
    SELECT user_id INTO target_user_id FROM wallet_accounts WHERE LOWER(wallet_address) = LOWER(target_wallet);
    
    -- 2. If not found, try to find in profiles by looking at the ID (some systems use user_eth_ADDRESS)
    IF target_user_id IS NULL THEN
        SELECT id INTO target_user_id FROM profiles WHERE LOWER(id::text) LIKE '%' || LOWER(target_wallet) || '%';
    END IF;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID not found for wallet %. Please ensure you have logged in to the site with this wallet at least once.', target_wallet;
    ELSE
        -- 3. Insert into admin_users
        INSERT INTO admin_users (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
        
        -- 4. Ensure profile is marked as VIP
        UPDATE profiles SET is_vip = true WHERE id = target_user_id;
        
        RAISE NOTICE 'Admin access SUCCESS. User ID: %', target_user_id;
    END IF;
END $$;
