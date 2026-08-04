import type { Order } from '../types.js';
import { PRODUCT_IMAGE_URLS } from './localImageAssets.js';

export type LiveOrdersTimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

export interface LiveOrdersStateDatum {
    id: string;
    name: string;
    count: number;
    lastActive: string;
}

export interface LiveOrdersTickerItem {
    id: string;
    text: string;
    time: string;
    image: string;
    productLink?: string;
}

export interface LiveOrdersSummary {
    totalOrders: number;
    activeStates: number;
    topState: LiveOrdersStateDatum | null;
    latestOrder: {
        id: string;
        productName: string;
        stateName: string;
        timeLabel: string;
        image: string;
    } | null;
}

export interface LiveOrdersFeed {
    states: LiveOrdersStateDatum[];
    recentActivity: LiveOrdersTickerItem[];
    summary: LiveOrdersSummary;
}

interface NormalizedLiveOrderItem {
    productId: string;
    productName: string;
    productImage: string;
    selectedSize: string;
    quantity: number;
    price: number;
    total: number;
}

interface TrackedLiveOrder {
    order: Order & { items: NormalizedLiveOrderItem[]; paymentStatus?: string; status?: string };
    timestamp: number;
    stateCode: string;
    stateName: string;
    city: string | null;
    firstItem: NormalizedLiveOrderItem | null;
    image: string;
}

const STATE_PAIRS = [
    ['AL', 'Alabama'],
    ['AK', 'Alaska'],
    ['AZ', 'Arizona'],
    ['AR', 'Arkansas'],
    ['CA', 'California'],
    ['CO', 'Colorado'],
    ['CT', 'Connecticut'],
    ['DE', 'Delaware'],
    ['DC', 'District of Columbia'],
    ['FL', 'Florida'],
    ['GA', 'Georgia'],
    ['HI', 'Hawaii'],
    ['ID', 'Idaho'],
    ['IL', 'Illinois'],
    ['IN', 'Indiana'],
    ['IA', 'Iowa'],
    ['KS', 'Kansas'],
    ['KY', 'Kentucky'],
    ['LA', 'Louisiana'],
    ['ME', 'Maine'],
    ['MD', 'Maryland'],
    ['MA', 'Massachusetts'],
    ['MI', 'Michigan'],
    ['MN', 'Minnesota'],
    ['MS', 'Mississippi'],
    ['MO', 'Missouri'],
    ['MT', 'Montana'],
    ['NE', 'Nebraska'],
    ['NV', 'Nevada'],
    ['NH', 'New Hampshire'],
    ['NJ', 'New Jersey'],
    ['NM', 'New Mexico'],
    ['NY', 'New York'],
    ['NC', 'North Carolina'],
    ['ND', 'North Dakota'],
    ['OH', 'Ohio'],
    ['OK', 'Oklahoma'],
    ['OR', 'Oregon'],
    ['PA', 'Pennsylvania'],
    ['RI', 'Rhode Island'],
    ['SC', 'South Carolina'],
    ['SD', 'South Dakota'],
    ['TN', 'Tennessee'],
    ['TX', 'Texas'],
    ['UT', 'Utah'],
    ['VT', 'Vermont'],
    ['VA', 'Virginia'],
    ['WA', 'Washington'],
    ['WV', 'West Virginia'],
    ['WI', 'Wisconsin'],
    ['WY', 'Wyoming'],
] as const;

const STATE_CODE_TO_NAME = new Map(STATE_PAIRS);
const STATE_NAME_TO_CODE = new Map(
    STATE_PAIRS.map(([code, name]) => [normalizeKey(name), code] as const)
);

const RANGE_MS: Record<LiveOrdersTimeRange, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    'all': Infinity,
};

const EXCLUDED_STATUSES = new Set(['cancelled', 'failed', 'refunded']);
const DEFAULT_IMAGE = '/images/logo.png';
const DEMO_FEED_ENABLED = import.meta.env.DEV;
const DEMO_TRACKED_ORDER_SEEDS = [
    {
        id: 'demo-md-1',
        stateCode: 'MD',
        stateName: 'Maryland',
        productName: 'COALITION NF-TEE',
        productImage: '/images/coalition-nf-tee-lifestyle.jpg',
        minutesAgo: 12,
        itemCount: 1,
    },
    {
        id: 'demo-ny-1',
        stateCode: 'NY',
        stateName: 'New York',
        productName: 'COALITION DISTORTION TEE',
        productImage: '/images/tee-front.png',
        minutesAgo: 38,
        itemCount: 2,
    },
    {
        id: 'demo-ca-1',
        stateCode: 'CA',
        stateName: 'California',
        productName: 'COALITION GREEN CAMO WALLET',
        productImage: '/images/wallet-camo-front.jpg',
        minutesAgo: 127,
        itemCount: 1,
    },
    {
        id: 'demo-tx-1',
        stateCode: 'TX',
        stateName: 'Texas',
        productName: 'COALITION SKYY BLUE WALLET 1/2',
        productImage: '/images/wallet-camo-back.jpg',
        minutesAgo: 241,
        itemCount: 1,
    },
    {
        id: 'demo-fl-1',
        stateCode: 'FL',
        stateName: 'Florida',
        productName: 'TRUST YOURSELF CUSTOM TRUCKER',
        productImage: '/images/tee-back.png',
        minutesAgo: 389,
        itemCount: 3,
    },
    {
        id: 'demo-md-2',
        stateCode: 'MD',
        stateName: 'Maryland',
        productName: 'Coalition x True Religion 1/1 Jeans S1',
        productImage: '/images/coalition-nf-tee-front.png',
        minutesAgo: 782,
        itemCount: 1,
    },
] as const;

// ---------------------------------------------------------------------------
// Layer 2 — PUBLIC_RECENT_ORDER_SEEDS
// ---------------------------------------------------------------------------
//
// A small literal array of REAL offline sales (cash, wholesale, in-person)
// that should appear on the /live-orders map even when no matching Supabase
// order survives the Layer 1 filter (e.g. the Supabase row has no
// shipping_address so buildTrackedOrder drops it).
//
// DEDUP CONTRACT (see README > Recently Ordered Live Map):
//   Every entry here MUST have a sibling row in constants.ts > INITIAL_ORDERS
//   whose `id` is byte-for-byte identical. When a Layer 1 order (Supabase or
//   INITIAL_ORDERS fallback) with the same id survives the window filter,
//   the Layer 1 entry REPLACES this seed — the seed is dropped, not appended.
//   This prevents double-counting when the sale exists in both the seed list
//   and the live database.
//
// PRIVACY CONTRACT:
//   Seeds carry state-level data only (state + city). No address line, ZIP,
//   name, or order number. The matching INITIAL_ORDERS row carries safe
//   placeholders (customer@example.com, empty address1/zip). The full street
//   address lives in the gitignored shipping_internal.json.
//
// TIMESTAMP NOTE:
//   `minutesAgo` is a FLOATING offset from "now". It produces a stable
//   relative-time label ("55d ago") at build time but does NOT stay anchored
//   to the real sale date as days pass. The matching INITIAL_ORDERS.createdAt
//   is an anchored ISO timestamp (correct forever). When Layer 1 wins the
//   dedup, the anchored timestamp is used; when Layer 2 wins (Supabase row
//   has no shipping state), the floating offset is used. See FOLLOWUPS.md #7.
// ---------------------------------------------------------------------------

interface PublicRecentOrderSeed {
    id: string;
    stateCode: string;
    stateName: string;
    city: string;
    productId: string;
    productName: string;
    productImage: string;
    minutesAgo: number;
    itemCount: number;
}

const PUBLIC_RECENT_ORDER_SEEDS: readonly PublicRecentOrderSeed[] = [
    {
        // Coalition 'Grey Wave' Wallet 2/2 — sold in York, PA.
        // Surfaces in 24h, 7d, 30d, 90d, all.
        id: 'public-pa-grey-wave-wallet-2-2',
        stateCode: 'PA',
        stateName: 'Pennsylvania',
        city: 'York',
        productId: 'Coalition_Grey_Wave_Wallet_2_2',
        productName: "Coalition 'Grey Wave' Wallet 2/2",
        // Use the imgur URL directly (not the PRODUCT_IMAGE_URLS local
        // path) because the feed builder does NOT call resolveLocalImageUrl,
        // so a local /images/* path would be broken in production.
        productImage: 'https://i.imgur.com/FVMHZoq.jpg',
        minutesAgo: 12,
        itemCount: 1,
    },
    {
        // Coalition 'Grey Wave' Wallet 1/2 — sold in York, PA.
        // Surfaces in 7d, 30d, 90d (at the 7d boundary).
        id: 'public-pa-grey-wave-wallet-1-2',
        stateCode: 'PA',
        stateName: 'Pennsylvania',
        city: 'York',
        productId: 'Coalition_Grey_Wave_Wallet_1_2',
        productName: "Coalition 'Grey Wave' Wallet 1/2",
        productImage: 'https://i.imgur.com/7z2h8u6.jpg',
        minutesAgo: 10_080, // 7 days
        itemCount: 1,
    },
    {
        // 7-wallet wholesale bundle sold to @friiqy on 2026-05-22 in
        // Abingdon, MD. Split into 7 OrderItem rows in INITIAL_ORDERS
        // (GreenCamoWallet, SKYYBLUEWALLET1_2, prod_wallet_004,
        // Coalition_Racing_Team_Wallet_1_4 through 4/4) at $25 each = $175.
        // The ticker links to /product/GreenCamoWallet (first wallet in
        // catalog order); the other 6 surface via "+ 6 more items".
        // Surfaces in 90d, all.
        id: 'public-md-wholesale-wallets-2026_05_22',
        stateCode: 'MD',
        stateName: 'Maryland',
        city: 'Abingdon',
        productId: 'GreenCamoWallet',
        productName: 'COALITION GREEN CAMO WALLET',
        productImage: PRODUCT_IMAGE_URLS.walletGreen.front,
        minutesAgo: 58_284, // ~40 days
        itemCount: 7,
    },
    {
        // TRUST YOURSELF CUSTOM TRUCKER (1/1) — sold in Owings Mills, MD.
        // Surfaces in 90d, all.
        id: 'public-md-trust-yourself-hat-01',
        stateCode: 'MD',
        stateName: 'Maryland',
        city: 'Owings Mills',
        productId: 'prod_trust_yourself_hat_01',
        productName: 'TRUST YOURSELF CUSTOM TRUCKER (1/1)',
        productImage: PRODUCT_IMAGE_URLS.trustYourselfHat.cover,
        minutesAgo: 120_960, // 84 days
        itemCount: 1,
    },
    {
        // Coalition Denim Patchwork 1/1 Jeans S1 — sold via @friiqy
        // relationship in November 2024 in Abingdon, MD.
        // Surfaces in all only (601d).
        id: 'public-md-denim-patchwork-2024_11_08',
        stateCode: 'MD',
        stateName: 'Maryland',
        city: 'Abingdon',
        productId: 'Coalition_Denim_Patchwork_S1',
        productName: 'Coalition Denim Patchwork 1/1 Jeans S1',
        // Denim Patchwork images are in Supabase only (no local mirror).
        // Using trueReligionJeans as a temporary visual placeholder;
        // update to the real Supabase image URL when available.
        productImage: PRODUCT_IMAGE_URLS.trueReligionJeans.front1,
        minutesAgo: 865_440, // 601 days
        itemCount: 1,
    },
    {
        // Coalition x True Religion 1/1 Jeans S1 — sold in New York, NY.
        // Surfaces in all only (121w).
        id: 'public-ny-true-religion-s1',
        stateCode: 'NY',
        stateName: 'New York',
        city: 'New York',
        productId: 'Coalition_x_True_Religion_S1',
        productName: 'Coalition x True Religion 1/1 Jeans S1',
        productImage: PRODUCT_IMAGE_URLS.trueReligionJeans.front1,
        minutesAgo: 1_219_680, // 121 weeks
        itemCount: 1,
    },
] as const;

function normalizeKey(value: string) {
    return value.trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
}

function getStateCode(value?: string | null) {
    if (!value) return null;

    const normalized = normalizeKey(value);
    const upper = normalized.toUpperCase();

    if (STATE_CODE_TO_NAME.has(upper as (typeof STATE_PAIRS)[number][0])) {
        return upper as (typeof STATE_PAIRS)[number][0];
    }

    return STATE_NAME_TO_CODE.get(normalized) ?? null;
}

function getShippingState(order: any) {
    return (
        order?.shippingAddress?.state ||
        order?.shippingInfo?.state ||
        order?.shipping_info?.state ||
        order?.shipping_state ||
        order?.shippingState ||
        order?.state ||
        null
    );
}

function getShippingCity(order: any) {
    return (
        order?.shippingAddress?.city ||
        order?.shippingInfo?.city ||
        order?.shipping_info?.city ||
        order?.shipping_city ||
        order?.shippingCity ||
        order?.city ||
        null
    );
}

function normalizeOrderItems(order: any): NormalizedLiveOrderItem[] {
    const rawItems = Array.isArray(order?.items) ? order.items : Array.isArray(order?.lineItems) ? order.lineItems : [];

    return rawItems.map((item: any, index: number) => {
        const quantity = Math.max(1, Number(item?.quantity || item?.qty || 1));
        const price = Number(item?.price || item?.unitPrice || item?.unit_price || 0);
        const total = Number(item?.total || item?.lineTotal || item?.line_total || price * quantity || 0);

        return {
            productId: item?.productId || item?.product_id || item?.id || `item_${index}`,
            productName: item?.productName || item?.name || item?.title || 'Order item',
            productImage: item?.productImage || item?.image || item?.thumbnail || item?.product?.image || DEFAULT_IMAGE,
            selectedSize: item?.selectedSize || item?.size || 'One Size',
            quantity,
            price,
            total,
        };
    });
}

function buildTrackedOrder(order: any, now: number): TrackedLiveOrder | null {
    const timestamp = Date.parse(order?.createdAt || order?.created_at || '');
    if (!Number.isFinite(timestamp)) return null;

    const status = String(order?.paymentStatus || order?.status || order?.orderStatus || '').toLowerCase();
    if (EXCLUDED_STATUSES.has(status)) return null;

    const stateCode = getStateCode(getShippingState(order));
    if (!stateCode) return null;

    const normalizedItems = normalizeOrderItems(order);
    const stateName = STATE_CODE_TO_NAME.get(stateCode) ?? stateCode;
    const firstItem = normalizedItems[0] || null;

    return {
        order: {
            ...order,
            items: normalizedItems,
        },
        timestamp,
        stateCode,
        stateName,
        city: getShippingCity(order),
        firstItem,
        image: firstItem?.productImage || DEFAULT_IMAGE,
    };
}

function createDemoTrackedOrders(now: number): TrackedLiveOrder[] {
    return DEMO_TRACKED_ORDER_SEEDS.map((seed) => {
        const timestamp = now - seed.minutesAgo * 60 * 1000;
        const items = Array.from({ length: seed.itemCount }, (_, index) => ({
            productId: `${seed.id}-${index + 1}`,
            productName: index === 0 ? seed.productName : `${seed.productName} ${index + 1}`,
            productImage: seed.productImage,
            selectedSize: 'One Size',
            quantity: 1,
            price: 0,
            total: 0,
        }));

        return {
            order: {
                id: seed.id,
                items,
                paymentStatus: 'paid',
                shippingAddress: {
                    state: seed.stateCode,
                },
                createdAt: new Date(timestamp).toISOString(),
            } as Order & { items: NormalizedLiveOrderItem[]; paymentStatus?: string },
            timestamp,
            stateCode: seed.stateCode,
            stateName: seed.stateName,
            city: null as string | null,
            firstItem: items[0] || null,
            image: items[0]?.productImage || DEFAULT_IMAGE,
        };
    });
}

function createSeedTrackedOrders(now: number): TrackedLiveOrder[] {
    return PUBLIC_RECENT_ORDER_SEEDS.map((seed) => {
        const timestamp = now - seed.minutesAgo * 60 * 1000;
        const items = Array.from({ length: seed.itemCount }, (_, index) => ({
            productId: index === 0 ? seed.productId : `${seed.productId}-${index + 1}`,
            productName: index === 0 ? seed.productName : `${seed.productName} ${index + 1}`,
            productImage: seed.productImage,
            selectedSize: 'One Size',
            quantity: 1,
            price: 0,
            total: 0,
        }));

        return {
            order: {
                id: seed.id,
                items,
                paymentStatus: 'paid',
                shippingAddress: {
                    state: seed.stateCode,
                    city: seed.city,
                },
                createdAt: new Date(timestamp).toISOString(),
            } as Order & { items: NormalizedLiveOrderItem[]; paymentStatus?: string },
            timestamp,
            stateCode: seed.stateCode,
            stateName: seed.stateName,
            city: seed.city,
            firstItem: items[0] || null,
            image: items[0]?.productImage || DEFAULT_IMAGE,
        };
    });
}

function formatRelativeTime(timestamp: number, now: number) {
    const diff = Math.max(0, now - timestamp);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (days < 30) return `${weeks}w ago`;

    const months = Math.floor(days / 30);
    if (days < 365) return `${months}mo ago`;

    const years = Math.floor(days / 365);
    return `${years}y ago`;
}

// formatLocationLabel — renders "City, State" when a city is available,
// or just "State" when the city is missing or unverified. The matcher
// reads entry.city plus the legacy shipping-field aliases
// getShippingCity walks, so older row shapes still surface correctly.
// Never fill in a city you cannot verify — the state-only rendering is
// the honest fallback.
function formatLocationLabel(city: string | null, stateName: string): string {
    return city ? `${city}, ${stateName}` : stateName;
}

export function buildLiveOrdersFeed(orders: Order[], timeRange: LiveOrdersTimeRange): LiveOrdersFeed {
    const now = Date.now();
    const windowStart = now - RANGE_MS[timeRange];

    // Layer 1 — real orders (Supabase or INITIAL_ORDERS fallback).
    // Each order must have a valid createdAt, a non-excluded status, and a
    // resolvable US state code to survive this filter.
    const layer1Tracked = orders
        .map((order) => {
            const trackedOrder = buildTrackedOrder(order, now);
            if (!trackedOrder) return null;
            if (trackedOrder.timestamp < windowStart) return null;
            return trackedOrder;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    // Layer 2 — public seed orders (real offline sales). Deduped against
    // Layer 1 by order.id: a Layer 1 entry with the same id REPLACES the
    // seed (the seed is dropped, not appended). This prevents double-
    // counting when the sale exists in both the seed list and the live
    // database / INITIAL_ORDERS fallback.
    const layer1Ids = new Set(layer1Tracked.map((entry) => entry.order.id));
    const layer2Tracked = createSeedTrackedOrders(now).filter((entry) => {
        if (layer1Ids.has(entry.order.id)) return false;
        if (entry.timestamp < windowStart) return false;
        return true;
    });

    // Combined live tracked orders, sorted newest-first.
    const combinedTracked = [...layer1Tracked, ...layer2Tracked].sort(
        (a, b) => b.timestamp - a.timestamp,
    );

    // Layer 3 — DEV-only demo fallback. Only fires when no live orders
    // (Layer 1 + Layer 2) survive the window filter AND the app is running
    // in dev mode. Production builds bake DEMO_FEED_ENABLED to false.
    const activeTrackedOrders = combinedTracked.length > 0
        ? combinedTracked
        : (DEMO_FEED_ENABLED ? createDemoTrackedOrders(now) : combinedTracked);

    const stateTotals = new Map<string, { count: number; latestTimestamp: number }>();

    for (const entry of activeTrackedOrders) {
        const current = stateTotals.get(entry.stateCode) || {
            count: 0,
            latestTimestamp: entry.timestamp,
        };

        current.count += 1;
        current.latestTimestamp = Math.max(current.latestTimestamp, entry.timestamp);
        stateTotals.set(entry.stateCode, current);
    }

    const states = Array.from(stateTotals.entries())
        .map(([stateCode, details]) => ({
            id: stateCode,
            name: STATE_CODE_TO_NAME.get(stateCode as (typeof STATE_PAIRS)[number][0]) ?? stateCode,
            count: details.count,
            lastActive: formatRelativeTime(details.latestTimestamp, now),
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const topState = states[0] || null;
    const latestTrackedOrder = activeTrackedOrders[0] || null;

    return {
        states,
        recentActivity: activeTrackedOrders.slice(0, 6).map((entry) => {
            const extraCount = Math.max((entry.order.items?.length || 0) - 1, 0);
            const productName = entry.firstItem?.productName || 'Order';
            const productLabel = extraCount > 0
                ? `${productName} + ${extraCount} more item${extraCount === 1 ? '' : 's'}`
                : productName;
            const locationLabel = formatLocationLabel(entry.city, entry.stateName);

            return {
                id: entry.order.id,
                text: `${productLabel} ordered in ${locationLabel}`,
                time: formatRelativeTime(entry.timestamp, now),
                image: entry.image,
                productLink: entry.firstItem?.productId
                    ? `/product/${entry.firstItem.productId}`
                    : undefined,
            };
        }),
        summary: {
            totalOrders: activeTrackedOrders.length,
            activeStates: states.length,
            topState,
            latestOrder: latestTrackedOrder
                ? {
                    id: latestTrackedOrder.order.id,
                    productName: latestTrackedOrder.firstItem?.productName || 'Order',
                    stateName: latestTrackedOrder.stateName,
                    timeLabel: formatRelativeTime(latestTrackedOrder.timestamp, now),
                    image: latestTrackedOrder.image,
                }
                : null,
        },
    };
}
