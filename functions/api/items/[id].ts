// Item par ID — PUT /api/items/:id (édition + restauration) · DELETE /api/items/:id (corbeille)
import { Env, json, withSpaceIds, r2KeyFromImageUrl } from '../../_shared';

async function fetchItem(env: Env, id: string) {
  const item = await env.DB.prepare(`
    SELECT i.*,
      pb.display_name as purchased_by_display_name,
      cb.display_name as created_by_display_name,
      GROUP_CONCAT(DISTINCT isp.space_id) as space_ids_csv
    FROM items i
    LEFT JOIN item_spaces isp ON isp.item_id = i.id
    LEFT JOIN users pb ON i.purchased_by = pb.id
    JOIN users cb ON i.created_by = cb.id
    WHERE i.id = ?
    GROUP BY i.id
  `).bind(id).first();
  return item ? withSpaceIds(item as Record<string, unknown>) : null;
}

export async function onRequestPut(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;
  const body = await context.request.json() as {
    title?: string;
    description?: string;
    url?: string;
    price?: string;
    image_url?: string;
    status?: string;
    space_ids?: string[];
    restore?: boolean;
  };

  // Restauration depuis la corbeille
  if (body.restore) {
    await env.DB.prepare(
      "UPDATE items SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?",
    ).bind(params.id).run();
    return json({ ok: true, item: await fetchItem(env, params.id) });
  }

  const updates: string[] = [];
  const binds: (string | number)[] = [];

  if (body.title !== undefined) { updates.push('title = ?'); binds.push(body.title); }
  if (body.description !== undefined) { updates.push('description = ?'); binds.push(body.description); }
  if (body.url !== undefined) { updates.push('url = ?'); binds.push(body.url); }
  if (body.price !== undefined) { updates.push('price = ?'); binds.push(body.price); }
  if (body.image_url !== undefined) { updates.push('image_url = ?'); binds.push(body.image_url); }
  if (body.status !== undefined && ['moodboard', 'proposition', 'achete'].includes(body.status)) {
    updates.push('status = ?'); binds.push(body.status);
  }

  // Catégories multiples : remplacement complet des appartenances
  const newSpaceIds = Array.isArray(body.space_ids)
    ? [...new Set(body.space_ids.filter((s) => typeof s === 'string' && s))]
    : null;
  if (newSpaceIds && newSpaceIds.length > 0) {
    updates.push('space_id = ?'); binds.push(newSpaceIds[0]); // catégorie principale (compat)
  }

  if (updates.length === 0 && (!newSpaceIds || newSpaceIds.length === 0)) {
    return json({ ok: false, error: 'Aucune modification' }, 400);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    binds.push(params.id);
    await env.DB.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  if (newSpaceIds && newSpaceIds.length > 0) {
    await env.DB.prepare('DELETE FROM item_spaces WHERE item_id = ?').bind(params.id).run();
    await env.DB.batch(
      newSpaceIds.map((sid) =>
        env.DB.prepare('INSERT OR IGNORE INTO item_spaces (item_id, space_id) VALUES (?, ?)').bind(params.id, sid),
      ),
    );
  }

  return json({ ok: true, item: await fetchItem(env, params.id) });
}

export async function onRequestDelete(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;
  const permanent = new URL(context.request.url).searchParams.get('permanent') === '1';

  if (!permanent) {
    // Corbeille : suppression douce (restaurable, purge auto à 30j)
    await env.DB.prepare(
      "UPDATE items SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    ).bind(params.id).run();
    return json({ ok: true, trashed: true });
  }

  // Suppression définitive : objet R2 + liaisons + item
  const row = await env.DB.prepare('SELECT image_url FROM items WHERE id = ?')
    .bind(params.id).first() as { image_url?: string } | null;
  const key = r2KeyFromImageUrl(row?.image_url);
  if (key) {
    try { await env.STORAGE.delete(key); } catch { /* ignore */ }
  }
  await env.DB.prepare('DELETE FROM item_spaces WHERE item_id = ?').bind(params.id).run();
  await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(params.id).run();
  return json({ ok: true, deleted: true });
}
