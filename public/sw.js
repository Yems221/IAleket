// HomeBoard Service Worker — PWA offline support
// App shell (HTML/JS/CSS) : network-first → les déploiements se propagent tout de suite.
// Icônes/images : cache-first. API : network-first.

const CACHE_NAME = 'homeboard-v4';
const STATIC_ASSETS = [
  '/',
  '/app.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// Install: pre-cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Don't fail if one asset can't be cached
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API, offline fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't intercept non-GET requests
  if (event.request.method !== 'GET') return;

  // API calls: network-first (always try server, fall back to cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App shell (HTML, JS, CSS, manifest) : network-first pour recevoir les mises à jour.
  // /images/* est exclu : ce sont des médias immuables servis depuis R2 (cache-first).
  if (
    url.pathname === '/' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Autres statiques (icônes, médias) : cache-first
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline: return cached index.html for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/');
      if (fallback) return fallback;
    }
    return new Response('Hors ligne', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('/');
      if (shell) return shell;
    }
    return new Response(JSON.stringify({ ok: false, error: 'Hors ligne' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
