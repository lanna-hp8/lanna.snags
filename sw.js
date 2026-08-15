const CACHE_NAME = 'site-snag-register-v9';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './plans/gf.jpg',
  './plans/ff.jpg',
  './plans/sf.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
// Code files that should always be fetched fresh when online — this is the
// actual fix for "won't update": previously EVERYTHING (including these)
// was served cache-first, so relaunching the app kept re-showing the same
// old cached copy regardless of what was live on GitHub Pages.
const NETWORK_FIRST_PATTERNS = [/\.html$/, /\.js$/, /\.json$/, /\/$/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function isNetworkFirst(request){
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return NETWORK_FIRST_PATTERNS.some((re) => re.test(url.pathname));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (isNetworkFirst(event.request)){
    // Code/markup: always try the network first, so a redeploy is visible
    // the very next time you open the app (while still working offline —
    // falls back to whatever was last cached if there's no connection).
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.ok){
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match(event.request))
    );
  } else {
    // Images/icons: rarely change and are large — fine to serve instantly
    // from cache, falling back to network only on a cache miss.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok){
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        });
      })
    );
  }
});
