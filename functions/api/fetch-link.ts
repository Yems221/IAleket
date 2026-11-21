// Fetch Link Preview — POST /api/fetch-link
//
// Moteur hybride, du moins cher au plus cher :
//   1. oEmbed officiel (TikTok, Twitter/X)      → zéro temps-navigateur
//   2. Scraping Open Graph amélioré (Pinterest, e-commerce, sites classiques)
//   3. Cloudflare Browser Rendering en dernier recours (Instagram & pages JS/anti-bot),
//      en émulation mobile ; extraction de l'image du post, sinon screenshot du contenu.
//
// Toute miniature trouvée est TÉLÉCHARGÉE dans R2 pour qu'elle n'expire jamais
// (les CDN sociaux servent des URLs signées qui cassent le hotlink au bout d'un moment).
import puppeteer from '@cloudflare/puppeteer';
import { Env, json } from '../_shared';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

interface Preview {
  title: string;
  description: string;
  image_url: string;
  price: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;

  let body: { url?: string };
  try {
    body = (await context.request.json()) as { url?: string };
  } catch {
    return json({ ok: false, error: 'Corps invalide' }, 400);
  }
  if (!body.url || !body.url.trim()) {
    return json({ ok: false, error: 'URL requise' }, 400);
  }

  const input = normalizeUrl(body.url.trim());
  let host = '';
  try {
    host = new URL(input).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return json({ ok: false, error: 'URL invalide' }, 400);
  }

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
    }

    // 2) Scraping Open Graph si on manque encore de données
    if (!preview.image_url || !preview.title) {
      const og = await ogScrape(url);
      mergePreview(preview, og);
    }

    // 3) Browser Rendering en dernier recours (Instagram, pages JS)
    if (!preview.image_url && env.BROWSER) {
      const r = await browserRender(env, url);
      mergePreview(preview, r);
      if (r.note) note = r.note;
    }

    // 4) Persistance de la miniature dans R2 (jamais de hotlink)
    if (preview.image_url && /^https?:\/\//i.test(preview.image_url)) {
      const stored = await persistImage(env, preview.image_url, url);
      if (stored) preview.image_url = stored; // sinon on garde l'URL d'origine en secours
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
  if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') return true;
  if (host.endsWith('tiktok.com') && /^\/t\//.test(safePath(url))) return true;
  return false;
}

// Suit les redirections et renvoie l'URL finale (sans les paramètres de tracking).
async function resolveCanonical(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': DESKTOP_UA },
      signal: AbortSignal.timeout(8000),
    });
    const final = res.url || url;
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
      title: d.title || d.author_name || 'Vidéo TikTok',
      description: d.author_name ? `@${d.author_name}` : '',
      image_url: d.thumbnail_url || '',
    };
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
    return {
      title: d.author_name ? `${d.author_name} sur X` : 'Post X',
      description: text,
    };
  } catch {
    return null;
  }
}

async function ogScrape(sourceUrl: string): Promise<Partial<Preview>> {
  const out: Partial<Preview> = {};
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': DESKTOP_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return out;
    if (!(res.headers.get('content-type') || '').includes('html')) return out;

    const html = await res.text();
    out.title = metaContent(html, 'og:title') || titleTag(html);
    out.description = metaContent(html, 'og:description') || metaContent(html, 'description');
    out.image_url = resolveUrl(metaContent(html, 'og:image'), sourceUrl);
    out.price = extractPrice(html);
  } catch {
    /* ignore — on tentera le navigateur */
  }
  return out;
}

async function browserRender(env: Env, url: string): Promise<Partial<Preview> & { note?: string }> {
  const out: Partial<Preview> & { note?: string } = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browser = await puppeteer.launch(env.BROWSER as any);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(MOBILE_UA);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // domcontentloaded : les SPA (X, Instagram) ne stabilisent jamais le réseau ;
    // on ne bloque pas dessus et une nav trop lente ne doit pas casser la réponse.
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch {
      /* on tente quand même d'extraire ce qui a été rendu */
    }

    const data = (await page.evaluate(() => {
      const attr = (sel: string, name: string) =>
        (document.querySelector(sel) as HTMLElement | null)?.getAttribute(name) || '';
      const title = attr('meta[property="og:title"]', 'content') || document.title || '';
      const description = attr('meta[property="og:description"]', 'content') || '';
      let image = attr('meta[property="og:image"]', 'content');
      if (!image) {
        const el = document.querySelector('article img, main img, img[srcset], img[decoding]') as HTMLImageElement | null;
        image = el?.currentSrc || el?.src || '';
      }
      const loginWall =
        !!document.querySelector('input[name="password"], input[name="username"], a[href*="/accounts/login"]') ||
        /\/accounts\/login|\/login/.test(location.href);
      return { title, description, image, loginWall };
    })) as { title: string; description: string; image: string; loginWall: boolean };

    out.title = data.title;
    out.description = data.description;

    if (data.image) {
      out.image_url = data.image;
    } else if (!data.loginWall) {
      // Dernier recours : screenshot du contenu rendu, stocké directement en R2.
      const buf = (await page.screenshot({ type: 'jpeg', quality: 80 })) as Uint8Array;
      const stored = await persistBuffer(env, buf, 'jpg', 'image/jpeg');
      if (stored) out.image_url = stored;
    } else {
      out.note =
        "Ce contenu exige une connexion (Instagram) — ajoute une image manuellement ou colle l'URL de l'image.";
    }
  } catch {
    if (!out.image_url) out.note = "Aperçu indisponible pour ce lien — ajoute une image manuellement.";
  } finally {
    await browser.close(); // session éphémère : rien ne persiste
  }
  return out;
}

// ---------------------------------------------------------------------------
// Persistance R2
// ---------------------------------------------------------------------------

async function persistImage(env: Env, imageUrl: string, referer: string): Promise<string> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': DESKTOP_UA, Referer: referer, Accept: 'image/*' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok || !res.body) return '';
    const ct = res.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return '';
    return persistBuffer(env, new Uint8Array(await res.arrayBuffer()), extFor(ct), ct);
  } catch {
    return '';
  }
}

async function persistBuffer(env: Env, bytes: Uint8Array, ext: string, contentType: string): Promise<string> {
  try {
    const key = `uploads/${crypto.randomUUID()}.${ext}`;
    await env.STORAGE.put(key, bytes, { httpMetadata: { contentType } });
    return `/images/${key.replace('uploads/', '')}`;
  } catch {
    return '';
  }
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

function extFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('avif')) return 'avif';
  return 'jpg';
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/');
}

function mergePreview(target: Preview, src: Partial<Preview>): void {
  if (!target.title && src.title) target.title = src.title;
  if (!target.description && src.description) target.description = src.description;
  if (!target.image_url && src.image_url) target.image_url = src.image_url;
  if (!target.price && src.price) target.price = src.price;
}
