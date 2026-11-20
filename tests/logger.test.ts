// tests/logger.test.ts
//
// utils/logger.ts: debug and info lines are dropped in production; warn and
// error always print. Production is read from import.meta.env.PROD, which
// vi.stubEnv controls in these tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../utils/logger';

describe('createLogger', () => {
    let log: ReturnType<typeof vi.spyOn>;
    let warn: ReturnType<typeof vi.spyOn>;
    let error: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        log = vi.spyOn(console, 'log').mockImplementation(() => {});
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        error = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('prints every level outside production, tagged with the scope', () => {
        vi.stubEnv('PROD', false);
        const logger = createLogger('Checkout');

        logger.debug('d');
        logger.info('i', { order: 1 });
        logger.warn('w');
        logger.error('e');

        expect(log).toHaveBeenCalledWith('[Checkout] d');
        expect(log).toHaveBeenCalledWith('[Checkout] i', { order: 1 });
        expect(warn).toHaveBeenCalledWith('[Checkout] w');
        expect(error).toHaveBeenCalledWith('[Checkout] e');
    });

    it('drops debug and info in production', () => {
        vi.stubEnv('PROD', true);
        const logger = createLogger('OrderIntake');

        logger.debug('noisy detail');
        logger.info('Inventory: 3 -> 2');

        expect(log).not.toHaveBeenCalled();
    });

    it('still prints warnings and errors in production', () => {
        vi.stubEnv('PROD', true);
        const logger = createLogger('stripe-webhook');

        logger.warn('reconcile failed');
        logger.error('malformed metadata');

        expect(warn).toHaveBeenCalledWith('[stripe-webhook] reconcile failed');
        expect(error).toHaveBeenCalledWith('[stripe-webhook] malformed metadata');
    });
});
