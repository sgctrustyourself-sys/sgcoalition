// tests/structuredData.test.ts
//
// Pins the structured-data graph in three places at once:
//
//   1. Architecture: the React builders (utils/structuredData.ts) and the
//      prerenderer's builders (scripts/generateSeoArtifacts.mjs) are two
//      implementations of one graph. A crawler that runs JS and one that does
//      not must be told the same thing, so every route's prerendered graph is
//      deep-compared against the runtime-built graph for the same route.
//   2. Sources: the /help FAQ copy (data/helpFaqs.ts) and the brand sameAs list
//      (constants.ts) are parsed by the build script rather than imported. If
//      either parse silently stops matching, the FAQPage ships an empty
//      mainEntity and the Organization ships no sameAs, and nothing else fails.
//   3. The mounting rule: <Seo> deletes the prerendered JSON-LD before it
//      injects its own, so a page that mounts <Seo> without a jsonLd prop ships
//      NO structured data once hydrated, no matter what the generator wrote.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTE_PAGES, pageExists, readPage } from './_helpers/routePages';
import {
    buildRouteStructuredData,
    buildHomeStructuredData,
    parseBrandSameAs,
    parseHelpFaqs,
    sortArchivedProducts as sortArchivedProductsForPrerender,
    STATIC_ROUTES,
} from '../scripts/generateSeoArtifacts.mjs';
import { BRAND_SAME_AS_LINKS } from '../constants';
import { HELP_FAQS } from '../data/helpFaqs';
import { buildItemListJsonLd } from '../utils/seo';
import { sortArchivedProducts } from '../utils/archiveSort';
import {
    buildAboutPageJsonLd,
    buildFaqPageJsonLd,
    buildOrganizationJsonLd,
    buildWebPageJsonLd,
    buildWebSiteJsonLd,
    structuredDataGraph,
    type StructuredDataNode,
} from '../utils/structuredData';

const read = (relativePath: string) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const SAME_AS = parseBrandSameAs();
const ROUTE_CONTEXT = { sameAs: SAME_AS, faqs: parseHelpFaqs() };

// A few fake products so the two CollectionPage implementations are compared
// over real item fields (id/name → url) and over a real ordering: one live
// product, two sold on different dates, one with only archivedAt (the fallback
// branch of the archive sort), and a name tie at equal dates.
const fixture = (overrides: Record<string, unknown>) => ({
    id: 'prod_structured_data_fixture',
    name: 'Structured Data Fixture',
    description: 'Fixture product used to compare ItemList nodes.',
    category: 'tee',
    price: 42,
    images: ['/images/tee-front.png'],
    archived: false,
    soldAt: '',
    archivedAt: '',
    isLimitedEdition: false,
    ...overrides,
}) as never;

const products = [
    fixture({ id: 'prod_live_fixture', name: 'Live Fixture' }),
    fixture({
        id: 'prod_archive_sold_new',
        name: 'Archive Sold New',
        archived: true,
        soldAt: '2026-06-25T02:40:12.191+00:00',
    }),
    // No soldAt: the sort must fall back to archivedAt.
    fixture({ id: 'prod_archive_only', name: 'Archive Only', archived: true, archivedAt: '2026-03-26T00:00:00Z' }),
    // Same instant as the previous row: the tie-break decides, and it is
    // name-based, so 'Archive Only' must come before 'Archive Tie Zulu'.
    fixture({ id: 'prod_archive_tie_zulu', name: 'Archive Tie Zulu', archived: true, soldAt: '2026-03-26T00:00:00Z' }),
];

/** The runtime equivalent of the generator's routeNodes switch. */
const runtimeNode = (kind: string, route: (typeof STATIC_ROUTES)[number]): StructuredDataNode => {
    switch (kind) {
        case 'organization':
            return buildOrganizationJsonLd();
        case 'webSite':
            return buildWebSiteJsonLd();
        case 'webPage':
            return buildWebPageJsonLd({ path: route.path, name: route.title, description: route.description });
        case 'faqPage':
            return buildFaqPageJsonLd(route.path, HELP_FAQS);
        case 'aboutPage':
            return buildAboutPageJsonLd();
        default:
            throw new Error(`Test has no runtime builder for structuredData kind "${kind}"`);
    }
};

const runtimeGraphFor = (route: (typeof STATIC_ROUTES)[number]) => {
    const nodes = (route.structuredData || []).map((kind: string) => runtimeNode(kind, route));

    if (route.collection) {
        const matching = products.filter(route.collection.where as (product: unknown) => boolean);
        // The runtime side mirrors what the page renders: /archive sorts before
        // building its ItemList, /shop does not.
        const ordered = route.collection.sort ? sortArchivedProducts(matching) : matching;
        nodes.push(buildItemListJsonLd(ordered as never, route.collection.name, route.path));
    }

    return structuredDataGraph(nodes);
};

describe('structured data — runtime builders and prerenderer agree', () => {
    for (const route of STATIC_ROUTES) {
        it(`emits the same graph for ${route.path} in both implementations`, () => {
            expect(buildRouteStructuredData(route, products, ROUTE_CONTEXT)).toEqual(runtimeGraphFor(route));
        });
    }

    it('emits the same homepage graph in both implementations', () => {
        expect(buildHomeStructuredData(SAME_AS)).toEqual(
            structuredDataGraph([buildOrganizationJsonLd(), buildWebSiteJsonLd()])
        );
    });

    it('orders the archive ItemList exactly like the page does', () => {
        const archived = products.filter((product) => (product as Record<string, unknown>).archived);

        expect(sortArchivedProductsForPrerender(archived)).toEqual(sortArchivedProducts(archived as never));
        expect(sortArchivedProductsForPrerender(archived).map((product) => product.name)).toEqual([
            'Archive Sold New',
            'Archive Only',
            'Archive Tie Zulu',
        ]);
    });
});

describe('structured data — parsed sources stay in step with the code', () => {
    it('parses every HELP_FAQS entry the /help page renders', () => {
        expect(parseHelpFaqs()).toEqual(
            HELP_FAQS.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }))
        );
    });

    it('parses the full BRAND_SAME_AS_LINKS list', () => {
        expect(SAME_AS).toEqual([...BRAND_SAME_AS_LINKS]);
    });

    it('feeds every FAQ answer into the FAQPage as plain text', () => {
        const graph = buildRouteStructuredData(
            STATIC_ROUTES.find((route) => route.path === '/help')!,
            products,
            ROUTE_CONTEXT
        );
        const faqPage = graph['@graph'].find((node: StructuredDataNode) => node['@type'] === 'FAQPage');

        expect(faqPage.mainEntity).toHaveLength(HELP_FAQS.length);
        for (const [index, question] of faqPage.mainEntity.entries()) {
            expect(question.name).toBe(HELP_FAQS[index].question);
            expect(question.acceptedAnswer.text).toBe(HELP_FAQS[index].answer);
            expect(question.acceptedAnswer.text.length).toBeGreaterThan(20);
        }
    });
});

describe('structured data — graph invariants', () => {
    const graphs = STATIC_ROUTES.map((route) => ({
        path: route.path,
        graph: buildRouteStructuredData(route, products, ROUTE_CONTEXT),
    })).concat([{ path: '/', graph: buildHomeStructuredData(SAME_AS) }]);

    it('gives every prerendered route a graph (a new route cannot ship an empty head)', () => {
        for (const { path: routePath } of graphs) {
            const route = STATIC_ROUTES.find((candidate) => candidate.path === routePath);
            if (route) {
                expect(route.structuredData, `${routePath} structuredData`).toBeTruthy();
                expect(route.structuredData.length, `${routePath} node count`).toBeGreaterThan(0);
            }
        }
    });

    it('uses one @context per graph and drops node-level ones', () => {
        for (const { path: routePath, graph } of graphs) {
            expect(graph['@context'], `${routePath} @context`).toBe('https://schema.org');
            expect(typeof graph['@graph'], `${routePath} @graph`).toBe('object');
            for (const node of graph['@graph']) {
                expect(node['@context'], `${routePath} nested @context`).toBeUndefined();
            }
        }
    });

    it('gives every node a unique @id and a @type', () => {
        for (const { path: routePath, graph } of graphs) {
            const ids = graph['@graph'].map((node: StructuredDataNode) => node['@id']);
            expect(ids.every(Boolean), `${routePath} @id`).toBe(true);
            expect(new Set(ids).size, `${routePath} duplicate @id`).toBe(ids.length);
            for (const node of graph['@graph']) {
                expect(node['@type'], `${routePath} @type`).toBeTruthy();
            }
        }
    });

    it('serialises without losing fields (undefined would vanish silently)', () => {
        for (const { path: routePath, graph } of graphs) {
            expect(JSON.parse(JSON.stringify(graph)), `${routePath} round-trip`).toEqual(graph);
        }
    });

    it('ties the Website publisher and the AboutPage to the one Organization node', () => {
        const home = buildHomeStructuredData(SAME_AS);
        const website = home['@graph'].find((node: StructuredDataNode) => node['@type'] === 'WebSite');
        const organization = home['@graph'].find((node: StructuredDataNode) => node['@type'] === 'Organization');

        expect(website.publisher).toEqual({ '@id': organization['@id'] });
        expect(organization.sameAs).toEqual([...BRAND_SAME_AS_LINKS]);
        expect(buildAboutPageJsonLd().mainEntity).toEqual({ '@id': organization['@id'] });
    });
});

// <Seo> (components/Seo.tsx) removes every `script[data-seo-static-jsonld]` —
// including the generator's — before injecting its own jsonLd prop. So a page
// that mounts <Seo> and passes no jsonLd is left with NO structured data at all
// after hydration. Anything the generator writes for those routes is thrown
// away, which is why each one must supply the same graph from the shared
// builders.
describe('structured data — every route that mounts <Seo> feeds it the graph', () => {
    it('maps every prerendered route to a page file that exists', () => {
        expect(Object.keys(ROUTE_PAGES).sort()).toEqual(STATIC_ROUTES.map((route) => route.path).sort());
        for (const [routePath, file] of Object.entries(ROUTE_PAGES)) {
            expect(pageExists(file), `${routePath} → ${file}`).toBe(true);
        }
    });

    it('passes a jsonLd graph whenever the page mounts <Seo>', () => {
        for (const [routePath, file] of Object.entries(ROUTE_PAGES)) {
            const source = readPage(file);
            if (!source.includes('<Seo')) continue;

            expect(source, `${routePath} (${file}) mounts <Seo> without jsonLd`).toContain('jsonLd={');
        }
    });

    // The /shop failure mode: the page mounted <Seo jsonLd={itemList}> only, so
    // hydration deleted the prerendered Organization/WebPage nodes and left the
    // page with nothing but a CollectionPage. A partial graph is worse than a
    // missing one, because the prerendered HTML says something the DOM does not.
    it('passes the whole graph (not just one node) from pages that mount <Seo>', () => {
        for (const [routePath, file] of Object.entries(ROUTE_PAGES)) {
            const source = readPage(file);
            if (!source.includes('<Seo')) continue;

            expect(source, `${routePath} (${file}) does not import the graph builder`).toContain('structuredDataGraph');
            expect(source, `${routePath} (${file}) omits the Organization node`).toContain('buildOrganizationJsonLd');
        }
    });
});
