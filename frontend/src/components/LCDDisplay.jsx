import React, { useState, useEffect, useRef } from 'react';

const LCDDisplay = ({ title, artist, album, isPlaying }) => {
  // Ensure we always have valid title and artist values
  const displayTitle = title || '--- NO TITLE ---';
  const displayArtist = artist || 'Unknown Artist';
  
  const [titleScroll, setTitleScroll] = useState(0);
  const [artistScroll, setArtistScroll] = useState(0);
  const [titleNeedsScroll, setTitleNeedsScroll] = useState(false);
  const [artistNeedsScroll, setArtistNeedsScroll] = useState(false);
  const [titlePaused, setTitlePaused] = useState(false);
  const [artistPaused, setArtistPaused] = useState(false);
  const titleAnimRef = useRef(null);
  const artistAnimRef = useRef(null);
  const titlePauseTimeoutRef = useRef(null);
  const artistPauseTimeoutRef = useRef(null);
  const prevTitleRef = useRef(displayTitle);
  const prevArtistRef = useRef(displayArtist);
  const isMountedRef = useRef(false);

  // Detect if title or artist needs scrolling based on container width
  useEffect(() => {
    const titleLength = displayTitle.length;
    const artistLength = displayArtist.length;
    
    // Lower thresholds for more aggressive scrolling
    // LCD display is narrow, so scroll sooner
    const titleFitsInContainer = 18; // Scroll if longer than 18 characters
    const artistFitsInContainer = 20; // Scroll if longer than 20 characters
    
    const needsTitle = titleLength > titleFitsInContainer;
    const needsArtist = artistLength > artistFitsInContainer;
    
    setTitleNeedsScroll(needsTitle);
    setArtistNeedsScroll(needsArtist);
    
    console.log('[LCD] Scroll check:', { 
      title: displayTitle.substring(0, 25), 
      titleLength, 
      needsTitle, 
      artist: displayArtist.substring(0, 20),
      artistLength,
      needsArtist,
      isPlaying 
    });
  }, [displayTitle, displayArtist, isPlaying]);

  // Continuous seamless scrolling with wrap-around
  useEffect(() => {
    if (!isPlaying || !titleNeedsScroll) {
      setTitleScroll(0);
      setTitlePaused(false);
      if (titlePauseTimeoutRef.current) {
        clearTimeout(titlePauseTimeoutRef.current);
      }
      return;
    }

    const charWidth = 12;
    const textWidth = displayTitle.length * charWidth;
    const spacing = 120; // Space between text and its duplicate
    const totalScrollDistance = textWidth + spacing;

    const scroll = () => {
      if (titlePaused) {
        titleAnimRef.current = requestAnimationFrame(scroll);
        return;
      }

      setTitleScroll((prev) => {
        const newScroll = prev + 0.6; // Scroll speed
        
        // When we've scrolled one full cycle, reset seamlessly
        if (newScroll >= totalScrollDistance) {
          return 0; // Reset to create continuous loop
        }
        return newScroll;
      });
      titleAnimRef.current = requestAnimationFrame(scroll);
    };

    console.log('[LCD] Title scrolling started (continuous)', { textWidth, spacing, totalScrollDistance });
    titleAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (titleAnimRef.current) cancelAnimationFrame(titleAnimRef.current);
      if (titlePauseTimeoutRef.current) clearTimeout(titlePauseTimeoutRef.current);
    };
  }, [displayTitle, isPlaying, titleNeedsScroll, titlePaused]);

  // Continuous seamless scrolling with wrap-around
  useEffect(() => {
    if (!isPlaying || !artistNeedsScroll) {
      setArtistScroll(0);
      setArtistPaused(false);
      if (artistPauseTimeoutRef.current) {
        clearTimeout(artistPauseTimeoutRef.current);
      }
      return;
    }

    const charWidth = 10;
    const textWidth = displayArtist.length * charWidth;
    const spacing = 120; // Space between text and its duplicate
    const totalScrollDistance = textWidth + spacing;

    const scroll = () => {
      if (artistPaused) {
        artistAnimRef.current = requestAnimationFrame(scroll);
        return;
      }

      setArtistScroll((prev) => {
        const newScroll = prev + 0.5; // Scroll speed
        
        // When we've scrolled one full cycle, reset seamlessly
        if (newScroll >= totalScrollDistance) {
          return 0; // Reset to create continuous loop
        }
        return newScroll;
      });
      artistAnimRef.current = requestAnimationFrame(scroll);
    };

    console.log('[LCD] Artist scrolling started (continuous)', { textWidth, spacing, totalScrollDistance });
    artistAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (artistAnimRef.current) cancelAnimationFrame(artistAnimRef.current);
      if (artistPauseTimeoutRef.current) clearTimeout(artistPauseTimeoutRef.current);
    };
  }, [displayArtist, isPlaying, artistNeedsScroll, artistPaused]);

  return (
    <div className="w-full">
      <div 
        className="relative rounded-md overflow-hidden border-2"
        style={{
          background: '#000000',
          borderColor: '#1a1a1a',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)',
          opacity: isPlaying ? 1 : 0.45,
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'auto'
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
          {/* Title Line - Left justified, continuous scroll with duplicate */}
          <div className="overflow-hidden mb-2">
            <div 
              className="text-base sm:text-lg md:text-xl font-semibold tracking-wider inline-flex"
              style={{
                fontFamily: '"Orbitron", monospace',
                color: isPlaying ? '#E8E8E8' : '#999999',
                textShadow: isPlaying ? '0 0 8px rgba(232, 232, 232, 0.5), 0 0 4px rgba(232, 232, 232, 0.3)' : '0 0 4px rgba(153, 153, 153, 0.3)',
                transition: 'color 0.5s',
                transform: titleNeedsScroll && isPlaying ? `translateX(-${titleScroll}px)` : 'none',
                whiteSpace: 'nowrap',
                textAlign: 'left'
              }}
            >
              <span>{displayTitle}</span>
              {titleNeedsScroll && isPlaying && (
                <>
                  <span style={{ marginLeft: '120px' }}>{displayTitle}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Artist Line - Left justified, continuous scroll with duplicate */}
          <div className="overflow-hidden">
            <div 
              className="text-xs sm:text-sm md:text-base tracking-wider transition-colors duration-500 inline-flex"
              style={{
                fontFamily: '"Orbitron", monospace',
                color: isPlaying ? 'rgba(255,255,255,0.7)' : 'rgba(153,153,153,0.8)',
                textShadow: isPlaying ? 'none' : '0 0 3px rgba(153, 153, 153, 0.2)',
                transform: artistNeedsScroll && isPlaying ? `translateX(-${artistScroll}px)` : 'none',
                whiteSpace: 'nowrap',
                textAlign: 'left'
              }}
            >
              <span>{displayArtist}</span>
              {artistNeedsScroll && isPlaying && (
                <>
                  <span style={{ marginLeft: '120px' }}>{displayArtist}</span>
                </>
              )}
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
