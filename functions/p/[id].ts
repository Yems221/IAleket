// Page publiée — GET /p/<id>
// Le contenu vit dans un fichier public du Google Drive de son auteur (<id> = identifiant du fichier).
// Ce serveur sert de passe-plat : il lit le fichier, l'affiche dans l'interface leketia, et ne garde rien
// (seule une mémoire de passage de quelques minutes évite de solliciter le Drive à chaque visite).
// Formats : page HTML déjà remplie (humains, agents IA, aperçus WhatsApp), ?format=md (texte), ?format=json (import).
import { fromPage, toMarkdown, MAX_PAGE_BYTES } from '../../public/share-codec.mjs';
import { guardedFetch, readCapped } from '../_shared';
import { htmlPage, boardCards, countLabel, escHtml, PAGE_HEADERS, isIos, iosBridge } from '../_board-page';

const FRESH_SECONDS = 120; // délai maximal avant qu'une mise à jour de l'auteur soit visible

class Gone extends Error {}

async function readFromDrive(id: string, origin: string) {
  const key = new Request(`${origin}/__drive-page/${id}`);
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  let res = cache ? await cache.match(key).catch(() => undefined) : undefined;
  if (!res) {
    const fresh = await guardedFetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`, { Accept: 'application/json' }, 10000);
    if (!fresh || !fresh.ok) throw new Gone();
    const bytes = await readCapped(fresh, MAX_PAGE_BYTES);
    if (!bytes) throw new Gone();
    res = new Response(bytes, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${FRESH_SECONDS}` } });
    if (cache) await cache.put(key, res.clone()).catch(() => {});
  }
  let raw;
  try { raw = JSON.parse(await res.text()); } catch { throw new Gone(); } // fichier privé ou retiré : Google renvoie une page de connexion
  try { return fromPage(raw); } catch { throw new Gone(); }
}

export async function onRequestGet(context: { request: Request; params: { id: string } }): Promise<Response> {
  const url = new URL(context.request.url);
  const id = String(context.params.id || '');
  const gone = () => htmlPage({ title: 'Page introuvable', description: 'Cette page n’est plus publiée.', origin: url.origin, status: 404,
    body: `<h1>Cette page n'est plus publiée</h1><p class="meta">Son auteur l'a peut-être retirée, ou le lien est incomplet.</p><div class="actions"><a class="btn primary" href="/">Découvrir leketia</a></div>` });
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(id)) return gone();

  let board;
  try { board = await readFromDrive(id, url.origin); } catch { return gone(); }

  const format = url.searchParams.get('format') || (/text\/markdown/.test(context.request.headers.get('Accept') || '') ? 'md' : '');
  if (format === 'md') {
    return new Response(toMarkdown(board, { source: `${url.origin}/p/${id}` }), { headers: { ...PAGE_HEADERS, 'Cache-Control': `public, max-age=${FRESH_SECONDS}`, 'Content-Type': 'text/markdown; charset=utf-8' } });
  }
  if (format === 'json') {
    return new Response(JSON.stringify(board), { headers: { ...PAGE_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } });
  }

  const n = board.links.length;
  const canonical = `${url.origin}/p/${id}`;
  return htmlPage({
    title: board.name, origin: url.origin, canonical, cache: `public, max-age=${FRESH_SECONDS}`,
    description: `${countLabel(n)} — page publiée avec leketia`,
    extraHead: `<link rel="alternate" type="text/markdown" href="/p/${id}?format=md">`,
    body: `<h1>${escHtml(board.name)}</h1>
<p class="meta">${countLabel(n)}${board.date ? `, mis à jour le ${escHtml(board.date)}` : ''}. Page publiée par son auteur depuis son Google Drive.</p>
${isIos(context.request.headers.get('User-Agent') || '') ? iosBridge(canonical) : ''}<div class="actions"><a class="btn primary" href="/?import_page=${id}">Ajouter à mon journal leketia</a><a class="btn ghost" href="/p/${id}?format=md">Version texte (Markdown)</a></div>
${boardCards(board)}`,
  });
}
