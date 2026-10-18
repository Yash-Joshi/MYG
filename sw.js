/* GymBoy service worker – makes the app load instantly and work offline in the gym.
 * Bump CACHE whenever you change any file below so phones pick up the update. */
const CACHE = 'gymboy-v6';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/data.js',
  'js/ui.js',
  'js/store.js',
  'js/demo.js',
  'js/howto-strength.js',
  'js/howto-move.js',
  'js/howto.js',
  'js/flow-data.js',
  'js/flows.js',
  'js/voice.js',
  'js/profile-utils.js',
  'js/sample-report.js',
  'js/backend.js',
  'js/report-view.js',
  'js/screens-account.js',
  'js/screens-home.js',
  'js/screens-scan.js',
  'js/app.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first (instant, even on weak gym Wi-Fi), refreshing the cache in the
// background so the next launch picks up any new version of the app.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // the API (config, scan analysis) must always come from the network
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match('index.html'));
      return hit || refresh;
    })
  );
});
