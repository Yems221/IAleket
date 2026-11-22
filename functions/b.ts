// Board partagé — GET /b?d=…
// Le contenu entier est dans le lien. Le serveur le décode et l'affiche, sans rien garder :
// ni base, ni fichier, ni journal. Lisible par un humain (page HTML) et par un agent IA
// (même page en texte, ou en Markdown avec ?format=md ou l'en-tête Accept: text/markdown).
import { decode, toMarkdown } from '../public/share-codec.mjs';
import { htmlPage, boardCards, countLabel, escHtml, PAGE_HEADERS } from './_board-page';

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const d = url.searchParams.get('d') || '';
  let board;
  try {
    board = await decode(d);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lien de partage illisible';
    return htmlPage({ title: 'Partage illisible', description: msg, origin: url.origin, status: 400,
      body: `<h1>Partage illisible</h1><p class="meta">${escHtml(msg)}. Le lien a peut-être été coupé en le copiant.</p>` });
  }

  const wantsMd = url.searchParams.get('format') === 'md' || /text\/markdown/.test(context.request.headers.get('Accept') || '');
  if (wantsMd) {
    return new Response(toMarkdown(board, { source: url.origin }), { headers: { ...PAGE_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'text/markdown; charset=utf-8' } });
  }

  const n = board.links.length;
  const mdUrl = `/b?format=md&d=${encodeURIComponent(d)}`;
  return htmlPage({
    title: board.name, origin: url.origin,
    description: `${countLabel(n)} partagé${n > 1 ? 's' : ''} avec leketia`,
    extraHead: `<link rel="alternate" type="text/markdown" href="${escHtml(mdUrl)}">`,
    body: `<h1>${escHtml(board.name)}</h1>
<p class="meta">${countLabel(n)}${board.date ? `, partagé le ${escHtml(board.date)}` : ''}. Ce partage n'est stocké nulle part : tout son contenu est dans le lien.</p>
<div class="actions"><a class="btn primary" href="/?import=${encodeURIComponent(d)}">Ajouter à mon journal leketia</a><a class="btn ghost" href="${escHtml(mdUrl)}">Version texte (Markdown)</a></div>
${boardCards(board)}`,
  });
}
