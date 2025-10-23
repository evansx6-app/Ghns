import React, { useState, useEffect, useRef } from 'react';

const LCDDisplay = ({ title, artist, album, isPlaying }) => {
  const [titleScroll, setTitleScroll] = useState(0);
  const [artistScroll, setArtistScroll] = useState(0);
  const titleAnimRef = useRef(null);
  const artistAnimRef = useRef(null);

  // Prepare display text
  const titleText = title ? title.toUpperCase() + '     ' + title.toUpperCase() : '--- NO TITLE ---';
  const artistText = artist ? artist.toUpperCase() + '     ' + artist.toUpperCase() : '--- NO ARTIST ---';

  // Title scrolling animation
  useEffect(() => {
    if (!isPlaying || !title) {
      setTitleScroll(0);
      return;
    }

    const scroll = () => {
      setTitleScroll((prev) => {
        const maxScroll = (title.length + 5);
        return prev >= maxScroll ? 0 : prev + 0.3;
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

  // Artist scrolling animation
  useEffect(() => {
    if (!isPlaying || !artist) {
      setArtistScroll(0);
      return;
    }

    const scroll = () => {
      setArtistScroll((prev) => {
        const maxScroll = (artist.length + 5);
        return prev >= maxScroll ? 0 : prev + 0.25;
      });
      artistAnimRef.current = requestAnimationFrame(scroll);
    };

    artistAnimRef.current = requestAnimationFrame(scroll);

    return () => {
      if (artistAnimRef.current) {
        cancelAnimationFrame(artistAnimRef.current);
      }
    };
  }, [isPlaying, artist]);

  return (
    <div className="w-full my-6 px-4">
      <div 
        className="relative rounded-lg overflow-hidden border-4"
        style={{
          background: '#000000',
          borderColor: '#333333',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.9), 0 4px 12px rgba(0,0,0,0.6)'
        }}
      >
        {/* LCD pixel grid overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 2px, rgba(255,255,255,0.03) 3px)',
            opacity: 0.4
          }}
        />
        
        <div className="relative px-4 py-4 space-y-3">
          {/* Title Line */}
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-white/40 font-mono">TITLE:</span>
            </div>
            <div 
              className="whitespace-nowrap font-mono text-base sm:text-lg md:text-xl font-semibold tracking-wider"
              style={{
                color: '#E0E0E0',
                textShadow: '0 0 8px rgba(224, 224, 224, 0.6), 0 0 4px rgba(224, 224, 224, 0.3)',
                transform: `translateX(-${titleScroll}ch)`,
                transition: 'transform 0.1s linear'
              }}
            >
              {titleText}
            </div>
          </div>
          
          {/* Artist Line */}
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-white/40 font-mono">ARTIST:</span>
            </div>
            <div 
              className="whitespace-nowrap font-mono text-base sm:text-lg md:text-xl font-semibold tracking-wider"
              style={{
                color: '#E0E0E0',
                textShadow: '0 0 8px rgba(224, 224, 224, 0.6), 0 0 4px rgba(224, 224, 224, 0.3)',
                transform: `translateX(-${artistScroll}ch)`,
                transition: 'transform 0.1s linear'
              }}
            >
              {artistText}
            </div>
          </div>
          
          {/* Album Line (static, truncated) */}
          {album && (
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-white/40 font-mono">ALBUM:</span>
              </div>
              <div 
                className="truncate font-mono text-sm sm:text-base text-white/60 tracking-wide"
              >
                {album.toUpperCase()}
              </div>
            </div>
          )}
        </div>
        
        {/* Status indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {isPlaying && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{
                boxShadow: '0 0 6px rgba(255,255,255,0.8)'
              }} />
              <span className="text-[8px] text-white/50 font-mono">PLAY</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LCDDisplay;
