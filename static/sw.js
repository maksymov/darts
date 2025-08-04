// static/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('darts-cache').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/static/jquery-3.7.0.min.js',
        '/static/fontawesome/all.min.js',
        '/static/bootstrap/bootstrap.bundle.min.js',
        '/static/script.js',
        '/static/style.css',
        '/static/img/icon-192x192.png',
        '/static/img/icon-512x512.png'
      ]);
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