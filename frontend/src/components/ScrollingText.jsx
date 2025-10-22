import React, { useRef, useEffect, useState } from 'react';

const ScrollingText = ({ 
  text, 
  className = '', 
  speed = 30, // pixels per second
  pauseDuration = 2000, // pause at start/end in ms
  alwaysScroll = false, // prop to force scrolling
  direction = 'ltr', // 'ltr' (left-to-right) or 'rtl' (right-to-left)
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
        containerRef.current.offsetHeight;
        textRef.current.offsetHeight;
        
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        
        // If alwaysScroll is true, force scrolling regardless of overflow
        if (alwaysScroll || textWidth > containerWidth + 5) {
          setShouldScroll(true);
          // Calculate scroll distance and animation duration
          const scrollDistance = alwaysScroll 
            ? Math.max(textWidth, containerWidth * 0.5) // Ensure minimum scroll distance
            : textWidth - containerWidth + 20;
          const duration = (scrollDistance / speed) * 1000; // convert to ms
          setAnimationDuration(duration + pauseDuration * 2);
          
          // Set CSS custom property for scroll distance based on direction
          if (direction === 'rtl') {
            // RTL: Start at right (0), scroll to left (negative)
            textRef.current.style.setProperty('--scroll-start', '0px');
            textRef.current.style.setProperty('--scroll-end', `-${scrollDistance}px`);
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
    
    // Recheck on window resize and orientation change
    window.addEventListener('resize', checkOverflow);
    window.addEventListener('orientationchange', checkOverflow);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      window.removeEventListener('resize', checkOverflow);
      window.removeEventListener('orientationchange', checkOverflow);
    };
  }, [text, speed, pauseDuration, alwaysScroll, direction]);

  if (!text) return null;

  return (
    <div 
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap w-full max-w-full ${className}`}
      style={{ 
        position: 'relative', 
        display: 'flex',
        justifyContent: shouldScroll ? (direction === 'rtl' ? 'flex-end' : 'flex-start') : 'center',
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