import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Play, Pause, Volume2, Clock, Music, Maximize2, Cast, Radio, Disc3, ListMusic } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Card, CardContent } from './ui/card';
import { useToast } from '../hooks/use-toast';
import { streamAPI, connectionManager } from '../services/api';
import { useMediaSession } from '../hooks/useMediaSession';
import { useCast } from '../hooks/useCast';
import { useColorExtraction } from '../hooks/useColorExtraction';
import { useBeatDetection } from '../hooks/useBeatDetection';
import SleepTimer from './SleepTimer';
import TrackInfo from './TrackInfo';
import CastButton from './CastButton';
import SafariVisualiser from './SafariVisualiser';
import DynamicBackground from './DynamicBackground';
import InstallButton from './InstallButton';
import ConnectionStatus from './ConnectionStatus';
import LCDDisplay from './LCDDisplay';
import OptimizedImage from './OptimizedImage';

// Lazy load heavy/non-critical components for better initial load performance
const RecentTracks = lazy(() => import('./RecentTracks'));
const LyricsDisplay = lazy(() => import('./LyricsDisplay'));
const StreamRecorder = lazy(() => import('./StreamRecorder'));
const TShirtShop = lazy(() => import('./TShirtShop'));
const ScrollingText = lazy(() => import('./ScrollingText'));

const ModernAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([70]);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  
  // Initialize with a stable fallback to prevent null states
  const [currentTrack, setCurrentTrack] = useState({
    title: "Greatest Hits Non-Stop",
    artist: "Live Radio Stream",
    album: "Legendary Radio from Scotland",
    isLive: true,
    streamUrl: process.env.REACT_APP_STREAM_URL,
    artwork_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=500&fit=crop&crop=center",
    fallback: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [streamHealth, setStreamHealth] = useState(null);
  const [isCarMode, setIsCarMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeView, setActiveView] = useState('player'); // player, recent, lyrics
  const audioRef = useRef(null);
  const shownToastsRef = useRef(new Set());
  const lastValidTrackRef = useRef(currentTrack); // Preserve last valid track
  
  // Performance optimization: Detect slow device and adjust features
  const [isSlowDevice, setIsSlowDevice] = useState(false);
  useEffect(() => {
    // Detect slow device based on hardware concurrency and connection
    const cores = navigator.hardwareConcurrency || 2;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const slowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g');
    const isLowEnd = cores < 4 || slowConnection;
    setIsSlowDevice(isLowEnd);
    
    if (isLowEnd) {
      console.log('Slow device detected - optimizing performance');
    }
  }, []);
  const { toast } = useToast();

  // Determine artwork URL - use logo for station ID
  const logoUrl = process.env.REACT_APP_LOGO_URL;
  const isStationID = currentTrack?.title === "Greatest Hits Non-Stop";
  const isFallbackTrack = currentTrack?.title === "Legendary Radio from Scotland";
  const artworkForColorExtraction = isStationID ? logoUrl : (!isFallbackTrack ? currentTrack?.artwork_url : null);
  
  // Extract colors from album artwork
  const { colors, isExtracting } = useColorExtraction(artworkForColorExtraction);
  
  // Beat detection for animations
  const beatData = useBeatDetection(audioRef, isPlaying);

  // Stream URLs with fallback
  const STREAM_URLS = [
    process.env.REACT_APP_STREAM_URL,
    process.env.REACT_APP_FALLBACK_STREAM_URL
  ];
  
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const [streamAttempts, setStreamAttempts] = useState(0);
  const [connectionState, setConnectionState] = useState({
    isOnline: navigator.onLine,
    lastReconnect: null,
    autoRetry: true,
    retryCount: 0
  });
  
  const reconnectTimeoutRef = useRef(null);
  const streamCheckIntervalRef = useRef(null);
  const STREAM_URL = STREAM_URLS[currentStreamIndex];

  // Enable Media Session API
  useMediaSession(currentTrack, isPlaying, audioRef);
  
  // Enable Cast functionality
  const {
    isCastAvailable,
    isCasting,
    startCasting,
    stopCasting
  } = useCast(currentTrack, STREAM_URL);

  // Fetch current track data
  const fetchCurrentTrack = async (showToast = false) => {
    try {
      const track = await streamAPI.getCurrentTrack();
      
      // Skip fallback track data - keep current info
      if (!track || track.fallback) {
        console.log('Skipping fallback data, preserving current track');
        if (!currentTrack) {
          setCurrentTrack(track); // Only if we have nothing
        }
        return;
      }
      
      // Ensure track has required fields with fallbacks
      const validatedTrack = {
        ...track,
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || ''
      };
      
      // Check if this is actually a new/different track
      const isNewTrack = !currentTrack || 
        currentTrack.title !== validatedTrack.title || 
        currentTrack.artist !== validatedTrack.artist;
      
      // Check if artwork has changed (even for same track)
      const artworkChanged = currentTrack?.artwork_url !== validatedTrack.artwork_url;
      
      // If same track AND same artwork, keep existing data (prevents unnecessary re-renders)
      if (!isNewTrack && !artworkChanged && currentTrack && !showToast) {
        console.log('Same track and artwork, keeping existing data');
        return;
      }
      
      // If artwork changed but same track, log it
      if (!isNewTrack && artworkChanged) {
        console.log('Same track but artwork updated:', validatedTrack.artwork_url);
      }
      
      // Aggressive artwork preloading for new tracks
      if (isNewTrack && validatedTrack?.artwork_url && validatedTrack.artwork_url !== 'vinyl-fallback-placeholder') {
        // Method 1: Image object preload
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        img.fetchPriority = 'high';
        img.src = validatedTrack.artwork_url;
        
        // Method 2: Link preload in head
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = validatedTrack.artwork_url;
        link.crossOrigin = 'anonymous';
        link.fetchPriority = 'high';
        document.head.appendChild(link);
        
        // Cleanup after 5 seconds
        setTimeout(() => {
          if (document.head.contains(link)) {
            document.head.removeChild(link);
          }
        }, 5000);
        
        console.log('Aggressively preloading new track artwork:', validatedTrack.title);
      }
      
      // Update track data and preserve in ref
      setCurrentTrack(validatedTrack);
      lastValidTrackRef.current = validatedTrack; // Save as last valid track
      setLastUpdate(new Date());
      console.log(`Track updated: ${validatedTrack.title} by ${validatedTrack.artist}`);
      
      // Show toast for new tracks
      if (isNewTrack && currentTrack) {
        const trackId = `${validatedTrack.title}-${validatedTrack.artist}`;
        
        if (!shownToastsRef.current.has(trackId)) {
          toast({
            title: "Now Playing:",
            description: `♪ ${validatedTrack.title} - ${validatedTrack.artist}`,
          });
          shownToastsRef.current.add(trackId);
        }
      }
      
      // Show refresh toast if explicitly requested
      if (showToast) {
        toast({
          title: "Refreshed",
          description: "Track information refreshed",
        });
      }
      
    } catch (error) {
      console.error('Error fetching track:', error.message);
      
      // Always preserve last valid track on error
      if (lastValidTrackRef.current && !lastValidTrackRef.current.fallback) {
        console.log('Fetch error, restoring last valid track:', lastValidTrackRef.current.title);
        setCurrentTrack(lastValidTrackRef.current);
      } else {
        console.log('No valid track to restore, keeping current');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkStreamHealth = async () => {
    try {
      const health = await streamAPI.getStreamHealth();
      setStreamHealth(health);
      setConnectionState(prev => ({ ...prev, retryCount: 0 }));
    } catch (error) {
      // Silently handle health check errors - they're not critical
      // Health check is optional and shouldn't disrupt playback
      console.warn('Stream health check unavailable (non-critical):', error.message);
      
      if (!connectionManager.isOnline) {
        setStreamHealth({
          status: 'offline',
          reason: 'No internet connection'
        });
      } else {
        // If online but health check fails, assume streaming is fine
        setStreamHealth({
          status: 'online',
          reason: 'Health check unavailable, assuming operational'
        });
      }
    }
  };

  const handleConnectionRecovery = async () => {
    console.log('🔄 Attempting connection recovery...');
    
    try {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      const connectionCheck = await streamAPI.checkConnection();
      
      if (connectionCheck.connected) {
        await Promise.all([
          fetchCurrentTrack(),
          checkStreamHealth()
        ]);
        
        if (isPlaying && audioRef.current) {
          try {
            await audioRef.current.load();
            await audioRef.current.play();
          } catch (audioError) {
            console.warn('Could not restore audio playback:', audioError);
          }
        }
        
        setConnectionState(prev => ({
          ...prev,
          lastReconnect: new Date(),
          retryCount: 0
        }));
        
        toast({
          title: "🌐 Connection Restored",
          description: "All services are back online",
        });
        
        return true;
      }
    } catch (error) {
      console.error('Connection recovery failed:', error);
      
      const retryCount = connectionState.retryCount + 1;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      
      setConnectionState(prev => ({
        ...prev,
        retryCount: retryCount
      }));
      
      if (connectionState.autoRetry && retryCount < 5) {
        console.log(`Retrying connection in ${delay}ms (attempt ${retryCount}/5)`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          handleConnectionRecovery();
        }, delay);
      }
      
      return false;
    }
  };

  const handleAudioError = async (error) => {
    console.error('Audio playback error:', error);
    
    const audio = audioRef.current;
    if (!audio) return;
    
    const errorCode = audio.error?.code;
    
    if (errorCode === MediaError.MEDIA_ERR_NETWORK || 
        errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      
      if (currentStreamIndex < STREAM_URLS.length - 1) {
        console.log('Trying fallback stream...');
        setCurrentStreamIndex(prev => prev + 1);
        setStreamAttempts(0);
        
        setTimeout(() => {
          if (audio) {
            audio.load();
            if (isPlaying) {
              audio.play().catch(console.error);
            }
          }
        }, 1000);
        
        toast({
          title: "🔄 Switching to backup stream",
          description: "Primary stream unavailable, using fallback",
        });
        
        return;
      }
      
      toast({
        title: "📡 Stream Connection Issue",
        description: "Attempting to reconnect...",
        variant: "destructive",
      });
      
      handleConnectionRecovery();
    }
  };

  const testAudioConnection = () => {
    if (audioRef.current) {
      const audio = audioRef.current;
      console.log('Audio element state:', {
        src: audio.src,
        currentSrc: audio.currentSrc,
        readyState: audio.readyState,
        networkState: audio.networkState,
        error: audio.error,
        paused: audio.paused,
        ended: audio.ended
      });
      
      if (audio.readyState === 0 || audio.networkState === 3) {
        console.log('Reloading audio element...');
        audio.load();
      }
    }
  };

  // Initial load - always fetch on mount
  useEffect(() => {
    console.log('AudioPlayer mounted - fetching initial track info');
    fetchCurrentTrack();
    checkStreamHealth();
    setTimeout(testAudioConnection, 2000);
  }, []);

  // Base polling - always active (reduced frequency)
  useEffect(() => {
    // Adaptive polling based on device capabilities
    const trackPollInterval = isSlowDevice ? 15000 : 10000; // 15s for slow devices, 10s for normal
    const healthCheckInterval = isSlowDevice ? 90000 : 60000; // 90s for slow devices, 60s for normal
    
    const baseTrackInterval = setInterval(() => {
      fetchCurrentTrack();
    }, trackPollInterval);

    // Reduce health check frequency - it's not critical
    const healthInterval = setInterval(() => {
      checkStreamHealth();
    }, healthCheckInterval);

    const audioTestInterval = setInterval(testAudioConnection, 10000);

    return () => {
      clearInterval(baseTrackInterval);
      clearInterval(healthInterval);
      clearInterval(audioTestInterval);
    };
  }, [isSlowDevice]);

  // Enhanced polling when playing (smart frequency)
  useEffect(() => {
    if (isPlaying) {
      fetchCurrentTrack();
      console.log('Playback started - enabling enhanced track monitoring');
      
      const activePlayingInterval = setInterval(() => {
        fetchCurrentTrack();
      }, 5000); // Check every 5 seconds when playing (increased from 2)

      return () => {
        console.log('Playback stopped - returning to base polling');
        clearInterval(activePlayingInterval);
      };
    }
  }, [isPlaying]);

  // Connection monitoring
  useEffect(() => {
    const updateConnectionState = (status, isOnline) => {
      setConnectionState(prev => ({
        ...prev,
        isOnline: isOnline
      }));
    };

    connectionManager.addConnectionListener(updateConnectionState);
    
    streamCheckIntervalRef.current = setInterval(async () => {
      if (connectionManager.isOnline) {
        try {
          await streamAPI.checkConnection();
        } catch (error) {
          if (connectionState.autoRetry) {
            handleConnectionRecovery();
          }
        }
      }
    }, 45000);
    
    return () => {
      connectionManager.removeConnectionListener(updateConnectionState);
      if (streamCheckIntervalRef.current) {
        clearInterval(streamCheckIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectionState.autoRetry]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  const togglePlayPause = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // iOS: Ensure audio is loaded before playing
        try {
          // Load metadata if not loaded
          if (audioRef.current.readyState < 1) {
            console.log('iOS: Loading audio metadata...');
            audioRef.current.load();
            // Wait for metadata
            await new Promise((resolve) => {
              const onCanPlay = () => {
                audioRef.current.removeEventListener('canplay', onCanPlay);
                resolve();
              };
              audioRef.current.addEventListener('canplay', onCanPlay);
              setTimeout(resolve, 3000); // Timeout after 3s
            });
          }

          await audioRef.current.play();
          console.log('iOS: Playback started successfully');
          setTimeout(() => fetchCurrentTrack(), 500);
        } catch (error) {
          console.error('Audio play error:', error);
          
          if (error.name === 'NotAllowedError') {
            toast({
              title: "Permission Required",
              description: "Please tap the play button to enable audio playback.",
              variant: "destructive",
            });
          } else if (error.name === 'NotSupportedError') {
            toast({
              title: "Format Not Supported",
              description: "Your device doesn't support this audio format.",
              variant: "destructive",
            });
          } else {
            console.log('Reloading audio source due to play error...');
            audioRef.current.load();
            
            toast({
              title: "Connecting to Stream",
              description: "Attempting to connect to Greatest Hits Non-Stop...",
            });
            
            setTimeout(() => {
              if (audioRef.current) {
                audioRef.current.play().catch((retryError) => {
                  console.error('Retry play error:', retryError);
                  toast({
                    title: "Stream Unavailable",
                    description: "Unable to connect to the radio stream. Please try again later.",
                    variant: "destructive",
                  });
                });
              }
            }, 2000);
          }
        }
      }
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <DynamicBackground colors={colors} isPlaying={false} />
        <div className="relative z-10 text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent border-white/30 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading Greatest Hits Non-Stop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Dynamic Background */}
      <DynamicBackground colors={colors} isPlaying={isPlaying} />
      
      {/* Modern Grid Layout */}
      <div className="relative z-10 min-h-screen">
        {/* Top Navigation Bar - Black Chrome with Bevel and Orange Top Edge */}
        <nav 
          className="sticky top-0 z-50 border-b border-white/5" 
          style={{
            borderTop: '3px solid #ea580c',
            willChange: 'transform',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)'
          }}
        >
          <div 
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            style={{
              background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 10%, #0a0a0a 50%, #000000 90%, #0a0a0a 100%)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderBottom: '1px solid rgba(0,0,0,0.8)',
              borderRadius: '0 0 8px 8px',
              willChange: 'transform',
              WebkitBackfaceVisibility: 'hidden',
              backfaceVisibility: 'hidden'
            }}
          >
            <div className="flex items-center justify-between h-14 py-2">
              {/* Logo */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                <img 
                  src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png" 
                  alt="Greatest Hits Non-Stop" 
                  className="h-10 sm:h-14 w-auto"
                  style={{ 
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 8px rgba(255,255,255,0.3))',
                    willChange: 'transform',
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'translateZ(0)'
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h1 className="text-base sm:text-xl md:text-2xl font-black leading-tight" style={{ 
                    fontFamily: '"Russo One", sans-serif',
                    color: '#c0c0c0',
                    textShadow: '0 1px 2px rgba(255,255,255,0.3), 0 -1px 2px rgba(0,0,0,0.8)',
                    letterSpacing: '0.5px'
                  }}>GREATEST HITS NON-STOP</h1>
                  <ScrollingText 
                    text="LEGENDARY RADIO FROM SCOTLAND"
                    className="text-[10px] sm:text-xs md:text-sm font-bold"
                    speed={20}
                    pauseDuration={1000}
                    alwaysScroll={true}
                    direction="ltr"
                    align="left"
                  >
                    <span style={{ 
                      fontFamily: '"Russo One", sans-serif',
                      color: '#c0c0c0',
                      textShadow: '0 1px 2px rgba(255,255,255,0.2), 0 -1px 2px rgba(0,0,0,0.6)',
                      letterSpacing: '0.5px'
                    }}>LEGENDARY RADIO FROM SCOTLAND</span>
                  </ScrollingText>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center space-x-4">
                {streamHealth?.status === 'online' && (
                  <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs font-medium text-green-300">LIVE</span>
                  </div>
                )}
                
                {isCasting && (
                  <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30">
                    <Cast className="w-3 h-3 text-blue-300" />
                    <span className="text-xs font-medium text-blue-300">CASTING</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="space-y-6">
            
            {/* Main Player - Full Width */}
            <div className="space-y-6">
              
              {/* Classic Portable Player Design */}
              <Card 
                className="rounded-2xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 50%, #0a0a0a 100%)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 2px rgba(255,255,255,0.1)',
                  border: '2px solid #3a3a3a'
                }}
              >
                <CardContent className="p-4 md:p-6 lg:p-8">
                  
                  {/* Audio Element - iOS Compatible */}
                  <audio
                    ref={audioRef}
                    src={STREAM_URLS[currentStreamIndex]}
                    preload="metadata"
                    playsInline
                    webkit-playsinline="true"
                    onPlay={() => {
                      console.log('Audio playing');
                      setIsPlaying(true);
                    }}
                    onPause={() => {
                      console.log('Audio paused');
                      setIsPlaying(false);
                    }}
                    onError={(e) => {
                      console.error('Audio error:', e.target.error);
                      if (!isCasting) {
                        handleAudioError(e.target.error);
                      }
                    }}
                    onStalled={() => {
                      console.warn('Audio stream stalled');
                      if (!isCasting && connectionState.autoRetry) {
                        setTimeout(() => handleConnectionRecovery(), 3000);
                      }
                    }}
                    onTimeUpdate={() => {
                      if (isCasting && audioRef.current && !audioRef.current.paused) {
                        audioRef.current.pause();
                      }
                    }}
                    onLoadedMetadata={() => {
                      console.log('iOS: Audio metadata loaded');
                    }}
                    onCanPlay={() => {
                      console.log('iOS: Audio can play');
                    }}
                    crossOrigin="anonymous"
                  />

                  {/* Two Column Desktop Layout with Mobile Reordering */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-stretch gap-6 lg:gap-0">
                    
                    {/* LCD Display - Order 1 on mobile (appears first), hidden on desktop */}
                    <div className="w-full lg:hidden flex justify-center order-1">
                      <div className="w-full max-w-md px-4 mb-4">
                        <LCDDisplay 
                          title={currentTrack?.title}
                          artist={currentTrack?.artist}
                          album={currentTrack?.album}
                          isPlaying={isPlaying}
                        />
                      </div>
                    </div>
                    
                    {/* Album Artwork - Order 2 on mobile (below LCD), LEFT column on desktop (50%) */}
                    <div className="w-full lg:w-[50%] flex justify-center lg:justify-start order-2 lg:order-1">
                      <div className="relative w-full max-w-md lg:max-w-2xl px-4 lg:pl-0 lg:pr-0">
                        {/* Screen bezel/frame */}
                        <div 
                          className="relative rounded-xl overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                            padding: '16px',
                            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8), 0 10px 40px rgba(0,0,0,0.6)',
                            border: '3px solid #2a2a2a'
                          }}
                        >
                          {/* Screen glass effect */}
                          <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'linear-gradient(165deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
                            zIndex: 10
                          }} />
                          
                          {/* Scanline effect for screen */}
                          <div className="absolute inset-0 pointer-events-none" style={{
                            backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.03) 2px, transparent 3px)',
                            zIndex: 9
                          }} />
                          
                          {/* Screen vignette */}
                          <div className="absolute inset-0 pointer-events-none rounded-lg" style={{
                            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4), inset 0 0 100px rgba(0,0,0,0.2)',
                            zIndex: 8
                          }} />
                          
                          {/* Actual display area */}
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900 transition-all duration-700" style={{
                            border: '2px solid #000',
                            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
                            filter: isPlaying ? 'none' : 'grayscale(100%) brightness(0.4)',
                            opacity: isPlaying ? 1 : 0.6
                          }}>
                          {(currentTrack?.title === "Greatest Hits Non-Stop" || 
                            currentTrack?.title === "Legendary Radio from Scotland" ||
                            currentTrack?.title === "Legendary Radio from Scotland - Greatest Hits Non-Stop") ? (
                            <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-copper-900/20 to-copper-800/20">
                              <img 
                                src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png"
                                alt="Greatest Hits Non-Stop Logo"
                                className="w-full h-auto drop-shadow-2xl"
                              />
                            </div>
                          ) : currentTrack?.artwork_url && 
                             currentTrack.artwork_url !== 'vinyl-fallback-placeholder' && 
                             !currentTrack.artwork_url.includes('unsplash.com') ? (
                            <OptimizedImage
                              key={currentTrack.artwork_url}
                              src={currentTrack.artwork_url}
                              alt={`${currentTrack.artist} - ${currentTrack.title}`}
                              className="w-full h-full object-cover transform transition-transform duration-500"
                              priority={true}
                              fallbackSrc="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png"
                              crossOrigin="anonymous"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-slate-800 to-slate-900">
                              <img 
                                src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png"
                                alt="Greatest Hits Non-Stop"
                                className="w-full h-auto drop-shadow-2xl"
                              />
                            </div>
                          )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT Column - LCD Display + All Controls (50%) - Order 3 on mobile */}
                    <div className="w-full lg:w-[50%] flex flex-col items-center lg:items-start gap-4 lg:gap-6 order-3 lg:order-2 lg:justify-center">
                      
                      {/* LCD Display Section - Only visible on desktop */}
                      <div className="hidden lg:block w-full max-w-full px-4 lg:px-6 lg:mb-2">
                        <LCDDisplay 
                          title={currentTrack?.title}
                          artist={currentTrack?.artist}
                          album={currentTrack?.album}
                          isPlaying={isPlaying}
                        />
                      </div>
                      
                      {/* Quick Actions - Center justified on all screen sizes */}
                      <div className="flex flex-wrap justify-center gap-2 w-full max-w-md lg:max-w-full px-4 lg:px-6 lg:mb-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSleepTimer(!showSleepTimer)}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1.5"
                        >
                          <Clock className="w-3.5 h-3.5 mr-1.5" />
                          Sleep Timer
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowLyrics(!showLyrics);
                            setActiveView(showLyrics ? 'player' : 'lyrics');
                          }}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1.5"
                        >
                          <Music className="w-3.5 h-3.5 mr-1.5" />
                          Lyrics
                        </Button>

                        <CastButton
                          isCastAvailable={isCastAvailable}
                          isCasting={isCasting}
                          onStartCasting={startCasting}
                          onStopCasting={stopCasting}
                          carMode={false}
                        />
                      </div>
                      
                      {/* Level Meters */}
                      <div className="w-full max-w-md lg:max-w-2xl px-4 lg:my-1">
                        <SafariVisualiser 
                          audioRef={audioRef}
                          isPlaying={isPlaying}
                          colors={colors}
                        />
                      </div>

                      {/* Play/Pause Button */}
                      <div className="w-full max-w-md lg:max-w-2xl px-4 lg:my-2">
                        <div className="flex justify-center lg:justify-start">
                          <Button
                            onClick={togglePlayPause}
                            className={`px-12 py-6 md:px-16 md:py-8 rounded-xl shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300 ${
                              !isPlaying ? 'animate-shimmer' : ''
                            }`}
                            style={{
                              background: !isPlaying 
                                ? `linear-gradient(90deg, #1a1a1a 0%, #0a0a0a 25%, rgba(255,255,255,0.15) 50%, #0a0a0a 75%, #1a1a1a 100%)`
                                : `linear-gradient(135deg, #1a1a1a, #0a0a0a)`,
                              border: `3px solid #ea580c`,
                              boxShadow: !isPlaying 
                                ? `0 0 30px #ea580c40, 0 0 60px #ea580c20, inset 0 0 20px #ea580c30` 
                                : '0 20px 40px rgba(0,0,0,0.3)'
                            }}
                          >
                            {isPlaying ? (
                              <Pause className="w-10 h-10 md:w-12 md:h-12" />
                            ) : (
                              <Play className="w-10 h-10 md:w-12 md:h-12 ml-1" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Volume Control */}
                      <div className="w-full max-w-md lg:max-w-2xl px-4">
                        <div className="flex items-center space-x-4">
                          <Volume2 className="w-5 h-5 text-white/70 flex-shrink-0" />
                          <Slider
                            value={volume}
                            onValueChange={handleVolumeChange}
                            max={100}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium text-white/70 w-12 text-right">{volume[0]}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* Sleep Timer */}
              {showSleepTimer && (
                <SleepTimer 
                  audioRef={audioRef}
                  onClose={() => setShowSleepTimer(false)}
                  carMode={false}
                />
              )}

            </div>

            {/* Recently Played / Lyrics - Below Player (Toggle) */}
            <div>
              <Suspense fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              }>
                {showLyrics ? (
                  <LyricsDisplay 
                    currentTrack={currentTrack}
                    carMode={false}
                    colors={colors}
                    onClose={() => setShowLyrics(false)}
                  />
                ) : (
                  <RecentTracks carMode={false} />
                )}
              </Suspense>
            </div>

            {/* Stream Recorder - Lazy loaded, moved up slightly */}
            <div className="-mt-4">
              <Suspense fallback={<div className="h-16"></div>}>
                <StreamRecorder 
                  audioRef={audioRef} 
                  isPlaying={isPlaying}
                />
              </Suspense>
            </div>

            {/* Additional Content - Lazy loaded */}
            <div className="space-y-6">
              <Suspense fallback={<div className="h-32"></div>}>
                <TShirtShop isCarMode={false} />
              </Suspense>
              
              <div className="flex justify-center">
                <a
                  href="https://form.formcan.com/fr0qfmevezx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-transform duration-300 hover:scale-105"
                >
                  <img
                    src="https://customer-assets.emergentagent.com/job_ghns-project/artifacts/8xs272e6_logo.png"
                    alt="Contact Form"
                    className="w-full max-w-md h-auto rounded-2xl shadow-lg border-2 border-white/20"
                    loading="lazy"
                  />
                </a>
              </div>

              {/* Bottom Info Card with Logo */}
              <Card className="premium-container rounded-2xl shadow-xl">
                <CardContent className="p-8 text-center">
                  <img 
                    src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png" 
                    alt="Greatest Hits Non-Stop" 
                    className="w-32 h-auto mx-auto mb-4 drop-shadow-2xl"
                  />
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Greatest Hits Non-Stop
                  </h3>
                  <p className="text-lg font-medium mb-4" style={{ color: '#ea580c' }}>
                    Legendary Radio from Scotland
                  </p>
                  {lastUpdate && (
                    <p className="text-xs" style={{ color: '#ea580c', opacity: 0.6 }}>
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Install Button */}
      <InstallButton />

      {/* Connection Status Monitor */}
      <ConnectionStatus onReconnect={handleConnectionRecovery} />
    </div>
  );
};

export default ModernAudioPlayer;
