import React, { useRef, useEffect, useState, memo } from 'react';

const ScrollingText = memo(({ 
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
  const measureTimeoutRef = useRef(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current && text) {
        // Force reflow to ensure accurate measurements
        textRef.current.style.animation = 'none';
        void textRef.current.offsetWidth; // Trigger reflow
        
        // Force a reflow to get accurate measurements
        const containerRect = containerRef.current.getBoundingClientRect();
        const textRect = textRef.current.getBoundingClientRect();
        
        const containerWidth = containerRect.width;
        const textWidth = textRef.current.scrollWidth;
        
        // Very aggressive detection - if text is even slightly wider, scroll it
        const threshold = 1;
        
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
          // For RTL: text aligned right, scrolls left (shows beginning)
          // For LTR: text aligned left, scrolls left (shows end)
          textRef.current.style.setProperty('--scroll-start', '0px');
          textRef.current.style.setProperty('--scroll-end', `-${scrollDistance}px`);
        } else {
          setShouldScroll(false);
        }
      }
    };

    // Clear any existing timeout
    if (measureTimeoutRef.current) {
      clearTimeout(measureTimeoutRef.current);
    }

    // Single delayed check to reduce jank
    measureTimeoutRef.current = setTimeout(checkOverflow, 100);
    
    return () => {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
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
        alignItems: 'center',
        contain: 'layout style paint'
      }}
    >
      <div
        ref={textRef}
        className="inline-block"
        style={shouldScroll ? {
          animation: `scroll-text-custom ${animationDuration}ms linear infinite`,
          animationDelay: `${pauseDuration}ms`,
          willChange: 'auto'
        } : {}}
      >
        {children || text}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  return (
    prevProps.text === nextProps.text &&
    prevProps.className === nextProps.className &&
    prevProps.speed === nextProps.speed &&
    prevProps.pauseDuration === nextProps.pauseDuration &&
    prevProps.alwaysScroll === nextProps.alwaysScroll &&
    prevProps.direction === nextProps.direction &&
    prevProps.align === nextProps.align
  );
});

export default ScrollingText;