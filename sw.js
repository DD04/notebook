// sw.js — minimal service worker so Notebook can be installed as a PWA
// on iOS / Android home screens. Strategy:
//   - App shell (HTML/CSS/JS/icons): stale-while-revalidate, so the app
//     still opens instantly offline and updates itself in the background.
//   - Supabase requests (auth + data): always network, never cached,
//     since bookkeeping data must stay live and correct.
//   - Everything else (CDN libraries, fonts): stale-while-revalidate too,
//     so the app still boots even with a flaky connection.

const CACHE_NAME = 'notebook-shell-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/excel-logo.svg',
  './icons/pdf-logo.svg',
  './js/app.js',
  './js/auth.js',
  './js/storage.js',
  './js/group.js',
  './js/dashboard.js',
  './js/analytics.js',
  './js/budgeting.js',
  './js/settings.js',
  './js/i18n.js',
  './js/config.js',
  './js/exportExcel.js',
  './js/exportPdf.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // Don't block install if one asset fails to precache (e.g. offline first install)
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle simple GETs; let everything else (POST to Supabase, etc.) pass straight through.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Never intercept Supabase traffic — auth/session/data must always hit the network live.
  if (url.hostname.endsWith('supabase.co')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cached);

      // Serve cached shell instantly if we have it, refresh cache in the background.
      return cached || networkFetch;
    })
  );
});
