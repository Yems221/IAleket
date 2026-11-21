// Liste globale des items — GET /api/items
//   ?status=moodboard|proposition|achete  → filtre statut
//   ?trash=1                              → items en corbeille (au lieu des actifs)
// Dédupliqué (un item multi-catégories n'apparaît qu'une fois), avec ses space_ids.
import { Env, json, withSpaceIds } from '../_shared';

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') || '';
  const trash = url.searchParams.get('trash') === '1';

  let query = `
    SELECT i.*,
      pb.display_name as purchased_by_display_name,
      cb.display_name as created_by_display_name,
      GROUP_CONCAT(DISTINCT isp.space_id) as space_ids_csv
    FROM items i
    LEFT JOIN item_spaces isp ON isp.item_id = i.id
    LEFT JOIN users pb ON i.purchased_by = pb.id
    JOIN users cb ON i.created_by = cb.id
    WHERE i.deleted_at IS ${trash ? 'NOT NULL' : 'NULL'}
  `;
  const binds: string[] = [];

  if (!trash && status && ['moodboard', 'proposition', 'achete'].includes(status)) {
    query += ' AND i.status = ?';
    binds.push(status);
  }

  query += ` GROUP BY i.id ORDER BY ${trash ? 'i.deleted_at' : 'i.updated_at'} DESC`;

  const result = await env.DB.prepare(query).bind(...binds).all();
  return json({ ok: true, items: (result.results || []).map((r) => withSpaceIds(r as Record<string, unknown>)) });
}
