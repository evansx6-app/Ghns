import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Simple cache for API responses
const cache = new Map();
const CACHE_DURATION = 5000; // 5 seconds cache for track data

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
  // Clear old cache entries
  if (cache.size > 50) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
};

// Connection state management
class ConnectionManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.retryQueue = [];
    this.connectionListeners = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseRetryDelay = 1000;
    this.maxRetryDelay = 30000;
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Start connection monitoring
    this.startConnectionMonitoring();
  }
  
  handleOnline() {
    console.log('🌐 Connection restored');
    this.isOnline = true;
    this.reconnectAttempts = 0;
    this.processRetryQueue();
    this.notifyListeners('online');
  }
  
  handleOffline() {
    console.log('📡 Connection lost');
    this.isOnline = false;
    this.notifyListeners('offline');
  }
  
  addConnectionListener(callback) {
    this.connectionListeners.push(callback);
  }
  
  removeConnectionListener(callback) {
    this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
  }
  
  notifyListeners(status) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(status, this.isOnline);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }
  
  async startConnectionMonitoring() {
    // Periodic connectivity check every 30 seconds
    setInterval(async () => {
      if (this.isOnline) {
        try {
          await this.checkConnectivity();
        } catch (error) {
          if (navigator.onLine) {
            console.warn('API connectivity issues detected');
          }
        }
      }
    }, 30000);
  }
  
  async checkConnectivity() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(`${API}/stream/health`, {
        signal: controller.signal,
        method: 'HEAD'
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  addToRetryQueue(request) {
    this.retryQueue.push(request);
  }
  
  async processRetryQueue() {
    while (this.retryQueue.length > 0 && this.isOnline) {
      const request = this.retryQueue.shift();
      try {
        await request.retry();
      } catch (error) {
        console.warn('Retry failed:', error.message);
      }
    }
  }
  
  calculateRetryDelay(attempt) {
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, attempt),
      this.maxRetryDelay
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }
}

// Global connection manager instance
const connectionManager = new ConnectionManager();

// Enhanced axios configuration with retry logic
const apiClient = axios.create({
  baseURL: API,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for connection checking
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching issues
    config.headers['X-Request-Time'] = Date.now();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with intelligent retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Don't retry if already retried max times
    if (originalRequest._retryCount >= 3) {
      console.error('API Error (max retries exceeded):', error.response?.data || error.message);
      return Promise.reject(error);
    }
    
    // Initialize retry count
    originalRequest._retryCount = originalRequest._retryCount || 0;
    
    // Check if error is network related
    const isNetworkError = !error.response || 
                          error.code === 'NETWORK_ERROR' ||
                          error.code === 'ECONNABORTED' ||
                          (error.response && error.response.status >= 500);
    
    if (isNetworkError) {
      originalRequest._retryCount++;
      
      // Calculate delay with exponential backoff
      const delay = connectionManager.calculateRetryDelay(originalRequest._retryCount);
      
      console.warn(`API request failed, retrying in ${delay}ms (attempt ${originalRequest._retryCount}/3)`);
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        return await apiClient(originalRequest);
      } catch (retryError) {
        // If still failing, add to retry queue for when connection is restored
        if (!connectionManager.isOnline) {
          connectionManager.addToRetryQueue({
            retry: () => apiClient(originalRequest)
          });
        }
        throw retryError;
      }
    }
    
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Export connection manager for components to use
export { connectionManager };

export const streamAPI = {
  // Enhanced getCurrentTrack with fallback data (no caching for fresh updates)
  getCurrentTrack: async () => {
    try {
      const response = await apiClient.get('/current-track');
      return response.data;
    } catch (error) {
      // Return fallback data when API is unreachable
      if (!connectionManager.isOnline || error.code === 'NETWORK_ERROR') {
        console.warn('Using fallback track data due to connectivity issues');
        return {
          title: "Greatest Hits Non-Stop",
          artist: "Live Radio Stream",
          album: "Legendary Radio from Scotland",
          isLive: true,
          artwork_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=500&fit=crop&crop=center",
          timestamp: new Date().toISOString(),
          fallback: true
        };
      }
      throw new Error(`Failed to fetch current track: ${error.message}`);
    }
  },

  // Enhanced stream health with offline detection
  getStreamHealth: async () => {
    try {
      const response = await apiClient.get('/stream/health');
      return response.data;
    } catch (error) {
      // Return offline status when API is unreachable
      if (!connectionManager.isOnline || error.code === 'NETWORK_ERROR') {
        return {
          status: 'offline',
          reason: 'No internet connection',
          streamUrl: 'https://s8.myradiostream.com/58238/listen.mp3',
          lastChecked: new Date().toISOString()
        };
      }
      throw new Error(`Failed to check stream health: ${error.message}`);
    }
  },

  // Enhanced metadata refresh with connection checking
  refreshMetadata: async () => {
    try {
      const response = await apiClient.post('/refresh-metadata');
      return response.data;
    } catch (error) {
      if (!connectionManager.isOnline) {
        throw new Error('Cannot refresh metadata: No internet connection');
      }
      throw new Error(`Failed to refresh metadata: ${error.message}`);
    }
  },

  // Enhanced recent tracks with caching
  getRecentTracks: async (limit = 20) => {
    try {
      const response = await apiClient.get(`/recent-tracks?limit=${limit}`);
      
      // Cache successful response
      if (response.data && Array.isArray(response.data)) {
        localStorage.setItem('cached_recent_tracks', JSON.stringify({
          data: response.data,
          timestamp: Date.now()
        }));
      }
      
      return response.data;
    } catch (error) {
      // Try to return cached data if available and not too old (< 1 hour)
      const cached = localStorage.getItem('cached_recent_tracks');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // 1 hour
          console.warn('Using cached recent tracks due to connectivity issues');
          return data;
        }
      }
      
      if (!connectionManager.isOnline) {
        return []; // Return empty array instead of error when offline
      }
      throw new Error(`Failed to fetch recent tracks: ${error.message}`);
    }
  },

  // Enhanced today's tracks with fallback
  getTodaysTracks: async () => {
    try {
      const response = await apiClient.get('/todays-tracks');
      return response.data;
    } catch (error) {
      if (!connectionManager.isOnline) {
        return []; // Return empty array when offline
      }
      throw new Error(`Failed to fetch today's tracks: ${error.message}`);
    }
  },

  // Enhanced clear track history
  clearTrackHistory: async () => {
    try {
      const response = await apiClient.delete('/track-history');
      // Clear cached data too
      localStorage.removeItem('cached_recent_tracks');
      return response.data;
    } catch (error) {
      if (!connectionManager.isOnline) {
        throw new Error('Cannot clear track history: No internet connection');
      }
      throw new Error(`Failed to clear track history: ${error.message}`);
    }
  },

  // New method: Check connection status
  checkConnection: async () => {
    try {
      await connectionManager.checkConnectivity();
      return { connected: true, online: connectionManager.isOnline };
    } catch (error) {
      return { connected: false, online: connectionManager.isOnline, error: error.message };
    }
  }
};

export default apiClient;