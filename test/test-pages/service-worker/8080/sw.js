const CACHE_NAME = 'test-cache';
const urlsToCache = [
    // '/',
    // '/styles/main.css',
    // '/script/main.js'
];

// eslint-disable-next-line no-restricted-globals
self.addEventListener('install', (event) => {
    // Perform install steps
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
    })());
});

// eslint-disable-next-line no-restricted-globals
self.addEventListener('fetch', (event) => {
    event.respondWith((async () => {
        const response = await caches.match(event.request);
        if (response) {
            console.log('cached response', response);
            return response;
        }
        console.log('event', event);
        const fetched = await fetch(event.request);
        console.log('fetched response', fetched);
        return fetched;
    })());
});
