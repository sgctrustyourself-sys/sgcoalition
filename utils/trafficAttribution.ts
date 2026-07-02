export interface TrafficAttribution {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    gclid?: string;
    fbclid?: string;
    ttclid?: string;
    ref?: string;
    landingPath?: string;
    landingSearch?: string;
    referrer?: string;
    capturedAt?: string;
}

const STORAGE_KEY = 'coalition_traffic_attribution_v1';

const PARAM_TO_FIELD: Record<string, keyof TrafficAttribution> = {
    utm_source: 'utmSource',
    utm_medium: 'utmMedium',
    utm_campaign: 'utmCampaign',
    utm_term: 'utmTerm',
    utm_content: 'utmContent',
    gclid: 'gclid',
    fbclid: 'fbclid',
    ttclid: 'ttclid',
    ref: 'ref',
};

const canUseBrowserStorage = () =>
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeRead = (): TrafficAttribution => {
    if (!canUseBrowserStorage()) return {};

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as TrafficAttribution;
    } catch {
        return {};
    }
};

const safeWrite = (value: TrafficAttribution) => {
    if (!canUseBrowserStorage()) return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
        // Attribution is useful, not critical. Ignore storage failures.
    }
};

export const captureTrafficAttribution = (pathname: string, search: string) => {
    if (!canUseBrowserStorage()) return;

    const params = new URLSearchParams(search);
    const next: TrafficAttribution = {};

    for (const [param, field] of Object.entries(PARAM_TO_FIELD)) {
        const value = params.get(param);
        if (value) next[field] = value.slice(0, 240);
    }

    const existing = safeRead();
    const hasCampaignSignal = Object.keys(next).length > 0;
    const hasExistingLanding = Boolean(existing.landingPath);

    if (!hasCampaignSignal && hasExistingLanding) return;

    safeWrite({
        ...existing,
        ...next,
        landingPath: existing.landingPath || pathname,
        landingSearch: existing.landingSearch || search,
        referrer: existing.referrer || (typeof document !== 'undefined' ? document.referrer : ''),
        capturedAt: existing.capturedAt || new Date().toISOString(),
    });
};

export const getTrafficAttributionPayload = (): TrafficAttribution => {
    const attribution = safeRead();
    return Object.fromEntries(
        Object.entries(attribution).filter(([, value]) => typeof value === 'string' && value.length > 0)
    ) as TrafficAttribution;
};
