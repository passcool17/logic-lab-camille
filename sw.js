const CACHE = 'logic-lab-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=ll-v1',
  './js/app.js?v=ll-v1',
  './js/logic.js',
  './favicon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(ASSETS.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch {
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        throw new Error('offline');
      }
    })(),
  );
});
