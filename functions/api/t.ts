// Mesure d'audience anonyme — POST /api/t, envoyé par public/telemetry.js.
// Le serveur n'accepte que des événements et des champs connus, de types et de tailles bornés :
// une valeur inattendue est écartée, jamais enregistrée. Voir docs/TELEMETRIE.md.
import { sameOrigin, readCapped } from '../_shared';
import { store, countryOf, type TelemetryEnv, type Row } from '../_telemetry';

const MAX_BODY = 32 * 1024;
const MAX_EVENTS = 50;

// Petits mots (catégories) : lettres, chiffres, tirets ; jamais une adresse ni un texte libre.
const word = (v: unknown) => (typeof v === 'string' && /^[a-z0-9_-]{1,24}$/i.test(v) ? v.toLowerCase() : undefined);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e6 ? Math.round(v) : undefined);
const flag = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
type Check = (v: unknown) => unknown;

const CTX: Record<string, Check> = { os: word, browser: word, form: word, mode: word, theme: word, lang: word };
// scope : journal, collection, selection, ou pin (un seul lien partagé depuis la fenêtre Modifier).
const SCOPE: Record<string, Check> = { scope: word, mdp: flag, limite: flag, liens: count };
const EVENTS: Record<string, Record<string, Check>> = {
  app_open: CTX,
  install: { os: word, browser: word, form: word, via: word },
  link_added: { rs: word, via: word, image: flag, collections: count },
  photo_added: { kind: word, via: word },
  collection_created: { from: word },
  share_made: { tab: word, how: word, ...SCOPE },
  page_published: SCOPE,
  page_edited: { mdp: flag, limite: flag, mdp_change: flag },
  page_removed: {},
  board_imported: { source: word, liens: count },
  sync_on: {}, sync_off: {},
  backup: { to: word, elements: count },
  restore: { from: word, elements: count },
  mesure_on: {},
  snapshot: { links: count, photos: count, videos: count, collections: count, pages: count, pages_mdp: count, pages_limite: count, sync: flag },
};

function clean(name: string, p: unknown): Record<string, unknown> | null {
  const spec = EVENTS[name];
  if (!spec) return null;
  const out: Record<string, unknown> = {};
  if (!p || typeof p !== 'object') return out;
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    // Photo du journal : un compteur par réseau social (rs_instagram, rs_tiktok…).
    const check = spec[k] || (name === 'snapshot' && /^rs_[a-z]{1,16}$/.test(k) ? count : undefined);
    if (!check) continue;
    const ok = check(v);
    if (ok !== undefined) out[k] = ok;
  }
  return out;
}

export async function onRequestPost(context: { request: Request; env: TelemetryEnv }): Promise<Response> {
  const none = new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  const db = context.env.TELEMETRY;
  if (!db) return none; // instance sans base : la mesure est simplement ignorée
  if (!sameOrigin(context.request)) return new Response(null, { status: 403 });
  const bytes = await readCapped(context.request as unknown as Response, MAX_BODY);
  if (!bytes) return new Response(null, { status: 413 });
  let body: { d?: unknown; v?: unknown; e?: unknown };
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return new Response(null, { status: 400 }); }
  const device = typeof body.d === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.d) ? body.d : null;
  if (!device || !Array.isArray(body.e)) return new Response(null, { status: 400 });
  const v = typeof body.v === 'string' && /^[0-9a-z.-]{1,16}$/i.test(body.v) ? body.v : '';
  const now = Date.now();
  const country = countryOf(context.request);
  const rows: Row[] = [];
  for (const ev of body.e.slice(0, MAX_EVENTS)) {
    if (!ev || typeof ev !== 'object') continue;
    const { n, t, p } = ev as { n?: unknown; t?: unknown; p?: unknown };
    if (typeof n !== 'string') continue;
    const props = clean(n, p);
    if (!props) continue;
    // Heure de l'appareil acceptée si plausible (envoi différé hors ligne), sinon celle du serveur.
    const ts = typeof t === 'number' && t > now - 30 * 86400000 && t < now + 300000 ? Math.round(t) : now;
    rows.push({ ts, device, name: n, props, country, v });
  }
  try { await store(db, rows); } catch { return new Response(null, { status: 503 }); }
  return none;
}
