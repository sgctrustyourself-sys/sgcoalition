// JSON-LD builders — the single owner of the site-wide structured-data graph.
//
// Two surfaces emit this markup and they must agree:
//   - the React routes, via <Seo jsonLd={structuredDataGraph([...])}>
//   - the prerenderer, scripts/generateSeoArtifacts.mjs, which mirrors the same
//     node shapes into dist/<route>/index.html for crawlers that do not run JS
// tests/structuredData.test.ts deep-compares the two so drift fails a test
// instead of silently shipping two different descriptions of the same entity.
//
// Identity: every node carries an `@id` (the canonical ENTITY identifier, not
// the page URL) so a node referenced from several pages — @id #organization is
// referenced by #website and by the AboutPage — resolves to one entity instead
// of being redefined per page.
import { ABOUT_PAGE_DESCRIPTION, BRAND_SAME_AS_LINKS } from '../constants.js';
import { DEFAULT_SEO_DESCRIPTION, SITE_NAME, SITE_ORIGIN, absoluteUrl } from './seo.js';

export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const SUPPORT_EMAIL = 'sgctrustyourself@gmail.com';
export const ORGANIZATION_DESCRIPTION =
    'Premium streetwear brand born in Baltimore. Quality, community, and the hustle.';
export const ORGANIZATION_LOGO = absoluteUrl('/images/logo.png');

export type StructuredDataNode = Record<string, unknown>;

/** Wrap nodes into one `@graph` script with a single `@context`, dropping any
 *  per-node `@context` (a nested one is legal but redundant). */
export const structuredDataGraph = (nodes: StructuredDataNode[]) => ({
    '@context': 'https://schema.org',
    '@graph': nodes
        .filter(Boolean)
        .map((node) => {
            const copy: StructuredDataNode = { ...node };
            delete copy['@context'];
            return copy;
        }),
});

export const buildOrganizationJsonLd = (): StructuredDataNode => ({
    '@id': ORGANIZATION_ID,
    '@type': 'Organization',
    name: SITE_NAME,
    description: ORGANIZATION_DESCRIPTION,
    url: SITE_ORIGIN,
    logo: ORGANIZATION_LOGO,
    email: SUPPORT_EMAIL,
    address: {
        '@type': 'PostalAddress',
        addressLocality: 'Baltimore',
        addressRegion: 'MD',
        addressCountry: 'US',
    },
    // Social profiles are the brand's other identifiers — same list the
    // /about and /community pages render as links.
    sameAs: [...BRAND_SAME_AS_LINKS],
});

export const buildWebSiteJsonLd = (): StructuredDataNode => ({
    '@id': WEBSITE_ID,
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_ORIGIN,
    description: DEFAULT_SEO_DESCRIPTION,
    inLanguage: 'en-US',
    publisher: { '@id': ORGANIZATION_ID },
});

export const buildWebPageJsonLd = ({
    path,
    name,
    description,
}: {
    path: string;
    name: string;
    description: string;
}): StructuredDataNode => ({
    '@id': `${absoluteUrl(path)}#webpage`,
    '@type': 'WebPage',
    name,
    description,
    url: absoluteUrl(path),
    isPartOf: { '@id': WEBSITE_ID },
});

export const buildFaqPageJsonLd = (
    path: string,
    faqs: readonly { question: string; answer: string }[],
): StructuredDataNode => ({
    '@id': `${absoluteUrl(path)}#faq`,
    '@type': 'FAQPage',
    url: absoluteUrl(path),
    name: 'Coalition Help Center — frequently asked questions',
    mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
        },
    })),
});

export const buildAboutPageJsonLd = (): StructuredDataNode => ({
    '@id': absoluteUrl('/about'),
    '@type': 'AboutPage',
    name: `About ${SITE_NAME}`,
    description: ABOUT_PAGE_DESCRIPTION,
    url: absoluteUrl('/about'),
    // Reference, not a redefinition: buildOrganizationJsonLd() is emitted in
    // the same graph, so the crawler dedupes to one Organization entity.
    mainEntity: { '@id': ORGANIZATION_ID },
});
