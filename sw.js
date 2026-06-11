// ═══════════════════════════════════════════════
// AEROX V2 — SERVICE WORKER
// Version: bump this to force cache refresh
// ═══════════════════════════════════════════════
const CACHE_NAME = 'aerox-v2-v1';

// Files to cache for full offline use
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Chart.js — cache from CDN on first load
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ── INSTALL: cache all assets ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      // Cache local assets strictly, CDN with no-cors
      return Promise.allSettled(
        ASSETS.map(url => {
          if (url.startsWith('http')) {
            return cache.add(new Request(url, { mode: 'no-cors' }));
          }
          return cache.add(url);
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete old caches ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first, fallback to network ────
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache immediately
        // Background-update for html/js files
        if (event.request.url.endsWith('.html') || event.request.url.endsWith('.js')) {
          const networkFetch = fetch(event.request).then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          }).catch(() => {});
        }
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 && response.type !== 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MESSAGE: force update ──────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
