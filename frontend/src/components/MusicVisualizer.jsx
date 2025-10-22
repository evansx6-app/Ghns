import React, { useRef, useEffect, useState } from 'react';
import { Waves, Volume2 } from 'lucide-react';
import { useSharedAudioContext } from '../hooks/useSharedAudioContext';

const MusicVisualizer = ({ audioRef, isPlaying, carMode = false, colors, backgroundMode = false, burstMode = false }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyzerRef = useRef(null);
  const [isSupported, setIsSupported] = useState(true);
  
  // Use shared audio context
  const { isReady, createAnalyzer } = useSharedAudioContext(audioRef, isPlaying);
  
  // Convert RGB to RGBA
  const toRGBA = (rgbString, opacity) => {
    const rgb = rgbString.match(/\d+/g);
    if (!rgb) return `rgba(245, 158, 11, ${opacity})`;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  };

  // Visualizer configuration with dynamic colors
  const config = burstMode ? {
    bars: 16,  // Fewer bars for burst effect
    barWidth: 8,
    barSpacing: 2,
    smoothing: 0.6,
    beatThreshold: 0.18,
    colors: colors ? {
      primary: toRGBA(colors.primary, 0.95),
      secondary: toRGBA(colors.secondary, 0.85),
      accent: toRGBA(colors.accent, 0.8),
      beat: toRGBA(colors.primary, 1.0)
    } : {
      primary: 'rgba(184, 115, 51, 0.95)',
      secondary: 'rgba(158, 107, 63, 0.85)',
      accent: 'rgba(139, 90, 60, 0.8)',
      beat: 'rgba(195, 154, 123, 1.0)'
    }
  } : backgroundMode ? {
    bars: carMode ? 120 : 100,  // Reduced to responsive range only
    barWidth: 2,
    barSpacing: 0,
    smoothing: 0.9,
    beatThreshold: 0.12,
    colors: colors ? {
      primary: toRGBA(colors.primary, 0.25),
      secondary: toRGBA(colors.secondary, 0.18),
      accent: toRGBA(colors.accent, 0.15),
      beat: toRGBA(colors.primary, 0.35)
    } : {
      primary: 'rgba(184, 115, 51, 0.25)',
      secondary: 'rgba(158, 107, 63, 0.18)',
      accent: 'rgba(139, 90, 60, 0.15)',
      beat: 'rgba(195, 154, 123, 0.35)'
    }
  } : {
    bars: carMode ? 40 : 32,  // Reduced to only show responsive bars
    barWidth: carMode ? 8 : 7,  // Wider bars for better visibility
    barSpacing: carMode ? 2 : 1.5,  // More spacing
    smoothing: 0.8,
    beatThreshold: 0.15,
    colors: colors ? {
      primary: toRGBA(colors.primary, 0.9),
      secondary: toRGBA(colors.secondary, 0.75),
      accent: toRGBA(colors.accent, 0.6),
      beat: toRGBA(colors.primary, 1.0)
    } : {
      primary: 'rgba(184, 115, 51, 0.9)',
      secondary: 'rgba(158, 107, 63, 0.75)',
      accent: 'rgba(139, 90, 60, 0.6)',
      beat: 'rgba(195, 154, 123, 1.0)'
    }
  };

  // Beat detection state
  const beatDetectionRef = useRef({
    energyHistory: new Array(43).fill(0), // ~1 second at 43 FPS
    variance: 0,
    avgEnergy: 0,
    beatDetected: false,
    lastBeat: 0
  });

  useEffect(() => {
    console.log('MusicVisualizer effect:', { isReady, isPlaying, backgroundMode });
    
    if (!isReady) {
      console.log('Visualizer not ready');
      return;
    }

    const setupAudioAnalysis = () => {
      try {
        console.log('Setting up audio analysis for visualizer...');
        
        // Create analyzer using shared audio context
        const analyzerConfig = backgroundMode ? {
          fftSize: 2048, // Higher resolution for smoother waveform
          smoothingTimeConstant: 0.3 // Less smoothing for more responsive waveform
        } : {
          fftSize: 256,
          smoothingTimeConstant: config.smoothing
        };

        const analyzer = createAnalyzer(analyzerConfig);
        
        if (!analyzer) {
          console.warn('Failed to create analyzer for visualizer');
          setIsSupported(false);
          return;
        }
        
        console.log('Analyzer created successfully for visualizer');
        analyzerRef.current = analyzer;
        
        // Start visualization
        startVisualization();
        
      } catch (error) {
        console.error('Audio analysis setup failed:', error);
        setIsSupported(false);
      }
    };

    setupAudioAnalysis();

    return () => {
      stopVisualization();
      if (analyzerRef.current) {
        try {
          analyzerRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        analyzerRef.current = null;
      }
    };
  }, [isReady, backgroundMode, createAnalyzer]);

  const startVisualization = () => {
    console.log('Starting visualization...', { 
      hasAnalyzer: !!analyzerRef.current, 
      hasCanvas: !!canvasRef.current 
    });
    
    if (!analyzerRef.current || !canvasRef.current) {
      console.warn('Cannot start visualization - missing analyzer or canvas');
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Set canvas size
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    const draw = () => {
      if (!analyzer) return;
      
      if (burstMode) {
        // Get frequency data for burst effect
        analyzer.getByteFrequencyData(dataArray);
        
        // Calculate energy for beat detection
        const energy = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const beatDetected = detectBeat(energy);
        
        // Draw burst visualizer
        drawBurstEffect(ctx, dataArray, beatDetected);
      } else if (backgroundMode) {
        // Get waveform data for sound wave effect
        analyzer.getByteTimeDomainData(dataArray);
        drawSoundWave(ctx, dataArray);
      } else {
        // Get frequency data for traditional bars
        analyzer.getByteFrequencyData(dataArray);
        
        // Calculate energy for beat detection
        const energy = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const beatDetected = detectBeat(energy);
        
        // Draw visualizer
        drawBars(ctx, dataArray, beatDetected);
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
  };

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const detectBeat = (currentEnergy) => {
    const detection = beatDetectionRef.current;
    const now = Date.now();
    
    // Update energy history
    detection.energyHistory.shift();
    detection.energyHistory.push(currentEnergy);
    
    // Calculate average and variance
    const sum = detection.energyHistory.reduce((a, b) => a + b, 0);
    detection.avgEnergy = sum / detection.energyHistory.length;
    
    const variance = detection.energyHistory.reduce((sum, energy) => {
      return sum + Math.pow(energy - detection.avgEnergy, 2);
    }, 0) / detection.energyHistory.length;
    
    detection.variance = variance;
    
    // Beat detection algorithm
    const threshold = detection.avgEnergy + (config.beatThreshold * variance);
    const timeSinceLastBeat = now - detection.lastBeat;
    
    if (currentEnergy > threshold && timeSinceLastBeat > 200) { // Min 200ms between beats
      detection.lastBeat = now;
      detection.beatDetected = true;
      setTimeout(() => { detection.beatDetected = false; }, 100);
      return true;
    }
    
    return detection.beatDetected;
  };

  const drawBars = (ctx, dataArray, beatDetected) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const barCount = Math.min(config.bars, dataArray.length);
    
    // Calculate bar width to fill the full width
    const totalSpacing = (barCount - 1) * config.barSpacing;
    const availableWidth = width - totalSpacing;
    const dynamicBarWidth = Math.max(1, availableWidth / barCount);
    
    const startX = 0;

    // Background mode uses different rendering
    if (backgroundMode) {
      drawModernBackground(ctx, dataArray, beatDetected, width, height, barCount, dynamicBarWidth);
      return;
    }
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    if (beatDetected) {
      gradient.addColorStop(0, config.colors.beat);
      gradient.addColorStop(0.5, config.colors.primary);
      gradient.addColorStop(1, config.colors.secondary);
    } else {
      gradient.addColorStop(0, config.colors.primary);
      gradient.addColorStop(0.5, config.colors.secondary);
      gradient.addColorStop(1, config.colors.accent);
    }
    
    ctx.fillStyle = gradient;
    
    // Draw bars
    for (let i = 0; i < barCount; i++) {
      // Use improved frequency distribution - average multiple bins per bar
      const normalizedIndex = i / (barCount - 1);
      const startIdx = Math.floor(normalizedIndex * dataArray.length);
      const endIdx = Math.min(startIdx + Math.max(1, Math.floor(dataArray.length / barCount)), dataArray.length);
      
      // Average multiple frequency bins for better responsiveness
      let sum = 0;
      let count = 0;
      for (let j = startIdx; j < endIdx; j++) {
        sum += dataArray[j];
        count++;
      }
      const avgValue = count > 0 ? sum / count : dataArray[startIdx] || 0;
      
      // Check if this is one of the last 7 bars (rightmost)
      const isLast7Bars = i >= (barCount - 7);
      
      // Treble boost - progressively increase multiplier for higher frequencies
      let multiplier;
      if (normalizedIndex < 0.3) {
        // Bass (0-30%): minimal boost
        multiplier = 1.1;
      } else if (normalizedIndex < 0.5) {
        // Mid-low (30-50%): slight boost
        multiplier = 1.5;
      } else if (normalizedIndex < 0.7) {
        // Mid-high (50-70%): moderate boost
        multiplier = 2.2;
      } else {
        // Treble (70-100%): strong boost for high frequencies
        multiplier = 3.3;
        
        // EXTRA BOOST for the last 7 bars specifically
        if (isLast7Bars) {
          // Calculate position within the last 7 bars (0 to 1)
          const positionInLast7 = (i - (barCount - 7)) / 7;
          // Progressive extra boost from 4.2x to 6.5x for the last 7 bars
          multiplier = 4.2 + (positionInLast7 * 2.3); // 4.2x to 6.5x
        }
      }
      
      let value = avgValue * multiplier;
      
      // UNIFORM floor for all bars - prevents slope effect
      const minFloor = 18;
      value = Math.max(value, minFloor);
      
      // Cap at 255
      value = Math.min(255, value);
      
      const barHeight = (value / 255) * height * 0.85;
      
      const x = startX + (i * (dynamicBarWidth + config.barSpacing));
      const y = height - barHeight;
      
      // Add beat pulse effect
      const pulseScale = beatDetected ? 1.05 : 1;
      const actualBarWidth = dynamicBarWidth * pulseScale;
      const offsetX = (dynamicBarWidth - actualBarWidth) / 2;
      
      // Draw bar with rounded corners (smaller radius for thin bars)
      const radius = Math.min(1, actualBarWidth / 3);
      drawRoundedBar(ctx, x + offsetX, y, actualBarWidth, barHeight, radius);
      
      // Add glow effect on beat
      if (beatDetected && barHeight > height * 0.1) {
        ctx.shadowColor = config.colors.beat;
        ctx.shadowBlur = 6;
        drawRoundedBar(ctx, x + offsetX, y, actualBarWidth, barHeight, radius);
        ctx.shadowBlur = 0;
      }
    }
  };

  const drawSoundWave = (ctx, dataArray) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set line properties for clean waveform
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Simple single color for the waveform
    ctx.strokeStyle = config.colors.primary;
    
    // Draw single clean waveform
    ctx.beginPath();
    
    const sliceWidth = width / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      // Convert byte data to amplitude (-1 to 1)
      const amplitude = (dataArray[i] - 128) / 128;
      
      // Scale amplitude to canvas height (reduced for subtlety)
      const y = (height / 2) + (amplitude * height * 0.2);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
  };

  const drawEnergyParticles = (ctx, dataArray, width, height) => {
    const particleCount = Math.min(30, Math.floor(dataArray.length / 10));
    
    for (let i = 0; i < particleCount; i++) {
      const dataIndex = Math.floor((i / particleCount) * dataArray.length);
      const amplitude = Math.abs((dataArray[dataIndex] - 128) / 128);
      
      if (amplitude > 0.2) {
        const x = (i / particleCount) * width;
        const y = height / 2 + (Math.sin(Date.now() * 0.005 + i) * 30);
        const size = amplitude * 4 + 1;
        const opacity = amplitude * 0.8;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = config.colors.beat.replace(/[\d\.]+\)$/g, `${opacity})`);
        ctx.fill();
        
        // Add particle glow
        ctx.shadowColor = config.colors.primary;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  };

  const drawFrequencyBars = (ctx, dataArray, width, height, isHighEnergy) => {
    const barCount = 8;
    const barWidth = 4;
    const spacing = 6;
    
    // Left side bars
    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * dataArray.length * 0.3); // Lower frequencies
      const amplitude = Math.abs((dataArray[dataIndex] - 128) / 128);
      const barHeight = amplitude * height * 0.3;
      
      const x = i * (barWidth + spacing) + 20;
      const y = (height - barHeight) / 2;
      
      const opacity = isHighEnergy ? 0.8 : 0.5;
      ctx.fillStyle = config.colors.primary.replace(/[\d\.]+\)$/g, `${opacity})`);
      ctx.fillRect(x, y, barWidth, barHeight);
    }
    
    // Right side bars
    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(((i / barCount) * 0.3 + 0.7) * dataArray.length); // Higher frequencies
      const amplitude = Math.abs((dataArray[dataIndex] - 128) / 128);
      const barHeight = amplitude * height * 0.3;
      
      const x = width - ((i + 1) * (barWidth + spacing)) - 20;
      const y = (height - barHeight) / 2;
      
      const opacity = isHighEnergy ? 0.8 : 0.5;
      ctx.fillStyle = config.colors.secondary.replace(/[\d\.]+\)$/g, `${opacity})`);
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  };

  const drawBurstEffect = (ctx, dataArray, beatDetected) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2;
    
    // Create radial burst effect
    const barCount = config.bars;
    const angleStep = (Math.PI * 2) / barCount;
    
    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(i * (dataArray.length / barCount));
      const amplitude = dataArray[dataIndex] / 255;
      
      // Calculate position for radial burst
      const angle = i * angleStep;
      const length = amplitude * maxRadius * (beatDetected ? 1.5 : 1.0);
      
      const startRadius = maxRadius * 0.1;
      const endRadius = startRadius + length;
      
      const startX = centerX + Math.cos(angle) * startRadius;
      const startY = centerY + Math.sin(angle) * startRadius;
      const endX = centerX + Math.cos(angle) * endRadius;
      const endY = centerY + Math.sin(angle) * endRadius;
      
      // Create gradient for burst line
      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, config.colors.primary);
      gradient.addColorStop(0.5, config.colors.secondary);
      gradient.addColorStop(1, 'transparent');
      
      // Draw burst line
      ctx.strokeStyle = gradient;
      ctx.lineWidth = config.barWidth * (beatDetected ? 2 : 1);
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Add glow effect on high amplitude
      if (amplitude > 0.7) {
        ctx.shadowColor = config.colors.beat;
        ctx.shadowBlur = beatDetected ? 15 : 8;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  };

  const drawRoundedBar = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y + height);
    ctx.lineTo(x + radius, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  };

  // Fallback CSS animation for when Web Audio API is not available
  if (!isSupported || !isReady) {
    if (backgroundMode) {
      return (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-transparent opacity-30" />
      );
    }
    
    // If playing but not supported, show CSS-based animation
    if (isPlaying && !isReady) {
      return (
        <div className={`relative ${carMode ? 'h-24' : 'h-16'} bg-gradient-to-r from-black/30 via-gray-900/40 to-black/30 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 shadow-inner`}>
          <div className="flex items-center justify-center h-full gap-1 px-4">
            {[...Array(burstMode ? 12 : carMode ? 20 : 16)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-copper-500/60 via-copper-600/50 to-copper-400/40 rounded-sm animate-pulse"
                style={{
                  height: `${30 + Math.sin(i * 0.5) * 20}%`,
                  animationDelay: `${i * 0.05}s`,
                  animationDuration: `${0.8 + Math.random() * 0.4}s`
                }}
              />
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <div className={`flex items-center justify-center ${carMode ? 'h-24' : 'h-16'} bg-white/5 rounded-lg`}>
        <div className="flex items-center space-x-2 text-white/50">
          <Waves className={`${carMode ? 'h-6 w-6' : 'h-5 w-5'}`} />
          <span className={`${carMode ? 'text-base' : 'text-sm'}`}>
            Play music to see visualizer
          </span>
        </div>
      </div>
    );
  }

  const containerClass = backgroundMode 
    ? "absolute inset-0 opacity-60 overflow-hidden"
    : `relative ${carMode ? 'h-24' : 'h-16'} bg-gradient-to-r from-black/30 via-gray-900/40 to-black/30 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 shadow-inner`;

  return (
    <div className={containerClass}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      
      {/* Overlay effects - only for non-background mode */}
      {!backgroundMode && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-copper-500/5 via-transparent to-copper-600/5 pointer-events-none" />
          
          {/* Info overlay */}
          <div className="absolute top-1 right-2 flex items-center space-x-1 text-copper-300/60">
            <Volume2 className="h-3 w-3" />
            <span className="text-xs font-medium">LIVE</span>
          </div>
        </>
      )}
    </div>
  );
};

export default MusicVisualizer;