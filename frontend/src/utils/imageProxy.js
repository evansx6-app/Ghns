// Detect Safari browser (including iOS Safari)
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Backend URL from environment
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

/**
 * Get proxied image URL for Safari to avoid CORS issues
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Proxied or original URL
 */
export const getImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  
  // If Safari and URL is from external domain (not our assets), use proxy
  if (isSafari && !imageUrl.includes('customer-assets.emergentagent.com')) {
    // Check if it's a MusicBrainz or external artwork URL
    if (imageUrl.includes('coverartarchive.org') || 
        imageUrl.includes('musicbrainz.org') ||
        imageUrl.startsWith('http')) {
      return `${BACKEND_URL}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    }
  }
  
  return imageUrl;
};

export { isSafari };
