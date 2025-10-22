import React from 'react';
import './VinylFallback.css';
import { Disc3 } from 'lucide-react';

const VinylFallback = ({ 
  size = 'w-full h-full', 
  spinning = true, 
  speed = 'normal',
  showLabel = true 
}) => {
  const speedClass = {
    slow: 'vinyl-spin-slow',
    normal: 'vinyl-spin',
    fast: 'vinyl-spin-fast'
  }[speed] || 'vinyl-spin';

  return (
    <div className={`vinyl-record-container ${size} relative`}>
      {/* Vinyl Record Base */}
      <div 
        className={`vinyl-record ${spinning ? speedClass : ''} relative w-full h-full rounded-full`}
        style={{
          background: `
            radial-gradient(circle at center, 
              #1a1a1a 0%, 
              #0d0d0d 15%, 
              #1a1a1a 16%, 
              #0f0f0f 31%, 
              #1a1a1a 32%, 
              #0e0e0e 47%, 
              #1a1a1a 48%, 
              #0d0d0d 63%, 
              #1a1a1a 64%, 
              #0f0f0f 79%, 
              #1a1a1a 80%, 
              #050505 100%
            )
          `,
          boxShadow: `
            inset 0 0 0 1px rgba(255,255,255,0.15),
            inset 0 0 30px rgba(0,0,0,0.9),
            0 8px 32px rgba(0,0,0,0.6),
            0 2px 8px rgba(0,0,0,0.4)
          `
        }}
      >
        {/* Enhanced Vinyl Grooves Effect */}
        <div className="absolute inset-0 rounded-full overflow-hidden opacity-60">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border"
              style={{
                top: `${5 + i * 4.5}%`,
                left: `${5 + i * 4.5}%`,
                right: `${5 + i * 4.5}%`,
                bottom: `${5 + i * 4.5}%`,
                borderColor: i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                borderWidth: '1px'
              }}
            />
          ))}
        </div>

        {/* Center Label - Stays Static */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 vinyl-label-static">
          <div 
            className="vinyl-label rounded-full bg-gradient-to-br from-copper-500 via-copper-600 to-copper-800 flex items-center justify-center border-2 border-copper-400/30 shadow-xl"
            style={{
              width: '40%',
              height: '40%',
              minWidth: '80px',
              minHeight: '80px',
              maxWidth: '140px',
              maxHeight: '140px',
              boxShadow: `
                inset 0 2px 8px rgba(255,255,255,0.3),
                inset 0 -2px 8px rgba(0,0,0,0.4),
                0 0 20px rgba(251, 146, 60, 0.5),
                0 4px 12px rgba(0,0,0,0.3)
              `
            }}
          >
            {/* Inner Label Ring */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div 
                className="absolute inset-2 rounded-full border border-white/20"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)'
                }}
              />
            </div>

            {/* Logo Container */}
            <div className="relative w-full h-full flex items-center justify-center p-3 z-10">
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                {/* Main Logo - New Image */}
                <img 
                  src="https://customer-assets.emergentagent.com/job_ghns-tracker/artifacts/vn7s6nrt_unnamed.png"
                  alt="Greatest Hits Non-Stop"
                  className="w-full h-full object-contain drop-shadow-lg"
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    e.target.style.display = 'none';
                    const fallbackText = document.createElement('div');
                    fallbackText.innerHTML = '<div class="text-white font-bold text-center"><div class="text-2xl sm:text-3xl md:text-4xl leading-none mb-1 tracking-wider">GHNS</div><div class="text-xs sm:text-sm opacity-90 tracking-widest font-semibold">RADIO</div></div>';
                    e.target.parentElement.appendChild(fallbackText);
                  }}
                />
              </div>
            </div>

            {/* Label Text Ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <defs>
                  <path
                    id="circlePath"
                    d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0"
                  />
                </defs>
                <text className="text-[4px] fill-white/40 font-bold tracking-widest">
                  <textPath href="#circlePath" startOffset="25%">
                    GREATEST HITS NON-STOP • SCOTLAND •
                  </textPath>
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* Center Hole */}
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-radial from-black via-gray-900 to-black rounded-full border-2 border-white/30 shadow-inner vinyl-label-static"
          style={{
            width: '10%',
            height: '10%',
            minWidth: '12px',
            minHeight: '12px',
            maxWidth: '20px',
            maxHeight: '20px',
            boxShadow: `
              inset 0 0 8px rgba(0,0,0,0.9),
              0 0 4px rgba(255,255,255,0.2)
            `
          }}
        />

        {/* Enhanced Vinyl Shine Effect - Rotates with vinyl */}
        <div 
          className="absolute top-0 left-0 w-full h-full rounded-full pointer-events-none opacity-40"
          style={{
            background: `
              linear-gradient(135deg, 
                transparent 20%, 
                rgba(255,255,255,0.15) 35%, 
                rgba(255,255,255,0.08) 50%, 
                transparent 65%
              )
            `
          }}
        />

        {/* Secondary Shine */}
        <div 
          className="absolute top-0 left-0 w-full h-full rounded-full pointer-events-none opacity-20"
          style={{
            background: `
              linear-gradient(-45deg, 
                transparent 30%, 
                rgba(255,255,255,0.1) 45%, 
                transparent 60%
              )
            `
          }}
        />
      </div>

      {/* Optional label text */}
      {showLabel && (
        <div className="absolute bottom-[-24px] left-1/2 transform -translate-x-1/2 text-white/60 text-xs text-center whitespace-nowrap">
          No Artwork Available
        </div>
      )}
    </div>
  );
};

export default VinylFallback;