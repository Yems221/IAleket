// POST /api/auth/logout
import { Env, sha256, json, clearSessionCookie } from '../../_shared';

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const cookie = context.request.headers.get('Cookie') || '';
  const sessionMatch = cookie.match(/session=([^;]+)/);
  const token = sessionMatch ? sessionMatch[1] : '';

  if (token) {
    const tokenHash = await sha256(token);
    await context.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(tokenHash).run();
  }

  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
