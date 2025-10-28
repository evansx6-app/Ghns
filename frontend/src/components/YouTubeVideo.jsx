import React, { useState, useEffect, memo } from 'react';

const YouTubeVideo = memo(({ track, onClose }) => {
  const [videoId, setVideoId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

        // Construct search query
        const searchQuery = `${track.artist} ${track.title} official music video`;
        
        // YouTube Data API v3 endpoint
        const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
        
        if (!apiKey) {
          // Fallback: Use YouTube search embed with constructed query
          // This will show YouTube's search results as a video
          const encodedQuery = encodeURIComponent(searchQuery);
          // Use a direct embed approach with search query
          setVideoId(`search:${encodedQuery}`);
          setIsLoading(false);
          return;
        }

        // Use YouTube Data API to search for video
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=1&key=${apiKey}`
        );

        if (!response.ok) {
          throw new Error('Failed to search YouTube');
        }

        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          setVideoId(data.items[0].id.videoId);
        } else {
          setError('No video found for this track');
        }
      } catch (err) {
        console.error('YouTube search error:', err);
        // Fallback to search embed
        const searchQuery = `${track.artist} ${track.title} official music video`;
        const encodedQuery = encodeURIComponent(searchQuery);
        setVideoId(`search:${encodedQuery}`);
      } finally {
        setIsLoading(false);
      }
    };

    searchVideo();
  }, [track?.title, track?.artist]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-sm">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error && !videoId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center p-4">
          <p className="text-white mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Back to Artwork
          </button>
        </div>
      </div>
    );
  }

  // Determine embed URL
  let embedUrl;
  if (videoId?.startsWith('search:')) {
    // Fallback: Use YouTube's search results page (not ideal but works without API key)
    const query = videoId.replace('search:', '');
    embedUrl = `https://www.youtube.com/embed?listType=search&list=${query}`;
  } else {
    // Direct video embed
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  }

  return (
    <div className="w-full h-full relative bg-black">
      <iframe
        src={embedUrl}
        title={`${track.artist} - ${track.title}`}
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
