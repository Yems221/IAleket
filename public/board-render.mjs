// leketia — rendu d'un board en cartes, comme dans l'app : grille, miniature ou bloc lecteur, titre, note.
// Source unique : la page serveur (/b, /p) et la page protégée (déchiffrée dans le navigateur) l'utilisent.
// Tout texte est échappé : le contenu d'un board vient d'un lien ou d'un fichier, il n'est pas digne de confiance.

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Lecteur intégrable pour un lien (mêmes règles que l'app). */
export function getEmbed(url) {
  let u; try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  let m;
  if (host.endsWith('tiktok.com') && (m = u.pathname.match(/\/(?:video|photo)\/(\d+)/))) return { platform: 'tiktok', label: 'TikTok', src: `https://www.tiktok.com/player/v1/${m[1]}` };
  if (host.endsWith('instagram.com') && (m = u.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/))) return { platform: 'instagram', label: 'Instagram', src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/` };
  if ((host === 'x.com' || host.endsWith('twitter.com')) && (m = u.pathname.match(/\/status\/(\d+)/))) return { platform: 'twitter', label: 'X', src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=light&dnt=true` };
  if (host.endsWith('youtube.com') && u.searchParams.get('v')) return { platform: 'youtube', label: 'YouTube', id: u.searchParams.get('v'), src: `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v')}` };
  if (host === 'youtu.be' && u.pathname.length > 1) return { platform: 'youtube', label: 'YouTube', id: u.pathname.slice(1), src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
  if (host.endsWith('youtube.com') && (m = u.pathname.match(/^\/(?:shorts|live)\/([A-Za-z0-9_-]+)/))) return { platform: 'youtube', label: 'YouTube', id: m[1], src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  if (/(^|\.)pinterest\.[a-z.]+$/.test(host) && (m = u.pathname.match(/\/pin\/(\d+)/))) return { platform: 'pinterest', label: 'Pinterest', src: `https://assets.pinterest.com/ext/embed.html?id=${m[1]}` };
  return null;
}

const domain = (raw) => { try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return ''; } };
const PLAY = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PLAY_SM = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

/** Une carte : image (miniature intégrée ou YouTube), sinon bloc lecteur si le lien en a un. */
export function cardHtml(l) {
  const emb = getEmbed(l.url);
  const yt = emb && emb.platform === 'youtube' && /^[A-Za-z0-9_-]{6,20}$/.test(emb.id || '') ? emb.id : '';
  const src = l.img || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : '');
  const badge = emb ? `<span class="badge b-${emb.platform}">${PLAY_SM}${esc(emb.label)}</span>` : '';
  const media = src
    ? `<div class="media"><img src="${esc(src)}" alt="" loading="lazy">${badge}</div>`
    : emb ? `<div class="media facade f-${emb.platform}">${PLAY}${badge}</div>` : '';
  const attrs = emb ? ` data-embed="${esc(emb.src)}" data-platform="${emb.platform}"` : '';
  return `<li class="card${emb ? ' playable' : ''}"${attrs}>${media}<div class="body"><span class="dom">${esc(domain(l.url))}</span><a class="title" href="${esc(l.url)}" rel="noopener noreferrer nofollow" target="_blank">${esc(l.title || l.url)}</a>${l.note ? `<p class="note">${esc(l.note)}</p>` : ''}</div></li>`;
}

export const cardsHtml = (board) => `<ol class="cards">${board.links.map(cardHtml).join('')}</ol>`;

/** Lecteur plein écran (ouvert au toucher d'une carte qui a un lecteur). */
export const VIEWER_HTML = `<div class="viewer" id="viewer" hidden role="dialog" aria-modal="true" aria-label="Lecteur"><div class="viewer-box"><div class="viewer-bar"><a id="viewerOpen" target="_blank" rel="noopener noreferrer">Ouvrir l'original</a><button type="button" id="viewerClose" aria-label="Fermer">✕</button></div><div class="viewer-frame" id="viewerFrame"></div></div></div>`;

/** Styles de la grille, communs aux pages serveur et à la page protégée. */
export const BOARD_CSS = `
main{max-width:1180px}
.cards{list-style:none;padding:0;margin:0;columns:4 250px;column-gap:14px}
.card{break-inside:avoid;display:block;margin:0 0 14px;background:var(--surface-elevated);border:1px solid var(--border-light);border-radius:16px;overflow:hidden;position:relative;box-shadow:var(--shadow-card);transition:transform 120ms cubic-bezier(.23,1,.32,1)}
.card:active{transform:scale(.99)}
.media{position:relative;display:block;background:var(--surface-sunken)}
.media img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover}
.facade{min-height:150px;display:flex;align-items:center;justify-content:center;color:#fff}
.facade svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.35))}
.f-twitter{background:#000}.f-youtube{background:#c00}.f-tiktok{background:#111}.f-pinterest{background:#bd081c}.f-instagram{background:linear-gradient(135deg,#f09433,#e6683c 30%,#dc2743 55%,#cc2366 75%,#bc1888)}
.badge{position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;gap:4px;padding:4px 9px 4px 6px;border-radius:999px;color:#fff;font-size:12px;font-weight:600;background:rgba(0,0,0,.78)}
.b-twitter{background:#000}.b-youtube{background:#c00}.b-pinterest{background:#bd081c}.b-instagram{background:linear-gradient(135deg,#f09433,#dc2743,#bc1888)}
.playable .media{cursor:pointer}
.body{padding:12px 14px 14px}
.dom{display:block;color:var(--ink-secondary);font-size:12px;margin-bottom:2px}
.title{color:var(--ink);font-weight:600;text-decoration:none;overflow-wrap:anywhere;line-height:1.35}
.note{margin:6px 0 0;color:var(--ink-secondary);font-size:14px;line-height:1.45;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
.viewer{position:fixed;inset:0;z-index:50;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:16px;animation:fade 200ms cubic-bezier(.23,1,.32,1)}
.viewer[hidden]{display:none}
.viewer-box{background:var(--surface-elevated);border-radius:18px;width:min(560px,100%);max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;animation:pop 160ms cubic-bezier(.23,1,.32,1)}
.viewer-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 8px 8px 16px;border-bottom:1px solid var(--border-light)}
.viewer-bar a{color:var(--accent);font-weight:600;font-size:14px;text-decoration:none}
.viewer-bar button{width:44px;height:44px;border:0;border-radius:12px;background:var(--surface-sunken);color:var(--ink);font-size:18px;cursor:pointer}
.viewer-frame{overflow:auto}
.viewer-frame iframe{display:block;width:100%;height:min(78dvh,720px);border:0}
.viewer-frame.v-youtube iframe{height:auto;aspect-ratio:16/9}
@keyframes fade{from{opacity:0}}@keyframes pop{from{opacity:0;transform:scale(.96)}}
@media(hover:hover) and (pointer:fine){.title:hover{color:var(--accent)}.playable .media:hover{filter:brightness(1.05)}}
@media(max-width:560px){.cards{columns:2 150px;column-gap:10px}.card{margin-bottom:10px;border-radius:14px}.body{padding:10px 11px 12px}.note{-webkit-line-clamp:4;font-size:13px}.facade{min-height:120px}}
@media(prefers-reduced-motion:reduce){.card,.viewer,.viewer-box{transition:none;animation:none}}
`;

/** Rend la grille vivante : toucher le média d'une carte ouvre son lecteur ; Échap ou ✕ le ferme. */
export function initViewer(root = document) {
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  const frame = document.getElementById('viewerFrame');
  const close = () => { viewer.hidden = true; frame.replaceChildren(); document.body.style.overflow = ''; };
  root.addEventListener('click', (e) => {
    const card = e.target.closest('.card.playable');
    if (!card || e.target.closest('a.title')) return;
    e.preventDefault();
    const iframe = document.createElement('iframe');
    iframe.src = card.dataset.embed;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = card.querySelector('.title')?.textContent || 'Lecteur';
    frame.className = 'viewer-frame v-' + card.dataset.platform;
    frame.replaceChildren(iframe);
    document.getElementById('viewerOpen').href = card.querySelector('a.title')?.href || '#';
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('viewerClose').focus();
  });
  document.getElementById('viewerClose').addEventListener('click', close);
  viewer.addEventListener('click', (e) => { if (e.target === viewer) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !viewer.hidden) close(); });
}
