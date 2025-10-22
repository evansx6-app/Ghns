import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Clock, Maximize2, Music } from 'lucide-react';
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
import RecentTracks from './RecentTracks';
import MusicVisualizer from './MusicVisualizer';
import DynamicBackground from './DynamicBackground';
import LyricsDisplay from './LyricsDisplay';
import StreamRecorder from './StreamRecorder';
import InstallButton from './InstallButton';
import ConnectionStatus from './ConnectionStatus';
import TShirtShop from './TShirtShop';

const AudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([70]);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamHealth, setStreamHealth] = useState(null);
  const [isCarMode, setIsCarMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const audioRef = useRef(null);
  const shownToastsRef = useRef(new Set()); // Track which tracks have already shown toasts
  const { toast } = useToast();

  // Extract colors from album artwork
  const { colors, isExtracting } = useColorExtraction(currentTrack?.artwork_url);
  
  // Beat detection for logo animation
  const beatData = useBeatDetection(audioRef, isPlaying);

  // Stream URLs with fallback (Greatest Hits Non-Stop with backup)
  const STREAM_URLS = [
    "https://s8.myradiostream.com/58238/listen.mp3", // Primary Greatest Hits Non-Stop
    "https://icecast.omroep.nl/radio1-bb-mp3"  // Working fallback stream
  ];
  
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const [streamAttempts, setStreamAttempts] = useState(0);
  const [connectionState, setConnectionState] = useState({
    isOnline: navigator.onLine,
    lastReconnect: null,
    autoRetry: true,
    retryCount: 0
  });
  
  // Connection retry timer refs
  const reconnectTimeoutRef = useRef(null);
  const streamCheckIntervalRef = useRef(null);
  const STREAM_URL = STREAM_URLS[currentStreamIndex];

  // Enable Media Session API for car integration
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
      
      // Enhanced track change detection
      const isNewTrack = !currentTrack || 
        currentTrack.title !== track.title || 
        currentTrack.artist !== track.artist ||
        currentTrack.album !== track.album;
      
      // Also check if timestamp indicates a newer track
      const isNewerTrack = currentTrack && track.timestamp && 
        new Date(track.timestamp) > new Date(currentTrack.timestamp);
      
      const hasActualChange = isNewTrack || isNewerTrack;
      
      setCurrentTrack(track);
      setLastUpdate(new Date());
      
      // Show toast only once per unique track
      if (showToast || (hasActualChange && currentTrack && !showToast)) {
        const trackId = `${track.title}-${track.artist}`;
        const hasAlreadyShownToast = shownToastsRef.current.has(trackId);
        
        // Only show toast if:
        // 1. Manual refresh (showToast = true), OR
        // 2. New track that has never shown a toast before
        const shouldShowToast = showToast || (hasActualChange && !hasAlreadyShownToast);
        
        if (shouldShowToast) {
          const message = showToast ? "Track information refreshed" : 
            `♪ ${track.title} - ${track.artist}`;
          
          toast({
            title: showToast ? "Refreshed" : "Now Playing:",
            description: message,
          });
          
          // Mark this track as having shown a toast (only for new tracks, not manual refreshes)
          if (!showToast) {
            shownToastsRef.current.add(trackId);
          }
          
          // Log track changes for debugging
          console.log(`Track changed: ${track.title} by ${track.artist}`);
        } else if (hasActualChange && hasAlreadyShownToast) {
          // Log track changes without showing toast
          console.log(`Track changed (no toast - already shown): ${track.title} by ${track.artist}`);
        }
      }
    } catch (error) {
      console.error('Error fetching current track:', error);
      toast({
        title: "Connection Error",
        description: "Unable to fetch current track information",
        variant: "destructive",
      });
      // Set fallback track data
      setCurrentTrack({
        title: "Greatest Hits Non-Stop",
        artist: "Live Radio Stream", 
        album: "Legendary Radio from Scotland",
        isLive: true,
        streamUrl: STREAM_URL,
        artwork_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=500&fit=crop&crop=center"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced stream health check with connection awareness
  const checkStreamHealth = async () => {
    try {
      const health = await streamAPI.getStreamHealth();
      setStreamHealth(health);
      
      // Reset retry count on successful check
      setConnectionState(prev => ({ ...prev, retryCount: 0 }));
    } catch (error) {
      console.error('Error checking stream health:', error);
      
      // Handle connection issues
      if (!connectionManager.isOnline) {
        setStreamHealth({
          status: 'offline',
          reason: 'No internet connection'
        });
      }
    }
  };

  // Connection recovery handler
  const handleConnectionRecovery = async () => {
    console.log('🔄 Attempting connection recovery...');
    
    try {
      // Clear any existing timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Check if we can reach the API
      const connectionCheck = await streamAPI.checkConnection();
      
      if (connectionCheck.connected) {
        // Refresh all data
        await Promise.all([
          fetchCurrentTrack(),
          checkStreamHealth()
        ]);
        
        // If audio was playing, try to restore playback
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
      
      // Exponential backoff for retries
      const retryCount = connectionState.retryCount + 1;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
      
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

  // Enhanced audio error handling with recovery
  const handleAudioError = async (error) => {
    console.error('Audio playback error:', error);
    
    const audio = audioRef.current;
    if (!audio) return;
    
    const errorCode = audio.error?.code;
    
    // Network-related errors
    if (errorCode === MediaError.MEDIA_ERR_NETWORK || 
        errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      
      // Try fallback stream
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
      
      // All streams failed, trigger connection recovery
      toast({
        title: "📡 Stream Connection Issue",
        description: "Attempting to reconnect...",
        variant: "destructive",
      });
      
      handleConnectionRecovery();
    }
  };

  // Manual refresh function removed

  // Test audio connectivity
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
      
      // Force reload if needed
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
    
    // Test audio connection on mount
    setTimeout(testAudioConnection, 2000);
  }, []); // Run once on mount

  // Periodic updates - always run regardless of play state
  useEffect(() => {
    // Base interval for track updates - always active
    const baseTrackInterval = setInterval(() => {
      fetchCurrentTrack();
    }, 5000); // Every 5 seconds as baseline

    // Check stream health every 30 seconds
    const healthInterval = setInterval(() => {
      checkStreamHealth();
    }, 30000);

    // Test audio connection periodically
    const audioTestInterval = setInterval(testAudioConnection, 10000);

    return () => {
      clearInterval(baseTrackInterval);
      clearInterval(healthInterval);
      clearInterval(audioTestInterval);
    };
  }, []); // Run once and keep running

  // Additional aggressive polling when playing
  useEffect(() => {
    if (isPlaying) {
      // Immediately fetch track info when playback starts
      fetchCurrentTrack();
      
      console.log('Playback started - enabling aggressive track polling');
      
      // Set up even more frequent updates during playback for song transitions
      const activePlayingInterval = setInterval(() => {
        fetchCurrentTrack();
      }, 2000); // Every 2 seconds during active playback

      return () => {
        console.log('Playback stopped - disabling aggressive polling');
        clearInterval(activePlayingInterval);
      };
    }
  }, [isPlaying]);

  // Connection monitoring and recovery
  useEffect(() => {
    // Update connection state from connectionManager
    const updateConnectionState = (status, isOnline) => {
      setConnectionState(prev => ({
        ...prev,
        isOnline: isOnline
      }));
    };

    // Add listener
    connectionManager.addConnectionListener(updateConnectionState);
    
    // Set up periodic connection health checks
    streamCheckIntervalRef.current = setInterval(async () => {
      if (connectionManager.isOnline) {
        try {
          await streamAPI.checkConnection();
        } catch (error) {
          // If we're supposedly online but API calls fail, trigger recovery
          if (connectionState.autoRetry) {
            handleConnectionRecovery();
          }
        }
      }
    }, 45000); // Check every 45 seconds
    
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

  // Listen for audio events that might indicate track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // Check for track info every few seconds during playback
      if (isPlaying && Math.floor(audio.currentTime) % 3 === 0) {
        fetchCurrentTrack();
      }
    };

    const handleLoadStart = () => {
      // New stream data might mean track change
      if (isPlaying) {
        setTimeout(() => fetchCurrentTrack(), 1000);
      }
    };

    const handleCanPlay = () => {
      // Audio is ready, good time to check track info
      fetchCurrentTrack();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [isPlaying]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((error) => {
          console.error('Audio play error:', error);
          
          // If it's a network error, try reloading the stream
          if (error.name === 'NotAllowedError') {
            toast({
              title: "Permission Required",
              description: "Please interact with the page first to enable audio playback.",
              variant: "destructive",
            });
          } else {
            // Try reloading the audio source
            console.log('Reloading audio source due to play error...');
            audioRef.current.load();
            
            toast({
              title: "Connecting to Stream",
              description: "Attempting to connect to Greatest Hits Non-Stop...",
            });
            
            // Try playing again after reload
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
        });
        // Immediately check for current track when resuming playback
        setTimeout(() => fetchCurrentTrack(), 500);
      }
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <DynamicBackground colors={colors} isPlaying={false} />
        <div className="relative z-10 text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading stream information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-hidden ${isCarMode ? 'car-mode' : ''}`}>
      {/* Dynamic Background based on album art */}
      <DynamicBackground colors={colors} isPlaying={isPlaying} />
      
      <div className={`relative z-10 w-full h-full px-3 sm:px-4 md:px-8 lg:px-12 xl:px-16 ${isCarMode ? 'py-4 sm:py-6' : 'py-6 sm:py-8 md:py-12 lg:py-16'}`}>
        {/* Header with Foreground Visualizer */}
        <div className={`flex flex-col items-center ${isCarMode ? 'mb-2' : 'mb-3 sm:mb-4 md:mb-6'} relative`}>
          {/* Logo with Burst Effects */}
          <div className="relative mb-4 sm:mb-6 md:mb-8 z-0">
            {/* Random Visualizer Bursts - Behind Logo */}
            {[...Array(6)].map((_, i) => {
              const burstPositions = [
                { top: '10%', left: '15%', rotate: 45 },
                { top: '20%', right: '10%', rotate: -30 },
                { bottom: '25%', left: '20%', rotate: 60 },
                { bottom: '15%', right: '15%', rotate: -45 },
                { top: '50%', left: '5%', rotate: 90 },
                { top: '40%', right: '8%', rotate: -60 }
              ];
              const position = burstPositions[i];
              const intensity = beatData.intensity || 0;
              const shouldShow = beatData.isBeat && Math.random() > 0.4; // 60% chance on beat
              
              return (
                <div
                  key={i}
                  className={`absolute w-12 h-12 ${isCarMode ? 'w-16 h-16' : 'w-12 h-12'} z-5 pointer-events-none transition-all duration-150`}
                  style={{
                    ...position,
                    transform: `rotate(${position.rotate}deg) scale(${shouldShow ? 1.2 + intensity * 0.8 : 0})`,
                    opacity: shouldShow ? 0.7 + intensity * 0.3 : 0,
                  }}
                >
                  <MusicVisualizer 
                    audioRef={audioRef}
                    isPlaying={isPlaying}
                    carMode={false}
                    colors={colors}
                    backgroundMode={false}
                    burstMode={true}
                  />
                </div>
              );
            })}

            {/* Main Logo */}
            <img 
              src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png" 
              alt="Greatest Hits Non-Stop" 
              className={`${isCarMode ? 'h-28 sm:h-32 md:h-36' : 'h-32 sm:h-40 md:h-48 lg:h-56'} w-auto drop-shadow-2xl hover:scale-110 relative z-10 transition-transform duration-300`}
              style={{
                transform: beatData.isBeat 
                  ? `scale(${1.1 + beatData.intensity * 0.2}) rotate(${beatData.intensity * 2}deg)` 
                  : 'scale(1) rotate(0deg)',
                filter: beatData.isBeat 
                  ? `brightness(${1.2 + beatData.intensity * 0.3}) saturate(${1.1 + beatData.intensity * 0.2})`
                  : 'brightness(1) saturate(1)',
                transition: beatData.isBeat 
                  ? 'transform 0.1s ease-out, filter 0.1s ease-out'
                  : 'transform 0.3s ease-out, filter 0.3s ease-out'
              }}
            />

            {/* Visualizer Bursts - Over Logo */}
            {[...Array(4)].map((_, i) => {
              const overlapPositions = [
                { top: '30%', left: '25%', rotate: 15 },
                { top: '35%', right: '25%', rotate: -15 },
                { bottom: '40%', left: '30%', rotate: 75 },
                { bottom: '35%', right: '30%', rotate: -75 }
              ];
              const position = overlapPositions[i];
              const intensity = beatData.intensity || 0;
              const shouldShow = beatData.isBeat && Math.random() > 0.6; // 40% chance for overlay bursts
              
              return (
                <div
                  key={`overlay-${i}`}
                  className={`absolute w-8 h-8 ${isCarMode ? 'w-12 h-12' : 'w-8 h-8'} z-15 pointer-events-none transition-all duration-100`}
                  style={{
                    ...position,
                    transform: `rotate(${position.rotate}deg) scale(${shouldShow ? 1.4 + intensity * 1.2 : 0})`,
                    opacity: shouldShow ? 0.6 + intensity * 0.4 : 0,
                    mixBlendMode: 'screen'
                  }}
                >
                  <MusicVisualizer 
                    audioRef={audioRef}
                    isPlaying={isPlaying}
                    carMode={false}
                    colors={colors}
                    backgroundMode={false}
                    burstMode={true}
                  />
                </div>
              );
            })}

            {/* Dynamic glow effect with beat response */}
            <div 
              className="absolute inset-0 blur-2xl rounded-full -z-10 transition-all duration-100"
              style={{
                background: `linear-gradient(45deg, ${colors.primary}40, ${colors.secondary}40)`,
                transform: beatData.isBeat ? `scale(${1.3 + beatData.intensity * 0.4})` : 'scale(1)',
                opacity: beatData.isBeat ? 0.8 + beatData.intensity * 0.2 : 0.4
              }}
            />
            <div 
              className="absolute inset-0 blur-xl rounded-full -z-20 transition-all duration-100"
              style={{
                background: `linear-gradient(-45deg, ${colors.secondary}30, ${colors.accent}30)`,
                transform: beatData.isBeat ? `scale(${1.5 + beatData.intensity * 0.3})` : 'scale(1.2)',
                opacity: beatData.isBeat ? 0.6 + beatData.intensity * 0.3 : 0.3
              }}
            />
          </div>

          {/* Foreground Music Visualizer - Fully covering Logo */}
          <div className={`absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-12 sm:-translate-y-14 md:-translate-y-16 ${isCarMode ? 'w-72 h-56 sm:w-80 sm:h-64 md:w-96 md:h-72' : 'w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80'} overflow-hidden z-20 pointer-events-none`}>
            <MusicVisualizer 
              audioRef={audioRef}
              isPlaying={isPlaying}
              carMode={isCarMode}
              colors={colors}
              backgroundMode={true}
            />
          </div>
          
          {/* Car Mode Toggle - Positioned in top right */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCarMode(!isCarMode)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white/70 hover:text-white hover:bg-white/10 z-20 min-w-[44px] min-h-[44px] touch-manipulation"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Player Card */}
        <Card className={`${isCarMode ? 'max-w-full' : 'max-w-full sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl'} mx-auto bg-gradient-to-b from-white/15 via-white/10 to-white/5 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-2xl sm:rounded-3xl`}>
          <CardContent className={`${isCarMode ? 'p-6 sm:p-8 md:p-12' : 'p-6 sm:p-8 md:p-10 lg:p-12 xl:p-16'} relative overflow-hidden`}>
            {/* Track Info */}
            <TrackInfo track={currentTrack} />

            {/* Audio Element */}
            <audio
              ref={audioRef}
              src={STREAM_URLS[currentStreamIndex]}
              preload="auto"
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
                console.error('Network state:', e.target.networkState);
                console.error('Ready state:', e.target.readyState);
                
                // Log the specific error for debugging
                if (e.target.error) {
                  console.error('Error code:', e.target.error.code);
                  console.error('Error message:', e.target.error.message);
                }
                
                // Only handle error if not casting (Cast handles its own errors)
                if (!isCasting) {
                  handleAudioError(e.target.error);
                }
              }}
              onAbort={() => {
                console.log('Audio loading aborted');
              }}
              onStalled={() => {
                console.warn('Audio stream stalled');
                // Don't auto-recover during casting
                if (!isCasting && connectionState.autoRetry) {
                  setTimeout(() => handleConnectionRecovery(), 3000);
                }
              }}
              onSuspend={() => {
                console.log('Audio loading suspended');
              }}
              onWaiting={() => {
                console.log('Audio waiting for data (buffering)...');
              }}
              onLoadStart={() => {
                console.log(`Loading stream: ${STREAM_URL}`);
              }}
              onCanPlay={() => {
                console.log(`Stream ready: ${STREAM_URL}`);
                // Only show toast on first load, not during casting
                if (!isCasting && currentStreamIndex === 0) {
                  const streamName = currentStreamIndex === 0 ? "Greatest Hits Non-Stop" : "Backup Stream";
                  toast({
                    title: "Stream Ready",
                    description: `${streamName} is ready to play`,
                  });
                }
              }}
              onLoadedData={() => {
                console.log('Audio data loaded successfully');
              }}
              onProgress={() => {
                // Track buffering progress
                if (audioRef.current && audioRef.current.buffered.length > 0) {
                  const buffered = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
                  const duration = audioRef.current.duration;
                  if (duration > 0) {
                    const bufferPercent = (buffered / duration) * 100;
                    // Only log significant buffer changes
                    if (bufferPercent < 50 && isPlaying && !isCasting) {
                      console.log(`Buffer: ${bufferPercent.toFixed(1)}%`);
                    }
                  }
                }
              }}
              onTimeUpdate={() => {
                // Prevent audio element issues during casting
                if (isCasting && audioRef.current && !audioRef.current.paused) {
                  // Pause local audio when casting
                  audioRef.current.pause();
                }
              }}
              crossOrigin="anonymous"
            />

            {/* Controls */}
            <div className={`space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-8 ${isCarMode ? 'mt-8 sm:mt-10 md:mt-12' : 'mt-6 sm:mt-7 md:mt-8 lg:mt-10'}`}>
              {/* Play/Pause Button */}
              <div className="flex justify-center">
                <Button
                  onClick={togglePlayPause}
                  size="lg"
                  className={`${isCarMode ? 'h-20 w-20 sm:h-22 sm:w-22 md:h-24 md:w-24' : 'h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 xl:h-28 xl:w-28'} rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg touch-manipulation`}
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                  }}
                >
                  {isPlaying ? (
                    <Pause className={`${isCarMode ? 'h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12' : 'h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 xl:h-14 xl:w-14'}`} />
                  ) : (
                    <Play className={`${isCarMode ? 'h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 ml-1' : 'h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 xl:h-14 xl:w-14 ml-1'}`} />
                  )}
                </Button>
              </div>

              {/* Volume Control */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 max-w-2xl mx-auto">
                  <Volume2 className={`${isCarMode ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6'} text-white/70 flex-shrink-0`} />
                  <Slider
                    value={volume}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                    className={`flex-1 ${isCarMode ? 'h-6 sm:h-8' : 'md:h-3 lg:h-4'}`}
                  />
                  <span className={`${isCarMode ? 'text-base sm:text-lg' : 'text-xs sm:text-sm md:text-base lg:text-lg'} text-white/70 w-6 sm:w-8 md:w-10 text-right`}>{volume[0]}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 flex-wrap">
                <Button
                  variant="outline"
                  size={isCarMode ? "lg" : "default"}
                  onClick={() => setShowSleepTimer(!showSleepTimer)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-300 touch-manipulation min-h-[44px] text-xs sm:text-sm md:text-base lg:text-lg md:px-6 lg:px-8"
                >
                  <Clock className={`${isCarMode ? 'h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3' : 'h-4 w-4 mr-1.5 sm:mr-2 md:h-5 md:w-5 md:mr-3 lg:h-6 lg:w-6'}`} />
                  <span className={isCarMode ? 'text-base sm:text-lg' : ''}>Sleep Timer</span>
                </Button>
                
                <Button
                  variant="outline"
                  size={isCarMode ? "lg" : "default"}
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={`bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-300 touch-manipulation min-h-[44px] text-xs sm:text-sm md:text-base lg:text-lg md:px-6 lg:px-8 ${showLyrics ? 'ring-2 ring-white/30' : ''}`}
                >
                  <Music className={`${isCarMode ? 'h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3' : 'h-4 w-4 mr-1.5 sm:mr-2 md:h-5 md:w-5 md:mr-3 lg:h-6 lg:w-6'}`} />
                  <span className={isCarMode ? 'text-base sm:text-lg' : ''}>Lyrics</span>
                </Button>
                
                {/* Cast Button */}
                <CastButton
                  isCastAvailable={isCastAvailable}
                  isCasting={isCasting}
                  onStartCasting={startCasting}
                  onStopCasting={stopCasting}
                  carMode={isCarMode}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sleep Timer */}
        {showSleepTimer && (
          <div className={`${isCarMode ? 'max-w-full' : 'max-w-full sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl'} mx-auto mt-4 sm:mt-5 md:mt-6 lg:mt-8`}>
            <SleepTimer 
              audioRef={audioRef}
              onClose={() => setShowSleepTimer(false)}
              carMode={isCarMode}
            />
          </div>
        )}

        {/* Equalizer removed */}

        {/* Recently Played Tracks / Lyrics Display */}
        <div className={`${isCarMode ? 'max-w-full' : 'max-w-full sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl'} mx-auto mt-4 sm:mt-5 md:mt-6 lg:mt-8`}>
          {showLyrics ? (
            <LyricsDisplay 
              currentTrack={currentTrack}
              carMode={isCarMode}
              colors={colors}
              onClose={() => setShowLyrics(false)}
            />
          ) : (
            <RecentTracks carMode={isCarMode} />
          )}
        </div>

        {/* Stream Recorder */}
        <div className={`${isCarMode ? 'max-w-full' : 'max-w-full sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl'} mx-auto mt-4 sm:mt-5 md:mt-6 lg:mt-8`}>
          <StreamRecorder 
            audioRef={audioRef} 
            isPlaying={isPlaying}
          />
        </div>

        {/* T-Shirt Shop Logo - Memoized Component */}
        <TShirtShop isCarMode={isCarMode} />

        {/* Contact Form Link Image */}
        <div className={`${isCarMode ? 'max-w-full' : 'max-w-full sm:max-w-md md:max-w-2xl lg:max-w-3xl'} mx-auto mt-4 sm:mt-5 md:mt-6 lg:mt-8 flex justify-center px-4`}>
          <a
            href="https://form.formcan.com/fr0qfmevezx"
            target="_blank"
            rel="noopener noreferrer"
            className="block transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/20 rounded-2xl"
            aria-label="Open contact form"
          >
            <img
              src="https://customer-assets.emergentagent.com/job_ghns-project/artifacts/8xs272e6_logo.png"
              alt="Contact Form"
              className="w-full max-w-xs sm:max-w-sm h-auto rounded-xl sm:rounded-2xl shadow-lg border-2 border-white/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300"
              style={{
                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
              }}
              loading="lazy"
            />
          </a>
        </div>

        {/* Live Indicator - Only show when online or casting */}
        {(streamHealth?.status === 'online' || isCasting) && (
          <div className="flex justify-center mt-4 sm:mt-5 md:mt-6">
            <div 
              className="flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border backdrop-blur-sm transition-all duration-1000 text-xs sm:text-sm"
              style={{
                backgroundColor: `${colors.primary}30`,
                borderColor: `${colors.primary}50`
              }}
            >
              {streamHealth?.status === 'online' && (
                <>
                  <div 
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <span 
                    className="text-xs sm:text-sm font-medium"
                    style={{ color: colors.primary }}
                  >
                    LIVE
                  </span>
                </>
              )}
              {isCasting && (
                <>
                  {streamHealth?.status === 'online' && <span className="text-white/50">•</span>}
                  <span className="text-blue-300 text-xs sm:text-sm font-medium">CASTING</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stream Info */}
        <div className="text-center mt-3 sm:mt-4 px-4">
          <p className={`text-white/50 ${isCarMode ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
            Last updated: {lastUpdate ? 
              lastUpdate.toLocaleTimeString() : 'Never'
            }
            {lastUpdate && (
              <span 
                className="ml-2 inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse"
                style={{ backgroundColor: colors.primary }}
              />
            )}
          </p>
        </div>
      </div>

      {/* Floating Install Button */}
      <InstallButton />

      {/* Connection Status Monitor */}
      <ConnectionStatus onReconnect={handleConnectionRecovery} />
    </div>
  );
};

export default AudioPlayer;