import { useEffect, useRef } from 'react';

export const useMediaSession = (track, isPlaying, audioRef) => {
  const positionStateRef = useRef(null);
  const lastTrackRef = useRef(null);
  const lastMetadataRef = useRef(null);
  const lastPlaybackStateRef = useRef(null);
  const updateTimeoutRef = useRef(null);

  // Optimized metadata update with caching to prevent status bar flickering
  const updateMetadataStably = (trackData, playbackState) => {
    if (!('mediaSession' in navigator) || !trackData) return;
    
    try {
      // Create metadata object
      const artworkUrl = trackData.artwork_url && trackData.artwork_url !== 'vinyl-fallback-placeholder' 
        ? trackData.artwork_url 
        : process.env.REACT_APP_LOGO_URL;
      
      const metadataConfig = {
        title: (trackData.title || 'Greatest Hits Non-Stop').trim(),
        artist: (trackData.artist || 'Live Radio from Scotland').trim(),
        album: trackData.album || 'Greatest Hits Non-Stop',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/png' },
          { src: artworkUrl, sizes: '128x128', type: 'image/png' },
          { src: artworkUrl, sizes: '192x192', type: 'image/png' },
          { src: artworkUrl, sizes: '256x256', type: 'image/png' },
          { src: artworkUrl, sizes: '384x384', type: 'image/png' },
          { src: artworkUrl, sizes: '512x512', type: 'image/png' }
        ]
      };

      // Check if metadata actually changed to avoid unnecessary updates
      const metadataChanged = !lastMetadataRef.current || 
        lastMetadataRef.current.title !== metadataConfig.title ||
        lastMetadataRef.current.artist !== metadataConfig.artist ||
        lastMetadataRef.current.artwork[0].src !== metadataConfig.artwork[0].src;

      const playbackStateChanged = lastPlaybackStateRef.current !== playbackState;

      // Only update if something actually changed
      if (metadataChanged || playbackStateChanged) {
        // Clear any pending updates to avoid conflicts
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
        }

        // Set metadata directly without clearing (more stable for status bar)
        navigator.mediaSession.metadata = new MediaMetadata(metadataConfig);
        navigator.mediaSession.playbackState = playbackState;
        
        // Cache the current state
        lastMetadataRef.current = metadataConfig;
        lastPlaybackStateRef.current = playbackState;
        
        console.log('Status bar metadata updated:', metadataConfig.title, `(${playbackState})`);
      }
      
    } catch (error) {
      console.warn('Stable metadata update failed:', error);
    }
  };

  // Enhanced audio focus and music app recognition
  const requestAudioFocus = async () => {
    try {
      // Request audio focus for music playback (Android)
      if ('mediaSession' in navigator && 'setMicrophoneActive' in navigator.mediaSession) {
        navigator.mediaSession.setMicrophoneActive(false);
      }
      
      // Enable hardware media keys
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      }
      
      // Request wake lock to prevent screen sleep during music
      if ('wakeLock' in navigator && isPlaying) {
        try {
          const wakeLock = await navigator.wakeLock.request('screen');
          console.log('Screen wake lock acquired for music playback');
          
          // Release wake lock when paused
          if (!isPlaying && wakeLock) {
            wakeLock.release();
          }
        } catch (wakeLockErr) {
          console.debug('Wake lock not available:', wakeLockErr.message);
        }
      }
    } catch (error) {
      console.debug('Audio focus request failed:', error);
    }
  };

  // Main effect - optimized for stable status bar display and music app recognition
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    // Determine current playback state
    const currentPlaybackState = isPlaying ? 'playing' : 'paused';
    
    // Request audio focus for music app recognition
    requestAudioFocus();
    
    // Only update if we have track data
    if (track) {
      // Detect if this is a genuine track change (not just a re-render)
      const trackChanged = !lastTrackRef.current || 
        lastTrackRef.current.title !== track.title || 
        lastTrackRef.current.artist !== track.artist ||
        lastTrackRef.current.artwork_url !== track.artwork_url;

      if (trackChanged) {
        console.log('New track detected for music app recognition:', track.title);
        lastTrackRef.current = { ...track }; // Deep copy to avoid reference issues
      }

      // Use stable update method to prevent flickering
      updateMetadataStably(track, currentPlaybackState);

      // Enhanced action handlers for music app recognition
      const setupActionHandlers = () => {
        try {
          // Core playback controls (required for music app recognition)
          navigator.mediaSession.setActionHandler('play', () => {
            if (audioRef.current) {
              console.log('Music App: Play command received');
              audioRef.current.play().catch(console.error);
            }
          });

          navigator.mediaSession.setActionHandler('pause', () => {
            if (audioRef.current) {
              console.log('Music App: Pause command received');
              audioRef.current.pause();
            }
          });

          navigator.mediaSession.setActionHandler('stop', () => {
            if (audioRef.current) {
              console.log('Music App: Stop command received');
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
          });

          // Track navigation (essential for music apps)
          navigator.mediaSession.setActionHandler('previoustrack', () => {
            console.log('Music App: Previous track - refreshing stream');
            if (audioRef.current) {
              // For live radio, "previous" refreshes metadata
              audioRef.current.load();
              audioRef.current.play().catch(console.error);
            }
          });
          
          navigator.mediaSession.setActionHandler('nexttrack', () => {
            console.log('Music App: Next track - refreshing stream');
            if (audioRef.current) {
              // For live radio, "next" refreshes metadata  
              audioRef.current.load();
              audioRef.current.play().catch(console.error);
            }
          });

          // Additional music app controls
          try {
            // Disable seek actions for live stream but acknowledge them
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
              console.log('Music App: Seek backward not available for live stream');
            });
            
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
              console.log('Music App: Seek forward not available for live stream');
            });
            
            navigator.mediaSession.setActionHandler('seekto', (details) => {
              console.log('Music App: Seek to position not available for live stream');
            });

            // Skip controls (if supported)
            if ('setActionHandler' in navigator.mediaSession) {
              navigator.mediaSession.setActionHandler('skipad', () => {
                console.log('Music App: Skip ad not applicable for radio');
              });
            }
          } catch (seekError) {
            console.debug('Some advanced media controls not supported');
          }

          // Audio session category hint for mobile OS
          try {
            if (audioRef.current) {
              // Set audio element properties for music app recognition
              audioRef.current.setAttribute('data-music-app', 'true');
              audioRef.current.setAttribute('data-app-type', 'music');
              audioRef.current.preload = 'none'; // For live streams
              
              // iOS specific hints
              audioRef.current.setAttribute('webkit-playsinline', 'true');
              audioRef.current.setAttribute('playsinline', 'true');
            }
          } catch (audioError) {
            console.debug('Audio element enhancement failed:', audioError);
          }

        } catch (error) {
          console.warn('Enhanced action handler setup failed:', error);
        }
      };

      // Set up handlers only once to avoid re-registration
      if (trackChanged || !navigator.mediaSession.actionHandlers?.play) {
        setupActionHandlers();
      }

      // Set position state only when playback state actually changes
      const shouldUpdatePosition = lastPlaybackStateRef.current !== currentPlaybackState;
      if (shouldUpdatePosition && isPlaying && audioRef.current) {
        try {
          // Throttle position updates to prevent status bar flickering
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
          }
          
          updateTimeoutRef.current = setTimeout(() => {
            try {
              navigator.mediaSession.setPositionState({
                duration: Infinity,
                playbackRate: 1,
                position: 0 // Live stream position is always "now"  
              });
            } catch (posError) {
              console.debug('Position state update skipped:', posError.message);
            }
          }, 200); // Small delay to prevent rapid updates
          
        } catch (error) {
          console.debug('Position state not supported for live streams');
        }
      }
    }

    // Cleanup function
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [track, isPlaying]); // Removed audioRef from dependencies to reduce re-renders

  // Setup cleanup effect (runs once)
  useEffect(() => {
    // Cleanup function when component unmounts
    return () => {
      if ('mediaSession' in navigator) {
        try {
          // Clear action handlers
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('stop', null);
          navigator.mediaSession.setActionHandler('previoustrack', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
          
          // Clear metadata to remove from status bar
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
          
          console.log('Media Session cleared from status bar');
        } catch (error) {
          console.warn('Media Session cleanup failed:', error);
        }
      }
      
      // Clear any pending updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []); // Empty deps - runs only on mount/unmount

  // Initial setup (runs once)
  useEffect(() => {
    if ('mediaSession' in navigator) {
      console.log('✅ Status bar integration ready - Media Session API available');
    } else {
      console.warn('❌ Status bar integration unavailable - Media Session API not supported');
    }
  }, []); // Run once on mount
};