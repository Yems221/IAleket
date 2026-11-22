// Partage sans stockage : ce qui entre dans le lien en ressort à l'identique, et rien de dangereux n'en sort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, toMarkdown, MAX_DECODED } from '../public/share-codec.mjs';

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
