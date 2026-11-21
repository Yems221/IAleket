// Tests du comportement visible des garde-fous serveur (pas de leur mise en œuvre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicHttpUrl, sameOrigin, firstUrl, readCapped } from '../functions/_shared.ts';

test('accepte un site public en http(s)', () => {
  assert.equal(publicHttpUrl('https://www.youtube.com/watch?v=abc')?.hostname, 'www.youtube.com');
  assert.ok(publicHttpUrl('http://example.com/page'));
});

test('refuse tout ce qui pourrait viser un réseau interne ou un autre protocole', () => {
  for (const raw of [
    'javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.com/x',
    'http://localhost/', 'http://127.0.0.1/', 'http://10.0.0.5/admin', 'http://[::1]/',
    'http://169.254.169.254/latest/meta-data', 'http://intranet/', 'http://imprimante.local/',
    'https://example.com:8443/', 'https://user:pass@example.com/', 'pas une adresse',
  ]) assert.equal(publicHttpUrl(raw), null, raw);
});

test("n'accepte que les demandes venant de l'app elle-même", () => {
  const req = (headers) => new Request('https://ialeket.example/api/fetch-link', { method: 'POST', headers });
  assert.equal(sameOrigin(req({ 'Sec-Fetch-Site': 'same-origin' })), true);
  assert.equal(sameOrigin(req({ 'Sec-Fetch-Site': 'cross-site' })), false);
  assert.equal(sameOrigin(req({ Origin: 'https://ialeket.example' })), true);
  assert.equal(sameOrigin(req({ Origin: 'https://autre-site.example' })), false);
  assert.equal(sameOrigin(req({})), false);
});

test('trouve le lien dans le texte partagé par une appli', () => {
  assert.equal(firstUrl('Regarde ça https://x.com/a/status/1 trop bien'), 'https://x.com/a/status/1');
  assert.equal(firstUrl('pas de lien ici'), '');
});

test('ne lit jamais plus que la taille autorisée', async () => {
  const big = () => new Response(new Uint8Array(5000));
  assert.equal(await readCapped(big(), 1000), null);
  assert.equal((await readCapped(big(), 1000, true)).byteLength, 1000);
  assert.equal((await readCapped(big(), 10000)).byteLength, 5000);
});
