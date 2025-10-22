import React from 'react';

const DynamicBackground = ({ colors = {
  primary: 'rgb(245, 158, 11)',
  secondary: 'rgb(251, 146, 60)', 
  accent: 'rgb(217, 119, 6)'
}, isPlaying }) => {
  const { primary, secondary, accent } = colors;
  
  // Convert RGB to RGBA with opacity
  const toRGBA = (rgbString, opacity) => {
    const rgb = rgbString.match(/\d+/g);
    if (!rgb) return rgbString;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  };

  return (
    <>
      {/* Base gradient background */}
      <div 
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{
          background: `linear-gradient(135deg, 
            ${toRGBA(primary, 0.15)} 0%, 
            rgba(0,0,0,0.8) 30%, 
            rgba(0,0,0,0.9) 70%, 
            ${toRGBA(secondary, 0.12)} 100%)`
        }}
      />
      
      {/* Dynamic color layers */}
      <div 
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{
          background: `radial-gradient(ellipse at 20% 20%, 
            ${toRGBA(primary, 0.2)} 0%, 
            transparent 50%)`
        }}
      />
      
      <div 
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{
          background: `radial-gradient(ellipse at 80% 80%, 
            ${toRGBA(secondary, 0.15)} 0%, 
            transparent 50%)`
        }}
      />
      
      <div 
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, 
            ${toRGBA(accent, 0.1)} 0%, 
            transparent 40%)`
        }}
      />

      {/* Animated elements that respond to music */}
      <div 
        className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-1000 ${
          isPlaying ? 'animate-pulse' : ''
        }`}
        style={{
          background: `linear-gradient(45deg, 
            ${toRGBA(primary, 0.1)}, 
            ${toRGBA(secondary, 0.05)})`
        }}
      />
      
      <div 
        className={`absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl transition-all duration-1000 ${
          isPlaying ? 'animate-pulse' : ''
        }`}
        style={{
          background: `linear-gradient(-45deg, 
            ${toRGBA(secondary, 0.08)}, 
            ${toRGBA(accent, 0.06)})`,
          animationDelay: '1s'
        }}
      />

      {/* Subtle grid pattern with extracted colors */}
      <div 
        className="absolute inset-0 opacity-[0.03] transition-opacity duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${toRGBA(primary, 0.3)} 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Music-reactive overlay */}
      {isPlaying && (
        <div 
          className="absolute inset-0 animate-pulse transition-all duration-500"
          style={{
            background: `linear-gradient(45deg, 
              ${toRGBA(primary, 0.02)} 0%, 
              transparent 25%, 
              ${toRGBA(secondary, 0.02)} 50%, 
              transparent 75%, 
              ${toRGBA(accent, 0.02)} 100%)`,
            backgroundSize: '400% 400%',
            animation: isPlaying ? 'gradientShift 8s ease infinite' : 'none'
          }}
        />
      )}
    </>
  );
};

export default DynamicBackground;