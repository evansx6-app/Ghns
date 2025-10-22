import React, { useState, useEffect, useRef } from 'react';
import { getImageUrl } from '../utils/imageProxy';

const OptimizedImage = ({ 
  src, 
  alt, 
  className = '',
  fallbackSrc = 'https://customer-assets.emergentagent.com/job_graphnet-suite/artifacts/m9tzgak6_unnamed.png',
  priority = false,
  onLoad,
  onError,
  ...props 
}) => {
  const [imageSrc, setImageSrc] = useState(priority ? src : fallbackSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) {
      setImageSrc(fallbackSrc);
      return;
    }

    // Reset states when src changes
    setIsLoaded(false);
    setHasError(false);

    // Priority images update immediately
    if (priority) {
      setImageSrc(src);
      return;
    }

    // Lazy load non-priority images
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    
    img.onerror = () => {
      console.warn('Image failed to load:', src);
      setHasError(true);
      setImageSrc(fallbackSrc);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, priority, fallbackSrc]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    setImageSrc(fallbackSrc);
    onError?.(e);
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`${className} transition-opacity duration-300`}
      style={{ 
        opacity: isLoaded || priority ? 1 : 0,
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};

export default React.memo(OptimizedImage);
