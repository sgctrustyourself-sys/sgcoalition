-- Deploy Coalition Distortion Tee
-- Price: $65.00
-- Category: shirt

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
    'prod_tee_distortion',
    'Coalition Distortion Tee',
    'The Coalition Distortion Tee features a high-density graphic print that warps and bends the brand logo into a digital frequency. Heavyweight cotton construction with a classic streetwear fit. Trust Yourself.',
    65.00,
    100,
    'shirt',
    ARRAY['https://i.imgur.com/VlTUzGd.jpeg'],
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    true,
    false
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    images = EXCLUDED.images,
    category = EXCLUDED.category,
    is_featured = EXCLUDED.is_featured;
