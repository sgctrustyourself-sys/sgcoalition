// utils/logger.ts
//
// One logger for checkout and order code, used by both the browser and the
// serverless functions. debug and info lines are dropped in production; warn
// and error always print, so failures stay visible in the browser console and
// in Vercel's function logs.
//
// Production is detected in both runtimes: the Vite build sets
// import.meta.env.PROD, and Vercel functions set NODE_ENV=production.

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

function isProduction(): boolean {
    const viteProd = import.meta.env?.PROD;
    if (typeof viteProd === 'boolean') return viteProd;
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
}

/** A logger whose lines carry a `[scope]` tag, e.g. createLogger('OrderIntake'). */
export function createLogger(scope: string): Logger {
    const tag = `[${scope}]`;

    const emit = (level: Level, message: string, args: unknown[]): void => {
        if (isProduction() && (level === 'debug' || level === 'info')) return;
        const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
        sink(`${tag} ${message}`, ...args);
    };

    return {
        debug: (message, ...args) => emit('debug', message, args),
        info: (message, ...args) => emit('info', message, args),
        warn: (message, ...args) => emit('warn', message, args),
        error: (message, ...args) => emit('error', message, args),
    };
}
