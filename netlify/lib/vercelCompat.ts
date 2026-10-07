// netlify/lib/vercelCompat.ts
//
// Runs the existing Node-style `(req, res)` API handlers under api/ inside
// Netlify Functions, which speak Web Request/Response. The handlers were
// written against Vercel's helper objects (req.query, parsed req.body,
// res.status().json(), res.send(), ...), so this module rebuilds just enough
// of that surface for them to run unchanged — the handlers stay the single
// source of truth for every route's behavior.
//
// Body parsing mirrors what the handlers were written for: JSON and
// urlencoded bodies arrive parsed, text arrives as a string, anything else as
// a Buffer. `rawBody: true` skips parsing and hands over the exact bytes —
// Stripe signature verification needs them untouched.

type Handler = (req: any, res: any) => unknown | Promise<unknown>;

/** The slice of Netlify's Context this adapter uses. */
export interface NetlifyContext {
    ip?: string;
    waitUntil?: (promise: Promise<unknown>) => void;
}

export interface AdaptOptions {
    /** Leave the body as the raw request bytes (Buffer) instead of parsing it. */
    rawBody?: boolean;
    /** Extra query params to expose to the handler (e.g. the catch-all slug). */
    extraQuery?: Record<string, string | string[]>;
}

function toQuery(url: URL, extra?: Record<string, string | string[]>): Record<string, string | string[]> {
    const query: Record<string, string | string[]> = {};
    for (const key of new Set(url.searchParams.keys())) {
        const values = url.searchParams.getAll(key);
        query[key] = values.length > 1 ? values : values[0];
    }
    return { ...query, ...extra };
}

function toHeaders(headers: Headers): Record<string, string> {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
        out[key.toLowerCase()] = value;
    });
    return out;
}

class InvalidJsonBody extends Error {}

async function readBody(request: Request, rawBody: boolean): Promise<unknown> {
    if (request.method === 'GET' || request.method === 'HEAD') return undefined;
    const bytes = Buffer.from(await request.arrayBuffer());
    if (rawBody) return bytes;
    if (bytes.length === 0) return undefined;

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    const text = bytes.toString('utf8');
    if (contentType.includes('application/json') || contentType.includes('+json')) {
        try {
            return JSON.parse(text);
        } catch {
            throw new InvalidJsonBody('Invalid JSON body');
        }
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(text);
        const out: Record<string, string | string[]> = {};
        for (const key of new Set(params.keys())) {
            const values = params.getAll(key);
            out[key] = values.length > 1 ? values : values[0];
        }
        return out;
    }
    if (contentType.startsWith('text/')) return text;
    return bytes;
}

/** Minimal Node/Vercel-style response that records what the handler wrote. */
class CompatResponse {
    statusCode = 200;
    headersSent = false;
    private headers = new Headers();
    private chunks: Buffer[] = [];
    private resolveEnded!: () => void;
    readonly ended = new Promise<void>((resolve) => {
        this.resolveEnded = resolve;
    });

    status(code: number) {
        this.statusCode = code;
        return this;
    }

    setHeader(name: string, value: string | number | readonly string[]) {
        if (Array.isArray(value)) {
            this.headers.delete(name);
            for (const v of value) this.headers.append(name, String(v));
        } else {
            this.headers.set(name, String(value));
        }
        return this;
    }

    getHeader(name: string) {
        return this.headers.get(name) ?? undefined;
    }

    removeHeader(name: string) {
        this.headers.delete(name);
    }

    write(chunk: unknown) {
        if (chunk !== undefined && chunk !== null) {
            this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        return true;
    }

    end(chunk?: unknown) {
        if (this.headersSent) return this;
        this.write(chunk);
        this.headersSent = true;
        this.resolveEnded();
        return this;
    }

    json(body: unknown) {
        if (!this.headers.has('content-type')) {
            this.headers.set('content-type', 'application/json; charset=utf-8');
        }
        return this.end(JSON.stringify(body));
    }

    send(body: unknown) {
        if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
            return this.json(body);
        }
        if (typeof body === 'string' && !this.headers.has('content-type')) {
            this.headers.set('content-type', 'text/html; charset=utf-8');
        }
        return this.end(body);
    }

    redirect(statusOrUrl: number | string, maybeUrl?: string) {
        const [code, location] = typeof statusOrUrl === 'number'
            ? [statusOrUrl, maybeUrl ?? '/']
            : [307, statusOrUrl];
        this.statusCode = code;
        this.headers.set('location', location);
        return this.end();
    }

    toResponse(): Response {
        const noBody = this.statusCode === 204 || this.statusCode === 304;
        const body = noBody || this.chunks.length === 0 ? null : Buffer.concat(this.chunks);
        return new Response(body, { status: this.statusCode, headers: this.headers });
    }
}

/**
 * Run a Vercel-style handler for a Netlify Function invocation. The handler
 * is loaded lazily so a module that throws at import time (e.g. a missing
 * env var) becomes a 500 for its own route only. Resolves as
 * soon as the handler ends the response; any work the handler keeps doing
 * after that is handed to `context.waitUntil` so it is not cut off.
 */
export async function runVercelHandler(
    request: Request,
    context: NetlifyContext,
    loadHandler: () => Promise<Handler>,
    options: AdaptOptions = {},
): Promise<Response> {
    const url = new URL(request.url);
    const res = new CompatResponse();

    let body: unknown;
    try {
        body = await readBody(request, Boolean(options.rawBody));
    } catch (err) {
        if (err instanceof InvalidJsonBody) {
            return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        throw err;
    }

    const req = {
        method: request.method,
        url: url.pathname + url.search,
        headers: toHeaders(request.headers),
        query: toQuery(url, options.extraQuery),
        body,
        socket: { remoteAddress: context.ip },
        // Handlers only reach for stream events when the body was not
        // pre-read; it always is here, so these are inert.
        on: () => req,
    };

    const run = (async () => {
        const handler = await loadHandler();
        await handler(req, res);
    })();

    const outcome = await Promise.race([
        res.ended.then(() => 'ended' as const),
        run.then(() => 'returned' as const, (err) => ({ err })),
    ]);

    if (outcome === 'ended') {
        const tail = run.catch((err) => console.error('[api] handler failed after responding:', err));
        context.waitUntil?.(tail);
        return res.toResponse();
    }

    if (typeof outcome === 'object') {
        console.error('[api] unhandled handler error:', outcome.err);
        if (!res.headersSent) {
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    }

    // Handler returned without ending the response: send what it set.
    return res.toResponse();
}
