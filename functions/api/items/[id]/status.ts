// Status change — PATCH /api/items/:id/status
import { Env, json } from '../../../_shared';

export async function onRequestPatch(context: {
  request: Request;
  env: Env;
  params: { id: string };
  data: { user: { id: string } };
}): Promise<Response> {
  const { env, params, data } = context;
  const body = await context.request.json() as { status?: string };

  if (!body.status || !['moodboard', 'proposition', 'achete'].includes(body.status)) {
    return json({ ok: false, error: 'Statut invalide (moodboard, proposition, ou achete)' }, 400);
  }

  const newStatus = body.status;

  if (newStatus === 'achete') {
    // When marking as purchased, record who bought it
    await env.DB.prepare(
      'UPDATE items SET status = ?, purchased_by = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(newStatus, data.user.id, params.id).run();
  } else {
    // When moving back to moodboard/proposition, clear purchased_by
    await env.DB.prepare(
      'UPDATE items SET status = ?, purchased_by = NULL, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(newStatus, params.id).run();
  }

  const item = await env.DB.prepare(`
    SELECT i.*,
      pb.display_name as purchased_by_display_name,
      cb.display_name as created_by_display_name
    FROM items i
    LEFT JOIN users pb ON i.purchased_by = pb.id
    JOIN users cb ON i.created_by = cb.id
    WHERE i.id = ?
  `).bind(params.id).first();

  return json({ ok: true, item });
}
