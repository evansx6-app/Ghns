import React, { useState, useEffect, memo, useRef } from 'react';

const YouTubeVideo = memo(({ track, onClose, onEnded }) => {
  const [videoId, setVideoId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    const searchVideo = async () => {
      if (!track?.title || !track?.artist) {
        setError('No track information available');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Construct search query - explicitly search for official video
        const searchQuery = `${track.artist} ${track.title} official video`;
        
        // YouTube Data API v3 endpoint
        const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
        
        if (!apiKey) {
          setError('YouTube API key not configured. Cannot search for official videos.');
          setIsLoading(false);
          return;
        }

        // Use YouTube Data API to search for video
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=5&key=${apiKey}`
        );

        if (!response.ok) {
          throw new Error('Failed to search YouTube');
        }

        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          // Filter for official videos only
          const officialVideo = data.items.find(item => {
            const title = item.snippet.title.toLowerCase();
            const channelTitle = item.snippet.channelTitle.toLowerCase();
            const description = item.snippet.description.toLowerCase();
            
            // Check if it's an official video based on:
            // 1. Title contains "official" AND ("video" OR "music video")
            // 2. Channel name contains artist name (likely official channel)
            // 3. Channel name contains "VEVO" (official music videos)
            const hasOfficialInTitle = title.includes('official');
            const hasVideoInTitle = title.includes('video') || title.includes('music video');
            const artistNameInChannel = channelTitle.includes(track.artist.toLowerCase());
            const isVevoChannel = channelTitle.includes('vevo');
            
            return (hasOfficialInTitle && hasVideoInTitle) || isVevoChannel || artistNameInChannel;
          });
          
          if (officialVideo) {
            setVideoId(officialVideo.id.videoId);
          } else {
            setError('No official video found for this track');
          }
        } else {
          setError('No official video found for this track');
        }
      } catch (err) {
        console.error('YouTube search error:', err);
        setError('Failed to search for official video');
      } finally {
        setIsLoading(false);
      }
    };

    searchVideo();
  }, [track?.title, track?.artist]);

  // Listen for YouTube player events via postMessage
  useEffect(() => {
    if (!videoId) return;

    const handleMessage = (event) => {
      // Only accept messages from YouTube
      if (event.origin !== 'https://www.youtube.com') return;

      try {
        const data = JSON.parse(event.data);
        
        // YouTube player state: 0 = ended
        if (data.event === 'onStateChange' && data.info === 0) {
          console.log('[YouTube] Video ended - returning to radio');
          if (onEnded) {
            onEnded();
          }
        }
      } catch (err) {
        // Ignore parse errors from non-YouTube messages
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [videoId, onEnded]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-sm">Searching for official video...</p>
        </div>
      </div>
    );
  }

  if (error || !videoId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center p-4 max-w-sm">
          <div className="text-white/50 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-white text-sm mb-4">
            {error || 'No official video available'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Back to Artwork
          </button>
        </div>
      </div>
    );
  }

  // Direct official video embed with enablejsapi for event listening
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;

  return (
    <div className="w-full h-full relative bg-black">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={`${track.artist} - ${track.title} (Official Video)`}
        className="w-full h-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
});

YouTubeVideo.displayName = 'YouTubeVideo';

export default YouTubeVideo;
