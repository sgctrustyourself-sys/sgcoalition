-- Add Custom Coalition x Chrome Hearts Wallet to products table
-- Simplified version - let Supabase handle the ID automatically

INSERT INTO products (
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
    'Custom Coalition x Chrome Hearts Wallet',
    'Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet. This unique piece features premium leather construction with signature Chrome Hearts detailing and Coalition branding. A rare collector''s item that combines luxury craftsmanship with streetwear culture. One of a kind - once it''s gone, it''s gone forever.',
    450.00,
    1,
    'accessory',
    ARRAY['https://i.imgur.com/SS6KbOQ.jpeg', 'https://i.imgur.com/NUXZizv.jpeg'],
    ARRAY['One Size'],
    true,
    false
) RETURNING *;

-- This will return the newly created product with its auto-generated ID
