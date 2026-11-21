// POST /api/auth/login
import { Env, sha256, verifyPassword, sessionCookie, json } from '../../_shared';

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;
  let body: { username?: string; password?: string };
  try {
    body = await context.request.json() as { username?: string; password?: string };
  } catch {
    return json({ ok: false, error: 'Corps invalide' }, 400);
  }

  const { username, password } = body;
  if (!username || !password) {
    return json({ ok: false, error: 'Nom d\'utilisateur et mot de passe requis' }, 400);
  }

  const user = await env.DB.prepare(
    'SELECT id, username, display_name, password_hash FROM users WHERE username = ?'
  ).bind(username).first() as { id: string; username: string; display_name: string; password_hash: string } | null;

  if (!user) {
    return json({ ok: false, error: 'Identifiants incorrects' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ ok: false, error: 'Identifiants incorrects' }, 401);
  }

  // Create session
  const token = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await sha256(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, user.id, tokenHash, expiresAt).run();

  const maxAge = 30 * 24 * 60 * 60;
  return json(
    { ok: true, user: { id: user.id, username: user.username, display_name: user.display_name } },
    200,
    { 'Set-Cookie': sessionCookie(token, maxAge) }
  );
}
