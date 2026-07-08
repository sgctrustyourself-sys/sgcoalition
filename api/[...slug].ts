// Each route's heavy client init (Stripe / Resend / Supabase / Google AI /
// gitService) only runs when that route is actually hit. We previously used
// dynamic `import('./_handlers/<name>')` here, but Vercel's serverless
// bundler ships the catch-all as a standalone /var/task/api/[...slug].js
// and treats dynamic-import targets as on-disk files at /var/task/api/,
// which they are NOT (only static-import-reachable code is included). The
// dynamic-import path then resolves "Cannot find module ..." at runtime
// with no fallback. Static imports at the top of this file force Vercel's
// bundler to include every handler in the same Lambda bundle.
//
// Request/response are typed `any` to match the existing handlers'
// (req: any, res: any) signature and avoid pulling in @vercel/node as a
// hard dependency; Vercel provides the runtime types automatically.

type Handler = (req: any, res: any) => unknown | Promise<unknown>;

import aiChat from './_handlers/ai-chat';
import attributeOrderToFacebook from './_handlers/attribute-order-to-facebook';
import completeOrder from './_handlers/complete-order';
import createCheckoutSession from './_handlers/create-checkout-session';
import createPaymentIntent from './_handlers/create-payment-intent';
import createSubscriptionSession from './_handlers/create-subscription-session';
import creditCustomerReward from './_handlers/credit-customer-reward';
import gitOperations from './_handlers/git-operations';
import marketingOptout from './_handlers/marketing-optout';
import marketingSend from './_handlers/marketing-send';
import marketingStats from './_handlers/marketing-stats';
import marketingSubscribe from './_handlers/marketing-subscribe';
import paypalOrder from './_handlers/paypal-order';
import placeOrderCredits from './_handlers/place-order-credits';
import sendEmail from './_handlers/send-email';
import sendOrderConfirmation from './_handlers/send-order-confirmation';
import subscribeDrop from './_handlers/subscribe-drop';
import unsubscribe from './_handlers/unsubscribe';
import verifySubscription from './_handlers/verify-subscription';

const handlers: Record<string, Handler> = {
    'ai-chat': aiChat,
    'attribute-order-to-facebook': attributeOrderToFacebook,
    'complete-order': completeOrder,
    'create-checkout-session': createCheckoutSession,
    'create-payment-intent': createPaymentIntent,
    'create-subscription-session': createSubscriptionSession,
    'credit-customer-reward': creditCustomerReward,
    'git-operations': gitOperations,
    'marketing-optout': marketingOptout,
    'marketing-send': marketingSend,
    'marketing-stats': marketingStats,
    'marketing-subscribe': marketingSubscribe,
    'paypal-order': paypalOrder,
    'place-order-credits': placeOrderCredits,
    'send-email': sendEmail,
    'send-order-confirmation': sendOrderConfirmation,
    'subscribe-drop': subscribeDrop,
    'unsubscribe': unsubscribe,
    'verify-subscription': verifySubscription,
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

    const routeHandler = handlers[slug as string];
    if (!routeHandler) {
        // Avoid leaking the path name in the response -- only log it server-side.
        console.info('[api] unknown endpoint:', slug);
        res.status(404).json({ error: 'Endpoint not found' });
        return;
    }

    try {
        return routeHandler(req, res);
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
