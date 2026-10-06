// sw.js — minimal service worker so Notebook can be installed as a PWA
// on iOS / Android home screens. Strategy:
//   - App shell (HTML/CSS/JS/icons): precached per release, so the app
//     still opens instantly offline and updates itself in the background.
//   - Supabase requests (auth + data): always network, never cached,
//     since bookkeeping data must stay live and correct.
//   - Everything else (CDN libraries, fonts): stale-while-revalidate too,
//     so the app still boots even with a flaky connection.

const CACHE_NAME = 'notebook-shell-v5';

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
  './js/exportPdf.js',
  './js/libraries.js',
  './js/transactions.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('notebook-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const local = url.origin === self.location.origin;
  const cdn = ['cdn.jsdelivr.net', 'unpkg.com', 'esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
  // APIs (including custom Supabase domains) always pass through.
  if (!local && !cdn) return;

  if (local) {
    // Serve one release's precached shell consistently. A new service worker
    // installs the next snapshot and the page reloads when it takes control.
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return fetch(request);
    }));
    return;
  }

  // Revalidate optional CDN libraries in the background, with a live event lifetime.
  const cached = caches.open(CACHE_NAME).then(cache => cache.match(request));
  const network = fetch(request).then(async response => {
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(network.then(() => undefined).catch(() => undefined));
  event.respondWith(cached.then(response => response || network));
});
