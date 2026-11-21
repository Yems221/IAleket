// Sert les médias depuis R2 — GET /images/*
// Proxifie les objets R2 (pas besoin d'un domaine R2 public) et gère les
// requêtes HTTP Range, indispensables pour la lecture/le seek des vidéos.
import { Env } from '../_shared';

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const url = new URL(context.request.url);
  const key = url.pathname.replace('/images/', 'uploads/');

  try {
    const range = context.request.headers.get('Range');

    // Requête Range (vidéo qui scrute) : on ne renvoie que le tronçon demandé.
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const head = await context.env.STORAGE.head(key);
        if (!head) return new Response('Not found', { status: 404 });

        const size = head.size;
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : size - 1;

        if (isNaN(start) || start >= size || start > end) {
          return new Response('Range non satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}` },
          });
        }

        const object = await context.env.STORAGE.get(key, {
          range: { offset: start, length: end - start + 1 },
        });
        if (!object) return new Response('Not found', { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
        headers.set('Content-Length', String(end - start + 1));
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(object.body, { status: 206, headers });
      }
    }

    const object = await context.env.STORAGE.get(key);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('etag', object.httpEtag);
    headers.set('Accept-Ranges', 'bytes');

    return new Response(object.body, { headers });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
