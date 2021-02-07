var CACHE_NAME = 'test-cache';
var urlsToCache = [
  // '/',
  // '/styles/main.css',
  // '/script/main.js'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil((async () => {
    let cache = await caches.open(CACHE_NAME);
    console.log('Opened cache');
    return await cache.addAll(urlsToCache);
  })());
});

self.addEventListener('fetch', function(event) {
  event.respondWith((async () => {
    let response = await caches.match(event.request);
    if (response) {
      console.log('cached response', response);
      return response;
    }
    console.log('event', event);
    let fetched = await fetch(event.request);
    console.log('fetched response', fetched);
    return fetched;
  })());
});
