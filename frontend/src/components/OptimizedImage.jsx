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
  const abortControllerRef = useRef(null);
  
  // Detect slow network for optimized loading
  const [networkCapability, setNetworkCapability] = useState({
    isSlowNetwork: false,
    connectionSpeed: 'unknown',
    downlink: null,
    rtt: null
  });
  
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    let connectionSpeed = 'unknown';
    let isSlowNetwork = false;
    let downlink = null;
    let rtt = null;
    
    if (connection) {
      connectionSpeed = connection.effectiveType || 'unknown';
      downlink = connection.downlink; // Mbps
      rtt = connection.rtt; // milliseconds
      
      // More aggressive slow network detection
      isSlowNetwork = 
        connectionSpeed === 'slow-2g' || 
        connectionSpeed === '2g' || 
        connectionSpeed === '3g' ||
        (downlink && downlink < 1.5) || // Less than 1.5 Mbps
        (rtt && rtt > 300); // RTT over 300ms
    }
    
    setNetworkCapability({
      isSlowNetwork,
      connectionSpeed,
      downlink,
      rtt
    });
    
    if (isSlowNetwork) {
      console.log('[OptimizedImage] Slow network detected:', { connectionSpeed, downlink, rtt });
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

    // Clear any existing timeout and abort controller
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Adaptive loading based on network capability
    let img = null;

    const loadImage = () => {
      // Create new abort controller for this load
      abortControllerRef.current = new AbortController();
      
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      
      // For slow networks, implement aggressive timeout and progressive loading
      if (networkCapability.isSlowNetwork) {
        // Aggressive timeout based on connection speed
        let loadTimeout;
        if (networkCapability.connectionSpeed === 'slow-2g' || networkCapability.connectionSpeed === '2g') {
          loadTimeout = 6000; // 6 seconds for 2G
        } else if (networkCapability.connectionSpeed === '3g') {
          loadTimeout = 4000; // 4 seconds for 3G
        } else if (networkCapability.downlink && networkCapability.downlink < 1) {
          loadTimeout = 5000; // 5 seconds for very slow connections
        } else {
          loadTimeout = 3000; // 3 seconds default for slow
        }
        
        // Set a timeout - show fallback if image takes too long
        loadTimeoutRef.current = setTimeout(() => {
          if (!isLoaded && !hasError) {
            console.warn(`[OptimizedImage] Image load timeout on slow network (${networkCapability.connectionSpeed}), using fallback`);
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
            setImageSrc(fallbackSrc);
            setIsLoaded(true);
            setHasError(true);
            setIsLowQuality(true);
          }
        }, loadTimeout);
        
        // For very slow connections, show fallback immediately while loading
        if (networkCapability.connectionSpeed === 'slow-2g' || networkCapability.connectionSpeed === '2g' || 
            (networkCapability.downlink && networkCapability.downlink < 0.5)) {
          setImageSrc(fallbackSrc);
          setIsLowQuality(true);
          console.log('[OptimizedImage] Very slow network: showing fallback while loading');
        }
      } else {
        // Normal network - still set a reasonable timeout
        loadTimeoutRef.current = setTimeout(() => {
          if (!isLoaded && !hasError) {
            console.warn('[OptimizedImage] Image load timeout, using fallback');
            setImageSrc(fallbackSrc);
            setIsLoaded(true);
            setHasError(true);
          }
        }, 10000); // 10 seconds for normal connections
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

    // For slow networks, add a tiny delay to prioritize critical resources
    if (networkCapability.isSlowNetwork && !priority) {
      setTimeout(loadImage, 50); // Reduced from 100ms
    } else {
      loadImage();
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [src, priority, fallbackSrc, networkCapability.isSlowNetwork, networkCapability.connectionSpeed, networkCapability.downlink]);

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

  // Calculate optimal image rendering based on network capability
  const getImageStyles = () => {
    const baseStyles = {
      opacity: isLoaded || priority ? 1 : 0,
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)',
      contentVisibility: 'auto'
    };

    // For slow networks, optimize rendering
    if (networkCapability.isSlowNetwork) {
      return {
        ...baseStyles,
        willChange: 'auto', // Disable will-change to save memory
        imageRendering: networkCapability.connectionSpeed === 'slow-2g' || networkCapability.connectionSpeed === '2g' ? 'auto' : 'auto'
      };
    }

    return baseStyles;
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`${className} ${networkCapability.isSlowNetwork ? 'transition-opacity duration-700' : 'transition-opacity duration-300'}`}
      style={getImageStyles()}
      loading={priority ? 'eager' : (networkCapability.isSlowNetwork ? 'lazy' : 'lazy')}
      decoding="async"
      fetchPriority={priority ? 'high' : (networkCapability.isSlowNetwork ? 'low' : 'auto')}
      onLoad={handleLoad}
      onError={handleError}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};

export default React.memo(OptimizedImage);
