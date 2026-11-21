// Session validation middleware — runs before every /api/* request
import { sha256, Env } from './_shared';

interface User {
  id: string;
  username: string;
  display_name: string;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}) {
  const { request, env, data } = context;

  // Only intercept /api/* routes
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return context.next();
  }

  // Skip auth for login, logout, and setup routes
  if (
    url.pathname === '/api/auth/login' ||
    url.pathname === '/api/auth/logout' ||
    url.pathname === '/api/auth/setup'
  ) {
    return context.next();
  }

  const cookie = request.headers.get('Cookie') || '';
  const sessionMatch = cookie.match(/session=([^;]+)/);
  const token = sessionMatch ? sessionMatch[1] : '';

  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'Non authentifié' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    `SELECT users.id, users.username, users.display_name
     FROM sessions
     JOIN users ON sessions.user_id = users.id
     WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')`
  ).bind(tokenHash).first() as User | null;

  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: 'Session expirée' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  data.user = session;
  return context.next();
}
