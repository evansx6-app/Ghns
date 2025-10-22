import { useState, useEffect, useRef, useCallback } from 'react';

// Global shared audio context state
let globalAudioContext = null;
let globalSource = null;
let globalAnalyzerNodes = [];
let isGlobalSetup = false;

// Detect Safari browser
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Shared Web Audio Context Hook
// This ensures only one MediaElementSource is created per audio element
export const useSharedAudioContext = (audioRef, isPlaying) => {
  const [isReady, setIsReady] = useState(false);
  const setupAttempted = useRef(false);
  
  // Setup shared audio context
  useEffect(() => {
    if (!audioRef.current) {
      setIsReady(false);
      return;
    }

    const setupSharedContext = async () => {
      // Prevent multiple setup attempts
      if (setupAttempted.current) {
        setIsReady(isGlobalSetup);
        return;
      }

      try {
        // Create global audio context if it doesn't exist
        if (!globalAudioContext) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          
          if (!AudioContext) {
            console.warn('Web Audio API not supported');
            setIsReady(false);
            return;
          }
          
          globalAudioContext = new AudioContext();
          console.log('Audio context created:', globalAudioContext.state);
        }

        // Create global source if it doesn't exist
        if (!globalSource && audioRef.current && !isGlobalSetup) {
          try {
            // Safari requires user interaction before creating audio nodes
            if (isSafari && globalAudioContext.state === 'suspended') {
              console.log('Safari detected - waiting for user interaction');
            }

            globalSource = globalAudioContext.createMediaElementSource(audioRef.current);
            globalSource.connect(globalAudioContext.destination);
            isGlobalSetup = true;
            setupAttempted.current = true;
            
            // iOS-specific: Ensure context is running after user interaction
            if (isSafari && globalAudioContext.state !== 'running') {
              globalAudioContext.resume().then(() => {
                console.log('iOS: Audio context resumed after user interaction');
              });
            }
            
            console.log('Global audio context setup complete');
          } catch (error) {
            if (error.name === 'InvalidStateError') {
              console.warn('Audio element already connected. Using existing setup.');
              isGlobalSetup = true;
              setupAttempted.current = true;
            } else if (error.name === 'NotSupportedError' || error.message.includes('CORS')) {
              console.warn('CORS or cross-origin audio issue detected. Visualizer may not work with this stream.');
              // Don't set as ready if we can't connect due to CORS
              setIsReady(false);
              return;
            } else {
              throw error;
            }
          }
        }

        // Only resume context when playing
        if (isPlaying && globalAudioContext && globalAudioContext.state === 'suspended') {
          await globalAudioContext.resume();
          console.log('Audio context resumed:', globalAudioContext.state);
        }

        // iOS Safari: Double-check context state
        if (isSafari && globalAudioContext && isPlaying) {
          // Force resume for iOS
          if (globalAudioContext.state !== 'running') {
            console.log('iOS: Forcing audio context resume...');
            await globalAudioContext.resume();
          }
        }

        setIsReady(isGlobalSetup);
      } catch (error) {
        console.error('Failed to setup shared audio context:', error);
        setIsReady(false);
      }
    };

    setupSharedContext();
  }, [audioRef.current]);

  // Resume context when playing starts
  useEffect(() => {
    if (isPlaying && globalAudioContext && globalAudioContext.state === 'suspended') {
      globalAudioContext.resume().catch(console.error);
    }
  }, [isPlaying]);

  // Create analyzer node connected to the shared source
  const createAnalyzer = useCallback((config = {}) => {
    if (!isReady || !globalAudioContext || !globalSource) {
      console.warn('Cannot create analyzer - context not ready');
      return null;
    }

    try {
      const analyzer = globalAudioContext.createAnalyser();
      
      // Apply configuration
      analyzer.fftSize = config.fftSize || 512;
      analyzer.smoothingTimeConstant = config.smoothingTimeConstant || 0.8;
      analyzer.minDecibels = config.minDecibels || -90;
      analyzer.maxDecibels = config.maxDecibels || -10;

      // Connect source to analyzer
      globalSource.connect(analyzer);
      
      // Store reference for cleanup
      globalAnalyzerNodes.push(analyzer);

      console.log('Analyzer created and connected to global source');
      return analyzer;
    } catch (error) {
      console.error('Failed to create analyzer:', error);
      return null;
    }
  }, [isReady]);

  // Get the audio context
  const getAudioContext = useCallback(() => {
    return globalAudioContext;
  }, []);

  // Get the source node
  const getSource = useCallback(() => {
    return globalSource;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Disconnect all analyzer nodes
    globalAnalyzerNodes.forEach(analyzer => {
      try {
        analyzer.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    });
    globalAnalyzerNodes = [];

    // Don't close the context or disconnect source as other components might be using it
  }, []);

  return {
    isReady,
    audioContext: globalAudioContext,
    source: globalSource,
    createAnalyzer,
    getAudioContext,
    getSource,
    cleanup
  };
};

export default useSharedAudioContext;