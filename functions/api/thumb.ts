// Miniature d'un lien — GET /api/thumb?url=…
// Le navigateur n'a pas le droit de lire l'image d'un autre site : ce relais la lui transmet,
// sans rien garder. L'app la réduit puis la conserve sur l'appareil.
import { json, sameOrigin, guardedFetch, readCapped } from '../_shared';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp|gif|avif)\b/i; // pas de SVG : il peut contenir du code

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { request } = context;
  if (!sameOrigin(request)) return json({ ok: false, error: 'Demande refusée' }, 403);

  const target = new URL(request.url).searchParams.get('url') || '';
  try {
    const res = await guardedFetch(target, {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
    }, 10000);
    if (!res || !res.ok) return json({ ok: false, error: 'Image indisponible' }, 404);
    const type = res.headers.get('content-type') || '';
    if (!ALLOWED.test(type)) return json({ ok: false, error: 'Ce n’est pas une image' }, 415);
    const bytes = await readCapped(res, MAX_BYTES);
    if (!bytes) return json({ ok: false, error: 'Image trop lourde' }, 413);
    return new Response(bytes, {
      headers: { 'Content-Type': type.split(';')[0], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return json({ ok: false, error: 'Image indisponible' }, 502);
  }
}
