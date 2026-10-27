// api/_services.ts
//
// Single ownership of the three external service clients the server uses:
// Stripe (payment + subscription + webhook), Resend (all email), and Gemini
// (ai-chat). The same shape as api/_supabase.ts and api/_adminAuth.ts — one
// module owns a client per service, everyone else imports it.
//
// Why: today a Stripe/Resend/Gemini client is constructed in nine server files.
// Most of those are "one client per request", which is slow, but some (the
// create-* sessions, send-email, send-order-confirmation) construct one at
// module init and keep it live for the process lifetime — and a future author
// adding a tenth file has no structural signal telling them the owner already
// exists. This module makes the owner visible in a diff and lets a single test
// fail on any second construction.
//
// Anti-vacuity: the module itself calls new Stripe / new Resend / new
// GoogleGenerativeAI, so a scan that "matches nothing" would also stop finding
// the owners — which is the failure a guard wants.

import Stripe from 'stripe';
import { Resend } from 'resend';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

/** The canonical Stripe client. Every server-side Stripe call goes through here. */
export function stripeClient(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
        _stripe = new Stripe(key);
    }
    return _stripe;
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

let _resend: Resend | null = null;

/** The canonical Resend client. Every server-side email send goes through here. */
export function resendClient(): Resend {
    if (!_resend) {
        const key = process.env.RESEND_API_KEY;
        if (!key) {
            // Unconfigured: throw so a handler that needs email fails loudly
            // rather than silently constructing a no-op client. Tests that mock
            // the Resend boundary set this env before importing the handler.
            throw new Error('RESEND_API_KEY is not configured');
        }
        _resend = new Resend(key);
    }
    return _resend;
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

let _gemini: GoogleGenerativeAI | null = null;

/** The canonical Gemini client. The ai-chat handler goes through here. */
export function geminiClient(): GoogleGenerativeAI {
    if (!_gemini) {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error('GEMINI_API_KEY is not configured');
        _gemini = new GoogleGenerativeAI(key);
    }
    return _gemini;
}
