/**
 * scripts/sendReferralCodeEmails.ts
 *
 * Bulk-send the verified-buyer referral-code onboarding email.
 *
 * USAGE:
 *   npx tsx scripts/sendReferralCodeEmails.ts                                  # dry-run on all
 *   npx tsx scripts/sendReferralCodeEmails.ts --confirm                        # send to all
 *   npx tsx scripts/sendReferralCodeEmails.ts --confirm --window=24            # skip anyone contacted within 24h
 *   npx tsx scripts/sendReferralCodeEmails.ts --email=zambox847@gmail.com
 *   npx tsx scripts/sendReferralCodeEmails.ts --email=zambox847@gmail.com --confirm
 *
 * SOURCE-OF-TRUTH
 *   `marketing_contacts` rows represent the verified-buyer cohort we
 *   cultivate by hand (see scripts/seedVerifiedCustomers.ts for the
 *   manual_seed source pattern). We join them to `auth.users` via
 *   `supabase.auth.admin.listUsers` to read the display name, then to
 *   `referral_stats` for the customized referral_code.
 *
 * TRANSPORT
 *   Resend requires a server-side key, so this script POSTs to the
 *   deployed /api/send-email endpoint (services/emailService.ts -> the
 *   Node handler that holds RESEND_API_KEY).
 *
 * SAFETY
 *   Two layers protect against accidental re-sends:
 *     1. After a successful dispatch we write
 *        `marketing_contacts.metadata.last_invite_sent_at` so the next
 *        dry-run prints when each contact was last contacted.
 *     2. --window=<hours> blocks anyone whose last_invite_sent_at falls
 *        inside the window. Without the flag, --confirm sends to every
 *        active contact regardless of last contact. The window defaults
 *        to 0 (no guard) for backwards-compatibility with the first run.
 *
 * TESTING
 *   For Zambo (the most recent verified buyer we set up), run:
 *     npx tsx scripts/sendReferralCodeEmails.ts --email=zambox847@gmail.com --confirm
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
    renderReferralCodeOnboardingHtml,
    REFERRAL_CODE_EMAIL_SUBJECT,
} from '../utils/referralEmailTemplate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    console.error('!! VITE_SUPABASE_URL missing in .env');
    process.exit(1);
}
if (!SERVICE_KEY) {
    console.error('!! SUPABASE_SERVICE_ROLE_KEY missing in .env (required for auth.users read)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const SITE_BASE = process.env.SITE_BASE || 'https://sgcoalition.xyz';
const API_URL_OVERRIDE = (() => {
    const arg = process.argv.find((a) => a.startsWith('--api-url='));
    return arg ? arg.split('=')[1] : null;
})();
const API_URL = API_URL_OVERRIDE || `${SITE_BASE}/api/send-email`;

interface VerifiedContact {
    email: string;
    source: string;
    status: string;
    verifiedAt: string | null;
    metadata: Record<string, any>;
}

interface AuthUserRow {
    id: string;
    email: string;
    user_metadata: Record<string, any>;
}

interface ReferralStatsRow {
    user_id: string;
    referral_code: string;
    current_tier: number;
    code_customized: boolean;
    code_customized_at: string | null;
}

interface Recipient {
    email: string;
    displayName: string;
    referralCode: string;
    referralUrl: string;
    currentTier: number;
    verifiedAt: string | null;
    lastInviteSentAt: string | null;
}

// Source-of-truth block: pick the verified-buyer cohort out of marketing_contacts.
// Sources 'manual_seed', 'wholesale_buyer', 'verified_buyer' all flag
// hand-cultivated contacts. Status must be 'active'.
async function loadVerifiedContacts(): Promise<VerifiedContact[]> {
    const { data, error } = await supabase
        .from('marketing_contacts')
        .select('email, source, status, verified_at, metadata, created_at')
        .eq('status', 'active')
        .in('source', ['manual_seed', 'wholesale_buyer', 'verified_buyer'])
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error('marketing_contacts read failed: ' + error.message);
    }
    return (data || []).map((row: any) => ({
        email: row.email,
        source: row.source,
        status: row.status,
        verifiedAt: row.verified_at || row.created_at || null,
        metadata: row.metadata || {},
    }));
}

// GoTrueClient v2 deprecated `getUserByEmail` ^C we use listUsers + email
// filter. Verified cohort is small (<50) so a single page is plenty; the
// pagination loop is defensive in case the cohort grows.
async function loadAuthUsersByEmail(emails: string[]): Promise<Map<string, AuthUserRow>> {
    const out = new Map<string, AuthUserRow>();
    if (emails.length === 0) return out;
    const wanted = new Set(emails.map((e) => e.toLowerCase()));
    let page = 1;
    const perPage = 1000;
    for (let safety = 0; safety < 20; safety++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) {
            console.warn('  !! auth listUsers failed (page=' + page + '):', error.message);
            break;
        }
        const users = data?.users || [];
        for (const u of users) {
            const email = (u.email || '').toLowerCase();
            if (email && wanted.has(email)) {
                out.set(email, {
                    id: u.id,
                    email: u.email || '',
                    user_metadata: (u as any).user_metadata || {},
                });
            }
        }
        if (users.length < perPage) break;
        page += 1;
    }
    return out;
}

async function loadReferralStatsFor(userIds: string[]): Promise<Map<string, ReferralStatsRow>> {
    const out = new Map<string, ReferralStatsRow>();
    if (userIds.length === 0) return out;
    const { data, error } = await supabase
        .from('referral_stats')
        .select('user_id, referral_code, current_tier, code_customized, code_customized_at')
        .in('user_id', userIds);
    if (error) {
        throw new Error('referral_stats read failed: ' + error.message);
    }
    for (const row of data || []) {
        out.set(row.user_id, row as ReferralStatsRow);
    }
    return out;
}

async function resolveRecipients(targetEmail: string | null): Promise<Recipient[]> {
    const contacts = await loadVerifiedContacts();
    const filtered = targetEmail
        ? contacts.filter((c) => c.email.toLowerCase() === targetEmail.toLowerCase())
        : contacts;
    if (filtered.length === 0) {
        console.log('No verified contacts matched' + (targetEmail ? ` for ${targetEmail}` : ''));
        return [];
    }

    const emails = filtered.map((c) => c.email);
    const authMap = await loadAuthUsersByEmail(emails);
    const userIds = Array.from(authMap.values()).map((u) => u.id);
    const statsMap = await loadReferralStatsFor(userIds);

    const recipients: Recipient[] = [];
    for (const contact of filtered) {
        const authUser = authMap.get(contact.email.toLowerCase());
        if (!authUser) {
            console.warn('  !! no auth.users row for', contact.email, '-- skip');
            continue;
        }
        const stats = statsMap.get(authUser.id);
        if (!stats) {
            console.warn('  !! no referral_stats row for', contact.email, '-- skip');
            continue;
        }
        const displayName =
            (contact.metadata?.full_name as string | undefined) ||
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.display_name ||
            authUser.user_metadata?.name ||
            authUser.email.split('@')[0];
        const referralUrl = `${SITE_BASE}/?ref=${encodeURIComponent(stats.referral_code)}`;
        recipients.push({
            email: contact.email,
            displayName,
            referralCode: stats.referral_code,
            referralUrl,
            currentTier: stats.current_tier || 1,
            verifiedAt: contact.verifiedAt,
            lastInviteSentAt: contact.metadata?.last_invite_sent_at || null,
        });
    }
    return recipients;
}

// Apply --window guard: recipients whose last_invite_sent_at is within the
// window are reported + excluded from the dispatch loop.
function applyWindowGuard(recipients: Recipient[], windowHours: number): Recipient[] {
    if (!windowHours || windowHours <= 0) return recipients;
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const kept: Recipient[] = [];
    for (const r of recipients) {
        if (r.lastInviteSentAt) {
            const ts = Date.parse(r.lastInviteSentAt);
            if (Number.isFinite(ts) && ts > cutoff) {
                console.log(
                    `  -- skip ${r.email}: last contacted ${r.lastInviteSentAt} (within ${windowHours}h window)`,
                );
                continue;
            }
        }
        kept.push(r);
    }
    return kept;
}

async function dispatchEmail(recipient: Recipient): Promise<{ ok: boolean; error?: string; id?: string }> {
    const html = renderReferralCodeOnboardingHtml(recipient, SITE_BASE);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: recipient.email,
                subject: REFERRAL_CODE_EMAIL_SUBJECT,
                html,
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            return { ok: false, error: `HTTP ${response.status} ${body.slice(0, 120)}` };
        }
        const result = await response.json().catch(() => ({}));
        return { ok: true, id: result?.data?.id };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

// Fire-and-forget audit writeback. Soft-fails so dispatch results are
// never blocked by a write race (two parallel --confirm runs would not
// meaningfully collide on a monotonic ISO timestamp).
async function markContacted(email: string): Promise<void> {
    try {
        const { data: row, error: readErr } = await supabase
            .from('marketing_contacts')
            .select('id, metadata')
            .eq('email', email)
            .maybeSingle();
        if (readErr || !row) return;
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const updated = { ...meta, last_invite_sent_at: new Date().toISOString() };
        await supabase
            .from('marketing_contacts')
            .update({ metadata: updated })
            .eq('id', row.id);
    } catch {
        // soft-fail
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--confirm');
    const emailArg = args.find((a) => a.startsWith('--email='));
    const targetEmail = emailArg ? emailArg.split('=')[1] : null;
    const windowArg = args.find((a) => a.startsWith('--window='));
    const windowHours = windowArg ? Number(windowArg.split('=')[1]) || 0 : 0;

    console.log('');
    console.log('=== Coalition Referral-Code Onboarding Email ===');
    console.log('Mode:                ' + (dryRun ? 'DRY-RUN (use --confirm to send)' : 'CONFIRM (sending live)'));
    console.log('Target:              ' + (targetEmail || `all verified contacts (status=active, source in {manual_seed, wholesale_buyer, verified_buyer})`));
    console.log('Recontact window:    ' + (windowHours > 0 ? `skip anyone contacted within ${windowHours}h (--window=${windowHours})` : 'no guard'));
    console.log('API endpoint:        ' + API_URL);
    console.log('Site base:           ' + SITE_BASE);
    console.log('');

    let recipients = await resolveRecipients(targetEmail);
    if (recipients.length === 0) {
        console.log('Nothing to send.');
        return;
    }
    if (!dryRun && windowHours > 0) {
        recipients = applyWindowGuard(recipients, windowHours);
        if (recipients.length === 0) {
            console.log('Nothing to send after window guard.');
            return;
        }
    }

    console.log('Recipients resolved:');
    console.log('---');
    for (const r of recipients) {
        const lastSent = r.lastInviteSentAt
            ? `(last contacted ${r.lastInviteSentAt.slice(0, 16).replace('T', ' ')})`
            : (r.verifiedAt ? `(verified ${r.verifiedAt.slice(0, 10)})` : '(no last-contact record)');
        console.log(`  - ${r.email.padEnd(28)} | name="${r.displayName}" | code=${r.referralCode.padEnd(10)} | T${r.currentTier} | ${r.referralUrl}  ${lastSent}`);
    }
    console.log('---');
    console.log(`Total: ${recipients.length}`);
    console.log('');

    if (dryRun) {
        console.log('DRY-RUN complete. Re-run with --confirm to dispatch.');
        if (windowHours > 0) {
            console.log(`Tip: pass --window=${windowHours} WITH --confirm to enforce the guard at send time.`);
        }
        console.log('');
        return;
    }

    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
        process.stdout.write(`  -> sending to ${recipient.email} ... `);
        const result = await dispatchEmail(recipient);
        if (result.ok) {
            console.log('OK (' + (result.id || 'no-id') + ')');
            await markContacted(recipient.email);
            sent++;
        } else {
            console.log('FAIL: ' + result.error);
            failed++;
        }
    }

    console.log('');
    console.log(`Sent: ${sent}    Failed: ${failed}`);
    if (failed > 0) process.exit(2);
}

main().catch((err) => {
    console.error('!! Aborted:', err.message || err);
    if (err && typeof err === 'object') {
        console.error('  message:', err.message);
        console.error('  code:', err.code);
    }
    process.exit(1);
});
