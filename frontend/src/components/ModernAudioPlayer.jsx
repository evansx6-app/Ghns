import React, { useState, useRef, useEffect } from 'react';
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
import RecentTracks from './RecentTracks';
import SimpleEqualizer from './SimpleEqualizer';
import DynamicBackground from './DynamicBackground';
import LyricsDisplay from './LyricsDisplay';
import StreamRecorder from './StreamRecorder';
import InstallButton from './InstallButton';
import ConnectionStatus from './ConnectionStatus';
import TShirtShop from './TShirtShop';
import ScrollingText from './ScrollingText';

const ModernAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([70]);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamHealth, setStreamHealth] = useState(null);
  const [isCarMode, setIsCarMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeView, setActiveView] = useState('player'); // player, recent, lyrics
  const audioRef = useRef(null);
  const shownToastsRef = useRef(new Set());
  const { toast } = useToast();

  // Determine artwork URL - use logo for station ID
  const logoUrl = 'https://customer-assets.emergentagent.com/job_ghns-project/artifacts/5tmxnbvh_unnamed.png';
  const isStationID = currentTrack?.title === "Greatest Hits Non-Stop";
  const isFallbackTrack = currentTrack?.title === "Legendary Radio from Scotland";
  const artworkForColorExtraction = isStationID ? logoUrl : (!isFallbackTrack ? currentTrack?.artwork_url : null);
  
  // Extract colors from album artwork
  const { colors, isExtracting } = useColorExtraction(artworkForColorExtraction);
  
  // Beat detection for animations
  const beatData = useBeatDetection(audioRef, isPlaying);

  // Stream URLs with fallback
  const STREAM_URLS = [
    "https://s8.myradiostream.com/58238/listen.mp3",
    "https://icecast.omroep.nl/radio1-bb-mp3"
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
      // Preload artwork for faster display
      const track = await streamAPI.getCurrentTrack();
      
      // Preload the image for faster rendering
      if (track?.artwork_url) {
        const img = new Image();
        img.src = track.artwork_url;
      }
      
      const isNewTrack = !currentTrack || 
        currentTrack.title !== track.title || 
        currentTrack.artist !== track.artist ||
        currentTrack.album !== track.album;
      
      const isNewerTrack = currentTrack && track.timestamp && 
        new Date(track.timestamp) > new Date(currentTrack.timestamp);
      
      const hasActualChange = isNewTrack || isNewerTrack;
      
      setCurrentTrack(track);
      setLastUpdate(new Date());
      
      if (showToast || (hasActualChange && currentTrack && !showToast)) {
        const trackId = `${track.title}-${track.artist}`;
        const hasAlreadyShownToast = shownToastsRef.current.has(trackId);
        
        const shouldShowToast = showToast || (hasActualChange && !hasAlreadyShownToast);
        
        if (shouldShowToast) {
          const message = showToast ? "Track information refreshed" : 
            `♪ ${track.title} - ${track.artist}`;
          
          toast({
            title: showToast ? "Refreshed" : "Now Playing:",
            description: message,
          });
          
          if (!showToast) {
            shownToastsRef.current.add(trackId);
          }
          
          console.log(`Track changed: ${track.title} by ${track.artist}`);
        }
      }
    } catch (error) {
      console.error('Error fetching current track:', error);
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

  const checkStreamHealth = async () => {
    try {
      const health = await streamAPI.getStreamHealth();
      setStreamHealth(health);
      setConnectionState(prev => ({ ...prev, retryCount: 0 }));
    } catch (error) {
      console.error('Error checking stream health:', error);
      if (!connectionManager.isOnline) {
        setStreamHealth({
          status: 'offline',
          reason: 'No internet connection'
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

  // Base polling - always active
  useEffect(() => {
    const baseTrackInterval = setInterval(() => {
      fetchCurrentTrack();
    }, 5000);

    const healthInterval = setInterval(() => {
      checkStreamHealth();
    }, 30000);

    const audioTestInterval = setInterval(testAudioConnection, 10000);

    return () => {
      clearInterval(baseTrackInterval);
      clearInterval(healthInterval);
      clearInterval(audioTestInterval);
    };
  }, []);

  // Aggressive polling when playing
  useEffect(() => {
    if (isPlaying) {
      fetchCurrentTrack();
      console.log('Playback started - enabling aggressive track polling');
      
      const activePlayingInterval = setInterval(() => {
        fetchCurrentTrack();
      }, 2000);

      return () => {
        console.log('Playback stopped - disabling aggressive polling');
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

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((error) => {
          console.error('Audio play error:', error);
          
          if (error.name === 'NotAllowedError') {
            toast({
              title: "Permission Required",
              description: "Please interact with the page first to enable audio playback.",
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
        });
        setTimeout(() => fetchCurrentTrack(), 500);
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
        {/* Top Navigation Bar - Sticky */}
        <nav className="sticky top-0 z-50 relative bg-gradient-to-r from-black/40 via-black/30 to-black/40 backdrop-blur-xl border-b border-white/10">
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              {/* Logo */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                <img 
                  src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png" 
                  alt="Greatest Hits Non-Stop" 
                  className="h-10 sm:h-14 w-auto drop-shadow-2xl"
                />
                <div>
                  <h1 className="text-base sm:text-xl md:text-2xl font-bold text-white leading-tight text-shadow-glow">Greatest Hits Non-Stop</h1>
                  <p className="text-[10px] sm:text-xs md:text-sm text-copper-400 font-medium text-shadow-sm">Legendary Radio from Scotland</p>
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
              
              {/* Hero Player Card with Ambilight */}
              <div className="relative">
                {/* Ambilight LED Effect */}
                <div 
                  className="absolute -inset-4 rounded-[2.5rem] opacity-0 transition-opacity duration-1000"
                  style={{
                    opacity: isPlaying ? 0.6 : 0,
                    background: `
                      radial-gradient(circle at 0% 0%, ${colors.primary} 0%, transparent 50%),
                      radial-gradient(circle at 100% 0%, ${colors.secondary} 0%, transparent 50%),
                      radial-gradient(circle at 100% 100%, ${colors.accent} 0%, transparent 50%),
                      radial-gradient(circle at 0% 100%, ${colors.primary} 0%, transparent 50%)
                    `,
                    filter: 'blur(40px)',
                    animation: isPlaying ? 'ambiPulse 4s ease-in-out infinite' : 'none'
                  }}
                />
                
                {/* LED Strips Effect */}
                {isPlaying && (
                  <>
                    {/* Top LED strip */}
                    <div 
                      className="absolute -top-2 left-0 right-0 h-1 rounded-full opacity-80"
                      style={{
                        background: `linear-gradient(90deg, 
                          ${colors.primary} 0%, 
                          ${colors.secondary} 25%, 
                          ${colors.accent} 50%, 
                          ${colors.secondary} 75%, 
                          ${colors.primary} 100%)`,
                        boxShadow: `0 0 20px ${colors.primary}, 0 0 40px ${colors.secondary}`,
                        animation: 'ledFlow 3s linear infinite'
                      }}
                    />
                    
                    {/* Bottom LED strip */}
                    <div 
                      className="absolute -bottom-2 left-0 right-0 h-1 rounded-full opacity-80"
                      style={{
                        background: `linear-gradient(90deg, 
                          ${colors.primary} 0%, 
                          ${colors.secondary} 25%, 
                          ${colors.accent} 50%, 
                          ${colors.secondary} 75%, 
                          ${colors.primary} 100%)`,
                        boxShadow: `0 0 20px ${colors.primary}, 0 0 40px ${colors.secondary}`,
                        animation: 'ledFlow 3s linear infinite reverse'
                      }}
                    />
                    
                    {/* Left LED strip */}
                    <div 
                      className="absolute -left-2 top-0 bottom-0 w-1 rounded-full opacity-80"
                      style={{
                        background: `linear-gradient(180deg, 
                          ${colors.primary} 0%, 
                          ${colors.accent} 25%, 
                          ${colors.secondary} 50%, 
                          ${colors.accent} 75%, 
                          ${colors.primary} 100%)`,
                        boxShadow: `0 0 20px ${colors.primary}, 0 0 40px ${colors.accent}`,
                        animation: 'ledFlow 3s linear infinite'
                      }}
                    />
                    
                    {/* Right LED strip */}
                    <div 
                      className="absolute -right-2 top-0 bottom-0 w-1 rounded-full opacity-80"
                      style={{
                        background: `linear-gradient(180deg, 
                          ${colors.primary} 0%, 
                          ${colors.accent} 25%, 
                          ${colors.secondary} 50%, 
                          ${colors.accent} 75%, 
                          ${colors.primary} 100%)`,
                        boxShadow: `0 0 20px ${colors.primary}, 0 0 40px ${colors.accent}`,
                        animation: 'ledFlow 3s linear infinite reverse'
                      }}
                    />
                  </>
                )}
                
                <Card className="premium-container-strong rounded-3xl shadow-2xl overflow-hidden relative z-10">
                  <CardContent className="p-6 md:p-8 lg:p-10">
                  
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
                    crossOrigin="anonymous"
                  />

                  {/* Track Info with Modern Layout */}
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                    {/* Album Artwork */}
                    <div className="relative group">
                      <div className="w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
                        {currentTrack?.title === "Greatest Hits Non-Stop" ? (
                          <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-copper-900/20 to-copper-800/20">
                            <img
                              src="https://customer-assets.emergentagent.com/job_ghns-project/artifacts/5tmxnbvh_unnamed.png"
                              alt="Greatest Hits Non-Stop Logo"
                              className="w-full h-auto drop-shadow-2xl"
                            />
                          </div>
                        ) : currentTrack?.title === "Legendary Radio from Scotland" ? (
                          <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-slate-800 to-slate-900">
                            <img
                              src="https://customer-assets.emergentagent.com/job_ghns-tracker/artifacts/gkqz48mn_unnamed.png"
                              alt="Greatest Hits Non-Stop Fallback"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : currentTrack?.artwork_url ? (
                          <img
                            src={currentTrack.artwork_url}
                            alt={`${currentTrack.artist} - ${currentTrack.title}`}
                            className="w-full h-full object-cover transform transition-transform duration-500"
                            loading="eager"
                            fetchpriority="high"
                            decoding="async"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-slate-800 to-slate-900">
                            <img
                              src="https://customer-assets.emergentagent.com/job_ghns-tracker/artifacts/gkqz48mn_unnamed.png"
                              alt="Greatest Hits Non-Stop"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Glow Effect */}
                      <div 
                        className="absolute inset-0 -z-10 blur-3xl opacity-50 rounded-2xl"
                        style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
                      />
                    </div>

                    {/* Track Details */}
                    <div className="flex-1 text-center md:text-left space-y-2 overflow-hidden">
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-copper-500/20 border border-copper-500/30 mb-2">
                        <span className="text-[10px] sm:text-xs font-semibold text-copper-300 uppercase tracking-wide">Now Playing</span>
                      </div>
                      
                      {/* Scrolling Track Title */}
                      <div className="w-full">
                        <ScrollingText 
                          text={currentTrack?.title || 'Loading...'}
                          className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight"
                          speed={40}
                          pauseDuration={1500}
                        />
                      </div>
                      
                      {/* Scrolling Artist Name */}
                      <div className="w-full">
                        <ScrollingText 
                          text={currentTrack?.artist || 'Loading...'}
                          className="text-lg sm:text-xl lg:text-2xl text-white/70 font-medium"
                          speed={35}
                          pauseDuration={1500}
                        />
                      </div>
                      
                      {currentTrack?.album && (
                        <div className="w-full px-4 md:px-0">
                          <ScrollingText 
                            text={currentTrack.album}
                            className="text-sm sm:text-base lg:text-lg text-white/50"
                            speed={30}
                            pauseDuration={1500}
                          />
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="flex flex-wrap justify-center gap-2 pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSleepTimer(!showSleepTimer)}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          Sleep Timer
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowLyrics(!showLyrics);
                            setActiveView(showLyrics ? 'player' : 'lyrics');
                          }}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          <Music className="w-4 h-4 mr-2" />
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
                    </div>
                  </div>

                  {/* Simple Equalizer */}
                  <div className="mb-6">
                    <SimpleEqualizer 
                      audioRef={audioRef}
                      isPlaying={isPlaying}
                      colors={colors}
                    />
                  </div>

                  {/* Modern Controls */}
                  <div className="space-y-4">
                    {/* Play/Pause Button */}
                    <div className="flex justify-center">
                      <Button
                        onClick={togglePlayPause}
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                        }}
                      >
                        {isPlaying ? (
                          <Pause className="w-10 h-10 md:w-12 md:h-12" />
                        ) : (
                          <Play className="w-10 h-10 md:w-12 md:h-12 ml-1" />
                        )}
                      </Button>
                    </div>

                    {/* Volume Control */}
                    <div className="max-w-md mx-auto">
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

                </CardContent>
              </Card>
              </div>

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
              {showLyrics ? (
                <>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Music className="w-6 h-6 mr-2 text-copper-400" />
                    Lyrics
                  </h3>
                  <LyricsDisplay 
                    currentTrack={currentTrack}
                    carMode={false}
                    colors={colors}
                    onClose={() => setShowLyrics(false)}
                  />
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <ListMusic className="w-6 h-6 mr-2 text-copper-400" />
                    Recently Played
                  </h3>
                  <RecentTracks carMode={false} />
                </>
              )}
            </div>

            {/* Stream Recorder */}
            <StreamRecorder 
              audioRef={audioRef} 
              isPlaying={isPlaying}
            />

            {/* Additional Content */}
            <div className="space-y-6">
              <TShirtShop isCarMode={false} />
              
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
                  <p className="text-lg text-copper-400 font-medium mb-4">
                    Legendary Radio from Scotland
                  </p>
                  {lastUpdate && (
                    <p className="text-xs text-white/40">
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
