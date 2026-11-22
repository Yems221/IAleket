// Aperçu d'un lien — POST /api/fetch-link
//
// Repris de HomeBoard, sans stockage ni navigateur automatisé :
//   1. oEmbed officiel (YouTube, Pinterest, TikTok, X)
//   2. Lecture des balises Open Graph de la page (sites classiques)
// Rien n'est conservé ici. L'adresse de la miniature est renvoyée à l'app, qui la
// récupère via /api/thumb et la garde sur l'appareil.
import { json, sameOrigin, publicHttpUrl, guardedFetch, readCapped } from '../_shared';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface Preview {
  title: string;
  description: string;
  image_url: string;
  price: string;
}

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'Demande refusée' }, 403);

  let body: { url?: string };
  try {
    body = (await context.request.json()) as { url?: string };
  } catch {
    return json({ ok: false, error: 'Corps invalide' }, 400);
  }
  if (!body.url || !body.url.trim()) {
    return json({ ok: false, error: 'URL requise' }, 400);
  }

  const checked = publicHttpUrl(normalizeUrl(body.url.trim()));
  if (!checked) return json({ ok: false, error: 'Lien invalide' }, 400);
  const input = checked.toString();
  let host = checked.hostname.replace(/^www\./, '').toLowerCase();

  // Les liens courts (vt/vm.tiktok.com, tiktok.com/t/…) ne contiennent pas l'ID
  // de la vidéo : on suit la redirection pour obtenir l'URL canonique embarquable.
  let url = input;
  if (isShortLink(host, input)) {
    url = await resolveCanonical(input);
    try {
      host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      /* on garde l'URL d'origine */
    }
  }

  const preview: Preview = { title: '', description: '', image_url: '', price: '' };
  let note = '';

  try {
    // 1) oEmbed (gratuit, instantané)
    if (host.endsWith('tiktok.com')) {
      const o = await tiktokOembed(url);
      if (o) mergePreview(preview, o);
    } else if (host === 'x.com' || host.endsWith('twitter.com')) {
      const o = await twitterOembed(url);
      if (o) mergePreview(preview, o);
    } else if (host.endsWith('youtube.com') || host === 'youtu.be') {
      const o = await simpleOembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      if (o) mergePreview(preview, o);
    } else if (host.endsWith('instagram.com')) {
      const o = await instagramEmbed(url);
      if (o) mergePreview(preview, o);
    } else if (/(^|\.)pinterest\.[a-z.]+$/.test(host)) {
      const o = await simpleOembed(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`);
      if (o) mergePreview(preview, o);
    }

    // 2) Scraping Open Graph si on manque encore de données
    if (!preview.image_url || !preview.title) {
      const og = await ogScrape(url);
      mergePreview(preview, og);
    }

    if (!preview.image_url && host.endsWith('instagram.com')) {
      note = "Instagram ne fournit pas d'image d'aperçu. Le lecteur intégré fonctionnera quand même.";
    } else if (!preview.image_url && !preview.title) {
      note = "Aperçu indisponible pour ce lien. Tu peux remplir le titre à la main.";
    }

    // canonical_url : le front l'enregistre pour que le lecteur intégré fonctionne.
    return json({ ok: true, preview, canonical_url: url, note: note || undefined });
  } catch {
    return json({ ok: false, error: 'Impossible de récupérer les informations du lien' }, 422);
  }
}

// ---------------------------------------------------------------------------
// Sources de métadonnées
// ---------------------------------------------------------------------------

function isShortLink(host: string, url: string): boolean {
  if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com' || host === 'pin.it') return true;
  if (host.endsWith('tiktok.com') && /^\/t\//.test(safePath(url))) return true;
  return false;
}

// Suit les redirections et renvoie l'URL finale (sans les paramètres de tracking).
async function resolveCanonical(url: string): Promise<string> {
  try {
    const res = await guardedFetch(url, { 'User-Agent': DESKTOP_UA });
    const final = (res && res.url) || url;
    const u = new URL(final);
    return u.origin + u.pathname; // on retire ?_t=…&_r=… etc.
  } catch {
    return url;
  }
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

async function tiktokOembed(url: string): Promise<Partial<Preview> | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': DESKTOP_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      // thumbnail_url n'est plus toujours fourni par TikTok : la lecture Open Graph prend alors le relais.
      title: d.title || d.author_name || 'Vidéo TikTok',
      description: d.author_name ? `@${d.author_name}` : '',
      image_url: d.thumbnail_url || '',
    };
  } catch {
    return null;
  }
}

// oEmbed standard (YouTube, Pinterest) : titre, auteur, et miniature quand elle est fournie.
async function simpleOembed(endpoint: string): Promise<Partial<Preview> | null> {
  try {
    const res = await fetch(endpoint, { headers: { 'User-Agent': DESKTOP_UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return { title: d.title || '', description: d.author_name || '', image_url: d.thumbnail_url || '' };
  } catch {
    return null;
  }
}

async function twitterOembed(url: string): Promise<Partial<Preview> | null> {
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': DESKTOP_UA }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { html?: string; author_name?: string };
    const text = (d.html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
    const clean = decodeEntities(text);
    return {
      title: d.author_name ? `${d.author_name} sur X` : 'Post X',
      description: clean,
    };
  } catch {
    return null;
  }
}

// Instagram : Meta a retiré la miniature de son oEmbed (3 nov. 2025) et conseille de la lire dans le HTML
// du post. La page du lecteur intégré (/p/<id>/embed/) contient l'image du post (EmbeddedMediaImage) et
// son auteur ; c'est la même image que montre le lecteur dans la fenêtre d'ajout.
async function instagramEmbed(postUrl: string): Promise<Partial<Preview> | null> {
  const m = new URL(postUrl).pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    // Agent honnête : présenté comme un navigateur, Instagram renvoie son application JavaScript (sans image) ;
    // présenté comme leketia, il renvoie la page déjà remplie.
    const res = await guardedFetch(`https://www.instagram.com/p/${m[2]}/embed/`, {
      'User-Agent': 'leketia/1.0 (+https://leketia.saccessa.com)',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }, 9000);
    if (!res || !res.ok) return null;
    const bytes = await readCapped(res, 1024 * 1024, true);
    if (!bytes) return null;
    const html = new TextDecoder().decode(bytes);
    const tag = html.match(/<img[^>]*class="EmbeddedMediaImage"[^>]*>/);
    if (!tag) return null;
    const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#064;/g, '@').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    const src = decode((tag[0].match(/\ssrc="([^"]+)"/) || [])[1] || '');
    const alt = decode((tag[0].match(/\salt="([^"]*)"/) || [])[1] || '');
    const author = (alt.match(/@([A-Za-z0-9._]+)/) || [])[1];
    const out: Partial<Preview> = {};
    if (/^https:\/\//.test(src)) out.image_url = src;
    if (author) out.title = `Post Instagram de @${author}`;
    return out;
  } catch {
    return null;
  }
}

async function ogScrape(sourceUrl: string): Promise<Partial<Preview>> {
  const out: Partial<Preview> = {};
  try {
    const res = await guardedFetch(sourceUrl, {
      'User-Agent': DESKTOP_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }, 9000);
    if (!res || !res.ok) return out;
    if (!(res.headers.get('content-type') || '').includes('html')) return out;

    const bytes = await readCapped(res, 1024 * 1024, true); // le 1er Mo suffit : les balises sont en tête de page
    if (!bytes) return out;
    const html = new TextDecoder().decode(bytes);
    out.title = metaContent(html, 'og:title') || titleTag(html);
    out.description = metaContent(html, 'og:description') || metaContent(html, 'description');
    out.image_url = resolveUrl(metaContent(html, 'og:image'), sourceUrl);
    out.price = extractPrice(html);
  } catch {
    /* page illisible : l'élément sera créé sans aperçu */
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers d'extraction
// ---------------------------------------------------------------------------

// Gère les DEUX ordres d'attributs : property/name avant OU après content.
function metaContent(html: string, prop: string): string {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*?\\scontent=["']([^"']*)["']`, 'i'),
  );
  if (m) return decodeEntities(m[1]);
  m = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?\\s(?:property|name)=["']${esc}["']`, 'i'),
  );
  return m ? decodeEntities(m[1]) : '';
}

function titleTag(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : '';
}

function extractPrice(html: string): string {
  const amount = metaContent(html, 'og:price:amount') || metaContent(html, 'product:price:amount');
  if (!amount) return '';
  const cur = metaContent(html, 'og:price:currency') || metaContent(html, 'product:price:currency') || 'EUR';
  const symbols: Record<string, string> = { EUR: '€', USD: '$', XOF: 'FCFA', GBP: '£' };
  return `${amount} ${symbols[cur] || cur}`;
}

function resolveUrl(maybeUrl: string, base: string): string {
  if (!maybeUrl) return '';
  try {
    return new URL(maybeUrl, base).href;
  } catch {
    return maybeUrl;
  }
}

function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', mdash: '—', ndash: '–',
    hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return named[code.toLowerCase()] ?? m;
  });
}

function mergePreview(target: Preview, src: Partial<Preview>): void {
  if (!target.title && src.title) target.title = src.title;
  if (!target.description && src.description) target.description = src.description;
  if (!target.image_url && src.image_url) target.image_url = src.image_url;
  if (!target.price && src.price) target.price = src.price;
}
