import React, { useState, useEffect, useRef } from 'react';

const LCDDisplay = ({ title, artist, album, isPlaying }) => {
  const [titleScroll, setTitleScroll] = useState(-700); // Start off-screen
  const [artistScroll, setArtistScroll] = useState(-700); // Start off-screen
  const [titlePaused, setTitlePaused] = useState(false);
  const [artistPaused, setArtistPaused] = useState(false);
  const [titleScrollingIn, setTitleScrollingIn] = useState(true);
  const [artistScrollingIn, setArtistScrollingIn] = useState(true);
  const titleAnimRef = useRef(null);
  const artistAnimRef = useRef(null);
  const titlePauseRef = useRef(null);
  const artistPauseRef = useRef(null);
  const prevTitleRef = useRef(title);
  const prevArtistRef = useRef(artist);
  const isMountedRef = useRef(false);

  // Initial mount - trigger animation
  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  // Reset when title changes - scroll in animation
  useEffect(() => {
    if (prevTitleRef.current !== title || !isMountedRef.current) {
      setTitleScroll(-700);
      setTitleScrollingIn(true);
      setTitlePaused(false);
      prevTitleRef.current = title;
    }
  }, [title]);

  // Reset when artist changes - scroll in animation
  useEffect(() => {
    if (prevArtistRef.current !== artist || !isMountedRef.current) {
      setArtistScroll(-700);
      setArtistScrollingIn(true);
      setArtistPaused(false);
      prevArtistRef.current = artist;
    }
  }, [artist]);

  // Title scrolling animation - ALWAYS CONTINUOUS SCROLL
  useEffect(() => {
    if (!title || !isPlaying) {
      return;
    }

    const titleWidth = title.length * 15; // Character width
    const containerWidth = 600;
    let scrollingIn = titleScrollingIn;

    const scroll = () => {
      setTitleScroll((prev) => {
        // Initial scroll in from right
        if (scrollingIn) {
          if (prev < 0) return prev + 3;
          scrollingIn = false;
          setTitleScrollingIn(false);
          return 0;
        }
        
        // ALWAYS scroll continuously - regardless of title length
        const maxScroll = Math.max(titleWidth, containerWidth) + containerWidth;
        if (prev >= maxScroll) {
          // Immediately restart from right (no pause)
          return 0;
        }
        return prev + 2; // Scrolling speed
      });
      titleAnimRef.current = requestAnimationFrame(scroll);
    };

    titleAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (titleAnimRef.current) cancelAnimationFrame(titleAnimRef.current);
      if (titlePauseRef.current) clearTimeout(titlePauseRef.current);
    };
  }, [title, isPlaying]);

  // Artist scrolling animation - SCROLL WHEN LONG
  useEffect(() => {
    if (!artist || !isPlaying) return;

    const artistWidth = artist.length * 12; // Character width
    const containerWidth = 600;
    const isLong = artistWidth > containerWidth;

    // Only set up animation if artist name is long
    if (!isLong) return;

    let scrollingIn = artistScrollingIn;

    const scroll = () => {
      setArtistScroll((prev) => {
        // Initial scroll in from right (with slight delay for staggered effect)
        if (scrollingIn) {
          if (prev < 0) return prev + 2.5;
          scrollingIn = false;
          setArtistScrollingIn(false);
          return 0;
        }
        
        // Continuous scrolling for long artist names
        const maxScroll = artistWidth + containerWidth;
        if (prev >= maxScroll) {
          // Immediately restart from right (no pause)
          return 0;
        }
        return prev + 1.5; // Scrolling speed
      });
      artistAnimRef.current = requestAnimationFrame(scroll);
    };

    artistAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (artistAnimRef.current) cancelAnimationFrame(artistAnimRef.current);
      if (artistPauseRef.current) clearTimeout(artistPauseRef.current);
    };
  }, [artist, isPlaying]);

  return (
    <div className="w-full px-4">
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
          {/* Title Line - Scrolling once */}
          <div className="overflow-hidden mb-2">
            <div 
              className="whitespace-nowrap text-lg sm:text-xl md:text-2xl font-semibold tracking-wider"
              style={{
                fontFamily: '"Orbitron", monospace',
                color: isPlaying ? '#E8E8E8' : '#333333',
                textShadow: isPlaying ? '0 0 8px rgba(232, 232, 232, 0.5), 0 0 4px rgba(232, 232, 232, 0.3)' : 'none',
                transform: `translateX(-${titleScroll}px)`,
                willChange: 'transform',
                transition: 'color 0.5s'
              }}
            >
              {title || '--- NO TITLE ---'}
            </div>
          </div>
          
          {/* Artist Line - Scrolling for long names */}
          <div className="overflow-hidden">
            <div 
              className="whitespace-nowrap text-sm sm:text-base tracking-wider transition-colors duration-500"
              style={{
                fontFamily: '"Orbitron", monospace',
                color: isPlaying ? 'rgba(255,255,255,0.7)' : '#222222',
                transform: `translateX(-${artistScroll}px)`,
                willChange: 'transform'
              }}
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
