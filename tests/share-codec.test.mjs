// Partage sans stockage : ce qui entre dans le lien en ressort à l'identique, et rien de dangereux n'en sort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, toMarkdown, MAX_DECODED, toPage, fromPage, pageHash, isExpired, encodeLocked, decodeLocked, newKey, toLockedPage, openLockedPage } from '../public/share-codec.mjs';

const board = {
  name: 'IA', date: '2026-11-22',
  links: [
    { title: 'But what is a neural network?', url: 'https://www.youtube.com/watch?v=aircAruvnKk', note: 'à revoir #deeplearning' },
    { title: 'Karpathy sur X', url: 'https://x.com/karpathy/status/1617979122625712128' },
  ],
};

test('aller-retour : le board décodé est identique', async () => {
  const back = await decode(await encode(board));
  assert.equal(back.name, 'IA');
  assert.equal(back.links.length, 2);
  assert.deepEqual(back.links[0], { title: board.links[0].title, url: board.links[0].url, note: board.links[0].note });
});

test('le lien reste court grâce à la compression', async () => {
  const many = { name: 'Gros', links: Array.from({ length: 40 }, (_, i) => ({ title: `Vidéo YouTube numéro ${i}`, url: `https://www.youtube.com/watch?v=abcdefghij${i}` })) };
  const d = await encode(many);
  assert.ok(d.length < 1500, `longueur ${d.length}`);
  assert.equal((await decode(d)).links.length, 40);
});

test('les liens qui ne sont pas http(s) sont retirés', async () => {
  const back = await decode(await encode({ name: 'x', links: [{ title: 'piège', url: 'javascript:alert(1)' }, { title: 'ok', url: 'https://example.com/' }] }));
  assert.deepEqual(back.links.map((l) => l.url), ['https://example.com/']);
});

test('un lien abîmé ou trafiqué est refusé proprement', async () => {
  await assert.rejects(decode(''), /invalide/);
  await assert.rejects(decode('<script>'), /invalide/);
  await assert.rejects(decode('AAAA'), /illisible/);
  const d = await encode(board);
  await assert.rejects(decode(d.slice(0, d.length - 6)), /illisible/);
});

test('un lien qui se décompresserait à l’infini est arrêté', async () => {
  const huge = new TextEncoder().encode('{"v":1,"n":"x","l":[],"pad":"' + 'a'.repeat(MAX_DECODED * 2) + '"}');
  const stream = new Blob([huge]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const d = Buffer.from(bytes).toString('base64url');
  await assert.rejects(decode(d), /trop volumineux/);
});

test('Markdown lisible par un agent', () => {
  const md = toMarkdown(board, { source: 'https://leketia.pages.dev' });
  assert.match(md, /^# IA\n/);
  assert.match(md, /- \[But what is a neural network\?\]\(https:\/\/www\.youtube\.com\/watch\?v=aircAruvnKk\)/);
  assert.match(md, /à revoir #deeplearning/);
});

test('page publiée : aller-retour et refus des fichiers étrangers', async () => {
  const page = JSON.parse(JSON.stringify(toPage(board)));
  assert.equal(page.kind, 'leketia-page');
  assert.deepEqual(fromPage(page).links, (await decode(await encode(board))).links);
  assert.throws(() => fromPage({ hello: 'world' }), /pas une page leketia/);
  assert.throws(() => fromPage(null), /pas une page leketia/);
  const piege = fromPage({ kind: 'leketia-page', v: 1, n: 'x', l: [['piège', 'javascript:alert(1)'], ['ok', 'https://example.com/']] });
  assert.deepEqual(piege.links.map((l) => l.url), ['https://example.com/']);
});

test('empreinte : change avec le contenu, pas avec la date', async () => {
  const h = await pageHash(board);
  assert.equal(h, await pageHash({ ...board, date: '2030-01-01' }));
  assert.notEqual(h, await pageHash({ ...board, links: board.links.slice(1) }));
});

test('page publiée : miniatures intégrées, et seulement des images', () => {
  const img = 'data:image/jpeg;base64,' + Buffer.from('fausse image').toString('base64');
  const back = fromPage(JSON.parse(JSON.stringify(toPage({ name: 'x', links: [
    { title: 'avec', url: 'https://example.com/a', img },
    { title: 'piège', url: 'https://example.com/b', img: 'data:text/html;base64,PHNjcmlwdD4=' },
    { title: 'piège 2', url: 'https://example.com/c', img: 'javascript:alert(1)' },
  ] }))));
  assert.equal(back.links[0].img, img);
  assert.equal(back.links[1].img, undefined);
  assert.equal(back.links[2].img, undefined);
});

test('le lien et le QR ne transportent pas les miniatures', async () => {
  const img = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(3000)).toString('base64');
  const back = await decode(await encode({ name: 'x', links: [{ title: 't', url: 'https://example.com/', img }] }));
  assert.equal(back.links[0].img, undefined);
});

test('expiration : transportée par le lien et par la page, puis respectée', async () => {
  const exp = { ...board, expires: '2026-11-23T10:00:00.000Z' };
  const back = await decode(await encode(exp));
  assert.equal(back.expires, exp.expires);
  assert.equal(fromPage(JSON.parse(JSON.stringify(toPage(exp)))).expires, exp.expires);
  assert.equal(isExpired(back, Date.parse('2026-11-23T09:59:00Z')), false);
  assert.equal(isExpired(back, Date.parse('2026-11-23T10:00:01Z')), true);
  assert.equal(isExpired(await decode(await encode(board))), false);
});

test('mot de passe : le bon mot de passe ouvre le lien, un autre est refusé', async () => {
  const e = await encodeLocked({ ...board, expires: '2030-01-01T00:00:00.000Z' }, 'calebasse');
  const back = await decodeLocked(e, 'calebasse');
  assert.equal(back.links.length, 2);
  assert.equal(back.expires, '2030-01-01T00:00:00.000Z');
  await assert.rejects(decodeLocked(e, 'mauvais'), /Mot de passe incorrect/);
  assert.ok(!e.includes('youtube'));
});

test('page publiée protégée : chiffrée, expiration lisible, ouverte avec le mot de passe', async () => {
  const { key, salt } = await newKey('secret');
  const page = JSON.parse(JSON.stringify(await toLockedPage({ ...board, expires: '2030-01-01T00:00:00.000Z' }, key, salt)));
  assert.equal(page.v, 2);
  assert.equal(page.x, '2030-01-01T00:00:00.000Z');
  assert.ok(!JSON.stringify(page).includes('neural'));
  assert.equal((await openLockedPage(page, 'secret')).links[0].title, board.links[0].title);
  await assert.rejects(openLockedPage(page, 'non'), /Mot de passe incorrect/);
});
