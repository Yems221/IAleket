// leketia — rendu serveur d'un board en page HTML déjà remplie.
// Une seule adresse pour tout le monde : un humain voit l'interface leketia, un agent IA lit
// les liens sans rien exécuter, WhatsApp/Telegram/iMessage trouvent titre et image d'aperçu.
// Utilisé par /b (board dans le lien) et /p/<id> (page publiée depuis le Drive de son auteur).

type Link = { title: string; url: string; note: string; img?: string };
type Board = { name: string; date: string; links: Link[] };

export const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const PAGE_HEADERS = {
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// Miniature YouTube déduite de l'adresse : aucune image n'est stockée nulle part.
function youtubeId(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^(www\.|m\.)/, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'music.youtube.com') id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/) || [])[1] || '';
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : '';
  } catch { return ''; }
}

const domain = (raw: string) => { try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return ''; } };

export function htmlPage(opts: { title: string; description: string; origin: string; canonical?: string; body: string; status?: number; extraHead?: string; cache?: string }): Response {
  const { title, description, origin, canonical, body, status = 200, extraHead = '', cache = 'no-store' } = opts;
  const t = escHtml(title);
  const d = escHtml(description);
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${t} — leketia</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website"><meta property="og:site_name" content="leketia">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:image" content="${origin}/brand/leketia-logo.png">${canonical ? `<meta property="og:url" content="${escHtml(canonical)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="/brand/leketia-favicon.svg">${extraHead}
<style>
:root{--ink:#1c1917;--muted:#6b6660;--blue:#1F4BC9;--bg:#faf7f2;--card:#fff;--line:#e7e2da}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:28px 16px 64px}header{display:flex;align-items:center;gap:10px;margin-bottom:20px}
header img{width:40px;height:40px}header a{color:var(--ink);text-decoration:none;font-weight:700;font-size:19px;letter-spacing:-.03em}
h1{font-size:26px;line-height:1.2;margin:0 0 4px;overflow-wrap:anywhere}.meta{color:var(--muted);font-size:14px;margin:0 0 20px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 24px}.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:12px;font-weight:600;text-decoration:none}
.primary{background:var(--blue);color:#fff}.ghost{border:1px solid #d6d3d1;color:var(--ink)}
.cards{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.card{display:flex;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px;align-items:flex-start}
.card img{width:120px;aspect-ratio:16/9;object-fit:cover;border-radius:10px;flex:none;background:#eee}
.card div{min-width:0}.card a{color:var(--ink);font-weight:600;text-decoration:none;overflow-wrap:anywhere}.card a:hover{color:var(--blue)}
.dom{display:block;color:var(--muted);font-size:12px;margin-bottom:2px}.note{margin:4px 0 0;color:var(--muted);font-size:14px;overflow-wrap:anywhere}
@media (max-width:480px){.card img{width:96px}}
</style></head><body><main><header><img src="/brand/leketia-mark.webp" alt="" width="40" height="40"><a href="/">leketia</a></header>${body}</main></body></html>`,
    { status, headers: { ...PAGE_HEADERS, 'Cache-Control': cache, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP } });
}

/** Les cartes du board, déjà écrites dans la page. */
export function boardCards(board: Board): string {
  return `<ol class="cards">${board.links.map((l) => {
    const yt = youtubeId(l.url);
    const src = l.img || (yt ? `https://i.ytimg.com/vi/${yt}/mqdefault.jpg` : '');
    const img = src ? `<img src="${escHtml(src)}" alt="" loading="lazy">` : '';
    return `<li class="card">${img}<div><span class="dom">${escHtml(domain(l.url))}</span><a href="${escHtml(l.url)}" rel="noopener noreferrer nofollow">${escHtml(l.title || l.url)}</a>${l.note ? `<p class="note">${escHtml(l.note)}</p>` : ''}</div></li>`;
  }).join('')}</ol>`;
}

export const countLabel = (n: number) => `${n} lien${n > 1 ? 's' : ''}`;
