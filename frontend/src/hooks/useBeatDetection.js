import { useState, useEffect, useRef } from 'react';
import { useSharedAudioContext } from './useSharedAudioContext';

export const useBeatDetection = (audioRef, isPlaying) => {
  const [beatData, setBeatData] = useState({
    isBeat: false,
    intensity: 0,
    frequency: 'none' // 'bass', 'mid', 'high'
  });
  
  const analyzerRef = useRef(null);
  const animationRef = useRef(null);
  const beatHistoryRef = useRef(new Array(20).fill(0));
  const lastBeatTimeRef = useRef(0);
  
  // Use shared audio context
  const { isReady, createAnalyzer } = useSharedAudioContext(audioRef, isPlaying);

  useEffect(() => {
    if (!isReady || !isPlaying) {
      setBeatData({ isBeat: false, intensity: 0, frequency: 'none' });
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const setupBeatDetection = () => {
      try {
        // Create analyzer using shared context
        const analyzer = createAnalyzer({
          fftSize: 512,
          smoothingTimeConstant: 0.3
        });
        
        if (!analyzer) {
          console.warn('Failed to create analyzer for beat detection');
          return;
        }
        
        analyzerRef.current = analyzer;
        startBeatDetection();
      } catch (error) {
        console.error('Beat detection setup failed:', error);
      }
    };

    setupBeatDetection();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (analyzerRef.current) {
        try {
          analyzerRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        analyzerRef.current = null;
      }
    };
  }, [isReady, isPlaying, createAnalyzer]);

  const startBeatDetection = () => {
    if (!analyzerRef.current) return;

    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const detectBeat = () => {
      analyzer.getByteFrequencyData(dataArray);
      
      // Simplified beat detection - just use overall energy
      const totalEnergy = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
      
      // Update beat history
      beatHistoryRef.current.shift();
      beatHistoryRef.current.push(totalEnergy);
      
      // Calculate average energy
      const avgEnergy = beatHistoryRef.current.reduce((sum, val) => sum + val, 0) / beatHistoryRef.current.length;
      
      // Simple threshold-based beat detection
      const threshold = avgEnergy * 1.3; // 30% above average
      const now = Date.now();
      const timeSinceLastBeat = now - lastBeatTimeRef.current;
      
      let newBeatData = { isBeat: false, intensity: 0, frequency: 'mid' };
      
      if (totalEnergy > threshold && timeSinceLastBeat > 200) { // Min 200ms between beats
        lastBeatTimeRef.current = now;
        
        console.log('Beat detected!', totalEnergy, threshold); // Debug
        
        newBeatData = {
          isBeat: true,
          intensity: Math.min(totalEnergy / 255, 1), // Normalize to 0-1
          frequency: 'mid'
        };
        
        // Reset beat after short duration
        setTimeout(() => {
          setBeatData(prev => ({ ...prev, isBeat: false }));
        }, 150);
      }
      
      setBeatData(newBeatData);
      animationRef.current = requestAnimationFrame(detectBeat);
    };

    detectBeat();
  };

  return beatData;
};