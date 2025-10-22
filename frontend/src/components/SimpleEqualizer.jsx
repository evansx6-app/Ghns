import React, { useRef, useEffect, useState } from 'react';
import useSharedAudioContext from '../hooks/useSharedAudioContext';

// Polyfill for roundRect (not supported in all browsers)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radii) {
    const radius = Array.isArray(radii) ? radii[0] : radii;
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height);
    this.lineTo(x, y + height);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}

const SimpleEqualizer = ({ audioRef, isPlaying, colors }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const { audioContext, source, isReady } = useSharedAudioContext(audioRef, isPlaying);
  
  const [dataArray, setDataArray] = useState(null);
  const [showFallback, setShowFallback] = useState(false);
  const numBars = 16; // Reduced from 24 - removed last 8 bars, remaining bars will auto-widen
  
  // Safari detection
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  useEffect(() => {
    if (!audioContext || !source || !isReady) {
      console.log('Equalizer waiting...', { audioContext: !!audioContext, source: !!source, isReady });
      return;
    }
    
    console.log('Equalizer setup starting...');

    try {
      // Create analyser if it doesn't exist
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 2048; // Higher fftSize for smoother waveform
        analyserRef.current.smoothingTimeConstant = 0.7; // Smooth waveform animation
        source.connect(analyserRef.current);
        console.log('Equalizer analyser created for waveform visualization');
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const newDataArray = new Uint8Array(bufferLength);
      setDataArray(newDataArray);
      console.log('Waveform visualizer ready with', bufferLength, 'data points');

    } catch (error) {
      console.error('Error setting up equalizer:', error);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioContext, source, isReady]);

  useEffect(() => {
    if (!isPlaying || !analyserRef.current || !dataArray) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    const draw = () => {
      if (!isPlaying) return;

      animationRef.current = requestAnimationFrame(draw);

      // Get TIME DOMAIN data for waveform (instead of frequency data)
      analyserRef.current.getByteTimeDomainData(dataArray);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Create gradient for waveform
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, colors.primary || '#B87333');
      gradient.addColorStop(0.5, colors.secondary || '#9E6B3F');
      gradient.addColorStop(1, colors.accent || '#8B5A3C');

      // Draw waveform
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Add glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = colors.primary || '#B87333';

      ctx.beginPath();

      const sliceWidth = width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        // Convert byte value (0-255) to amplitude (-1 to 1)
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();

      // Draw mirrored waveform (for symmetry)
      ctx.beginPath();
      x = 0;
      
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = height - (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, dataArray, colors]);

  // Fallback animation when audio context is not available
  if (!isReady && isPlaying) {
    return (
      <div className="premium-container-subtle w-full h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden flex items-center justify-center relative">
        {/* Simple animated waveform using CSS */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path
              d="M0,100 Q50,80 100,100 T200,100 T300,100 T400,100 T500,100 T600,100 T700,100 T800,100 T900,100 T1000,100"
              fill="none"
              stroke="url(#waveGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              className="animate-pulse"
            />
            <path
              d="M0,100 Q50,120 100,100 T200,100 T300,100 T400,100 T500,100 T600,100 T700,100 T800,100 T900,100 T1000,100"
              fill="none"
              stroke="url(#waveGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              className="animate-pulse"
              style={{ animationDelay: '0.15s' }}
            />
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#B87333" />
                <stop offset="50%" stopColor="#9E6B3F" />
                <stop offset="100%" stopColor="#8B5A3C" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  }

  if (!isPlaying) {
    return (
      <div className="premium-container-subtle w-full h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden flex items-center justify-center">
        <p className="text-white/50 text-sm">Play music to see waveform</p>
      </div>
    );
  }

  return (
    <div className="premium-container w-full h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        width={1600}
        height={200}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default SimpleEqualizer;
