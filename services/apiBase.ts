const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();

export const API_BASE_URL = rawApiBase.replace(/\/$/, '');

export function buildApiUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}

export function buildGitOperationsUrl(
    action: string,
    params: Record<string, string | number | boolean | undefined> = {}
) {
    const searchParams = new URLSearchParams({ action });

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        searchParams.set(key, String(value));
    });

    return `${buildApiUrl('/api/git-operations')}?${searchParams.toString()}`;
}
