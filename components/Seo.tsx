import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_IMAGE, absoluteUrl } from '../utils/seo';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  canonicalPath?: string;
  url?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

const Seo: React.FC<SeoProps> = ({ 
  title, 
  description = DEFAULT_SEO_DESCRIPTION,
  image = DEFAULT_SEO_IMAGE,
  type = 'website',
  canonicalPath,
  url,
  jsonLd,
  noindex = false,
}) => {
  const location = useLocation();
  const fullTitle = title.includes('Coalition') ? title : `Coalition | ${title}`;
  const canonicalUrl = url || absoluteUrl(canonicalPath || location.pathname);
  const previewImage = absoluteUrl(image);

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
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: 'Coalition' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@sgcoalition' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: previewImage },
    ];

    metaTags.forEach(tag => {
      let element;
      if (tag.name) {
        element = document.querySelector(`meta[name="${tag.name}"]`);
      } else if (tag.property) {
        element = document.querySelector(`meta[property="${tag.property}"]`);
      }

      if (element) {
        element.setAttribute('content', tag.content || '');
      } else {
        // Create if not exists (though index.html should have them)
        const newMeta = document.createElement('meta');
        if (tag.name) newMeta.setAttribute('name', tag.name);
        if (tag.property) newMeta.setAttribute('property', tag.property);
        newMeta.setAttribute('content', tag.content || '');
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
