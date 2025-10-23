import React, { useState, useEffect, useRef } from 'react';

const LCDDisplay = ({ title, artist, album, isPlaying }) => {
  const [displayText, setDisplayText] = useState('');
  const [scrollPosition, setScrollPosition] = useState(0);
  const animationRef = useRef(null);

  // Combine track info into single scrolling text
  useEffect(() => {
    if (!title || !artist) {
      setDisplayText('--- NO TRACK DATA ---');
      return;
    }
    
    // Format: TITLE • ARTIST • ALBUM
    const separator = ' • ';
    let text = title.toUpperCase();
    if (artist) text += separator + artist.toUpperCase();
    if (album) text += separator + album.toUpperCase();
    
    // Add padding for continuous scroll
    text = text + '     ' + text;
    
    setDisplayText(text);
    setScrollPosition(0);
  }, [title, artist, album]);

  // Scrolling animation
  useEffect(() => {
    if (!isPlaying || !displayText) {
      return;
    }

    const scroll = () => {
      setScrollPosition((prev) => {
        const maxScroll = displayText.length / 2;
        return prev >= maxScroll ? 0 : prev + 0.5;
      });
      animationRef.current = requestAnimationFrame(scroll);
    };

    animationRef.current = requestAnimationFrame(scroll);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, displayText]);

  return (
    <div className="w-full my-6 px-4">
      <div 
        className="relative rounded-lg overflow-hidden border-4 border-black/80"
        style={{
          background: 'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 100%)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        {/* LCD screen effect overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, transparent 1px, transparent 2px, rgba(0,0,0,0.1) 3px)',
            opacity: 0.3
          }}
        />
        
        {/* Scrolling text */}
        <div className="relative px-4 py-3 overflow-hidden">
          <div 
            className="whitespace-nowrap font-mono text-lg sm:text-xl md:text-2xl font-bold tracking-wider"
            style={{
              color: '#7CFC00',
              textShadow: '0 0 10px rgba(124, 252, 0, 0.8), 0 0 20px rgba(124, 252, 0, 0.4)',
              transform: `translateX(-${scrollPosition}ch)`,
              transition: 'transform 0.1s linear'
            }}
          >
            {displayText || '--- LOADING ---'}
          </div>
        </div>
        
        {/* Bottom reflection effect */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(124, 252, 0, 0.1), transparent)'
          }}
        />
      </div>
    </div>
  );
};

export default LCDDisplay;
