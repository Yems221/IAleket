// Le bon parcours d'installation pour chaque téléphone et navigateur (agents réels relevés pour la Biennale).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { parcours, ETAPES, RAPPEL } = createRequire(import.meta.url)('../public/install-parcours.js');

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0',
  vueWebAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0',
  safari27: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1',
  safari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
  safari18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
};

test('Chrome Android installe directement', () => assert.equal(parcours(UA.chromeAndroid), 'android'));
test('Brave, Samsung et Firefox sur Android passent par Chrome', () => {
  assert.equal(parcours(UA.chromeAndroid, 0, true), 'android-autre');
  assert.equal(parcours(UA.samsung), 'android-autre');
  assert.equal(parcours(UA.firefoxAndroid), 'android-autre');
});
test('navigateur intégré à une appli : ouvrir dans le navigateur', () => {
  assert.equal(parcours(UA.instagram), 'integre');
  assert.equal(parcours(UA.vueWebAndroid), 'integre');
});
test('Safari sur iPhone, selon sa version', () => {
  assert.equal(parcours(UA.safari27), 'ios-safari-27');
  assert.equal(parcours(UA.safari26), 'ios-safari-26');
  assert.equal(parcours(UA.safari18), 'ios-safari');
});
test('Chrome sur iPhone et iPad qui se dit Mac', () => {
  assert.equal(parcours(UA.chromeIos), 'ios-chrome');
  assert.equal(parcours(UA.ipad, 5), 'ios-safari-26');
});
test('ordinateur : pas de bannière', () => assert.equal(parcours(UA.mac), 'ordinateur'));
test('chaque parcours a ses étapes et son rappel', () => {
  for (const p of Object.keys(ETAPES)) { assert.ok(ETAPES[p].length > 0, p); assert.ok(RAPPEL[p], p); }
});
