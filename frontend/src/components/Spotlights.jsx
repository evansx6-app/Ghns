import React, { useEffect, useState } from 'react';

const Spotlights = ({ colors, isPlaying }) => {
  const [spotlightPositions, setSpotlightPositions] = useState([
    { x: 20, y: 0, delay: 0 },
    { x: 50, y: 0, delay: 0.3 },
    { x: 80, y: 0, delay: 0.6 }
  ]);

  // Gentle random movement for spotlights
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSpotlightPositions(prev => 
        prev.map(pos => ({
          ...pos,
          x: Math.max(10, Math.min(90, pos.x + (Math.random() - 0.5) * 10)),
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="absolute inset-x-0 top-20 h-96 pointer-events-none overflow-hidden">
      {/* Spotlight beams */}
      {spotlightPositions.map((pos, index) => (
        <div
          key={index}
          className="absolute top-0 w-32 md:w-48 h-full transition-all duration-3000 ease-out"
          style={{
            left: `${pos.x}%`,
            transform: 'translateX(-50%)',
            animation: isPlaying ? `spotlightSway ${4 + index}s ease-in-out infinite` : 'none',
            animationDelay: `${pos.delay}s`
          }}
        >
          {/* Outer glow */}
          <div
            className="absolute inset-0 opacity-20 blur-3xl"
            style={{
              background: `linear-gradient(to bottom, 
                ${index === 0 ? colors.primary : index === 1 ? colors.secondary : colors.accent} 0%,
                transparent 70%
              )`,
            }}
          />
          
          {/* Main beam */}
          <div
            className="absolute inset-0 opacity-30 blur-2xl"
            style={{
              background: `linear-gradient(to bottom, 
                ${index === 0 ? colors.primary : index === 1 ? colors.secondary : colors.accent} 0%,
                transparent 60%
              )`,
              clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)',
            }}
          />
          
          {/* Inner bright core */}
          <div
            className="absolute inset-0 opacity-50 blur-xl"
            style={{
              background: `linear-gradient(to bottom, 
                ${index === 0 ? colors.primary : index === 1 ? colors.secondary : colors.accent} 0%,
                transparent 40%
              )`,
              clipPath: 'polygon(45% 0%, 55% 0%, 80% 100%, 20% 100%)',
            }}
          />
        </div>
      ))}

      {/* Atmospheric haze */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(ellipse at top, ${colors.primary} 0%, transparent 50%)`,
          animation: isPlaying ? 'atmosphericPulse 6s ease-in-out infinite' : 'none'
        }}
      />
    </div>
  );
};

export default Spotlights;
