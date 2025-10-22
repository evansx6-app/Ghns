import React, { useRef, useEffect, useState } from 'react';

const ScrollingText = ({ 
  text, 
  className = '', 
  speed = 30, // pixels per second
  pauseDuration = 2000, // pause at start/end in ms
  alwaysScroll = false, // prop to force scrolling
  direction = 'ltr', // 'ltr' (left-to-right) or 'rtl' (right-to-left)
  align = 'center', // 'left', 'center', or 'right' - alignment when not scrolling
  children 
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [animationDuration, setAnimationDuration] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current && text) {
        // Force a reflow to get accurate measurements
        const containerRect = containerRef.current.getBoundingClientRect();
        const textRect = textRef.current.getBoundingClientRect();
        
        const containerWidth = containerRect.width;
        const textWidth = textRef.current.scrollWidth;
        
        // More aggressive detection for mobile - lower threshold
        const threshold = window.innerWidth < 768 ? 2 : 5;
        
        // If alwaysScroll is true, force scrolling regardless of overflow
        if (alwaysScroll || textWidth > containerWidth + threshold) {
          setShouldScroll(true);
          // Calculate scroll distance and animation duration
          const scrollDistance = alwaysScroll 
            ? Math.max(textWidth, containerWidth * 0.5) // Ensure minimum scroll distance
            : textWidth - containerWidth + 20;
          const duration = (scrollDistance / speed) * 1000; // convert to ms
          setAnimationDuration(duration + pauseDuration * 2);
          
          // Set CSS custom property for scroll distance based on direction
          if (direction === 'rtl') {
            // RTL: Start at right (positive offset), scroll to left (0)
            // The container will be flex-end, so we offset the text to show the end first
            const startOffset = Math.min(scrollDistance, containerWidth);
            textRef.current.style.setProperty('--scroll-start', `${startOffset}px`);
            textRef.current.style.setProperty('--scroll-end', `-${scrollDistance - startOffset}px`);
          } else {
            // LTR: Start at left (0), scroll to left (negative)
            textRef.current.style.setProperty('--scroll-start', '0px');
            textRef.current.style.setProperty('--scroll-end', `-${scrollDistance}px`);
          }
        } else {
          setShouldScroll(false);
        }
      }
    };

    // Multiple checks to ensure accurate measurement
    checkOverflow(); // Immediate check
    const timer1 = setTimeout(checkOverflow, 100);
    const timer2 = setTimeout(checkOverflow, 300);
    const timer3 = setTimeout(checkOverflow, 600);
    const timer4 = setTimeout(checkOverflow, 1000); // Extra check for mobile
    const timer5 = setTimeout(checkOverflow, 1500); // Additional mobile check
    
    // Recheck on window resize and orientation change
    const handleResize = () => {
      checkOverflow();
      // Extra check after resize completes
      setTimeout(checkOverflow, 100);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [text, speed, pauseDuration, alwaysScroll, direction]);

  if (!text) return null;

  const getJustifyContent = () => {
    if (shouldScroll) {
      return direction === 'rtl' ? 'flex-end' : 'flex-start';
    }
    // When not scrolling, use the align prop
    if (align === 'left') return 'flex-start';
    if (align === 'right') return 'flex-end';
    return 'center';
  };

  return (
    <div 
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap w-full max-w-full ${className}`}
      style={{ 
        position: 'relative', 
        display: 'flex',
        justifyContent: getJustifyContent(),
        alignItems: 'center'
      }}
    >
      <div
        ref={textRef}
        className="inline-block"
        style={shouldScroll ? {
          animation: `scroll-text-custom ${animationDuration}ms linear infinite`,
          animationDelay: `${pauseDuration}ms`,
          willChange: 'transform'
        } : {}}
      >
        {children || text}
      </div>
    </div>
  );
};

export default ScrollingText;