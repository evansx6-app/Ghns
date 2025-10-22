import React, { useRef, useEffect, useState } from 'react';

const ScrollingText = ({ 
  text, 
  className = '', 
  speed = 30, // pixels per second
  pauseDuration = 2000, // pause at start/end in ms
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
        
        // More aggressive detection - scroll even with small overflow
        if (textWidth > containerWidth + 5) { // Reduced buffer for mobile
          setShouldScroll(true);
          // Calculate scroll distance and animation duration
          const scrollDistance = textWidth - containerWidth + 20; // padding
          const duration = (scrollDistance / speed) * 1000; // convert to ms
          setAnimationDuration(duration + pauseDuration * 2);
          
          // Set CSS custom property for scroll distance
          textRef.current.style.setProperty('--scroll-distance', `-${scrollDistance}px`);
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
  }, [text, speed, pauseDuration]);

  if (!text) return null;

  return (
    <div 
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap w-full max-w-full ${className}`}
      style={{ position: 'relative', display: 'block' }}
    >
      <div
        ref={textRef}
        className="inline-block"
        style={shouldScroll ? {
          animation: `scroll-text ${animationDuration}ms linear infinite`,
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