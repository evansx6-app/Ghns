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
    if (!src || src === 'vinyl-fallback-placeholder') {
      // Only set fallback if we don't have a valid image already loaded
      if (!isLoaded) {
        setImageSrc(fallbackSrc);
      }
      return;
    }

    // Use proxy for Safari to avoid CORS issues
    const proxiedSrc = getImageUrl(src);
    
    // Don't reload if it's the same source
    if (imageSrc === proxiedSrc && isLoaded) {
      return;
    }

    // Reset states when src changes to a different valid source
    setIsLoaded(false);
    setHasError(false);

    // Priority images load immediately without any delay
    if (priority) {
      setImageSrc(proxiedSrc);
      setIsLoaded(true); // Assume loaded for priority images
      return;
    }

    // Fast loading for non-priority images (no IntersectionObserver delay)
    let img = null;

    const loadImage = () => {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.src = proxiedSrc;
      
      img.onload = () => {
        setImageSrc(proxiedSrc);
        setIsLoaded(true);
      };
      
      img.onerror = () => {
        console.warn('Image failed to load:', src);
        setHasError(true);
        // Only set fallback if we don't already have a valid image
        if (!isLoaded) {
          setImageSrc(fallbackSrc);
        }
      };
    };

    // Load immediately for faster display
    loadImage();

    return () => {
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [src, priority, fallbackSrc, isLoaded, imageSrc]);

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
        WebkitTransform: 'translateZ(0)',
        contentVisibility: 'auto' // CSS containment for better performance
      }}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onLoad={handleLoad}
      onError={handleError}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};

export default React.memo(OptimizedImage);
