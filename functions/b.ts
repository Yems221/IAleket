// Board partagé — GET /b?d=…
// Le contenu entier est dans le lien. Le serveur le décode et l'affiche, sans rien garder :
// ni base, ni fichier, ni journal. Lisible par un humain (page HTML) et par un agent IA
// (même page en texte, ou en Markdown avec ?format=md ou l'en-tête Accept: text/markdown).
import { decode, toMarkdown } from '../public/share-codec.mjs';

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function page(title: string, body: string, status = 200): Response {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(title)} — leketia</title>
<link rel="icon" type="image/svg+xml" href="/brand/leketia-favicon.svg">
<style>
:root{--ink:#1c1917;--muted:#6b6660;--blue:#1F4BC9;--bg:#faf7f2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:680px;margin:0 auto;padding:28px 16px 64px}header{display:flex;align-items:center;gap:10px;margin-bottom:20px}
header img{width:40px;height:40px}header a{color:var(--ink);text-decoration:none;font-weight:700;font-size:19px;letter-spacing:-.03em}
h1{font-size:26px;line-height:1.2;margin:0 0 4px}.meta{color:var(--muted);font-size:14px;margin:0 0 20px}
ol{padding-left:22px}li{margin:0 0 12px}li a{color:var(--blue);font-weight:600;overflow-wrap:anywhere}li p{margin:2px 0 0;color:var(--muted);font-size:14px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 24px}.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:12px;font-weight:600;text-decoration:none}
.primary{background:var(--blue);color:#fff}.ghost{border:1px solid #d6d3d1;color:var(--ink)}
</style></head><body><main><header><img src="/brand/leketia-mark.webp" alt="" width="40" height="40"><a href="/">leketia</a></header>${body}</main></body></html>`,
    { status, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const d = url.searchParams.get('d') || '';
  let board;
  try {
    board = await decode(d);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lien de partage illisible';
    return page('Partage illisible', `<h1>Partage illisible</h1><p class="meta">${escHtml(msg)}. Le lien a peut-être été coupé en le copiant.</p>`, 400);
  }

  const wantsMd = url.searchParams.get('format') === 'md' || /text\/markdown/.test(context.request.headers.get('Accept') || '');
  if (wantsMd) {
    return new Response(toMarkdown(board, { source: url.origin }), { headers: { ...HEADERS, 'Content-Type': 'text/markdown; charset=utf-8' } });
  }

  const items = board.links.map((l) => `<li><a href="${escHtml(l.url)}" rel="noopener noreferrer nofollow">${escHtml(l.title || l.url)}</a>${l.note ? `<p>${escHtml(l.note)}</p>` : ''}</li>`).join('');
  const n = board.links.length;
  const mdUrl = `/b?format=md&d=${encodeURIComponent(d)}`;
  return page(board.name, `<h1>${escHtml(board.name)}</h1>
<p class="meta">${n} lien${n > 1 ? 's' : ''}${board.date ? `, partagé le ${escHtml(board.date)}` : ''}. Ce partage n'est stocké nulle part : tout son contenu est dans le lien.</p>
<div class="actions"><a class="btn primary" href="/?import=${encodeURIComponent(d)}">Ajouter à mon journal leketia</a><a class="btn ghost" href="${escHtml(mdUrl)}">Version texte (Markdown)</a></div>
<ol>${items}</ol>`);
}
