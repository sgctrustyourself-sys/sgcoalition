import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'url';
// The prerendered node's identity, shared with the app's boot and with the check
// that drives a real page. Unlike the policies below this is imported rather than
// parsed: it is plain ESM, so both this Node process and Vite can load the same
// value — one owner, no second spelling to drift from.
import {
  PRERENDERED_ARTICLE_CLOSE,
  PRERENDERED_ARTICLE_ID,
  PRERENDERED_ARTICLE_OPEN,
} from '../utils/prerenderedArticle.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://sgcoalition.xyz';
// Share cards, mirroring SHARE_CARD_DIRECTORY / DEFAULT_SEO_IMAGE / shareCardImage
// in utils/seo.ts. 1200x630 is the size every scraper needs before it renders a
// full-width link preview; scripts/generateOgCard.mjs writes one card per route.
//
// The rule is an ALLOWLIST, not a path template: only routes that declared a
// `cardTitle` have a file, and anything else resolves to the generic brand card.
// A blind `/og<path>.jpg` would hand every route without a card a URL that 404s,
// which unfurls as no image at all — worse than a generic one.
// STATIC_ROUTES is read lazily because it is declared below this function.
const GENERIC_CARD_PATH = '/og/card.jpg';

export const shareCardPath = (routePath) => {
  const raw = routePath || '/';
  const trimmed = raw.split('?')[0].split('#')[0];
  const normalized = trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : '/';
  const route = STATIC_ROUTES.find((candidate) => candidate.path === normalized);

  return route && route.cardTitle ? `/og${normalized}.jpg` : GENERIC_CARD_PATH;
};
const DEFAULT_IMAGE = GENERIC_CARD_PATH;
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;
const DEFAULT_IMAGE_ALT = 'Coalition wordmark beside the Coalition hero artwork — crafted in Baltimore';
const SEO_LOCALE = 'en_US';
const DEFAULT_DESCRIPTION =
  'Coalition — handcrafted streetwear from Baltimore. Shop limited-edition wallets, custom tees, 1/1 denim, and archive drops. Live order map & SGCoin rewards.';

const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');

const readFile = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cleanText = (value = '') =>
  String(value)
    .replace(/\\u2014/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/<[^>]+>/g, '')
    // Mirrors utils/seo.ts: JS-escape remnants ("3D puff \ $50") otherwise ship
    // verbatim in the SERP snippet.
    .replace(/\\(?=\s|$)/g, '')
    .trim();

const truncateSeoText = (value, maxLength = 155) => {
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) return cleaned || DEFAULT_DESCRIPTION;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
};

const absoluteUrl = (value = DEFAULT_IMAGE) => {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `${SITE_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
};

const productPath = (id) => `/product/${encodeURIComponent(id)}`;

// Bracket-balanced scan that respects:
//   - JS line comments (// ... \n)
//   - JS block comments (/* ... */)
//   - String literals ('...' / "..." / `...`)
//   - String-literal escapes (\)
//   - Template-literal interpolations (`${...}` with balanced {} inside)
// Returns the index of the matching closeChar, or -1 if it never drops to depth 0
// before the source ends, or if it goes negative (mismatched source).
const scanToMatching = (source, openIndex, openChar, closeChar) => {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let bracketDepthInInterpolation = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; index += 1; }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      // Template-literal interpolation: skip `${...}` with balanced braces.
      if (quote === '`' && char === '$' && next === '{') {
        bracketDepthInInterpolation = 1;
        index += 1; // consume '{'
        for (let j = index + 1; j < source.length; j += 1) {
          const ic = source[j];
          if (ic === '{') bracketDepthInInterpolation += 1;
          else if (ic === '}') {
            bracketDepthInInterpolation -= 1;
            if (bracketDepthInInterpolation === 0) {
              index = j;
              break;
            }
          }
        }
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      continue;
    }

    // Detect comment starts ONLY when not in a string and not in a context
    // where these characters have other meanings. We are tracking `[` `]` here,
    // so the closest "wrong-context" false positives are inside regex literals
    // (which constants.ts does not contain).
    if (char === '/' && next === '/') { inLineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { inBlockComment = true; index += 1; continue; }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const splitTopLevelObjects = (arraySource) => {
  const objects = [];
  let start = -1;
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < arraySource.length; index += 1) {
    const char = arraySource[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(arraySource.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
};

const unescapeStringLiteral = (value = '') =>
  value
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\u2014/g, '-');

// Field names in constants/products.ts may be either unquoted (`id:`) or quoted (`"id":`).
// We accept either form. Using `String.raw` avoids the template-literal escape
// trap where `\b` would become an ASCII backspace (0x08) instead of a regex
// word boundary — with `String.raw`, `\b` stays as the two characters `\` + `b`,
// which `new RegExp` interprets as a word boundary. The `\b` word boundaries
// prevent `id` from matching inside `tokenId` and `archived` from matching
// inside `archivedAt`.
// Field-name extractors below use `String.raw` so that `\b` and `\s` stay as
// the two-character regex escapes (word boundary / whitespace) — in a normal
// template literal, `\b` would become an ASCII backspace (0x08) and `\s` would
// collapse to a bare `s`, silently breaking the regex. The character class
// `['"]` deliberately omits the backtick so the whole pattern fits in one
// `String.raw` template (a backtick inside the class would terminate it).
// constants.ts only uses double-quoted string values, so the backtick case
// is unreachable.
export const readStringField = (block, field) => {
  const match = block.match(
    new RegExp(String.raw`['"]?\b${field}\b['"]?\s*:\s*(['"])([\s\S]*?)\1`)
  );
  return match ? unescapeStringLiteral(match[2]) : '';
};

export const readNumberField = (block, field) => {
  const match = block.match(
    new RegExp(String.raw`['"]?\b${field}\b['"]?\s*:\s*([0-9]+(?:\.[0-9]+)?)`)
  );
  return match ? Number(match[1]) : 0;
};

// The drop registry authors a post's body as a backtick template literal, which
// readStringField deliberately cannot see (its character class omits the backtick
// so the pattern fits inside one String.raw template). Only the escapes a body
// can carry are undone here — everything else in it is markup that the article
// builder parses itself, so \n must survive rather than becoming a space the way
// unescapeStringLiteral would leave it.
export const readTemplateField = (block, field) => {
  const match = block.match(new RegExp('\\b' + field + '\\b\\s*:\\s*`([\\s\\S]*?)`'));
  return match ? match[1].replace(/\\`/g, '`').replace(/\\\\/g, '\\') : '';
};

const parseImageCatalog = () => {
  const source = readFile('utils/localImageAssets.ts');
  const catalog = new Map();
  const groupPattern = /(\w+):\s*{([\s\S]*?)\n\s*},/g;
  let groupMatch;

  while ((groupMatch = groupPattern.exec(source))) {
    const [, groupName, groupBody] = groupMatch;
    const valuePattern = /(\w+):\s*(['"])(.*?)\2/g;
    let valueMatch;

    while ((valueMatch = valuePattern.exec(groupBody))) {
      catalog.set(`${groupName}.${valueMatch[1]}`, unescapeStringLiteral(valueMatch[3]));
    }
  }

  return catalog;
};

const readImageList = (block, imageCatalog) => {
  // Field names may be either unquoted (`images:`) or quoted (`"images":`)
  // in constants.ts, so use a regex that accepts either form.
  const imageStart = block.search(/['"]?images['"]?\s*:/);
  if (imageStart < 0) return [DEFAULT_IMAGE];

  const arrayStart = block.indexOf('[', imageStart);
  if (arrayStart < 0) return [DEFAULT_IMAGE];

  const arrayEnd = scanToMatching(block, arrayStart, '[', ']');
  if (arrayEnd < 0) return [DEFAULT_IMAGE];

  const arrayBody = block.slice(arrayStart + 1, arrayEnd);
  const images = [];
  const tokenPattern = /(['"])(.*?)\1|PRODUCT_IMAGE_URLS\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g;
  let token;

  while ((token = tokenPattern.exec(arrayBody))) {
    if (token[2]) {
      images.push(unescapeStringLiteral(token[2]));
      continue;
    }

    const mapped = imageCatalog.get(`${token[3]}.${token[4]}`);
    if (mapped) images.push(mapped);
  }

  return images.length > 0 ? images : [DEFAULT_IMAGE];
};

// Sum of sizeInventory — the prerenderer's getProductStock (utils/seo.ts). The
// key is quoted in constants/products.ts, so an unquoted match silently finds
// nothing and every product looks in stock. null means "no inventory data",
// which is treated as available rather than sold.
export const readStock = (block) => {
  const match = block.match(/['"]?sizeInventory['"]?\s*:\s*\{([\s\S]*?)\}/);
  if (!match) return null;

  return [...match[1].matchAll(/(['"]?)([^'"]+?)\1\s*:\s*(\d+)/g)]
    .reduce((sum, entry) => sum + Number(entry[3]), 0);
};

export const parseProducts = () => {
  const constantsSource = readFile('constants/products.ts');
  const imageCatalog = parseImageCatalog();
  const productsStart = constantsSource.indexOf('export const INITIAL_PRODUCTS');
  const initializerStart = productsStart >= 0 ? constantsSource.indexOf('=', productsStart) : -1;
  const arrayStart = initializerStart >= 0 ? constantsSource.indexOf('[', initializerStart) : -1;
  const arrayEnd = arrayStart >= 0 ? scanToMatching(constantsSource, arrayStart, '[', ']') : -1;

  if (productsStart < 0 || initializerStart < 0 || arrayStart < 0 || arrayEnd < 0) {
    throw new Error(
      'Unable to locate INITIAL_PRODUCTS in constants/products.ts. '
      + `productsStart=${productsStart}, initializerStart=${initializerStart}, `
      + `arrayStart=${arrayStart}, arrayEnd=${arrayEnd}, sourceLength=${constantsSource.length}.`
    );
  }

  return splitTopLevelObjects(constantsSource.slice(arrayStart + 1, arrayEnd))
    .map((block) => ({
      id: readStringField(block, 'id'),
      name: readStringField(block, 'name'),
      description: readStringField(block, 'description'),
      category: readStringField(block, 'category'),
      price: readNumberField(block, 'price'),
      images: readImageList(block, imageCatalog),
      archived: /['"]?\barchived\b['"]?\s*:\s*true/.test(block),
      soldAt: readStringField(block, 'soldAt'),
      archivedAt: readStringField(block, 'archivedAt'),
      stock: readStock(block),
      isLimitedEdition: /['"]?\bisLimitedEdition\b['"]?\s*:\s*true/.test(block),
    }))
    .filter((product) => product.id && product.name);
};

// Mirrors buildProductTitle / buildProductBlurb / getProductStock in utils/seo.ts
// (pinned by tests/structuredData.test.ts). Kept as source-of-truth pairs rather
// than one shared module because this script is plain Node and cannot import TS.
const PRODUCT_TITLE_SUFFIX_MAX_NAME = 45;
const PRODUCT_DESCRIPTION_MIN_LENGTH = 45;

const buildProductTitle = (name) =>
  name.length > PRODUCT_TITLE_SUFFIX_MAX_NAME ? name : `${name} | Coalition`;

const buildProductBlurb = (product) => {
  const copy = cleanText(product.description || '');
  if (copy.length >= PRODUCT_DESCRIPTION_MIN_LENGTH) return copy;

  const kind = product.isLimitedEdition ? 'limited-edition ' : '';
  return `${product.name} — a ${kind}Coalition ${product.category || 'piece'}, handcrafted in Baltimore.`;
};

const isProductSold = (product) =>
  product.archived || Boolean(product.soldAt) || (typeof product.stock === 'number' && product.stock <= 0);

export const getProductSeo = (product) => {
  const isSold = isProductSold(product);
  const status = isSold ? 'Sold archive piece' : product.isLimitedEdition ? 'Limited drop available' : 'Available now';

  return {
    title: buildProductTitle(product.name),
    description: truncateSeoText(`${status}. ${buildProductBlurb(product)} ${product.price ? `$${product.price}.` : ''}`),
    image: absoluteUrl(product.images[0]),
    imageAlt: `${product.name}${isSold ? ' — sold' : ''} by Coalition`,
    url: absoluteUrl(productPath(product.id)),
    path: productPath(product.id),
    type: 'product',
  };
};

// Exported alongside injectSeo so tests/seoMeta.test.ts can compare the
// prerendered output against the runtime builders (utils/seo.ts,
// components/Seo.tsx) instead of re-implementing either side.
export const productJsonLd = (product) => {
  const seo = getProductSeo(product);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: seo.description,
    image: product.images.map(absoluteUrl),
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: 'Coalition',
    },
    category: product.category,
    url: seo.url,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: Number(product.price || 0).toFixed(2),
      availability: isProductSold(product) ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: seo.url,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
};

const collectionJsonLd = (products, name, pagePath) => ({
  '@context': 'https://schema.org',
  '@id': `${absoluteUrl(pagePath)}#collection`,
  '@type': 'CollectionPage',
  name,
  url: absoluteUrl(pagePath),
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: getProductSeo(product).url,
      name: product.name,
    })),
  },
});

// ----------------------------------------------------------------------------
// Structured data (JSON-LD) — the prerendered half of utils/structuredData.ts.
//
// Every builder below has a twin in that module, which the React routes use via
// <Seo jsonLd={...}>. The two are deliberately identical in shape and are
// deep-compared by tests/structuredData.test.ts, so a change here without the
// matching change there (or vice versa) fails a test instead of shipping two
// descriptions of the same entity to crawlers and to people with JS.
// ----------------------------------------------------------------------------
const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const SUPPORT_EMAIL = 'sgctrustyourself@gmail.com';
const ORGANIZATION_DESCRIPTION = 'Premium streetwear brand born in Baltimore. Quality, community, and the hustle.';
const ORGANIZATION_LOGO = absoluteUrl('/images/logo.png');

// BRAND_SAME_AS_LINKS is the one owner of the brand's social profiles
// (constants.ts); /about and /community render it, and the Organization node
// lists it. Parsed rather than imported because this script is plain Node —
// constants.ts is TypeScript.
// Mirror of utils/archiveSort.ts > sortArchivedProducts. The /archive page
// renders the archive in this order, so the prerendered ItemList must use it
// too — otherwise the ItemList a crawler reads and the grid a browser hydrates
// disagree about the order of the same products.
// tests/structuredData.test.ts compares this against the utility over a
// multi-product fixture (including a soldAt/archivedAt fallback and a name tie).
export const sortArchivedProducts = (products) =>
  [...products].sort((a, b) => {
    const dateA = new Date(a.soldAt || a.archivedAt || 0).getTime();
    const dateB = new Date(b.soldAt || b.archivedAt || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return a.name.localeCompare(b.name);
  });

// Body of an exported array literal, anchored on its `=` like parseProducts.
// Anchoring matters: `readonly string[]` / `HelpFaq[]` put a pair of brackets in
// the type annotation, and scanning forward from the identifier balances THOSE
// instead of the literal — which parses to zero entries and ships an empty
// sameAs list / FAQPage with no error.
export const readExportedArrayBody = (relativePath, declaration) => {
  const source = readFile(relativePath);
  const declarationStart = source.indexOf(`export const ${declaration}`);
  const initializerStart = declarationStart >= 0 ? source.indexOf('=', declarationStart) : -1;
  const arrayStart = initializerStart >= 0 ? source.indexOf('[', initializerStart) : -1;
  const arrayEnd = arrayStart >= 0 ? scanToMatching(source, arrayStart, '[', ']') : -1;

  if (declarationStart < 0 || initializerStart < 0 || arrayStart < 0 || arrayEnd < 0) {
    throw new Error(
      `Unable to locate export const ${declaration} in ${relativePath}. `
      + `declarationStart=${declarationStart}, initializerStart=${initializerStart}, `
      + `arrayStart=${arrayStart}, arrayEnd=${arrayEnd}.`
    );
  }

  return source.slice(arrayStart + 1, arrayEnd);
};

export const parseBrandSameAs = () => {
  const links = [...readExportedArrayBody('constants.ts', 'BRAND_SAME_AS_LINKS').matchAll(/(['"])(.*?)\1/g)]
    .map((match) => unescapeStringLiteral(match[2]))
    .filter(Boolean);

  if (links.length === 0) {
    throw new Error('BRAND_SAME_AS_LINKS parsed to zero entries — the Organization sameAs list would ship empty.');
  }

  return links;
};

// HELP_FAQS (data/helpFaqs.ts) is the single owner of the /help copy: the page
// renders it and the FAQPage JSON-LD is built from it. Same parse-don't-import
// reason as above.
export const parseHelpFaqs = () => {
  const faqs = splitTopLevelObjects(readExportedArrayBody('data/helpFaqs.ts', 'HELP_FAQS'))
    .map((block) => ({
      id: readStringField(block, 'id'),
      question: readStringField(block, 'question'),
      answer: readStringField(block, 'answer'),
    }))
    .filter((faq) => faq.question && faq.answer);

  if (faqs.length === 0) {
    throw new Error('HELP_FAQS parsed to zero questions — the prerendered FAQPage would ship an empty mainEntity.');
  }

  return faqs;
};

export const organizationJsonLd = (sameAs) => ({
  '@id': ORGANIZATION_ID,
  '@type': 'Organization',
  name: 'Coalition',
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
  sameAs,
});

export const webSiteJsonLd = () => ({
  '@id': WEBSITE_ID,
  '@type': 'WebSite',
  name: 'Coalition',
  url: SITE_ORIGIN,
  description: DEFAULT_DESCRIPTION,
  inLanguage: 'en-US',
  publisher: { '@id': ORGANIZATION_ID },
});

export const webPageJsonLd = (pagePath, name, description) => ({
  '@id': `${absoluteUrl(pagePath)}#webpage`,
  '@type': 'WebPage',
  name,
  description,
  url: absoluteUrl(pagePath),
  isPartOf: { '@id': WEBSITE_ID },
});

export const faqPageJsonLd = (pagePath, faqs) => ({
  '@id': `${absoluteUrl(pagePath)}#faq`,
  '@type': 'FAQPage',
  url: absoluteUrl(pagePath),
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

export const aboutPageJsonLd = () => ({
  '@id': absoluteUrl('/about'),
  '@type': 'AboutPage',
  name: 'About Coalition',
  description:
    "Coalition was born from loss. Gmoneyworld — more than a brand, it's a movement. Quality, community, and the hustle, built by hand in Baltimore.",
  url: absoluteUrl('/about'),
  // Reference, not a redefinition: organizationJsonLd() ships in the same graph.
  mainEntity: { '@id': ORGANIZATION_ID },
});

// One `@graph` per page with a single `@context`; any per-node `@context` is
// dropped so a node shared by two graphs stays byte-identical between them.
export const buildStructuredDataGraph = (nodes) => ({
  '@context': 'https://schema.org',
  '@graph': nodes.filter(Boolean).map((node) => {
    const copy = { ...node };
    delete copy['@context'];
    return copy;
  }),
});

// `route.structuredData` names the node kinds for that page. Anything unknown
// throws rather than silently shipping a page with no structured data.
const routeNodes = (route, context) =>
  (route.structuredData || []).map((kind) => {
    switch (kind) {
      case 'organization':
        return organizationJsonLd(context.sameAs);
      case 'webSite':
        return webSiteJsonLd();
      case 'webPage':
        return webPageJsonLd(route.path, route.title, route.description);
      case 'faqPage':
        return faqPageJsonLd(route.path, context.faqs);
      case 'aboutPage':
        return aboutPageJsonLd();
      default:
        throw new Error(`Unknown structuredData kind "${kind}" on route ${route.path}.`);
    }
  });

// Everything a route's <head> needs for search and social. One owner, so the
// share card, the title and the description can only change together.
// Mirrors what components/Seo.tsx computes at runtime: the card comes from the
// SAME path rule (shareCardPath here, shareCardImage in utils/seo.ts) and the
// same 1200x630 declaration, which tests/seoMeta.test.ts compares directly.
export const buildRouteSeo = (route) => ({
  title: route.title,
  description: route.description,
  image: absoluteUrl(shareCardPath(route.path)),
  // Mirrors components/Seo.tsx: the route's own card is announced with the page
  // title, and the generic card keeps the brand description. Same strings, or the
  // served head and the hydrated head disagree about the same image.
  imageAlt: route.cardTitle ? `${route.title} share card` : DEFAULT_IMAGE_ALT,
  imageWidth: DEFAULT_IMAGE_WIDTH,
  imageHeight: DEFAULT_IMAGE_HEIGHT,
  url: absoluteUrl(route.path),
  type: 'website',
});

export const buildRouteStructuredData = (route, products, context) => {
  const nodes = routeNodes(route, context);

  if (route.collection) {
    const matching = products.filter(route.collection.where);
    nodes.push(
      collectionJsonLd(
        route.collection.sort ? route.collection.sort(matching) : matching,
        route.collection.name,
        route.path
      )
    );
  }

  return nodes.length > 0 ? buildStructuredDataGraph(nodes) : undefined;
};

export const buildHomeStructuredData = (sameAs) =>
  buildStructuredDataGraph([organizationJsonLd(sameAs), webSiteJsonLd()]);

// Writes one meta tag, replacing any tag inherited from index.html (every
// prerendered page starts as a copy of the homepage shell). An undefined
// content REMOVES the tag instead of blanking it: a product page must not keep
// the share card's 1200x630 declaration while pointing at a product photo.
const replaceOrInsertMeta = (html, attribute, key, content) => {
  // Capture the leading whitespace so a replacement keeps the tag's original
  // position in the head (a plain `\s*` match would swallow the line break and
  // fold the tag onto the previous line).
  const pattern = new RegExp(`(\\s*)<meta\\s+${attribute}="${key}"[^>]*>`, 'i');
  const match = html.match(pattern);

  if (content === undefined || content === null || content === '') {
    return match ? html.replace(match[0], '') : html;
  }

  const replacement = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;

  if (match) {
    // Function replacement, not a string: a description containing "$&" or
    // "$50" would otherwise be read as a substitution pattern and mangled.
    return html.replace(match[0], () => `${match[1] || '\n  '}${replacement}`);
  }

  return html.replace('</head>', `  ${replacement}\n</head>`);
};

const replaceOrInsertCanonical = (html, href) => {
  const replacement = `<link rel="canonical" href="${escapeHtml(href)}" />`;
  const pattern = /(\s*)<link\s+rel="canonical"[^>]*>/i;
  const match = html.match(pattern);

  if (match) {
    return html.replace(match[0], () => `${match[1] || '\n  '}${replacement}`);
  }

  return html.replace('</head>', `  ${replacement}\n</head>`);
};

// Replaces any previously injected static JSON-LD. Idempotent, so a page
// rebuilt from an already-injected base never ends up with two graphs.
const injectJsonLd = (html, jsonLd) => {
  const output = html.replace(
    /\s*<script\s+type="application\/ld\+json"\s+data-seo-static-jsonld="true">[\s\S]*?<\/script>/gi,
    ''
  );

  if (!jsonLd) return output;

  return output.replace(
    '</head>',
    `  <script type="application/ld+json" data-seo-static-jsonld="true">${JSON.stringify(jsonLd)}</script>\n</head>`
  );
};

export const injectSeo = (html, seo, jsonLd) => {
  // Function replacements throughout: titles and descriptions routinely contain
  // "$" (prices), and `$&`/`$5` in a replacement string is a substitution
  // pattern, not text.
  let output = injectJsonLd(
    html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(seo.title)}</title>`),
    null
  );

  output = replaceOrInsertMeta(output, 'name', 'description', seo.description);
  output = replaceOrInsertMeta(output, 'name', 'robots', 'index,follow');
  output = replaceOrInsertMeta(output, 'property', 'og:title', seo.title);
  output = replaceOrInsertMeta(output, 'property', 'og:description', seo.description);
  output = replaceOrInsertMeta(output, 'property', 'og:type', seo.type || 'website');
  output = replaceOrInsertMeta(output, 'property', 'og:url', seo.url);
  output = replaceOrInsertMeta(output, 'property', 'og:image', seo.image);
  output = replaceOrInsertMeta(output, 'property', 'og:image:alt', seo.imageAlt);
  output = replaceOrInsertMeta(
    output,
    'property',
    'og:image:width',
    seo.imageWidth ? String(seo.imageWidth) : undefined
  );
  output = replaceOrInsertMeta(
    output,
    'property',
    'og:image:height',
    seo.imageHeight ? String(seo.imageHeight) : undefined
  );
  output = replaceOrInsertMeta(output, 'property', 'og:site_name', 'Coalition');
  output = replaceOrInsertMeta(output, 'property', 'og:locale', SEO_LOCALE);
  output = replaceOrInsertMeta(output, 'name', 'twitter:card', 'summary_large_image');
  output = replaceOrInsertMeta(output, 'name', 'twitter:site', '@sgcoalition');
  output = replaceOrInsertMeta(output, 'name', 'twitter:title', seo.title);
  output = replaceOrInsertMeta(output, 'name', 'twitter:description', seo.description);
  output = replaceOrInsertMeta(output, 'name', 'twitter:image', seo.image);
  output = replaceOrInsertMeta(output, 'name', 'twitter:image:alt', seo.imageAlt);
  output = replaceOrInsertCanonical(output, seo.url);

  if (seo.type === 'product' && typeof seo.price === 'number') {
    output = replaceOrInsertMeta(output, 'property', 'product:price:amount', Number(seo.price).toFixed(2));
    output = replaceOrInsertMeta(output, 'property', 'product:price:currency', 'USD');
  }

  return injectJsonLd(output, jsonLd);
};

// Without JavaScript a page that carries its own article IS that article, so the
// two full-viewport layers the shell uses for the opposite case must not cover it:
// #initial-loader (fixed, opaque, z-index 99999) and #noscript-fallback (fixed,
// z-index 100000, the "JavaScript is required" curtain). The rules sit inside
// <noscript>, so they reach only visitors without scripting — everyone with
// JavaScript sees exactly what they saw before — and the reading column is here
// because a served copy nobody can read would not be the point. Declaration order
// matters: this is the last thing in the head, so it wins over the shell's rules.
const NO_JS_ARTICLE_STYLES = `<noscript><style>
    #initial-loader { display: none; }
    #noscript-fallback { position: static; background: transparent; }
    #${PRERENDERED_ARTICLE_ID} { max-width: 56rem; margin: 0 auto; padding: 6rem 1rem 3rem; line-height: 1.7; }
    #${PRERENDERED_ARTICLE_ID} img { max-width: 100%; height: auto; border-radius: 1rem; }
  </style></noscript>`;

const withNoJsArticleStyles = (html) => {
  if (!html.includes('</head>')) {
    throw new Error('The shell has no </head> to put the no-JS article styles in.');
  }
  return html.replace('</head>', `  ${NO_JS_ARTICLE_STYLES}\n</head>`);
};

// Puts the page's own text inside #root, where the app renders it, so the served
// HTML reads without JavaScript. index.tsx removes this copy on boot and the app
// renders the same post from the live table, so nothing is shown twice. Throws
// when the marker is gone: a silent miss would ship every post as a head over an
// empty body, which is the bug this exists to fix.
export const injectPrerenderedArticle = (html, articleHtml) => {
  if (!articleHtml) return html;

  const match = html.match(/<div\s+id="root"[^>]*>/i);
  if (!match) {
    throw new Error('The shell has no <div id="root"> to put the prerendered article in.');
  }

  const insertAt = match.index + match[0].length;
  return `${withNoJsArticleStyles(html.slice(0, insertAt))}\n${articleHtml}\n${html.slice(insertAt)}`;
};

const writeStaticPage = (baseHtml, pagePath, seo, jsonLd, articleHtml = '') => {
  const outputDir = path.join(DIST_DIR, pagePath.replace(/^\//, ''), 'index.html');
  ensureDir(path.dirname(outputDir));
  fs.writeFileSync(outputDir, injectPrerenderedArticle(injectSeo(baseHtml, seo, jsonLd), articleHtml));
};

// Exported so tests/generateSeoArtifacts.test.ts can pin the priority +
// changefreq logic without going through the full prebuild pipeline.
// The `main()` guard at the bottom only fires when the module is launched
// directly via `node scripts/generateSeoArtifacts.mjs`, NOT when this file
// is imported from a test — same convention as the existing field-extractor
// helpers. The published / prebuild flow writes to public/sitemap.xml and
// (when present) dist/sitemap.xml; tests call this function with synthetic
// product fixtures and assert on the returned XML string.
// Static routes that get their own prerendered page. ONE list drives BOTH the
// sitemap and the prerenderer, so a route can no longer be advertised in
// sitemap.xml while its URL serves the generic SPA shell whose canonical is
// "/" — the drift that left /membership, /about, /wallets, /sgcoin, /help,
// /live-orders and /community pointing crawlers at the homepage.
//
// '/' is deliberately absent: dist/index.html IS its page, and Vite already
// writes it with the correct canonical.
//
// Each `title`/`description` mirrors the copy the page sets at runtime via
// <Seo>, so the prerendered meta and the client-set meta agree; pages without
// a <Seo> (membership, sgcoin) get copy written here, and titles already
// containing the brand name are left unprefixed exactly as components/Seo.tsx
// would.
// `collection` emits an ItemList JSON-LD over the matching products.
// `structuredData` names the JSON-LD node kinds for the page (see routeNodes).
// Every route declares at least Organization + WebPage; pages that mount a
// <Seo> rebuild the identical graph at runtime, and pages that do not keep the
// prerendered one, so no route ships with an empty head.
// `cardTitle` is the headline of the route's social share card — a short label,
// not the SEO title. scripts/generateOgCard.mjs requires it. The runtime resolves
// the same card through shareCardImage() (utils/seo.ts), pinned by tests/seoMeta.
export const STATIC_ROUTES = [
  {
    path: '/shop',
    priority: '0.9',
    changefreq: 'daily',
    title: 'Coalition | Shop Streetwear Drops',
    description: 'Shop Coalition streetwear drops, limited wallets, tees, hats, and archive-ready pieces from Baltimore.',
    cardTitle: 'Shop Drops',
    structuredData: ['organization', 'webPage'],
    collection: { name: 'Coalition Shop', where: (product) => !product.archived },
  },
  {
    path: '/wallets',
    priority: '0.6',
    changefreq: 'monthly',
    title: 'Coalition | Premium Wallets',
    description: 'Hand-built, one-of-one, full-grain leather wallets. Made in-house, drop by drop — no factory, no shortcuts, just the process.',
    cardTitle: 'Premium Wallets',
    structuredData: ['organization', 'webPage'],
  },
  {
    path: '/archive',
    priority: '0.7',
    changefreq: 'weekly',
    title: 'Coalition | Archive',
    description: 'Explore the Coalition archive of sold-out drops, 1/1 customs, limited wallets, and past releases.',
    cardTitle: 'The Archive',
    structuredData: ['organization', 'webPage'],
    collection: {
      name: 'Coalition Archive',
      where: (product) => product.archived,
      sort: sortArchivedProducts,
    },
  },
  {
    path: '/about',
    priority: '0.5',
    changefreq: 'monthly',
    title: 'About | Coalition | Crafted in Baltimore',
    description:
      "Coalition was born from loss. Gmoneyworld — more than a brand, it's a movement. Quality, community, and the hustle, built by hand in Baltimore.",
    cardTitle: 'Our Story',
    structuredData: ['organization', 'aboutPage'],
  },
  {
    path: '/membership',
    priority: '0.5',
    changefreq: 'monthly',
    title: 'Membership | Coalition VIP',
    description: 'Coalition VIP membership — $15/month. Get $15 monthly store credit, 15 giveaway tickets, early access to drops, and free shipping.',
    cardTitle: 'VIP Membership',
    structuredData: ['organization', 'webPage'],
  },
  {
    path: '/sgcoin',
    priority: '0.5',
    changefreq: 'monthly',
    title: 'Coalition | SGCOIN',
    description: 'Buy Coalition SGCOIN directly and receive 10% more coins than swapping — delivered to your wallet within 24 hours.',
    cardTitle: 'SGCOIN',
    structuredData: ['organization', 'webPage'],
  },
  {
    path: '/help',
    priority: '0.4',
    changefreq: 'monthly',
    title: 'Coalition | Help Center',
    description: 'Answers on orders, shipping, returns, membership and SGCOIN, plus AI-powered support from the Coalition team.',
    cardTitle: 'Help Center',
    structuredData: ['organization', 'webPage', 'faqPage'],
  },
  {
    path: '/live-orders',
    priority: '0.7',
    changefreq: 'hourly',
    title: 'Coalition | Recently Ordered',
    description: 'A live feed of real Coalition orders moving across the country — recently ordered pieces, updated as they ship.',
    cardTitle: 'Live Orders',
    structuredData: ['organization', 'webPage'],
  },
  {
    path: '/community',
    priority: '0.5',
    changefreq: 'weekly',
    title: 'Community | Coalition | Built in Baltimore, by hand',
    description: 'Join the Coalition community — Discord, Instagram, X, YouTube, and the buyer log. Real conversations, real orders, real builds.',
    cardTitle: 'Community',
    structuredData: ['organization', 'webPage'],
  },
  {
    path: '/blog',
    priority: '0.6',
    changefreq: 'weekly',
    title: 'Coalition | Community Updates',
    description: 'Drop announcements, build notes and community updates from Coalition — written as each release ships.',
    cardTitle: 'Community Updates',
    structuredData: ['organization', 'webPage'],
  },
];

// ── Blog posts ───────────────────────────────────────────────────────────────
//
// A post is prerendered exactly like a product: one page per slug, with its own
// head and its own JSON-LD. Post URLs are NOT in STATIC_ROUTES, because a static
// route must own a generated share card (scripts/generateOgCard.mjs throws
// without a cardTitle) while a post's share image is its own cover photo.
//
// The list comes from the live `posts` table — the same rows pages/Blog.tsx
// renders — because that table is the live source: scripts/generateDropPost.ts
// writes it from the drop registry's copy.* and pages/admin/BlogManager.tsx
// edits it. The registry is the offline fallback, so the build never depends on
// a network read and a post that exists in copy.* but not yet in the table still
// ships its own head instead of the shell whose canonical is "/" — the bug that
// left /membership, /about and /wallets claiming to be the homepage.
//
// Both paths return the same shape, so everything downstream has one owner:
//   { slug, title, excerpt, content, author, coverImage, publishedAt, tags,
//     category }
// `content` is what the prerendered article is built from; the registry holds it
// as a template literal, the table as the `content` column.
export const blogPostPath = (slug) => `/blog/${encodeURIComponent(slug)}`;

// Mirrors components/Seo.tsx's prefix rule. Duplicated rather than imported
// because this script is plain Node; tests/seoMeta.test.ts compares the two.
const brandTitle = (title) => (title.includes('Coalition') ? title : `Coalition | ${title}`);

const POST_SUPABASE_TIMEOUT_MS = 5000;

// Same fallback chain as utils/seo.ts's buildBlogPostDescription: the authored
// excerpt, else the body as plain text, else a sentence built only from what the
// post actually asserts.
const postDescription = (post) =>
  truncateSeoText(
    post.excerpt
      || cleanText(post.content || '')
      || `${post.title} — a Coalition drop, written when it shipped.`
  );

const postDate = (post) => {
  const parsed = new Date(post.publishedAt || post.createdAt || '');
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

// drops.ts is TypeScript and this script is plain Node, so it is parsed the same
// way constants/products.ts is. Only the copy block is needed: the post's
// headline and snippet, plus the spec's front image as its cover.
//
// The registry cannot say whether a drop has been published yet, so this path
// emits every drop it knows. Only an offline build (or a table outage) can reach
// it, and the live table stays authoritative — but that is the trade: a build
// with no database gives a not-yet-published drop a page and a sitemap row.
export const parseRegistryPosts = () => {
  const source = readFile('scripts/story-reveal-specs/drops.ts');
  const declarationStart = source.indexOf('export const DROPS');
  const initializerStart = declarationStart >= 0 ? source.indexOf('=', declarationStart) : -1;
  const mapStart = initializerStart >= 0 ? source.indexOf('{', initializerStart) : -1;
  const mapEnd = mapStart >= 0 ? scanToMatching(source, mapStart, '{', '}') : -1;

  if (declarationStart < 0 || mapStart < 0 || mapEnd < 0) {
    throw new Error(
      'Unable to locate the DROPS registry in scripts/story-reveal-specs/drops.ts. '
      + `declarationStart=${declarationStart}, mapStart=${mapStart}, mapEnd=${mapEnd}.`
    );
  }

  const body = source.slice(mapStart + 1, mapEnd);
  const posts = [];
  const entryPattern = /(['"])([a-z0-9-]+)\1\s*:\s*\{/g;
  let entry;

  while ((entry = entryPattern.exec(body))) {
    const entryStart = body.indexOf('{', entry.index + entry[0].length - 1);
    const entryEnd = entryStart >= 0 ? scanToMatching(body, entryStart, '{', '}') : -1;
    if (entryEnd < 0) continue;

    const block = body.slice(entryStart, entryEnd + 1);
    const slug = readStringField(block, 'postSlug');
    const title = readStringField(block, 'postTitle');
    if (!slug || !title) continue;

    const tagList = block.match(/postTags\s*:\s*\[([^\]]*)\]/);
    const front = readStringField(block, 'front');
    const dropDate = readStringField(block, 'dropDate');

    posts.push({
      slug,
      title,
      excerpt: readStringField(block, 'postExcerpt'),
      content: readTemplateField(block, 'postBody'),
      author: 'Coalition',
      coverImage: front ? `/${front.replace(/^\.\.\/\.\.\/public\//, '')}` : '',
      // Matches the published_at scripts/generateDropPost.ts writes for a drop.
      publishedAt: dropDate ? `${dropDate}T16:00:00.000Z` : '',
      tags: tagList ? [...tagList[1].matchAll(/(['"])(.*?)\1/g)].map((match) => match[2]) : ['drop'],
      category: 'drop',
    });
  }

  if (posts.length === 0) {
    throw new Error('The drop registry parsed to zero posts — every fallback blog page would vanish.');
  }

  return posts;
};

// Published rows only, mirroring the query in pages/Blog.tsx. Returns null (not
// an empty array) when the table cannot be read, so the caller can tell
// "unreachable" from "nothing published yet" and fall back deliberately.
// This script runs as its own Node process (prebuild/postbuild), so Vite's .env
// loading does not reach it — without this a local build would always take the
// registry fallback while a deploy read the table, and the two would disagree
// about which pages exist. Vercel injects real environment variables, so on a
// deploy this is a no-op. Lazily and optionally: no dotenv or no .env is a
// normal state (tests and a bare checkout), not an error.
const loadLocalEnv = () => {
  if (process.env.VITE_SUPABASE_URL) return;

  try {
    createRequire(import.meta.url)('dotenv').config({
      path: path.join(ROOT, '.env'),
      quiet: true,
    });
  } catch {
    // Falls through to the registry fallback.
  }
};

export const fetchPublishedPosts = async () => {
  loadLocalEnv();

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || /placeholder/i.test(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), POST_SUPABASE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${url.replace(/\/+$/, '')}/rest/v1/posts`
        + '?select=slug,title,excerpt,cover_image,tags,published_at,category,author,content,is_published'
        + '&is_published=eq.true&order=published_at.desc',
      { headers: { apikey: key, authorization: `Bearer ${key}` }, signal: controller.signal }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('no published rows');

    return rows
      .filter((row) => row && row.slug && row.title)
      .map((row) => ({
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt || '',
        // The body as authored. This is the only reason the prerendered page can
        // carry the article at all, so it is fetched with the rest of the row.
        content: row.content || '',
        author: row.author || 'Coalition',
        coverImage: row.cover_image || '',
        publishedAt: row.published_at || '',
        tags: Array.isArray(row.tags) ? row.tags : [],
        category: row.category || 'drop',
      }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`[seo] posts table unavailable (${reason}) — reading the drop registry instead.`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

// Mirrors getBlogPostSeo in utils/seo.ts (compared by tests/seoMeta.test.ts). A
// post with a cover photo announces that photo and no declared size — the rule a
// product page follows, because a 1200x630 declaration on a photo of another
// shape makes scrapers crop it. A post with no cover keeps the generic card.
export const getPostSeo = (post) => ({
  title: brandTitle(post.title),
  description: postDescription(post),
  image: post.coverImage ? absoluteUrl(post.coverImage) : absoluteUrl(DEFAULT_IMAGE),
  imageAlt: post.coverImage ? `${brandTitle(post.title)} — drop photograph` : DEFAULT_IMAGE_ALT,
  imageWidth: post.coverImage ? undefined : DEFAULT_IMAGE_WIDTH,
  imageHeight: post.coverImage ? undefined : DEFAULT_IMAGE_HEIGHT,
  url: absoluteUrl(blogPostPath(post.slug)),
  path: blogPostPath(post.slug),
  type: 'article',
});

// Mirrors buildBlogPostJsonLd in utils/seo.ts, which no test compares yet because
// the runtime side ships the same node the same way pages/ProductDetails.tsx
// ships a Product. Keep the two in step by hand, like productJsonLd above.
export const postJsonLd = (post) => {
  const seo = getPostSeo(post);
  const keywords = (post.tags || []).join(', ');
  const datePublished = postDate(post);

  return {
    '@context': 'https://schema.org',
    '@id': `${seo.url}#article`,
    '@type': 'BlogPosting',
    headline: post.title,
    description: seo.description,
    image: [seo.image],
    ...(datePublished ? { datePublished } : {}),
    author: { '@type': 'Organization', name: 'Coalition' },
    publisher: {
      '@type': 'Organization',
      name: 'Coalition',
      logo: { '@type': 'ImageObject', url: ORGANIZATION_LOGO },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': seo.url },
    url: seo.url,
    articleSection: post.category || 'drop',
    ...(keywords ? { keywords } : {}),
    inLanguage: 'en-US',
  };
};

// ── The prerendered article ──────────────────────────────────────────────────
// A crawler or an AI reader has to be able to read a post without running
// JavaScript, and this app renders posts from a network read — so the served HTML
// would otherwise be a correct head over an empty body. The article below is built
// from the same row the page renders (the live table, with the drop registry as
// the offline fallback) and lands inside the page's own #root.
//
// It is the page's own copy, not a summary of it: the body goes through the exact
// rules pages/BlogPostView.tsx applies — the same asset rewrite first, then the
// same allow-list — so what a crawler reads and what a visitor sees cannot drift.
// Those rules are not restated here. They are parsed out of the modules that own
// them, the same parse-don't-import contract constants/products.ts, constants.ts
// and data/helpFaqs.ts already live under:
//
//   utils/blogSanitize.ts       the allow-list DOMPurify is configured with
//   utils/localImageAssets.ts   the rewrites rewriteImageSrcs / resolveLocalImageUrl
//                               apply to a post row's images
//
// The node itself — its id and its tags — comes from utils/prerenderedArticle.mjs,
// imported at the top of this file because index.tsx imports the same module to
// remove the node it writes. Those two used to spell the id out separately.
//
// Nothing from a post body is copied through: this walks the source and re-emits
// only what the allow-list names, with every run of text entity-decoded once (as
// the browser's parser does) and escaped once at write time. A comment disappears,
// refused embedded content disappears with its text, a refused tag keeps its text,
// and an attribute or URL scheme the allow-list does not name cannot survive.
//
// Both parses throw rather than degrade: a policy that reads as empty would ship
// unfiltered post HTML, and an empty rewrite map would ship the wrong images.
let blogPolicyCache = null;
const blogSanitizePolicy = () => {
  if (blogPolicyCache) return blogPolicyCache;

  const values = (declaration) =>
    [...readExportedArrayBody('utils/blogSanitize.ts', declaration).matchAll(/(['"])(.*?)\1/g)].map(
      (match) => match[2]
    );

  const tags = values('BLOG_ALLOWED_TAGS');
  const attributes = values('BLOG_ALLOWED_ATTR');
  if (tags.length === 0 || attributes.length === 0) {
    throw new Error(
      'utils/blogSanitize.ts parsed to an empty allow-list — the served article would ship unfiltered post HTML.'
    );
  }

  blogPolicyCache = { tags: new Set(tags), attributes: new Set(attributes) };
  return blogPolicyCache;
};

// The two asset maps from utils/localImageAssets.ts, in declaration order: literal
// keys, `PRODUCT_IMAGE_URLS.<group>.<key>` values resolved through the catalog the
// product image parser already builds.
let imageMapsCache = null;
const imageUrlMaps = () => {
  if (imageMapsCache) return imageMapsCache;

  const source = readFile('utils/localImageAssets.ts');
  const catalog = parseImageCatalog();

  const readMap = (declaration) => {
    const declarationStart = source.indexOf(`const ${declaration}`);
    const objectStart = declarationStart >= 0 ? source.indexOf('{', declarationStart) : -1;
    const objectEnd = objectStart >= 0 ? scanToMatching(source, objectStart, '{', '}') : -1;
    if (objectStart < 0 || objectEnd < 0) {
      throw new Error(`Unable to locate the ${declaration} map in utils/localImageAssets.ts.`);
    }

    const pairs = [];
    const pairPattern = /(['"])(.*?)\1\s*:\s*(?:PRODUCT_IMAGE_URLS\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)|(['"])(.*?)\5)/g;
    let pair;

    while ((pair = pairPattern.exec(source.slice(objectStart + 1, objectEnd)))) {
      const from = unescapeStringLiteral(pair[2]);
      const to = pair[3] ? catalog.get(`${pair[3]}.${pair[4]}`) : unescapeStringLiteral(pair[6]);
      if (!to) {
        throw new Error(`No PRODUCT_IMAGE_URLS entry for ${pair[3]}.${pair[4]} — a post image would lose its rewrite.`);
      }
      pairs.push([from, to]);
    }

    if (pairs.length === 0) {
      throw new Error(`${declaration} parsed to zero entries — post images would ship unrewritten.`);
    }

    return pairs;
  };

  const remoteToLocal = readMap('REMOTE_TO_LOCAL_IMAGE_URLS');
  imageMapsCache = {
    rewrites: remoteToLocal,
    remoteToLocal: new Map(remoteToLocal),
    localToRemote: new Map(readMap('LOCAL_TO_REMOTE_IMAGE_URLS')),
  };
  return imageMapsCache;
};

// Mirrors data/blogPosts.ts, which owns this rewrite: every post row is passed
// through rewriteImageSrcs there before the page ever sees it, so the served
// copy has to make the same substitution (in the same declaration order).
const rewriteKnownImageSrcs = (html) =>
  imageUrlMaps().rewrites.reduce((acc, [from, to]) => acc.split(from).join(to), String(html || ''));

// Mirrors resolveLocalImageUrl, which data/blogPosts.ts applies to a post's cover
// photo before the page renders it.
const resolveCoverImage = (url) => {
  const maps = imageUrlMaps();
  return maps.localToRemote.get(url) || maps.remoteToLocal.get(url) || url;
};

// Decodes the references this content actually carries; everything else is left
// to escapeHtml at write time. &amp; goes last so a literal "&amp;lt;" decodes to
// "&lt;" rather than to "<", and so a stray "&" is not double-decoded.
const decodeHtmlEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&hellip;/gi, '\u2026')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, '&');

// DOMPurify removes these WITH their content (its FORBID_CONTENTS defaults), so
// their text never reaches the page and must not reach the served copy either.
const DROPPED_CONTENT_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'template', 'svg', 'math', 'title',
  'xmp', 'plaintext', 'noembed', 'noframes', 'head',
]);

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr',
]);

// A URL attribute survives only with a scheme that cannot execute. DOMPurify
// strips whitespace and control characters before it checks, so "java\nscript:"
// is refused there; the same normalization has to refuse it here.
const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const isSafeUrlValue = (value) => {
  const normalized = String(value).replace(/[\s\u0000-\u001F\u007F]+/g, '').toLowerCase();
  if (!normalized) return false;
  const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/);
  return scheme ? SAFE_URL_SCHEMES.has(scheme[1]) : true;
};

// Text needs &, < and > escaped; a quote is only dangerous inside an attribute,
// and escaping it in text would put &quot; where the page shows a quotation mark.
const escapeText = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Only attributes the runtime allow-list names are emitted, and only the tags the
// runtime allows ever call this — so no event handler, style or data-* attribute
// has a path into the served page.
const renderAllowedAttributes = (source, policy) => {
  const rendered = [];
  const attributePattern = /([a-zA-Z_:][a-zA-Z0-9:._-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
  let match;

  while ((match = attributePattern.exec(source))) {
    const name = match[1].toLowerCase();
    if (!policy.attributes.has(name)) continue;

    const value = decodeHtmlEntities(String(match[2] || '').replace(/^["']|["']$/g, ''));
    if ((name === 'href' || name === 'src') && !isSafeUrlValue(value)) continue;

    rendered.push(` ${name}="${escapeHtml(value)}"`);
  }

  return rendered.join('');
};

// Renders a post body exactly as the page renders it: the same data-layer rewrite,
// then the same allow-list, with the same refusals and the same output shape. An
// authored comment disappears (DOMPurify drops it), a refused tag keeps its words,
// an attribute outside the allow-list is gone, and markup the page shows is markup
// the served copy shows — "cleanly dropped or faithfully reproduced", never
// mangled into visible escaped text. Exported so tests can assert the rules without
// going through a whole page.
export const renderPostBody = (html) => {
  const policy = blogSanitizePolicy();
  const authored = String(html || '');
  // The page's own rule for a body with no markup: newlines become line breaks.
  // Anything carrying a tag is rendered as authored.
  const source = rewriteKnownImageSrcs(
    /<\/?[a-z][\s\S]*>/i.test(authored) ? authored : authored.replace(/\n/g, '<br />')
  );
  const output = [];
  const open = [];
  const tagPattern = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let cursor = 0;
  let match;

  while ((match = tagPattern.exec(source))) {
    output.push(escapeText(decodeHtmlEntities(source.slice(cursor, match.index))));
    cursor = tagPattern.lastIndex;

    if (match[0].startsWith('<!--')) continue;

    const closing = match[1] === '/';
    const name = match[2].toLowerCase();

    if (DROPPED_CONTENT_TAGS.has(name)) {
      if (!closing) {
        const rest = source.slice(cursor).match(new RegExp(`<\/${name}\\s*>`, 'i'));
        if (rest) {
          cursor += rest.index + rest[0].length;
          tagPattern.lastIndex = cursor;
        }
      }
      continue;
    }

    // A tag the allow-list refuses keeps its text, exactly as DOMPurify leaves it.
    if (!policy.tags.has(name)) continue;

    if (closing) {
      const index = open.lastIndexOf(name);
      if (index < 0) continue;
      while (open.length > index) output.push(`</${open.pop()}>`);
      continue;
    }

    output.push(`<${name}${renderAllowedAttributes(match[3] || '', policy)}${VOID_ELEMENTS.has(name) ? ' /' : ''}>`);
    if (!VOID_ELEMENTS.has(name)) open.push(name);
  }

  output.push(escapeText(decodeHtmlEntities(source.slice(cursor))));
  while (open.length) output.push(`</${open.pop()}>`);

  return output.join('');
};

// The byline the rendered page shows above the title: category, date, author —
// only the parts the row actually asserts.
const articleByline = (post) => {
  const parts = [];
  if (post.category) parts.push(escapeText(post.category));

  const parsed = new Date(post.publishedAt || post.createdAt || '');
  if (!Number.isNaN(parsed.getTime())) {
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(parsed);
    parts.push(`<time datetime="${escapeHtml(parsed.toISOString())}">${escapeText(label)}</time>`);
  }

  if (post.author) parts.push(escapeText(post.author));
  return parts.join(' \u00b7 ');
};

// The served copy of a post: the page's own byline, title and body, in that order,
// plus the cover photograph only when the body does not already show it — the drop
// posts open with their cover image, and printing it twice would say the piece has
// two front photographs. Falls back to the excerpt so a row with an empty body
// still ships its own words rather than a body-less page.
export const postArticleHtml = (post) => {
  const body = renderPostBody(String(post.content || post.excerpt || ''));
  const shownImages = new Set(
    [...body.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((match) => match[1])
  );

  const lines = [PRERENDERED_ARTICLE_OPEN];

  const byline = articleByline(post);
  if (byline) lines.push(`  <p>${byline}</p>`);
  if (post.title) lines.push(`  <h1>${escapeText(post.title)}</h1>`);

  const cover = post.coverImage ? resolveCoverImage(String(post.coverImage)) : '';
  if (cover && !shownImages.has(escapeHtml(cover))) {
    lines.push(`  <img src="${escapeHtml(cover)}" alt="${escapeHtml(post.title || '')}" />`);
  }

  if (body.trim()) lines.push(`  ${body}`);
  lines.push(PRERENDERED_ARTICLE_CLOSE);
  return lines.join('\n');
};

export const buildSitemap = (products, posts = []) => {
  const today = new Date().toISOString().slice(0, 10);
  // Derived from STATIC_ROUTES so the sitemap and the prerendered pages can
  // never disagree about which static routes exist. '/' leads (it is the
  // homepage and the highest priority) and is the one route with no separate
  // prerender — dist/index.html is already its page.
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    ...STATIC_ROUTES.map(({ path: loc, priority, changefreq }) => ({ loc, priority, changefreq })),
  ];
  // Limited-edition products retain the active-product priority + weekly
  // changefreq even when archived, because 1/1 and numbered limited pieces
  // (Coalition 'Grey Wave' 1/2 → 2/2, Coalition 'Racing Team' 1/4 → 4/4,
  // Coalition x True Religion 1/1, etc.) continue to draw long-tail SEO
  // queries long after they sell out. Standard archive pieces that are NOT
  // limited editions still demote to 0.6/monthly per the original rule.
  // Locked by tests/generateSeoArtifacts.test.ts > SEO sitemap priorities.
  const productPages = products.map((product) => {
    const isDemoted = (product.archived || Boolean(product.soldAt)) && !product.isLimitedEdition;
    return {
      loc: productPath(product.id),
      priority: isDemoted ? '0.6' : '0.8',
      changefreq: isDemoted ? 'monthly' : 'weekly',
    };
  });
  // Blog posts are advertised from the same list the prerenderer writes pages
  // for: a URL in sitemap.xml with no page behind it serves the shell whose
  // canonical is "/", and a page with no sitemap entry is invisible. lastmod is
  // the post's own publication date, which is a real signal, instead of the
  // build date every other entry carries.
  const postPages = posts.map((post) => ({
    loc: blogPostPath(post.slug),
    priority: '0.6',
    changefreq: 'monthly',
    lastmod: postDate(post).slice(0, 10) || today,
  }));
  const urls = [...staticPages, ...productPages, ...postPages];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (entry) => `  <url>\n    <loc>${absoluteUrl(entry.loc)}</loc>\n    <lastmod>${entry.lastmod || today}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
    )
    .join('\n')}\n</urlset>\n`;
};

const writeTextFile = (targetDir, fileName, content) => {
  ensureDir(targetDir);
  fs.writeFileSync(path.join(targetDir, fileName), content);
};

const main = async () => {
  const products = parseProducts();
  // Live table first — the same rows the blog renders — then the drop registry.
  // Fetching before the dist/index.html check below is deliberate: the prebuild
  // pass writes public/sitemap.xml from this list, so the sitemap and the
  // prerendered pages always describe the same set of posts.
  const livePosts = await fetchPublishedPosts();
  const posts = livePosts || parseRegistryPosts();
  console.log(
    livePosts
      ? `[seo] Posts: ${posts.length} from the live posts table.`
      : `[seo] Posts: ${posts.length} from the drop registry (fallback).`
  );

  const sitemap = buildSitemap(products, posts);
  const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;

  writeTextFile(PUBLIC_DIR, 'sitemap.xml', sitemap);
  writeTextFile(PUBLIC_DIR, 'robots.txt', robots);

  // TWO-PHASE CONTRACT — this script is wired to BOTH npm hooks, and the
  // two halves deliberately run at different times:
  //
  //   prebuild   (before `vite build`)  -> writes public/sitemap.xml and
  //              public/robots.txt, so Vite's public/ copy ships them in
  //              dist/. dist/index.html does not exist yet at this point,
  //              so the branch below bails and no HTML is written.
  //   postbuild  (after `vite build`)   -> dist/index.html now exists, so
  //              the prerendered pages under dist/<path>/index.html are
  //              emitted here. Vercel's filesystem check runs before its
  //              rewrite rules, so dist/shop/index.html wins for /shop.
  //
  // Removing the `postbuild` hook silently deletes every prerendered page
  // (this exact branch would bail on every build) without failing the
  // build, which is how the hand-maintained no-JS mirrors in public/ came
  // to exist in the first place. Keep both hooks.
  if (!fs.existsSync(DIST_INDEX)) {
    console.log('[seo] Wrote public sitemap.xml and robots.txt. Skipped static HTML because dist/index.html does not exist yet (expected on the prebuild pass; the postbuild pass emits it).');
    return;
  }

  const baseHtml = fs.readFileSync(DIST_INDEX, 'utf8');
  const sameAs = parseBrandSameAs();
  const faqs = parseHelpFaqs();
  writeTextFile(DIST_DIR, 'sitemap.xml', sitemap);
  writeTextFile(DIST_DIR, 'robots.txt', robots);

  for (const route of STATIC_ROUTES) {
    writeStaticPage(
      baseHtml,
      route.path,
      buildRouteSeo(route),
      buildRouteStructuredData(route, products, { sameAs, faqs })
    );
  }

  // '/' has no prerendered copy: dist/index.html IS the homepage. Inject only
  // the JSON-LD graph — the title, description, canonical and og copy in
  // index.html are hand-authored and already correct, and injectSeo would
  // overwrite the separate og:description with the meta description.
  fs.writeFileSync(DIST_INDEX, injectJsonLd(baseHtml, buildHomeStructuredData(sameAs)));

  for (const product of products) {
    const seo = getProductSeo(product);
    writeStaticPage(
      baseHtml,
      seo.path,
      {
        ...seo,
        price: product.price,
      },
      productJsonLd(product)
    );
  }

  for (const post of posts) {
    writeStaticPage(
      baseHtml,
      blogPostPath(post.slug),
      getPostSeo(post),
      postJsonLd(post),
      postArticleHtml(post)
    );
  }

  console.log(
    `[seo] Generated sitemap, robots, ${STATIC_ROUTES.length} prerendered static pages with JSON-LD, ${products.length} product pages, ${posts.length} blog posts, and the homepage graph.`
  );
};

// Only run `main()` when this module is executed directly (e.g. `node scripts/generateSeoArtifacts.mjs`),
// not when it's imported by the regression test suite. This guard lets the test file import the parser
// functions without triggering a full sitemap rebuild. We use `pathToFileURL` for cross-platform safety:
// on Windows, `process.argv[1]` uses backslashes (`C:\Users\...`), so a naive `file://${process.argv[1]}`
// string would not match the `file:///C:/Users/...` form of `import.meta.url`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[seo] generation failed:', error);
    process.exit(1);
  });
}
