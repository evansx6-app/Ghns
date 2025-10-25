import { useState, useEffect, useCallback, useRef } from 'react';

export const useCast = (track, streamUrl) => {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castSession, setCastSession] = useState(null);

  // Initialize Cast API
  useEffect(() => {
    const initializeCastApi = () => {
      if (window.cast && window.cast.framework) {
        const context = window.cast.framework.CastContext.getInstance();
        
        const options = new window.cast.framework.CastOptions();
        options.receiverApplicationId = window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
        options.autoJoinPolicy = window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED;

        context.setOptions(options);

        // Listen for Cast availability
        context.addEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          (event) => {
            setIsCastAvailable(event.castState !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE);
          }
        );

        // Listen for session changes
        context.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (event) => {
            const session = event.session;
            if (session && session.getSessionState() === window.cast.framework.SessionState.SESSION_STARTED) {
              setIsCasting(true);
              setCastSession(session);
            } else {
              setIsCasting(false);
              setCastSession(null);
            }
          }
        );

        setIsCastAvailable(context.getCastState() !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE);
      }
    };

    // Check if Cast API is loaded
    if (window.cast && window.cast.framework) {
      initializeCastApi();
    } else {
      // Wait for Cast API to load
      window['__onGCastApiAvailable'] = (isAvailable) => {
        if (isAvailable) {
          initializeCastApi();
        }
      };
    }
  }, []);

  const startCasting = useCallback(() => {
    if (!window.cast || !window.cast.framework) return;

    const context = window.cast.framework.CastContext.getInstance();
    context.requestSession().then(() => {
      // Session will be handled by the session state change listener
    }).catch((error) => {
      console.error('Error starting cast session:', error);
    });
  }, []);

  const stopCasting = useCallback(() => {
    if (castSession) {
      castSession.endSession(true);
    }
  }, [castSession]);

  // Track if media has been loaded for this session
  const [mediaLoadedForSession, setMediaLoadedForSession] = useState(false);
  const lastTrackRef = useRef(null);

  const loadMedia = useCallback(() => {
    if (!castSession || !track) return;

    const mediaInfo = new window.chrome.cast.media.MediaInfo(streamUrl, 'audio/mpeg');
    
    // Set stream type to LIVE for continuous playback
    mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
    
    mediaInfo.metadata = new window.chrome.cast.media.MusicTrackMediaMetadata();
    mediaInfo.metadata.title = track.title || 'Greatest Hits Non-Stop';
    mediaInfo.metadata.artist = track.artist || 'Live Radio';
    mediaInfo.metadata.albumName = track.album || 'Greatest Hits Non-Stop';
    
    // Use fallback artwork if track artwork is not available
    const fallbackLogoUrl = process.env.REACT_APP_LOGO_URL;
    const artworkUrl = track.artwork_url && 
                       track.artwork_url !== 'vinyl-fallback-placeholder' &&
                       !track.artwork_url.includes('unsplash')
      ? track.artwork_url 
      : fallbackLogoUrl;
    
    if (artworkUrl) {
      mediaInfo.metadata.images = [
        new window.chrome.cast.Image(artworkUrl)
      ];
      console.log('Cast artwork:', artworkUrl.includes('unnamed.png') ? 'Station logo (fallback)' : 'Track artwork');
    }

    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    // Set custom data to maintain stream continuity
    request.customData = { 
      streamType: 'live',
      continuousPlayback: true 
    };

    castSession.loadMedia(request).then(() => {
      console.log('Media loaded successfully to Cast');
      setMediaLoadedForSession(true);
      lastTrackRef.current = track;
    }).catch((error) => {
      console.error('Error loading media to Cast:', error);
    });
  }, [castSession, track, streamUrl]);

  // Update metadata by reloading media info (required for Cast to recognize changes)
  const updateMetadata = useCallback(() => {
    if (!castSession || !track) return;

    try {
      const media = castSession.getMediaSession();
      if (media) {
        // For live streams, we need to reload the media with updated metadata
        // But we can do it at the current playback position to maintain continuity
        const mediaInfo = new window.chrome.cast.media.MediaInfo(streamUrl, 'audio/mpeg');
        mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
        
        const metadata = new window.chrome.cast.media.MusicTrackMediaMetadata();
        metadata.title = track.title || 'Greatest Hits Non-Stop';
        metadata.artist = track.artist || 'Live Radio';
        metadata.albumName = track.album || 'Greatest Hits Non-Stop';
        
        if (track.artwork_url) {
          metadata.images = [
            new window.chrome.cast.Image(track.artwork_url)
          ];
        }
        
        mediaInfo.metadata = metadata;
        
        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        request.autoplay = true;
        request.customData = { 
          streamType: 'live',
          continuousPlayback: true,
          metadataUpdate: true // Flag to indicate this is just a metadata update
        };
        
        // Load will seamlessly reconnect for live streams
        castSession.loadMedia(request).then(() => {
          console.log('Cast metadata updated:', {
            title: track.title,
            artist: track.artist,
            album: track.album
          });
        }).catch((error) => {
          console.warn('Error updating Cast metadata:', error);
        });
      }
    } catch (error) {
      console.warn('Error updating Cast metadata:', error);
    }
  }, [castSession, track, streamUrl]);

  // Load media on initial cast or update metadata on track change
  useEffect(() => {
    if (!isCasting || !castSession || !track) {
      console.log('[Cast] Skipping update:', { isCasting, hasCastSession: !!castSession, hasTrack: !!track });
      return;
    }

    console.log('[Cast] Effect triggered:', { 
      mediaLoadedForSession, 
      trackTitle: track.title,
      trackArtist: track.artist 
    });

    // First time casting - load media
    if (!mediaLoadedForSession) {
      console.log('[Cast] Loading media for first time');
      loadMedia();
    } else {
      // Track changed - just update metadata, don't reload stream
      const trackChanged = !lastTrackRef.current || 
        lastTrackRef.current.title !== track.title ||
        lastTrackRef.current.artist !== track.artist;
      
      if (trackChanged) {
        console.log('[Cast] Track changed, updating metadata:', {
          from: lastTrackRef.current,
          to: { title: track.title, artist: track.artist }
        });
        updateMetadata();
        lastTrackRef.current = track;
      } else {
        console.log('[Cast] Track unchanged, skipping update');
      }
    }
  }, [isCasting, castSession, track, mediaLoadedForSession, loadMedia, updateMetadata]);

  // Reset when cast session ends
  useEffect(() => {
    if (!isCasting) {
      setMediaLoadedForSession(false);
      lastTrackRef.current = null;
    }
  }, [isCasting]);

  return {
    isCastAvailable,
    isCasting,
    startCasting,
    stopCasting,
    loadMedia
  };
};