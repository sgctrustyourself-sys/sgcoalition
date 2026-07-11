import { Product, Section } from './types';
import { PRODUCT_IMAGE_URLS } from './utils/localImageAssets';

export const INITIAL_PRODUCTS: Product[] = [
  {
    "id": "prod_womens_coalition_halo_contrast_tee",
    "name": "WOMEN'S COALITION HALO CONTRAST TEE",
    "price": 40,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_X4it3yW.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IXJsUIn.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_DJJY3LT.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_AAW60N3.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_k3cZbA3.png"
    ],
    "description": "Women's Coalition Halo Contrast Tee in bodycon raglan sleeve cut with contrast sleeve stripes, the same gold Coalition halo chest logo as the Coalition Halo Mini Dress, and a TRUST YOURSELF hit on the back. $40, sized S-M-L-XL.",
    "category": "shirt",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "sizeInventory": {
      "L": 1,
      "M": 1,
      "S": 1,
      "XL": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_set_above_as_below",
    "name": "COALITION ABOVE AS BELOW SET",
    "price": 120,
    "images": [
      "/images/above-as-below-set-front.png",
      "/images/above-as-below-set-back.png",
      "/images/above-as-below-tee-front.png",
      "/images/above-as-below-tee-back.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-above-as-below-set_1783736765709_ppzti.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-above-as-below-set_1783736776254_6lzfr.jpg"
    ],
    "description": "Above as Below tee and shorts together in one set. Each piece is $75 on its own ($150 total); the set is $120, saving $30 off the combined price. Sized S-M-L-XL-2XL.",
    "category": "apparel",
    "isFeatured": true,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "2XL"
    ],
    "sizeInventory": {
      "L": 4,
      "M": 4,
      "S": 4,
      "XL": 4,
      "2XL": 4
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_halo_mini_dress",
    "name": "COALITION HALO MINI DRESS",
    "price": 50,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_nzsauOz.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_wYR7Nfx.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_v4xVrou.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_OKefysC.png"
    ],
    "description": "Coalition Halo Mini Dress in black with a fitted cami mini silhouette, gold Coalition chest logo, low scoop back, and gold cross-backed Coalition graphic. Standard live catalog release priced at $50.",
    "category": "dress",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "sizeInventory": {
      "L": 13,
      "M": 13,
      "S": 12,
      "XL": 12
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_womens_above_as_below_contrast_shorts",
    "name": "WOMEN'S COALITION ABOVE AS BELOW CONTRAST SHORTS",
    "price": 40,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_juuQ8jz.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IXvoGU6.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_DpkQWuU.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_BoayHw0.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_coiMyd6.png"
    ],
    "description": "Women's Above as Below contrast shorts in black with white trim, red Coalition artwork, and a red waistband label. Available S-M-L-XL. $40 separately, or grab the matching crop tank and shorts set for $75.",
    "category": "shorts",
    "isFeatured": false,
    "isLimitedEdition": true,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "sizeInventory": {
      "L": 1,
      "M": 1,
      "S": 1,
      "XL": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_womens_above_as_below_crop_tank",
    "name": "WOMEN'S COALITION ABOVE AS BELOW CREWNECK CROP TANK",
    "price": 40,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_HFMfNYr.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EqDgC3h.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_DpkQWuU.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_BoayHw0.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_coiMyd6.png"
    ],
    "description": "Women's Above as Below crewneck crop tank in black with front SG artwork, back Above as Below graphic, and red Coalition hem label. $40 separately, or pair it with the contrast shorts as a $75 set.",
    "category": "shirt",
    "isFeatured": false,
    "isLimitedEdition": true,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "sizeInventory": {
      "L": 1,
      "M": 1,
      "S": 1,
      "XL": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_womens_above_as_below_set",
    "name": "WOMEN'S COALITION ABOVE AS BELOW SET",
    "price": 75,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_DpkQWuU.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_BoayHw0.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_coiMyd6.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_HFMfNYr.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EqDgC3h.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_juuQ8jz.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IXvoGU6.png"
    ],
    "description": "Women's Above as Below set with the crewneck crop tank and contrast shorts together. Black body, red-and-white Coalition artwork, and matching set styling. $75 as a set, sized S-M-L-XL.",
    "category": "apparel",
    "isFeatured": false,
    "isLimitedEdition": true,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "sizeInventory": {
      "L": 1,
      "M": 1,
      "S": 1,
      "XL": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_shorts_above_as_below",
    "name": "COALITION ABOVE AS BELOW SHORTS",
    "price": 75,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-above-as-below-shorts_1783729486602_9deoa.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-above-as-below-shorts_1783729493692_5c9nj.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-above-as-below-shorts_1783729519131_q10f6.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-above-as-below-shorts_1783729528884_vs44r.jpg"
    ],
    "description": "The matching Above as Below shorts. Same hand-crafted red-and-white Coalition lineage as the tee - heavyweight cotton, deep set pocket, raw-hem finished. Sold at $75 individually, or grab the set with the tee for $120 and save $30.",
    "category": "apparel",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "2XL"
    ],
    "sizeInventory": {
      "L": 9,
      "M": 9,
      "S": 9,
      "XL": 9,
      "2XL": 8
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "Coalition_Grey_Wave_Wallet_2_2",
    "name": "Coalition 'Grey Wave' Wallet 2/2",
    "price": 75,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_FVMHZoq.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_LLoGORu.jpg"
    ],
    "description": "Second and final piece in the Coalition 'Grey Wave' wallet run. Hand-finished with a storm-grey wave pattern, raw edge stitching, copper grommet, and Coalition mark. Built as a limited 2/2 collectible - once sold, it's gone forever.",
    "category": "wallet",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "Coalition_Above_As_Below_Wallet_1_1",
    "name": "COALITION ABOVE AS BELOW 1/1 WALLET",
    "price": 85,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_9NF3LzM.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_UoY42bg.jpg"
    ],
    "description": "1/1 Above as Below wallet. Hand-finished with the same storm-and-balance motif as the matching Above as Below tee - single piece, one red-and-white Coalition mark, scaled for everyday carry. Once sold, gone forever.",
    "category": "wallet",
    "isFeatured": false,
    "isLimitedEdition": true,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_hoodie_overwhelmingly_patient",
    "name": "COALITION OVERWHELMINGLY PATIENT HOODIE",
    "price": 100,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-overwhelmingly-patient-hoodie_1783731190610_d0syc.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-overwhelmingly-patient-hoodie_1783731203310_oc89x.jpg"
    ],
    "description": "Pre-order release of the Coalition Overwhelmingly Patient Hoodie at $100. Inspired by the Sacral Chakra (Svadhisthana) - creativity, pleasure, flow. Hand-cut heavyweight fleece, burnt-orange mark centered over the lower abdomen. Free shipping when paired with any other item. Reservations capped at one per size; ships in 4-6 weeks from the close of the pre-order window.",
    "category": "apparel",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "2XL"
    ],
    "sizeInventory": {
      "L": 1,
      "M": 1,
      "S": 1,
      "XL": 1,
      "2XL": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "Coalition_Grey_Wave_Wallet_1_2",
    "name": "Coalition 'Grey Wave' Wallet 1/2",
    "price": 75,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_7z2h8u6.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_UqtbJCq.jpg"
    ],
    "description": "First piece in the Coalition 'Grey Wave' wallet run. Hand-finished with a custom charcoal-grey dye pattern inspired by Baltimore harbor at dawn. Built as a limited 1/2 collectible — once sold, it's gone forever.",
    "category": "wallet",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 0
    },
    "nft": null,
    "archived": true,
    "archivedAt": "2026-06-25T02:40:12.191+00:00",
    "releasedAt": null,
    "soldAt": "2026-06-25T02:40:12.191+00:00"
  },
  {
    "id": "prod_tee_above_as_below",
    "name": "COALITION ABOVE AS BELOW TEE",
    "price": 75,
    "images": [
      "/images/above-as-below-tee-front.png",
      "/images/above-as-below-tee-back.png",
      "/images/above-as-below-tee-model-front.png",
      "/images/above-as-below-tee-model-back.png"
    ],
    "description": "The Above as Below tee features a heavyweight black body with red-and-white Coalition artwork across the front and a full back graphic built around the Above as Below concept.",
    "category": "shirt",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "2XL"
    ],
    "sizeInventory": {
      "L": 9,
      "M": 9,
      "S": 9,
      "XL": 9,
      "2XL": 8
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_1773860269374",
    "name": "Coalition Shark Tee - 1/1 Exclusive",
    "price": 40,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_evsuOt6.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_gaA93ug.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_cYmL6GQ.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IVmfRGx.png"
    ],
    "description": "Unique SGCoalition tie-dye 'Trust Yourself' tee with a striking blue spiral pattern and the iconic crowned-bird graphic. This one-of-a-kind piece features premium print details and a motivational streetwear vibe. Size Small, in excellent condition with no flaws - ideal for collectors or anyone looking to add a standout Coalition piece to their wardrobe.",
    "category": "shirt",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "sizeInventory": {
      "L": 0,
      "M": 0,
      "S": 1,
      "XL": 0
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "SKYYBLUEWALLET1_2",
    "name": "COALITION SKYY BLUE WALLET 1/2",
    "price": 75,
    "images": [
      "/images/products/wallet-skyy-blue/front.jpg",
      "/images/products/wallet-skyy-blue/back.jpg"
    ],
    "description": "Second piece of the Skyy Blue collection. Hand-crafted tie-dye wallet with silver stitched border. Each piece unique — no two alike.",
    "category": "wallet",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 0
    },
    "nft": null,
    "archived": true,
    "archivedAt": "2026-05-22T22:33:38+00:00",
    "releasedAt": null,
    "soldAt": "2026-05-22T00:00:00+00:00"
  },
  {
    "id": "prod_trust_yourself_hat_01",
    "name": "Trust Yourself Custom Trucker (1/1)",
    "price": 50,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_iYBlwm8.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_jwnVHoI.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_YNiTSFA.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_HqcoV24.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_6179VgH.png"
    ],
    "description": "A one-of-one custom trucker hat featuring 3D puff \"TRUST YOURSELF\" embroidery, hand-distressed brim, and a custom D20 pin. This piece represents the next evolution of Coalition headwear.",
    "category": "headwear",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 0
    },
    "nft": null,
    "archived": true,
    "archivedAt": "2026-03-03T09:39:56.104+00:00",
    "releasedAt": null,
    "soldAt": "2025-01-01T00:00:00+00:00"
  },
  {
    "id": "Coalition_x_True_Religion_S1",
    "name": "Coalition x True Religion 1/1 Jeans S1",
    "price": 240,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_2VU7MEr.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_hJgvL2K.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EsvBcv4.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_J9EmRZq.jpg"
    ],
    "description": "One-of-one Coalition x True Religion collaboration jeans. Season 1 exclusive — custom distressed denim with premium detailing. Size 33. Once it's gone, it's gone.",
    "category": "jeans",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "33"
    ],
    "sizeInventory": {
      "33": 0
    },
    "nft": null,
    "archived": true,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": "2026-03-06T00:00:00+00:00"
  },
  {
    "id": "GreenCamoWallet",
    "name": "Coalition Green Camo Wallet",
    "price": 75,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_kzIWQzA.png",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_hs4lZFg.png"
    ],
    "description": "Exclusive 1/1 custom wallet featuring camo green aesthetic and signature Coalition branding. Hand-crafted and unique.",
    "category": "accessory",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 0
    },
    "nft": null,
    "archived": true,
    "archivedAt": "2026-05-22T22:33:38+00:00",
    "releasedAt": null,
    "soldAt": "2026-05-22T00:00:00+00:00"
  },
  {
    "id": "Coalition_NF_Tee",
    "name": "COALITION NF-TEE",
    "price": 40,
    "images": [
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1783736436519_jk5ra.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1783736481681_4gmaa.jpg",
      "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1783736602190_jm88p.jpg"
    ],
    "description": "The future of streetwear. This limited edition phy-gital tee serves as your access pass to the Coalition ecosystem. Features exclusive \"Trust Yourself\" puff print and embedded NFC technology linked to its digital twin on the Polygon blockchain.",
    "category": "shirt",
    "isFeatured": false,
    "isLimitedEdition": false,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "sizeInventory": {
      "L": 1,
      "M": 1,
      "S": 1,
      "XL": 1
    },
    "nft": {
      "chain": "polygon",
      "tokenId": "1",
      "openseaUrl": "https://opensea.io/collection/sg-coalition",
      "contractAddress": "0x951806a2581c22C478aC613a675e6c898E2aBe21"
    },
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  }
];

export const PRODUCT_LOCAL_OVERRIDES: Record<string, Partial<Product>> = {
  Coalition_Grey_Wave_Wallet_1_2: {
    archived: true,
    archivedAt: '2026-06-25T02:40:12.191+00:00',
    soldAt: '2026-06-25T02:40:12.191+00:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    archiveNote: "This exact Grey Wave wallet has sold. Request a similar custom if you want the same charcoal-grey direction rebuilt for a future drop."
  },
  SKYYBLUEWALLET1_2: {
    archived: true,
    archivedAt: '2026-03-26T00:00:00Z',
    soldAt: '2026-03-26T00:00:00Z',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    archiveNote: 'This exact wallet was given to an unhoused veteran after a chance encounter on a dirt bike ride. Seeing someone who served the country still left outside stayed with us. Coalition is built on action, dignity, and showing up for people when the moment calls for it, so this piece was given away instead of sold.'
  }
};

export const ABOUT_TEXT = `Coalition is more than a brand; it is a movement born on the streets of Baltimore. We believe in the power of unity and the strength of the collective. Every stitch represents our commitment to quality, community, and the hustle that defines our city. Join the Coalition.`;

export const INITIAL_SECTIONS: Section[] = [
  {
    id: 'sec_hero',
    type: 'hero',
    title: 'CRAFTED IN BALTIMORE',
    isVisible: true,
    order: 0,
    content: 'Premium streetwear designed for the city that built us.'
  },
  {
    id: 'sec_featured',
    type: 'featured',
    title: 'Spotlight',
    isVisible: true,
    order: 1
  },
  {
    id: 'sec_custom_inquiry',
    type: 'custom_inquiry_cta',
    title: 'Custom Designs',
    isVisible: true,
    order: 2
  },
  {
    id: 'sec_grid',
    type: 'grid',
    title: 'Latest Drops',
    isVisible: true,
    order: 3
  },
  {
    id: 'sec_about',
    type: 'about_teaser',
    title: 'The Coalition',
    isVisible: true,
    order: 4,
    content: ABOUT_TEXT.substring(0, 200) + '...'
  },
];

export const COIN_REWARD_RATE = 1; // V2: 1 SGC per $1 spent (~4.5% rewards at $0.045/SGC)
export const SG_COIN_RATE = COIN_REWARD_RATE; // Legacy alias for ProductPage compatibility
export const V2_REWARD_RATE = 0.25; // Legacy reference, can be deprecated or used for calculations

// =====================================
// NO REFUNDS POLICY CONFIGURATION
// =====================================

export const SALES_FINAL_ENABLED = import.meta.env.VITE_SALES_FINAL === 'true';

export const CONSENT_TEXT = "All sales are final. No returns, exchanges, or refunds will be accepted.";

export const CONSENT_CHECKBOX_TEXT = "I confirm I have read and agree that all sales are final and I will not request a refund or return.";

export const REFUND_POLICY_FULL_TEXT = `
All sales are final. We do not accept returns, exchanges, or refunds on any products purchased through this website.

By completing your purchase, you acknowledge and agree to this policy.

If you have questions about a product before purchasing, please contact us at support@sgcoalition.xyz.
`.trim();

// =====================================
// SGCOIN DISCOUNT CONFIGURATION
// =====================================

export const SGCOIN_DISCOUNT_ENABLED = import.meta.env.VITE_SGCOIN_DISCOUNT_ENABLED === 'true';
export const SGCOIN_DISCOUNT_PERCENTAGE = parseFloat(import.meta.env.VITE_SGCOIN_DISCOUNT_PERCENTAGE || '10');

export const SGCOIN_PAYMENT_METHODS = ['sgcoin', 'gmoney'] as const;
export type SGCoinPaymentMethod = typeof SGCOIN_PAYMENT_METHODS[number];

// =====================================
// TUTORIAL CONFIGURATION
// =====================================

// =====================================
// SGCOIN V2 MIGRATION CONFIGURATION
// =====================================
// FAIR FLAT-RATIO MIGRATION SYSTEM
// Every holder receives the same migration ratio regardless of wallet size
// This ensures fairness, transparency, and rewards loyalty equally
// Ratio set to 1M:1 (matching the old "Whale" tier worst-case scenario)

export const V1_TOTAL_SUPPLY = 10_000_000_000_000; // 10 Trillion V1
export const V2_TOTAL_SUPPLY = 10_000_000; // 10 Million V2
export const MIGRATION_RATIO = 1_000_000; // 1M V1 = 1 V2 (flat for everyone)

// Migration ratio calculation helper
export const calculateV2Amount = (v1Amount: number): number => {
  return v1Amount / MIGRATION_RATIO;
};

// Migration ratio display helper
export const getMigrationRatioDisplay = (): string => {
  return `${MIGRATION_RATIO.toLocaleString()}:1`;
};

export const SGCOIN_V1_CONTRACT_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
export const SGCOIN_V2_CONTRACT_ADDRESS = '0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e'; // Official V2 Contract
export const SGCOIN_MIGRATOR_ADDRESS = '0xc6c1EB54E5Ed966C0B48154d6e22eaA8a4c4C536'; // SafeMigration Contract (Flat 1M:1 Logic)
export const SGCOIN_BURN_ADDRESS = '0x20756b2667D575Ddde2383f3841D2CD855D5fb6d'; // Migration Burn Wallet
export const SGCOIN_LIQUIDITY_PROVIDER = '0xd4d7691f062614ae6905d7bef62638b42c33df9f'; // SGCoin V2 Source Wallet

// Strategic Liquidity Tracking
export const QUICKSWAP_LP_ADDRESS = '0x43a974142b297D2f09a39ACd838a66452789ba32'; // SGC/WPOL Pair (V2)
export const QUICKSWAP_V3_LP_ADDRESS = '0x95194a754b6f768ed08ef5d695dabee349b7bf72'; // SGC/WPOL Pair (V3)
export const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // Wrapped POL
export const TREASURY_WALLET_ADDRESS = '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4'; // SGC Treasury / Founder Wallet
export const LIQUIDITY_TARGET_POL = 500;
export const FALLBACK_LIQUIDITY_POL = 27.6; // Last known good value

export const QUICKSWAP_SWAP_URL = `https://dapp.quickswap.exchange/swap/best/ETH/${SGCOIN_V2_CONTRACT_ADDRESS}?chainId=137`;
export const POLYGON_RPC_URLS = [
  'https://polygon-bor.publicnode.com',
  'https://polygon-rpc.com',
  'https://rpc-mainnet.maticvigil.com'
];
export const POLYGON_RPC_URL = POLYGON_RPC_URLS[0];
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_CURRENCY_SYMBOL = 'MATIC';
export const POLYGON_BLOCK_EXPLORER = 'https://polygonscan.com';

// Tutorial Progress
export const TUTORIAL_STORAGE_KEY = 'sgcoin_tutorial_progress';
export const TUTORIAL_STEPS = 6;

// Tutorial Step Names
export const TUTORIAL_STEP_NAMES = [
  'Welcome',
  'Install MetaMask',
  'Switch to Polygon',
  'Fund Wallet',
  'Swap on QuickSwap',
  'Use SGCoin'
];

export const MINI_WIZARDS_CONTRACT_ADDRESS = '0x653b07c58669bc335fc9cfe2f9afa68f7fe94fc2';

// =====================================
// ADMIN CONFIGURATION
// =====================================
// =====================================
// ADMIN CONFIGURATION
// =====================================
export const ADMIN_WALLETS = [
  '0x0f4a0466c2a1d3fa6ed55a20994617f0533fbf74', // Founder
  '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4', // Founder Secondary / Treasury
];


export const INITIAL_ORDERS: any[] = [
  {
    id: 'order_wholesale_wallets_2026_05_22',
    orderNumber: 'ORD-SG-WHOLESALE-1002',
    isGuest: true,
    customerName: 'Wholesale Customer',
    customerEmail: 'wholesale@example.com',
    items: [
      {
        productId: 'prod_wallet_004',
        productName: 'COALITION WALLETS WHOLESALE (7x)',
        productImage: 'https://i.imgur.com/v5y7tPa.jpg',
        selectedSize: 'One Size',
        quantity: 7,
        price: 25,
        total: 175
      }
    ],
    subtotal: 175,
    tax: 0,
    discount: 0,
    total: 175,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    createdAt: '2026-05-22T22:48:11-04:00',
    paidAt: '2026-05-22T22:48:11-04:00'
  }
];

export const ADMIN_USER = {
  uid: 'admin',
  displayName: 'Admin',
  email: 'admin@sgcoalition.xyz',
  walletAddress: null,
  sgCoinBalance: 0,
  isAdmin: true,
  favorites: []
};
