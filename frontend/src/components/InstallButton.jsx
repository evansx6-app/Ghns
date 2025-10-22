import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';

const InstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Enhanced app installation detection for multiple platforms
    const checkIfInstalled = () => {
      // Check for PWA standalone mode (most reliable)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
      }
      
      // Check for iOS Safari standalone mode
      if (window.navigator.standalone === true) {
        return true;
      }
      
      // Check for Android WebAPK or TWA
      if (document.referrer.startsWith('android-app://')) {
        return true;
      }
      
      // Check for Samsung Internet PWA
      if ('samsung' in window.navigator && window.navigator.samsung.app) {
        return true;
      }
      
      // Additional check for installed PWA context
      if (window.location.search.includes('utm_source=pwa')) {
        return true;
      }
      
      return false;
    };

    if (checkIfInstalled()) {
      setIsInstalled(true);
      console.log('Greatest Hits Non-Stop: App is already installed');
      return;
    }

    console.log('Greatest Hits Non-Stop: App not installed, showing install prompt');

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setIsInstalled(true);
      toast({
        title: "🎵 App Installed!",
        description: "Greatest Hits Non-Stop has been added to your home screen",
      });
      
      // Clear dismissal flag since user installed
      localStorage.removeItem('installPromptDismissed');
    };

    // iOS Safari specific detection
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && window.navigator.standalone;
    
    setIsIOS(isIOSDevice);
    
    if (isIOSDevice && !isInStandaloneMode) {
      // For iOS, we need to show custom install instructions
      setShowInstallButton(true);
      console.log('iOS device detected - showing install button');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    // For iOS, show instructions modal
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback: Show generic instructions
      toast({
        title: "Install App",
        description: "Use your browser's menu to add this app to your home screen",
      });
      return;
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const result = await deferredPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        toast({
          title: "Installing...",
          description: "Adding Greatest Hits Non-Stop to your home screen",
        });
      } else {
        toast({
          title: "Installation Cancelled",
          description: "You can install the app anytime from the browser menu",
        });
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null);
      setShowInstallButton(false);
    } catch (error) {
      console.error('Error during installation:', error);
      toast({
        title: "Installation Error",
        description: "Please try installing from your browser menu",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
    // Set a flag in localStorage to remember user dismissed it
    localStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already installed or user dismissed it
  if (isInstalled || !showInstallButton) {
    return null;
  }

  // Check if user previously dismissed
  if (localStorage.getItem('installPromptDismissed') === 'true') {
    return null;
  }

  return (
    <>
      {/* iOS Installation Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 px-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Close button */}
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* App Logo */}
            <div className="flex justify-center mb-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png"
                alt="Greatest Hits Non-Stop"
                className="w-20 h-20 object-contain drop-shadow-2xl"
              />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              Install Greatest Hits Non-Stop
            </h2>
            <p className="text-white/60 text-center text-sm mb-6">
              Add to your home screen for the best experience
            </p>

            {/* Instructions */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="text-white text-sm">
                    Tap the <span className="font-semibold text-blue-400">Share</span> button 
                    <svg className="inline-block w-5 h-5 mx-1 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                    </svg>
                    in Safari
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="text-white text-sm">
                    Scroll down and tap <span className="font-semibold text-amber-400">"Add to Home Screen"</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="text-white text-sm">
                    Tap <span className="font-semibold text-green-400">"Add"</span> to confirm
                  </p>
                </div>
              </div>
            </div>

            {/* Got it button */}
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="mt-6 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-3 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
        {/* Install Button */}
        <div className="relative group">
        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-red-500/80 hover:bg-red-500 backdrop-blur-sm border border-white/20 p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg"
        >
          <X className="h-4 w-4 text-white" />
        </Button>

        {/* Main install button with enhanced styling */}
        <Button
          onClick={handleInstallClick}
          className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-400/30 via-orange-400/20 to-amber-500/30 backdrop-blur-xl border-2 border-white/40 shadow-2xl hover:shadow-amber-500/50 hover:scale-110 hover:rotate-12 transition-all duration-500 p-0 group relative overflow-hidden"
        >
          {/* Animated background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-300/20 via-orange-300/10 to-amber-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
          
          {/* App Logo */}
          <div className="relative z-10">
            <img 
              src="https://customer-assets.emergentagent.com/job_sleep-timer-stream/artifacts/qcvmvlox_cropped-radio.png"
              alt="Install Greatest Hits Non-Stop"
              className="w-12 h-12 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-300"
            />
            
            {/* Enhanced install indicator with bouncing animation */}
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full w-6 h-6 flex items-center justify-center shadow-xl animate-bounce">
              <Download className="w-3.5 h-3.5 text-white drop-shadow-sm" />
            </div>
          </div>
        </Button>

        {/* Enhanced tooltip with app branding */}
        <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform translate-y-2 group-hover:translate-y-0">
          <div className="bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-sm shadow-2xl border border-white/10">
            <div className="font-semibold text-amber-300">Install App</div>
            <div className="text-xs text-white/80 mt-1">Add to Home Screen</div>
            <div className="absolute top-full right-6 w-0 h-0 border-l-6 border-l-transparent border-r-6 border-r-transparent border-t-6 border-t-slate-900/95"></div>
          </div>
        </div>
      </div>

      {/* Enhanced pulsing effect with multiple layers */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 animate-ping -z-10 scale-110"></div>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300/10 to-orange-400/10 animate-pulse -z-20 scale-125"></div>
      </div>
    </>
  );
};

export default InstallButton;