// netlify/functions/shippo-webhook.mts
//
// Shippo tracking-update webhook endpoint (token-gated in the handler).

import { runVercelHandler, type NetlifyContext } from '../lib/vercelCompat.ts';

export default async (req: Request, context: NetlifyContext) =>
    runVercelHandler(req, context, async () => (await import('../../api/shippo-webhook.ts')).default);

export const config = {
    path: '/api/shippo-webhook',
};
