// leketia — fusion de deux états du journal (cet appareil et le Drive), sans serveur.
// Règle : pour chaque élément, la modification la plus récente gagne (« last write wins » par élément).
// Deux ajouts faits en même temps sur deux appareils sont donc gardés tous les deux.
// Une suppression définitive laisse une « pierre tombale » datée, qui l'emporte sur une version plus ancienne.
// Module pur : utilisé par l'app (navigateur) et par les tests (Node).

export const TOMBSTONE_DAYS = 90;

// « 2026-11-22 10:15:03 » se compare comme du texte ; à égalité, on départage de façon identique partout.
function newer(a, b) {
  const ua = String(a.updated_at || ''), ub = String(b.updated_at || '');
  if (ua !== ub) return ua > ub ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/**
 * @param {{spaces: object[], items: object[], tombstones?: Record<string,string>}} local
 * @param {{spaces: object[], items: object[], tombstones?: Record<string,string>} | null} remote
 * @returns {{spaces: object[], items: object[], tombstones: Record<string,string>}}
 */
export function merge(local, remote, now = Date.now()) {
  const r = remote || { spaces: [], items: [], tombstones: {} };

  // Pierres tombales : on garde la plus récente, et on oublie celles de plus de 90 jours.
  const tombstones = {};
  const limit = sqlTime(now - TOMBSTONE_DAYS * 86400000);
  for (const t of [local.tombstones || {}, r.tombstones || {}]) {
    for (const [id, at] of Object.entries(t)) {
      if (String(at) >= limit && (!tombstones[id] || String(at) > tombstones[id])) tombstones[id] = String(at);
    }
  }

  // Collections : dernière modification gagnante, puis une seule collection par nom
  // (chaque appareil a pu créer son propre « Journal » : on garde la plus ancienne, partout la même).
  const spacesById = new Map();
  for (const s of [...(local.spaces || []), ...(r.spaces || [])]) {
    if (!s || !s.id) continue;
    spacesById.set(s.id, spacesById.has(s.id) ? newer(spacesById.get(s.id), s) : s);
  }
  const byName = new Map();
  const remap = new Map();
  const ordered = [...spacesById.values()].sort((a, b) => (String(a.created_at) < String(b.created_at) ? -1 : String(a.created_at) > String(b.created_at) ? 1 : a.id < b.id ? -1 : 1));
  for (const s of ordered) {
    const key = String(s.name || '').trim().toLowerCase();
    if (byName.has(key)) remap.set(s.id, byName.get(key).id);
    else byName.set(key, s);
  }
  const spaces = [...byName.values()];

  // Éléments : dernière modification gagnante, puis les suppressions définitives plus récentes.
  const itemsById = new Map();
  for (const it of [...(local.items || []), ...(r.items || [])]) {
    if (!it || !it.id) continue;
    itemsById.set(it.id, itemsById.has(it.id) ? newer(itemsById.get(it.id), it) : it);
  }
  const items = [];
  for (const it of itemsById.values()) {
    const dead = tombstones[it.id];
    if (dead && dead >= String(it.updated_at || '')) continue;
    if (remap.size) {
      const ids = [...new Set((it.space_ids || [it.space_id]).map((id) => remap.get(id) || id))];
      if (ids.join() !== (it.space_ids || []).join()) { items.push({ ...it, space_ids: ids, space_id: ids[0] }); continue; }
    }
    items.push(it);
  }
  return { spaces, items, tombstones };
}

/** Empreinte stable d'un état : sert à savoir s'il faut envoyer ou appliquer quelque chose. */
export function fingerprint(state) {
  const sort = (arr) => [...arr].sort((a, b) => (a.id < b.id ? -1 : 1));
  return JSON.stringify([sort(state.spaces), sort(state.items), Object.entries(state.tombstones || {}).sort()]);
}
