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

    // Enhanced branding removal
    const removeBranding = () => {
      try {
        // Remove elements containing branding text
        const elements = document.querySelectorAll('*');
        elements.forEach(element => {
          const text = (element.textContent || element.innerText || '').toLowerCase();
          if (text.includes('made with emergent') || 
              text.includes('powered by emergent') ||
              text.includes('emergent agent') ||
              text.includes('built with emergent')) {
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('opacity', '0', 'important');
          }
        });

        // Remove by attribute patterns
        document.querySelectorAll('[class*="emergent"], [id*="emergent"], [data-emergent]').forEach(el => {
          if (!el.className.includes('emergency')) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
          }
        });

        // Remove fixed position elements in bottom right that might be branding
        document.querySelectorAll('div[style*="position: fixed"]').forEach(el => {
          const style = el.getAttribute('style') || '';
          if (style.includes('bottom') && style.includes('right')) {
            const text = (el.textContent || '').toLowerCase();
            if (text.includes('made') || text.includes('powered') || text.includes('emergent')) {
              el.style.setProperty('display', 'none', 'important');
            }
          }
        });
      } catch (e) {
        // Ignore errors
      }
    };

    // Run branding removal multiple times
    setTimeout(removeBranding, 500);
    setTimeout(removeBranding, 1000);
    setTimeout(removeBranding, 2000);
    setTimeout(removeBranding, 5000);
    
    // Observe DOM changes
    const observer = new MutationObserver(removeBranding);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
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