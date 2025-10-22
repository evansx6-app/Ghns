import React, { useState, useEffect } from 'react';
import { Timer, X, Play, Pause } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Progress } from './ui/progress';
import { sleepTimerOptions } from '../mock';

const SleepTimer = ({ audioRef, onClose, carMode = false }) => {
  const [selectedTime, setSelectedTime] = useState(30);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [fadeOut, setFadeOut] = useState(true);
  const [originalVolume, setOriginalVolume] = useState(1);

  useEffect(() => {
    let interval = null;
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prevTime => {
          const newTime = prevTime - 1;
          
          // Start fade out in the last 30 seconds if fade out is enabled
          if (fadeOut && newTime <= 30 && audioRef.current) {
            const fadeVolume = (newTime / 30) * originalVolume;
            audioRef.current.volume = Math.max(0, fadeVolume);
          }
          
          // Stop audio when timer reaches 0
          if (newTime <= 0) {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.volume = originalVolume;
            }
            setIsActive(false);
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    } else if (!isActive && timeLeft !== 0) {
      clearInterval(interval);
    }
    
    return () => clearInterval(interval);
  }, [isActive, timeLeft, fadeOut, originalVolume, audioRef]);

  const startTimer = () => {
    if (audioRef.current) {
      setOriginalVolume(audioRef.current.volume);
    }
    setTimeLeft(selectedTime * 60);
    setIsActive(true);
  };

  const pauseTimer = () => {
    setIsActive(false);
  };

  const stopTimer = () => {
    setIsActive(false);
    setTimeLeft(0);
    if (audioRef.current) {
      audioRef.current.volume = originalVolume;
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (selectedTime * 60 === 0) return 0;
    return ((selectedTime * 60 - timeLeft) / (selectedTime * 60)) * 100;
  };

  return (
    <Card className="bg-gradient-to-b from-white/15 via-white/10 to-white/5 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-xl sm:rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className={`text-white flex items-center space-x-2 ${carMode ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>
          <Timer className={`${carMode ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-4 w-4 sm:h-5 sm:w-5'}`} />
          <span>Sleep Timer</span>
        </CardTitle>
        <Button
          variant="ghost"
          size={carMode ? "lg" : "sm"}
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 touch-manipulation min-w-[44px] min-h-[44px]"
        >
          <X className={`${carMode ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4'}`} />
        </Button>
      </CardHeader>
      
      <CardContent className={`space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6 ${carMode ? 'text-base sm:text-lg' : ''}`}>
        {/* Timer Display */}
        {timeLeft > 0 && (
          <div className="text-center space-y-3 sm:space-y-4">
            <div className={`${carMode ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'} font-mono text-white`}>
              {formatTime(timeLeft)}
            </div>
            <Progress value={getProgressPercentage()} className={`w-full ${carMode ? 'h-3 sm:h-4' : 'h-2 sm:h-3'}`} />
          </div>
        )}

        {/* Timer Selection */}
        {!isActive && (
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <label className="text-white/70 text-xs sm:text-sm font-medium">Duration</label>
              <Select value={selectedTime.toString()} onValueChange={(value) => setSelectedTime(parseInt(value))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sleepTimerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fade Out Option */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-white/70 text-xs sm:text-sm font-medium">
                Fade out audio gradually
              </label>
              <Switch
                checked={fadeOut}
                onCheckedChange={setFadeOut}
                className="touch-manipulation"
              />
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2 sm:gap-3">
          {!isActive && timeLeft === 0 ? (
            <Button
              onClick={startTimer}
              size={carMode ? "lg" : "default"}
              className="flex-1 transition-all duration-300 touch-manipulation"
              style={{
                background: 'linear-gradient(135deg, rgb(245, 158, 11), rgb(251, 146, 60))'
              }}
            >
              <Play className={`${carMode ? 'h-6 w-6 mr-3' : 'h-4 w-4 mr-2'}`} />
              <span className={carMode ? 'text-lg' : ''}>Start Timer</span>
            </Button>
          ) : (
            <>
              <Button
                onClick={isActive ? pauseTimer : () => setIsActive(true)}
                variant="outline"
                size={carMode ? "lg" : "default"}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 touch-manipulation"
              >
                {isActive ? (
                  <>
                    <Pause className={`${carMode ? 'h-6 w-6 mr-3' : 'h-4 w-4 mr-2'}`} />
                    <span className={carMode ? 'text-lg' : ''}>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className={`${carMode ? 'h-6 w-6 mr-3' : 'h-4 w-4 mr-2'}`} />
                    <span className={carMode ? 'text-lg' : ''}>Resume</span>
                  </>
                )}
              </Button>
              <Button
                onClick={stopTimer}
                variant="outline"
                size={carMode ? "lg" : "default"}
                className="flex-1 bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30 touch-manipulation"
              >
                <span className={carMode ? 'text-lg' : ''}>Stop</span>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SleepTimer;