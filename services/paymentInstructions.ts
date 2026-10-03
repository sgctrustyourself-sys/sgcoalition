// services/paymentInstructions.ts
//
// Buyer-facing payment instructions for the manual Cash App flow, sent the
// moment the buyer taps "I Have Sent the Payment" (acceptCheckout fires this
// for created cashapp orders only — the dedup makes it exactly-once).
//
// Division of labor, deliberately: GEMINI writes ONE warm brand-voiced
// sentence or two personalized to what the buyer ordered; the FACTS — the
// $sgcoalition cashtag, the exact total, the ORDER NUMBER to put in the Cash
// App note, the items — are rendered by the template below. An LLM is never
// trusted to state money amounts or identifiers: hallucinated facts in a
// payment instruction cost real money and real support threads.
//
// Fail-open everywhere: GEMINI unconfigured (GEMINI_API_KEY is optional in
// production), rate-limited, or off-tone -> the deterministic template still
// goes out. This email is load-bearing for payment matching; the AI voice is
// garnish.

import type { OrderRow } from '../api/_types.js';

function fromAddr(): string {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

function esc(v: unknown): string {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const CASHTAG = '$sgcoalition';

function itemsLine(order: OrderRow): string {
    return (order.items || [])
        .map((i) => esc((i.productName || i.name || 'Item') + (i.selectedSize || i.size ? ' — ' + (i.selectedSize || i.size) : '') + ' × ' + (i.quantity || 1)))
        .join('<br>');
}

// ---- AI voice --------------------------------------------------------------

/**
 * One or two sentences of brand-voiced, buyer-specific warmth. Returns null
 * on ANY failure or an unusable response — the caller falls back to the
 * template's own neutral intro. Output is sanitized: fences, quotes, and
 * length are capped.
 */
export async function generateCashAppIntro(order: OrderRow): Promise<string | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    try {
        const { geminiClient } = await import('../api/_services.js');
        const model = geminiClient().getGenerativeModel({
            model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp',
            generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        });
        const items = (order.items || [])
            .map((i) => (i.productName || i.name || 'Item') + (i.selectedSize || i.size ? ' (' + (i.selectedSize || i.size) + ')' : '') + ' x' + (i.quantity || 1))
            .join(', ');
        const prompt = [
            'You write one short paragraph for SG Coalition, a Baltimore streetwear brand. Voice: direct, warm, confident - "Trust Yourself" energy without cosplay. Never use emojis, hashtags, or markdown.',
            'A buyer just placed an order and chose to pay manually through Cash App. Write 1-2 sentences acknowledging their order and telling them to finish the Cash App payment using the details below your paragraph. Mention what they ordered by name. Do NOT invent, state, or reformat any amounts, cashtags, order numbers, URLs, or deadlines - those are rendered separately and must stay out of your text.',
            'Ordered: ' + (items || 'their order'),
            'Buyer first name: ' + String(order.customer_name || 'there').split(' ')[0],
            'Output ONLY the paragraph text.',
        ].join('\n');
        const result = await model.generateContent(prompt);
        const text = String(result?.response?.text() || '')
            .replace(/```[a-z]*\n?/gi, '')
            .replace(/^["'\s]+|["'\s]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text || text.length < 20 || text.length > 600) return null;
        return text;
    } catch (e) {
        console.warn('[PaymentInstructions] AI intro unavailable:', (e as Error)?.message || e);
        return null;
    }
}

// ---- Main entry ------------------------------------------------------------

/**
 * Send the Cash App payment-instruction email for a created order. Never
 * throws — a failed instruction email must not fail the checkout that already
 * recorded the order.
 */
export async function sendCashAppInstructions(order: OrderRow): Promise<void> {
    try {
        const to = String(order.customer_email || '').trim();
        if (!to || !to.includes('@')) return;
        const { resendClient } = await import('../api/_services.js');
        const orderNumber = String(order.order_number || order.id);
        const total = '$' + Number(order.total || 0).toFixed(2);
        const aiIntro = await generateCashAppIntro(order);
        const introHtml = aiIntro
            ? '<p style="font-size:15px;line-height:1.6;">' + esc(aiIntro) + '</p>'
            : '<p style="font-size:15px;line-height:1.6;">Hi ' + esc(String(order.customer_name || 'there').split(' ')[0]) + ' — your order is reserved. One step left: send the payment on Cash App and it goes straight into production.</p>';

        const html =
            '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;">'
            + '<h1 style="letter-spacing:2px;">Coalition</h1>'
            + '<h2>Finish your Cash App payment</h2>'
            + introHtml
            + '<div style="background:#111;color:#fff;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">'
            + '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">Send exactly</div>'
            + '<div style="font-size:32px;font-weight:bold;margin:6px 0;">' + esc(total) + '</div>'
            + '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-top:10px;">to Cash App tag</div>'
            + '<div style="font-size:24px;font-weight:bold;color:#22c55e;margin:4px 0;">' + CASHTAG + '</div>'
            + '</div>'
            + '<div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:16px;margin:0 0 20px;">'
            + '<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#92400e;font-weight:bold;">Put this in your Cash App note</div>'
            + '<div style="font-size:22px;font-weight:bold;color:#111;margin-top:6px;font-family:monospace;">' + esc(orderNumber) + '</div>'
            + '<p style="font-size:13px;color:#92400e;margin:8px 0 0;">The note is how we match your payment to this order instantly — it is the difference between shipping today and a back-and-forth.</p>'
            + '</div>'
            + '<table style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 20px;width:100%;">'
            + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Items</strong></td><td style="padding:12px;">' + itemsLine(order) + '</td></tr>'
            + '</table>'
            + '<p style="font-size:14px;line-height:1.6;">After you send it, reply to this email with a screenshot if you want a speed-up — otherwise we match it by the note and you will get a shipping confirmation with tracking as soon as it leaves the studio.</p>'
            + '<p style="color:#555;">Questions? <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a>. Trust Yourself.</p>'
            + '</div>';

        await resendClient().emails.send({
            from: fromAddr(),
            to: [to],
            subject: 'Finish your Cash App payment — ' + orderNumber,
            html,
        } as never);
        console.log('[PaymentInstructions] Cash App instructions sent for ' + orderNumber + (aiIntro ? ' (AI intro)' : ' (template intro)'));
    } catch (e) {
        console.warn('[PaymentInstructions] instruction email failed (non-fatal):', (e as Error)?.message || e);
    }
}
