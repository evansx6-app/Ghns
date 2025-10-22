import React, { useEffect, useState, useRef } from 'react';

const SafariVisualiser = ({ isPlaying, colors }) => {
  const [bars, setBars] = useState([]);
  const animationFrameRef = useRef(null);
  const barsRef = useRef([]);
  const numBars = 32;

  // Initialize bars with random properties
  useEffect(() => {
    const initialBars = Array.from({ length: numBars }, (_, i) => ({
      id: i,
      height: 20 + Math.random() * 30,
      targetHeight: 20 + Math.random() * 80,
      speed: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      frequency: 0.02 + Math.random() * 0.03
    }));
    setBars(initialBars);
    barsRef.current = initialBars;
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Animate bars back to rest state
      barsRef.current = barsRef.current.map(bar => ({
        ...bar,
        targetHeight: 20 + Math.random() * 10
      }));
      return;
    }

    let time = 0;
    
    const animate = () => {
      time += 0.016; // ~60fps
      
      // Update each bar with smooth wave-like motion
      const updatedBars = barsRef.current.map((bar, i) => {
        // Create wave patterns with different frequencies
        const wave1 = Math.sin(time * bar.frequency + bar.phase) * 30;
        const wave2 = Math.sin(time * bar.frequency * 2 + i * 0.5) * 15;
        const wave3 = Math.cos(time * bar.frequency * 0.5 + i * 0.3) * 20;
        
        // Combine waves for complex motion
        const targetHeight = 30 + wave1 + wave2 + wave3 + Math.random() * 10;
        
        // Smooth interpolation towards target
        const currentHeight = bar.height + (targetHeight - bar.height) * 0.15;
        
        return {
          ...bar,
          height: Math.max(10, Math.min(95, currentHeight)),
          targetHeight
        };
      });
      
      barsRef.current = updatedBars;
      setBars([...updatedBars]);
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  if (!isPlaying) {
    return (
      <div className="premium-container-subtle w-full h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden flex items-center justify-center">
        <p className="text-white/50 text-sm">Play music to see visualiser</p>
      </div>
    );
  }

  return (
    <div className="premium-container w-full h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden relative">
      <div className="absolute inset-0 flex items-end justify-center gap-1 px-2 pb-2">
        {bars.map((bar) => (
          <div
            key={bar.id}
            className="flex-1 max-w-[12px] rounded-t-full transition-all duration-75 ease-out"
            style={{
              height: `${bar.height}%`,
              background: `linear-gradient(to top, ${colors.primary || '#B87333'}, ${colors.secondary || '#9E6B3F'}, ${colors.accent || '#8B5A3C'})`,
              boxShadow: `0 0 10px ${colors.primary || '#B87333'}40`,
              transform: 'scaleY(1)',
              transformOrigin: 'bottom'
            }}
          />
        ))}
      </div>
      
      {/* Reflection effect */}
      <div className="absolute inset-0 flex items-start justify-center gap-1 px-2 pt-2 opacity-30">
        {bars.map((bar) => (
          <div
            key={`reflection-${bar.id}`}
            className="flex-1 max-w-[12px] rounded-b-full transition-all duration-75 ease-out"
            style={{
              height: `${bar.height * 0.4}%`,
              background: `linear-gradient(to bottom, ${colors.primary || '#B87333'}60, transparent)`,
              transform: 'scaleY(-1)',
              transformOrigin: 'top'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SafariVisualiser;
