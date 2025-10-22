import { useState, useRef, useCallback } from 'react';

// Load lamejs library for MP3 encoding
const loadLameJS = () => {
  return new Promise((resolve, reject) => {
    if (window.lamejs) {
      resolve(window.lamejs);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lamejs@1.2.0/lame.min.js';
    script.onload = () => {
      if (window.lamejs) {
        resolve(window.lamejs);
      } else {
        reject(new Error('Failed to load lamejs library'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load MP3 encoder'));
    document.head.appendChild(script);
  });
};

const useStreamRecorder = (audioRef, recordingMode = 'stream') => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingSize, setRecordingSize] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const startTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const destinationRef = useRef(null);
  const sourceRef = useRef(null);
  
  // MP3 encoding configuration
  const MP3_CONFIG = {
    sampleRate: 44100,
    bitRate: 160, // 160 kbps as requested
    channels: 2   // Stereo
  };

  // Format duration for display
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Format file size for display
  const formatSize = useCallback((bytes) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }, []);

  // Convert audio blob to MP3 at 160kbps
  const convertToMP3 = useCallback(async (audioBlob) => {
    try {
      console.log('Starting MP3 conversion at 160kbps...');
      setIsProcessing(true);

      // Load lamejs library
      const lamejs = await loadLameJS();
      
      // Create audio context for processing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: MP3_CONFIG.sampleRate
      });

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get audio samples
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
      
      // Convert to 16-bit PCM
      const leftSamples = new Int16Array(leftChannel.length);
      const rightSamples = new Int16Array(rightChannel.length);
      
      for (let i = 0; i < leftChannel.length; i++) {
        leftSamples[i] = Math.max(-32768, Math.min(32767, leftChannel[i] * 32768));
        rightSamples[i] = Math.max(-32768, Math.min(32767, rightChannel[i] * 32768));
      }

      // Initialize MP3 encoder
      const mp3Encoder = new lamejs.Mp3Encoder(
        MP3_CONFIG.channels, 
        MP3_CONFIG.sampleRate, 
        MP3_CONFIG.bitRate
      );
      
      // Encode to MP3
      const mp3Data = [];
      const sampleBlockSize = 1152; // Standard MP3 frame size
      
      for (let i = 0; i < leftSamples.length; i += sampleBlockSize) {
        const leftChunk = leftSamples.subarray(i, i + sampleBlockSize);
        const rightChunk = rightSamples.subarray(i, i + sampleBlockSize);
        
        const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      // Flush remaining data
      const finalMp3buf = mp3Encoder.flush();
      if (finalMp3buf.length > 0) {
        mp3Data.push(finalMp3buf);
      }

      // Create MP3 blob
      const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
      
      console.log(`MP3 conversion completed: ${formatSize(mp3Blob.size)} at ${MP3_CONFIG.bitRate}kbps`);
      setIsProcessing(false);
      
      return mp3Blob;

    } catch (error) {
      setIsProcessing(false);
      console.error('MP3 conversion failed:', error);
      throw new Error('Failed to convert to MP3: ' + error.message);
    }
  }, [formatSize]);

  // Start recording the stream
  const startRecording = useCallback(async () => {
    try {
      if (!audioRef?.current) {
        throw new Error('Audio element not available');
      }

      console.log('Starting stream recording...');
      
      // Check if audio is actually playing
      if (audioRef.current.paused) {
        throw new Error('Audio must be playing to start recording');
      }

      // Try different recording methods based on browser support
      let mediaStream;
      let audioContext;

      try {
        // Method 1: Direct stream capture using separate audio element (CORS-safe)
        console.log('Attempting direct stream recording...');
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Create a separate audio element for recording (avoids CORS issues)
        const recordingAudio = document.createElement('audio');
        recordingAudio.crossOrigin = 'anonymous';
        recordingAudio.preload = 'none';
        
        // Use the same stream URL as the main player
        const streamUrl = audioRef.current.src || audioRef.current.currentSrc;
        console.log('Recording from stream URL:', streamUrl);
        
        // Try to create source from recording audio element
        recordingAudio.src = streamUrl;
        recordingAudio.load();
        
        // Wait for audio to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Recording audio load timeout')), 10000);
          
          recordingAudio.addEventListener('canplay', () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
          
          recordingAudio.addEventListener('error', (e) => {
            clearTimeout(timeout);
            reject(new Error('Recording audio failed to load: ' + e.message));
          }, { once: true });
          
          recordingAudio.play().catch(reject);
        });

        // Create MediaElementSource from recording audio
        sourceRef.current = audioContext.createMediaElementSource(recordingAudio);
        console.log('Created separate recording audio source successfully');

        // Create destination for recording
        destinationRef.current = audioContext.createMediaStreamDestination();
        
        // Connect source to destination (recording audio doesn't need to connect to speakers)
        sourceRef.current.connect(destinationRef.current);
        
        // Store reference to recording audio for cleanup
        recordingAudio._recordingElement = true;

        mediaStream = destinationRef.current.stream;
        console.log('Using separate audio element method for direct recording');

      } catch (webAudioError) {
        console.error('Direct stream recording failed:', webAudioError.message);
        throw new Error('Stream recording not available. Please try a different browser or refresh the page.');
      }

      // Validate mediaStream
      if (!mediaStream || mediaStream.getAudioTracks().length === 0) {
        throw new Error('No audio tracks available for recording');
      }

      // Set up for MP3 encoding at 160kbps
      const options = {};
      
      // For MP3 output, we'll use the best available format for recording
      // and then convert to MP3 client-side
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4', 
        'audio/ogg;codecs=opus',
        '' // Default fallback
      ];

      for (const type of supportedTypes) {
        if (type === '' || MediaRecorder.isTypeSupported(type)) {
          if (type) options.mimeType = type;
          console.log('Recording in format for MP3 conversion:', type || 'default');
          break;
        }
      }

      // Create MediaRecorder with enhanced error handling
      try {
        mediaRecorderRef.current = new MediaRecorder(mediaStream, options);
      } catch (recorderError) {
        console.error('MediaRecorder creation failed:', recorderError);
        // Try without options as final fallback
        mediaRecorderRef.current = new MediaRecorder(mediaStream);
        console.log('Created MediaRecorder with default settings');
      }

      recordedChunksRef.current = [];

      // Handle data available
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          
          // Update recording size
          const totalSize = recordedChunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
          setRecordingSize(totalSize);
        }
      };

      // Handle recording stop
      mediaRecorderRef.current.onstop = () => {
        console.log('Recording stopped');
      };

      // Start recording
      mediaRecorderRef.current.start(1000); // Collect data every second
      
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setRecordingDuration(0);
      setRecordingSize(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setRecordingDuration(elapsed);
        }
      }, 1000);

      console.log('Stream recording started successfully');

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [audioRef]);

  // Stop recording and prepare download
  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      try {
        if (!mediaRecorderRef.current || !isRecording) {
          reject(new Error('No active recording to stop'));
          return;
        }

        console.log('Stopping stream recording...');

        // Set up the stop handler before stopping
        mediaRecorderRef.current.onstop = async () => {
          try {
            // Clear intervals
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current);
              durationIntervalRef.current = null;
            }

            // Create blob from recorded chunks
            const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
            const recordedBlob = new Blob(recordedChunksRef.current, { type: mimeType });
            
            console.log(`Recording completed: ${formatSize(recordedBlob.size)}, ${formatDuration(recordingDuration)}`);

            // Convert to MP3 at 160kbps
            let finalBlob;
            let finalMimeType = 'audio/mp3';
            
            try {
              finalBlob = await convertToMP3(recordedBlob);
              console.log(`MP3 conversion successful: ${formatSize(finalBlob.size)} at 160kbps`);
            } catch (conversionError) {
              console.warn('MP3 conversion failed, using original format:', conversionError.message);
              finalBlob = recordedBlob;
              finalMimeType = mimeType;
            }

            // Generate filename with current track info and timestamp
            const now = new Date();
            const timestamp = now.toISOString().split('T')[0] + '_' + 
                            now.toTimeString().split(' ')[0].replace(/:/g, '-');
            
            let filename = `GreatestHitsNonStop_${timestamp}`;
            
            // Add current track info if available
            try {
              const titleEl = document.querySelector('[class*="text-xl"][class*="font-bold"]');
              const artistEl = document.querySelector('[class*="text-white/70"]');
              
              if (titleEl && artistEl) {
                const title = titleEl.textContent.trim().replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
                const artist = artistEl.textContent.trim().replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 20);
                filename = `${artist} - ${title}_${timestamp}`;
              }
            } catch (e) {
              console.debug('Could not get current track info for filename');
            }

            // Use .mp3 extension for MP3 files, fallback for others
            let extension = 'mp3';
            if (finalMimeType.includes('mp4')) extension = 'm4a';
            else if (finalMimeType.includes('webm')) extension = 'webm';
            
            filename += `.${extension}`;

            // Reset state
            setIsRecording(false);
            setRecordingDuration(0);
            setRecordingSize(0);
            startTimeRef.current = null;

            resolve({
              blob: finalBlob,
              filename: filename,
              size: finalBlob.size,
              duration: recordingDuration,
              mimeType: finalMimeType,
              bitrate: finalMimeType === 'audio/mp3' ? '160kbps' : 'original'
            });

          } catch (error) {
            reject(error);
          }
        };

        // Stop the recording
        mediaRecorderRef.current.stop();

      } catch (error) {
        console.error('Failed to stop recording:', error);
        reject(error);
      }
    });
  }, [isRecording, recordingDuration, formatSize, formatDuration]);

  // Download the recorded file
  const downloadRecording = useCallback((recordingData) => {
    try {
      console.log('Downloading recorded file:', recordingData.filename);
      
      // Create download URL
      const url = URL.createObjectURL(recordingData.blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = recordingData.filename;
      a.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up URL
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      console.log('Download initiated successfully');
      
    } catch (error) {
      console.error('Failed to download recording:', error);
      throw error;
    }
  }, []);

  // Clean up resources
  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
    setRecordingSize(0);
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    recordingDuration: formatDuration(recordingDuration),
    recordingSize: formatSize(recordingSize),
    startRecording,
    stopRecording,
    downloadRecording,
    cleanup,
    canRecord: !!window.MediaRecorder,
    bitRate: MP3_CONFIG.bitRate + 'kbps'
  };
};

export default useStreamRecorder;