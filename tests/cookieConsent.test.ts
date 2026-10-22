// tests/cookieConsent.test.ts
//
// Pins the consent contract that keeps the site lawful:
//
//   - optional categories default to OFF, even before the banner answers
//   - "reject" is as easy as "accept" and leaves optional storage off
//   - the record is versioned and expires, so stale choices are not reused
//   - withdrawing (rejecting again) is possible from anywhere via the event
//   - analytics only mounts after an explicit opt-in
//   - no pre-consent third-party font or IP lookup ships in the entry HTML
//
// These are source + behaviour checks; they do not require a browser.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    CONSENT_CHANGED_EVENT,
    CONSENT_LIFETIME_DAYS,
    CONSENT_STORAGE_KEY,
    CONSENT_VERSION,
    OPEN_CONSENT_EVENT,
    acceptAllConsent,
    getConsentRecord,
    getCookieConsent,
    hasConsented,
    onConsentChanged,
    rejectNonEssentialConsent,
    resetConsent,
    saveConsent,
    showConsentDialog,
} from '../services/cookieConsent';
import { captureConsent } from '../services/consentTracking';

const read = (relative: string) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

beforeEach(() => {
    resetConsent();
    window.localStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('consent defaults', () => {
    it('denies optional categories before the visitor answers', () => {
        const state = getConsentRecord();

        expect(state.necessary).toBe(true);
        expect(state.statistics).toBe(false);
        expect(state.marketing).toBe(false);
        expect(state.hasResponded).toBe(false);
        expect(getCookieConsent()).toBeNull();
    });

    it('always allows strictly necessary storage', () => {
        expect(hasConsented('necessary')).toBe(true);
        expect(hasConsented('statistics')).toBe(false);
        expect(hasConsented('marketing')).toBe(false);
    });
});

describe('saving a choice', () => {
    it('records accept-all with a timestamp and version', () => {
        const record = acceptAllConsent();

        expect(record.statistics).toBe(true);
        expect(record.marketing).toBe(true);
        expect(record.hasResponded).toBe(true);
        expect(record.timestamp).toEqual(expect.any(String));
        expect(record.version).toBe(CONSENT_VERSION);

        const stored = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY) || '{}');
        expect(stored.statistics).toBe(true);
        expect(stored.marketing).toBe(true);
        expect(hasConsented('statistics')).toBe(true);
    });

    it('reject keeps every optional category off', () => {
        acceptAllConsent();
        rejectNonEssentialConsent();

        const record = getConsentRecord();
        expect(record.hasResponded).toBe(true);
        expect(record.statistics).toBe(false);
        expect(record.marketing).toBe(false);
        expect(hasConsented('statistics')).toBe(false);
    });

    it('supports granular choices', () => {
        saveConsent({ statistics: true, marketing: false });

        expect(hasConsented('statistics')).toBe(true);
        expect(hasConsented('marketing')).toBe(false);
    });

    it('notifies subscribers and supports unsubscribe', () => {
        const listener = vi.fn();
        const unsubscribe = onConsentChanged(listener);

        acceptAllConsent();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].statistics).toBe(true);

        unsubscribe();
        rejectNonEssentialConsent();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('opens the preferences panel through the shared event', () => {
        const listener = vi.fn();
        window.addEventListener(OPEN_CONSENT_EVENT, listener);

        showConsentDialog();

        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(OPEN_CONSENT_EVENT, listener);
    });
});

describe('record hygiene', () => {
    it('ignores and clears a record from an older consent version', () => {
        window.localStorage.setItem(
            CONSENT_STORAGE_KEY,
            JSON.stringify({
                necessary: true,
                statistics: true,
                marketing: true,
                hasResponded: true,
                timestamp: new Date().toISOString(),
                version: CONSENT_VERSION + 1,
            })
        );

        const record = getConsentRecord();
        expect(record.hasResponded).toBe(false);
        expect(record.statistics).toBe(false);
        expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
    });

    it('re-asks after the consent lifetime', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        acceptAllConsent();

        vi.setSystemTime(new Date(Date.now() + (CONSENT_LIFETIME_DAYS + 1) * 24 * 60 * 60 * 1000));

        const record = getConsentRecord();
        expect(record.hasResponded).toBe(false);
        expect(record.statistics).toBe(false);
    });

    it('treats malformed storage as no choice', () => {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, '{not-json');

        expect(getConsentRecord().hasResponded).toBe(false);
        expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
    });

    it('notifies on reset so open views close', () => {
        acceptAllConsent();
        const listener = vi.fn();
        window.addEventListener(CONSENT_CHANGED_EVENT, listener);

        resetConsent();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(getConsentRecord().hasResponded).toBe(false);
    });
});

describe('no pre-consent third parties', () => {
    it('does not call ipify when capturing checkout consent', async () => {
        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;

        const consent = await captureConsent('user-1');

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(consent.consentIp).toBe('unknown');
    });

    it('serves brand fonts from our own origin', () => {
        const html = read('index.html');
        expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
        expect(html).toContain('/fonts/fonts.css');
    });

    it('does not embed a Cookiebot loader or CSP allowance', () => {
        const html = read('index.html');
        const vercel = read('vercel.json');
        expect(html).not.toMatch(/cookiebot/i);
        expect(vercel).not.toMatch(/cookiebot/i);
    });

    it('loads analytics only through the consent gate', () => {
        const app = read('App.tsx');
        expect(app).toContain('<ConsentGatedAnalytics />');
        expect(app).not.toMatch(/<SpeedInsights\s*\/>|<Analytics\s*\/>/);
    });

    it('has a working settings entry point in the footer', () => {
        const footer = read('components/Footer.tsx');
        expect(footer).toContain('showConsentDialog');
        expect(footer).not.toMatch(/window\.Cookiebot/);
    });
});

describe('policy copy', () => {
    it('does not claim browsing equals consent', () => {
        const policy = read('pages/Privacy.tsx');
        expect(policy).not.toMatch(/by continuing to browse/i);
        expect(policy).toMatch(/Reject non-essential/i);
        expect(policy).toMatch(/six months/i);
    });

    it('does not duplicate the consent-state bullet', () => {
        const policy = read('pages/Privacy.tsx');
        const occurrences = policy.match(/Remembers your cookie choices/g) ?? [];
        expect(occurrences.length).toBeLessThanOrEqual(1);
    });
});
