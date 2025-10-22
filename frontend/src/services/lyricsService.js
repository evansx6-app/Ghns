class LyricsService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Fetch lyrics for a given artist and title with enhanced error handling
   * @param {string} artist - The artist name
   * @param {string} title - The song title
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Enhanced result object with lyrics and metadata
   */
  async fetchLyrics(artist, title, options = {}) {
    if (!artist || !title) {
      console.warn('Artist and title are required for lyrics lookup');
      return { 
        error: 'Artist and title are required',
        lyrics: null,
        metadata: null 
      };
    }

    // Clean and normalize the search terms
    const cleanArtist = this.cleanSearchTerm(artist);
    const cleanTitle = this.cleanSearchTerm(title);
    const cacheKey = `${cleanArtist}-${cleanTitle}`.toLowerCase();

    // Check cache first
    const cachedResult = this.getCachedLyrics(cacheKey);
    if (cachedResult !== null) {
      console.log('Lyrics found in cache for:', `${artist} - ${title}`);
      if (cachedResult.lyrics) {
        return {
          lyrics: cachedResult.lyrics,
          metadata: {
            source: cachedResult.source || 'cache',
            cached: true,
            searchTerms: `${cleanArtist} - ${cleanTitle}`
          }
        };
      } else {
        return { 
          error: cachedResult.error || 'No lyrics found (cached)',
          lyrics: null,
          metadata: { cached: true }
        };
      }
    }

    const maxRetries = options.maxRetries || 2;
    const retryDelay = options.retryDelay || 1000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for: ${artist} - ${title}`);
          await this.sleep(retryDelay * attempt);
        }
        
        console.log(`Fetching lyrics (attempt ${attempt + 1}) for:`, `${cleanArtist} - ${cleanTitle}`);
        
        // Construct the API URL for our backend
        const url = `${this.baseUrl}/api/lyrics/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(15000) // 15 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success && data.lyrics && data.lyrics.length > 0) {
          const result = {
            lyrics: data.lyrics,
            metadata: {
              source: data.source || 'backend',
              confidence: data.confidence || 0.8,
              searchVariation: data.search_variation || 1,
              searchTerms: data.search_terms || `${cleanArtist} - ${cleanTitle}`,
              cached: false,
              attempts: attempt + 1
            }
          };
          
          this.cacheLyrics(cacheKey, {
            lyrics: data.lyrics,
            source: data.source,
            confidence: data.confidence
          });
          
          console.log('Lyrics fetched successfully for:', `${artist} - ${title}`, 
                     `(source: ${data.source}, variation: ${data.search_variation})`);
          return result;
        } else {
          const errorResult = {
            error: data.error || 'No lyrics found',
            lyrics: null,
            metadata: {
              triedVariations: data.tried_variations,
              triedApis: data.tried_apis,
              errors: data.errors,
              attempts: attempt + 1
            }
          };
          
          // Cache negative results
          this.cacheLyrics(cacheKey, { 
            error: errorResult.error,
            metadata: errorResult.metadata 
          });
          
          console.log('No lyrics found for:', `${artist} - ${title}`, data);
          return errorResult;
        }
      } catch (error) {
        console.error(`Error fetching lyrics (attempt ${attempt + 1}):`, error);
        
        // If this is the last attempt, return error
        if (attempt === maxRetries) {
          const errorResult = {
            error: this.getHumanReadableError(error),
            lyrics: null,
            metadata: {
              networkError: true,
              attempts: attempt + 1,
              lastError: error.message
            }
          };
          
          // Cache network errors for shorter time
          this.cacheLyrics(cacheKey, errorResult, 5 * 60 * 1000); // 5 minutes
          return errorResult;
        }
      }
    }
  }

  /**
   * Convert technical errors to user-friendly messages
   */
  getHumanReadableError(error) {
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network error. Please check your connection.';
    }
    if (error.message.includes('500')) {
      return 'Server error. Please try again later.';
    }
    if (error.message.includes('404')) {
      return 'Lyrics service not available.';
    }
    return 'Failed to fetch lyrics. Please try again.';
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean search terms for better API matching
   */
  cleanSearchTerm(term) {
    return term
      .replace(/\s*\([^)]*\)/g, '') // Remove content in parentheses
      .replace(/\s*\[[^\]]*\]/g, '') // Remove content in square brackets
      .replace(/feat\.?\s+.*/i, '') // Remove featuring artists
      .replace(/\s*-\s*.*$/, '') // Remove everything after dash (often remixes)
      .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Simplify title for fallback searches
   */
  simplifyTitle(title) {
    return title
      .split('(')[0]
      .split('-')[0]
      .split('feat')[0]
      .trim();
  }

  /**
   * Process lyrics text for karaoke display
   */
  processLyrics(lyricsText) {
    if (!lyricsText) return null;

    // Split into lines and clean up
    const lines = lyricsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.match(/^\[.*\]$/)) // Remove [Verse], [Chorus] markers
      .map(line => ({
        text: line,
        id: Math.random().toString(36).substr(2, 9)
      }));

    return lines;
  }

  /**
   * Get cached lyrics with custom expiry support
   */
  getCachedLyrics(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const { data, timestamp, expiry } = cached;
    const effectiveExpiry = expiry || this.cacheExpiry;
    
    if (Date.now() - timestamp > effectiveExpiry) {
      this.cache.delete(cacheKey);
      return null;
    }

    return data;
  }

  /**
   * Cache lyrics with custom expiry
   */
  cacheLyrics(cacheKey, lyrics, customExpiry = null) {
    this.cache.set(cacheKey, {
      data: lyrics,
      timestamp: Date.now(),
      expiry: customExpiry || this.cacheExpiry
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Create singleton instance
const lyricsService = new LyricsService();

export default lyricsService;