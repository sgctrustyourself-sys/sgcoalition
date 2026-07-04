import type { Order } from '../types';

export type LiveOrdersTimeRange = '24h' | '7d' | '30d';

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
    productUrl?: string;
}

export interface LiveOrdersSummary {
    totalOrders: number;
    activeStates: number;
    topState: LiveOrdersStateDatum | null;
    latestOrder: {
        id: string;
        productName: string;
        stateName: string;
        locationLabel: string;
        timeLabel: string;
        image: string;
        productUrl?: string;
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
    locationLabel: string;
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
};

const EXCLUDED_STATUSES = new Set(['cancelled', 'failed', 'refunded']);
const DEFAULT_IMAGE = '/images/logo.png';
const DEMO_FEED_ENABLED = import.meta.env.DEV;
const PUBLIC_RECENT_ORDER_SEEDS = [
    {
        id: 'public-pa-grey-wave-wallet-1-2',
        stateCode: 'PA',
        stateName: 'Pennsylvania',
        city: 'York',
        productId: 'Coalition_Grey_Wave_Wallet_1_2',
        productName: "Coalition 'Grey Wave' Wallet 1/2",
        productImage: 'https://i.imgur.com/7z2h8u6.jpeg',
        minutesAgo: 7 * 24 * 60,
        itemCount: 1,
    },
    {
        id: 'public-pa-grey-wave-wallet-2-2',
        stateCode: 'PA',
        stateName: 'Pennsylvania',
        city: 'York',
        productId: 'Coalition_Grey_Wave_Wallet_2_2',
        productName: "Coalition 'Grey Wave' Wallet 2/2",
        productImage: 'https://i.imgur.com/FVMHZoq.jpeg',
        minutesAgo: 12,
        itemCount: 1,
    },
] as const;

const DEMO_TRACKED_ORDER_SEEDS = [
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

function formatLocationLabel(city: string | null | undefined, stateCode: string, stateName: string) {
    const trimmedCity = typeof city === 'string' ? city.trim() : '';
    return trimmedCity ? `${trimmedCity}, ${stateCode}` : stateName;
}

function getProductUrl(productId?: string | null) {
    if (!productId) return undefined;
    return `/product/${encodeURIComponent(productId)}`;
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
    const locationLabel = formatLocationLabel(getShippingCity(order), stateCode, stateName);
    const firstItem = normalizedItems[0] || null;

    return {
        order: {
            ...order,
            items: normalizedItems,
        },
        timestamp,
        stateCode,
        stateName,
        locationLabel,
        firstItem,
        image: firstItem?.productImage || DEFAULT_IMAGE,
    };
}

function createSeedTrackedOrders(
    seeds: readonly {
        id: string;
        stateCode: string;
        stateName: string;
        city?: string;
        productId?: string;
        productName: string;
        productImage: string;
        minutesAgo: number;
        itemCount: number;
    }[],
    now: number,
): TrackedLiveOrder[] {
    return seeds.map((seed) => {
        const timestamp = now - seed.minutesAgo * 60 * 1000;
        const items = Array.from({ length: seed.itemCount }, (_, index) => ({
            productId: `${seed.id}-${index + 1}`,
            ...(index === 0 && seed.productId ? { productId: seed.productId } : {}),
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
                    city: seed.city,
                    state: seed.stateCode,
                },
                createdAt: new Date(timestamp).toISOString(),
            } as Order & { items: NormalizedLiveOrderItem[]; paymentStatus?: string },
            timestamp,
            stateCode: seed.stateCode,
            stateName: seed.stateName,
            locationLabel: formatLocationLabel(seed.city, seed.stateCode, seed.stateName),
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
    return `${days}d ago`;
}

export function buildLiveOrdersFeed(orders: Order[], timeRange: LiveOrdersTimeRange): LiveOrdersFeed {
    const now = Date.now();
    const windowStart = now - RANGE_MS[timeRange];

    const trackedOrders = orders
        .map((order) => {
            const trackedOrder = buildTrackedOrder(order, now);
            if (!trackedOrder) return null;
            if (trackedOrder.timestamp < windowStart) return null;
            return trackedOrder;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => b.timestamp - a.timestamp);

    const publicTrackedOrders = createSeedTrackedOrders(PUBLIC_RECENT_ORDER_SEEDS, now)
        .filter(entry => entry.timestamp >= windowStart);
    const trackedOrderIds = new Set(trackedOrders.map(entry => entry.order.id));
    const activeTrackedOrders = [
        ...trackedOrders,
        ...publicTrackedOrders.filter(entry => !trackedOrderIds.has(entry.order.id)),
    ].sort((a, b) => b.timestamp - a.timestamp);

    const displayTrackedOrders = activeTrackedOrders.length > 0
        ? activeTrackedOrders
        : (DEMO_FEED_ENABLED ? createSeedTrackedOrders(DEMO_TRACKED_ORDER_SEEDS, now) : activeTrackedOrders);

    const stateTotals = new Map<string, { count: number; latestTimestamp: number }>();

    for (const entry of displayTrackedOrders) {
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
    const latestTrackedOrder = displayTrackedOrders[0] || null;

    return {
        states,
        recentActivity: displayTrackedOrders.slice(0, 6).map((entry) => {
            const extraCount = Math.max((entry.order.items?.length || 0) - 1, 0);
            const productName = entry.firstItem?.productName || 'Order';
            const productLabel = extraCount > 0
                ? `${productName} + ${extraCount} more item${extraCount === 1 ? '' : 's'}`
                : productName;

            return {
                id: entry.order.id,
                text: `${productLabel} ordered in ${entry.locationLabel}`,
                time: formatRelativeTime(entry.timestamp, now),
                image: entry.image,
                productUrl: getProductUrl(entry.firstItem?.productId),
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
                    locationLabel: latestTrackedOrder.locationLabel,
                    timeLabel: formatRelativeTime(latestTrackedOrder.timestamp, now),
                    image: latestTrackedOrder.image,
                    productUrl: getProductUrl(latestTrackedOrder.firstItem?.productId),
                }
                : null,
        },
    };
}
