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
      // Animate bars back to rest state
      barsRef.current = barsRef.current.map(bar => ({
        ...bar,
        targetHeight: 20 + Math.random() * 10
      }));
      return;
    }

    let time = 0;
    
    const animate = () => {
      time += 0.016; // ~60fps
      
      let updatedBars;
      
      // If audio analysis is available, use real frequency data
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Find average and max values for adaptive scaling
        let sum = 0;
        let maxVal = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
          maxVal = Math.max(maxVal, dataArrayRef.current[i]);
        }
        const average = sum / dataArrayRef.current.length;
        
        updatedBars = barsRef.current.map((bar, i) => {
          // Map each bar to a frequency bin (evenly distributed across spectrum)
          const dataIndex = Math.floor((i / numBars) * dataArrayRef.current.length);
          let frequencyValue = dataArrayRef.current[dataIndex];
          
          // Adaptive boost for quieter frequencies to make bars more even
          const quietBoost = frequencyValue < average ? 1.3 : 1.0;
          frequencyValue = Math.min(255, frequencyValue * quietBoost);
          
          // Progressive sensitivity boost for high frequency bars (right side)
          let sensitivityMultiplier = 1.0;
          if (i >= numBars - 12) {
            // Last 12 bars: progressive increase from 1.5x to 2.0x
            const highFreqIndex = i - (numBars - 12);
            sensitivityMultiplier = 1.5 + (highFreqIndex / 12) * 0.5;
          } else if (i < 8) {
            // First 8 bars (bass): slight boost for better low-end response
            sensitivityMultiplier = 1.2;
          }
          
          // Convert byte value (0-255) to height percentage (5-100%)
          const baseHeight = ((frequencyValue / 255) * 85 * sensitivityMultiplier) + 10;
          
          // Add small wave for smooth motion even with low audio
          const wave = Math.sin(time * 2 + i * 0.3) * 3;
          const targetHeight = baseHeight + wave + Math.random() * 2;
          
          // Smooth interpolation
          const currentHeight = bar.height + (targetHeight - bar.height) * 0.35;
          const finalHeight = Math.max(5, Math.min(100, currentHeight));
          
          // Peak level logic
          let peak = peaksRef.current[i] || { height: 0, holdTime: 0 };
          
          if (finalHeight > peak.height) {
            // New peak reached
            peak = { height: finalHeight, holdTime: 30 }; // Hold for 30 frames (~0.5s)
          } else if (peak.holdTime > 0) {
            // Hold peak at current position
            peak.holdTime--;
          } else {
            // Slowly decay peak
            peak.height = Math.max(0, peak.height - 1.5);
          }
          
          peaksRef.current[i] = peak;
          
          return {
            ...bar,
            height: finalHeight,
            targetHeight,
            peak: peak.height
          };
        });
      } else {
        // Fallback: wave animation when audio analysis unavailable
        updatedBars = barsRef.current.map((bar, i) => {
          // Create wave patterns with different frequencies
          const wave1 = Math.sin(time * bar.frequency + bar.phase) * 30;
          const wave2 = Math.sin(time * bar.frequency * 2 + i * 0.5) * 15;
          const wave3 = Math.cos(time * bar.frequency * 0.5 + i * 0.3) * 20;
          
          // Combine waves for complex motion
          const targetHeight = 30 + wave1 + wave2 + wave3 + Math.random() * 10;
          
          // Smooth interpolation towards target
          const currentHeight = bar.height + (targetHeight - bar.height) * 0.15;
          
          return {
            ...bar,
            height: Math.max(10, Math.min(95, currentHeight)),
            targetHeight
          };
        });
      }
      
      barsRef.current = updatedBars;
      setBars([...updatedBars]);
      
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
