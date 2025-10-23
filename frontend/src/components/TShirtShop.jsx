import React, { memo } from 'react';
import { ShoppingBag, ExternalLink } from 'lucide-react';

// Memoized T-Shirt Shop component to prevent re-renders from player state changes
const TShirtShop = memo(({ isCarMode }) => {
  return (
    <div 
      className="w-full mt-6"
      style={{
        display: 'grid',
        placeItems: 'center',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto',
        minHeight: 'auto',
        contain: 'layout',
        isolation: 'isolate'
      }}
    >
      <div 
        style={{
          display: 'block',
          width: '300px',
          height: 'auto',
          position: 'relative',
          flexShrink: 0,
          flexGrow: 0,
          margin: '0 auto'
        }}
      >
        <a
          href="https://greatesthitsnonstop.teemill.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-transform duration-300 hover:scale-105 group"
          aria-label="Visit Greatest Hits Non-Stop T-Shirt Shop"
          style={{
            display: 'block',
            width: '300px',
            height: 'auto'
          }}
        >
          <div 
            className="premium-container-strong relative rounded-2xl overflow-hidden shadow-2xl hover:shadow-copper transition-all duration-300"
            style={{
              display: 'block',
              width: '300px',
              minWidth: '300px',
              maxWidth: '300px',
              height: 'auto',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            <img
              src="https://customer-assets.emergentagent.com/job_ghns-project/artifacts/ckl165ez_qbff84yrbkxvbvrl2t2ejwrofa4wcvljpi5drzpjymp82sw0.png.webp"
              alt="Greatest Hits Non-Stop T-Shirt Shop"
              style={{ 
                display: 'block',
                width: '300px',
                height: 'auto',
                maxWidth: 'none',
                minWidth: 'auto',
                objectFit: 'contain',
                verticalAlign: 'top'
              }}
              loading="lazy"
            />
            {/* Premium Text Overlay */}
            <div 
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-5 group-hover:from-black/95 transition-all duration-300"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-5 h-5" style={{ color: '#ea580c' }} />
                <h3 className="text-white text-lg font-bold drop-shadow-lg">Official Merchandise</h3>
              </div>
              <p className="text-sm font-medium drop-shadow-lg mb-2" style={{ color: '#ea580c' }}>Greatest Hits Non-Stop</p>
              <div className="flex items-center gap-2 text-white/80 text-xs">
                <span>Visit Shop</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>
            
            {/* Copper accent line at top */}
            <div 
              className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-copper-500 to-transparent"
              style={{ pointerEvents: 'none' }}
            />
          </div>
        </a>
      </div>
    </div>
  );
});

TShirtShop.displayName = 'TShirtShop';

export default TShirtShop;