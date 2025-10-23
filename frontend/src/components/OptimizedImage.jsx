import React, { useState, useEffect, useRef } from 'react';
import { getImageUrl } from '../utils/imageProxy';

const OptimizedImage = ({ 
  src, 
  alt, 
  className = '',
  fallbackSrc = 'https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png',
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

    // Use proxy for Safari to avoid CORS issues
    const proxiedSrc = getImageUrl(src);

    // Priority images update immediately
    if (priority) {
      setImageSrc(proxiedSrc);
      return;
    }

    // Optimized preloading with IntersectionObserver for lazy loading
    let img = null;
    let observer = null;

    const loadImage = () => {
      img = new Image();
      img.src = proxiedSrc;
      
      // Add size hint for faster loading
      img.sizes = '(max-width: 768px) 100vw, 800px';
      
      img.onload = () => {
        setImageSrc(proxiedSrc);
        setIsLoaded(true);
      };
      
      img.onerror = () => {
        console.warn('Image failed to load:', src);
        setHasError(true);
        setImageSrc(fallbackSrc);
      };
    };

    // Use IntersectionObserver for better lazy loading
    if (imgRef.current && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadImage();
              observer?.disconnect();
            }
          });
        },
        { rootMargin: '50px' } // Start loading 50px before image enters viewport
      );
      
      observer.observe(imgRef.current);
    } else {
      // Fallback for browsers without IntersectionObserver
      loadImage();
    }

    return () => {
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
      observer?.disconnect();
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
