// sw.js — caché offline básico con actualización en segundo plano
const CACHE_NAME = 'fc-ble-pwa-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
  // Tailwind y Google Fonts se dejan como runtime cache por CORS/CDN
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Estrategia: Cache First para CORE, Network First para el resto
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Sólo GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isCore = CORE_ASSETS.some((a) => url.pathname.endsWith(a.replace('./','/')));

  if (isCore) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Network First con fallback a caché
  event.respondWith(
    fetch(request)
      .then((resp) => {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
        return resp;
      })
      .catch(() => caches.match(request))
  );
});
