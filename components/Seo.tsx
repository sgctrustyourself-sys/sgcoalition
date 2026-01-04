import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
}

const Seo: React.FC<SeoProps> = ({ 
  title, 
  description = "Coalition is a premium streetwear brand born in Baltimore. Quality, community, and the hustle. Shop the latest drops and join the movement.",
  image = "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  type = 'website' 
}) => {
  const location = useLocation();
  const fullTitle = title.includes('Coalition') ? title : `Coalition | ${title}`;
  const url = `https://sgcoalition.xyz${location.pathname}`;

  useEffect(() => {
    // Update Title
    document.title = fullTitle;

    // Update Meta Tags
    const metaTags = [
      { name: 'description', content: description },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:image', content: image },
      { property: 'og:url', content: url },
      { property: 'og:type', content: type },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
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

  }, [fullTitle, description, image, url, type]);

  return null; // This component handles side effects only
};

export default Seo;
