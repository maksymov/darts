const CACHE_NAME = 'darts-cache-2026-11-11-commentary-card-v3';
const urlsToCache = [
  './', './index.html', './static/game.js', './static/match-extras.js', './static/match-card.js', './static/script.js', './static/style.css',
  './static/manifest.json', './static/img/icon-192x192.png',
  './static/img/icon-512x512.png', './static/img/apple-touch-icon.png',
  './static/img/ishak2.png', './favicon.ico'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('darts-cache-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Keep the installed HTML, JS and CSS together until a full update is cached.
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
