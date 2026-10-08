import { BlogPost } from '../types';
import { resolveLocalImageUrl, rewriteImageSrcs } from '../utils/localImageAssets';

const DEFAULT_PUBLISHED_AT = '2026-03-08T16:00:00.000Z';

const TRUST_YOURSELF_REMOTE_CONTENT = `
<img src="https://i.imgur.com/iYBlwm8.png" alt="Trust Yourself Custom Trucker Hat - Front View" style="width:100%;border-radius:16px;margin-bottom:24px;" />

This piece is more than just a hat - it is a statement of identity and craftsmanship.

<h2>THE VISION</h2>

I wanted to create something that felt both tactile and digital. The "TRUST YOURSELF" 3D puff embroidery is the centerpiece, creating a silhouette that stands out in any light. But the real magic is in the details.

<img src="https://i.imgur.com/jwnVHoI.png" alt="Trust Yourself Hat - Close-up Detail" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE DETAILS</h2>

<ul>
<li><strong>D20 Precision</strong>: We've embedded a custom red D20 pin into the mesh, a nod to the RNG and strategy that drives the Coalition.</li>
<li><strong>Distressed to Perfection</strong>: Every tear and fray on the brim was hand-worked to ensure no two pieces ever feel the same.</li>
<li><strong>3D Texture</strong>: The foam front provides the perfect canvas for our signature high-density puff print.</li>
</ul>

<img src="https://i.imgur.com/YNiTSFA.png" alt="Trust Yourself Hat - Side Profile" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE CRAFT</h2>

Every 1/1 starts as a blank trucker and gets built by hand. The embroidery is punched with custom stitch files to get that aggressive 3D puff. The distressing is all manual - no shortcuts, no templates.

<img src="https://i.imgur.com/HqcoV24.png" alt="Trust Yourself Hat - Back Detail" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>SOLD OUT</h2>

This specific 1/1 has already found its home, but it serves as a prototype for the next evolution of Coalition headwear. Stay tuned to the network for the next drop.

<img src="https://i.imgur.com/6179VgH.png" alt="Trust Yourself Hat - Full Display" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<em>Trust the process. Trust yourself.</em>
`.trim();

const TRUE_RELIGION_REMOTE_CONTENT = `
<img src="https://i.imgur.com/2VU7MEr.jpg" alt="Coalition x True Religion Jeans Front View" style="width:100%;border-radius:16px;margin-bottom:24px;" />

The Coalition x True Religion 1/1 jeans are the archive chapter of the lineup. We wanted the first denim story to feel collectible, wearable, and unmistakably Coalition.

<h2>SEASON 1 DETAILS</h2>

<ul>
<li><strong>One-of-one construction</strong> with custom distressing.</li>
<li><strong>Premium denim silhouette</strong> tuned for a stacked fit.</li>
<li><strong>Hand-finished details</strong> that keep the pair personal.</li>
</ul>

<img src="https://i.imgur.com/hJgvL2K.jpg" alt="Coalition x True Religion Jeans Detail 1" style="width:100%;border-radius:16px;margin-bottom:24px;" />
<img src="https://i.imgur.com/EsvBcv4.jpg" alt="Coalition x True Religion Jeans Detail 2" style="width:100%;border-radius:16px;margin-bottom:24px;" />
<img src="https://i.imgur.com/J9EmRZq.jpg" alt="Coalition x True Religion Jeans Detail 3" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>WHY IT MATTERS</h2>

This release pushed the line beyond tees and hats and into a full wardrobe story. It is the kind of piece that sets the tone for the next wave of Coalition drops.

One pair. One season. Once it is gone, it is gone.
`.trim();

const REFERENDUM_PUBLISHED_AT = '2026-07-11T16:00:00.000Z';
const REFERENDUM_SLUG = 'referendum-referral-program-2027';
const REFERENDUM_TAGS = ['referral', 'governance', 'referendum', 'vote', 'coalition', '2027'];

const REFERENDUM_REMOTE_CONTENT = `
<h2>THE QUESTION</h2>

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

<p>The dashboard's "Total Earnings" no longer double-counts the same set of referrals as "Pending Earnings" &mdash; pending vs paid now means what it says.</p>

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

<p>Make your voice heard. The community decides.</p>
`.trim();

export const blogFallbackPosts: BlogPost[] = [
    {
        id: 'blog-custom-hat-blog-01',
        title: 'CRAFTING THE 1/1: THE TRUST YOURSELF CUSTOM TRUCKER',
        slug: 'custom-hat-blog-01',
        content: rewriteImageSrcs(TRUST_YOURSELF_REMOTE_CONTENT),
        excerpt: 'A deep dive into the making of the 1/1 "Trust Yourself" custom trucker hat. From 3D puff embroidery to hand-distressed details.',
        author: 'Founder',
        category: 'community',
        coverImage: resolveLocalImageUrl('https://i.imgur.com/iYBlwm8.png'),
        tags: ['custom', 'vlog', 'craftsmanship', '1of1'],
        isPublished: true,
        upvotePower: 100,
        downvotePower: 0,
        score: 100,
        publishedAt: DEFAULT_PUBLISHED_AT,
        createdAt: DEFAULT_PUBLISHED_AT,
        updatedAt: DEFAULT_PUBLISHED_AT,
    },
    {
        id: 'blog-coalition-true-religion-jeans-s1',
        title: 'COALITION X TRUE RELIGION: THE 1/1 DENIM ARCHIVE',
        slug: 'coalition-x-true-religion-denim-archive',
        content: rewriteImageSrcs(TRUE_RELIGION_REMOTE_CONTENT),
        excerpt: 'Our first denim chapter brings Coalition into a one-of-one True Religion archive release.',
        author: 'Founder',
        category: 'drop',
        coverImage: resolveLocalImageUrl('https://i.imgur.com/2VU7MEr.jpg'),
        tags: ['denim', 'drop', 'true-religion', 'archive'],
        isPublished: true,
        upvotePower: 84,
        downvotePower: 0,
        score: 84,
        publishedAt: '2026-02-24T16:00:00.000Z',
        createdAt: '2026-02-24T16:00:00.000Z',
        updatedAt: '2026-02-24T16:00:00.000Z',
    },
    {
        // The Coalition referral program is scheduled to sunset on
        // Dec 31, 2026. This post is the referendum the community votes on
        // to decide whether the program continues into 2027. The post id
        // is what the existing components/VotingSystem.tsx attaches
        // `post_votes` rows to; the same RLS that protects other blog posts
        // applies automatically. Mirrored into the `posts` table by
        // supabase/migrations/20260711_referendum_referral_2027.sql so the
        // post exists in production (Blog.tsx queries the DB first and only
        // falls back to blogFallbackPosts when the DB is empty).
        id: 'blog-referendum-referral-program-2027',
        title: 'CONTINUE THE COALITION REFERRAL PROGRAM IN 2027?',
        slug: REFERENDUM_SLUG,
        content: rewriteImageSrcs(REFERENDUM_REMOTE_CONTENT),
        excerpt: 'Community referendum on whether the Coalition referral program (tiered 5%–40% commissions with anti-fraud hardening) continues into 2027 or sunsets for the year on December 31, 2026. Vote weighted by SGCoin v2 governance power.',
        author: 'Coalition Governance',
        category: 'announcement',
        tags: REFERENDUM_TAGS,
        isPublished: true,
        upvotePower: 0,
        downvotePower: 0,
        score: 0,
        publishedAt: REFERENDUM_PUBLISHED_AT,
        createdAt: REFERENDUM_PUBLISHED_AT,
        updatedAt: REFERENDUM_PUBLISHED_AT,
    },
];

const toIsoString = (value: unknown, fallback: string) => {
    if (typeof value === 'string' && value.trim()) return value;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    return fallback;
};

const toNumber = (value: unknown) => Number(value ?? 0) || 0;

export const mapBlogRowToPost = (row: any): BlogPost => {
    const upvotePower = toNumber(row?.upvote_power ?? row?.upvotePower);
    const downvotePower = toNumber(row?.downvote_power ?? row?.downvotePower);
    const publishedAt = toIsoString(
        row?.published_at ?? row?.publishedAt,
        row?.created_at ?? row?.createdAt ?? DEFAULT_PUBLISHED_AT
    );
    const createdAt = toIsoString(row?.created_at ?? row?.createdAt, publishedAt);
    const updatedAt = toIsoString(row?.updated_at ?? row?.updatedAt, createdAt);

    return {
        id: row?.id ?? row?.slug ?? row?.title ?? 'blog-post',
        title: row?.title ?? '',
        slug: row?.slug ?? '',
        content: rewriteImageSrcs(row?.content ?? ''),
        excerpt: row?.excerpt ?? '',
        author: row?.author ?? 'Coalition',
        authorId: row?.author_id ?? row?.authorId,
        category: row?.category ?? 'update',
        coverImage: resolveLocalImageUrl(row?.cover_image ?? row?.coverImage),
        tags: Array.isArray(row?.tags) ? row.tags : [],
        isPublished: row?.is_published ?? row?.isPublished ?? true,
        upvotePower,
        downvotePower,
        score: upvotePower - downvotePower,
        publishedAt,
        createdAt,
        updatedAt,
    };
};

export const normalizeBlogRows = (rows: any[] = []) => rows.map(mapBlogRowToPost);

export const mergeBlogPosts = (primary: BlogPost[] = [], fallback: BlogPost[] = blogFallbackPosts) => {
    const postsBySlug = new Map<string, BlogPost>();

    fallback.forEach(post => postsBySlug.set(post.slug, post));
    primary.forEach(post => postsBySlug.set(post.slug, post));

    return Array.from(postsBySlug.values()).sort((a, b) => {
        const bTime = new Date(b.publishedAt || b.createdAt).getTime();
        const aTime = new Date(a.publishedAt || a.createdAt).getTime();

        if (bTime !== aTime) return bTime - aTime;
        return a.title.localeCompare(b.title);
    });
};

export const filterBlogPostsByCategory = (posts: BlogPost[], category: string) => {
    if (category === 'all') return posts;
    return posts.filter(post => post.category === category);
};

export const getBlogPostBySlug = (slug: string | undefined, source: BlogPost[] = blogFallbackPosts) => {
    if (!slug) return undefined;
    return source.find(post => post.slug === slug) || blogFallbackPosts.find(post => post.slug === slug);
};
