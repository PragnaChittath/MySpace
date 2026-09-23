/**
 * Service Worker Registration & Lifecycle Management for MySpace
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // In development mode or iframe preview, unregister existing service workers to prevent caching collisions
  const isDev = (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
  if (isDev) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
    return;
  }

  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('🔒 [MySpace] New version available; will activate on next launch.');
                  } else {
                    console.log('🔒 [MySpace] Content cached for offline use (AES-GCM at rest).');
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[MySpace] ServiceWorker registration notice:', error);
        });
    } catch (e) {
      console.warn('[MySpace] ServiceWorker ignored in this environment:', e);
    }
  });
}
