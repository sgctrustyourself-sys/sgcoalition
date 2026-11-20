import React, { useState, useEffect } from 'react';
import { getOptimizedImageUrl, getSupabaseSrcSet, getLqipUrl, BLUR_PLACEHOLDER, isSupabaseStorageUrl } from '../../utils/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  fill?: boolean;
  widths?: number[];
  onLoad?: () => void;
  onError?: () => void;
}

export default function OptimizedImage({
  src,
  alt,
  className = '',
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  fill = false,
  widths = [400, 800, 1200, 1600],
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // Determine optimized URLs
  const optimizedSrc = useFallback ? src : getOptimizedImageUrl(src, { format: 'webp', quality: 80 });
  const avifSrc = useFallback ? src : getOptimizedImageUrl(src, { format: 'avif', quality: 60 });
  const srcSet = useFallback ? undefined : getSupabaseSrcSet(src, widths, 'webp');
  const srcSetAvif = useFallback ? undefined : getSupabaseSrcSet(src, widths, 'avif');
  const lqip = getLqipUrl(src);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    if (!useFallback) {
      // Try original URL as fallback
      setUseFallback(true);
      setError(false);
    } else {
      setError(true);
      onError?.();
    }
  };

  const style = fill
    ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%' }
    : {};

  return (
    <picture>
      {/* AVIF source - best compression */}
      {srcSetAvif && (
        <source
          srcSet={srcSetAvif}
          type="image/avif"
          sizes={sizes}
        />
      )}
      {/* WebP source - good compression, wide support */}
      {srcSet && (
        <source
          srcSet={srcSet}
          type="image/webp"
          sizes={sizes}
        />
      )}
      {/* Fallback img tag */}
      <img
        src={optimizedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        sizes={sizes}
        style={{
          ...style,
          opacity: loaded || error ? 1 : 0,
          transition: 'opacity 400ms ease-out',
        } as React.CSSProperties}
        className={`block transition-opacity duration-500 ${className}`}
        onLoad={handleLoad}
        onError={handleError}
      />
      {/* Blur placeholder (LQIP) - shows while loading */}
      {!loaded && !error && (
        <img
          src={lqip}
          alt=""
          aria-hidden="true"
          style={{
            ...style,
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            opacity: loaded ? 0 : 1,
            transition: 'opacity 400ms ease-out, filter 400ms ease-out',
            zIndex: -1,
          }}
        />
      )}
    </picture>
  );
}

/**
 * Simple optimized image without srcSet - for thumbnails/small images
 */
export function SimpleOptimizedImage({
  src,
  alt,
  className = '',
  priority = false,
  width,
  height,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const optimizedSrc = useFallback ? src : getOptimizedImageUrl(src, { format: 'webp', quality: 80, width, height });
  const lqip = getLqipUrl(src);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    if (!useFallback) {
      setUseFallback(true);
      setError(false);
    } else {
      setError(true);
      onError?.();
    }
  };

  return (
    <picture>
      <source
        srcSet={useFallback ? undefined : getOptimizedImageUrl(src, { format: 'avif', quality: 60, width, height })}
        type="image/avif"
      />
      <source
        srcSet={useFallback ? undefined : optimizedSrc}
        type="image/webp"
      />
      <img
        src={optimizedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        width={width}
        height={height}
        style={{
          opacity: loaded || error ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        } as React.CSSProperties}
        className={`block ${className}`}
        onLoad={handleLoad}
        onError={handleError}
      />
      {!loaded && !error && (
        <img
          src={lqip}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            opacity: loaded ? 0 : 1,
            transition: 'opacity 300ms ease-out',
            zIndex: -1,
          }}
        />
      )}
    </picture>
  );
}

/**
 * Hero/above-fold image with preload hint
 */
export function HeroOptimizedImage({
  src,
  alt,
  className = '',
  widths = [800, 1200, 1600, 2400],
  sizes = '100vw',
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  widths?: number[];
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  return (
    <>
      {/* Preload hint for critical hero image */}
      {isSupabaseStorageUrl(src) && (
        <link
          rel="preload"
          as="image"
          href={getOptimizedImageUrl(src, { format: 'webp', quality: 85, width: widths[1] })}
          type="image/webp"
        />
      )}
      <OptimizedImage
        src={src}
        alt={alt}
        className={className}
        priority={true}
        sizes={sizes}
        widths={widths}
        onLoad={onLoad}
        onError={onError}
      />
    </>
  );
}