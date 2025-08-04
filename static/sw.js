// static/sw.js
const CACHE_NAME = 'darts-cache-2025-08-04-1824';
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
  '/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // немедленно активирует новый SW
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

// период обновления кэша - одни сутки
var MAX_AGE = 86400000;

self.addEventListener('fetch', function(event) {

    event.respondWith(
        // ищем запрошенный ресурс среди закэшированных
        caches.match(event.request).then(function(cachedResponse) {
            var lastModified, fetchRequest;

            // если ресурс есть в кэше
            if (cachedResponse) {
                // получаем дату последнего обновления
                lastModified = new Date(cachedResponse.headers.get('last-modified'));
                // и если мы считаем ресурс устаревшим
                if (lastModified && (Date.now() - lastModified.getTime()) > MAX_AGE) {
                    
                    fetchRequest = event.request.clone();
                    // создаём новый запрос
                    return fetch(fetchRequest).then(function(response) {
                        // при неудаче всегда можно выдать ресурс из кэша
                        if (!response || response.status !== 200) {
                            return cachedResponse;
                        }
                        // обновляем кэш
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, response.clone());
                        });
                        // возвращаем свежий ресурс
                        return response;
                    }).catch(function() {
                        return cachedResponse;
                    });
                }
                return cachedResponse;
            }

            // запрашиваем из сети как обычно
            return fetch(event.request);
        })
    );
});