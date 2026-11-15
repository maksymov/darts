const CACHE_NAME = 'darts-beta-cache-2026-11-15-player-stats-v60';
const urlsToCache = [
  './', './index.html', './static/game.js', './static/match-extras.js', './static/match-card.js', './static/script.js', './static/style.css',
  './static/manifest.json', './static/img/icon-192x192.png',
  './static/img/icon-512x512.png', './static/img/apple-touch-icon.png',
  './static/img/ishak2.png', './favicon.ico'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache.map(url => new Request(url, {cache:'reload'})))));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('darts-beta-cache-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Keep the installed HTML, JS and CSS together until a full update is cached.
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  const isAppPage = event.request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  event.respondWith(caches.open(CACHE_NAME).then(cache =>
    cache.match(isAppPage ? scope.href : event.request).then(cached => cached || fetch(event.request))
  ));
});
