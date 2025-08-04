// static/sw.js
const CACHE_NAME = 'darts-cache-2025-08-04-1754';
const urlsToCache = [
  '/',
  '/static/script.js',
  '/static/style.css',
  '/static/jquery-3.7.0.min.js',
  '/static/fontawesome/all.min.js',
  '/static/bootstrap/bootstrap.bundle.min.js',
  '/static/bootstrap/scss/bootstrap.css',
  '/static/manifest.json',
  '/static/img/apple-touch-icon.png',
  '/static/img/write.png',
  '/static/img/donate.png',
  '/static/img/light.svg',
  '/static/img/dark.svg',
  '/static/img/auto.svg',
  '/static/img/status.svg',
  '/static/img/icon-192x192.png',
  '/static/img/icon-512x512.png',

];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // немедленно активирует новый SW
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key)) // удаляет старые кэши
      );
    })
    .then(() => self.clients.claim()) // захватывает страницы
  );
});