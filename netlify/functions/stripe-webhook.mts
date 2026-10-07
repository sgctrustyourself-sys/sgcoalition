// netlify/functions/stripe-webhook.mts
//
// Stripe webhook endpoint. Kept separate from the /api/* router because
// signature verification needs the exact raw request bytes, so the body is
// passed through unparsed.

import { runVercelHandler, type NetlifyContext } from '../lib/vercelCompat.ts';

export default async (req: Request, context: NetlifyContext) =>
    runVercelHandler(req, context, async () => (await import('../../api/stripe-webhook.ts')).default, {
        rawBody: true,
    });

export const config = {
    path: '/api/stripe-webhook',
};
