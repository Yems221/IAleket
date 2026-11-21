// PROTOTYPE — le service worker ne fait qu'une chose : recevoir le partage Android
// (POST /share) et l'écrire dans la base locale, sans passer par un serveur.
importScripts('/db.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share') return;

  event.respondWith((async () => {
    const form = await event.request.formData();
    const file = form.get('media');
    const title = String(form.get('title') || '');
    const text = String(form.get('text') || '');
    await addItem({
      url: String(form.get('url') || '').trim() || firstUrl(text) || firstUrl(title),
      titre: title,
      texte: text,
      fichier: file && file.size ? `${file.name} (${file.type}, ${file.size} octets)` : '',
      via: 'Partage Android, reçu par le service worker',
      mode: 'non mesuré (service worker)',
      recuLe: Date.now(),
    });
    return Response.redirect('/?recu=sw', 303);
  })());
});
