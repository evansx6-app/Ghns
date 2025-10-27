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
  const [isLowQuality, setIsLowQuality] = useState(false);
  const imgRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  
  // Detect slow device for optimized loading
  const [deviceCapability, setDeviceCapability] = useState({
    isSlowDevice: false,
    connectionSpeed: 'unknown',
    cores: 2
  });
  
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 4; // GB
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    let connectionSpeed = 'unknown';
    let isSlowConnection = false;
    
    if (connection) {
      connectionSpeed = connection.effectiveType || 'unknown';
      isSlowConnection = connectionSpeed === 'slow-2g' || connectionSpeed === '2g' || connectionSpeed === '3g';
    }
    
    // Consider device slow if: low cores OR low memory OR slow connection
    const isSlowDevice = cores < 4 || memory < 4 || isSlowConnection;
    
    setDeviceCapability({
      isSlowDevice,
      connectionSpeed,
      cores
    });
    
    if (isSlowDevice) {
      console.log('[OptimizedImage] Slow device detected:', { cores, memory, connectionSpeed });
    }
  }, []);

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
    
    // Force reload if src changes (even to same URL) to handle artwork updates
    // This ensures fresh artwork is always loaded
    const srcChanged = imageSrc !== proxiedSrc;
    
    if (!srcChanged && isLoaded && !hasError) {
      // Same source and already loaded successfully - no need to reload
      return;
    }

    // Reset states when src changes to a different valid source
    if (srcChanged) {
      setIsLoaded(false);
      setHasError(false);
      setIsLowQuality(false);
      console.log('[OptimizedImage] Loading new artwork:', src);
    }

    // Priority images load immediately without any delay
    if (priority) {
      setImageSrc(proxiedSrc);
      setIsLoaded(true); // Assume loaded for priority images
      return;
    }

    // Clear any existing timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    // Adaptive loading based on device capability
    let img = null;
    let lowQualityImg = null;

    const loadImage = () => {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      
      // For slow devices, implement progressive loading with timeout fallback
      if (deviceCapability.isSlowDevice) {
        const loadTimeout = deviceCapability.connectionSpeed === 'slow-2g' || deviceCapability.connectionSpeed === '2g' ? 8000 : 5000;
        
        // Set a timeout for slow devices - show fallback if image takes too long
        loadTimeoutRef.current = setTimeout(() => {
          if (!isLoaded && !hasError) {
            console.warn('[OptimizedImage] Image load timeout on slow device, using fallback');
            setImageSrc(fallbackSrc);
            setIsLoaded(true);
            setHasError(true);
          }
        }, loadTimeout);
        
        // Try to load a lower quality version first for very slow connections
        if (deviceCapability.connectionSpeed === 'slow-2g' || deviceCapability.connectionSpeed === '2g') {
          // Show fallback immediately, then upgrade when full image loads
          setImageSrc(fallbackSrc);
          setIsLowQuality(true);
          console.log('[OptimizedImage] Very slow connection: showing fallback while loading full image');
        }
      }
      
      img.src = proxiedSrc;
      
      img.onload = () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
        setImageSrc(proxiedSrc);
        setIsLoaded(true);
        setIsLowQuality(false);
        console.log('[OptimizedImage] Artwork loaded successfully');
      };
      
      img.onerror = () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
        console.warn('[OptimizedImage] Image failed to load:', src);
        setHasError(true);
        // Only set fallback if we don't already have a valid image
        if (!isLoaded) {
          setImageSrc(fallbackSrc);
        }
      };
    };

    // For slow devices, add a small delay to prioritize critical resources
    if (deviceCapability.isSlowDevice && !priority) {
      setTimeout(loadImage, 100);
    } else {
      loadImage();
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [src, priority, fallbackSrc, deviceCapability.isSlowDevice, deviceCapability.connectionSpeed]);

  const handleLoad = (e) => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    setHasError(true);
    setImageSrc(fallbackSrc);
    onError?.(e);
  };

  // Calculate optimal image rendering based on device capability
  const getImageStyles = () => {
    const baseStyles = {
      opacity: isLoaded || priority ? 1 : 0,
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)',
      contentVisibility: 'auto'
    };

    // For slow devices, reduce image rendering quality to improve performance
    if (deviceCapability.isSlowDevice) {
      return {
        ...baseStyles,
        imageRendering: deviceCapability.connectionSpeed === 'slow-2g' || deviceCapability.connectionSpeed === '2g' ? 'auto' : 'auto',
        willChange: 'auto' // Disable will-change on slow devices to save memory
      };
    }

    return baseStyles;
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`${className} transition-opacity ${deviceCapability.isSlowDevice ? 'duration-500' : 'duration-300'}`}
      style={getImageStyles()}
      loading={priority ? 'eager' : (deviceCapability.isSlowDevice ? 'lazy' : 'lazy')}
      decoding="async"
      fetchPriority={priority ? 'high' : (deviceCapability.isSlowDevice ? 'low' : 'auto')}
      onLoad={handleLoad}
      onError={handleError}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};

export default React.memo(OptimizedImage);
