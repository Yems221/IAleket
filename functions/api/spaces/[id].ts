// Spaces [id] API — GET /api/spaces/:id, PUT /api/spaces/:id, DELETE /api/spaces/:id
import { Env, json } from '../../_shared';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;

  const space = await env.DB.prepare(`
    SELECT s.*, COUNT(i.id) as item_count
    FROM spaces s
    LEFT JOIN items i ON i.space_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `).bind(params.id).first();

  if (!space) {
    return json({ ok: false, error: 'Espace introuvable' }, 404);
  }

  return json({ ok: true, space });
}

export async function onRequestPut(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;
  const body = await context.request.json() as { name?: string };

  if (!body.name || !body.name.trim()) {
    return json({ ok: false, error: 'Nom requis' }, 400);
  }

  const name = body.name.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  await env.DB.prepare(
    'UPDATE spaces SET name = ?, slug = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(name, slug, params.id).run();

  return json({ ok: true, space: { id: params.id, name, slug } });
}

export async function onRequestDelete(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;

  // Check if space has items
  const count = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM items WHERE space_id = ?'
  ).bind(params.id).first() as { count: number } | null;

  if (count && count.count > 0) {
    return json({ ok: false, error: 'L\'espace contient des éléments. Supprimez-les d\'abord.' }, 409);
  }

  await env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
