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

import { cardsHtml, BOARD_CSS, VIEWER_HTML } from '../public/board-render.mjs';

// Lecteurs intégrés autorisés (les mêmes que dans l'app), ouverts seulement au toucher d'une carte.
const FRAMES = 'https://platform.twitter.com https://www.youtube-nocookie.com https://www.youtube.com https://www.tiktok.com https://www.instagram.com https://assets.pinterest.com';
const csp = (nonce: string) => `default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; frame-src ${FRAMES}; script-src 'nonce-${nonce}' 'strict-dynamic'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

/** Sur iPhone, un lien s'ouvre toujours dans Safari, jamais dans l'app installée, dont la mémoire est séparée.
 * Le pont sans serveur : copier le lien ici, puis « Coller le lien » dans l'app, qui reconnaît une page leketia. */
export const isIos = (ua: string) => /iPhone|iPad|iPod/.test(ua);
export function iosBridge(url: string): string {
  return `<div class="bridge"><strong>leketia est installée sur ton écran d'accueil ?</strong>
<p>Sur iPhone, ce lien s'ouvre dans Safari et pas dans l'app. Touche <b>Ajouter à mon journal leketia</b> puis <b>Envoyer à mon app</b> : la page passe par ton Google Drive et t'attend dans l'app. Sinon, copie le lien et touche <b>Coller le lien</b> dans l'app.</p>
<button type="button" class="btn primary" id="copyLink" data-url="${escHtml(url)}">Copier le lien</button></div>`;
}

export function htmlPage(opts: { title: string; description: string; origin: string; canonical?: string; body: string; status?: number; extraHead?: string; cache?: string; module?: string }): Response {
  const { title, description, origin, canonical, body, status = 200, extraHead = '', cache = 'no-store' } = opts;
  const module = opts.module ?? (body.includes('class="cards"') ? '/board-view.mjs' : '');
  const nonce = crypto.randomUUID().replace(/-/g, '');
  // Garde : si un ancien service worker sert une version périmée du module de partage, le module ne se charge pas.
  // On vide alors les caches et on recharge, une seule fois.
  const guard = `<script nonce="${nonce}">setTimeout(async function(){if(window.__moduleReady||sessionStorage.getItem('leketia:healed'))return;sessionStorage.setItem('leketia:healed','1');try{for(const k of await caches.keys())await caches.delete(k);const r=await navigator.serviceWorker.getRegistration();if(r)await r.update();}catch(e){}location.reload();},2500);</script>`;
  const moduleTag = module ? `<script type="module" nonce="${nonce}" src="${module}"></script>${guard}` : '';
  const script = moduleTag + (body.includes('id="copyLink"') ? `<script nonce="${nonce}">document.getElementById('copyLink').addEventListener('click',async function(){try{await navigator.clipboard.writeText(this.dataset.url);this.textContent='Lien copié : ouvre leketia';}catch(e){this.textContent='Copie impossible : copie l’adresse de la page';}});</script>` : '');
  const t = escHtml(title);
  const d = escHtml(description);
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${t} — leketia</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website"><meta property="og:site_name" content="leketia">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:image" content="${origin}/brand/leketia-logo.png">${canonical ? `<meta property="og:url" content="${escHtml(canonical)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="/brand/leketia-favicon.svg">
<meta name="theme-color" content="#1F4BC9" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0b1640" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="/tokens.css?v=2">${extraHead}
<style>
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 var(--font)}
main{max-width:720px;margin:0 auto;padding:28px 16px 64px}header{display:flex;align-items:center;gap:10px;margin-bottom:20px}
header img{width:40px;height:40px}header a{color:var(--ink);text-decoration:none;font-weight:700;font-size:19px;letter-spacing:-.03em}
h1{font-family:var(--font-display);font-weight:800;letter-spacing:-.03em;font-size:28px;line-height:1.15;margin:0 0 4px;overflow-wrap:anywhere}.meta{color:var(--ink-secondary);font-size:14px;margin:0 0 20px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 24px}.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:999px;font-weight:600;text-decoration:none}
.primary{background:var(--accent-fill);color:var(--on-accent)}.ghost{border:1px solid var(--border-strong);color:var(--ink)}
.btn{transition:transform 120ms cubic-bezier(.23,1,.32,1);-webkit-tap-highlight-color:transparent}.btn:active{transform:scale(.97)}
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.btn{transition:none}}
${BOARD_CSS}
.lock{display:grid;gap:12px;max-width:360px}.lock input{min-height:44px;padding:0 14px;border:1px solid var(--border-strong);border-radius:12px;font:inherit;background:var(--surface-elevated);color:var(--ink)}.lock button{border:0;font:inherit;cursor:pointer;justify-content:center}.lock-err{color:var(--danger);font-size:14px;min-height:20px;margin:0}
.bridge{background:var(--accent-soft);border:1px solid var(--accent-light);border-radius:16px;padding:14px 16px;margin:0 0 20px}.bridge p{margin:6px 0 12px;font-size:14px}.bridge button{border:0;font:inherit;cursor:pointer}
</style></head><body><main><header><img src="/brand/leketia-mark.webp" alt="" width="40" height="40"><a href="/">leketia</a></header>${body}</main>${body.includes('class="cards"') || opts.module ? VIEWER_HTML : ''}${script}</body></html>`,
    { status, headers: { ...PAGE_HEADERS, Vary: 'User-Agent', 'Cache-Control': cache, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp(nonce) } });
}

/** Les cartes du board, déjà écrites dans la page (rendu partagé avec la page protégée). */
export function boardCards(board: Board): string {
  return cardsHtml(board);
}

export const countLabel = (n: number) => `${n} lien${n > 1 ? 's' : ''}`;

/** Page verrouillée : le contenu chiffré est dans la page, le navigateur du visiteur le déchiffre avec le mot de passe. */
export function lockedPage(opts: { origin: string; sealed: string; kind: 'link' | 'page'; canonical?: string }): Response {
  const payload = JSON.stringify({ kind: opts.kind, sealed: opts.sealed }).replace(/</g, '\\u003c');
  return htmlPage({
    title: 'Partage protégé', description: 'Ce partage leketia est protégé par un mot de passe.', origin: opts.origin, canonical: opts.canonical,
    module: '/board-lock.mjs',
    body: `<div id="locked"><h1>Partage protégé</h1><p class="meta">Son auteur l'a protégé par un mot de passe. Il est déchiffré ici, dans ton navigateur : ni leketia ni Google ne peuvent le lire.</p>
<form class="lock" id="lockForm"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="off" required autofocus><p class="lock-err" id="lockErr" role="alert"></p><button class="btn primary" type="submit">Ouvrir</button></form></div>
<div id="board" hidden></div><script type="application/json" id="lockData">${payload}</script>`,
  });
}

/** Partage expiré (le serveur le sait quand la date est lisible). */
export function expiredPage(origin: string): Response {
  return htmlPage({ title: 'Partage expiré', description: 'Ce partage a expiré.', origin, status: 410,
    body: `<h1>Ce partage a expiré</h1><p class="meta">Son auteur lui avait donné une date limite. Demande-lui un nouveau lien.</p><div class="actions"><a class="btn primary" href="/">Découvrir leketia</a></div>` });
}
