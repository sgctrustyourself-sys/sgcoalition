-- ============================================================================
-- 20261101_add_tier_pricing_and_numbered_pieces.sql
-- ----------------------------------------------------------------------------
-- Numbered-edition shirts where the first N units are priced at one price, and
-- units N+1+ are priced higher. Each unit in the numbered edition is uniquely
-- numbered (1/edition_size) and may carry an NFC tag that resolves to its NFT
-- twin on Polygon.
--
-- Implementer's contract (commit message):
--   * products.edition_size    INT             -- total units in the numbered tier
--   * products.pricing_tiers   JSONB           -- e.g. [{"until_count":44,"price":75},{"until_count":null,"price":100}]
--   * numbered_pieces          table           -- one row per (product_id, piece_index) 1..edition_size
--     piece_index              INT             -- 1..edition_size
--     order_id                 TEXT NULL       -- bound on order-paid; stays bound on refund
--     nft_token_id             TEXT NULL       -- OpenSea/Polygon token id (operator mints externally)
--     nfc_tag_url              TEXT NULL       -- resolves to the NFT claim page; optional
--   * get_product_paid_count   RPC             -- used by server-side tier price re-verification
--
-- Layered onto the existing 'is_limited_edition' boolean on products (migration
-- 20260620). The numbered-edition UI in components/ProductCard.tsx and
-- pages/ProductDetails.tsx renders ONLY when edition_size IS NOT NULL.
-- ============================================================================

ALTER TABLE IF EXISTS public.products
    ADD COLUMN IF NOT EXISTS edition_size INT,
    ADD COLUMN IF NOT EXISTS pricing_tiers JSONB;

COMMENT ON COLUMN public.products.edition_size IS
    'When set, this product is a numbered edition of N units. Units 1..N get the first pricing_tiers row. Setting this alongside is_limited_edition lets the storefront render the X/N badge.';
COMMENT ON COLUMN public.products.pricing_tiers IS
    'JSONB array of {until_count INT|null, price NUMERIC}. until_count=null = remainder. [{until_count:44,price:75},{until_count:null,price:100}] means first 44 units priced at 75, units 45+ at 100. Stored as dollars; cents conversion happens client-side.';

CREATE TABLE IF NOT EXISTS public.numbered_pieces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    piece_index INT NOT NULL CHECK (piece_index >= 1),
    order_id TEXT,
    nft_token_id TEXT,
    nfc_tag_url TEXT,
    assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, piece_index)
);

CREATE INDEX IF NOT EXISTS idx_numbered_pieces_product ON public.numbered_pieces (product_id);
CREATE INDEX IF NOT EXISTS idx_numbered_pieces_order ON public.numbered_pieces (order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.numbered_pieces IS
    'One row per physical unit of a numbered-edition product. piece_index is 1..edition_size. order_id is bound by the order-paid handler on lowest-available-first policy and stays bound on refund (the NFT twin, if any, still belongs to the original customer).';
COMMENT ON COLUMN public.numbered_pieces.piece_index IS
    'Display number for the physical unit, e.g. 12/44 means piece_index=12 on a product with edition_size=44.';
COMMENT ON COLUMN public.numbered_pieces.nft_token_id IS
    'Polygon/Ethereum token id of this unit''s NFT twin. Set by the operator via the admin ProductManager grid; operator mints lazily on OpenSea.';
COMMENT ON COLUMN public.numbered_pieces.nfc_tag_url IS
    'URL the NFC tag embedded in this unit''s hang tag resolves to. Optional: ''may include NFC tags'' per the brief. Falls back to product.nft.openseaUrl when null.';

ALTER TABLE IF EXISTS public.numbered_pieces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read numbered_pieces" ON public.numbered_pieces;
CREATE POLICY "Anyone can read numbered_pieces" ON public.numbered_pieces
    FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins can manage numbered_pieces" ON public.numbered_pieces;
CREATE POLICY "Admins can manage numbered_pieces" ON public.numbered_pieces
    FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
           WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- get_product_paid_count: returns the summed quantity of this product across
-- PAID orders. Used by api/complete-order.ts and api/place-order-credits.ts to
-- re-verify the tier price at order-submit time so a tampered client cannot pay
-- the tier-1 price after edition has sold out (and vice versa).
CREATE OR REPLACE FUNCTION public.get_product_paid_count(p_id TEXT)
RETURNS INT AS $$
    SELECT COALESCE(SUM((item->>'quantity')::int), 0)::int
    FROM public.orders o,
         jsonb_array_elements(o.items) AS item
    WHERE o.payment_status = 'paid'
      AND item->>'productId' = p_id;
$$ LANGUAGE SQL STABLE;

DO $$ BEGIN RAISE NOTICE 'numbered_pieces + tier_pricing + paid_count RPC ready'; END $$;
