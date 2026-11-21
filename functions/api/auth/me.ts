// GET /api/auth/me — returns current user from session (set by middleware)
import { json } from '../../_shared';

interface ContextWithData {
  request: Request;
  env: unknown;
  data: { user?: { id: string; username: string; display_name: string } };
}

export async function onRequestGet(context: ContextWithData): Promise<Response> {
  const user = context.data.user;
  if (!user) {
    return json({ ok: false, error: 'Non authentifié' }, 401);
  }
  return json({ ok: true, user });
}
