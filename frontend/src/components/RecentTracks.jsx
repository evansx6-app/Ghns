import React, { useState, useEffect, useRef, memo } from 'react';
import { Clock, Music, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { streamAPI } from '../services/api';
import ScrollingText from './ScrollingText';
import OptimizedImage from './OptimizedImage';
import useScrollContainerArtworkStability from '../hooks/useScrollContainerArtworkStability';

const RecentTracks = ({ carMode = false }) => {
  const [recentTracks, setRecentTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Ref for the scrollable container
  const scrollContainerRef = useRef(null);
  
  // Enhanced artwork stability for scroll container
  const { enforceArtworkVisibility, isMonitoring } = useScrollContainerArtworkStability(
    scrollContainerRef, 
    !isLoading && recentTracks.length > 0
  );

  const fetchRecentTracks = async () => {
    try {
      const response = await streamAPI.getRecentTracks(15);
      if (response.success) {
        setRecentTracks(response.tracks);
      }
    } catch (error) {
      console.error('Error fetching recent tracks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecentTracks();
    
    // Enforce artwork visibility after refresh
    setTimeout(() => {
      enforceArtworkVisibility?.();
    }, 300);
    
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchRecentTracks();
    // Refresh every 30 seconds to stay in sync with track changes
    const interval = setInterval(fetchRecentTracks, 30000);
    return () => clearInterval(interval);
  }, []);

  // Enhanced effect to enforce artwork visibility when tracks change
  useEffect(() => {
    if (!isLoading && recentTracks.length > 0 && enforceArtworkVisibility) {
      // Delay to let DOM render
      const timeout = setTimeout(() => {
        enforceArtworkVisibility();
      }, 200);
      
      return () => clearTimeout(timeout);
    }
  }, [recentTracks, isLoading, enforceArtworkVisibility]);

  if (isLoading) {
    return (
      <Card className="premium-container-strong rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className={`text-white flex items-center space-x-2 ${carMode ? 'text-xl' : ''}`}>
            <Clock className={`${carMode ? 'h-7 w-7' : 'h-5 w-5'}`} />
            <span>Recently Played</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="premium-container rounded-xl sm:rounded-2xl md:rounded-3xl shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4 md:pb-5 px-4 sm:px-6 md:px-8 lg:px-10 pt-4 sm:pt-6 md:pt-8">
        <CardTitle className={`text-white flex items-center space-x-2 sm:space-x-3 ${carMode ? 'text-lg sm:text-xl md:text-2xl' : 'text-base sm:text-lg md:text-xl lg:text-2xl'}`}>
          <Clock className={`${carMode ? 'h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8' : 'h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7'}`} />
          <span>Recently Played</span>
        </CardTitle>
        <Button
          variant="ghost"
          size={carMode ? "lg" : "sm"}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-white/70 hover:text-white hover:bg-white/10 touch-manipulation min-w-[44px] min-h-[44px]"
        >
          <RefreshCw className={`${carMode ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4'} ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      
      <CardContent 
        ref={scrollContainerRef}
        className="space-y-2.5 sm:space-y-3 md:space-y-4 max-h-80 sm:max-h-96 md:max-h-[32rem] lg:max-h-[40rem] overflow-y-auto scroll-container-artwork-stable px-4 sm:px-6 md:px-8 lg:px-10 pb-4 sm:pb-6 md:pb-8"
        style={{
          isolation: 'isolate',
          contain: 'layout style paint',
          scrollBehavior: 'smooth'
        }}
      >
        {recentTracks.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-white/50">
            <Music className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className={carMode ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}>No recent tracks available</p>
          </div>
        ) : (
          recentTracks.map((track, index) => (
            <div key={index}>
              <div className="flex items-center space-x-2.5 sm:space-x-3 md:space-x-4 lg:space-x-5">
                {/* Enhanced Scroll-Stable Artwork */}
                <div 
                  className={`premium-container-subtle ${carMode ? 'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16' : 'w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16'} rounded-md sm:rounded-lg overflow-hidden flex-shrink-0 relative`}
                  style={{
                    isolation: 'isolate',
                    contain: 'layout style paint'
                  }}
                >
                  {/* Always visible static fallback */}
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center z-10 p-1">
                    <img
                      src="https://customer-assets.emergentagent.com/job_ghns-tracker/artifacts/gkqz48mn_unnamed.png"
                      alt="Greatest Hits Non-Stop"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  {/* Scroll-Stable artwork overlay with enhanced protection */}
                  {track.artwork_url && track.artwork_url !== 'vinyl-fallback-placeholder' && (
                    <img
                      src={track.artwork_url}
                      alt={`${track.artist} - ${track.title}`}
                      className="absolute inset-0 w-full h-full object-cover z-20 scroll-artwork-stable"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                      fetchpriority="low"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      data-track-id={`recent-${index}`}
                      data-artwork-protected="true"
                      style={{
                        willChange: 'auto',
                        backfaceVisibility: 'hidden',
                        transform: 'translate3d(0, 0, 0)',
                        imageRendering: 'auto',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        minWidth: '100%',
                        minHeight: '100%',
                        // Enhanced scroll stability
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 20
                      }}
                      onError={(e) => {
                        console.log(`Recent track artwork failed to load: ${track.title}`);
                        // Graceful fallback - hide artwork, show fallback
                        e.target.style.setProperty('opacity', '0', 'important');
                        e.target.style.setProperty('visibility', 'hidden', 'important');
                        
                        // Trigger stability enforcement after error
                        setTimeout(() => {
                          enforceArtworkVisibility?.();
                        }, 100);
                      }}
                      onLoad={(e) => {
                        // Ensure visibility on successful load with high priority
                        requestAnimationFrame(() => {
                          e.target.style.setProperty('opacity', '1', 'important');
                          e.target.style.setProperty('visibility', 'visible', 'important');
                          e.target.style.setProperty('display', 'block', 'important');
                          
                          // Trigger stability check
                          enforceArtworkVisibility?.();
                        });
                      }}
                    />
                  )}
                </div>

                {/* Track Info with Scrolling Text - Left Justified */}
                <div className="flex-1 min-w-0">
                  <ScrollingText
                    text={track.title}
                    className={`text-white font-medium ${carMode ? 'text-base sm:text-lg md:text-xl' : 'text-xs sm:text-sm md:text-base lg:text-lg'}`}
                    speed={25}
                    pauseDuration={1000}
                    align="left"
                  />
                  <ScrollingText
                    text={track.artist}
                    className={`text-white/70 ${carMode ? 'text-sm sm:text-base md:text-lg' : 'text-[10px] sm:text-xs md:text-sm lg:text-base'}`}
                    speed={25}
                    pauseDuration={1000}
                    align="left"
                  />
                </div>

                {/* Play Time */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-white/50 ${carMode ? 'text-xs sm:text-sm md:text-base' : 'text-[10px] sm:text-xs md:text-sm lg:text-base'} whitespace-nowrap`}>
                    {track.played_at_formatted}
                  </p>
                </div>
              </div>
              
              {index < recentTracks.length - 1 && (
                <Separator className="mt-2.5 sm:mt-3 bg-white/10" />
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default RecentTracks;