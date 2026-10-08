// tests/paymentInstructions.test.ts
//
// Gate suite for services/paymentInstructions.ts — the manual Cash App
// payment-instruction email. The load-bearing invariant: the FACTS (exact
// total, $sgcoalition cashtag, the order number that goes in the Cash App
// note) are rendered by the deterministic template, never by the LLM; the AI
// contributes at most 1-2 sentences of voice and any failure of the AI (or of
// the email itself) must never surface to the checkout that already recorded
// the order.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGenerateContent = vi.fn();
const mockResendSend = vi.fn();

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn(function (this: any) {
        this.getGenerativeModel = () => ({ generateContent: mockGenerateContent });
    }),
}));

vi.mock('resend', () => ({
    Resend: vi.fn(function (this: any) {
        this.emails = { send: mockResendSend };
    }),
}));

import { generateCashAppIntro, sendCashAppInstructions } from '../services/paymentInstructions';
import type { OrderRow } from '../api/_types';

function stubOrder(overrides: Partial<OrderRow> = {}): OrderRow {
    const now = new Date().toISOString();
    return {
        id: 'order_cash_001', order_number: 'ORD-CASH-77', user_id: null, is_guest: true,
        customer_name: 'Jordan Carter', customer_email: 'buyer@test.com', customer_phone: '',
        items: [
            { productId: 'p1', productName: 'Trust Tee', productImage: '', selectedSize: 'M', quantity: 1, price: 45, basePrice: 45, addOnPrice: 0, keychainClipOn: false, total: 45, name: 'Trust Tee', image: '', size: 'M' },
        ] as OrderRow['items'],
        subtotal: 45, tax: 0, discount: 0, total: 45,
        payment_method: 'cashapp', payment_status: 'pending',
        payment_reference: null, paypal_order_id: null, order_type: 'online',
        shipping_address: null, shipping_info: null, notes: '',
        created_at: now, paid_at: null, sg_coin_reward: 0, paid_amount: 0, balance_due: 45,
        ...overrides,
    } as OrderRow;
}

function aiReply(text: string) {
    mockGenerateContent.mockResolvedValue({ response: { text: () => text } });
}

beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'test@coalition.com';
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_TEXT_MODEL;
    mockGenerateContent.mockReset();
    mockResendSend.mockReset();
    mockResendSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
});

afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_TEXT_MODEL;
});

// =========================================================================
// generateCashAppIntro — AI voice, fail-open
// =========================================================================

describe('generateCashAppIntro', () => {
    it('returns null when GEMINI_API_KEY is not configured (production default)', async () => {
        const intro = await generateCashAppIntro(stubOrder());
        expect(intro).toBeNull();
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('returns sanitized text when the model responds inside the guardrails', async () => {
        process.env.GEMINI_API_KEY = 'ai_test_key';
        aiReply('```\n"Your Trust Tee in M is set aside, Jordan — finish checkout below."\n```');

        const intro = await generateCashAppIntro(stubOrder());
        // Fences, surrounding quotes, and inner newlines are stripped; content survives.
        expect(intro).toBe('Your Trust Tee in M is set aside, Jordan — finish checkout below.');
    });

    it('returns null on model failure instead of throwing', async () => {
        process.env.GEMINI_API_KEY = 'ai_test_key';
        mockGenerateContent.mockRejectedValue(new Error('rate limited'));
        const intro = await generateCashAppIntro(stubOrder());
        expect(intro).toBeNull();
    });

    it('rejects degenerate responses (too short to be a real intro)', async () => {
        process.env.GEMINI_API_KEY = 'ai_test_key';
        aiReply('ok');
        const intro = await generateCashAppIntro(stubOrder());
        expect(intro).toBeNull();
    });
});

// =========================================================================
// sendCashAppInstructions — deterministic facts + fail-open delivery
// =========================================================================

describe('sendCashAppInstructions', () => {
    it('renders the exact facts from the order row with the template intro (no AI)', async () => {
        await sendCashAppInstructions(stubOrder());

        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const payload = mockResendSend.mock.calls[0][0] as { from: string; to: string[]; subject: string; html: string };
        expect(payload.to).toEqual(['buyer@test.com']);
        // The order number is the whole point — it must be in the subject AND the note box.
        expect(payload.subject).toContain('ORD-CASH-77');
        expect(payload.html).toContain('ORD-CASH-77');
        expect(payload.html).toContain('$sgcoalition');
        expect(payload.html).toContain('$45.00');
        expect(payload.html).toContain('Put this in your Cash App note');
        expect(payload.html).toContain('Trust Tee');
        // Template intro, not an AI hallucination vector.
        expect(payload.html).toContain('your order is reserved');
    });

    it('includes the AI intro as voice when Gemini is configured and on-tone', async () => {
        process.env.GEMINI_API_KEY = 'ai_test_key';
        aiReply('Your Trust Tee in size M is reserved under your name, Jordan — one step left below.');

        await sendCashAppInstructions(stubOrder());

        const payload = mockResendSend.mock.calls[0][0] as { html: string };
        expect(payload.html).toContain('reserved under your name, Jordan');
        // Deterministic facts still render alongside the AI voice.
        expect(payload.html).toContain('ORD-CASH-77');
        expect(payload.html).toContain('$45.00');
    });

    it('falls back to the template intro when the AI fails', async () => {
        process.env.GEMINI_API_KEY = 'ai_test_key';
        mockGenerateContent.mockRejectedValue(new Error('boom'));

        await sendCashAppInstructions(stubOrder());

        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const payload = mockResendSend.mock.calls[0][0] as { html: string };
        expect(payload.html).toContain('your order is reserved');
    });

    it('never throws when Resend rejects the send', async () => {
        mockResendSend.mockRejectedValue(new Error('resend down'));
        await expect(sendCashAppInstructions(stubOrder())).resolves.toBeUndefined();
    });

    it('skips the send entirely when there is no usable buyer email', async () => {
        await sendCashAppInstructions(stubOrder({ customer_email: '' }));
        await sendCashAppInstructions(stubOrder({ customer_email: 'not-an-email' }));
        expect(mockResendSend).not.toHaveBeenCalled();
    });
});
