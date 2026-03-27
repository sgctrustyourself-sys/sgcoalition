export const LOCAL_IMAGE_URLS = {
    nfTee: {
        model1: '/images/products/nf-tee/model-1.jpg',
        model2: '/images/products/nf-tee/model-2.jpg',
        model3: '/images/products/nf-tee/model-3.jpg',
        model4: '/images/products/nf-tee/model-4.jpg',
    },
    walletGreen: {
        front: '/images/products/wallet-green/front.jpg',
        back: '/images/products/wallet-green/back.jpg',
    },
    walletSkyyBlue: {
        front: '/images/products/wallet-skyy-blue/front.jpg',
        back: '/images/products/wallet-skyy-blue/back.jpg',
    },
    walletSkyyBlueArchive: {
        front: '/images/products/wallet-skyy-blue-archive/front.png',
        back: '/images/products/wallet-skyy-blue-archive/back.png',
    },
    chromeHeartsWallet: {
        front: '/images/products/chrome-hearts-wallet/front.jpeg',
        back: '/images/products/chrome-hearts-wallet/back.jpeg',
    },
    trustYourselfHat: {
        cover: '/images/products/trust-yourself-hat/front.png',
        detail: '/images/products/trust-yourself-hat/detail-closeup.png',
        side: '/images/products/trust-yourself-hat/side-profile.png',
        back: '/images/products/trust-yourself-hat/back-detail.png',
        full: '/images/products/trust-yourself-hat/full-display.png',
    },
    distortionTee: {
        main: '/images/products/distortion-tee/main.jpeg',
        frontFlat: '/images/products/distortion-tee/front-flat.jpg',
        backModel: '/images/products/distortion-tee/back-model.jpg',
        backFlat: '/images/products/distortion-tee/back-flat.jpg',
    },
    trueReligionJeans: {
        front1: '/images/products/true-religion-s1/front-1.jpg',
        front2: '/images/products/true-religion-s1/front-2.jpg',
        front3: '/images/products/true-religion-s1/front-3.jpg',
        front4: '/images/products/true-religion-s1/front-4.jpg',
    },
} as const;

const REMOTE_TO_LOCAL_IMAGE_URLS: Record<string, string> = {
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429266435_jht8v.jpg': LOCAL_IMAGE_URLS.nfTee.model1,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429279310_rd1ac.jpg': LOCAL_IMAGE_URLS.nfTee.model2,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429293246_pypxs.jpg': LOCAL_IMAGE_URLS.nfTee.model3,
    'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/coalition-nf-tee_1771429303205_8do7t.jpg': LOCAL_IMAGE_URLS.nfTee.model4,
    'https://i.imgur.com/kzIWQzA.jpg': LOCAL_IMAGE_URLS.walletGreen.front,
    'https://i.imgur.com/hs4lZFg.jpg': LOCAL_IMAGE_URLS.walletGreen.back,
    'https://i.imgur.com/rJSCmHu.jpg': LOCAL_IMAGE_URLS.walletSkyyBlue.front,
    'https://i.imgur.com/1FwLI72.jpg': LOCAL_IMAGE_URLS.walletSkyyBlue.back,
    'https://i.imgur.com/Z5K3JZ0.png': LOCAL_IMAGE_URLS.walletSkyyBlueArchive.front,
    'https://i.imgur.com/ySkgCOs.png': LOCAL_IMAGE_URLS.walletSkyyBlueArchive.back,
    'https://i.imgur.com/SS6KbOQ.jpeg': LOCAL_IMAGE_URLS.chromeHeartsWallet.front,
    'https://i.imgur.com/NUXZizv.jpeg': LOCAL_IMAGE_URLS.chromeHeartsWallet.back,
    'https://i.imgur.com/iYBlwm8.png': LOCAL_IMAGE_URLS.trustYourselfHat.cover,
    'https://i.imgur.com/jwnVHoI.png': LOCAL_IMAGE_URLS.trustYourselfHat.detail,
    'https://i.imgur.com/YNiTSFA.png': LOCAL_IMAGE_URLS.trustYourselfHat.side,
    'https://i.imgur.com/HqcoV24.png': LOCAL_IMAGE_URLS.trustYourselfHat.back,
    'https://i.imgur.com/6179VgH.png': LOCAL_IMAGE_URLS.trustYourselfHat.full,
    'https://i.imgur.com/8Q9Z5bX.png': LOCAL_IMAGE_URLS.trustYourselfHat.cover,
    'https://i.imgur.com/VlTUzGd.jpeg': LOCAL_IMAGE_URLS.distortionTee.main,
    'https://imgur.com/YAkjLAm': LOCAL_IMAGE_URLS.distortionTee.main,
    'https://i.imgur.com/YAkjLAm.jpg': LOCAL_IMAGE_URLS.distortionTee.main,
    'https://imgur.com/uwKceKV': LOCAL_IMAGE_URLS.distortionTee.frontFlat,
    'https://i.imgur.com/uwKceKV.jpg': LOCAL_IMAGE_URLS.distortionTee.frontFlat,
    'https://imgur.com/1S7Hkyw': LOCAL_IMAGE_URLS.distortionTee.backModel,
    'https://i.imgur.com/1S7Hkyw.jpg': LOCAL_IMAGE_URLS.distortionTee.backModel,
    'https://imgur.com/u0qjWgl': LOCAL_IMAGE_URLS.distortionTee.backFlat,
    'https://i.imgur.com/u0qjWgl.jpg': LOCAL_IMAGE_URLS.distortionTee.backFlat,
    'https://i.imgur.com/2VU7MEr.jpg': LOCAL_IMAGE_URLS.trueReligionJeans.front1,
    'https://i.imgur.com/hJgvL2K.jpg': LOCAL_IMAGE_URLS.trueReligionJeans.front2,
    'https://i.imgur.com/EsvBcv4.jpg': LOCAL_IMAGE_URLS.trueReligionJeans.front3,
    'https://i.imgur.com/J9EmRZq.jpg': LOCAL_IMAGE_URLS.trueReligionJeans.front4,
};

export const resolveLocalImageUrl = (url?: string | null) => {
    if (!url) return '';
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
