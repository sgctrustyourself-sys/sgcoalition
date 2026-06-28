import { Product } from '../types';

export const SITE_ORIGIN = 'https://sgcoalition.xyz';
export const SITE_NAME = 'Coalition';
export const DEFAULT_SEO_IMAGE = '/hero-cinematic.png';
export const DEFAULT_SEO_DESCRIPTION =
    'Coalition is a premium streetwear brand born in Baltimore. Quality, community, and the hustle. Shop the latest drops and join the movement.';

export const absoluteUrl = (pathOrUrl?: string) => {
    const value = (pathOrUrl || DEFAULT_SEO_IMAGE).trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `${SITE_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
};

export const productPath = (productId: string) => `/product/${encodeURIComponent(productId)}`;

const cleanText = (value = '') =>
    value
        .replace(/\s+/g, ' ')
        .replace(/<[^>]+>/g, '')
        .trim();

export const truncateSeoText = (value: string, maxLength = 155) => {
    const cleaned = cleanText(value);
    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
};

export const getProductStock = (product: Product) =>
    Object.values(product.sizeInventory || {}).reduce((sum, count) => sum + Number(count || 0), 0);

export const getProductAvailability = (product: Product) => {
    if (product.archived || product.soldAt || getProductStock(product) <= 0) {
        return 'https://schema.org/SoldOut';
    }

    return 'https://schema.org/InStock';
};

export const getProductSeo = (product: Product) => {
    const stock = getProductStock(product);
    const isSold = product.archived || Boolean(product.soldAt) || stock <= 0;
    const status = isSold ? 'Sold archive piece' : product.isLimitedEdition ? 'Limited drop available' : 'Available now';
    const title = `${product.name} | Coalition`;
    const description = truncateSeoText(`${status}. ${product.description} ${product.price ? `$${product.price}.` : ''}`);
    const image = absoluteUrl(product.images[0]);
    const url = absoluteUrl(productPath(product.id));

    return {
        title,
        description,
        image,
        url,
        path: productPath(product.id),
        status,
    };
};

export const buildProductJsonLd = (product: Product) => {
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
            name: SITE_NAME,
        },
        category: product.category,
        url: seo.url,
        offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: Number(product.price || 0).toFixed(2),
            availability: getProductAvailability(product),
            url: seo.url,
            itemCondition: 'https://schema.org/NewCondition',
        },
    };
};

export const buildItemListJsonLd = (products: Product[], name: string, path: string) => ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: absoluteUrl(path),
    mainEntity: {
        '@type': 'ItemList',
        itemListElement: products.map((product, index) => {
            const seo = getProductSeo(product);

            return {
                '@type': 'ListItem',
                position: index + 1,
                url: seo.url,
                name: product.name,
            };
        }),
    },
});
