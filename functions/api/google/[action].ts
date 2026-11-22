// Accès Google qui dure — POST /api/google/exchange et /api/google/refresh
// Le jeton longue durée (refresh token) est gardé sur l'appareil de l'utilisateur, jamais ici.
// Ce serveur ne fait qu'ajouter le secret du client Google (le même pour tous, rangé dans les réglages
// Cloudflare) pour échanger ce jeton contre un accès d'une heure. Il ne garde rien et ne journalise rien.
import { json, sameOrigin } from '../../_shared';

interface Env { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string }

async function tokenRequest(env: Env, params: Record<string, string>): Promise<Response> {
  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID || '', client_secret: env.GOOGLE_CLIENT_SECRET || '', ...params }),
  });
}

function answer(data: Record<string, unknown>) {
  const out: Record<string, unknown> = { ok: true, access_token: data.access_token, expires_in: data.expires_in, scope: data.scope };
  if (data.refresh_token) out.refresh_token = data.refresh_token;
  return json(out);
}

export async function onRequestPost(context: { request: Request; env: Env; params: { action: string } }): Promise<Response> {
  const { request, env, params } = context;
  if (!sameOrigin(request)) return json({ ok: false, error: 'Demande refusée' }, 403);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ ok: false, error: 'Synchronisation non configurée sur cette instance' }, 501);
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* corps vide */ }

  if (params.action === 'exchange') {
    const code = String(body.code || '');
    if (!code || code.length > 2048) return json({ ok: false, error: 'Code manquant' }, 400);
    // Fenêtre Google (mode popup) : l'adresse de retour est « postmessage » ; certaines versions attendent l'origine.
    for (const redirect_uri of ['postmessage', new URL(request.url).origin]) {
      const res = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (res.ok && data.access_token) return answer(data);
      if (data.error !== 'redirect_uri_mismatch') return json({ ok: false, error: 'Google a refusé la connexion' }, 400);
    }
    return json({ ok: false, error: 'Google a refusé la connexion' }, 400);
  }

  if (params.action === 'refresh') {
    const refresh_token = String(body.refresh_token || '');
    if (!refresh_token || refresh_token.length > 2048) return json({ ok: false, error: 'Jeton manquant' }, 400);
    const res = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.ok && data.access_token) return answer(data);
    // invalid_grant : l'utilisateur a retiré l'accès, ou le jeton a expiré → l'app redemandera la connexion.
    return json({ ok: false, error: data.error === 'invalid_grant' ? 'revoked' : 'Google indisponible' }, data.error === 'invalid_grant' ? 401 : 502);
  }

  return json({ ok: false, error: 'Action inconnue' }, 404);
}
