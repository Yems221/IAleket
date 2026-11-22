// Rendu des cartes publiques : comme l'app, et sans jamais exécuter ce que contient un board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardHtml, getEmbed } from '../public/board-render.mjs';

test('un tweet a un bloc lecteur X, une vidéo YouTube sa miniature', () => {
  const x = cardHtml({ title: 'Karpathy', url: 'https://x.com/karpathy/status/1617979122625712128', note: 'n' });
  assert.match(x, /data-embed="https:\/\/platform\.twitter\.com\/embed\/Tweet\.html\?id=1617979122625712128/);
  assert.match(x, /class="media facade f-twitter"/);
  const yt = cardHtml({ title: 'NN', url: 'https://www.youtube.com/watch?v=aircAruvnKk' });
  assert.match(yt, /i\.ytimg\.com\/vi\/aircAruvnKk\/hqdefault\.jpg/);
  assert.match(yt, /youtube-nocookie\.com\/embed\/aircAruvnKk/);
});

test('la miniature intégrée passe avant tout, un lien simple n’a pas de lecteur', () => {
  const img = 'data:image/jpeg;base64,AAAA';
  assert.match(cardHtml({ title: 't', url: 'https://example.com/', img }), /<img src="data:image\/jpeg;base64,AAAA"/);
  assert.doesNotMatch(cardHtml({ title: 't', url: 'https://example.com/' }), /data-embed|class="media/);
  assert.equal(getEmbed('https://example.com/'), null);
});

test('titres et notes piégés sont affichés, jamais exécutés', () => {
  const h = cardHtml({ title: '<img src=x onerror=alert(1)>', url: 'https://example.com/"onmouseover="x', note: '<script>alert(1)</script>' });
  assert.ok(!h.includes('<script>') && !h.includes('<img src=x'));
  assert.match(h, /&lt;script&gt;/);
  assert.ok(!/href="[^"]*"onmouseover/.test(h));
});
