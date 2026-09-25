import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_IMAGE,
  DEFAULT_SEO_IMAGE_ALT,
  DEFAULT_SEO_IMAGE_HEIGHT,
  DEFAULT_SEO_IMAGE_WIDTH,
  SEO_LOCALE,
  absoluteUrl,
  isShareCardImage,
  shareCardImage,
} from '../utils/seo';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  /** Only pass these when you know them. Old scrapers decide between a small
   *  thumbnail and a full-width card from the declared size, so a guessed size
   *  is worse than no size: it is dropped rather than defaulted when the page
   *  supplies its own image. */
  imageWidth?: number;
  imageHeight?: number;
  type?: 'website' | 'article' | 'product';
  canonicalPath?: string;
  url?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

const Seo: React.FC<SeoProps> = ({ 
  title, 
  description = DEFAULT_SEO_DESCRIPTION,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  type = 'website',
  canonicalPath,
  url,
  jsonLd,
  noindex = false,
}) => {
  const location = useLocation();
  const fullTitle = title.includes('Coalition') ? title : `Coalition | ${title}`;
  const routePath = canonicalPath || location.pathname;
  const canonicalUrl = url || absoluteUrl(routePath);
  // The route's own card (public/og/<route>.jpg) when one exists, else the generic
  // brand card. Derived from the route rather than passed in, so a page cannot
  // forget its card and silently unfurl as the homepage — the prerenderer applies
  // the same rule, which is what keeps the served and hydrated heads identical.
  const resolvedImage = image || shareCardImage(routePath);
  const previewImage = absoluteUrl(resolvedImage);
  // A generated card is the only image whose size is known here; a page that
  // passes its own product photo must declare dimensions or none.
  const usesShareCard = image ? isShareCardImage(image) : true;
  // Mirrors buildRouteSeo() in scripts/generateSeoArtifacts.mjs — the served and
  // hydrated alt text must be the same string. A generated card is announced with
  // the page title; a page's own image (a product photo) falls back to the title
  // too, and callers that know better pass imageAlt.
  const previewImageAlt =
    imageAlt ||
    (resolvedImage === DEFAULT_SEO_IMAGE ? DEFAULT_SEO_IMAGE_ALT : usesShareCard ? `${fullTitle} share card` : fullTitle);
  const previewImageWidth = imageWidth ?? (usesShareCard ? DEFAULT_SEO_IMAGE_WIDTH : undefined);
  const previewImageHeight = imageHeight ?? (usesShareCard ? DEFAULT_SEO_IMAGE_HEIGHT : undefined);

  useEffect(() => {
    // Update Title
    document.title = fullTitle;

    // Update Meta Tags
    const metaTags = [
      { name: 'description', content: description },
      { name: 'robots', content: noindex ? 'noindex,nofollow' : 'index,follow' },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:image', content: previewImage },
      { property: 'og:image:alt', content: previewImageAlt },
      { property: 'og:image:width', content: previewImageWidth ? String(previewImageWidth) : undefined },
      { property: 'og:image:height', content: previewImageHeight ? String(previewImageHeight) : undefined },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: 'Coalition' },
      { property: 'og:locale', content: SEO_LOCALE },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@sgcoalition' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: previewImage },
      { name: 'twitter:image:alt', content: previewImageAlt },
    ];

    metaTags.forEach(tag => {
      let element;
      if (tag.name) {
        element = document.querySelector(`meta[name="${tag.name}"]`);
      } else if (tag.property) {
        element = document.querySelector(`meta[property="${tag.property}"]`);
      }

      // An undefined content means "this page does not know" — the prerendered
      // tag (if any) is removed rather than emptied, so a product page can't
      // inherit the share card's 1200x630 and mislabel its own photo.
      if (tag.content === undefined) {
        if (element) element.remove();
        return;
      }

      if (element) {
        element.setAttribute('content', tag.content);
      } else {
        // Create if not exists (though index.html should have them)
        const newMeta = document.createElement('meta');
        if (tag.name) newMeta.setAttribute('name', tag.name);
        if (tag.property) newMeta.setAttribute('property', tag.property);
        newMeta.setAttribute('content', tag.content);
        document.head.appendChild(newMeta);
      }
    });

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    document
      .querySelectorAll('script[data-seo-jsonld="true"], script[data-seo-static-jsonld="true"]')
      .forEach(script => script.remove());

    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seoJsonld = 'true';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

  }, [fullTitle, description, previewImage, canonicalUrl, type, jsonLd, noindex]);

  return null; // This component handles side effects only
};

export default Seo;
