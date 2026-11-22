// Mesure d'audience anonyme : enregistrement dans la base D1 « TELEMETRY » (voir docs/TELEMETRIE.md).
// Sans base reliée (une autre instance de leketia, ou le développement), tout est ignoré sans erreur.
// Jamais enregistré : adresse IP, agent du navigateur complet, lien, titre, note, nom de collection, compte Google.

export interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): unknown; run(): Promise<unknown> };
  batch(statements: unknown[]): Promise<unknown>;
  exec(sql: string): Promise<unknown>;
}
export interface TelemetryEnv { TELEMETRY?: D1Like }

const RETENTION_MS = 25 * 30 * 86400000; // 25 mois, puis effacé

const SCHEMA = `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  device TEXT,
  name TEXT NOT NULL,
  props TEXT,
  country TEXT,
  v TEXT
);
CREATE INDEX IF NOT EXISTS events_day_name ON events (day, name);
CREATE INDEX IF NOT EXISTS events_device ON events (device, ts);`;

let ready: Promise<unknown> | null = null;
function ensureSchema(db: D1Like): Promise<unknown> {
  if (!ready) ready = db.exec(SCHEMA.replace(/\n\s*/g, ' ')).catch((e) => { ready = null; throw e; });
  return ready;
}

export interface Row { ts: number; device: string | null; name: string; props: Record<string, unknown>; country: string; v: string }

export async function store(db: D1Like, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  await ensureSchema(db);
  const stmt = 'INSERT INTO events (ts, day, device, name, props, country, v) VALUES (?, ?, ?, ?, ?, ?, ?)';
  await db.batch(rows.map((r) => db.prepare(stmt).bind(r.ts, new Date(r.ts).toISOString().slice(0, 10), r.device, r.name,
    Object.keys(r.props).length ? JSON.stringify(r.props) : null, r.country || null, r.v || null)));
  // Effacement des données de plus de 25 mois, de temps en temps (pas de tâche planifiée sur Pages).
  if (Math.random() < 0.01) await db.prepare('DELETE FROM events WHERE ts < ?').bind(Date.now() - RETENTION_MS).run().catch(() => {});
}

// Pays seulement (code à deux lettres fourni par Cloudflare), jamais l'adresse IP ni la ville.
export function countryOf(request: Request): string {
  const c = (request as unknown as { cf?: { country?: string } }).cf?.country || '';
  return /^[A-Z]{2}$/.test(c) ? c : '';
}

// Qui lit une page publique : une personne, l'aperçu d'une messagerie, un agent IA, ou un robot.
export function agentClass(ua: string): string {
  if (/WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Pinterest|SkypeUriPreview|Applebot|iMessage|Snapchat|vkShare|redditbot|Embedly/i.test(ua)) return 'apercu';
  if (/GPTBot|ChatGPT|OAI-SearchBot|ClaudeBot|Claude-User|Claude-Web|anthropic|PerplexityBot|Perplexity-User|Google-Extended|Gemini|cohere|MistralAI|Bytespider|Amazonbot|YouBot/i.test(ua)) return 'ia';
  if (/bot|crawler|spider|curl|wget|python|httpclient|go-http|node-fetch|axios|headless/i.test(ua)) return 'robot';
  return 'personne';
}

// Une page publique a été servie : on compte la vue (type de lecteur, format, résultat), sans rien sur la personne.
// La page elle-même n'est désignée que par une empreinte courte, pour compter les vues page par page.
export async function pageId(raw: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('leketia-page:' + raw)));
  return [...h.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function withView<C extends { request: Request; env: TelemetryEnv; waitUntil?: (p: Promise<unknown>) => void }>(
  kind: 'p' | 'b', handler: (context: C) => Promise<Response>, idOf?: (context: C) => string,
) {
  return async (context: C): Promise<Response> => {
    const res = await handler(context);
    const db = context.env && context.env.TELEMETRY;
    if (db && context.request.method === 'GET') {
      const url = new URL(context.request.url);
      const type = res.headers.get('Content-Type') || '';
      const job = (async () => {
        const props: Record<string, unknown> = {
          kind, statut: res.status,
          format: /markdown|text\/plain/.test(type) ? 'md' : /json/.test(type) ? 'json' : 'html',
          lecteur: agentClass(context.request.headers.get('User-Agent') || ''),
          protegee: res.headers.get('X-Leketia-Locked') === '1',
        };
        const raw = idOf ? idOf(context) : '';
        if (raw) props.page = await pageId(raw);
        if (url.searchParams.has('e')) props.protegee = true;
        await store(db, [{ ts: Date.now(), device: null, name: 'page_view', props, country: countryOf(context.request), v: '' }]);
      })().catch(() => {});
      if (context.waitUntil) context.waitUntil(job); else await job;
    }
    return res;
  };
}
