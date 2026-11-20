/**
 * Reads a human-readable message from a thrown value.
 *
 * Catch clauses are typed `unknown` under `useUnknownInCatchVariables`, so the
 * message can no longer be read directly. This narrows once, here, instead of
 * each of the hundred-odd call sites repeating an `instanceof` check (or
 * escaping typing with `: any`).
 */
export function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;

    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') return message;
    }

    return String(error);
}

/**
 * Narrows a thrown value to an Error-shaped object so callers can read extra
 * fields some SDKs attach (`type`, `statusCode`, `code`) without `any`.
 */
export type ErrorWithDetails = Error & {
    type?: string;
    statusCode?: number;
    code?: string | number;
    response?: { data?: { error?: string; message?: string }; status?: number };
};

export function errorWithDetails(error: unknown): ErrorWithDetails {
    return (error instanceof Error ? error : new Error(errorMessage(error))) as ErrorWithDetails;
}
