// Per-handler import isolation shim.
//
// Why this file uses per-slug static-path dynamic imports (not static
// `import X from './_handlers/<slug>'` at module top):
//
// 1. Vercel bundles this catch-all as a single Lambda. A static import
//    of any handler whose module-link throws (e.g. an import-side-effecting
//    package that fails when an env var is missing, or a transitive dep
//    that crashes on first evaluation) takes down the WHOLE Lambda at
//    boot. Every /api/* route then returns Vercel's opaque
//    `FUNCTION_INVOCATION_FAILED` until the bad import is patched.
// 2. Dynamic imports are evaluated on first request, not at module-link
//    time. A bad import degrades just the affected route to a 503.
// 3. The import paths below are STATIC strings (not template literals),
//    so Vercel's @vercel/nft bundler traces + inlines every handler
//    module into the same Lambda bundle. The dynamic import happens at
//    runtime but the target is already in the bundle -- the bundler
//    rewrites the import to a fast in-bundle require. The earlier
//    "Cannot find module" failure was specifically because the previous
//    implementation used a TEMPLATE LITERAL (`./_handlers/${slug}`);
//    static paths have always been traceable.
//
// Net effect: the catch-all boots cleanly even if one handler's import
// graph is broken. Each route self-loads on first hit. The first 503
// response also includes the underlying import error so the next deploy
// can target the actual root cause without digging through Vercel logs.

type Handler = (req: any, res: any) => unknown | Promise<unknown>;

const HANDLER_LOADERS = {
    'ai-chat': () => import('./_handlers/ai-chat'),
    'attribute-order-to-facebook': () => import('./_handlers/attribute-order-to-facebook'),
    'complete-order': () => import('./_handlers/complete-order'),
    'create-checkout-session': () => import('./_handlers/create-checkout-session'),
    'create-payment-intent': () => import('./_handlers/create-payment-intent'),
    'create-subscription-session': () => import('./_handlers/create-subscription-session'),
    'credit-customer-reward': () => import('./_handlers/credit-customer-reward'),
    'git-operations': () => import('./_handlers/git-operations'),
    'marketing-optout': () => import('./_handlers/marketing-optout'),
    'marketing-send': () => import('./_handlers/marketing-send'),
    'marketing-stats': () => import('./_handlers/marketing-stats'),
    'marketing-subscribe': () => import('./_handlers/marketing-subscribe'),
    'paypal-order': () => import('./_handlers/paypal-order'),
    'place-order-credits': () => import('./_handlers/place-order-credits'),
    'send-email': () => import('./_handlers/send-email'),
    'send-order-confirmation': () => import('./_handlers/send-order-confirmation'),
    'subscribe-drop': () => import('./_handlers/subscribe-drop'),
    'unsubscribe': () => import('./_handlers/unsubscribe'),
    'verify-subscription': () => import('./_handlers/verify-subscription'),
} as const;

type HandlerSlug = keyof typeof HANDLER_LOADERS;

// Cache the resolved handler (or null on load failure) per Lambda
// invocation so a successful first hit doesn't pay the import cost
// again on subsequent requests. A failed import is cached as null so
// we don't retry the broken import on every request -- operators see
// the 503 + log line, fix the underlying issue, redeploy, and the
// cache invalidates with the new Lambda container.
const handlerCache = new Map<HandlerSlug, Promise<Handler | null>>();

async function loadHandler(slug: HandlerSlug): Promise<Handler | null> {
    const cached = handlerCache.get(slug);
    if (cached) return cached;

    const promise = (async () => {
        try {
            const mod = await HANDLER_LOADERS[slug]();
            const handler = (mod as { default?: Handler }).default;
            if (typeof handler !== 'function') {
                console.error(`[api] handler ${slug} did not export a default function`);
                return null;
            }
            return handler;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[api] failed to load handler ${slug}:`, message);
            return null;
        }
    })();

    handlerCache.set(slug, promise);
    return promise;
}

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

    if (!(slug in HANDLER_LOADERS)) {
        // Avoid leaking the path name in the response -- only log it server-side.
        console.info('[api] unknown endpoint:', slug);
        res.status(404).json({ error: 'Endpoint not found' });
        return;
    }

    const routeHandler = await loadHandler(slug as HandlerSlug);
    if (!routeHandler) {
        // Per-route 503 isolation: a broken handler import degrades to
        // 503 for just this slug. The Lambda stays up; every other route
        // continues to work. Surface the underlying error in the body so
        // operators can see what's wrong without scraping Vercel logs.
        res.status(503).json({
            error: 'Handler is temporarily unavailable.',
            slug,
        });
        return;
    }

    try {
        return await routeHandler(req, res);
    } catch (handlerError: unknown) {
        // Live handler execution threw (e.g., third-party API failure or an
        // unexpected runtime condition). Surface the actual cause so the
        // next deploy shows what's broken instead of Vercel's opaque
        // FUNCTION_INVOCATION_FAILED. Slug is safe to echo because it was
        // already approved by the public handlers map; the stack + message
        // stay server-side via console.error. Skip writing a 500 body if
        // the inner handler already started streaming -- otherwise the
        // second `res.status().json()` throws "Cannot set headers after
        // they are sent" and masks the original error in the logs.
        const message = handlerError instanceof Error ? handlerError.message : String(handlerError);
        const stack = handlerError instanceof Error ? handlerError.stack : undefined;
        console.error('[api] handler threw for slug:', slug, '\n', message, '\n', stack || '(no stack)');
        // Streaming handlers may have already flushed response headers but
        // not yet finished writing the body when they throw. `headersSent`
        // alone is insufficient -- we must also destroy the response so the
        // client doesn't hang waiting for a body that never arrives.
        if (res.headersSent) {
            res.destroy();
            return;
        }
        res.status(500).json({
            error: 'Handler failed at runtime',
            slug,
            detail: message,
        });
    }
}
