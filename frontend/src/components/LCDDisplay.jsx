import React, { useState, useEffect, useRef } from 'react';

const LCDDisplay = ({ title, artist, album, isPlaying }) => {
  const [titleScroll, setTitleScroll] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isScrollingIn, setIsScrollingIn] = useState(true);
  const titleAnimRef = useRef(null);
  const pauseTimeoutRef = useRef(null);
  const prevTitleRef = useRef(title);

  // Reset when title changes - scroll in new title
  useEffect(() => {
    if (prevTitleRef.current !== title) {
      setTitleScroll(-600); // Start from right (off-screen)
      setIsScrollingIn(true);
      setIsPaused(false);
      prevTitleRef.current = title;
    }
  }, [title]);

  // Title scrolling animation
  useEffect(() => {
    if (!title) {
      setTitleScroll(0);
      return;
    }

    const titleWidth = title.length * 10; // Approximate character width in pixels
    const containerWidth = 600; // Approximate container width
    const isLongTitle = titleWidth > containerWidth;

    const scroll = () => {
      setTitleScroll((prev) => {
        // Scrolling in from right
        if (isScrollingIn) {
          if (prev < 0) {
            return prev + 2; // Scroll in at 2px per frame
          } else {
            setIsScrollingIn(false);
            if (!isLongTitle) {
              return 0; // Stay at position 0 for short titles
            }
            return prev;
          }
        }
        
        // For long titles, continue scrolling after scroll-in
        if (isLongTitle && isPlaying) {
          const maxScroll = titleWidth - containerWidth;
          
          if (prev >= maxScroll && !isPaused) {
            // Reached end, pause before resetting
            setIsPaused(true);
            pauseTimeoutRef.current = setTimeout(() => {
              setTitleScroll(-600);
              setIsScrollingIn(true);
              setIsPaused(false);
            }, 2000); // 2 second pause
            return prev;
          }
          
          if (isPaused) {
            return prev;
          }
          
          return prev + 0.8; // Scroll speed for long titles
        }
        
        return prev;
      });
      titleAnimRef.current = requestAnimationFrame(scroll);
    };

    titleAnimRef.current = requestAnimationFrame(scroll);

    return () => {
      if (titleAnimRef.current) {
        cancelAnimationFrame(titleAnimRef.current);
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [title, isPlaying, isPaused, isScrollingIn]);

  return (
    <div className="w-full my-6 px-4">
      <div 
        className="relative rounded-md overflow-hidden border-2"
        style={{
          background: '#000000',
          borderColor: '#1a1a1a',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)'
        }}
      >
        {/* LCD pixel grid texture */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, transparent 1px, transparent 2px)',
            opacity: 0.3
          }}
        />
        
        <div className="relative px-4 py-3">
          {/* Title Line - Scrolling once */}
          <div className="overflow-hidden mb-2">
            <div 
              className="whitespace-nowrap font-mono text-lg sm:text-xl md:text-2xl font-medium tracking-wide"
              style={{
                color: '#E8E8E8',
                textShadow: '0 0 8px rgba(232, 232, 232, 0.5), 0 0 4px rgba(232, 232, 232, 0.3)',
                transform: `translateX(-${titleScroll}px)`,
                willChange: 'transform'
              }}
            >
              {title || '--- NO TITLE ---'}
            </div>
          </div>
          
          {/* Artist Line - Static */}
          <div className="overflow-hidden">
            <div 
              className="truncate font-mono text-sm sm:text-base text-white/70 tracking-wide"
            >
              {artist || 'Unknown Artist'}
            </div>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="absolute top-1.5 right-2 flex items-center gap-2">
          {isPlaying && (
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" className="animate-pulse">
                <polygon points="2,1 2,11 10,6" fill="#E8E8E8" opacity="0.8" />
              </svg>
              <span className="text-[9px] text-white/60 font-mono font-bold">▶</span>
            </div>
          )}
        </div>
        
        {/* Bottom info bar */}
        <div 
          className="px-4 py-1 flex justify-between items-center text-[9px] font-mono text-white/40"
          style={{
            background: 'rgba(0,0,0,0.4)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <span>TRACK</span>
          {album && <span className="truncate max-w-[50%]">{album.substring(0, 20)}</span>}
        </div>
      </div>
    </div>
  );
};

export default LCDDisplay;
