// static/sw.js
const CACHE_NAME = 'darts-cache-v2'; // ← Обновлённый кэш-ключ
const urlsToCache = [
  '/',
  '/index.html',
  '/static/jquery-3.7.0.min.js',
  '/static/fontawesome/all.min.js',
  '/static/bootstrap/bootstrap.bundle.min.js',
  '/static/script.js',
  '/static/style.css',
  '/static/manifest.json',
  '/static/img/icon-192x192.png',
  '/static/img/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // ← Удаляем старые кэши
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});