import React, { useState, useEffect, useRef } from 'react';
import { Music, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import lyricsService from '../services/lyricsService';

const LyricsDisplay = ({ currentTrack, carMode = false, colors, onClose }) => {
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const lyricsContainerRef = useRef(null);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (currentTrack?.title && currentTrack?.artist) {
      fetchLyrics(currentTrack.artist, currentTrack.title);
    }
  }, [currentTrack?.title, currentTrack?.artist]);

  // Manual lyrics navigation only - auto-scroll removed

  // Manual scroll only - automatic scrolling removed

  const fetchLyrics = async (artist, title) => {
    setLoading(true);
    setError(null);
    setLyrics(null);
    setCurrentLineIndex(0);

    try {
      const result = await lyricsService.fetchLyrics(artist, title);
      
      if (result.lyrics && result.lyrics.length > 0) {
        setLyrics(result.lyrics);
        
        // Log metadata for debugging
        if (result.metadata) {
          console.log('Lyrics metadata:', result.metadata);
          
          // Show success message if version-specific search was used
          if (result.metadata.searchVariation > 1) {
            console.log(`Found lyrics using search variation ${result.metadata.searchVariation}: "${result.metadata.searchTerms}"`);
          }
        }
      } else {
        // Enhanced error messages based on the type of failure
        let errorMessage = 'No lyrics found for this song';
        
        if (result.metadata?.networkError) {
          errorMessage = result.error || 'Network error. Please try again.';
        } else if (result.metadata?.triedApis && result.metadata.triedApis.length > 0) {
          errorMessage = `No lyrics found after searching ${result.metadata.triedApis.length} sources`;
          if (result.metadata.triedVariations > 1) {
            errorMessage += ` with ${result.metadata.triedVariations} different search terms`;
          }
        } else {
          errorMessage = result.error || errorMessage;
        }
        
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Error fetching lyrics:', err);
      setError('Failed to load lyrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (currentTrack?.title && currentTrack?.artist) {
      fetchLyrics(currentTrack.artist, currentTrack.title);
    }
  };

  const handleLineClick = (index) => {
    setCurrentLineIndex(index);
  };

  if (loading) {
    return (
      <Card className="premium-container-strong mx-auto rounded-xl sm:rounded-2xl md:rounded-3xl">
        <CardContent className={`${carMode ? 'p-6 sm:p-8' : 'p-4 sm:p-6'} text-center`}>
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            <Loader2 className={`${carMode ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-5 w-5 sm:h-6 sm:w-6'} animate-spin text-white/70`} />
            <p className={`${carMode ? 'text-base sm:text-lg' : 'text-sm sm:text-base'} text-white/70`}>
              Loading lyrics...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="premium-container-strong mx-auto rounded-xl sm:rounded-2xl md:rounded-3xl">
        <CardContent className={`${carMode ? 'p-6 sm:p-8' : 'p-4 sm:p-6'} text-center`}>
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            <AlertCircle className={`${carMode ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-5 w-5 sm:h-6 sm:w-6'} text-copper-400`} />
            <p className={`${carMode ? 'text-base sm:text-lg' : 'text-sm sm:text-base'} text-white/70`}>
              {error}
            </p>
            <Button
              onClick={handleRetry}
              variant="outline"
              size={carMode ? "lg" : "default"}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 touch-manipulation min-h-[44px]"
            >
              <RefreshCw className={`${carMode ? 'h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3' : 'h-4 w-4 mr-2'}`} />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="premium-container-strong mx-auto rounded-xl sm:rounded-2xl md:rounded-3xl">
      <CardHeader className={`${carMode ? 'pb-3 sm:pb-4' : 'pb-2 sm:pb-3'} border-b border-white/10 px-4 sm:px-6 pt-4 sm:pt-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Music className={`${carMode ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4 sm:h-5 sm:w-5'} text-white/70`} />
            <CardTitle className={`${carMode ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'} font-semibold text-white`}>
              Lyrics
            </CardTitle>
          </div>
          <div className="flex items-center">
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10 min-w-[44px] min-h-[44px] touch-manipulation"
            >
              ✕
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className={`${carMode ? 'p-4 sm:p-6' : 'p-3 sm:p-4'} max-h-80 sm:max-h-96 overflow-y-auto`}>
        {lyrics && lyrics.length > 0 ? (
          <div 
            ref={lyricsContainerRef}
            className="space-y-3"
            style={{
              scrollBehavior: 'smooth'
            }}
          >
            {lyrics.map((line, index) => (
              <div
                key={line.id}
                data-line-index={index}
                onClick={() => handleLineClick(index)}
                className={`
                  transition-all duration-500 cursor-pointer rounded-lg px-3 py-2
                  ${index === currentLineIndex 
                    ? 'text-white font-medium transform scale-105' 
                    : index < currentLineIndex 
                      ? 'text-white/40' 
                      : 'text-white/70 hover:text-white/90'
                  }
                  ${carMode ? 'text-base sm:text-lg leading-relaxed' : 'text-sm sm:text-base leading-relaxed'}
                `}
                style={{
                  backgroundColor: index === currentLineIndex 
                    ? `${colors?.primary || '#B87333'}20`
                    : 'transparent',
                  borderLeft: index === currentLineIndex 
                    ? `3px solid ${colors?.primary || '#B87333'}`
                    : 'none',
                  textShadow: index === currentLineIndex 
                    ? `0 0 10px ${colors?.primary || '#B87333'}40`
                    : 'none'
                }}
              >
                {line.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Music className={`${carMode ? 'h-12 w-12' : 'h-8 w-8'} mx-auto mb-4 text-white/40`} />
            <p className={`${carMode ? 'text-lg' : 'text-base'} text-white/60`}>
              No lyrics available for this song
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LyricsDisplay;