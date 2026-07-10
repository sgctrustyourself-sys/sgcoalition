// Lazy-load handlers via dynamic import so each route's heavy client init
// (Stripe / Resend / Supabase / Google AI / gitService) only runs when that
// route is actually hit. Vercel's bundler still tree-shakes into a single
// Lambda; cold start defers per-library init to the first matching request,
// keeping the initial Lambda well under Hobby's 50MB function-size cap.
//
// Request/response are typed `any` to match the existing 13 handlers'
// (req: any, res: any) signature and avoid pulling in @vercel/node as a
// hard dependency; Vercel provides the runtime types automatically.

type Handler = (req: any, res: any) => unknown | Promise<unknown>;
type Loader = () => Promise<{ default: Handler }>;

const handlers: Record<string, Loader> = {
    'ai-chat': () => import('./_handlers/ai-chat.js'),
    'complete-order': () => import('./_handlers/complete-order.js'),
    'create-checkout-session': () => import('./_handlers/create-checkout-session.js'),
    'create-payment-intent': () => import('./_handlers/create-payment-intent.js'),
    'create-subscription-session': () => import('./_handlers/create-subscription-session.js'),
    'git-operations': () => import('./_handlers/git-operations.js'),
    'paypal-order': () => import('./_handlers/paypal-order.js'),
    'place-order-credits': () => import('./_handlers/place-order-credits.js'),
    'send-email': () => import('./_handlers/send-email.js'),
    'send-order-confirmation': () => import('./_handlers/send-order-confirmation.js'),
    'stripe-checkout': () => import('./_handlers/stripe-checkout.js'),
    'stripe-webhook': () => import('./_handlers/stripe-webhook.js'),
    'subscribe-drop': () => import('./_handlers/subscribe-drop.js'),
    'unsubscribe': () => import('./_handlers/unsubscribe.js'),
    'verify-subscription': () => import('./_handlers/verify-subscription.js'),
};

export default async function handler(req: any, res: any) {
    // Vercel's catch-all `[...slug]` populates `req.query.slug` as an array
    // of path segments (e.g. /api/send-email -> ['send-email']). For nested
    // probes (e.g. /api/send-email/health), return 404 explicitly because
    // none of our handlers define nested routes -- forwarding the full URL
    // would surface a confusing 4xx from inside the handler.
    const rawSlug = req.query.slug;
    let slug: string | undefined;

    if (typeof rawSlug === 'string') {
        slug = rawSlug;
    } else if (Array.isArray(rawSlug)) {
        if (rawSlug.length === 1) {
            slug = rawSlug[0];
        } else if (rawSlug.length > 1) {
            res.status(404).json({ error: 'Endpoint not found' });
            return;
        }
    }

    if (!slug) {
        // Fallback for edge cases where req.query.slug isn't populated cleanly.
        const urlPath = (req.url ?? '').split('?')[0];
        const fallback = urlPath.replace(/^\/api\//, '').replace(/\/$/, '');
        if (!fallback) {
            res.status(404).json({ error: 'Endpoint not found' });
            return;
        }
        slug = fallback;
    }

    const loader = handlers[slug];
    if (!loader) {
        // Avoid leaking the path name in the response -- only log it server-side.
        console.info('[api] unknown endpoint:', slug);
        res.status(404).json({ error: 'Endpoint not found' });
        return;
    }

    const mod = await loader();
    return mod.default(req, res);
}
