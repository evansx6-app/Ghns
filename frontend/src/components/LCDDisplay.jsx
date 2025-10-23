import React, { useState, useEffect, useRef } from 'react';

const LCDDisplay = ({ title, artist, album, isPlaying }) => {
  const [titleScroll, setTitleScroll] = useState(0);
  const titleAnimRef = useRef(null);

  // Prepare display text - only title scrolls
  const titleText = title ? title + '          ' + title : '--- NO TITLE ---';

  // Title scrolling animation - right to left only
  useEffect(() => {
    if (!isPlaying || !title) {
      setTitleScroll(0);
      return;
    }

    const scroll = () => {
      setTitleScroll((prev) => {
        const maxScroll = (title.length + 10) * 8; // Approximate character width
        return prev >= maxScroll ? 0 : prev + 1.2; // Pixels per frame
      });
      titleAnimRef.current = requestAnimationFrame(scroll);
    };

    titleAnimRef.current = requestAnimationFrame(scroll);

    return () => {
      if (titleAnimRef.current) {
        cancelAnimationFrame(titleAnimRef.current);
      }
    };
  }, [isPlaying, title]);

  return (
    <div className="w-full my-6 px-4">
      <div 
        className="relative rounded-md overflow-hidden border-2"
        style={{
          background: 'linear-gradient(180deg, #1a3d5c 0%, #0d2438 100%)',
          borderColor: '#2a4d6c',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)'
        }}
      >
        {/* MiniDisc LCD grid texture */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, transparent 1px, transparent 2px)',
            opacity: 0.5
          }}
        />
        
        <div className="relative px-4 py-3">
          {/* Title Line - Scrolling */}
          <div className="overflow-hidden mb-2">
            <div 
              className="whitespace-nowrap font-mono text-lg sm:text-xl md:text-2xl font-medium tracking-wide"
              style={{
                color: '#00D4FF',
                textShadow: '0 0 10px rgba(0, 212, 255, 0.6), 0 0 5px rgba(0, 212, 255, 0.4)',
                transform: `translateX(-${titleScroll}px)`,
                willChange: 'transform'
              }}
            >
              {titleText}
            </div>
          </div>
          
          {/* Artist Line - Static */}
          <div className="overflow-hidden">
            <div 
              className="truncate font-mono text-sm sm:text-base text-cyan-300/80 tracking-wide"
            >
              {artist || 'Unknown Artist'}
            </div>
          </div>
        </div>
        
        {/* MiniDisc style indicators */}
        <div className="absolute top-1.5 right-2 flex items-center gap-2">
          {isPlaying && (
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" className="animate-pulse">
                <polygon points="2,1 2,11 10,6" fill="#00D4FF" opacity="0.8" />
              </svg>
              <span className="text-[9px] text-cyan-300/70 font-mono font-bold">▶</span>
            </div>
          )}
        </div>
        
        {/* Bottom info bar */}
        <div 
          className="px-4 py-1 flex justify-between items-center text-[9px] font-mono text-cyan-400/50"
          style={{
            background: 'rgba(0,0,0,0.2)',
            borderTop: '1px solid rgba(0, 212, 255, 0.1)'
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
