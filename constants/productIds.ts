// ---------------------------------------------------------------------------
// Centralised product-ID constants — single source of truth for every
// hardcoded product reference across the storefront. Every magic string
// that identifies a specific product (the featured wallet, the Above-as-Below
// tee & shorts, the entity-framed Grey Wave wallets, etc.) lives here so it
// can be imported anywhere without duplication and without relying on a
// runtime product lookup.
// ---------------------------------------------------------------------------
export const PRODUCT_IDS = {
    FEATURED_WALLET: 'Coalition_Above_As_Below_Wallet_1_1',
    ABOVE_AS_BELOW_TEE: 'prod_tee_above_as_below',
    ABOVE_AS_BELOW_SHORTS: 'prod_shorts_above_as_below',
    NF_TEE: 'Coalition_NF_Tee',
    GREY_WAVE_WALLET_1_2: 'Coalition_Grey_Wave_Wallet_1_2',
    GREY_WAVE_WALLET_2_2: 'Coalition_Grey_Wave_Wallet_2_2',
    PARTS_WALLET_1_4: 'Coalition_Parts_Wallet_1_4',
    PARTS_WALLET_2_4: 'Coalition_Parts_Wallet_2_4',
    PARTS_WALLET_3_4: 'Coalition_Parts_Wallet_3_4',
    PARTS_WALLET_4_4: 'Coalition_Parts_Wallet_4_4',
} as const;
