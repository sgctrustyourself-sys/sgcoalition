-- Referral Program 2027 Referendum -- seed the community vote post.
--
-- Mirrors data/blogPosts.ts -> blogFallbackPosts entry
--   id:   'blog-referendum-referral-program-2027'
--   slug: 'referendum-referral-program-2027'
-- so the post exists in production. Blog.tsx queries the `posts` table
-- first and only falls back to blogFallbackPosts when the table is empty,
-- so without this row the post would never show up in deployed envs.
--
-- IDEMPOTENT: ON CONFLICT (slug) DO UPDATE refreshes content/excerpt/tags/
-- title without touching `id`, `upvote_power`, or `downvote_power`. Re-
-- running this migration after edits to the body copy is safe.
--
-- Required schema (already present in production):
--   posts(id, title, slug UNIQUE, content, excerpt, author, author_id,
--         category, cover_image, tags text[], is_published,
--         upvote_power, downvote_power, created_at, updated_at, published_at)

INSERT INTO posts (
    id,
    title,
    slug,
    content,
    excerpt,
    author,
    category,
    cover_image,
    tags,
    is_published,
    upvote_power,
    downvote_power,
    created_at,
    updated_at,
    published_at
) VALUES (
    'blog-referendum-referral-program-2027',
    'CONTINUE THE COALITION REFERRAL PROGRAM IN 2027?',
    'referendum-referral-program-2027',
    '<h2>THE QUESTION</h2>

<p><strong>Should the Coalition referral program continue into 2027, or sunset for the year on December 31, 2026?</strong></p>

<p>Vote below. <strong>Upvote = continue the program into 2027.</strong> <strong>Downvote = sunset it for the year.</strong> Vote weight is your SGCoin v2 governance power at the time the vote is tallied.</p>

<h2>WHERE THE PROGRAM IS TODAY</h2>

<p>The referral program was reimplemented this session with a cleaner tier table and a hardened backend. Here is the current state the community is being asked to ratify (or sunset):</p>

<h3>Commission Tiers</h3>

<p>The first successful sale now immediately bumps a referrer from 5% to 10% &mdash; no more waiting for a second sale to unlock Tier 2.</p>

<ul>
<li><strong>Tier 1</strong> &mdash; 0 sales &mdash; 5% commission</li>
<li><strong>Tier 2</strong> &mdash; 1&ndash;2 sales &mdash; 10%</li>
<li><strong>Tier 3</strong> &mdash; 3&ndash;6 sales &mdash; 15%</li>
<li><strong>Tier 4</strong> &mdash; 7&ndash;14 sales &mdash; 20%</li>
<li><strong>Tier 5</strong> &mdash; 15&ndash;29 sales &mdash; 25%</li>
<li><strong>Tier 6</strong> &mdash; 30&ndash;49 sales &mdash; 30%</li>
<li><strong>Tier 7</strong> &mdash; 50&ndash;99 sales &mdash; 35%</li>
<li><strong>Tier 8</strong> &mdash; 100+ sales &mdash; 40%</li>
</ul>

<h3>Anti-Fraud Hardening</h3>

<ul>
<li><strong>Self-referral block</strong> at three layers: the coupon input, the client <code>trackReferral</code> function, and the server-side <code>track_referral_event</code> RPC.</li>
<li><strong>IP capture</strong> on every event (with a planned /24 truncation for GDPR compliance before any EU user is exposed to the new column).</li>
<li><strong>Atomic tier recompute</strong> in the RPC so the displayed rate is canonical &mdash; no client/server drift.</li>
<li><strong>22 reserved words</strong> for custom referral codes (ADMIN, SUPPORT, STAFF, HELP, INFO, etc.) so brand names cannot be squatted.</li>
<li><strong>Uniqueness RPC</strong> for code-claim validation with a reserved-prefix regex (blocks <code>ADMIN-</code>, <code>STAFF-</code>, <code>SUPPORT-</code>, <code>TEST-</code> prefixes).</li>
</ul>

<h3>Earnings Accounting Fix</h3>

<p>The dashboard''s "Total Earnings" no longer double-counts the same set of referrals as "Pending Earnings" &mdash; pending vs paid now means what it says.</p>

<h2>HOW THE VOTE WORKS</h2>

<ul>
<li>One vote per user, weighted by your <strong>SGCoin v2 balance</strong> at the time the vote is tallied.</li>
<li>You can change your vote any time before the operator closes the vote.</li>
<li>Recommended vote window: <strong>December 15&ndash;22, 2026</strong>. The operator will close the vote before December 31 so results land in time.</li>
<li><strong>If the vote favors continuing:</strong> the program continues into 2027. The dashboard banner auto-stales and can be removed in a follow-up commit. No code change needed.</li>
<li><strong>If the vote favors sunset:</strong> a hard cutoff is added to the <code>track_referral_event</code> RPC and <code>validateCouponCode</code> so new signups after December 31, 2026 do not attribute to any code. Pending commissions earned before the cutoff still pay out.</li>
</ul>

<h2>KEY DATES</h2>

<ul>
<li><strong>July 11, 2026</strong> &mdash; this referendum is published. Voting is open.</li>
<li><strong>December 15&ndash;22, 2026</strong> &mdash; recommended vote window.</li>
<li><strong>December 31, 2026</strong> &mdash; program runs through this date regardless of the vote outcome.</li>
</ul>

<p>Make your voice heard. The community decides.</p>',
    'Community referendum on whether the Coalition referral program (tiered 5%–40% commissions with anti-fraud hardening) continues into 2027 or sunsets for the year on December 31, 2026. Vote weighted by SGCoin v2 governance power.',
    'Coalition Governance',
    'announcement',
    NULL,
    ARRAY['referral', 'governance', 'referendum', 'vote', 'coalition', '2027']::text[],
    TRUE,
    0,
    0,
    '2026-07-11T16:00:00.000Z'::timestamptz,
    '2026-07-11T16:00:00.000Z'::timestamptz,
    '2026-07-11T16:00:00.000Z'::timestamptz
)
ON CONFLICT (slug) DO UPDATE SET
    title       = EXCLUDED.title,
    content     = EXCLUDED.content,
    excerpt     = EXCLUDED.excerpt,
    author      = EXCLUDED.author,
    category    = EXCLUDED.category,
    cover_image = EXCLUDED.cover_image,
    tags        = EXCLUDED.tags,
    is_published = EXCLUDED.is_published,
    updated_at  = EXCLUDED.updated_at,
    published_at = EXCLUDED.published_at
-- NOTE: `id`, `upvote_power`, and `downvote_power` are intentionally
-- NOT in the UPDATE list. Re-running this migration must preserve any
-- votes that have already been cast against this post (post_votes.post_id
-- is a foreign key into posts.id, and the existing vote totals on the
-- post row were summed from those votes at last refresh).
;

DO $$
BEGIN
    RAISE NOTICE 'Referendum post seeded/refreshed: slug=referendum-referral-program-2027 id=blog-referendum-referral-program-2027';
END $$;
