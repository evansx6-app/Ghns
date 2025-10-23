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

  // Title scrolling animation
  useEffect(() => {
    if (!title) return;

    const titleWidth = title.length * 10;
    const containerWidth = 600;
    const isLong = titleWidth > containerWidth;

    const scroll = () => {
      setTitleScroll((prev) => {
        // Scroll in from right
        if (titleScrollingIn) {
          if (prev < 0) return prev + 3;
          setTitleScrollingIn(false);
          return isLong ? prev : 0;
        }
        
        // Continue scrolling if long
        if (isLong && isPlaying) {
          const maxScroll = titleWidth - containerWidth;
          if (prev >= maxScroll && !titlePaused) {
            setTitlePaused(true);
            titlePauseRef.current = setTimeout(() => {
              setTitleScroll(-700);
              setTitleScrollingIn(true);
              setTitlePaused(false);
            }, 2000);
            return prev;
          }
          if (titlePaused) return prev;
          return prev + 1;
        }
        return prev;
      });
      titleAnimRef.current = requestAnimationFrame(scroll);
    };

    titleAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (titleAnimRef.current) cancelAnimationFrame(titleAnimRef.current);
      if (titlePauseRef.current) clearTimeout(titlePauseRef.current);
    };
  }, [title, isPlaying, titlePaused, titleScrollingIn]);

  // Artist scrolling animation
  useEffect(() => {
    if (!artist) return;

    const artistWidth = artist.length * 9;
    const containerWidth = 600;
    const isLong = artistWidth > containerWidth;

    const scroll = () => {
      setArtistScroll((prev) => {
        // Scroll in from right (with delay for staggered effect)
        if (artistScrollingIn) {
          if (prev < 0) return prev + 2.5;
          setArtistScrollingIn(false);
          return isLong ? prev : 0;
        }
        
        // Continue scrolling if long
        if (isLong && isPlaying) {
          const maxScroll = artistWidth - containerWidth;
          if (prev >= maxScroll && !artistPaused) {
            setArtistPaused(true);
            artistPauseRef.current = setTimeout(() => {
              setArtistScroll(-700);
              setArtistScrollingIn(true);
              setArtistPaused(false);
            }, 2000);
            return prev;
          }
          if (artistPaused) return prev;
          return prev + 0.9;
        }
        return prev;
      });
      artistAnimRef.current = requestAnimationFrame(scroll);
    };

    artistAnimRef.current = requestAnimationFrame(scroll);
    return () => {
      if (artistAnimRef.current) cancelAnimationFrame(artistAnimRef.current);
      if (artistPauseRef.current) clearTimeout(artistPauseRef.current);
    };
  }, [artist, isPlaying, artistPaused, artistScrollingIn]);

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
          
          {/* Artist Line - Static */}
          <div className="overflow-hidden">
            <div 
              className="truncate text-sm sm:text-base tracking-wider transition-colors duration-500"
              style={{
                fontFamily: '"Orbitron", monospace',
                color: isPlaying ? 'rgba(255,255,255,0.7)' : '#222222'
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
