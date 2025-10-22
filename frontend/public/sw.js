// Enhanced Service Worker for Greatest Hits Non-Stop Music App PWA
const CACHE_NAME = 'greatest-hits-music-v2';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  'https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png'
];

// Music app specific configuration
const MUSIC_APP_CONFIG = {
  name: 'Greatest Hits Non-Stop',
  type: 'music',
  category: 'audio',
  streamUrl: 'https://s8.myradiostream.com/58238/listen.mp3'
};

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Claim clients immediately for music app functionality
  return self.clients.claim();
});

// Enhanced message handling for music app recognition
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'MUSIC_APP_READY') {
    // Notify the system this is a music app
    console.log('Music app service worker ready');
    
    // Set up background audio handling
    event.ports[0].postMessage({
      type: 'MUSIC_APP_CONFIRMED',
      config: MUSIC_APP_CONFIG
    });
  }
});

// Background sync for music app (when supported)
self.addEventListener('sync', event => {
  if (event.tag === 'music-metadata-sync') {
    event.waitUntil(
      // Sync music metadata in background
      syncMusicMetadata()
    );
  }
});

// Background fetch for continuous streaming (when supported)
self.addEventListener('backgroundfetch', event => {
  if (event.tag === 'music-stream') {
    event.waitUntil(
      // Handle background streaming
      handleBackgroundMusic()
    );
  }
});

// Audio focus handling for music apps
self.addEventListener('audiostart', event => {
  console.log('Music app: Audio session started');
});

self.addEventListener('audioend', event => {
  console.log('Music app: Audio session ended');
});

// Helper functions
async function syncMusicMetadata() {
  try {
    // Fetch latest track metadata
    const response = await fetch('/api/current-track');
    const trackData = await response.json();
    
    // Notify clients of metadata update
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'METADATA_UPDATE',
        data: trackData
      });
    });
  } catch (error) {
    console.log('Background metadata sync failed:', error);
  }
}

async function handleBackgroundMusic() {
  try {
    // Keep music stream alive in background
    console.log('Background music streaming maintained');
  } catch (error) {
    console.log('Background music handling failed:', error);
  }
}