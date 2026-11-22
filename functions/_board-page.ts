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

const csp = (nonce: string) => `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

/** Sur iPhone, un lien s'ouvre toujours dans Safari, jamais dans l'app installée, dont la mémoire est séparée.
 * Le pont sans serveur : copier le lien ici, puis « Coller le lien » dans l'app, qui reconnaît une page leketia. */
export const isIos = (ua: string) => /iPhone|iPad|iPod/.test(ua);
export function iosBridge(url: string): string {
  return `<div class="bridge"><strong>leketia est installée sur ton écran d'accueil ?</strong>
<p>Sur iPhone, ce lien s'ouvre dans Safari et pas dans l'app. Touche <b>Ajouter à mon journal leketia</b> puis <b>Envoyer à mon app</b> : la page passe par ton Google Drive et t'attend dans l'app. Sinon, copie le lien et touche <b>Coller le lien</b> dans l'app.</p>
<button type="button" class="btn primary" id="copyLink" data-url="${escHtml(url)}">Copier le lien</button></div>`;
}

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
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const script = body.includes('id="copyLink"') ? `<script nonce="${nonce}">document.getElementById('copyLink').addEventListener('click',async function(){try{await navigator.clipboard.writeText(this.dataset.url);this.textContent='Lien copié : ouvre leketia';}catch(e){this.textContent='Copie impossible : copie l’adresse de la page';}});</script>` : '';
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
.card div{min-width:0}.card a{color:var(--ink);font-weight:600;text-decoration:none;overflow-wrap:anywhere}
.card{position:relative;transition:transform 120ms cubic-bezier(.23,1,.32,1)}.card a::after{content:"";position:absolute;inset:0;border-radius:16px}.card:active{transform:scale(.99)}
.btn{transition:transform 120ms cubic-bezier(.23,1,.32,1);-webkit-tap-highlight-color:transparent}.btn:active{transform:scale(.97)}
a:focus-visible,button:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
@media(hover:hover) and (pointer:fine){.card a:hover{color:var(--blue)}}
@media(prefers-reduced-motion:reduce){.btn,.card{transition:none}}
.dom{display:block;color:var(--muted);font-size:12px;margin-bottom:2px}.note{margin:4px 0 0;color:var(--muted);font-size:14px;overflow-wrap:anywhere}
@media (max-width:480px){.card img{width:96px}}
.bridge{background:#eef2fd;border:1px solid #c9d5f7;border-radius:16px;padding:14px 16px;margin:0 0 20px}.bridge p{margin:6px 0 12px;font-size:14px}.bridge button{border:0;font:inherit;cursor:pointer}
</style></head><body><main><header><img src="/brand/leketia-mark.webp" alt="" width="40" height="40"><a href="/">leketia</a></header>${body}</main>${script}</body></html>`,
    { status, headers: { ...PAGE_HEADERS, Vary: 'User-Agent', 'Cache-Control': cache, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp(nonce) } });
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
