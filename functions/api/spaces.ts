// Spaces API — GET /api/spaces (list) + POST /api/spaces (create)
import { Env, json, purgeOldTrash } from '../_shared';

export async function onRequestGet(context: { request: Request; env: Env; data: { user: { id: string } } }): Promise<Response> {
  const { env } = context;

  // Corbeille : purge auto des items supprimés depuis > 30 jours (à chaque chargement)
  await purgeOldTrash(env);

  // Compteurs via la table de liaison (catégories multiples), items non supprimés uniquement
  const spaces = await env.DB.prepare(`
    SELECT s.*, COUNT(DISTINCT i.id) as item_count
    FROM spaces s
    LEFT JOIN item_spaces isp ON isp.space_id = s.id
    LEFT JOIN items i ON i.id = isp.item_id AND i.deleted_at IS NULL
    GROUP BY s.id
    ORDER BY s.sort_order ASC, s.created_at DESC
  `).all();

  return json({ ok: true, spaces: spaces.results });
}

export async function onRequestPost(context: { request: Request; env: Env; data: { user: { id: string } } }): Promise<Response> {
  const { env, data } = context;
  const body = await context.request.json() as { name?: string };

  if (!body.name || !body.name.trim()) {
    return json({ ok: false, error: 'Nom de l\'espace requis' }, 400);
  }

  const name = body.name.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      'INSERT INTO spaces (id, name, slug, created_by) VALUES (?, ?, ?, ?)'
    ).bind(id, name, slug, data.user.id).run();

    return json({
      ok: true,
      space: { id, name, slug, sort_order: 0, item_count: 0, created_by: data.user.id }
    }, 201);
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message || '';
    if (msg.includes('UNIQUE')) {
      return json({ ok: false, error: 'Un espace avec ce nom existe déjà' }, 409);
    }
    throw e;
  }
}
