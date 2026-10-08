# The Trusted Few Partner Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Referral Program with "The Trusted Few" — a permanent two-tier partner program (Trusted Few = all members earning 5–40%; Trust Circle = flat 20% brand team entered by invite or application).

**Architecture:** Extend the existing referral engine in place. `referral_stats` gains tier columns (`partner_tier`, flat-rate override, invite/member timestamps); one new table `trust_circle_applications` (+ `drop_vouchers` ledger) carries the application flow; the `track_referral_event` RPC is re-created with a Trust Circle branch so the tier ladder never clobbers the flat 20%. All writes stay client-side via Supabase RLS, mirroring `services/customInquiry.ts` — no new API routes. Internal `referral_*` names are kept; only user-facing copy changes.

**Tech Stack:** React 18 + react-router, TypeScript, Vite, vitest, Supabase (Postgres RLS + SECURITY DEFINER RPC), Tailwind.

## Global Constraints

- **Commission engine untouched for Trusted Few:** existing 8-tier progression (5→40%) and `track_referral_event` behavior must remain identical for non-circle members.
- **Flat rate = 20.00** for Trust Circle (`trust_circle_commission_rate`).
- **Internal schema keeps `referral_*` names.** No renames. Only user-facing copy says "The Trusted Few" / "Trust Circle".
- **All user-facing sunset/vote messaging is retired:** `PROGRAM_SUNSET_DATE`, `VOTE_RECOMMENDED_WINDOW`, `VOTE_BLOG_SLUG`, the localStorage dismiss key, the Profile "Continue referrals in 2027?" banner, and the FOLLOWUPS/README sunset notes.
- **Migration is additive and idempotent** (`IF NOT EXISTS` everywhere, safe to run twice); operator pastes it into Supabase SQL Editor (same as `payment_settings` — no DB password available in repo).
- **Mock Supabase at the module boundary in tests** using `tests/_helpers/supabaseClientMock.ts` (singleton + `setOutcomes`), per `tests/referralFlows.test.ts`.
- **Copy rules:** "Referral Program" → "The Trusted Few" on the member dashboard; "Referral Code" may stay (it is literally what members share) but "Commission"/"Earn" language wins; admin "Referral Analytics" tab label stays (internal), new "Trust Circle" tab added.

---

### Task 1: Partner Program migration (schema + RPC)

**Files:**
- Create: `supabase/migrations/20260806_trusted_few_partner_program.sql`

**Interfaces:**
- Consumes: existing `referral_stats` (columns from `create_referral_system.sql` + `20260711_referral_v2_columns_and_rpc.sql`), `uuid_generate_v4()` extension (already in use by `referrals`).
- Produces: `referral_stats.partner_tier`, `.trust_circle_commission_rate`, `.invited_at`, `.circle_member_since`; tables `trust_circle_applications` and `drop_vouchers`; re-created `track_referral_event(…)` that honors `partner_tier = 'trust_circle'`; RLS policies named exactly as listed (services rely on them).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260806_trusted_few_partner_program.sql`:

```sql
-- The Trusted Few / Trust Circle partner program -- additive migration
--
-- Extends the existing referral engine:
--   * referral_stats gains tier columns (partner_tier, flat-rate override,
--     invite/member timestamps)
--   * trust_circle_applications holds the brand-voice application flow
--   * drop_vouchers is the operator ledger for per-drop 100%-off vouchers
--   * track_referral_event is re-created with a Trust Circle branch so the
--     tier ladder never clobbers the flat 20% rate
--
-- SAFE to run twice -- every change is IF NOT EXISTS guarded.

-- ---------------------------------------------------------------------------
-- 1. referral_stats tier columns
-- ---------------------------------------------------------------------------
ALTER TABLE referral_stats
    ADD COLUMN IF NOT EXISTS partner_tier TEXT NOT NULL DEFAULT 'trusted_few'
        CHECK (partner_tier IN ('trusted_few', 'trust_circle')),
    ADD COLUMN IF NOT EXISTS trust_circle_commission_rate NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS circle_member_since TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. trust_circle_applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trust_circle_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'declined')),
    why_join TEXT NOT NULL,
    what_you_create TEXT NOT NULL,
    platforms TEXT[] NOT NULL DEFAULT '{}',
    handles JSONB NOT NULL DEFAULT '{}',
    audience_size TEXT,
    portfolio_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    review_note TEXT
);

-- One pending application per user (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS trust_circle_applications_one_pending
    ON trust_circle_applications (user_id)
    WHERE status = 'pending';

ALTER TABLE trust_circle_applications ENABLE ROW LEVEL SECURITY;

-- User reads/writes only their own application.
DROP POLICY IF EXISTS "Users can view own applications" ON trust_circle_applications;
CREATE POLICY "Users can view own applications"
    ON trust_circle_applications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own applications" ON trust_circle_applications;
CREATE POLICY "Users can create own applications"
    ON trust_circle_applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admin dashboard reads all applications client-side (wallet-gated UI),
-- matching the codebase's established lax posture (cf. custom_inquiries,
-- referral_stats "System can manage stats"). Hardening note: move review
-- writes behind a SECURITY DEFINER RPC if this ever ships to untrusted admins.
DROP POLICY IF EXISTS "System can read all applications" ON trust_circle_applications;
CREATE POLICY "System can read all applications"
    ON trust_circle_applications FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "System can review applications" ON trust_circle_applications;
CREATE POLICY "System can review applications"
    ON trust_circle_applications FOR UPDATE
    USING (true);

-- ---------------------------------------------------------------------------
-- 3. drop_vouchers (operator ledger for free drops)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drop_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coupon_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued'
        CHECK (status IN ('issued', 'redeemed', 'expired')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE drop_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read drop vouchers" ON drop_vouchers;
CREATE POLICY "Anyone can read drop vouchers"
    ON drop_vouchers FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "System can manage drop vouchers" ON drop_vouchers;
CREATE POLICY "System can manage drop vouchers"
    ON drop_vouchers FOR ALL
    USING (true);

-- ---------------------------------------------------------------------------
-- 4. Hardened track_referral_event with Trust Circle flat-rate override
--    (full re-creation of the v2 body + trust_circle branch)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_referral_event(
    p_referral_code VARCHAR(20),
    p_event_type    VARCHAR(20),
    p_user_id       UUID         DEFAULT NULL,
    p_visitor_ip    VARCHAR(45)  DEFAULT NULL,
    p_user_agent    TEXT         DEFAULT NULL,
    p_referrer_url  TEXT         DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_referrer_id            UUID;
    v_total_clicks           INTEGER;
    v_total_views            INTEGER;
    v_successful_referrals   INTEGER;
    v_conversion_rate        DECIMAL(5,2);
    v_new_tier               INTEGER;
    v_new_rate               DECIMAL(5,2);
BEGIN
    SELECT user_id INTO v_referrer_id
    FROM referral_stats
    WHERE referral_code = p_referral_code;

    IF v_referrer_id IS NULL THEN
        RETURN;
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id = v_referrer_id THEN
        RETURN;
    END IF;

    INSERT INTO referral_analytics (
        referral_code, referrer_id, event_type,
        visitor_ip, user_agent, referrer_url
    ) VALUES (
        p_referral_code, v_referrer_id, p_event_type,
        p_visitor_ip, p_user_agent, p_referrer_url
    );

    UPDATE referral_stats
    SET last_referral_ip       = COALESCE(p_visitor_ip, last_referral_ip),
        last_referral_event_at = NOW()
    WHERE user_id = v_referrer_id;

    CASE p_event_type
        WHEN 'click' THEN
            UPDATE referral_stats SET total_clicks = total_clicks + 1 WHERE user_id = v_referrer_id;
        WHEN 'view' THEN
            UPDATE referral_stats SET total_views = total_views + 1 WHERE user_id = v_referrer_id;
        WHEN 'signup' THEN
            UPDATE referral_stats SET total_referrals = total_referrals + 1 WHERE user_id = v_referrer_id;
        WHEN 'purchase' THEN
            UPDATE referral_stats SET successful_referrals = successful_referrals + 1 WHERE user_id = v_referrer_id;

            UPDATE referral_analytics
            SET converted_to_sale = TRUE
            WHERE referral_code = p_referral_code
              AND event_type = 'signup'
              AND created_at = (
                  SELECT MAX(created_at)
                  FROM referral_analytics
                  WHERE referral_code = p_referral_code
                    AND event_type = 'signup'
              );
    END CASE;

    SELECT total_clicks, total_views, successful_referrals
      INTO v_total_clicks, v_total_views, v_successful_referrals
    FROM referral_stats
    WHERE user_id = v_referrer_id;

    IF v_total_clicks > 0 THEN
        v_conversion_rate := (v_successful_referrals::DECIMAL / v_total_clicks::DECIMAL) * 100;
    ELSE
        v_conversion_rate := 0.00;
    END IF;

    -- Trust Circle: keep the flat rate; the tier ladder must not clobber it.
    IF (SELECT partner_tier FROM referral_stats WHERE user_id = v_referrer_id) = 'trust_circle' THEN
        UPDATE referral_stats
        SET conversion_rate = v_conversion_rate
        WHERE user_id = v_referrer_id;
    ELSE
        CASE
            WHEN v_successful_referrals >= 100 THEN v_new_tier := 8; v_new_rate := 40.00;
            WHEN v_successful_referrals >=  50 THEN v_new_tier := 7; v_new_rate := 35.00;
            WHEN v_successful_referrals >=  30 THEN v_new_tier := 6; v_new_rate := 30.00;
            WHEN v_successful_referrals >=  15 THEN v_new_tier := 5; v_new_rate := 25.00;
            WHEN v_successful_referrals >=   7 THEN v_new_tier := 4; v_new_rate := 20.00;
            WHEN v_successful_referrals >=   3 THEN v_new_tier := 3; v_new_rate := 15.00;
            WHEN v_successful_referrals >=   1 THEN v_new_tier := 2; v_new_rate := 10.00;
            ELSE v_new_tier := 1; v_new_rate := 5.00;
        END CASE;

        UPDATE referral_stats
        SET conversion_rate         = v_conversion_rate,
            current_tier            = v_new_tier,
            current_commission_rate = v_new_rate
        WHERE user_id = v_referrer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION track_referral_event(VARCHAR, VARCHAR, UUID, VARCHAR, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION track_referral_event(VARCHAR, VARCHAR, UUID, VARCHAR, TEXT, TEXT) TO anon;

DO $sgcoalition_notice$
BEGIN
    RAISE NOTICE 'Trusted Few migration complete';
END $sgcoalition_notice$;

SELECT
    'referral_stats tier cols' AS what,
    count(*) FILTER (WHERE column_name IN ('partner_tier','trust_circle_commission_rate','invited_at','circle_member_since'))::int AS n
FROM information_schema.columns
WHERE table_name = 'referral_stats'
UNION ALL SELECT
    'trust_circle_applications',
    count(*)::int
FROM trust_circle_applications
UNION ALL SELECT
    'drop_vouchers',
    count(*)::int
FROM drop_vouchers
UNION ALL SELECT
    'trust_circle RPC branch',
    count(*) FILTER (WHERE proname = 'track_referral_event')::int
FROM pg_proc
WHERE proname = 'track_referral_event';
```

- [ ] **Step 2: Sanity-check the SQL is idempotent**

Run: `grep -c "IF NOT EXISTS" supabase/migrations/20260806_trusted_few_partner_program.sql`
Expected: `7` (four `ADD COLUMN IF NOT EXISTS` lines + two `CREATE TABLE IF NOT EXISTS` + one `CREATE UNIQUE INDEX IF NOT EXISTS`; `CREATE OR REPLACE FUNCTION` and `DROP POLICY` are naturally idempotent).

If a local Postgres is available (no password in repo — operator usually pastes into Supabase SQL Editor), apply twice and confirm no errors. Otherwise skip to the operator note.

- [ ] **Step 3: Operator action — apply to Supabase**

Paste the file's contents into Supabase → SQL Editor (Dashboard → Project Settings → Database → SQL Editor) and run. Verify the trailing SELECT shows: `referral_stats tier cols | 4`, `trust_circle_applications | 0`, `drop_vouchers | 0`, `trust_circle RPC branch | 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260806_trusted_few_partner_program.sql
git commit -m "feat(partners): Trusted Few tier columns, applications table, Trust Circle RPC branch"
```

---

### Task 2: `services/trustCircle.ts` + unit tests

**Files:**
- Create: `services/trustCircle.ts`
- Create: `tests/trustCircle.test.ts`
- Test helper: `tests/_helpers/supabaseClientMock.ts` (existing, read-only)

**Interfaces:**
- Consumes: `supabase` from `../services/supabase.js`; `mockSupabase` from `./_helpers/supabaseClientMock`; `referral_stats` columns from Task 1; `trust_circle_applications` + `drop_vouchers` from Task 1.
- Produces (exact names later tasks rely on):

```ts
export type PartnerTier = 'trusted_few' | 'trust_circle';
export interface TrustCircleMembership {
    user_id: string;
    referral_code: string;
    partner_tier: PartnerTier;
    trust_circle_commission_rate: number | null;
    invited_at: string | null;
    circle_member_since: string | null;
}
export interface TrustCircleApplicationInput {
    whyJoin: string;
    whatYouCreate: string;
    platforms: string[];
    handles: { instagram?: string; tiktok?: string; youtube?: string; x?: string };
    audienceSize?: string;
    portfolioUrl?: string;
}
export interface TrustCircleApplication {
    id: string;
    user_id: string;
    status: 'pending' | 'approved' | 'declined';
    why_join: string;
    what_you_create: string;
    platforms: string[];
    handles: Record<string, string>;
    audience_size: string | null;
    portfolio_url: string | null;
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_note: string | null;
}

export const TRUST_CIRCLE_FLAT_RATE = 20;
export async function getMembership(userId: string): Promise<TrustCircleMembership | null>;
export async function submitApplication(input: TrustCircleApplicationInput, userId: string): Promise<{ success: boolean; error?: string; application?: TrustCircleApplication }>;
export async function getMyApplication(userId: string): Promise<TrustCircleApplication | null>;
export async function getApplications(): Promise<TrustCircleApplication[]>;
export async function reviewApplication(id: string, approve: boolean, note: string | null, adminId: string): Promise<{ success: boolean; error?: string }>;
export async function inviteUser(userId: string): Promise<{ success: boolean; error?: string }>;
export async function acceptInvite(userId: string): Promise<{ success: boolean; error?: string }>;
export async function declineInvite(userId: string): Promise<{ success: boolean; error?: string }>;
export async function revokeMember(userId: string): Promise<{ success: boolean; error?: string }>;
export async function issueDropVoucher(memberUserId: string, couponCode: string): Promise<{ success: boolean; error?: string }>;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/trustCircle.test.ts`:

```ts
// tests/trustCircle.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';
import {
    TRUST_CIRCLE_FLAT_RATE,
    getMembership,
    submitApplication,
    getMyApplication,
    getApplications,
    reviewApplication,
    inviteUser,
    acceptInvite,
    declineInvite,
    revokeMember,
    issueDropVoucher,
} from '../services/trustCircle';

vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

const USER_ID = 'user-uuid-circle';
const MEMBERSHIP_ROW = {
    user_id: USER_ID,
    referral_code: 'SG-CIRCLE',
    partner_tier: 'trust_circle',
    trust_circle_commission_rate: 20,
    invited_at: '2026-08-01T00:00:00Z',
    circle_member_since: '2026-08-02T00:00:00Z',
};
const APP_INPUT = {
    whyJoin: 'I rep Baltimore',
    whatYouCreate: 'Fits + streetwear content',
    platforms: ['instagram', 'tiktok'],
    handles: { instagram: '@sg_rep', tiktok: '@sg_rep' },
    audienceSize: '10k',
    portfolioUrl: 'https://tiktok.com/@sg_rep',
};

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.setOutcomes([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getMembership', () => {
    it('returns the referral_stats row when found', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: MEMBERSHIP_ROW, error: null } }]);
        const result = await getMembership(USER_ID);
        expect(result?.partner_tier).toBe('trust_circle');
        expect(result?.trust_circle_commission_rate).toBe(20);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('referral_stats');
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('user_id', USER_ID);
    });

    it('returns null when no row exists', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: new Error('PGRST116') } }]);
        const result = await getMembership(USER_ID);
        expect(result).toBeNull();
    });

    it('returns null for MetaMask users without calling the DB', async () => {
        const result = await getMembership('user_eth_0x1234');
        expect(result).toBeNull();
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
    });
});

describe('submitApplication', () => {
    it('inserts a pending application and returns it', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } }, // existing-pending check -> none
            { kind: 'resolve', value: { data: { id: 'app-1', ...APP_INPUT, user_id: USER_ID, status: 'pending' }, error: null } },
        ]);
        const result = await submitApplication(APP_INPUT, USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('trust_circle_applications');
        const insertPayload = mockSupabase.insertSpy.mock.calls[0]?.[0];
        expect(insertPayload[0].user_id).toBe(USER_ID);
        expect(insertPayload[0].status).toBe('pending');
        expect(insertPayload[0].why_join).toBe(APP_INPUT.whyJoin);
    });

    it('rejects when a pending application already exists', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: { id: 'app-existing' }, error: null } }]);
        const result = await submitApplication(APP_INPUT, USER_ID);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already/i);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
    });

    it('returns error when insert fails', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: null, error: new Error('rpc rls denial') } },
        ]);
        const result = await submitApplication(APP_INPUT, USER_ID);
        expect(result.success).toBe(false);
    });
});

describe('getMyApplication / getApplications', () => {
    it('returns the user pending application', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: { id: 'app-pending', status: 'pending' }, error: null } }]);
        const result = await getMyApplication(USER_ID);
        expect(result?.id).toBe('app-pending');
    });

    it('returns all applications for admin', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: [{ id: 'a' }, { id: 'b' }], error: null } }]);
        const result = await getApplications();
        expect(result).toHaveLength(2);
    });
});

describe('reviewApplication', () => {
    it('APPROVE updates the application and flips the member tier + flat rate', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } }, // app update
            { kind: 'resolve', value: { data: null, error: null } }, // referral_stats update
        ]);
        const result = await reviewApplication('app-1', true, 'Great fits', 'admin-1');
        expect(result.success).toBe(true);
        // application update
        const appUpdate = mockSupabase.updateSpy.mock.calls[0]?.[0];
        expect(appUpdate.status).toBe('approved');
        expect(appUpdate.reviewed_by).toBe('admin-1');
        // referral_stats update: tier + flat rate + circle_member_since
        const statsUpdate = mockSupabase.updateSpy.mock.calls[1]?.[0];
        expect(statsUpdate.partner_tier).toBe('trust_circle');
        expect(statsUpdate.trust_circle_commission_rate).toBe(TRUST_CIRCLE_FLAT_RATE);
        expect(statsUpdate.circle_member_since).toEqual(expect.any(String));
    });

    it('DECLINE updates the application only (tier untouched)', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await reviewApplication('app-1', false, 'Not the fit', 'admin-1');
        expect(result.success).toBe(true);
        const appUpdate = mockSupabase.updateSpy.mock.calls[0]?.[0];
        expect(appUpdate.status).toBe('declined');
        expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1); // no stats write
    });
});

describe('invite / accept / decline / revoke', () => {
    it('inviteUser stamps invited_at', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await inviteUser(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({ invited_at: expect.any(String) });
    });

    it('acceptInvite flips tier to trust_circle with flat rate', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await acceptInvite(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({
            partner_tier: 'trust_circle',
            trust_circle_commission_rate: TRUST_CIRCLE_FLAT_RATE,
            circle_member_since: expect.any(String),
            invited_at: null,
        });
    });

    it('declineInvite clears invited_at', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await declineInvite(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({ invited_at: null });
    });

    it('revokeMember flips back to trusted_few and clears circle fields', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await revokeMember(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({
            partner_tier: 'trusted_few',
            trust_circle_commission_rate: null,
            circle_member_since: null,
            invited_at: null,
        });
    });
});

describe('issueDropVoucher', () => {
    it('inserts a drop_vouchers ledger row', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await issueDropVoucher(USER_ID, 'DROP-AUG26');
        expect(result.success).toBe(true);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('drop_vouchers');
        expect(mockSupabase.insertSpy).toHaveBeenCalledWith([{
            member_user_id: USER_ID,
            coupon_code: 'DROP-AUG26',
            status: 'issued',
        }]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/trustCircle.test.ts 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../services/trustCircle'`.

- [ ] **Step 3: Write `services/trustCircle.ts`**

```ts
// services/trustCircle.ts
// The Trusted Few / Trust Circle partner-program data layer.
// Mirrors services/customInquiry.ts: client-side Supabase writes gated by
// RLS. Internal table names stay referral_*; only copy changes user-side.
import { supabase } from './supabase.js';

export type PartnerTier = 'trusted_few' | 'trust_circle';

export interface TrustCircleMembership {
    user_id: string;
    referral_code: string;
    partner_tier: PartnerTier;
    trust_circle_commission_rate: number | null;
    invited_at: string | null;
    circle_member_since: string | null;
}

export interface TrustCircleApplicationInput {
    whyJoin: string;
    whatYouCreate: string;
    platforms: string[];
    handles: { instagram?: string; tiktok?: string; youtube?: string; x?: string };
    audienceSize?: string;
    portfolioUrl?: string;
}

export interface TrustCircleApplication {
    id: string;
    user_id: string;
    status: 'pending' | 'approved' | 'declined';
    why_join: string;
    what_you_create: string;
    platforms: string[];
    handles: Record<string, string>;
    audience_size: string | null;
    portfolio_url: string | null;
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_note: string | null;
}

export const TRUST_CIRCLE_FLAT_RATE = 20;

// MetaMask users (uid starts with user_eth_) can't have a referral_stats row
// (user_id is a UUID FK to auth.users) — same short-circuit as referralSystem.
export async function getMembership(userId: string): Promise<TrustCircleMembership | null> {
    if (!userId || userId.startsWith('user_eth_')) return null;
    const { data, error } = await supabase
        .from('referral_stats')
        .select('user_id, referral_code, partner_tier, trust_circle_commission_rate, invited_at, circle_member_since')
        .eq('user_id', userId)
        .single();
    if (error || !data) return null;
    return data as TrustCircleMembership;
}

export async function submitApplication(
    input: TrustCircleApplicationInput,
    userId: string,
): Promise<{ success: boolean; error?: string; application?: TrustCircleApplication }> {
    if (!userId) return { success: false, error: 'Sign in to apply.' };

    // One pending application per user.
    const { data: existing } = await supabase
        .from('trust_circle_applications')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    if (existing) return { success: false, error: 'You already have a pending application.' };

    const { data, error } = await supabase
        .from('trust_circle_applications')
        .insert([{
            user_id: userId,
            status: 'pending',
            why_join: input.whyJoin,
            what_you_create: input.whatYouCreate,
            platforms: input.platforms,
            handles: input.handles,
            audience_size: input.audienceSize || null,
            portfolio_url: input.portfolioUrl || null,
        }])
        .select()
        .single();

    if (error || !data) {
        console.error('Error submitting trust circle application:', error);
        return { success: false, error: 'Failed to submit application. Please try again.' };
    }
    return { success: true, application: data as TrustCircleApplication };
}

export async function getMyApplication(userId: string): Promise<TrustCircleApplication | null> {
    if (!userId) return null;
    const { data, error } = await supabase
        .from('trust_circle_applications')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    return (data as TrustCircleApplication) || null;
}

export async function getApplications(): Promise<TrustCircleApplication[]> {
    const { data, error } = await supabase
        .from('trust_circle_applications')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching trust circle applications:', error);
        return [];
    }
    return (data as TrustCircleApplication[]) || [];
}

export async function reviewApplication(
    id: string,
    approve: boolean,
    note: string | null,
    adminId: string,
): Promise<{ success: boolean; error?: string }> {
    // 1. Stamp the application verdict.
    const { data: app, error: appError } = await supabase
        .from('trust_circle_applications')
        .update({
            status: approve ? 'approved' : 'declined',
            reviewed_at: new Date().toISOString(),
            reviewed_by: adminId || null,
            review_note: note || null,
        })
        .eq('id', id)
        .select()
        .single();
    if (appError || !app) {
        console.error('Error reviewing application:', appError);
        return { success: false, error: 'Failed to update application.' };
    }

    // 2. On approve, flip the member tier + flat rate atomically.
    if (approve) {
        const { error: statsError } = await supabase
            .from('referral_stats')
            .update({
                partner_tier: 'trust_circle',
                trust_circle_commission_rate: TRUST_CIRCLE_FLAT_RATE,
                circle_member_since: new Date().toISOString(),
            })
            .eq('user_id', app.user_id);
        if (statsError) {
            console.error('Error promoting member:', statsError);
            return { success: false, error: 'Application approved but promotion failed.' };
        }
    }
    return { success: true };
}

export async function inviteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({ invited_at: new Date().toISOString() })
        .eq('user_id', userId);
    if (error) {
        console.error('Error inviting user:', error);
        return { success: false, error: 'Failed to send invite.' };
    }
    return { success: true };
}

export async function acceptInvite(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({
            partner_tier: 'trust_circle',
            trust_circle_commission_rate: TRUST_CIRCLE_FLAT_RATE,
            circle_member_since: new Date().toISOString(),
            invited_at: null,
        })
        .eq('user_id', userId);
    if (error) {
        console.error('Error accepting invite:', error);
        return { success: false, error: 'Failed to accept invite.' };
    }
    return { success: true };
}

export async function declineInvite(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({ invited_at: null })
        .eq('user_id', userId);
    if (error) {
        console.error('Error declining invite:', error);
        return { success: false, error: 'Failed to decline invite.' };
    }
    return { success: true };
}

export async function revokeMember(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({
            partner_tier: 'trusted_few',
            trust_circle_commission_rate: null,
            circle_member_since: null,
            invited_at: null,
        })
        .eq('user_id', userId);
    if (error) {
        console.error('Error revoking member:', error);
        return { success: false, error: 'Failed to revoke membership.' };
    }
    return { success: true };
}

export async function issueDropVoucher(memberUserId: string, couponCode: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('drop_vouchers')
        .insert([{ member_user_id: memberUserId, coupon_code: couponCode, status: 'issued' }]);
    if (error) {
        console.error('Error issuing drop voucher:', error);
        return { success: false, error: 'Failed to issue voucher.' };
    }
    return { success: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/trustCircle.test.ts 2>&1 | tail -5`
Expected: PASS — all `trustCircle` tests green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "zambo-backfill" | head -10`
Expected: no new errors (only the pre-existing migration-script noise).

- [ ] **Step 6: Commit**

```bash
git add services/trustCircle.ts tests/trustCircle.test.ts
git commit -m "feat(partners): Trust Circle service layer with tier, application, invite, revoke, voucher ops"
```

---

### Task 3: Rebrand the member dashboard + retire sunset messaging

**Files:**
- Modify: `components/ReferralDashboard.tsx` (whole file — the member-facing dashboard)
- Modify: `pages/Profile.tsx` (tab label, vote banner removal, quick-access card copy)
- Create: `tests/trustedFewDashboardRender.test.tsx`

**Interfaces:**
- Consumes: `useApp()` (`{ user }`), `useToast()` (`{ addToast }`), `utils/referralSystem.ts` (`getReferralStats`, `getReferralHistory`, `generateReferralLink`, `calculateCommissionTier`, `COMMISSION_TIERS`), `utils/referralAnalytics.ts` (`getReferrerAnalytics`), `services/trustCircle.ts` from Task 2 (`getMembership`, `getMyApplication`, `submitApplication` not needed here; `acceptInvite`, `declineInvite`, `TRUST_CIRCLE_FLAT_RATE`).
- Produces: `<TrustedFewDashboard />` (default export renamed from ReferralDashboard — Profile's lazy import updates); no other module depends on the old export name.

- [ ] **Step 1: Write the failing render test**

Create `tests/trustedFewDashboardRender.test.tsx`:

```tsx
// tests/trustedFewDashboardRender.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrustedFewDashboard from '../components/ReferralDashboard';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

const MEMBER = {
    user_id: 'u1',
    referral_code: 'SG-MEMBER',
    partner_tier: 'trusted_few',
    trust_circle_commission_rate: null,
    invited_at: null,
    circle_member_since: null,
};

vi.mock('../context/AppContext', () => ({
    useApp: () => ({ user: { uid: 'u1', displayName: 'Test Member' } }),
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock('../utils/referralSystem', () => ({
    getReferralStats: vi.fn(async () => ({
        user_id: 'u1',
        referral_code: 'SG-MEMBER',
        total_referrals: 2,
        successful_referrals: 1,
        current_tier: 2,
        current_commission_rate: 10,
        total_earnings: 15,
        pending_earnings: 15,
        paid_earnings: 0,
    })),
    getReferralHistory: vi.fn(async () => []),
    generateReferralLink: vi.fn(() => 'https://sgcoalition.xyz/?ref=SG-MEMBER'),
    calculateCommissionTier: vi.fn(() => ({ tier: 2, rate: 10, nextTier: { tier: 3, rate: 15, minReferrals: 3 }, referralsToNextTier: 2, progress: 50 })),
    COMMISSION_TIERS: [],
}));
vi.mock('../utils/referralAnalytics', () => ({
    getReferrerAnalytics: vi.fn(async () => ({ clicks: 3, views: 4, signups: 1, purchases: 1, conversionRate: 33.3 })),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.setOutcomes([]);
});

describe('TrustedFewDashboard', () => {
    it('shows the Trusted Few name and NO sunset/vote banner', async () => {
        // getMembership -> trusted_few; getMyApplication -> none
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: MEMBER, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);
        render(
            <MemoryRouter>
                <TrustedFewDashboard />
            </MemoryRouter>
        );
        expect(await screen.findByText(/The Trusted Few/i)).toBeTruthy();
        expect(screen.queryByText(/scheduled to wrap/i)).toBeNull();
        expect(screen.queryByText(/Cast your vote/i)).toBeNull();
        expect(screen.queryByText(/runs through/i)).toBeNull();
        expect(await screen.findByText(/Join the Trust Circle/i)).toBeTruthy();
    });

    it('renders the invite-accept banner for invited users', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: { ...MEMBER, invited_at: '2026-08-01T00:00:00Z' }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);
        render(
            <MemoryRouter>
                <TrustedFewDashboard />
            </MemoryRouter>
        );
        expect(await screen.findByText(/invited to the Trust Circle/i)).toBeTruthy();
        expect(screen.getByText(/Accept/i)).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trustedFewDashboardRender.test.tsx 2>&1 | tail -8`
Expected: FAIL — the current dashboard shows "Referral Program", the sunset banner text ("scheduled to wrap"), and has no Trust Circle section.

- [ ] **Step 3: Rebrand `components/ReferralDashboard.tsx`**

Edit the file:

1. **Delete** the sunset block (constants `PROGRAM_SUNSET_DATE`, `VOTE_RECOMMENDED_WINDOW`, `VOTE_BLOG_SLUG`, `SUNSET_NOTICE_DISMISSED_KEY`; the `showSunsetNotice` state + `dismissSunsetNotice`; the amber banner JSX; the unused `Calendar`, `Clock`, `X`, `Link` imports if they become unused).
2. **Rename** the default export to `TrustedFewDashboard` (keep the file path; Profile's lazy import + this render test both update).
3. **Rename copy:** header "Referral Program" → "The Trusted Few"; subtitle "Earn up to 40% commission on every sale!" stays; "Your Referral Code" → "Your Partner Code"; "Recent Referrals" → "Recent Referrals" stays (it is accurate).
4. **Add the Trust Circle section** (below the header gradient card, before Earnings Stats):

```tsx
{/* Trust Circle status */}
{(function TrustCirclePanel() {
    if (trustCircleLoading) {
        return (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
                <div className="h-6 bg-gray-800 rounded w-1/2 mb-3"></div>
                <div className="h-4 bg-gray-800 rounded w-3/4"></div>
            </div>
        );
    }
    const circle = trustCircleMembership;
    if (circle?.partner_tier === 'trust_circle') {
        return (
            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl p-6 border border-emerald-500/30">
                <div className="flex items-center gap-3 mb-2">
                    <Award className="w-6 h-6 text-emerald-400" />
                    <h3 className="font-bold text-emerald-100 uppercase tracking-wide text-sm">Welcome to the Trust Circle</h3>
                </div>
                <p className="text-sm text-emerald-100/80">
                    You're on the brand team. Your commission is a flat{' '}
                    <span className="font-bold text-white">{TRUST_CIRCLE_FLAT_RATE}%</span> on every sale —
                    no ladder, no caps. Watch for drop vouchers and early-access emails.
                </p>
                <p className="text-xs text-emerald-200/60 mt-2 font-mono">
                    Member since {circle.circle_member_since ? new Date(circle.circle_member_since).toLocaleDateString() : '—'}
                </p>
            </div>
        );
    }
    if (circle?.invited_at) {
        return (
            <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-xl p-6 border border-purple-500/30">
                <div className="flex items-center gap-3 mb-2">
                    <Award className="w-6 h-6 text-purple-300" />
                    <h3 className="font-bold text-purple-100 uppercase tracking-wide text-sm">You've been invited to the Trust Circle</h3>
                </div>
                <p className="text-sm text-purple-100/80 mb-4">
                    The Coalition brand team wants you in. Accept to lock in a flat {TRUST_CIRCLE_FLAT_RATE}% rate,
                    free drops, and early access.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={handleAcceptInvite}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold transition"
                    >
                        Accept
                    </button>
                    <button
                        onClick={handleDeclineInvite}
                        className="px-6 py-2 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10 transition"
                    >
                        Decline
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-purple-400" />
                        Join the Trust Circle
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        The Coalition brand team — flat {TRUST_CIRCLE_FLAT_RATE}% commission, free drops, early access.
                        Invite-only, or apply and let us see your work.
                    </p>
                </div>
                <Link
                    to="/trust-circle"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-2.5 rounded-lg font-bold uppercase tracking-wider transition"
                >
                    Apply
                </Link>
            </div>
        </div>
    );
})()}
```

5. **Wire the Trust Circle state** at the top of the component:

```tsx
const [trustCircleMembership, setTrustCircleMembership] = useState<TrustCircleMembership | null>(null);
const [trustCircleLoading, setTrustCircleLoading] = useState(true);

useEffect(() => {
    if (user) {
        void (async () => {
            const [membership] = await Promise.all([
                getMembership(user.uid),
                getMyApplication(user.uid),
            ]);
            setTrustCircleMembership(membership);
            setTrustCircleLoading(false);
        })();
    }
}, [user]);

const handleAcceptInvite = async () => {
    if (!user) return;
    const result = await acceptInvite(user.uid);
    if (result.success) {
        addToast('Welcome to the Trust Circle!', 'success');
        setTrustCircleMembership(await getMembership(user.uid));
    } else {
        addToast(result.error || 'Could not accept invite.', 'error');
    }
};

const handleDeclineInvite = async () => {
    if (!user) return;
    const result = await declineInvite(user.uid);
    if (result.success) {
        addToast('Invite declined.', 'success');
        setTrustCircleMembership(await getMembership(user.uid));
    } else {
        addToast(result.error || 'Could not decline invite.', 'error');
    }
};
```

Add imports: `Award` is already imported; add `getMembership, getMyApplication, acceptInvite, declineInvite, TRUST_CIRCLE_FLAT_RATE, type TrustCircleMembership` from `../services/trustCircle`.

- [ ] **Step 4: Update `pages/Profile.tsx`**

1. Lazy import: `const TrustedFewDashboard = React.lazy(() => import('../components/ReferralDashboard'));` (rename the const; component keeps its file path).
2. Render site: replace `<ReferralDashboard />` with `<TrustedFewDashboard />`.
3. Tab button: title `"Referrals"` → `"Partner Program"`, aria-label `"Referrals"` → `"Partner Program"`, visible label `"Referrals"` → `"Partner Program"` (keep the `DollarSign` icon).
4. **Delete** the amber "Continue referrals in 2027?" banner `<Link>` block and the now-unused `Vote` import from lucide-react.
5. Quick-access header card: label `Referral Code` → `Partner Code`, title `Copy referral link` → `Copy partner link`, subcopy `Click to manage →` stays.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/trustedFewDashboardRender.test.tsx tests/referralFlows.test.ts 2>&1 | tail -8`
Expected: PASS — new dashboard test green, referral engine untouched.

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "zambo-backfill" | head -10`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/ReferralDashboard.tsx pages/Profile.tsx tests/trustedFewDashboardRender.test.tsx
git commit -m "feat(partners): rebrand dashboard to The Trusted Few, retire sunset/vote messaging, add Trust Circle panel"
```

---

### Task 4: `/trust-circle` application page

**Files:**
- Create: `pages/TrustCircle.tsx`
- Modify: `App.tsx` (route + import)

**Interfaces:**
- Consumes: `useApp()` (`{ user }`), `useToast()` (`{ addToast }`), `services/trustCircle.ts` (`submitApplication`, `getMyApplication`, `getMembership`, types).
- Produces: `<TrustCircle />` default-export page; route `/trust-circle`.

- [ ] **Step 1: Write the failing page test**

Create `tests/trustCirclePage.test.tsx`:

```tsx
// tests/trustCirclePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrustCircle from '../pages/TrustCircle';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));
vi.mock('../context/AppContext', () => ({
    useApp: () => ({ user: { uid: 'u1', displayName: 'Tester' } }),
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock('../services/trustCircle', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/trustCircle')>();
    return {
        ...actual,
        getMyApplication: vi.fn(async () => null),
        getMembership: vi.fn(async () => null),
        submitApplication: vi.fn(async () => ({ success: true })),
    };
});

beforeEach(() => vi.clearAllMocks());

describe('TrustCircle application page', () => {
    it('renders the brand-voice form and submits', async () => {
        render(
            <MemoryRouter>
                <TrustCircle />
            </MemoryRouter>
        );
        expect(screen.getByText(/why do you want in/i)).toBeTruthy();

        fireEvent.change(screen.getByLabelText(/Why do you want in\?/i), { target: { value: 'I rep the city' } });
        fireEvent.change(screen.getByLabelText(/What do you create\?/i), { target: { value: 'Fit content' } });
        fireEvent.change(screen.getByLabelText(/Instagram handle/i), { target: { value: '@sg_rep' } });
        fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

        await waitFor(() => {
            expect(screen.getByText(/application received/i)).toBeTruthy();
        });
    });

    it('shows existing pending application state', async () => {
        const { getMyApplication } = await import('../services/trustCircle');
        vi.mocked(getMyApplication).mockResolvedValue({
            id: 'app-1',
            user_id: 'u1',
            status: 'pending',
            why_join: 'x',
            what_you_create: 'y',
            platforms: ['instagram'],
            handles: {},
            audience_size: null,
            portfolio_url: null,
            created_at: '2026-08-01T00:00:00Z',
            reviewed_at: null,
            reviewed_by: null,
            review_note: null,
        } as any);
        render(
            <MemoryRouter>
                <TrustCircle />
            </MemoryRouter>
        );
        expect(await screen.findByText(/already under review/i)).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trustCirclePage.test.tsx 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../pages/TrustCircle'`.

- [ ] **Step 3: Write `pages/TrustCircle.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, Instagram, Youtube, Music2, AtSign } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
    submitApplication,
    getMyApplication,
    TRUST_CIRCLE_FLAT_RATE,
    type TrustCircleApplication,
} from '../services/trustCircle';

// Brand-voice application form for the Trust Circle (branding team).
// Copy is intentionally informal — "Trust Yourself" energy, not legalese.
const TrustCircle: React.FC = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [existing, setExisting] = useState<TrustCircleApplication | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [form, setForm] = useState({
        whyJoin: '',
        whatYouCreate: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        x: '',
        audienceSize: '',
        portfolioUrl: '',
    });

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        getMyApplication(user.uid).then((app) => {
            setExisting(app);
            setLoading(false);
        });
    }, [user]);

    if (!user) {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4 text-center">
                <Award className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h1 className="font-display text-3xl font-bold uppercase mb-3">Sign in to apply</h1>
                <p className="text-gray-500">The Trust Circle is for the ones who rep the brand — sign in to show us what you've got.</p>
                <Link to="/login" className="inline-block mt-6 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                    Sign In
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-64 bg-gray-200 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (existing?.status === 'pending') {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h1 className="font-display text-3xl font-bold uppercase mb-3">Application already under review</h1>
                <p className="text-gray-500">
                    We've got your application. The brand team reviews every one — you'll hear back here.
                    In the meantime, keep stacking those commissions with The Trusted Few.
                </p>
                <Link to="/profile" className="inline-block mt-6 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                    Back to my profile
                </Link>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h1 className="font-display text-3xl font-bold uppercase mb-3">Application received</h1>
                <p className="text-gray-500">
                    That's it. We review every application personally — give us a little time.
                    You'll stay a member of The Trusted Few meanwhile, so your code keeps earning.
                </p>
                <Link to="/profile" className="inline-block mt-6 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                    Back to my profile
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await submitApplication(
            {
                whyJoin: form.whyJoin,
                whatYouCreate: form.whatYouCreate,
                platforms: ['instagram', 'tiktok', 'youtube', 'x'].filter((p) => (form as Record<string, string>)[p]),
                handles: {
                    instagram: form.instagram || undefined,
                    tiktok: form.tiktok || undefined,
                    youtube: form.youtube || undefined,
                    x: form.x || undefined,
                },
                audienceSize: form.audienceSize || undefined,
                portfolioUrl: form.portfolioUrl || undefined,
            },
            user.uid,
        );
        if (result.success) {
            setSubmitted(true);
            addToast('Application received — we review every one personally.', 'success');
        } else {
            addToast(result.error || 'Failed to submit. Please try again.', 'error');
        }
    };

    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    return (
        <div className="pt-24 pb-20 max-w-2xl mx-auto px-4">
            <div className="text-center mb-10">
                <Award className="w-14 h-14 text-purple-500 mx-auto mb-4" />
                <h1 className="font-display text-4xl font-bold uppercase mb-3">Join the Trust Circle</h1>
                <p className="text-gray-500 max-w-lg mx-auto">
                    The Coalition brand team. Flat {TRUST_CIRCLE_FLAT_RATE}% commission on every sale you bring,
                    free product on drops, early access. This isn't a signup sheet — it's a handshake.
                    Tell us why you deserve a seat.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
                <div>
                    <label htmlFor="whyJoin" className="block text-sm font-bold text-gray-800 mb-1.5">Why do you want in?</label>
                    <textarea
                        id="whyJoin"
                        required
                        rows={3}
                        value={form.whyJoin}
                        onChange={set('whyJoin')}
                        placeholder="What does Coalition mean to you? Why the Trust Circle?"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label htmlFor="whatYouCreate" className="block text-sm font-bold text-gray-800 mb-1.5">What do you create?</label>
                    <textarea
                        id="whatYouCreate"
                        required
                        rows={2}
                        value={form.whatYouCreate}
                        onChange={set('whatYouCreate')}
                        placeholder="Fits? Content? Photography? Art? Show your lane."
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="instagram" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <Instagram className="w-4 h-4" /> Instagram handle
                        </label>
                        <input id="instagram" value={form.instagram} onChange={set('instagram')} placeholder="@you" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="tiktok" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <Music2 className="w-4 h-4" /> TikTok handle
                        </label>
                        <input id="tiktok" value={form.tiktok} onChange={set('tiktok')} placeholder="@you" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="youtube" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <Youtube className="w-4 h-4" /> YouTube
                        </label>
                        <input id="youtube" value={form.youtube} onChange={set('youtube')} placeholder="channel URL or @handle" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="x" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <AtSign className="w-4 h-4" /> X / Twitter
                        </label>
                        <input id="x" value={form.x} onChange={set('x')} placeholder="@you" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="audienceSize" className="block text-sm font-bold text-gray-800 mb-1.5">Audience size</label>
                        <input id="audienceSize" value={form.audienceSize} onChange={set('audienceSize')} placeholder="e.g. 10k on TikTok" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="portfolioUrl" className="block text-sm font-bold text-gray-800 mb-1.5">Link to your work</label>
                        <input id="portfolioUrl" type="url" value={form.portfolioUrl} onChange={set('portfolioUrl')} placeholder="https://…" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-4 rounded-lg font-bold uppercase tracking-widest transition"
                >
                    Submit Application
                </button>
                <p className="text-xs text-gray-400 text-center">
                    We auto-attach your order history and referral stats — no need to list them.
                </p>
            </form>
        </div>
    );
};

export default TrustCircle;
```

- [ ] **Step 4: Register the route in `App.tsx`**

1. Add near the other page imports (around line 178): `import TrustCircle from './pages/TrustCircle';`
2. Add after the `/profile` route (line 189): `<Route path="/trust-circle" element={<TrustCircle />} />`

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/trustCirclePage.test.tsx 2>&1 | tail -5`
Expected: PASS.

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "zambo-backfill" | head -10`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add pages/TrustCircle.tsx App.tsx tests/trustCirclePage.test.tsx
git commit -m "feat(partners): Trust Circle application page with brand-voice form"
```

---

### Task 5: Admin Trust Circle manager

**Files:**
- Create: `components/admin/TrustCircleManager.tsx`
- Modify: `pages/Admin.tsx` (tab union + case + lazy import)
- Modify: `components/admin/AdminLayout.tsx` (tab union + nav item)

**Interfaces:**
- Consumes: `services/trustCircle.ts` from Task 2 (`getApplications`, `reviewApplication`, `inviteUser`, `revokeMember`, `getMembership`, `issueDropVoucher`), `supabase` from `../../services/supabase.js` (coupon insert + user search), `useApp()` (`{ user }` for admin id), `useToast()`.
- Produces: `<TrustCircleManager />` default export; new admin tab id `'trust-circle'` added to both union types in Admin.tsx and AdminLayout.tsx.

- [ ] **Step 1: Write the failing admin render test**

Create `tests/trustCircleManagerRender.test.tsx`:

```tsx
// tests/trustCircleManagerRender.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrustCircleManager from '../components/admin/TrustCircleManager';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));
vi.mock('../../context/AppContext', () => ({
    useApp: () => ({ user: { uid: 'admin-1' } }),
}));
vi.mock('../../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock('../../services/trustCircle', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/trustCircle')>();
    return {
        ...actual,
        getApplications: vi.fn(async () => [
            {
                id: 'app-1',
                user_id: 'u1',
                status: 'pending',
                why_join: 'I rep Baltimore',
                what_you_create: 'Fits',
                platforms: ['instagram'],
                handles: { instagram: '@rep' },
                audience_size: '10k',
                portfolio_url: null,
                created_at: '2026-08-01T00:00:00Z',
                reviewed_at: null,
                reviewed_by: null,
                review_note: null,
            },
        ]),
        reviewApplication: vi.fn(async () => ({ success: true })),
        inviteUser: vi.fn(async () => ({ success: true })),
        revokeMember: vi.fn(async () => ({ success: true })),
    };
});

beforeEach(() => vi.clearAllMocks());

describe('TrustCircleManager', () => {
    it('lists pending applications and approves one', async () => {
        render(<TrustCircleManager />);
        expect(await screen.findByText(/I rep Baltimore/i)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /approve/i }));
        await waitFor(() => {
            const { reviewApplication } = vi.mocked(require('../../services/trustCircle'));
            expect(reviewApplication).toHaveBeenCalledWith('app-1', true, expect.anything(), 'admin-1');
        });
    });

    it('shows the invite and members sections', async () => {
        render(<TrustCircleManager />);
        expect(screen.getByText(/Invite to Trust Circle/i)).toBeTruthy();
        expect(screen.getByText(/Current Members/i)).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trustCircleManagerRender.test.tsx 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../components/admin/TrustCircleManager'`.

- [ ] **Step 3: Write `components/admin/TrustCircleManager.tsx`**

The component below enriches each pending application with the applicant's lifetime order count + spend (from `profiles.lifetime_orders` / `profiles.lifetime_spend_usd` — the same stats `updateLifetimeStats` maintains) plus their referral code, so the vetting view matches the spec's "order history + referral stats inline" promise. The `fetchApplicantContext` helper runs one batched `profiles` query for all pending applicant ids.

```tsx
import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, XCircle, Search, Send, Trash2, Ticket } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../services/supabase';
import {
    getApplications,
    reviewApplication,
    inviteUser,
    revokeMember,
    issueDropVoucher,
    TRUST_CIRCLE_FLAT_RATE,
    type TrustCircleApplication,
} from '../../services/trustCircle';

interface CircleMemberRow {
    user_id: string;
    referral_code: string;
    partner_tier: string;
    trust_circle_commission_rate: number | null;
    circle_member_since: string | null;
    email?: string;
}

interface ApplicantContext {
    id: string;
    email?: string;
    full_name?: string;
    lifetime_orders?: number | null;
    lifetime_spend_usd?: number | null;
}

const TrustCircleManager: React.FC = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [applications, setApplications] = useState<TrustCircleApplication[]>([]);
    const [members, setMembers] = useState<CircleMemberRow[]>([]);
    const [applicantContext, setApplicantContext] = useState<ApplicantContext[]>([]);
    const [searchEmail, setSearchEmail] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [busy, setBusy] = useState<string | null>(null);

    // Batch-fetch lifetime order stats for the pending applicants so the
    // vetting view shows real-customer context (order count + spend) inline.
    const fetchApplicantContext = async (apps: TrustCircleApplication[]) => {
        const pendingIds = apps.filter(a => a.status === 'pending').map(a => a.user_id);
        if (pendingIds.length === 0) return;
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, lifetime_orders, lifetime_spend_usd, email, full_name')
            .in('id', pendingIds);
        if (profiles) setApplicantContext(profiles as ApplicantContext[]);
    };

    const reload = async () => {
        const apps = await getApplications();
        setApplications(apps);
        void fetchApplicantContext(apps);
        const { data } = await supabase
            .from('referral_stats')
            .select('user_id, referral_code, partner_tier, trust_circle_commission_rate, circle_member_since')
            .eq('partner_tier', 'trust_circle');
        setMembers((data as CircleMemberRow[]) || []);
    };

    useEffect(() => { void reload(); }, []);

    const handleApprove = async (app: TrustCircleApplication) => {
        setBusy(app.id);
        const result = await reviewApplication(app.id, true, '', user?.uid || '');
        if (result.success) addToast(`${app.user_id} joined the Trust Circle.`, 'success');
        else addToast(result.error || 'Approval failed.', 'error');
        await reload();
        setBusy(null);
    };

    const handleDecline = async (app: TrustCircleApplication) => {
        setBusy(app.id);
        const result = await reviewApplication(app.id, false, '', user?.uid || '');
        if (result.success) addToast('Application declined.', 'success');
        else addToast(result.error || 'Decline failed.', 'error');
        await reload();
        setBusy(null);
    };

    const handleInvite = async () => {
        if (!searchResult) return;
        const result = await inviteUser(searchResult.id);
        if (result.success) addToast(`Invited ${searchResult.email}.`, 'success');
        else addToast(result.error || 'Invite failed.', 'error');
    };

    const handleRevoke = async (userId: string) => {
        const result = await revokeMember(userId);
        if (result.success) addToast('Membership revoked.', 'success');
        else addToast(result.error || 'Revoke failed.', 'error');
        await reload();
    };

    const handleDropVoucher = async (member: CircleMemberRow) => {
        const code = `DROP-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
        const { error } = await supabase.from('coupons').insert({
            code,
            discount_type: 'percent',
            discount_value: 100,
            min_order_value: 0,
            max_uses: 1,
            is_active: true,
        });
        if (error) { addToast('Coupon creation failed.', 'error'); return; }
        const result = await issueDropVoucher(member.user_id, code);
        if (result.success) addToast(`Drop voucher ${code} issued.`, 'success');
        else addToast(result.error || 'Voucher ledger failed.', 'error');
    };

    const searchUser = async () => {
        if (!searchEmail.trim()) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .ilike('email', `%${searchEmail.trim()}%`)
            .limit(5);
        if (error) { addToast('Search failed.', 'error'); return; }
        setSearchResult(data?.[0] || null);
        if (!data?.length) addToast('No user found.', 'error');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-purple-400" />
                <div>
                    <h2 className="text-xl font-bold text-white">Trust Circle</h2>
                    <p className="text-gray-400 text-sm">Brand team — flat {TRUST_CIRCLE_FLAT_RATE}% rate, free drops, early access.</p>
                </div>
            </div>

            {/* Applications queue */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Applications</h3>
                {applications.filter(a => a.status === 'pending').length === 0 ? (
                    <p className="text-gray-500 text-sm">No pending applications.</p>
                ) : (
                    <div className="space-y-4">
                        {applications.filter(a => a.status === 'pending').map((app) => (
                            <div key={app.id} className="bg-black/30 border border-white/10 rounded-lg p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-bold text-white">{app.why_join}</p>
                                        <p className="text-sm text-gray-400 mt-1">{app.what_you_create}</p>
                                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                            <span className="text-gray-500">{app.platforms.join(', ') || '—'}</span>
                                            {app.handles && Object.entries(app.handles).map(([k, v]) => (
                                                <span key={k} className="text-purple-300">{k}: {String(v)}</span>
                                            ))}
                                            {app.audience_size && <span className="text-emerald-400">{app.audience_size}</span>}
                                        </div>
                                        {app.portfolio_url && (
                                            <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer"
                                               className="text-xs text-blue-400 underline mt-1 inline-block">{app.portfolio_url}</a>
                                        )}
                                        {/* Inline customer context from the batched profiles fetch */}
                                        {(() => {
                                            const ctx = applicantContext.find(c => c.id === app.user_id);
                                            return ctx ? (
                                                <p className="text-[11px] text-gray-400 mt-2">
                                                    {ctx.email || 'No email on file'} · {ctx.lifetime_orders ?? 0} orders ·
                                                    ${(ctx.lifetime_spend_usd ?? 0).toFixed(2)} lifetime spend
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-gray-600 mt-2 font-mono">User: {app.user_id}</p>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex flex-col gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleApprove(app)}
                                            disabled={busy === app.id}
                                            className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition"
                                        >
                                            {busy === app.id ? '…' : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve</>}
                                        </button>
                                        <button
                                            onClick={() => handleDecline(app)}
                                            disabled={busy === app.id}
                                            className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500/20 transition"
                                        >
                                            <XCircle className="w-3.5 h-3.5" /> Decline
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Invite */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Send className="w-4 h-4" /> Invite to Trust Circle</h3>
                <div className="flex gap-2">
                    <input
                        value={searchEmail}
                        onChange={e => setSearchEmail(e.target.value)}
                        placeholder="Search by email…"
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                    />
                    <button onClick={searchUser} className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-gray-200 transition">
                        <Search className="w-4 h-4" /> Search
                    </button>
                    {searchResult && (
                        <button onClick={handleInvite} className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-purple-600 transition">
                            <Send className="w-4 h-4" /> Invite {searchResult.email}
                        </button>
                    )}
                </div>
            </div>

            {/* Members */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Current Members</h3>
                {members.length === 0 ? (
                    <p className="text-gray-500 text-sm">No Trust Circle members yet.</p>
                ) : (
                    <div className="space-y-3">
                        {members.map((m) => (
                            <div key={m.user_id} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-4 py-3">
                                <div>
                                    <p className="text-sm font-bold text-white font-mono">{m.referral_code}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{m.user_id}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-emerald-400 font-bold">{m.trust_circle_commission_rate ?? TRUST_CIRCLE_FLAT_RATE}%</span>
                                    <button
                                        onClick={() => handleDropVoucher(m)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition"
                                        title="Issue 100%-off drop voucher"
                                    >
                                        <Ticket className="w-3.5 h-3.5" /> Drop
                                    </button>
                                    <button
                                        onClick={() => handleRevoke(m.user_id)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrustCircleManager;
```

- [ ] **Step 4: Wire the admin tab**

**`pages/Admin.tsx`:**

1. Add to the lazy imports: `const TrustCircleManager = lazy(() => import('../components/admin/TrustCircleManager'));`
2. Add `'trust-circle'` to the `activeTab` union type (after `'customer-profile'`).
3. Add a case:
```tsx
case 'trust-circle':
    return <TrustCircleManager />;
```

**`components/admin/AdminLayout.tsx`:**

1. Add `'trust-circle'` to both the `activeTab` prop union and the `onTabChange` union.
2. Add a nav item in the **Community** group (after `customer-profile`):
```tsx
{ id: 'trust-circle', label: 'Trust Circle', icon: Award },
```
3. Add `Award` to the lucide-react import list.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/trustCircleManagerRender.test.tsx 2>&1 | tail -5`
Expected: PASS.

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "zambo-backfill" | head -10`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/admin/TrustCircleManager.tsx pages/Admin.tsx components/admin/AdminLayout.tsx tests/trustCircleManagerRender.test.tsx
git commit -m "feat(admin): Trust Circle manager — application review, invites, member list, drop vouchers"
```

---

### Task 6: Copy sweep across the storefront

**Files:**
- Modify: `pages/OrderSuccess.tsx` (referral CTA copy)
- Modify: `pages/ProductDetails.tsx` (share tooltip copy)
- Modify: `pages/Ecosystem.tsx` ("Referral Synthesis" card)
- Modify: `README.md` (referral program section notes) and `FOLLOWUPS.md` (sunset notes)

**Interfaces:**
- Consumes: nothing new — pure copy edits; no behavior change.

- [ ] **Step 1: Update post-purchase CTA copy in `pages/OrderSuccess.tsx`**

Edit the referral CTA block (~line 481):
- `Earn commission on every referral sale` → `Earn commission with The Trusted Few`
- `title="Copy referral link"` → `title="Copy partner link"`
- Keep all behavior (`getReferralStats`, `generateReferralLink`, `trackReferralShare`).

- [ ] **Step 2: Update share tooltip copy in `pages/ProductDetails.tsx`**

- `title={referralCode ? 'Share your referral product link and earn commission' : 'Share Product'}` → `title={referralCode ? 'Share your partner link and earn commission' : 'Share Product'}`
- `shareText` string: `This link includes my Coalition referral code if you decide to pick it up.` → `This link includes my Coalition partner code if you decide to pick it up.`

- [ ] **Step 3: Update `pages/Ecosystem.tsx` feature card**

- `{ icon: <DollarSign />, title: 'Referral Synthesis', desc: 'Up to 40% commissions on physical-digital hybrid bridge sales.', ... }` → `{ icon: <DollarSign />, title: 'The Trusted Few', desc: 'Partner commissions from 5% to 40% on every sale you bring in.', ... }`

- [ ] **Step 4: Update docs**

`README.md` (~line 1384 area): rename "The Coalition referral program" references to "The Coalition partner program (The Trusted Few)" and remove the sunset-banner bullet (~line 1420).
`FOLLOWUPS.md` (line 63): replace the sunset-banner paragraph with: "The Trusted Few partner program replaced the sunsetting referral program; the sunset banner and vote messaging were removed from `components/ReferralDashboard.tsx`."

- [ ] **Step 5: Typecheck + spot-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "zambo-backfill" | head -10`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add pages/OrderSuccess.tsx pages/ProductDetails.tsx pages/Ecosystem.tsx README.md FOLLOWUPS.md
git commit -m "chore(partners): sweep referral copy to The Trusted Few branding across storefront and docs"
```

---

### Task 7: Full verification + review

**Files:** none — validation only.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -8`
Expected: all suites pass (previous baseline 665 + new `trustCircle`, `trustedFewDashboardRender`, `trustCirclePage`, `trustCircleManagerRender`).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "zambo-backfill" | head -10`
Expected: no new errors beyond the known pre-existing `applyPaymentSettingsMigration` pg noise.

- [ ] **Step 3: Grep for leftover sunset/vote copy**

Run: `grep -rniE "sunset|2027|cast your vote|runs through" pages/Profile.tsx components/ReferralDashboard.tsx README.md FOLLOWUPS.md | head -10`
Expected: only the FOLLOWUPS replacement note (which mentions the word "sunset" once) — no user-facing banner code.

- [ ] **Step 4: Code review**

Run the `requesting-code-review` skill or a reviewer agent on the diff of Tasks 2–5, focusing on: RLS policy names matching services, the RPC's Trust Circle branch not altering Trusted Few behavior, `reviewApplication` atomicity (app stamp then tier flip), and the one-pending-application guard.

- [ ] **Step 5: Final commit any review fixes**

```bash
git add -A
git commit -m "chore(partners): review fixes"
```
(only if the review produced changes — never commit unrelated pre-existing working-tree files; stage only files touched by this plan.)
