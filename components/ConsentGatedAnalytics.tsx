import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { useCookieConsent } from '../hooks/useCookieConsent';

/**
 * Vercel Analytics and Speed Insights are non-essential measurement.
 *
 * They are only mounted after the visitor opts into the analytics category.
 * Unmounting them on withdrawal stops new beacons for the rest of the visit;
 * no analytics script is injected before consent.
 */
const ConsentGatedAnalytics: React.FC = () => {
    const { statistics } = useCookieConsent();

    if (!statistics) return null;

    return (
        <>
            <SpeedInsights />
            <Analytics />
        </>
    );
};

export default ConsentGatedAnalytics;
