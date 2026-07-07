export const PRODUCT_IMAGE_URLS = {
    nfTee: {
        model1: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429266435_jht8v.jpg',
        model2: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429279310_rd1ac.jpg',
        model3: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429293246_pypxs.jpg',
        model4: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429303205_8do7t.jpg',
    },
    aboveAsBelowTee: {
        front: '/images/above-as-below-tee-front.png',
        back: '/images/above-as-below-tee-back.png',
        modelFront: '/images/above-as-below-tee-model-front.png',
        modelBack: '/images/above-as-below-tee-model-back.png',
    },
    aboveAsBelowShorts: {
        front: '/images/shorts%201.webp',
        back: '/images/short%201%20back.png',
        setFront: '/images/above-as-below-set-front.png',
        setBack: '/images/above-as-below-set-back.png',
    },
    womensAboveAsBelowContrastShorts: {
        front: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_juuQ8jz.png',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IXvoGU6.png',
        setAngledFront: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_coiMyd6.png',
        setFront: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_DpkQWuU.png',
        setBack: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_BoayHw0.png',
    },
    womensAboveAsBelowCropTank: {
        front: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_HFMfNYr.png',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EqDgC3h.png',
    },
    womensHaloContrastTee: {
        // Album https://imgur.com/a/bUuIPw9 ships 5 verified product photos
        // for the women's bodycon raglan sleeve tee. Slot mapping
        // (visual audit 2026-07-03: each Imgur hash was loaded and classified):
        //   X4it3yW  = full FRONT flat (gold halo chest logo)
        //   IXJsUIn  = full BACK flat (TRUST YOURSELF)
        //   DJJY3LT  = model wearing FRONT (partial body pose)
        //   AAW60N3  = FRONT close-up (gold halo logo detail)
        //   k3cZbA3  = BACK close-up (TRUST YOURSELF typography)
        // No noise images in the album. No model-back shot was uploaded,
        // so the flat `back` covers the same brand hit as a model back would.
        front: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_X4it3yW.png',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IXJsUIn.png',
        modelFront: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_DJJY3LT.png',
        frontDetail: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_AAW60N3.png',
        backDetail: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_k3cZbA3.png',
    },
    haloMiniDress: {
        // Album https://imgur.com/a/XD73nPS ships only 4 verified dress
        // photos (visual audit 2026-07-01: each Imgur hash was loaded and
        // classified). Wiring the 4 to their natural pose slots and
        // duplicating the nearest neighbour for the two angles the album
        // does NOT include, until those angles upload:
        //   nzsauOz  = face/chest close-up
        //   wYR7Nfx = front full-body   (covers modelFront + modelAngledFront)
        //   v4xVrou = side-profile
        //   OKefysC = back-angled       (covers modelBackAngled + modelBack)
        // The remaining 5 album hashes (vAB30az cartoon, eO01k3Z cat photo,
        // KbE6CVj army-induction video, t4HJ1gI unverified, 8hDRjjl wrestling
        // video) are NOT dress photography and are intentionally not wired.
        modelFaceFront: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_nzsauOz.png',
        modelFront: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_wYR7Nfx.png',
        modelAngledFront: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_wYR7Nfx.png',
        modelSide: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_v4xVrou.png',
        modelBackAngled: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_OKefysC.png',
        modelBack: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_OKefysC.png',
    },
    overwhelminglyPatientHoodie: {
        flatFront: '/images/front.png',
        flatBack: '/images/back.png',
        modelFront: '/images/ChatGPT%20Image%20Jun%2028%2C%202026%2C%2011_31_20%20AM.png',
        modelBack: '/images/ChatGPT%20Image%20Jun%2028%2C%202026%2C%2011_35_18%20AM.png',
    },
    greyWaveWallet: {
        front: '/images/grey-wave-wallet-1-2-front.png',
        back: '/images/grey-wave-wallet-1-2-back.png',
    },
    greyWaveWallet22: {
        front: '/images/grey-wave-wallet-2-2-front.jpg',
        back: '/images/grey-wave-wallet-2-2-back.jpg',
    },
    walletGreen: {
        front: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_kzIWQzA.png',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_hs4lZFg.png',
    },
    walletSkyyBlue: {
        front: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_rJSCmHu.png',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_1FwLI72.png',
    },
    walletSkyyBlueArchive: {
        front: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_Z5K3JZ0.png',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_ySkgCOs.png',
    },
    chromeHeartsWallet: {
        front: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_SS6KbOQ.jpg',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_NUXZizv.jpg',
    },
    trustYourselfHat: {
        cover: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_iYBlwm8.png',
        detail: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_jwnVHoI.png',
        side: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_YNiTSFA.png',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_HqcoV24.png',
        full: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_6179VgH.png',
    },
    distortionTee: {
        main: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_VlTUzGd.jpg',
        frontFlat: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_uwKceKV.jpg',
        backModel: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_1S7Hkyw.jpg',
        backFlat: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_u0qjWgl.jpg',
    },
    sharkTee: {
        main: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_evsuOt6.jpg',
        back: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_gaA93ug.jpg',
        frontFlat: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_cYmL6GQ.png',
        backFlat: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IVmfRGx.png',
    },
    trueReligionJeans: {
        front1: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_2VU7MEr.jpg',
        front2: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_hJgvL2K.jpg',
        front3: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EsvBcv4.jpg',
        front4: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_J9EmRZq.jpg',
    },
} as const;

// Maps old local paths to canonical Imgur/Supabase URLs (for Supabase-stored data)
const LOCAL_TO_REMOTE_IMAGE_URLS: Record<string, string> = {
    '/images/products/nf-tee/model-1.jpg': PRODUCT_IMAGE_URLS.nfTee.model1,
    '/images/products/nf-tee/model-2.jpg': PRODUCT_IMAGE_URLS.nfTee.model2,
    '/images/products/nf-tee/model-3.jpg': PRODUCT_IMAGE_URLS.nfTee.model3,
    '/images/products/nf-tee/model-4.jpg': PRODUCT_IMAGE_URLS.nfTee.model4,
    '/images/products/wallet-green/front.jpg': PRODUCT_IMAGE_URLS.walletGreen.front,
    '/images/products/wallet-green/back.jpg': PRODUCT_IMAGE_URLS.walletGreen.back,
    '/images/products/wallet-skyy-blue/front.jpg': PRODUCT_IMAGE_URLS.walletSkyyBlue.front,
    '/images/products/wallet-skyy-blue/back.jpg': PRODUCT_IMAGE_URLS.walletSkyyBlue.back,
    '/images/products/wallet-skyy-blue-archive/front.png': PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.front,
    '/images/products/wallet-skyy-blue-archive/back.png': PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.back,
    '/images/products/chrome-hearts-wallet/front.jpeg': PRODUCT_IMAGE_URLS.chromeHeartsWallet.front,
    '/images/products/chrome-hearts-wallet/back.jpeg': PRODUCT_IMAGE_URLS.chromeHeartsWallet.back,
    '/images/products/grey-wave-wallet-1-2/front.png': PRODUCT_IMAGE_URLS.greyWaveWallet.front,
    '/images/products/grey-wave-wallet-1-2/back.png': PRODUCT_IMAGE_URLS.greyWaveWallet.back,
    '/images/products/grey-wave-wallet-2-2/front.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.front,
    '/images/products/grey-wave-wallet-2-2/back.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.back,
    '/images/products/trust-yourself-hat/front.png': PRODUCT_IMAGE_URLS.trustYourselfHat.cover,
    '/images/products/trust-yourself-hat/detail-closeup.png': PRODUCT_IMAGE_URLS.trustYourselfHat.detail,
    '/images/products/trust-yourself-hat/side-profile.png': PRODUCT_IMAGE_URLS.trustYourselfHat.side,
    '/images/products/trust-yourself-hat/back-detail.png': PRODUCT_IMAGE_URLS.trustYourselfHat.back,
    '/images/products/trust-yourself-hat/full-display.png': PRODUCT_IMAGE_URLS.trustYourselfHat.full,
    '/images/products/distortion-tee/main.jpeg': PRODUCT_IMAGE_URLS.distortionTee.main,
    '/images/products/distortion-tee/front-flat.jpg': PRODUCT_IMAGE_URLS.distortionTee.frontFlat,
    '/images/products/distortion-tee/back-model.jpg': PRODUCT_IMAGE_URLS.distortionTee.backModel,
    '/images/products/distortion-tee/back-flat.jpg': PRODUCT_IMAGE_URLS.distortionTee.backFlat,
    '/images/products/true-religion-s1/front-1.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front1,
    '/images/products/true-religion-s1/front-2.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front2,
    '/images/products/true-religion-s1/front-3.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front3,
    '/images/products/true-religion-s1/front-4.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front4,
    '/images/above-as-below-shorts-front.png': PRODUCT_IMAGE_URLS.aboveAsBelowShorts.front,
    '/images/above-as-below-shorts-back.png': PRODUCT_IMAGE_URLS.aboveAsBelowShorts.back,
    '/images/coalition-overwhelmingly-patient-hoodie-front.png': PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatFront,
    '/images/coalition-overwhelmingly-patient-hoodie-back.png': PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatBack,
};

const REMOTE_TO_LOCAL_IMAGE_URLS: Record<string, string> = {
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429266435_jht8v.jpg': PRODUCT_IMAGE_URLS.nfTee.model1,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429279310_rd1ac.jpg': PRODUCT_IMAGE_URLS.nfTee.model2,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429293246_pypxs.jpg': PRODUCT_IMAGE_URLS.nfTee.model3,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429303205_8do7t.jpg': PRODUCT_IMAGE_URLS.nfTee.model4,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_kzIWQzA.png': PRODUCT_IMAGE_URLS.walletGreen.front,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_hs4lZFg.png': PRODUCT_IMAGE_URLS.walletGreen.back,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_rJSCmHu.png': PRODUCT_IMAGE_URLS.walletSkyyBlue.front,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_1FwLI72.png': PRODUCT_IMAGE_URLS.walletSkyyBlue.back,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_Z5K3JZ0.png': PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.front,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_ySkgCOs.png': PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.back,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_SS6KbOQ.jpg': PRODUCT_IMAGE_URLS.chromeHeartsWallet.front,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_NUXZizv.jpg': PRODUCT_IMAGE_URLS.chromeHeartsWallet.back,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_7z2h8u6.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet.front,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_UqtbJCq.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet.back,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_FVMHZoq.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.front,
    'https://i.imgur.com/FVMHZoq.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.front,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_LLoGORu.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.back,
    'https://i.imgur.com/LLoGORu.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.back,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_iYBlwm8.png': PRODUCT_IMAGE_URLS.trustYourselfHat.cover,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_jwnVHoI.png': PRODUCT_IMAGE_URLS.trustYourselfHat.detail,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_YNiTSFA.png': PRODUCT_IMAGE_URLS.trustYourselfHat.side,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_HqcoV24.png': PRODUCT_IMAGE_URLS.trustYourselfHat.back,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_6179VgH.png': PRODUCT_IMAGE_URLS.trustYourselfHat.full,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_8Q9Z5bX.png': PRODUCT_IMAGE_URLS.trustYourselfHat.cover,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_VlTUzGd.jpg': PRODUCT_IMAGE_URLS.distortionTee.main,
    'https://imgur.com/YAkjLAm': PRODUCT_IMAGE_URLS.distortionTee.main,
    'https://i.imgur.com/YAkjLAm.jpg': PRODUCT_IMAGE_URLS.distortionTee.main,
    'https://imgur.com/uwKceKV': PRODUCT_IMAGE_URLS.distortionTee.frontFlat,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_uwKceKV.jpg': PRODUCT_IMAGE_URLS.distortionTee.frontFlat,
    'https://imgur.com/1S7Hkyw': PRODUCT_IMAGE_URLS.distortionTee.backModel,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_1S7Hkyw.jpg': PRODUCT_IMAGE_URLS.distortionTee.backModel,
    'https://imgur.com/u0qjWgl': PRODUCT_IMAGE_URLS.distortionTee.backFlat,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_u0qjWgl.jpg': PRODUCT_IMAGE_URLS.distortionTee.backFlat,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_2VU7MEr.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front1,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_hJgvL2K.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front2,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EsvBcv4.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front3,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_J9EmRZq.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front4,
};

import { IMGUR_TO_SUPABASE_MAP } from './imgurSupabaseMap';

export const resolveLocalImageUrl = (url?: string | null) => {
    if (!url) return '';
    // First try: convert old local path to canonical URL
    const localToRemote = LOCAL_TO_REMOTE_IMAGE_URLS[url];
    if (localToRemote) return localToRemote;
    // Second try: Imgur → canonical URL (identity mapping, retained for compatibility)
    const remoteToLocal = REMOTE_TO_LOCAL_IMAGE_URLS[url];
    if (remoteToLocal) return remoteToLocal;
    // Third try: Imgar → Supabase Storage, for legacy DB rows and any URLs
    // the migrator couldn't fetch (e.g. transient Imgar 4xx during the run).
    // Falls through unchanged when the map is empty so a fresh checkout
    // still loads against Imgur until `npm run migrate:imgur` is run.
    const migrated = IMGUR_TO_SUPABASE_MAP[url];
    if (migrated) return migrated;
    return url;
};

export const resolveLocalImageUrls = (urls: Array<string | null | undefined> = []) =>
    urls.map(url => resolveLocalImageUrl(url)).filter(Boolean) as string[];

export const rewriteImageSrcs = (html: string = '') => {
    if (!html) return html;

    // Merge so a single pass rewrites BOTH the historical `REMOTE_TO_LOCAL`
    // aliases (old -> canonical) AND the bulk Imgar -> Supabase map. The
    // historical set is still included because some code paths (older blog
    // posts, archived order snapshots) hoist through the identity map.
    const merged: Record<string, string> = { ...REMOTE_TO_LOCAL_IMAGE_URLS, ...IMGUR_TO_SUPABASE_MAP };
    return Object.entries(merged).reduce(
        (acc, [remoteUrl, localUrl]) => acc.split(remoteUrl).join(localUrl),
        html
    );
};

/**
 * Resolve per-product "named slot" defaults from the `PRODUCT_IMAGE_URLS`
 * asset map for products whose slot taxonomy doesn't fit the default
 * primary/hover/gallery flow (e.g. the Halo Mini Dress has 6 named slots:
 * modelFaceFront / modelFront / modelAngledFront / modelSide /
 * modelBackAngled / modelBack).
 *
 * Caller passes the productId stored on the row / on
 * `editForm.id`. The function returns the canonical slot list (in source
 * order) with each entry's hardcoded default URL. The admin
 * components/admin/ProductManager.tsx renderer overlays the operator's
 * current edits on top so slot i reads from `images[i]` (see
 * ImageRoles.namedSlots).
 *
 * To add a new "named-slot" product: drop a slot map into `PRODUCT_IMAGE_URLS`
 * whose keys are all `model*`-prefixed (or whatever convention this helper
 * scans) AND add an alias here. Today: only prod_halo_mini_dress.
 */
export interface NamedSlotDefault {
    slotName: string;
    defaultUrl: string;
}

const NAMED_SLOT_PRODUCT_ALIASES: Record<string, keyof typeof PRODUCT_IMAGE_URLS> = {
    prod_halo_mini_dress: 'haloMiniDress',
};

export function getNamedSlotDefaults(productId: string | undefined | null): NamedSlotDefault[] {
    if (!productId) return [];
    const key = NAMED_SLOT_PRODUCT_ALIASES[productId];
    if (!key) return [];
    const block = PRODUCT_IMAGE_URLS[key] as unknown as Record<string, string>;
    return Object.entries(block)
        .filter(([slotName, url]) => slotName.toLowerCase().startsWith('model') && typeof url === 'string')
        .map(([slotName, defaultUrl]) => ({ slotName, defaultUrl }));
}
