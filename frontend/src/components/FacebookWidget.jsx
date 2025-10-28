import React, { useState, memo } from 'react';
import { Facebook, ExternalLink } from 'lucide-react';

const FacebookWidget = memo(({ pageName = 'greatesthitsnonstop' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const facebookPageUrl = `https://www.facebook.com/${pageName}`;

  return (
    <div 
      className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      style={{
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        willChange: 'auto'
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Facebook className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm md:text-base">
            Follow us on Facebook
          </span>
        </div>
        <ExternalLink className="w-4 h-4 text-white/70" />
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Facebook Logo */}
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
            <Facebook className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>

          {/* Page Info */}
          <div className="text-center">
            <h3 className="text-white font-bold text-lg md:text-xl mb-1">
              Greatest Hits Non-Stop
            </h3>
          </div>

          {/* Follow Button */}
          <a
            href={facebookPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <button
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-lg touch-manipulation transition-all duration-200"
              style={{
                background: isHovered 
                  ? 'linear-gradient(135deg, #1877f2 0%, #0a5cd6 100%)'
                  : 'linear-gradient(135deg, #1877f2 0%, #166fe5 100%)',
                transform: isHovered ? 'translateY(-2px) translateZ(0)' : 'translateY(0) translateZ(0)',
                boxShadow: isHovered 
                  ? '0 8px 20px rgba(24, 119, 242, 0.4)' 
                  : '0 4px 12px rgba(24, 119, 242, 0.3)',
                backfaceVisibility: 'hidden',
                willChange: 'auto'
              }}
            >
              <Facebook className="w-5 h-5" />
              <span>Follow Page</span>
            </button>
          </a>

          {/* Additional Info */}
          <div className="flex items-center gap-4 text-xs text-white/50 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span>Live Updates</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Active Community</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer accent */}
      <div className="h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600" />
    </div>
  );
});

FacebookWidget.displayName = 'FacebookWidget';

export default FacebookWidget;
