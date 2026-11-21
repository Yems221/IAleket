// Logo de leketia — couche réaliste : le leket bleu roi, gravé du mot « leket » écrit en bits.
// Silhouette et position des bits : tracé une couleur (leket-bits.js). La calebasse est d'un bleu roi uniforme ;
// chaque bit à 1 est un carré gravé, blanc. Le volume vient uniquement de la lumière.
// Vue exactement de côté (caméra orthographique) : le contour reste identique au tracé.
import * as THREE from 'three';
import { bitSquares, ROYAL_BLUE } from './leket-bits.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SIZE = 2048;
const CREAM = '#FBF3E6';

// ---- Le tracé maître (repère SVG 100 × 100), repris de a3.html ----
const RIM_Y = 34, BASE_Y = 82.5, BASE_HALF = 7.5;
const RIGHT = [[94, 35.5], [94, 60], [79, 80], [57.5, 82.5]];   // panse droite (bézier cubique)
const LEFT = [[6, 35.5], [6, 60], [20.5, 80], [42.5, 82.5]];    // panse gauche

const bez = (p, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
};
// Repère SVG → monde three.js : 1 unité = 50 px SVG, centre de la scène au point (50, 50).
const toWorld = (x, y) => [(x - 50) / 50, -(y - 50) / 50];

// Profil tourné à partir de la panse droite : du centre du fond jusqu'au bord.
const profileSvg = [[50, BASE_Y], [50 + BASE_HALF, BASE_Y]];
for (let i = 1; i <= 80; i++) profileSvg.push(bez([...RIGHT].reverse(), i / 80));
profileSvg.push([94, 34.6], [93.4, RIM_Y]);                     // coin du bord, à peine adouci
const profile = profileSvg.map(([x, y]) => new THREE.Vector2(...toWorld(x, y)));

// Rayon de la panse (gauche ou droite) à une hauteur donnée, pour garder l'asymétrie du tracé.
function radiusAt(curve, ySvg) {
  if (ySvg >= BASE_Y) return BASE_HALF;
  if (ySvg <= curve[0][1]) return Math.abs(curve[0][0] - 50);
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; (bez(curve, mid)[1] < ySvg ? (lo = mid) : (hi = mid)); }
  return Math.abs(bez(curve, (lo + hi) / 2)[0] - 50);
}

// ---- Rendu ----
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
const key = new THREE.DirectionalLight(0xfff3e0, 2.0);
key.position.set(-2.2, 2.6, 3.4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffe2c0, 0.5);
fill.position.set(2.5, -0.5, 2);
scene.add(fill);

// Caméra orthographique de face : un point (x, y) du tracé tombe exactement au même endroit de l'image.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
camera.position.set(0, 0, 5);

// ---- La peau : ocre, veinée, un peu plus sombre vers le fond ; carrés pyrogravés ----
function rand(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
const r = rand(42);

const TW = 2048, TH = 1024;
const texCanvas = document.createElement('canvas');
texCanvas.width = TW; texCanvas.height = TH;
const g = texCanvas.getContext('2d');

// 1. Peau : un seul bleu roi, sans dégradé ; un grain très léger du même bleu pour la matière.
g.fillStyle = ROYAL_BLUE; g.fillRect(0, 0, TW, TH);
for (let i = 0; i < 1800; i++) {
  g.fillStyle = `rgba(20,55,170,${0.05 + r() * 0.06})`;
  g.beginPath(); g.arc(r() * TW, r() * TH, 0.6 + r() * 1.8, 0, Math.PI * 2); g.fill();
}

// 3. Carrés pyrogravés : chaque texel retrouve le point (x, y) qu'il occupe vu de face
// et devient brûlé s'il tombe dans un carré du tracé.
const squares = bitSquares().map(([x, y, size]) => [x, y, x + size, y + size]);
const Y_MIN = Math.min(...squares.map((q) => q[1])), Y_MAX = Math.max(...squares.map((q) => q[3]));
const lengths = [0];
for (let i = 1; i < profileSvg.length; i++) lengths.push(lengths[i - 1] + Math.hypot(profileSvg[i][0] - profileSvg[i - 1][0], profileSvg[i][1] - profileSvg[i - 1][1]));
const vs = lengths.map((l) => l / lengths[lengths.length - 1]);

const img = g.getImageData(0, 0, TW, TH);
// Relief : blanc = surface, noir = creux. Les carrés gravés sont creusés dans la peau.
const bumpCanvas = document.createElement('canvas');
bumpCanvas.width = TW; bumpCanvas.height = TH;
const bg2 = bumpCanvas.getContext('2d');
bg2.fillStyle = '#fff'; bg2.fillRect(0, 0, TW, TH);
const bump = bg2.getImageData(0, 0, TW, TH);
// Masque des bits : ils restent blancs quelle que soit la lumière (sinon l'ombre de la panse les grise).
const glowCanvas = document.createElement('canvas');
glowCanvas.width = TW; glowCanvas.height = TH;
const glowCtx = glowCanvas.getContext('2d');
glowCtx.fillStyle = '#000'; glowCtx.fillRect(0, 0, TW, TH);
const glow = glowCtx.getImageData(0, 0, TW, TH);
for (let ty = 0; ty < TH; ty++) {
  const v = 1 - ty / TH;
  let k = 1;
  while (k < vs.length - 1 && vs[k] < v) k++;
  const t = vs[k] > vs[k - 1] ? (v - vs[k - 1]) / (vs[k] - vs[k - 1]) : 0;
  const ySvg = profileSvg[k - 1][1] + t * (profileSvg[k][1] - profileSvg[k - 1][1]);
  if (ySvg < Y_MIN - 1 || ySvg > Y_MAX + 1) continue;
  for (let tx = 0; tx < TW; tx++) {
    // LatheGeometry : un sommet d'angle phi est en (r·sin phi, y, r·cos phi). La face vers la
    // caméra (z > 0) est donc cos phi > 0, et sa position horizontale vaut r·sin phi.
    const phi = (tx / TW) * Math.PI * 2;
    if (Math.cos(phi) <= 0) continue;
    const s = Math.sin(phi);
    const rad = radiusAt(s < 0 ? LEFT : RIGHT, ySvg);
    const xSvg = 50 + s * rad;
    for (const [x0, y0, x1, y1] of squares) {
      const jitter = (Math.sin(tx * 0.045 + ty * 0.03) + Math.sin(tx * 0.017 - ty * 0.05)) * 0.06; // bord gravé au couteau, à peine ondulé
      if (xSvg > x0 + jitter && xSvg < x1 - jitter && ySvg > y0 + jitter && ySvg < y1 - jitter) {
        const p = (ty * TW + tx) * 4;
        const edge = Math.min(xSvg - x0, x1 - xSvg, ySvg - y0, y1 - ySvg);
        // Bit gravé : blanc, avec un fin liseré d'ombre sur le bord de l'entaille.
        const depth = Math.min(1, edge / 0.6);
        const white = edge < 0.35 ? 205 : 255;
        for (let c = 0; c < 3; c++) img.data[p + c] = white;
        for (let c = 0; c < 3; c++) bump.data[p + c] = 255 * (1 - depth * 0.5);
        for (let c = 0; c < 3; c++) glow.data[p + c] = edge < 0.35 ? 120 : 235;
        break;
      }
    }
  }
}
g.putImageData(img, 0, 0);
bg2.putImageData(bump, 0, 0);
glowCtx.putImageData(glow, 0, 0);
const emissiveMap = new THREE.CanvasTexture(glowCanvas);
emissiveMap.colorSpace = THREE.SRGBColorSpace;
const bumpMap = new THREE.CanvasTexture(bumpCanvas);
const map = new THREE.CanvasTexture(texCanvas);
map.colorSpace = THREE.SRGBColorSpace;
map.anisotropy = 8;

// ---- Le bol : profil tourné, puis panse gauche ajustée pour garder l'asymétrie du tracé ----
const geo = new THREE.LatheGeometry(profile, 256);
const pos = geo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  if (x >= 0) continue;
  const ySvg = 50 - pos.getY(i) * 50;
  const ratio = radiusAt(LEFT, ySvg) / Math.max(radiusAt(RIGHT, ySvg), 0.001);
  pos.setX(i, x * ratio);
}
geo.computeVertexNormals();
const bowl = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
  map, bumpMap, bumpScale: 3, emissive: 0xffffff, emissiveMap, emissiveIntensity: 0.75, roughness: 0.62, clearcoat: 0.18, clearcoatRoughness: 0.6, sheen: 0.25, sheenColor: new THREE.Color(0xffe0b0),
}));
scene.add(bowl);

renderer.render(scene, camera);

// ---- Exports ----
function compose(size, { pad = 0, bg = null, center = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
  const p = size * pad, inner = size - 2 * p;
  const dy = center ? ((50 - (34 + 82.5) / 2) / 100) * inner : 0;
  ctx.drawImage(canvas, p, p + dy, inner, inner);
  return c;
}
// Le tracé occupe x 6→94 et y 34→82.5 du carré : un padding négatif agrandit le bol dans la tuile.
const OUTPUTS = [
  { dir: 'brand', name: 'leketia-logo.png', size: 2048 },
  { dir: 'icons', name: 'icon-192.png', size: 192, opts: { bg: CREAM, pad: 0.02, center: true } },
  { dir: 'icons', name: 'icon-512.png', size: 512, opts: { bg: CREAM, pad: 0.02, center: true } },
  { dir: 'icons', name: 'icon-maskable-512.png', size: 512, opts: { bg: CREAM, pad: 0.13, center: true } },
  { dir: 'icons', name: 'apple-touch-icon.png', size: 180, opts: { bg: CREAM, pad: 0.03, center: true } },
];
const done = [];
for (const o of OUTPUTS) {
  const blob = await new Promise((res) => compose(o.size, o.opts).toBlob(res, 'image/png'));
  const resp = await fetch(`/save/${o.dir}/${o.name}`, { method: 'POST', body: blob });
  done.push(`${o.name} ${resp.ok ? Math.round(blob.size / 1024) + ' Ko' : 'ÉCHEC'}`);
}
const out = document.getElementById('out');
for (const [label, size, opts] of [['Réaliste', 420, { bg: CREAM }], ['Icône 64 px', 64, { bg: CREAM, pad: 0.02, center: true }], ['Icône 32 px', 32, { bg: CREAM, pad: 0.02, center: true }]]) {
  const fig = document.createElement('figure');
  const im = new Image();
  im.src = compose(size * 2, opts).toDataURL();
  im.width = im.height = size;
  im.style.borderRadius = Math.round(size * 0.2) + 'px';
  fig.append(im, label);
  out.appendChild(fig);
}
document.getElementById('status').textContent = 'Enregistré : ' + done.join(' · ');
window.__logoDone = done;
