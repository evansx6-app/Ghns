import React, { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ModernAudioPlayer from "./components/ModernAudioPlayer";
import { Toaster } from "./components/ui/toaster";

function App() {
  useEffect(() => {
    // Enhanced service worker registration for music app
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Music App SW registered: ', registration);
            
            // Notify service worker this is a music app
            if (registration.active) {
              const channel = new MessageChannel();
              channel.port1.onmessage = function(event) {
                if (event.data.type === 'MUSIC_APP_CONFIRMED') {
                  console.log('Music app recognition confirmed by SW');
                }
              };
              
              registration.active.postMessage({
                type: 'MUSIC_APP_READY'
              }, [channel.port2]);
            }
          })
          .catch(registrationError => {
            console.log('Music App SW registration failed: ', registrationError);
          });
      });
    }

    // Initialize music app features
    const initializeMusicApp = () => {
      try {
        // Set document title for music app recognition
        document.title = 'Greatest Hits Non-Stop - Legendary Radio from Scotland';
        
        // Add music app meta tags dynamically
        const musicAppMeta = document.createElement('meta');
        musicAppMeta.name = 'music-app';
        musicAppMeta.content = 'true';
        document.head.appendChild(musicAppMeta);
        
        // Audio session category for mobile OS
        const audioCategory = document.createElement('meta');
        audioCategory.name = 'audio-session-category';
        audioCategory.content = 'AVAudioSessionCategoryPlayback';
        document.head.appendChild(audioCategory);
        
        // Add structured data for music app
        const structuredData = {
          '@context': 'https://schema.org',
          '@type': 'MusicApplication',
          'name': 'Greatest Hits Non-Stop',
          'applicationCategory': 'MusicApplication',
          'operatingSystem': 'Web',
          'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'GBP'
          }
        };
        
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(structuredData);
        document.head.appendChild(script);
        
        console.log('Music app features initialized');
        
      } catch (error) {
        console.warn('Music app initialization failed:', error);
      }
    };
    
    // Initialize after page load
    if (document.readyState === 'complete') {
      initializeMusicApp();
    } else {
      window.addEventListener('load', initializeMusicApp);
    }

    // Simple branding removal
    const removeBranding = () => {
      try {
        // Remove elements containing branding text
        const elements = document.querySelectorAll('div, span, p');
        elements.forEach(element => {
          const text = element.textContent || element.innerText || '';
          if (text.toLowerCase().includes('made with emergent')) {
            element.style.display = 'none';
          }
        });
      } catch (e) {
        // Ignore errors
      }
    };

    // Run branding removal occasionally
    setTimeout(removeBranding, 2000);
    setTimeout(removeBranding, 5000);
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ModernAudioPlayer />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </div>
  );
}

export default App;