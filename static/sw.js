// static/sw.js
const CACHE_NAME = 'darts-cache-v2';
const urlsToCache = [
  '/',
  '/static/jquery-3.7.0.min.js',
  '/static/fontawesome/all.min.js',
  '/static/bootstrap/bootstrap.bundle.min.js',
  '/static/script.js',
  '/static/style.css',
  '/static/bootstrap/scss/bootstrap.css',
  '/static/manifest.json',
  '/static/img/apple-touch-icon.png',
  '/static/img/write.png',
  '/static/img/donate.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
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