// Items d'un espace — GET /api/spaces/:id/items + POST /api/spaces/:id/items
import { Env, json, withSpaceIds } from '../../../_shared';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') || '';

  // isp : filtre d'appartenance à CET espace ; isp2 : toutes les catégories de l'item (affichage)
  let query = `
    SELECT i.*,
      pb.display_name as purchased_by_display_name,
      cb.display_name as created_by_display_name,
      GROUP_CONCAT(DISTINCT isp2.space_id) as space_ids_csv
    FROM items i
    JOIN item_spaces isp ON isp.item_id = i.id AND isp.space_id = ?
    LEFT JOIN item_spaces isp2 ON isp2.item_id = i.id
    LEFT JOIN users pb ON i.purchased_by = pb.id
    JOIN users cb ON i.created_by = cb.id
    WHERE i.deleted_at IS NULL
  `;
  const binds: string[] = [params.id];

  if (status && ['moodboard', 'proposition', 'achete'].includes(status)) {
    query += ' AND i.status = ?';
    binds.push(status);
  }

  query += ' GROUP BY i.id ORDER BY i.updated_at DESC';

  const result = await env.DB.prepare(query).bind(...binds).all();
  return json({ ok: true, items: (result.results || []).map((r) => withSpaceIds(r as Record<string, unknown>)) });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
  params: { id: string };
  data: { user: { id: string } };
}): Promise<Response> {
  const { env, params, data } = context;
  const body = await context.request.json() as {
    type?: string;
    url?: string;
    title?: string;
    description?: string;
    image_url?: string;
    price?: string;
    space_ids?: string[];
  };

  if (!body.type || !['link', 'photo'].includes(body.type)) {
    return json({ ok: false, error: 'Type invalide (link ou photo requis)' }, 400);
  }
  if (body.type === 'link' && !body.url) {
    return json({ ok: false, error: 'URL requise pour un lien' }, 400);
  }
  if (body.type === 'photo' && !body.title) {
    return json({ ok: false, error: 'Titre requis pour une photo' }, 400);
  }

  // Catégories : celles fournies, sinon l'espace courant. La première = catégorie "principale".
  let spaceIds = Array.isArray(body.space_ids)
    ? body.space_ids.filter((s) => typeof s === 'string' && s)
    : [];
  if (spaceIds.length === 0) spaceIds = [params.id];
  spaceIds = [...new Set(spaceIds)];

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO items (id, space_id, type, title, description, url, image_url, price, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'moodboard', ?, ?, ?)
  `).bind(
    id, spaceIds[0], body.type,
    body.title || '', body.description || '', body.url || '',
    body.image_url || '', body.price || '',
    data.user.id, now, now,
  ).run();

  await env.DB.batch(
    spaceIds.map((sid) =>
      env.DB.prepare('INSERT OR IGNORE INTO item_spaces (item_id, space_id) VALUES (?, ?)').bind(id, sid),
    ),
  );

  const item = await env.DB.prepare(`
    SELECT i.*, cb.display_name as created_by_display_name,
      GROUP_CONCAT(DISTINCT isp.space_id) as space_ids_csv
    FROM items i
    JOIN users cb ON i.created_by = cb.id
    LEFT JOIN item_spaces isp ON isp.item_id = i.id
    WHERE i.id = ?
    GROUP BY i.id
  `).bind(id).first();

  return json({ ok: true, item: item ? withSpaceIds(item as Record<string, unknown>) : null }, 201);
}
