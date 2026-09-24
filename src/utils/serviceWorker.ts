// Service Worker registration helper
export function registerExamServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  // In development, actively unregister any existing service workers and clear cache to prevent stale chunk conflicts
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});

    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key).catch(() => {});
        }
      }).catch(() => {});
    }
    return Promise.resolve(null);
  }

  // Register in production for offline exam resilience
  return navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      console.log("[CBT ServiceWorker] Registered successfully with scope:", registration.scope);

      // Check for updates
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                console.log("[CBT ServiceWorker] New update available, activating immediately...");
                installingWorker.postMessage({ type: "SKIP_WAITING" });
              } else {
                console.log("[CBT ServiceWorker] App ready for offline exam use.");
              }
            }
          };
        }
      };

      return registration;
    })
    .catch((err) => {
      console.warn("[CBT ServiceWorker] Registration skipped or failed:", err);
      return null;
    });
}
