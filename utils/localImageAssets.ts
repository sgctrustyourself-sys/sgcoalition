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
    },
    aboveAsBelowShorts: {
        front: '/images/shorts%201.webp',
        back: '/images/short%201%20back.png',
        setFront: '/images/above-as-below-set-front.png',
        setBack: '/images/above-as-below-set-back.png',
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
        front: 'https://i.imgur.com/kzIWQzA.jpg',
        back: 'https://i.imgur.com/hs4lZFg.jpg',
    },
    walletSkyyBlue: {
        front: 'https://i.imgur.com/rJSCmHu.jpg',
        back: 'https://i.imgur.com/1FwLI72.jpg',
    },
    walletSkyyBlueArchive: {
        front: 'https://i.imgur.com/Z5K3JZ0.png',
        back: 'https://i.imgur.com/ySkgCOs.png',
    },
    chromeHeartsWallet: {
        front: 'https://i.imgur.com/SS6KbOQ.jpeg',
        back: 'https://i.imgur.com/NUXZizv.jpeg',
    },
    trustYourselfHat: {
        cover: 'https://i.imgur.com/iYBlwm8.png',
        detail: 'https://i.imgur.com/jwnVHoI.png',
        side: 'https://i.imgur.com/YNiTSFA.png',
        back: 'https://i.imgur.com/HqcoV24.png',
        full: 'https://i.imgur.com/6179VgH.png',
    },
    distortionTee: {
        main: 'https://i.imgur.com/VlTUzGd.jpeg',
        frontFlat: 'https://i.imgur.com/uwKceKV.jpg',
        backModel: 'https://i.imgur.com/1S7Hkyw.jpg',
        backFlat: 'https://i.imgur.com/u0qjWgl.jpg',
    },
    sharkTee: {
        main: 'https://i.imgur.com/evsuOt6.jpg',
        back: 'https://i.imgur.com/gaA93ug.jpg',
        frontFlat: 'https://i.imgur.com/cYmL6GQ.jpg',
        backFlat: 'https://i.imgur.com/IVmfRGx.jpg',
    },
    trueReligionJeans: {
        front1: 'https://i.imgur.com/2VU7MEr.jpg',
        front2: 'https://i.imgur.com/hJgvL2K.jpg',
        front3: 'https://i.imgur.com/EsvBcv4.jpg',
        front4: 'https://i.imgur.com/J9EmRZq.jpg',
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
    'https://i.imgur.com/kzIWQzA.jpg': PRODUCT_IMAGE_URLS.walletGreen.front,
    'https://i.imgur.com/hs4lZFg.jpg': PRODUCT_IMAGE_URLS.walletGreen.back,
    'https://i.imgur.com/rJSCmHu.jpg': PRODUCT_IMAGE_URLS.walletSkyyBlue.front,
    'https://i.imgur.com/1FwLI72.jpg': PRODUCT_IMAGE_URLS.walletSkyyBlue.back,
    'https://i.imgur.com/Z5K3JZ0.png': PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.front,
    'https://i.imgur.com/ySkgCOs.png': PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.back,
    'https://i.imgur.com/SS6KbOQ.jpeg': PRODUCT_IMAGE_URLS.chromeHeartsWallet.front,
    'https://i.imgur.com/NUXZizv.jpeg': PRODUCT_IMAGE_URLS.chromeHeartsWallet.back,
    'https://i.imgur.com/7z2h8u6.jpeg': PRODUCT_IMAGE_URLS.greyWaveWallet.front,
    'https://i.imgur.com/UqtbJCq.jpeg': PRODUCT_IMAGE_URLS.greyWaveWallet.back,
    'https://i.imgur.com/FVMHZoq.jpeg': PRODUCT_IMAGE_URLS.greyWaveWallet22.front,
    'https://i.imgur.com/FVMHZoq.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.front,
    'https://i.imgur.com/LLoGORu.jpeg': PRODUCT_IMAGE_URLS.greyWaveWallet22.back,
    'https://i.imgur.com/LLoGORu.jpg': PRODUCT_IMAGE_URLS.greyWaveWallet22.back,
    'https://i.imgur.com/iYBlwm8.png': PRODUCT_IMAGE_URLS.trustYourselfHat.cover,
    'https://i.imgur.com/jwnVHoI.png': PRODUCT_IMAGE_URLS.trustYourselfHat.detail,
    'https://i.imgur.com/YNiTSFA.png': PRODUCT_IMAGE_URLS.trustYourselfHat.side,
    'https://i.imgur.com/HqcoV24.png': PRODUCT_IMAGE_URLS.trustYourselfHat.back,
    'https://i.imgur.com/6179VgH.png': PRODUCT_IMAGE_URLS.trustYourselfHat.full,
    'https://i.imgur.com/8Q9Z5bX.png': PRODUCT_IMAGE_URLS.trustYourselfHat.cover,
    'https://i.imgur.com/VlTUzGd.jpeg': PRODUCT_IMAGE_URLS.distortionTee.main,
    'https://imgur.com/YAkjLAm': PRODUCT_IMAGE_URLS.distortionTee.main,
    'https://i.imgur.com/YAkjLAm.jpg': PRODUCT_IMAGE_URLS.distortionTee.main,
    'https://imgur.com/uwKceKV': PRODUCT_IMAGE_URLS.distortionTee.frontFlat,
    'https://i.imgur.com/uwKceKV.jpg': PRODUCT_IMAGE_URLS.distortionTee.frontFlat,
    'https://imgur.com/1S7Hkyw': PRODUCT_IMAGE_URLS.distortionTee.backModel,
    'https://i.imgur.com/1S7Hkyw.jpg': PRODUCT_IMAGE_URLS.distortionTee.backModel,
    'https://imgur.com/u0qjWgl': PRODUCT_IMAGE_URLS.distortionTee.backFlat,
    'https://i.imgur.com/u0qjWgl.jpg': PRODUCT_IMAGE_URLS.distortionTee.backFlat,
    'https://i.imgur.com/2VU7MEr.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front1,
    'https://i.imgur.com/hJgvL2K.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front2,
    'https://i.imgur.com/EsvBcv4.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front3,
    'https://i.imgur.com/J9EmRZq.jpg': PRODUCT_IMAGE_URLS.trueReligionJeans.front4,
};

export const resolveLocalImageUrl = (url?: string | null) => {
    if (!url) return '';
    // First try: convert old local path to canonical URL
    const localToRemote = LOCAL_TO_REMOTE_IMAGE_URLS[url];
    if (localToRemote) return localToRemote;
    // Second try: Imgur → canonical URL (identity mapping, retained for compatibility)
    return REMOTE_TO_LOCAL_IMAGE_URLS[url] || url;
};

export const resolveLocalImageUrls = (urls: Array<string | null | undefined> = []) =>
    urls.map(url => resolveLocalImageUrl(url)).filter(Boolean) as string[];

export const rewriteImageSrcs = (html: string = '') => {
    if (!html) return html;

    return Object.entries(REMOTE_TO_LOCAL_IMAGE_URLS).reduce(
        (acc, [remoteUrl, localUrl]) => acc.split(remoteUrl).join(localUrl),
        html
    );
};
