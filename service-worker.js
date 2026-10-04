const CACHE_NAME = 'classcheck-v10-pwa-20261004';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.html',
  './attendance.html',
  './calendar.html',
  './classes.html',
  './profile.html',
  './reports.html',
  './offline.html',
  './manifest.webmanifest',
  './css/styles.css',
  './css/responsive.css',
  './assets/classcheck-favicon.svg',
  './assets/icons/classcheck-192.png',
  './assets/icons/classcheck-512.png',
  './assets/icons/classcheck-maskable-512.png',
  './assets/icons/classcheck-180.png',
  './js/config.js',
  './js/demo-data.js',
  './js/storage.js',
  './js/offline-db.js',
  './js/supabase-client.js',
  './js/bootstrap.js',
  './js/sync.js',
  './js/app.js',
  './js/auth.js',
  './js/classes.js',
  './js/attendance.js',
  './js/calendar.js',
  './js/reports.js',
  './js/profile.js',
  './js/pwa.js',
  './js/jszip.min.js',
  './js/sf2-template.js',
  './assets/templates/SF2_SOURCE_TEMPLATE.xlsx'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('classcheck-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return response;
        })
        .catch(async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./offline.html')))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const safeCdn = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com';
  if (!sameOrigin && !safeCdn) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: sameOrigin }).then(cached => {
      const network = fetch(req).then(response => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
