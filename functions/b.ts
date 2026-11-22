// Board partagé — GET /b?d=…
// Le contenu entier est dans le lien. Le serveur le décode et l'affiche, sans rien garder :
// ni base, ni fichier, ni journal. Lisible par un humain (page HTML) et par un agent IA
// (même page en texte, ou en Markdown avec ?format=md ou l'en-tête Accept: text/markdown).
import { decode, toMarkdown, isExpired } from '../public/share-codec.mjs';
import { htmlPage, boardCards, countLabel, escHtml, PAGE_HEADERS, isIos, iosBridge, lockedPage, expiredPage } from './_board-page';
import { withView, type TelemetryEnv } from './_telemetry';

type Ctx = { request: Request; env: TelemetryEnv; waitUntil?: (p: Promise<unknown>) => void };

// Chaque vue est comptée (type de lecteur, format), sans rien garder sur la personne : voir functions/_telemetry.ts.
export const onRequestGet = withView<Ctx>('b', handle);

async function handle(context: Ctx): Promise<Response> {
  const url = new URL(context.request.url);
  // Partage protégé (?e=…) : le serveur ne peut ni le lire ni le résumer, il sert seulement la page qui demande le mot de passe.
  const e = url.searchParams.get('e') || '';
  if (e) {
    if (!/^[A-Za-z0-9_-]{60,20000}$/.test(e)) return htmlPage({ title: 'Partage illisible', description: 'Lien incomplet', origin: url.origin, status: 400, body: `<h1>Partage illisible</h1><p class="meta">Le lien a peut-être été coupé en le copiant.</p>` });
    if (url.searchParams.get('format') === 'md') return new Response('Ce partage est protégé par un mot de passe : ouvre-le dans un navigateur.\n', { status: 403, headers: { ...PAGE_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'text/markdown; charset=utf-8' } });
    return lockedPage({ origin: url.origin, sealed: e, kind: 'link' });
  }
  const d = url.searchParams.get('d') || '';
  let board;
  try {
    board = await decode(d);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lien de partage illisible';
    return htmlPage({ title: 'Partage illisible', description: msg, origin: url.origin, status: 400,
      body: `<h1>Partage illisible</h1><p class="meta">${escHtml(msg)}. Le lien a peut-être été coupé en le copiant.</p>` });
  }

  if (isExpired(board)) return url.searchParams.get('format') === 'md'
    ? new Response('Ce partage a expiré.\n', { status: 410, headers: { ...PAGE_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'text/markdown; charset=utf-8' } })
    : expiredPage(url.origin);
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
<p class="meta">${countLabel(n)}${board.date ? `, partagé le ${escHtml(board.date)}` : ''}${board.expires ? `, visible jusqu'au ${escHtml(new Date(board.expires).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))}` : ''}. Ce partage n'est stocké nulle part : tout son contenu est dans le lien.</p>
${isIos(context.request.headers.get('User-Agent') || '') ? iosBridge(`${url.origin}/b?d=${d}`) : ''}<div class="actions"><a class="btn primary" href="/?import=${encodeURIComponent(d)}">Ajouter à mon journal leketia</a><a class="btn ghost" href="${escHtml(mdUrl)}">Version texte (Markdown)</a></div>
${boardCards(board)}`,
  });
}
