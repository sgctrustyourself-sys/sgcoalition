import { LOCAL_IMAGE_URLS } from '../utils/localImageAssets';

export const mockLiveOrders = [
    { id: 'CA', name: 'California', count: 18, lastActive: '2m ago' },
    { id: 'TX', name: 'Texas', count: 14, lastActive: '12m ago' },
    { id: 'NY', name: 'New York', count: 12, lastActive: '45m ago' },
    { id: 'FL', name: 'Florida', count: 9, lastActive: '1h ago' },
    { id: 'WA', name: 'Washington', count: 7, lastActive: '3h ago' },
    { id: 'IL', name: 'Illinois', count: 6, lastActive: '5h ago' },
    { id: 'CO', name: 'Colorado', count: 5, lastActive: '1d ago' },
    { id: 'GA', name: 'Georgia', count: 4, lastActive: '6h ago' },
    { id: 'NC', name: 'North Carolina', count: 4, lastActive: '2h ago' },
    { id: 'OH', name: 'Ohio', count: 3, lastActive: '1d ago' },
    { id: 'MI', name: 'Michigan', count: 3, lastActive: '4h ago' },
    { id: 'PA', name: 'Pennsylvania', count: 3, lastActive: '8h ago' },
];

export const mockRecentTicker = [
    { text: "Hoodie purchased in Los Angeles, CA", time: "2m ago", image: LOCAL_IMAGE_URLS.distortionTee.main },
    { text: "3D Print Service ordered in Austin, TX", time: "12m ago", image: LOCAL_IMAGE_URLS.walletGreen.front },
    { text: "Vintage Tee purchased in Brooklyn, NY", time: "45m ago", image: LOCAL_IMAGE_URLS.nfTee.model1 },
    { text: "Cargo Pants purchased in Miami, FL", time: "1h ago", image: LOCAL_IMAGE_URLS.trueReligionJeans.front1 },
    { text: "Full Stack Wizard Kit ordered in Seattle, WA", time: "3h ago", image: LOCAL_IMAGE_URLS.trustYourselfHat.cover },
    { text: "Custom Inquiry from Chicago, IL", time: "5h ago", image: LOCAL_IMAGE_URLS.chromeHeartsWallet.front },
];
