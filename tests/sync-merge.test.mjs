// Synchronisation : deux appareils qui modifient le journal chacun de leur côté ne perdent rien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge, fingerprint } from '../public/sync-merge.mjs';

const space = (id, name, created_at = '2026-11-20 10:00:00') => ({ id, name, sort_order: 0, created_at, updated_at: created_at });
const item = (id, title, updated_at, extra = {}) => ({ id, title, url: `https://example.com/${id}`, space_id: 's1', space_ids: ['s1'], deleted_at: null, created_at: updated_at, updated_at, ...extra });
const NOW = Date.parse('2026-11-22T12:00:00Z');

test('deux ajouts faits en même temps sur deux appareils sont gardés tous les deux', () => {
  const phone = { spaces: [space('s1', 'Journal')], items: [item('a', 'du téléphone', '2026-11-22 10:00:00')] };
  const pc = { spaces: [space('s1', 'Journal')], items: [item('b', 'du PC', '2026-11-22 10:00:01')] };
  const m = merge(phone, pc, NOW);
  assert.deepEqual(m.items.map((i) => i.id).sort(), ['a', 'b']);
});

test('la modification la plus récente gagne, dans les deux sens', () => {
  const old = { spaces: [], items: [item('a', 'ancien titre', '2026-11-22 09:00:00')] };
  const neu = { spaces: [], items: [item('a', 'nouveau titre', '2026-11-22 11:00:00')] };
  assert.equal(merge(old, neu, NOW).items[0].title, 'nouveau titre');
  assert.equal(merge(neu, old, NOW).items[0].title, 'nouveau titre');
});

test('mise à la corbeille transmise : la version supprimée plus récente gagne', () => {
  const a = { spaces: [], items: [item('a', 't', '2026-11-22 09:00:00')] };
  const b = { spaces: [], items: [item('a', 't', '2026-11-22 10:00:00', { deleted_at: '2026-11-22 10:00:00' })] };
  assert.equal(merge(a, b, NOW).items[0].deleted_at, '2026-11-22 10:00:00');
});

test('suppression définitive : la pierre tombale efface la copie plus ancienne de l’autre appareil', () => {
  const pc = { spaces: [], items: [item('a', 't', '2026-11-22 09:00:00')] };
  const phone = { spaces: [], items: [], tombstones: { a: '2026-11-22 10:00:00' } };
  const m = merge(pc, phone, NOW);
  assert.equal(m.items.length, 0);
  assert.equal(m.tombstones.a, '2026-11-22 10:00:00');
});

test('un élément modifié après sa suppression ailleurs revient (la modification la plus récente gagne)', () => {
  const pc = { spaces: [], items: [item('a', 't', '2026-11-22 11:00:00')] };
  const phone = { spaces: [], items: [], tombstones: { a: '2026-11-22 10:00:00' } };
  assert.equal(merge(pc, phone, NOW).items.length, 1);
});

test('les vieilles pierres tombales sont oubliées après 90 jours', () => {
  const m = merge({ spaces: [], items: [], tombstones: { a: '2026-01-01 00:00:00' } }, null, NOW);
  assert.deepEqual(m.tombstones, {});
});

test('deux collections « Journal » créées sur deux appareils n’en font plus qu’une, la même partout', () => {
  const phone = { spaces: [space('p', 'Journal', '2026-11-20 08:00:00')], items: [item('a', 'x', '2026-11-22 10:00:00', { space_id: 'p', space_ids: ['p'] })] };
  const pc = { spaces: [space('c', 'journal', '2026-11-21 08:00:00')], items: [item('b', 'y', '2026-11-22 10:00:00', { space_id: 'c', space_ids: ['c'] })] };
  const m1 = merge(phone, pc, NOW);
  const m2 = merge(pc, phone, NOW);
  assert.deepEqual(m1.spaces.map((s) => s.id), ['p']);
  assert.ok(m1.items.every((i) => i.space_ids[0] === 'p' && i.space_id === 'p'));
  assert.equal(fingerprint(m1), fingerprint(m2));
});

test('fusionner deux fois donne le même résultat (rien à renvoyer)', () => {
  const a = { spaces: [space('s1', 'Journal')], items: [item('a', 'x', '2026-11-22 10:00:00')] };
  const b = { spaces: [space('s1', 'Journal')], items: [item('b', 'y', '2026-11-22 10:00:00')] };
  const m = merge(a, b, NOW);
  assert.equal(fingerprint(merge(m, m, NOW)), fingerprint(m));
  assert.equal(fingerprint(merge(m, b, NOW)), fingerprint(m));
});
