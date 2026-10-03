/**
 * scripts/generateDropPost.ts — seed each release's editorial drop post.
 *
 *   npx tsx scripts/generateDropPost.ts --slug pink-silver-crop-top            # dry run
 *   npx tsx scripts/generateDropPost.ts --slug pink-silver-crop-top --confirm  # write
 *   npx tsx scripts/generateDropPost.ts --slug pink-silver-crop-top --draft    # publish flag off
 *
 * The post body lives in the registry (copy.postBody), so the blog copy and the
 * poster copy come from one place and cannot quote different prices.
 *
 * Writes the `posts` table (the live source — pages/Blog.tsx reads it and falls
 * back to data/blogPosts.ts only when the table is unreachable), matching the
 * row shape pages/admin/BlogManager.tsx upserts. Idempotent by slug: an existing
 * post with the same slug is updated in place, never duplicated.
 */
import { getAdminClient, publicAssetUrl, slugsFromArgs } from './dropKit';
import { hasFlag, logHeader, logRow } from './cli';
import { getDrop } from './story-reveal-specs/drops';
import type { DropRelease } from './story-reveal-specs/drops';
import type { SupabaseClient } from '@supabase/supabase-js';

function buildPost(drop: DropRelease, coverImage: string, isPublished: boolean) {
  return {
    title: drop.copy.postTitle,
    slug: drop.copy.postSlug,
    content: drop.copy.postBody,
    excerpt: drop.copy.postExcerpt,
    author: 'Coalition',
    category: 'drop',
    cover_image: coverImage,
    tags: drop.copy.postTags,
    is_published: isPublished,
    published_at: isPublished ? `${drop.dropDate}T16:00:00.000Z` : null,
  };
}

async function writePost(admin: SupabaseClient, post: ReturnType<typeof buildPost>, confirm: boolean): Promise<void> {
  const { data: existing, error: readError } = await admin
    .from('posts')
    .select('id, is_published, title')
    .eq('slug', post.slug)
    .maybeSingle();
  if (readError) throw new Error(`Could not read posts row: ${readError.message}`);

  console.log(`\n▸ ${post.slug}`);
  logRow('title', post.title);
  logRow('category', post.category);
  logRow('tags', post.tags.join(', '));
  logRow('published', post.is_published ? post.published_at || 'yes' : 'no (draft)');
  logRow('cover', post.cover_image || '(none)');
  logRow('body', `${post.content.length} chars`);
  logRow('state', existing ? `existing post (was ${existing.is_published ? 'published' : 'draft'}) → update` : 'new post → insert');

  if (!confirm) return;

  const { error } = existing
    ? await admin.from('posts').update(post).eq('id', existing.id)
    : await admin.from('posts').insert([post]);
  if (error) throw new Error(`Post write failed: ${error.message}`);
  console.log(`  ✓ ${existing ? 'updated' : 'inserted'} — live at /blog/${post.slug}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slugs = slugsFromArgs(argv);
  const confirm = hasFlag(argv, 'confirm');
  const isPublished = !hasFlag(argv, 'draft');
  logHeader(confirm ? '📝 drop:post — confirm' : '📝 drop:post — dry run');
  logRow('releases', slugs.join(', '));
  logRow('mode', confirm ? `write (${isPublished ? 'published' : 'draft'})` : 'inspect only');

  const admin = getAdminClient();
  for (const slug of slugs) {
    const drop = getDrop(slug);
    // The cover comes from public/ like the body does, so the post renders the
    // moment its images are in the repo — it does not wait on a storage upload.
    await writePost(admin, buildPost(drop, publicAssetUrl(drop.spec, 'front'), isPublished), confirm);
  }

  if (!confirm) console.log(`\nDry run — nothing written. Re-run with --confirm to publish these posts.\n`);
}

main().catch((err) => {
  console.error('\n❌ drop:post failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
