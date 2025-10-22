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

  if (!isPlaying) {
    return (
      <div className="premium-container-subtle w-full h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden flex items-center justify-center">
        <p className="text-white/50 text-sm">Play music to see visualiser</p>
      </div>
    );
  }

  // Classic equaliser: render segmented bars with peak indicators
  const renderSegmentedBar = (bar) => {
    const segments = 20; // Number of segments per bar
    const filledSegments = Math.floor((bar.height / 100) * segments);
    const peakSegment = Math.floor((bar.peak / 100) * segments);
    
    return (
      <div key={bar.id} className="flex-1 flex flex-col-reverse gap-[3px] max-w-[14px]">
        {Array.from({ length: segments }).map((_, segIndex) => {
          const isFilled = segIndex < filledSegments;
          const isPeak = segIndex === peakSegment - 1 && peakSegment > filledSegments;
          const segmentNumber = segIndex + 1;
          
          // Classic equaliser colors based on segment position
          // Green: segments 1-10 (0-50%)
          // Yellow: segments 11-16 (50-80%)
          // Red: segments 17-20 (80-100%)
          let segmentColor;
          if (segmentNumber <= 10) {
            segmentColor = '#00FF00'; // Green
          } else if (segmentNumber <= 16) {
            segmentColor = '#FFD700'; // Gold/Yellow
          } else {
            segmentColor = '#FF0000'; // Red
          }
          
          // Peak indicator always shows in corresponding color zone
          const showSegment = isFilled || isPeak;
          
          return (
            <div
              key={segIndex}
              className="w-full rounded-sm transition-all duration-75"
              style={{
                backgroundColor: showSegment ? segmentColor : 'rgba(40,40,40,0.6)',
                boxShadow: showSegment ? `0 0 12px ${segmentColor}dd, 0 0 6px ${segmentColor}, inset 0 1px 0 rgba(255,255,255,0.3)` : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                border: `1px solid ${showSegment ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.8)'}`,
                minHeight: '3px',
                height: '100%',
                opacity: showSegment ? 1 : 0.4,
                filter: isPeak ? 'brightness(1.3)' : 'none'
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden relative" style={{
      background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), inset 0 -2px 4px rgba(255,255,255,0.05)'
    }}>
      {/* Retro bezel effect */}
      <div className="absolute inset-0 border-2 border-black/50 rounded-xl pointer-events-none" style={{
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)'
      }} />
      
      <div className="absolute inset-0 flex items-stretch justify-center gap-1 px-3 py-3">
        {bars.map(renderSegmentedBar)}
      </div>
      
      {/* Grid lines for classic equaliser look */}
      <div className="absolute inset-0 pointer-events-none px-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute left-3 right-3 border-t"
            style={{ 
              top: `${(i + 1) * 16.67}%`,
              borderColor: 'rgba(0,255,0,0.08)'
            }}
          />
        ))}
      </div>
      
      {/* Vintage glass reflection effect */}
      <div className="absolute inset-0 pointer-events-none rounded-xl" style={{
        background: 'linear-gradient(165deg, rgba(255,255,255,0.03) 0%, transparent 40%, transparent 100%)'
      }} />
    </div>
  );
};

export default SafariVisualiser;
