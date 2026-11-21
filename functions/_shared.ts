// leketia — outils communs des fonctions serveur.
// Le serveur ne garde rien : il lit l'aperçu d'un lien pour le compte de l'app, puis oublie.

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// 1re adresse http(s) d'un texte (les partages Instagram/TikTok mettent souvent le lien dans "text").
export function firstUrl(text: string): string {
  const m = String(text || '').match(/https?:\/\/\S+/);
  return m ? m[0] : '';
}

// ---------------------------------------------------------------------------
// Garde-fous : ce serveur va chercher des pages pour l'app. Sans compte, il ne doit
// ni servir de relais à d'autres sites, ni pouvoir viser un réseau interne.
// ---------------------------------------------------------------------------

// Vrai si la demande vient de l'app elle-même (même origine), pas d'un autre site.
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('Origin');
  return !!origin && origin === new URL(request.url).origin;
}

// Renvoie l'adresse si elle désigne un site public en http(s), sinon null.
export function publicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.')) return null; // "localhost", noms internes sans domaine
  if (/^[0-9.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null; // adresses IP
  if (/\.(local|localhost|internal|lan|home|corp|test|invalid)$/.test(host)) return null;
  return u;
}

// fetch qui suit les redirections à la main, en revérifiant chaque étape.
export async function guardedFetch(raw: string, headers: Record<string, string>, timeoutMs = 8000): Promise<Response | null> {
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = publicHttpUrl(current);
    if (!u) return null;
    const res = await fetch(u.toString(), { headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if (res.status < 300 || res.status >= 400) return res;
    const next = res.headers.get('Location');
    if (!next) return null;
    current = new URL(next, u).toString();
  }
  return null;
}

// Lit le corps d'une réponse sans dépasser une taille maximale. Au-delà : null, ou seulement
// le début si truncate est vrai (utile pour une page web, dont les balises sont en tête).
export async function readCapped(res: Response, maxBytes: number, truncate = false): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array();
  const declared = Number(res.headers.get('Content-Length') || 0);
  if (declared > maxBytes && !truncate) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      await reader.cancel();
      if (!truncate) return null;
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      break;
    }
    total += value.byteLength;
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
