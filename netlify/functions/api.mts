// netlify/functions/api.mts
//
// Serves every /api/<route> endpoint through the catch-all router in
// api/[...slug].ts, which lazy-loads the matching api/_handlers/* module.
// The two webhooks have their own functions (see stripe-webhook.mts and
// shippo-webhook.mts) and are excluded here.

import { runVercelHandler, type NetlifyContext } from '../lib/vercelCompat.ts';

export default async (req: Request, context: NetlifyContext) => {
    const segments = new URL(req.url).pathname
        .replace(/^\/api\/?/, '')
        .replace(/\/$/, '')
        .split('/')
        .filter(Boolean);

    return runVercelHandler(req, context, async () => (await import('../../api/[...slug].ts')).default, {
        extraQuery: { slug: segments },
    });
};

export const config = {
    path: '/api/*',
    excludedPath: ['/api/stripe-webhook', '/api/shippo-webhook'],
};
