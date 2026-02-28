-- Add Custom Coalition x Chrome Hearts Wallet to products table
-- Run this in the Supabase SQL Editor

INSERT INTO products (
    id,
    name,
    description,
    price,
    stock,
    category,
    images,
    sizes,
    is_featured,
    archived
) VALUES (
    'prod_wallet_chrome_hearts',
    'Custom Coalition x Chrome Hearts Wallet',
    'Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet. This unique piece features premium leather construction with signature Chrome Hearts detailing and Coalition branding. A rare collector''s item that combines luxury craftsmanship with streetwear culture. One of a kind - once it''s gone, it''s gone forever.',
    450.00,
    1,
    'wallet',
    ARRAY['https://i.imgur.com/SS6KbOQ.jpeg', 'https://i.imgur.com/NUXZizv.jpeg'],
    ARRAY['One Size'],
    true,
    false
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    images = EXCLUDED.images,
    is_featured = EXCLUDED.is_featured;
