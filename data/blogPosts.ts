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
