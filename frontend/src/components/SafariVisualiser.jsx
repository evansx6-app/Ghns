import React, { useEffect, useState, useRef } from 'react';
import useSharedAudioContext from '../hooks/useSharedAudioContext';

const SafariVisualiser = ({ audioRef, isPlaying, colors }) => {
  const [levels, setLevels] = useState({ left: 0, right: 0, leftPeak: 0, rightPeak: 0 });
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const animationFrameRef = useRef(null);
  const levelsRef = useRef({ left: 0, right: 0 }); // Track levels in ref to avoid dependency issues
  const peaksRef = useRef({ left: { height: 0, holdTime: 0 }, right: { height: 0, holdTime: 0 } });
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const segments = 20; // Number of LED segments per channel
  
  // Try to get audio context for real-time analysis
  const { audioContext, source, isReady } = useSharedAudioContext(audioRef, isPlaying);

  // Initialize levels
  useEffect(() => {
    setLevels({ left: 0, right: 0, leftPeak: 0, rightPeak: 0 });
    peaksRef.current = { 
      left: { height: 0, holdTime: 0 }, 
      right: { height: 0, holdTime: 0 } 
    };
  }, []);
  
  // Setup audio analyser if available (iOS-compatible)
  useEffect(() => {
    if (!audioContext || !source || !isReady) {
      console.log('🎵 iOS Visualiser: Using enhanced phantom values (audio will play normally)');
      setIsFallbackMode(true);
      return;
    }
    
    try {
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.7;
        source.connect(analyserRef.current);
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        setIsFallbackMode(false);
        console.log('✅ iOS Visualiser: Real-time audio analysis active');
      }
    } catch (error) {
      console.log('🎵 iOS Visualiser: CORS/Security restriction detected, using phantom values');
      console.log('ℹ️  Visualiser will show realistic animated meters (audio playback unaffected)');
      analyserRef.current = null;
      dataArrayRef.current = null;
      setIsFallbackMode(true);
    }
    
    return () => {
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (e) {
          console.log('Analyser disconnect error (safe to ignore)');
        }
      }
    };
  }, [audioContext, source, isReady]);

  useEffect(() => {
    let time = 0;
    
    const animate = () => {
      time += 0.016; // ~60fps
      
      let leftLevel = 0;
      let rightLevel = 0;
      
      if (isPlaying) {
        // If audio analysis is available, use real frequency data
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Calculate overall audio level for both channels
          let totalSum = 0;
          let maxVal = 0;
          
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            totalSum += dataArrayRef.current[i];
            maxVal = Math.max(maxVal, dataArrayRef.current[i]);
          }
          
          const averageLevel = totalSum / dataArrayRef.current.length;
          
          // Both channels get similar levels with slight variation for realism
          const baseLevel = (averageLevel / 255) * 100 * 1.4; // 40% boost for visibility
          const peakInfluence = (maxVal / 255) * 100 * 0.3; // 30% influence from peaks
          
          // Very subtle variation - slower and smaller amplitude
          leftLevel = baseLevel + peakInfluence + (Math.sin(time * 1) * 2);
          rightLevel = baseLevel + peakInfluence + (Math.cos(time * 1.2) * 2);
          
          // Apply heavy smoothing to eliminate jitter (85/15 blend)
          leftLevel = levelsRef.current.left * 0.85 + leftLevel * 0.15;
          rightLevel = levelsRef.current.right * 0.85 + rightLevel * 0.15;
          
        } else {
          // 🎵 iOS/Safari Phantom Values Mode 🎵
          // Enhanced fallback that mimics real music analysis
          // This ensures visualiser always works on iPhone/Safari
          // Multi-layered animation simulating bass, mids, and highs
          
          // Bass layer - slow, heavy movement (like kick drums)
          const bass = Math.sin(time * 1.8) * 0.35 + 0.35; // 0-0.7 range
          
          // Mid layer - medium frequency (like vocals/guitars)
          const mids = Math.sin(time * 3.2) * 0.25 + 0.25; // 0-0.5 range
          
          // High layer - fast, light movement (like hi-hats/cymbals)
          const highs = Math.sin(time * 5.5) * 0.15 + 0.15; // 0-0.3 range
          
          // Random variations to simulate music dynamics
          const randomVariation1 = Math.sin(time * 0.7) * 0.1;
          const randomVariation2 = Math.cos(time * 0.9) * 0.1;
          
          // Occasional "peaks" to simulate loud moments in music
          const peakTrigger = Math.sin(time * 0.5);
          const peak = peakTrigger > 0.85 ? Math.random() * 0.3 : 0;
          
          // Combine layers for realistic music-like movement
          leftLevel = (bass + mids + highs + randomVariation1 + peak) * 70;
          rightLevel = (bass + mids + highs + randomVariation2 + peak) * 70;
          
          // Add slight channel variation for stereo effect
          leftLevel += Math.sin(time * 1.1) * 5;
          rightLevel += Math.cos(time * 1.3) * 5;
          
          // Apply heavy smoothing for natural movement
          leftLevel = levelsRef.current.left * 0.85 + leftLevel * 0.15;
          rightLevel = levelsRef.current.right * 0.85 + rightLevel * 0.15;
        }
      } else {
        // When stopped, animate levels down to zero
        leftLevel = Math.max(0, levelsRef.current.left - 3);
        rightLevel = Math.max(0, levelsRef.current.right - 3);
      }
      
      // Clamp levels
      leftLevel = Math.max(0, Math.min(100, leftLevel));
      rightLevel = Math.max(0, Math.min(100, rightLevel));
      
      // Peak level logic for left channel
      let leftPeak = peaksRef.current.left;
      if (isPlaying && leftLevel > leftPeak.height) {
        leftPeak = { height: leftLevel, holdTime: 20 }; // Hold for 20 frames
      } else if (leftPeak.holdTime > 0) {
        leftPeak.holdTime--;
      } else {
        leftPeak.height = Math.max(0, leftPeak.height - 2);
      }
      peaksRef.current.left = leftPeak;
      
      // Peak level logic for right channel
      let rightPeak = peaksRef.current.right;
      if (isPlaying && rightLevel > rightPeak.height) {
        rightPeak = { height: rightLevel, holdTime: 20 };
      } else if (rightPeak.holdTime > 0) {
        rightPeak.holdTime--;
      } else {
        rightPeak.height = Math.max(0, rightPeak.height - 2);
      }
      peaksRef.current.right = rightPeak;
      
      // Update ref for next frame
      levelsRef.current = { left: leftLevel, right: rightLevel };
      
      // Update state for rendering
      setLevels({
        left: leftLevel,
        right: rightLevel,
        leftPeak: leftPeak.height,
        rightPeak: rightPeak.height
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Render horizontal LED strip for a channel
  const renderLEDStrip = (level, peakLevel, label) => {
    const filledSegments = Math.floor((level / 100) * segments);
    const peakSegment = Math.floor((peakLevel / 100) * segments);
    
    return (
      <div className="flex items-center gap-3 w-full">
        {/* Channel label */}
        <div className="text-sm sm:text-base font-bold text-white/70 tracking-wider w-8" style={{
          fontFamily: 'monospace',
          textShadow: '0 0 4px rgba(0,255,0,0.5)'
        }}>
          {label}
        </div>
        
        {/* LED strip - horizontal */}
        <div className="flex gap-[3px] flex-1 max-w-2xl">
          {Array.from({ length: segments }).map((_, segIndex) => {
            const isFilled = segIndex < filledSegments;
            const isPeak = segIndex === peakSegment - 1 && peakSegment > 0;
            const segmentNumber = segIndex + 1;
            
            // Cassette deck colors
            let segmentColor;
            if (segmentNumber <= 12) {
              segmentColor = '#00FF00'; // Green (safe)
            } else if (segmentNumber <= 17) {
              segmentColor = '#FFD700'; // Yellow (moderate)
            } else {
              segmentColor = '#FF0000'; // Red (peak/danger)
            }
            
            const showSegment = isFilled || isPeak;
            
            return (
              <div
                key={segIndex}
                className="flex-1 h-4 sm:h-5 rounded-sm transition-all duration-50"
                style={{
                  backgroundColor: showSegment ? segmentColor : 'rgba(30,30,30,0.8)',
                  boxShadow: showSegment 
                    ? `0 0 8px ${segmentColor}dd, 0 0 4px ${segmentColor}, inset 0 1px 0 rgba(255,255,255,0.2)` 
                    : 'inset 0 1px 0 rgba(0,0,0,0.5)',
                  border: `1px solid ${showSegment ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.7)'}`,
                  minWidth: '4px',
                  opacity: showSegment ? 1 : 0.35,
                  filter: isPeak ? 'brightness(1.4)' : 'none'
                }}
              />
            );
          })}
        </div>
        
        {/* Level indicator */}
        <div className="text-xs sm:text-sm text-white/50 font-mono w-12 text-right">
          {Math.round(level)}%
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-24 sm:h-32 md:h-40 rounded-lg overflow-hidden relative" style={{
      background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), inset 0 -2px 4px rgba(255,255,255,0.05)'
    }}>
      {/* Cassette deck bezel */}
      <div className="absolute inset-0 border border-black/60 rounded-lg pointer-events-none" style={{
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)'
      }} />
      
      {/* Horizontal Level meters */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 sm:px-8">
        {renderLEDStrip(levels.left, levels.leftPeak, 'L')}
        {renderLEDStrip(levels.right, levels.rightPeak, 'R')}
      </div>
      
      {/* Vintage glass reflection */}
      <div className="absolute inset-0 pointer-events-none rounded-lg" style={{
        background: 'linear-gradient(165deg, rgba(255,255,255,0.02) 0%, transparent 40%)'
      }} />
      
      {/* Level scale markings - horizontal */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-between px-12 text-[8px] text-white/30 font-mono pointer-events-none">
        <div>-20</div>
        <div>-12</div>
        <div>-6</div>
        <div>-3</div>
        <div>0</div>
      </div>
    </div>
  );
};

export default SafariVisualiser;
