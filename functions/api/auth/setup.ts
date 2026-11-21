// POST /api/auth/setup — one-time user creation (protected by SETUP_KEY)
import { Env, hashPassword, json } from '../../_shared';

interface SetupUser {
  username: string;
  password: string;
  display_name: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;

  let body: { users?: SetupUser[]; setup_key?: string };
  try {
    body = await context.request.json() as { users?: SetupUser[]; setup_key?: string };
  } catch {
    return json({ ok: false, error: 'Corps invalide' }, 400);
  }

  // Verify setup key
  if (!body.setup_key || body.setup_key !== env.SETUP_KEY) {
    return json({ ok: false, error: 'Clé de configuration invalide' }, 403);
  }

  if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
    return json({ ok: false, error: 'Tableau users requis' }, 400);
  }

  // Check if any users already exist (setup is one-time)
  const existing = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first() as { count: number } | null;
  if (existing && existing.count > 0) {
    return json({ ok: false, error: 'Les utilisateurs existent déjà. Setup déjà effectué.' }, 409);
  }

  const created: { username: string; id: string }[] = [];

  for (const u of body.users) {
    if (!u.username || !u.password || !u.display_name) continue;

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(u.password);

    await env.DB.prepare(
      'INSERT INTO users (id, username, password_hash, display_name) VALUES (?, ?, ?, ?)'
    ).bind(id, u.username, passwordHash, u.display_name).run();

    created.push({ username: u.username, id });
  }

  return json({ ok: true, created }, 201);
}
