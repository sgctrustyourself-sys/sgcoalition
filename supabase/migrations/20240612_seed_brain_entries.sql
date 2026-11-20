-- Bootstrap Coalition Brain knowledge base entries.
-- Safe to rerun: seed rows are claimed/upserted by metadata.seed_key.

CREATE TABLE IF NOT EXISTS public.brain_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source TEXT DEFAULT 'manual',
    importance INTEGER DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
    image_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS title TEXT NOT NULL;
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS content TEXT NOT NULL;
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 3;
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.brain_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view brain entries" ON public.brain_entries;
DROP POLICY IF EXISTS "Only admins can view brain entries" ON public.brain_entries;

DROP POLICY IF EXISTS "Only admins can insert brain entries" ON public.brain_entries;
DROP POLICY IF EXISTS "Only admins can update brain entries" ON public.brain_entries;
DROP POLICY IF EXISTS "Only admins can delete brain entries" ON public.brain_entries;

DO $$
BEGIN
    IF to_regclass('public.admin_users') IS NOT NULL
       AND to_regprocedure('auth.uid()') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'admin_users'
             AND column_name = 'user_id'
       ) THEN
        EXECUTE $policy$
        CREATE POLICY "Only admins can view brain entries"
            ON public.brain_entries
            FOR SELECT
            USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Only admins can insert brain entries"
            ON public.brain_entries
            FOR INSERT
            WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Only admins can update brain entries"
            ON public.brain_entries
            FOR UPDATE
            USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Only admins can delete brain entries"
            ON public.brain_entries
            FOR DELETE
            USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
        $policy$;
    ELSE
        RAISE NOTICE 'Skipping Brain admin write policies because public.admin_users.user_id or auth.uid() is not available.';
    END IF;
END $$;

DROP TABLE IF EXISTS pg_temp.brain_seed_aliases;
DROP TABLE IF EXISTS pg_temp.brain_seed_entries;
CREATE TEMP TABLE brain_seed_entries (
    seed_key TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] NOT NULL,
    source TEXT NOT NULL,
    importance INTEGER NOT NULL
);

CREATE TEMP TABLE brain_seed_aliases (
    seed_key TEXT NOT NULL REFERENCES brain_seed_entries(seed_key),
    title TEXT NOT NULL,
    PRIMARY KEY (seed_key, title)
);

INSERT INTO brain_seed_entries (seed_key, category, title, content, tags, source, importance) VALUES
('brand-voice-tone', 'brand_guidelines', 'Coalition Brand Voice & Tone', 'The Coalition brand voice is authentic, bold, and community-driven. We speak with the confidence of a streetwear brand rooted in Baltimore. Our tone is direct but inclusive. Avoid corporate jargon. Our audience is young, creative, and values authenticity over polish.', ARRAY['brand','voice','tone','copywriting'], 'manual', 5),
('color-visual-identity', 'brand_guidelines', 'Color Palette & Visual Identity', 'Primary palette: deep black (#000000) foundation and electric purple (#A855F7) accents/CTAs. Secondary colors: cyan (#06B6D4) for data/metrics, amber (#F59E0B) for rewards, and emerald (#10B981) for success states. Typography uses the system font stack with uppercase tracking for headings. Design should feel dark, premium, high-contrast, and selectively use subtle gradients or glass effects.', ARRAY['design','colors','typography','visual-identity'], 'design_session', 5),
('nf-tee-product-spec-nfc', 'product_design', 'NF-TEE Product Spec & NFC', 'Flagship phy-gital product. Heavyweight 100% cotton, oversized fit, puff-print Trust Yourself graphic on back, small Coalition logo on front. NFC chip in neck tag links to NFT claim on OpenSea. Smart contract: 0x951806a2581c22C478aC613a675e6c898E2aBe21 on Polygon. Each tee ships with a unique NFT twin. Future: update NFC URL to point to sgcoalition.xyz claim flow.', ARRAY['nf-tee','nfc','product-spec','polygon','nft'], 'product', 4),
('wallet-product-line-strategy', 'product_design', 'Wallet Product Line Strategy', 'Limited-run tactical wallets with RFID protection. Small batches of 1-4 per special edition. Key features: multiple card slots, durable canvas/leather, custom camo or tie-dye. Standard pricing: $35. Special collaborations can price higher. Archive sold-out wallets with an archiveNote that preserves the story. Future: phone cases and card holders.', ARRAY['wallets','product-strategy','pricing','archive'], 'product', 4),
('photography-content-style', 'creative_direction', 'Photography & Content Style', 'Product shots: clean dark background and dramatic lighting. Model shots: real people in urban Baltimore settings such as alleys, rooftops, and industrial locations. Avoid sterile studio styling. Video: short-form vertical for TikTok/Reels and long-form YouTube for brand story or crypto education. Always tag @sgcoalition. Photo ratios: 4:5 for cards and 16:9 for hero banners.', ARRAY['photography','content','social-media','style-guide'], 'design_session', 3),
('customer-faq-nfc-wallets', 'chat_insight', 'Customer FAQ: NFC & Wallets', 'NF-TEE NFC FAQ: (1) iPhone XS+ supports background NFC tag reading. (2) NFC tag is water-resistant, hand wash recommended. (3) Claim NFT by tapping tag or visiting the hang tag URL; a Polygon wallet such as MetaMask is recommended. (4) NFT can be traded independently on OpenSea. Wallets ship with RFID protection standard.', ARRAY['faq','nfc','customer-support'], 'ai_chat', 3),
('sgcoin-rewards-program-overview', 'general', 'SGCoin Rewards Program Overview', 'Loyalty and rewards token on Polygon blockchain. Customers earn 1 SGCoin per $1 spent. Use for discounts on future purchases. Powers governance votes on product drops. V1 contract: 0x951806a2581c22C478aC613a675e6c898E2aBe21. V2 contract: 0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e. Migration: flat 1,000,000:1 ratio. Burn address: 0x20756b2667D575Ddde2383f3841D2CD855D5fb6d.', ARRAY['sgcoin','rewards','crypto','polygon','tokenomics'], 'manual', 4),
('shipping-fulfillment-workflow', 'general', 'Shipping & Fulfillment Workflow', 'Ships from Baltimore, MD. Processing: 1-3 business days for standard items and 3-5 business days for custom inquiries. Carriers: USPS and UPS. International shipping is available with calculated rates at checkout. All sales final per no-refunds policy. Issues go to support@sgcoalition.xyz. Manual/wholesale orders are handled through the admin panel and bypass standard checkout.', ARRAY['shipping','fulfillment','orders','operations'], 'manual', 3);

INSERT INTO brain_seed_aliases (seed_key, title)
SELECT seed_key, title
FROM brain_seed_entries;

INSERT INTO brain_seed_aliases (seed_key, title) VALUES
('customer-faq-nfc-wallets', 'Customer FAQ: NFC & Wallet'),
('shipping-fulfillment-workflow', 'Shipping & Fulfillment')
ON CONFLICT DO NOTHING;

WITH seed_targets AS (
    SELECT DISTINCT ON (s.seed_key)
        b.id,
        s.seed_key
    FROM brain_seed_entries s
    JOIN brain_seed_aliases a ON a.seed_key = s.seed_key
    JOIN public.brain_entries b ON b.title = a.title
    WHERE COALESCE(b.metadata->>'seed_key', '') = ''
      AND NOT EXISTS (
          SELECT 1
          FROM public.brain_entries keyed
          WHERE keyed.metadata->>'seed_key' = s.seed_key
      )
    ORDER BY s.seed_key, b.created_at ASC NULLS LAST, b.id
)
UPDATE public.brain_entries b
SET metadata = COALESCE(b.metadata, '{}'::jsonb)
        || jsonb_build_object('seed_key', seed_targets.seed_key, 'seed_source', 'coalition_brain_bootstrap'),
    updated_at = now()
FROM seed_targets
WHERE b.id = seed_targets.id;

CREATE UNIQUE INDEX IF NOT EXISTS brain_entries_seed_key_idx
    ON public.brain_entries ((metadata->>'seed_key'))
    WHERE metadata ? 'seed_key';

INSERT INTO public.brain_entries (
    category,
    title,
    content,
    tags,
    source,
    importance,
    metadata,
    created_at,
    updated_at
)
SELECT
    category,
    title,
    content,
    tags,
    source,
    importance,
    jsonb_build_object('seed_key', seed_key, 'seed_source', 'coalition_brain_bootstrap'),
    now(),
    now()
FROM brain_seed_entries
ON CONFLICT ((metadata->>'seed_key')) WHERE (metadata ? 'seed_key')
DO UPDATE SET
    category = EXCLUDED.category,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    tags = EXCLUDED.tags,
    source = EXCLUDED.source,
    importance = EXCLUDED.importance,
    metadata = COALESCE(public.brain_entries.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

DROP TABLE IF EXISTS pg_temp.brain_seed_aliases;
DROP TABLE IF EXISTS pg_temp.brain_seed_entries;
