// Keeps Math Buddy working offline. Change VERSION (to match js/version.js)
// whenever app files change, so installed copies fetch the new files.
const VERSION = 'math-buddy-1.6.0';
// The Firebase code (js/vendor/firebase.js) isn't listed: it's cached the first time a
// device turns on family sync, so other devices don't download it.
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/cloud-firebase.js',
  'js/config.js',
  'js/explain.js',
  'js/format.js',
  'js/ocr.js',
  'js/parser.js',
  'js/practice.js',
  'js/rational.js',
  'js/solver.js',
  'js/store.js',
  'js/sync.js',
  'js/version.js',
  'js/words.js',
  'js/written.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App files: cached copy first, refreshed in the background.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req, { ignoreSearch: true });
        const fresh = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached || cache.match('index.html'));
        return cached || fresh;
      }),
    );
    return;
  }

  // Fonts: keep a copy so the app looks the same offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(`${VERSION}-fonts`).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
