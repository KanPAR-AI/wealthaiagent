import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Wifi } from 'lucide-react';
// Real PWA registration hook from vite-plugin-pwa.
// The previous in-file mock returned needRefresh=false forever, which meant
// users kept running stale JS until they manually hard-refreshed.
import { useRegisterSW } from 'virtual:pwa-register/react';

// Poll for new SW every 5 minutes — long-lived PWA tabs may never navigate,
// and without an explicit poll the SW only checks on page load.
const SW_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstall: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // PWA update registration
  const {
    needRefresh: [needRefresh, _setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
      // Poll the server every 5 min for an updated SW. With skipWaiting +
      // clientsClaim in vite.config.ts, an update activates immediately and
      // we auto-reload below — so any active user gets the latest UI within
      // ~5 min of a deploy without ever doing a manual hard-refresh.
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => undefined);
      }, SW_UPDATE_INTERVAL_MS);
    },
    onRegisterError(error: unknown) {
      console.warn('SW registration error', error);
    },
  });

  // When a new SW is ready, reload — but politely:
  //   - If tab is in the background, reload immediately.
  //   - If tab is visible, wait until next backgrounding OR 60s, whichever
  //     comes first, so we don't interrupt mid-action.
  useEffect(() => {
    if (!needRefresh) return;
    let done = false;
    const reload = () => {
      if (done) return;
      done = true;
      updateServiceWorker(true);
    };
    if (document.visibilityState === 'hidden') {
      reload();
      return;
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') reload();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const t = setTimeout(reload, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(t);
    };
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    // Check if running on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show install prompt after a delay
      setTimeout(() => {
        if (!localStorage.getItem('pwa-install-dismissed')) {
          setShowInstallPrompt(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (standalone) {
      setShowInstallPrompt(false);
    }

    // Check if update is available
    if (needRefresh) {
      setShowUpdatePrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [needRefresh]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Store dismissal in localStorage to avoid showing again for a while
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const handleUpdateClick = () => {
    updateServiceWorker(true);
    setShowUpdatePrompt(false);
  };

  const handleUpdateDismiss = () => {
    setShowUpdatePrompt(false);
    _setNeedRefresh(false);
  };

  // Don't show if already dismissed recently (within 7 days)
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowInstallPrompt(false);
      }
    }
  }, []);

  // Show update prompt
  if (showUpdatePrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Download className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Update Available
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  A new version of WealthWise AI is ready
                </p>
              </div>
            </div>
            <button
              onClick={handleUpdateDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <button
            onClick={handleUpdateClick}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Update Now</span>
          </button>
        </div>
      </div>
    );
  }

  // Show install prompt
  if (!showInstallPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
              <Smartphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Install WealthWise AI
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {isIOS 
                  ? 'Tap the share button and "Add to Home Screen"'
                  : 'Get quick access and work offline'
                }
              </p>
              {!isOnline && (
                <div className="flex items-center space-x-1 mt-1">
                  <Wifi className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">Offline mode available</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Install App</span>
          </button>
        )}
        
        {isIOS && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
            <p>📱 Add to Home Screen:</p>
            <ol className="mt-1 space-y-1">
              <li>1. Tap the share button in Safari</li>
              <li>2. Scroll down and tap "Add to Home Screen"</li>
              <li>3. Tap "Add" to install</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAInstall;
