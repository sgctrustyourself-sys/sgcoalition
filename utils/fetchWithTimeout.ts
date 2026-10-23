// utils/fetchWithTimeout.ts
//
// One owner for "a checkout write cannot hang forever".
//
// The checkout's write is a single POST to /api/complete-order. Every caller
// holds a control that stays disabled (a pay button, a confirm button) or a
// spinner (the recovery page) until that request settles, so a connection the
// platform never closes left the shopper stuck on a control that would never
// come back — nothing to retry, nothing to read, no way forward but a manual
// reload. The abort below is the backstop: the wait becomes a real Error the
// caller can show, and the button comes back.
//
// Aborting is safe to surface as a failure to retry, because the request body
// carries the checkout's attempt id (utils/checkoutAttempt.ts). If the write
// did land despite the abort, the retry resolves to the order already recorded
// instead of placing a second one or debiting store credit twice.

/**
 * Deliberately longer than any platform function limit: the serverless write is
 * expected to die on its own first, so this only fires for a request that never
 * answers at all. Short enough to still be an answer for the shopper.
 */
export const ORDER_WRITE_TIMEOUT_MS = 30_000;

/**
 * Shown to the shopper, so it says what to do next, not what went wrong. The
 * promise carries no window now: the write is keyed by the checkout's attempt
 * id (utils/checkoutAttempt.ts), and the client asks the server whether that
 * attempt is already settled instead of guessing at it from a clock. A
 * re-submitted checkout therefore resolves to the order already recorded under
 * the attempt, or writes the one order that is missing — either way following
 * this instruction cannot charge the shopper twice.
 */
export function orderWriteTimeoutMessage(timeoutMs: number = ORDER_WRITE_TIMEOUT_MS): string {
    return 'No answer from the order service after ' + Math.round(timeoutMs / 1000)
        + 's. Reload this page to check your order — re-submitting reuses this attempt '
        + 'instead of placing or charging the order twice.';
}

/**
 * `fetch` that gives up after `timeoutMs` and throws a readable Error instead of
 * leaving the caller pending. A non-timeout failure is rethrown untouched.
 */
export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeoutMs: number = ORDER_WRITE_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
        // Only our own timer aborts this controller (callers pass no signal of
        // their own), so an abort here is the timeout — name it, rather than
        // letting the browser's "signal is aborted without reason" through.
        if (controller.signal.aborted) throw new Error(orderWriteTimeoutMessage(timeoutMs));
        throw err;
    } finally {
        clearTimeout(timer);
    }
}
