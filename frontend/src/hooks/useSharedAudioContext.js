import { useState, useEffect, useRef, useCallback } from 'react';

// Global shared audio context state
let globalAudioContext = null;
let globalSource = null;
let globalAnalyzerNodes = [];
let isGlobalSetup = false;
let setupAttemptCount = 0;

// Detect Safari/iOS browser
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Shared Web Audio Context Hook
// This ensures only one MediaElementSource is created per audio element
export const useSharedAudioContext = (audioRef, isPlaying) => {
  const [isReady, setIsReady] = useState(false);
  const setupAttempted = useRef(false);
  const userInteracted = useRef(false);
  
  // iOS: CRITICAL - Setup audio context on ANY user interaction
  useEffect(() => {
    if ((isSafari || isIOS) && !userInteracted.current) {
      const handleUserInteraction = async () => {
        console.log('[iOS] User interaction detected - initializing audio context');
        userInteracted.current = true;
        
        try {
          // Create context immediately on user interaction
          if (!globalAudioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
              globalAudioContext = new AudioContext();
              console.log('[iOS] Audio context created on interaction:', globalAudioContext.state);
            }
          }
          
          // Resume if suspended
          if (globalAudioContext && globalAudioContext.state === 'suspended') {
            await globalAudioContext.resume();
            console.log('[iOS] Audio context resumed on interaction:', globalAudioContext.state);
          }
        } catch (err) {
          console.warn('[iOS] Failed to initialize audio context on interaction:', err);
        }
      };
      
      // Listen for ANY user interaction - use capture phase
      const events = ['touchstart', 'touchend', 'click', 'mousedown'];
      events.forEach(event => {
        document.addEventListener(event, handleUserInteraction, { once: true, capture: true });
      });
      
      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleUserInteraction, { capture: true });
        });
      };
    }
  }, []);
  
  // Setup shared audio context
  useEffect(() => {
    if (!audioRef.current) {
      setIsReady(false);
      return;
    }

    const setupSharedContext = async () => {
      // Prevent multiple setup attempts
      if (setupAttempted.current) {
        setIsReady(isGlobalSetup && globalAudioContext?.state === 'running');
        return;
      }

      setupAttemptCount++;
      console.log(`[Audio Context] Setup attempt #${setupAttemptCount}`);

      try {
        // Create global audio context if it doesn't exist
        if (!globalAudioContext) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          
          if (!AudioContext) {
            console.warn('[Audio Context] Web Audio API not supported');
            setupAttempted.current = true;
            setIsReady(false);
            return;
          }
          
          globalAudioContext = new AudioContext();
          console.log('[Audio Context] Created:', globalAudioContext.state);
        }

        // iOS: Wait for user interaction before creating source
        if ((isSafari || isIOS) && !userInteracted.current) {
          console.log('[iOS] Waiting for user interaction before creating audio source...');
          setupAttempted.current = false; // Allow retry after interaction
          setIsReady(false);
          return;
        }

        // Create global source if it doesn't exist
        if (!globalSource && audioRef.current && !isGlobalSetup) {
          try {
            console.log('[Audio Context] Creating MediaElementSource...');
            globalSource = globalAudioContext.createMediaElementSource(audioRef.current);
            globalSource.connect(globalAudioContext.destination);
            isGlobalSetup = true;
            setupAttempted.current = true;
            console.log('[Audio Context] ✅ Setup complete - visualiser enabled');
          } catch (sourceError) {
            console.error('[Audio Context] Failed to create source:', sourceError.name, sourceError.message);
            
            if (sourceError.name === 'InvalidStateError') {
              console.warn('[Audio Context] Element already connected - using existing setup');
              isGlobalSetup = true;
              setupAttempted.current = true;
            } else if (sourceError.name === 'SecurityError' || sourceError.message.includes('tainted') || sourceError.message.includes('CORS')) {
              console.warn('[Audio Context] ⚠️  CORS restriction - visualiser will use fallback animation');
              setupAttempted.current = true;
              isGlobalSetup = false;
              setIsReady(false);
              return;
            } else {
              throw sourceError;
            }
          }
        }

        // Resume context if needed
        if (globalAudioContext && globalAudioContext.state === 'suspended') {
          console.log('[iOS] Resuming suspended audio context...');
          await globalAudioContext.resume();
          console.log('[iOS] Audio context state after resume:', globalAudioContext.state);
        }

        setIsReady(isGlobalSetup && globalAudioContext?.state === 'running');
      } catch (error) {
        console.error('[Audio Context] Setup failed:', error);
        setupAttempted.current = true;
        setIsReady(false);
      }
    };

    setupSharedContext();
  }, [audioRef.current, isPlaying]);

  // Resume context when playing starts
  useEffect(() => {
    if (isPlaying && globalAudioContext && globalAudioContext.state === 'suspended') {
      console.log('[iOS] Resuming audio context on play...');
      globalAudioContext.resume()
        .then(() => {
          console.log('[iOS] Audio context resumed:', globalAudioContext.state);
          setIsReady(isGlobalSetup && globalAudioContext.state === 'running');
        })
        .catch(err => {
          console.error('[iOS] Failed to resume:', err);
        });
    }
  }, [isPlaying]);

  return {
    isReady,
    audioContext: globalAudioContext,
    source: globalSource
  };
};

export default useSharedAudioContext;