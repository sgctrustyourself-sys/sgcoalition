// utils/storage.ts
// Shared localStorage helpers used across domain hooks and AppContext.

/**
 * Safely reads and parses a JSON value from localStorage.
 * Returns `defaultValue` if the key is missing or the stored value
 * cannot be parsed.
 */
export const safeJsonParse = (key: string, defaultValue: any) => {
    try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : defaultValue; }
    catch (e) { return defaultValue; }
};
