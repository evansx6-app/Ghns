import React, { useState, useEffect, useRef } from 'react';

const LCDDisplay = ({ title, artist, album, isPlaying }) => {
  const [titleScroll, setTitleScroll] = useState(0);
  const [artistScroll, setArtistScroll] = useState(0);
  const [titleNeedsScroll, setTitleNeedsScroll] = useState(false);
  const [artistNeedsScroll, setArtistNeedsScroll] = useState(false);
  const titleAnimRef = useRef(null);
  const artistAnimRef = useRef(null);
  const prevTitleRef = useRef(title);
  const prevArtistRef = useRef(artist);
  const isMountedRef = useRef(false);

  // Detect if title or artist needs scrolling
  useEffect(() => {
    const titleLength = title?.length || 0;
    const artistLength = artist?.length || 0;
    
    // If more than 12 characters, enable scrolling
    const needsTitle = titleLength > 12;
    const needsArtist = artistLength > 12;
    
    setTitleNeedsScroll(needsTitle);
    setArtistNeedsScroll(needsArtist);
    
    console.log('[LCD] Scroll check:', { 
      title: title?.substring(0, 20), 
      titleLength, 
      needsTitle, 
      isPlaying 
    });
  }, [title, artist, isPlaying]);

  // Continuous scrolling for long titles
  useEffect(() => {
    if (!isPlaying || !titleNeedsScroll) {
      setTitleScroll(0);
      return;
    }

    const textWidth = (title?.length || 0) * 12; // Character width estimate
    const spacing = 600; // Large spacing to ensure only one copy visible at a time
    const loopPoint = textWidth + spacing;

    const scroll = () => {
      setTitleScroll((prev) => {
        if (prev >= loopPoint) {
          return 0; // Reset to start for seamless loop
        }
        return prev + 0.8; // Continuous scrolling speed
      });
      titleAnimRef.current = requestAnimationFrame(scroll);
    };

    console.log('[LCD] Title scrolling started');
    titleAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (titleAnimRef.current) cancelAnimationFrame(titleAnimRef.current);
    };
  }, [title, isPlaying, titleNeedsScroll]);

  // Continuous scrolling for long artist names
  useEffect(() => {
    if (!isPlaying || !artistNeedsScroll) {
      setArtistScroll(0);
      return;
    }

    const textWidth = (artist?.length || 0) * 10;
    const spacing = 600; // Large spacing to ensure only one copy visible at a time
    const loopPoint = textWidth + spacing;

    const scroll = () => {
      setArtistScroll((prev) => {
        if (prev >= loopPoint) {
          return 0;
        }
        return prev + 0.7; // Slightly slower than title
      });
      artistAnimRef.current = requestAnimationFrame(scroll);
    };

    console.log('[LCD] Artist scrolling started');
    artistAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (artistAnimRef.current) cancelAnimationFrame(artistAnimRef.current);
    };
  }, [artist, isPlaying, artistNeedsScroll]);

  return (
    <div className="w-full">
      <div 
        className="relative rounded-md overflow-hidden border-2 transition-all duration-500"
        style={{
          background: '#000000',
          borderColor: '#1a1a1a',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)',
          opacity: isPlaying ? 1 : 0.3
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
          {/* Title Line - Left justified, scrolls when long */}
          <div className="overflow-hidden mb-2">
            <div 
              className="text-base sm:text-lg md:text-xl font-semibold tracking-wider"
              style={{
                fontFamily: '"Orbitron", monospace',
                color: isPlaying ? '#E8E8E8' : '#333333',
                textShadow: isPlaying ? '0 0 8px rgba(232, 232, 232, 0.5), 0 0 4px rgba(232, 232, 232, 0.3)' : 'none',
                transition: 'color 0.5s',
                transform: titleNeedsScroll && isPlaying ? `translateX(-${titleScroll}px)` : 'none',
                whiteSpace: 'nowrap',
                textAlign: 'left'
              }}
            >
              {titleNeedsScroll && isPlaying ? 
                `${title || '--- NO TITLE ---'}                                        ${title || '--- NO TITLE ---'}` : 
                (title || '--- NO TITLE ---')
              }
            </div>
          </div>
          
          {/* Artist Line - Left justified, scrolls when long */}
          <div className="overflow-hidden">
            <div 
              className="text-xs sm:text-sm md:text-base tracking-wider transition-colors duration-500"
              style={{
                fontFamily: '"Orbitron", monospace',
                color: isPlaying ? 'rgba(255,255,255,0.7)' : '#222222',
                transform: artistNeedsScroll && isPlaying ? `translateX(-${artistScroll}px)` : 'none',
                whiteSpace: 'nowrap',
                textAlign: 'left'
              }}
            >
              {artistNeedsScroll && isPlaying ? 
                `${artist || 'Unknown Artist'}                    ${artist || 'Unknown Artist'}                    ${artist || 'Unknown Artist'}` : 
                (artist || 'Unknown Artist')
              }
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
