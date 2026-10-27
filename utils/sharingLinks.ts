// utils/sharingLinks.ts
//
// The brand has TWO public URLs, and they are not interchangeable.
//
//   STOREFRONT ORIGIN   https://sgcoalition-five.vercel.app
//                       The site itself: canonical tags, the sitemap,
//                       transactional email links, the CORS echo, the
//                       webhook URLs. Owned by utils/seo.ts (SITE_ORIGIN).
//
//   MAIN SHARING LINK   https://linktr.ee/sgcoalition
//                       What the brand prints when it says "link in bio".
//                       The linktree carries the portfolio next to the
//                       shop, so one URL does both jobs.
//
// The failure this module exists to prevent is silent in both directions.
// Point the storefront origin at the linktree and the canonical tags, the
// sitemap and the CORS echo all start advertising a linktree as if it were
// the shop. Point the sharing link at the storefront and "link in bio"
// lands a customer on a bare home page with no portfolio and no path to
// anything they made. Neither raises an error — the page still loads —
// so the two are pinned by tests/sharingLink.test.ts and
// tests/downDomain.test.ts instead of by a human remembering.

/**
 * The main sharing link: the "link in bio" URL. The linktree carries the
 * portfolio next to the shop, which is why it is the link a customer is
 * given when they are looking at a product.
 */
export const MAIN_SHARING_LINK = 'https://linktr.ee/sgcoalition';

/**
 * The same link as it is PRINTED — a poster, a caption, a story sticker.
 * No scheme, because a scheme in a caption is a link that stops looking
 * like a link, and the printed form is what people type by hand.
 */
export const MAIN_SHARING_LABEL = 'linktr.ee/sgcoalition';
