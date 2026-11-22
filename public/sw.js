// leketia — service worker (repris de HomeBoard)
// 1. Reçoit le partage Android (POST /share-target) directement sur l'appareil.
// 2. Garde l'app utilisable hors ligne. App (HTML/JS/CSS) : réseau d'abord, pour que
//    les mises à jour arrivent tout de suite. Icônes : cache d'abord.
importScripts('/idb.js');

const CACHE_NAME = 'leketia-v11';
const STATIC_ASSETS = [
  '/',
  '/app.css',
  '/app.js',
  '/store.js',
  '/idb.js',
  '/drive.js',
  '/install-parcours.js',
  '/install.js',
  '/share-codec.mjs',
  '/vendor/qrcode.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const MEDIA_MAX = { image: 15 * 1024 * 1024, video: 100 * 1024 * 1024 };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {
      // Un fichier manquant ne doit pas empêcher l'installation.
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(receiveShare(event.request));
    return;
  }
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // aperçus : toujours le réseau, jamais de cache
  if (url.pathname === '/b') return; // board partagé : page du serveur, jamais mise en cache à la place de l'app

  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

// 1re adresse http(s) d'un texte (les applis mettent souvent le lien dans "text").
function firstUrl(text) {
  const m = String(text || '').match(/https?:\/\/\S+/);
  return m ? m[0] : '';
}

// Partage reçu : un fichier est gardé sur l'appareil, un lien est passé à l'app par l'adresse.
async function receiveShare(request) {
  const home = (query = '') => Response.redirect('/' + query, 303);
  try {
    const form = await request.formData();
    const file = form.get('media');
    if (file && file.size > 0) {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : '';
      if (kind && file.type !== 'image/svg+xml' && file.size <= MEDIA_MAX[kind]) {
        const id = await idbSaveMedia(file, kind);
        return home(`?share_media=${id}&share_kind=${kind}`);
      }
    }
    const title = String(form.get('title') || '');
    const text = String(form.get('text') || '');
    const url = String(form.get('url') || '').trim() || firstUrl(text) || firstUrl(title);
    if (url) {
      let q = `?share_url=${encodeURIComponent(url)}`;
      if (title && !firstUrl(title)) q += `&share_title=${encodeURIComponent(title)}`;
      return home(q);
    }
    if (text.trim()) return home(`?share_text=${encodeURIComponent(text.trim().slice(0, 500))}`);
    return home();
  } catch {
    return home(); // ne jamais afficher une page cassée après un partage
  }
}

// Ne met en cache qu'une réponse du bon type : pendant un déploiement, l'hébergeur peut
// renvoyer la page HTML à la place d'un script, ce qui casserait l'app durablement.
function cacheable(request, response) {
  if (!response.ok) return false;
  const type = response.headers.get('content-type') || '';
  const path = new URL(request.url).pathname;
  if (path.endsWith('.js') || path.endsWith('.mjs')) return type.includes('javascript');
  if (path.endsWith('.css')) return type.includes('css');
  if (path.endsWith('.png')) return type.includes('image/');
  return true;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (cacheable(request, response)) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Hors ligne', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (cacheable(request, response)) {
      // La page est gardée sous "/" : /add et /?share_… rouvrent la même app hors ligne.
      cache.put(request.mode === 'navigate' ? '/' : request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request.mode === 'navigate' ? '/' : request, { ignoreSearch: true });
    if (cached) return cached;
    return new Response('Hors ligne', { status: 503 });
  }
}
