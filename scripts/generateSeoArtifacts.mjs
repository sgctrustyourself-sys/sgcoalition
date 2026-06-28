import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://sgcoalition.xyz';
const DEFAULT_IMAGE = '/hero-cinematic.png';
const DEFAULT_DESCRIPTION =
  'Coalition is a premium streetwear brand born in Baltimore. Quality, community, and the hustle. Shop the latest drops and join the movement.';

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
  let quote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < arraySource.length; index += 1) {
    const char = arraySource[index];
    const next = arraySource[index + 1];

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
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '/' && next === '/') { inLineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { inBlockComment = true; index += 1; continue; }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      const objectEnd = scanToMatching(arraySource, index, '{', '}');
      if (objectEnd >= 0) {
        objects.push(arraySource.slice(index, objectEnd + 1));
        index = objectEnd;
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

const readStringField = (block, field) => {
  const match = block.match(new RegExp(`${field}\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`));
  return match ? unescapeStringLiteral(match[2]) : '';
};

const readNumberField = (block, field) => {
  const match = block.match(new RegExp(`${field}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`));
  return match ? Number(match[1]) : 0;
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
  const imageStart = block.indexOf('images:');
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

const parseProducts = () => {
  const constantsSource = readFile('constants.ts');
  const imageCatalog = parseImageCatalog();
  const productsStart = constantsSource.indexOf('export const INITIAL_PRODUCTS');
  const initializerStart = productsStart >= 0 ? constantsSource.indexOf('=', productsStart) : -1;
  const arrayStart = initializerStart >= 0 ? constantsSource.indexOf('[', initializerStart) : -1;
  const arrayEnd = arrayStart >= 0 ? scanToMatching(constantsSource, arrayStart, '[', ']') : -1;

  if (productsStart < 0 || initializerStart < 0 || arrayStart < 0 || arrayEnd < 0) {
    throw new Error(
      'Unable to locate INITIAL_PRODUCTS in constants.ts. '
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
      archived: /archived\s*:\s*true/.test(block),
      soldAt: readStringField(block, 'soldAt'),
      isLimitedEdition: /isLimitedEdition\s*:\s*true/.test(block),
    }))
    .filter((product) => product.id && product.name);
};

const getProductSeo = (product) => {
  const isSold = product.archived || Boolean(product.soldAt);
  const status = isSold ? 'Sold archive piece' : product.isLimitedEdition ? 'Limited drop available' : 'Available now';

  return {
    title: `${product.name} | Coalition`,
    description: truncateSeoText(`${status}. ${product.description} ${product.price ? `$${product.price}.` : ''}`),
    image: absoluteUrl(product.images[0]),
    url: absoluteUrl(productPath(product.id)),
    path: productPath(product.id),
    type: 'product',
  };
};

const productJsonLd = (product) => {
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
      availability: product.archived || product.soldAt ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: seo.url,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
};

const collectionJsonLd = (products, name, pagePath) => ({
  '@context': 'https://schema.org',
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

const replaceOrInsertMeta = (html, attribute, key, content) => {
  const escapedContent = escapeHtml(content);
  const replacement = `<meta ${attribute}="${key}" content="${escapedContent}" />`;
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`, 'i');

  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n</head>`);
};

const replaceOrInsertCanonical = (html, href) => {
  const replacement = `<link rel="canonical" href="${escapeHtml(href)}" />`;
  const pattern = /<link\s+rel="canonical"[^>]*>/i;

  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n</head>`);
};

const injectSeo = (html, seo, jsonLd) => {
  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/\s*<script\s+type="application\/ld\+json"\s+data-seo-static-jsonld="true">[\s\S]*?<\/script>/gi, '');

  output = replaceOrInsertMeta(output, 'name', 'description', seo.description);
  output = replaceOrInsertMeta(output, 'name', 'robots', 'index,follow');
  output = replaceOrInsertMeta(output, 'property', 'og:title', seo.title);
  output = replaceOrInsertMeta(output, 'property', 'og:description', seo.description);
  output = replaceOrInsertMeta(output, 'property', 'og:type', seo.type || 'website');
  output = replaceOrInsertMeta(output, 'property', 'og:url', seo.url);
  output = replaceOrInsertMeta(output, 'property', 'og:image', seo.image);
  output = replaceOrInsertMeta(output, 'property', 'og:site_name', 'Coalition');
  output = replaceOrInsertMeta(output, 'name', 'twitter:card', 'summary_large_image');
  output = replaceOrInsertMeta(output, 'name', 'twitter:site', '@sgcoalition');
  output = replaceOrInsertMeta(output, 'name', 'twitter:title', seo.title);
  output = replaceOrInsertMeta(output, 'name', 'twitter:description', seo.description);
  output = replaceOrInsertMeta(output, 'name', 'twitter:image', seo.image);
  output = replaceOrInsertCanonical(output, seo.url);

  if (seo.type === 'product' && typeof seo.price === 'number') {
    output = replaceOrInsertMeta(output, 'property', 'product:price:amount', Number(seo.price).toFixed(2));
    output = replaceOrInsertMeta(output, 'property', 'product:price:currency', 'USD');
  }

  if (jsonLd) {
    output = output.replace(
      '</head>',
      `  <script type="application/ld+json" data-seo-static-jsonld="true">${JSON.stringify(jsonLd)}</script>\n</head>`
    );
  }

  return output;
};

const writeStaticPage = (baseHtml, pagePath, seo, jsonLd) => {
  const outputDir = path.join(DIST_DIR, pagePath.replace(/^\//, ''), 'index.html');
  ensureDir(path.dirname(outputDir));
  fs.writeFileSync(outputDir, injectSeo(baseHtml, seo, jsonLd));
};

const buildSitemap = (products) => {
  const today = new Date().toISOString().slice(0, 10);
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/shop', priority: '0.9', changefreq: 'daily' },
    { loc: '/archive', priority: '0.7', changefreq: 'weekly' },
    { loc: '/about', priority: '0.5', changefreq: 'monthly' },
    { loc: '/membership', priority: '0.5', changefreq: 'monthly' },
    { loc: '/sgcoin', priority: '0.5', changefreq: 'monthly' },
    { loc: '/help', priority: '0.4', changefreq: 'monthly' },
  ];
  const productPages = products.map((product) => ({
    loc: productPath(product.id),
    priority: product.archived || product.soldAt ? '0.6' : '0.8',
    changefreq: product.archived || product.soldAt ? 'monthly' : 'weekly',
  }));
  const urls = [...staticPages, ...productPages];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (entry) => `  <url>
    <loc>${absoluteUrl(entry.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n')}\n</urlset>\n`;
};

const writeTextFile = (targetDir, fileName, content) => {
  ensureDir(targetDir);
  fs.writeFileSync(path.join(targetDir, fileName), content);
};

const main = () => {
  const products = parseProducts();
  const sitemap = buildSitemap(products);
  const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;

  writeTextFile(PUBLIC_DIR, 'sitemap.xml', sitemap);
  writeTextFile(PUBLIC_DIR, 'robots.txt', robots);

  if (!fs.existsSync(DIST_INDEX)) {
    console.log('[seo] Wrote public sitemap.xml and robots.txt. Skipped static HTML because dist/index.html does not exist yet.');
    return;
  }

  const baseHtml = fs.readFileSync(DIST_INDEX, 'utf8');
  writeTextFile(DIST_DIR, 'sitemap.xml', sitemap);
  writeTextFile(DIST_DIR, 'robots.txt', robots);

  writeStaticPage(
    baseHtml,
    '/shop',
    {
      title: 'Coalition | Shop Streetwear Drops',
      description: 'Shop Coalition streetwear drops, limited wallets, tees, hats, and archive-ready pieces from Baltimore.',
      image: absoluteUrl(DEFAULT_IMAGE),
      url: absoluteUrl('/shop'),
      type: 'website',
    },
    collectionJsonLd(products.filter((product) => !product.archived), 'Coalition Shop', '/shop')
  );

  writeStaticPage(
    baseHtml,
    '/archive',
    {
      title: 'Coalition | Archive',
      description: 'Explore the Coalition archive of sold-out drops, 1/1 customs, limited wallets, and past releases.',
      image: absoluteUrl(DEFAULT_IMAGE),
      url: absoluteUrl('/archive'),
      type: 'website',
    },
    collectionJsonLd(products.filter((product) => product.archived), 'Coalition Archive', '/archive')
  );

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

  console.log(`[seo] Generated sitemap, robots, and ${products.length + 2} static preview pages.`);
};

main();
