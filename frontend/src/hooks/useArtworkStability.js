import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to ensure artwork remains visible during scrolling and other interactions
 * Provides comprehensive stability for track artwork display
 */
const useArtworkStability = (imageLoaded, imageError, hasArtwork) => {
  const artworkRef = useRef(null);
  const stabilityCheckRef = useRef(null);

  const ensureArtworkVisibility = useCallback(() => {
    if (artworkRef.current && imageLoaded && !imageError && hasArtwork) {
      const artwork = artworkRef.current;
      const computedStyle = window.getComputedStyle(artwork);
      
      // Check if artwork has become hidden and force visibility
      if (computedStyle.opacity !== '1' || 
          computedStyle.display === 'none' || 
          computedStyle.visibility === 'hidden') {
        
        console.log('Artwork visibility issue detected, enforcing visibility');
        
        // Force visibility with important inline styles
        artwork.style.setProperty('opacity', '1', 'important');
        artwork.style.setProperty('display', 'block', 'important');
        artwork.style.setProperty('visibility', 'visible', 'important');
        artwork.style.setProperty('position', 'absolute', 'important');
        artwork.style.setProperty('z-index', '20', 'important');
      }
    }
  }, [imageLoaded, imageError, hasArtwork]);

  // Enhanced scroll and interaction monitoring
  useEffect(() => {
    if (!imageLoaded || imageError || !hasArtwork) return;

    let animationFrame;
    let scrollTimeout;
    
    const handleInteraction = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        animationFrame = requestAnimationFrame(ensureArtworkVisibility);
      }, 16); // ~60fps check
    };

    const handleResize = () => {
      ensureArtworkVisibility();
    };

    // Multiple event listeners for comprehensive coverage
    const events = ['scroll', 'touchmove', 'touchstart', 'touchend'];
    events.forEach(event => {
      window.addEventListener(event, handleInteraction, { passive: true });
      document.addEventListener(event, handleInteraction, { passive: true });
    });
    
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Periodic stability check (every 2 seconds)
    stabilityCheckRef.current = setInterval(ensureArtworkVisibility, 2000);

    // Initial enforcement
    const initialTimeout = setTimeout(ensureArtworkVisibility, 100);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
        document.removeEventListener(event, handleInteraction);
      });
      window.removeEventListener('resize', handleResize);
      
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (initialTimeout) clearTimeout(initialTimeout);
      if (stabilityCheckRef.current) clearInterval(stabilityCheckRef.current);
    };
  }, [imageLoaded, imageError, hasArtwork, ensureArtworkVisibility]);

  // Intersection Observer for viewport-based checks
  useEffect(() => {
    if (!artworkRef.current || !imageLoaded || imageError || !hasArtwork) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Artwork is visible in viewport, ensure it stays visible
          requestAnimationFrame(ensureArtworkVisibility);
        }
      });
    }, {
      threshold: [0, 0.1, 0.5, 1], // Multiple thresholds for better detection
      rootMargin: '50px' // Extended margin to catch early
    });

    observer.observe(artworkRef.current);

    return () => observer.disconnect();
  }, [imageLoaded, imageError, hasArtwork, ensureArtworkVisibility]);

  return {
    artworkRef,
    ensureArtworkVisibility
  };
};

export default useArtworkStability;