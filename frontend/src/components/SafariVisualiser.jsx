import React, { useEffect, useState, useRef } from 'react';
import useSharedAudioContext from '../hooks/useSharedAudioContext';

const SafariVisualiser = ({ audioRef, isPlaying, colors }) => {
  const [levels, setLevels] = useState({ left: 0, right: 0, leftPeak: 0, rightPeak: 0 });
  const animationFrameRef = useRef(null);
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
  
  // Setup audio analyser if available
  useEffect(() => {
    if (!audioContext || !source || !isReady) {
      return;
    }
    
    try {
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 256; // Decent resolution for level detection
        analyserRef.current.smoothingTimeConstant = 0.7;
        source.connect(analyserRef.current);
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        console.log('✅ Cassette deck level meters enabled');
      }
    } catch (error) {
      console.log('Using fallback animation (no audio analysis)');
    }
    
    return () => {
      if (analyserRef.current && source) {
        try {
          analyserRef.current.disconnect();
        } catch (e) {}
      }
    };
  }, [audioContext, source, isReady]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setLevels({ left: 0, right: 0, leftPeak: 0, rightPeak: 0 });
      return;
    }

    let time = 0;
    
    const animate = () => {
      time += 0.016; // ~60fps
      
      let leftLevel = 0;
      let rightLevel = 0;
      
      // If audio analysis is available, use real frequency data
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Calculate average levels (simulating stereo by splitting frequency range)
        // Lower frequencies = left channel, higher = right channel (for visual variety)
        const mid = Math.floor(dataArrayRef.current.length / 2);
        
        let leftSum = 0;
        let rightSum = 0;
        
        // Left channel: lower frequencies with boost
        for (let i = 0; i < mid; i++) {
          leftSum += dataArrayRef.current[i];
        }
        leftLevel = (leftSum / mid / 255) * 100 * 1.3; // 30% boost for visibility
        
        // Right channel: higher frequencies with boost
        for (let i = mid; i < dataArrayRef.current.length; i++) {
          rightSum += dataArrayRef.current[i];
        }
        rightLevel = (rightSum / (dataArrayRef.current.length - mid) / 255) * 100 * 1.5; // 50% boost for highs
        
      } else {
        // Fallback: wave animation
        leftLevel = (Math.sin(time * 2) * 0.3 + 0.5) * 60 + Math.random() * 10;
        rightLevel = (Math.cos(time * 2.3) * 0.3 + 0.5) * 60 + Math.random() * 10;
      }
      
      // Clamp levels
      leftLevel = Math.max(0, Math.min(100, leftLevel));
      rightLevel = Math.max(0, Math.min(100, rightLevel));
      
      // Peak level logic for left channel
      let leftPeak = peaksRef.current.left;
      if (leftLevel > leftPeak.height) {
        leftPeak = { height: leftLevel, holdTime: 20 }; // Hold for 20 frames
      } else if (leftPeak.holdTime > 0) {
        leftPeak.holdTime--;
      } else {
        leftPeak.height = Math.max(0, leftPeak.height - 2);
      }
      peaksRef.current.left = leftPeak;
      
      // Peak level logic for right channel
      let rightPeak = peaksRef.current.right;
      if (rightLevel > rightPeak.height) {
        rightPeak = { height: rightLevel, holdTime: 20 };
      } else if (rightPeak.holdTime > 0) {
        rightPeak.holdTime--;
      } else {
        rightPeak.height = Math.max(0, rightPeak.height - 2);
      }
      peaksRef.current.right = rightPeak;
      
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

  if (!isPlaying) {
    return (
      <div className="w-full h-24 sm:h-32 md:h-40 rounded-lg overflow-hidden relative" style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)'
      }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/50 text-sm font-mono">PLAY TO MONITOR LEVELS</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-24 sm:h-32 md:h-40 rounded-lg overflow-hidden relative" style={{
      background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), inset 0 -2px 4px rgba(255,255,255,0.05)'
    }}>
      {/* Cassette deck bezel */}
      <div className="absolute inset-0 border border-black/60 rounded-lg pointer-events-none" style={{
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)'
      }} />
      
      {/* Level meters */}
      <div className="absolute inset-0 flex items-center justify-center gap-8 sm:gap-12 px-4">
        {renderLEDStrip(levels.left, levels.leftPeak, 'L')}
        {renderLEDStrip(levels.right, levels.rightPeak, 'R')}
      </div>
      
      {/* Vintage glass reflection */}
      <div className="absolute inset-0 pointer-events-none rounded-lg" style={{
        background: 'linear-gradient(165deg, rgba(255,255,255,0.02) 0%, transparent 40%)'
      }} />
      
      {/* Level scale markings */}
      <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-12 px-1 text-[8px] text-white/30 font-mono pointer-events-none">
        <div>0</div>
        <div>-3</div>
        <div>-6</div>
        <div>-12</div>
        <div>-20</div>
      </div>
    </div>
  );
};

export default SafariVisualiser;
