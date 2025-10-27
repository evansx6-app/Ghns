import React, { memo } from 'react';

const DynamicBackground = memo(({ colors = {
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
      {/* Deep gradient background with album art colors */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, 
            ${toRGBA(primary, 0.35)} 0%, 
            ${toRGBA(secondary, 0.25)} 25%,
            rgba(0,0,0,0.85) 50%, 
            ${toRGBA(accent, 0.28)} 75%,
            ${toRGBA(secondary, 0.3)} 100%)`,
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'auto'
        }}
      />
      
      {/* Enhanced dynamic color layers */}
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 20% 20%, 
            ${toRGBA(primary, 0.45)} 0%, 
            ${toRGBA(primary, 0.2)} 30%,
            transparent 60%)`,
          transform: 'translateZ(0)',
          willChange: 'auto'
        }}
      />
      
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 80% 80%, 
            ${toRGBA(secondary, 0.4)} 0%, 
            ${toRGBA(secondary, 0.18)} 30%,
            transparent 60%)`,
          transform: 'translateZ(0)',
          willChange: 'auto'
        }}
      />
      
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, 
            ${toRGBA(accent, 0.3)} 0%, 
            ${toRGBA(accent, 0.12)} 25%,
            transparent 50%)`,
          transform: 'translateZ(0)',
          willChange: 'auto'
        }}
      />

      {/* Larger animated elements for deeper color impact - reduced animation */}
      <div 
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{
          background: `linear-gradient(45deg, 
            ${toRGBA(primary, 0.25)}, 
            ${toRGBA(secondary, 0.15)})`,
          transform: 'translateZ(0)',
          willChange: 'auto'
        }}
      />
      
      <div 
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background: `linear-gradient(-45deg, 
            ${toRGBA(secondary, 0.22)}, 
            ${toRGBA(accent, 0.18)})`,
          transform: 'translateZ(0)',
          willChange: 'auto'
        }}
      />
      
      {/* Additional color bloom in center */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, 
            ${toRGBA(primary, 0.15)} 0%, 
            ${toRGBA(secondary, 0.1)} 40%,
            transparent 70%)`,
          transform: 'translate(-50%, -50%) translateZ(0)',
          willChange: 'auto'
        }}
      />

      {/* Enhanced grid pattern with extracted colors */}
      <div 
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${toRGBA(primary, 0.4)} 1px, transparent 0)`,
          backgroundSize: '20px 20px',
          transform: 'translateZ(0)',
          willChange: 'auto'
        }}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  return (
    prevProps.colors.primary === nextProps.colors.primary &&
    prevProps.colors.secondary === nextProps.colors.secondary &&
    prevProps.colors.accent === nextProps.colors.accent &&
    prevProps.isPlaying === nextProps.isPlaying
  );
});

export default DynamicBackground;