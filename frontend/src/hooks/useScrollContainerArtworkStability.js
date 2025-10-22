import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook specifically for maintaining artwork visibility in scrollable containers
 * Addresses artwork disappearing issues during container scrolling
 */
const useScrollContainerArtworkStability = (containerRef, isEnabled = true) => {
  const stabilityIntervalRef = useRef(null);
  const observerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const enforceArtworkVisibility = useCallback(() => {
    if (!containerRef?.current || !isEnabled) return;

    const container = containerRef.current;
    const artworkImages = container.querySelectorAll('img');
    
    artworkImages.forEach((img, index) => {
      try {
        const computedStyle = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if image is within the scrollable container bounds
        const isInContainerView = (
          rect.top >= containerRect.top - 100 && // 100px buffer
          rect.bottom <= containerRect.bottom + 100 &&
          rect.left >= containerRect.left &&
          rect.right <= containerRect.right
        );

        // Force visibility if image should be visible but isn't
        if (isInContainerView) {
          if (computedStyle.opacity !== '1' || 
              computedStyle.display === 'none' || 
              computedStyle.visibility === 'hidden') {
            
            console.log(`Enforcing artwork visibility for image ${index} in scroll container`);
            
            // Force visibility with high priority
            img.style.setProperty('opacity', '1', 'important');
            img.style.setProperty('display', 'block', 'important');
            img.style.setProperty('visibility', 'visible', 'important');
            
            // Ensure proper positioning
            if (computedStyle.position === 'static') {
              img.style.setProperty('position', 'relative', 'important');
            }
          }

          // Handle loading state
          if (!img.complete || img.naturalWidth === 0) {
            // Re-trigger load for failed images
            const src = img.src;
            img.src = '';
            img.src = src;
          }
        }
      } catch (error) {
        console.warn(`Error enforcing artwork visibility for image ${index}:`, error);
      }
    });
  }, [containerRef, isEnabled]);

  // Enhanced scroll handler
  const handleScroll = useCallback(() => {
    if (!isEnabled) return;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Immediate enforcement during scroll
    enforceArtworkVisibility();

    // Delayed enforcement after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      enforceArtworkVisibility();
    }, 100);
  }, [enforceArtworkVisibility, isEnabled]);

  // Intersection Observer for artwork visibility
  useEffect(() => {
    if (!containerRef?.current || !isEnabled) return;

    const container = containerRef.current;

    // Set up intersection observer for artwork in container
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            // Ensure artwork remains visible when in view
            requestAnimationFrame(() => {
              img.style.setProperty('opacity', '1', 'important');
              img.style.setProperty('visibility', 'visible', 'important');
              img.style.setProperty('display', 'block', 'important');
            });
          }
        });
      },
      {
        root: container,
        rootMargin: '50px',
        threshold: [0, 0.1, 0.5, 1]
      }
    );

    // Observe all existing artwork
    const artworkImages = container.querySelectorAll('img');
    artworkImages.forEach(img => {
      observerRef.current?.observe(img);
    });

    // Set up mutation observer to handle dynamically added artwork
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const newImages = node.querySelectorAll ? node.querySelectorAll('img') : 
                            (node.tagName === 'IMG' ? [node] : []);
            
            newImages.forEach(img => {
              observerRef.current?.observe(img);
            });
          }
        });
      });
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true
    });

    return () => {
      observerRef.current?.disconnect();
      mutationObserver.disconnect();
    };
  }, [containerRef, isEnabled]);

  // Scroll event listeners
  useEffect(() => {
    if (!containerRef?.current || !isEnabled) return;

    const container = containerRef.current;

    // Passive scroll listener for performance
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also listen for touch events on mobile
    container.addEventListener('touchstart', enforceArtworkVisibility, { passive: true });
    container.addEventListener('touchmove', handleScroll, { passive: true });
    container.addEventListener('touchend', enforceArtworkVisibility, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchstart', enforceArtworkVisibility);
      container.removeEventListener('touchmove', handleScroll);
      container.removeEventListener('touchend', enforceArtworkVisibility);
    };
  }, [containerRef, handleScroll, enforceArtworkVisibility, isEnabled]);

  // Periodic stability check
  useEffect(() => {
    if (!isEnabled) return;

    // Enhanced periodic check every 2 seconds
    stabilityIntervalRef.current = setInterval(() => {
      enforceArtworkVisibility();
    }, 2000);

    // Initial enforcement
    const initialTimeout = setTimeout(enforceArtworkVisibility, 100);

    return () => {
      if (stabilityIntervalRef.current) {
        clearInterval(stabilityIntervalRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      clearTimeout(initialTimeout);
    };
  }, [enforceArtworkVisibility, isEnabled]);

  // Resize handler
  useEffect(() => {
    if (!isEnabled) return;

    const handleResize = () => {
      // Delay enforcement after resize to let layout settle
      setTimeout(enforceArtworkVisibility, 200);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [enforceArtworkVisibility, isEnabled]);

  return {
    enforceArtworkVisibility,
    isMonitoring: isEnabled
  };
};

export default useScrollContainerArtworkStability;