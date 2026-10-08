// The contract between the prerenderer and the app's boot.
//
// scripts/generateSeoArtifacts.mjs writes a post's article inside #root so a
// crawler or an AI reader gets the words without executing JavaScript; index.tsx
// removes that copy on boot, because the app renders the same post from the live
// row and a second copy behind the app is not a visitor's page.
//
// WHY THIS MODULE EXISTS: each side used to spell the id out itself — the
// generator in the markup it wrote, index.tsx in the lookup that removed it — so a
// rename on one side shipped the served copy twice on every load while every check
// stayed green (the loader-fade check drives "/", which carries no article, and a
// test that only reads one of the two literals cannot see the other). One value,
// imported by both runtimes — plain Node for the build script, Vite for the app —
// is what makes that impossible rather than merely unlikely.
//
// scripts/verify-prerendered-article.mjs imports this too and drives a real page
// that carries the node, so the check cannot drift from either side either.

/**
 * Id of the article node a prerendered page carries inside #root.
 * @type {string}
 */
export const PRERENDERED_ARTICLE_ID = 'prerendered-post';

/**
 * The element that node uses.
 * @type {string}
 */
export const PRERENDERED_ARTICLE_TAG = 'article';

/**
 * The node's opening tag — the generator writes it, and index.tsx's removal is
 * addressed by the id inside it.
 * @type {string}
 */
export const PRERENDERED_ARTICLE_OPEN = `<${PRERENDERED_ARTICLE_TAG} id="${PRERENDERED_ARTICLE_ID}">`;

/**
 * Its closing tag.
 * @type {string}
 */
export const PRERENDERED_ARTICLE_CLOSE = `</${PRERENDERED_ARTICLE_TAG}>`;

/**
 * Drops the prerendered copy so the app's own render is the only one in the DOM.
 *
 * Called unconditionally on boot: on a page with no prerendered article — every
 * route except a post — this is a no-op, and on a post it removes the copy before
 * React mounts. Returns whether a node was found, which is what the checker and
 * the tests assert on. `doc` is injectable so a test can run it against a page it
 * parsed instead of the live document.
 *
 * @param {Document} [doc]
 * @returns {boolean}
 */
export const removePrerenderedArticle = (doc = globalThis.document) => {
  const node = doc?.getElementById?.(PRERENDERED_ARTICLE_ID);
  if (!node) return false;
  node.remove();
  return true;
};
