// CBT Exam Offline Service Worker
// Ensures students can seamlessly continue taking exams during network disruptions
const CACHE_NAME = 'cbt-exam-v2';

const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache essential app entry shell
      return cache.addAll(STATIC_SHELL).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache shell warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Purging old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST to AI API)
  if (request.method !== 'GET') {
    return;
  }

  // Never intercept Vite dev server, HMR, internal modules, or node_modules
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules') ||
    url.pathname.startsWith('/src') ||
    url.pathname.includes('.vite/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('import')
  ) {
    return;
  }

  // Handle API health requests when offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            status: 'offline',
            offline: true,
            message: 'Aplikasi berjalan dalam mode offline terisolasi.'
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          }
        );
      })
    );
    return;
  }

  // For HTML navigation requests: Network first, fallback to cached /index.html
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match('/index.html');
          if (shell) return shell;
          return caches.match('/');
        })
    );
    return;
  }

  // For static assets (scripts, styles, fonts, images): Cache first with network update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {
            // Offline - cachedResponse is already being returned
          });
        return cachedResponse;
      }

      // Not in cache, fetch from network and store
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[ServiceWorker] Fetch failed for offline request:', request.url, err);
        });
    })
  );
});
