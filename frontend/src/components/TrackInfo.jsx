import React, { useState, useEffect, useRef } from 'react';
import { Music } from 'lucide-react';
import ScrollingText from './ScrollingText';
import useArtworkStability from '../hooks/useArtworkStability';

const TrackInfo = ({ track }) => {
  // Check if this is the station ID track or fallback track
  const isStationID = track?.title === "Greatest Hits Non-Stop";
  const isFallbackTrack = track?.title === "Legendary Radio from Scotland";
  const logoUrl = process.env.REACT_APP_LOGO_URL;
  
  // For fallback track, force vinyl display by treating it as no artwork
  const hasArtwork = !isFallbackTrack && track?.artwork_url && 
                      track.artwork_url !== null && 
                      track.artwork_url !== 'vinyl-fallback-placeholder';
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [forceVisible, setForceVisible] = useState(false);
  const containerRef = useRef(null);
  
  // Enhanced artwork stability system
  const { artworkRef, ensureArtworkVisibility } = useArtworkStability(
    imageLoaded, 
    imageError, 
    hasArtwork || isStationID
  );

  // Aggressive image preloading for faster display
  useEffect(() => {
    if (hasArtwork || isStationID) {
      setImageLoaded(false);
      setImageError(false);
      setForceVisible(false);
      
      // Aggressive preload with Image object for faster loading
      if (track?.artwork_url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        
        // Start loading immediately
        img.src = track.artwork_url;
        
        img.onload = () => {
          console.log('Preload complete for:', track?.title);
          // Image is now in browser cache, actual img tag will load instantly
        };
        
        img.onerror = () => {
          console.warn('Preload failed for:', track?.title);
        };
        
        // Also add link preload for additional speed
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'preload';
        preloadLink.as = 'image';
        preloadLink.href = track.artwork_url;
        preloadLink.crossOrigin = 'anonymous';
        preloadLink.fetchPriority = 'high';
        document.head.appendChild(preloadLink);
        
        // Cleanup
        return () => {
          img.onload = null;
          img.onerror = null;
          if (document.head.contains(preloadLink)) {
            document.head.removeChild(preloadLink);
          }
        };
      }
    }
  }, [track?.artwork_url, hasArtwork, isStationID]);

  // Track change handler with stability reinforcement
  useEffect(() => {
    if (imageLoaded && !imageError && (hasArtwork || isStationID)) {
      setForceVisible(true);
      // Give the stability hook a moment to activate
      setTimeout(() => {
        ensureArtworkVisibility();
      }, 50);
    }
  }, [imageLoaded, imageError, hasArtwork, isStationID, ensureArtworkVisibility]);

  return (
    <div className="text-center space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6">
      {/* Album Art - Ultra Scroll-stable with enhanced layering and visibility protection */}
      <div 
        ref={containerRef}
        className="premium-container mx-auto w-28 h-28 sm:w-32 sm:h-32 md:w-48 md:h-48 lg:w-56 lg:h-56 xl:w-64 xl:h-64 rounded-lg sm:rounded-xl md:rounded-2xl shadow-2xl overflow-hidden relative"
        style={{
          isolation: 'isolate', // Create new stacking context
          contain: 'layout style paint', // Optimize rendering performance
        }}
      >
        {/* Static fallback image - always visible */}
        <div 
          className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center z-10 p-4"
          style={{
            willChange: 'auto',
            backfaceVisibility: 'hidden'
          }}
        >
          <img
            src="https://customer-assets.emergentagent.com/job_ghns-tracker/artifacts/gkqz48mn_unnamed.png"
            alt="Greatest Hits Non-Stop"
            className="w-full h-full object-contain"
          />
        </div>
        
        {/* Ultra-stable artwork overlay */}
        {(hasArtwork || isStationID) && (
          <img
            ref={artworkRef}
            src={isStationID ? logoUrl : track.artwork_url}
            alt={isStationID ? "Greatest Hits Non-Stop Logo" : `${track.artist} - ${track.title}`}
            className={`w-full h-full object-cover absolute inset-0 z-20 transition-opacity duration-200 ${
              (imageLoaded && !imageError) || forceVisible ? 'opacity-100' : 'opacity-0'
            }`}
            loading="eager"
            fetchpriority="high"
            decoding="async"
            draggable="false"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={(e) => {
              console.log('Artwork failed to load for:', track?.title);
              setImageError(true);
              setImageLoaded(false);
              setForceVisible(false);
            }}
            onLoad={(e) => {
              console.log('Artwork loaded successfully for:', track?.title);
              setImageLoaded(true);
              setImageError(false);
              setForceVisible(true);
              
              // Comprehensive visibility enforcement
              if (e.target) {
                requestAnimationFrame(() => {
                  e.target.style.setProperty('opacity', '1', 'important');
                  e.target.style.setProperty('visibility', 'visible', 'important');
                  e.target.style.setProperty('display', 'block', 'important');
                  e.target.style.setProperty('z-index', '20', 'important');
                  
                  // Trigger stability system
                  ensureArtworkVisibility();
                });
              }
            }}
            style={{
              willChange: 'opacity',
              backfaceVisibility: 'hidden',
              transform: 'translate3d(0, 0, 0)', // Force hardware acceleration
              imageRendering: 'auto',
              objectFit: isStationID ? 'contain' : 'cover',
              objectPosition: 'center',
              minWidth: '100%',
              minHeight: '100%',
              visibility: (imageLoaded && !imageError) || forceVisible ? 'visible' : 'hidden',
              display: (hasArtwork || isStationID) ? 'block' : 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 20
            }}
          />
        )}
        
        {/* Additional stability layer for critical situations */}
        {hasArtwork && (imageLoaded || forceVisible) && !imageError && (
          <div 
            className="absolute inset-0 z-[21] pointer-events-none"
            style={{
              backgroundImage: `url(${track.artwork_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: forceVisible ? 0.01 : 0, // Nearly invisible backup layer
              transition: 'opacity 0.1s ease'
            }}
          />
        )}
      </div>

      {/* Track Details */}
      <div className="space-y-1.5 sm:space-y-2 md:space-y-3 lg:space-y-4 w-full overflow-hidden">
        {/* Scrolling Track Title */}
        <div className="w-full">
          <ScrollingText 
            text={track?.title || 'Loading...'}
            className="text-base sm:text-lg md:text-xl lg:text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight"
            speed={40}
            pauseDuration={1500}
          />
        </div>
        
        {/* Scrolling Artist Name */}
        <div className="w-full">
          <ScrollingText
            text={track?.artist || 'Loading...'}
            className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-white/80 font-medium"
            speed={35}
            pauseDuration={1500}
          />
        </div>
        
        {/* Album (non-scrolling, usually shorter) */}
        {track?.album && (
          <p className="text-white/50 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl truncate px-2">
            {track.album}
          </p>
        )}
      </div>

      {/* Duration (only for non-live content) */}
      {!track?.isLive && track?.duration && (
        <div className="text-white/50 text-sm">
          {track.duration}
        </div>
      )}
    </div>
  );
};

export default TrackInfo;