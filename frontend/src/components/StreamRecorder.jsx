import React, { useState } from 'react';
import { Circle, Square, Download, Mic, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import useStreamRecorder from '../hooks/useStreamRecorder';

const StreamRecorder = ({ audioRef, isPlaying }) => {
  const [lastRecording, setLastRecording] = useState(null);
  const [notification, setNotification] = useState(null);
  const [recordingMethod, setRecordingMethod] = useState('stream'); // 'stream' or 'microphone'

  const {
    isRecording,
    isProcessing,
    recordingDuration,
    recordingSize,
    startRecording,
    stopRecording,
    downloadRecording,
    cleanup,
    canRecord,
    bitRate
  } = useStreamRecorder(audioRef, recordingMethod);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleStartRecording = async () => {
    try {
      if (!isPlaying) {
        showNotification('Please start playback before recording', 'warning');
        return;
      }

      // Show loading state
      showNotification('Initializing recording...', 'info');

      await startRecording();
      showNotification('Recording started successfully!', 'success');
    } catch (error) {
      console.error('Recording start failed:', error);
      
      // Provide user-friendly error messages
      let userMessage = 'Failed to start recording';
      
      if (error.message.includes('CORS')) {
        userMessage = 'Recording blocked by stream security. Try using headphones and enable microphone access, or use a different browser.';
      } else if (error.message.includes('not available')) {
        userMessage = 'Audio not available for recording. Please refresh and try again.';
      } else if (error.message.includes('not supported')) {
        userMessage = 'Recording not supported in this browser. Try Chrome or Firefox.';
      } else if (error.message.includes('permission')) {
        userMessage = 'Microphone permission required for recording. Please allow access and try again.';
      } else if (error.message.length > 0) {
        userMessage = error.message;
      }
      
      showNotification(userMessage, 'error');
    }
  };

  const handleStopRecording = async () => {
    try {
      const recordingData = await stopRecording();
      setLastRecording(recordingData);
      showNotification(`Recording saved (${recordingData.size > 1024 * 1024 ? Math.round(recordingData.size / (1024 * 1024)) + 'MB' : Math.round(recordingData.size / 1024) + 'KB'})`, 'success');
    } catch (error) {
      console.error('Recording stop failed:', error);
      showNotification('Failed to stop recording: ' + error.message, 'error');
    }
  };

  const handleDownload = () => {
    try {
      if (lastRecording) {
        downloadRecording(lastRecording);
        showNotification('Download started', 'success');
      }
    } catch (error) {
      console.error('Download failed:', error);
      showNotification('Failed to download: ' + error.message, 'error');
    }
  };

  // Don't render if recording is not supported
  if (!canRecord) {
    return (
      <Card className="bg-transparent border-white/10 rounded-xl sm:rounded-2xl">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm">Recording not supported in this browser</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-transparent border-white/10 rounded-xl sm:rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        {/* Recording Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Record/Stop Button */}
          {!isRecording && !isProcessing ? (
            <Button
              onClick={handleStartRecording}
              disabled={!isPlaying}
              className="flex items-center gap-1.5 sm:gap-2 text-white min-h-[44px] touch-manipulation text-xs sm:text-sm"
              style={{
                backgroundColor: '#ea580c',
                borderColor: '#ea580c'
              }}
              size="sm"
            >
              <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
              <span className="hidden xs:inline">Record MP3</span>
              <span className="xs:hidden">Record</span>
            </Button>
          ) : !isProcessing ? (
            <Button
              onClick={handleStopRecording}
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-600 hover:bg-slate-700 text-white min-h-[44px] touch-manipulation text-xs sm:text-sm"
              size="sm"
            >
              <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              disabled
              className="flex items-center gap-1.5 sm:gap-2 bg-blue-600 text-white opacity-75 text-xs sm:text-sm"
              size="sm"
            >
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing
            </Button>
          )}

          {/* Recording Status */}
          {isRecording && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-red-400">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse" />
                <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <span className="text-[10px] sm:text-sm font-mono">
                {recordingDuration} • {recordingSize}
              </span>
            </div>
          )}

          {/* MP3 Processing Status */}
          {isProcessing && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-blue-400">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[10px] sm:text-sm">
                Converting to MP3 ({bitRate})...
              </span>
            </div>
          )}

          {/* Download Last Recording */}
          {lastRecording && !isRecording && (
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 sm:gap-2 border-slate-600 text-slate-300 hover:bg-slate-700 min-h-[44px] touch-manipulation text-xs sm:text-sm"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Download
            </Button>
          )}
        </div>

        {/* Recording Info */}
        <div className="mt-2 text-[10px] sm:text-xs text-slate-400">
          {!isPlaying && !isRecording && !isProcessing && (
            <span>Start playback to begin MP3 recording at {bitRate}</span>
          )}
          {isPlaying && !isRecording && !lastRecording && !isProcessing && (
            <span>Click record to capture live stream as MP3 ({bitRate})</span>
          )}
          {lastRecording && !isRecording && !isProcessing && (
            <span>Last recording: {lastRecording.filename} ({lastRecording.bitrate || bitRate})</span>
          )}
          {isProcessing && (
            <span>Converting audio to MP3 format at {bitRate}...</span>
          )}
        </div>

        {/* Troubleshooting Help */}
        {!canRecord && (
          <div className="mt-2 p-2 rounded text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800">
            Recording not supported in this browser. Try Chrome or Firefox.
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className={`mt-2 p-2 rounded text-xs flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-800' :
            notification.type === 'warning' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' :
            notification.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-800' :
            'bg-blue-900/30 text-blue-400 border border-blue-800'
          }`}>
            {notification.type === 'success' && <CheckCircle className="h-3 w-3" />}
            {notification.type === 'error' && <AlertCircle className="h-3 w-3" />}
            {notification.type === 'warning' && <AlertCircle className="h-3 w-3" />}
            <span>{notification.message}</span>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default StreamRecorder;