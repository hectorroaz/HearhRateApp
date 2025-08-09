/* sw.js — PWA BLE v4.0 para GitHub Pages
   Estrategias:
   - Precarga core (cache-first)
   - Navegación (HTML): network-first con fallback a index.html
   - Runtime (CDNs, fonts, etc.): stale-while-revalidate
*/

const VERSION = 'v4.0.5';
const CACHE_CORE = `fc-ble-core-${VERSION}`;
const CACHE_RUNTIME = `fc-ble-rt-${VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_CORE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_CORE && k !== CACHE_RUNTIME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

const isNavigationRequest = (req) =>
  req.mode === 'navigate' ||
  (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

const isCoreAsset = (url) =>
  CORE_ASSETS.some((p) => {
    try {
      const full = new URL(p, self.registration.scope).href;
      return url.href === full || url.pathname.endsWith(p.replace('./', '/'));
    } catch {
      return false;
    }
  });

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navegación HTML: Network First -> fallback a index.html cacheado
  if (sameOrigin && isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(request);
          if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
            const cache = await caches.open(CACHE_CORE);
            cache.put('./index.html', net.clone());
          }
          return net;
        } catch {
          const cache = await caches.open(CACHE_CORE);
          const cachedIndex =
            (await cache.match('./index.html')) ||
            (await cache.match(self.registration.scope));
          if (cachedIndex) return cachedIndex;
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      })()
    );
    return;
  }

  // Core assets: Cache First
  if (sameOrigin && isCoreAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Runtime: Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_RUNTIME);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((resp) => {
          try { cache.put(request, resp.clone()); } catch {}
          return resp;
        })
        .catch(() => null);

      return cached || (await fetchPromise) || new Response('', { status: 504 });
    })()
  );
});
