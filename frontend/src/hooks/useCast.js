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
    
    if (track.artwork_url) {
      mediaInfo.metadata.images = [
        new window.chrome.cast.Image(track.artwork_url)
      ];
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

  // Update metadata without reloading media
  const updateMetadata = useCallback(() => {
    if (!castSession || !track) return;

    try {
      const media = castSession.getMediaSession();
      if (media && media.media && media.media.metadata) {
        // Update metadata without reloading the stream
        media.media.metadata.title = track.title || 'Greatest Hits Non-Stop';
        media.media.metadata.artist = track.artist || 'Live Radio';
        media.media.metadata.albumName = track.album || 'Greatest Hits Non-Stop';
        
        if (track.artwork_url) {
          media.media.metadata.images = [
            new window.chrome.cast.Image(track.artwork_url)
          ];
        }
        
        console.log('Updated Cast metadata without reloading stream');
      }
    } catch (error) {
      console.warn('Error updating Cast metadata:', error);
    }
  }, [castSession, track]);

  // Load media on initial cast or update metadata on track change
  useEffect(() => {
    if (!isCasting || !castSession || !track) return;

    // First time casting - load media
    if (!mediaLoadedForSession) {
      loadMedia();
    } else {
      // Track changed - just update metadata, don't reload stream
      const trackChanged = !lastTrackRef.current || 
        lastTrackRef.current.title !== track.title ||
        lastTrackRef.current.artist !== track.artist;
      
      if (trackChanged) {
        updateMetadata();
        lastTrackRef.current = track;
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