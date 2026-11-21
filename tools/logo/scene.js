// Logo de leketia — rendu 3D réaliste avec three.js.
// Consignes : une vraie calebasse (le leket, le bol taillé dans la gourde), vue de profil,
// une seule couleur, reconnaissable, moderne, imprimable. Elle est remplie de données :
// un dôme de cubes, comme des pixels, qui prolonge la courbe du fruit.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SIZE = 2048;
const CLAY = 0xb4571b;          // la seule couleur du logo
const CLAY_CSS = '#B4571B';
const CREAM = '#FBF3E6';

// Hasard reproductible : le même logo à chaque rendu.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(7);

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

// ---- Vue de profil : l'œil à peine au-dessus du bord ----
const VIEW = { fov: 22, dist: 6.9, eyeY: 0.9, lookY: 0.22 };
const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 50);
camera.position.set(0, VIEW.eyeY, VIEW.dist);
camera.lookAt(0, VIEW.lookY, 0);

const key = new THREE.DirectionalLight(0xffffff, 2.7);
key.position.set(-3.2, 5, 3.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5 });
key.shadow.bias = -0.0005;
key.shadow.radius = 4;
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 0.9);
rim.position.set(3.5, 1.2, -2);
scene.add(rim);

// ---- Peau de calebasse : relief seul, sans couleur ajoutée (la couleur reste unique) ----
function skinBump() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { // veines du fruit, du fond vers le bord
    g.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + rand() * 0.07})`;
    g.beginPath(); g.ellipse(rand() * W, rand() * H, 1 + rand() * 2.5, 30 + rand() * 120, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 900; i++) { // grain
    g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.08})`;
    g.beginPath(); g.arc(rand() * W, rand() * H, 0.6 + rand() * 1.6, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
const clay = new THREE.MeshPhysicalMaterial({
  color: CLAY, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45,
  bumpMap: skinBump(), bumpScale: 2.5, side: THREE.DoubleSide,
});

// ---- La calebasse : une gourde ronde coupée au-dessus de son milieu, paroi épaisse ----
const R = 1, WALL = 0.07, CUT = 12, STEPS = 64; // CUT : hauteur de la coupe, en degrés
const profile = [];
for (let i = 0; i <= STEPS; i++) {
  const a = THREE.MathUtils.degToRad(-90 + (i * (90 + CUT)) / STEPS);
  const swell = 1 + 0.02 * Math.sin(a * 2 + 0.5); // un fruit n'est jamais une sphère parfaite
  profile.push(new THREE.Vector2(Math.cos(a) * R * swell, Math.max(Math.sin(a) * R * 0.88, -0.84)));
}
for (let i = STEPS; i >= 0; i--) {
  const a = THREE.MathUtils.degToRad(-90 + (i * (90 + CUT)) / STEPS);
  profile.push(new THREE.Vector2(Math.cos(a) * (R - WALL), Math.sin(a) * (R - WALL) * 0.88 + 0.01));
}
const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 180), clay);
bowl.castShadow = bowl.receiveShadow = true;
scene.add(bowl);
const rimY = Math.sin(THREE.MathUtils.degToRad(CUT)) * R * 0.88;

// ---- Les données : la calebasse est pleine à ras bord, et son contenu forme un dôme de cubes ----
// En bas, la courbe lisse du fruit ; en haut, la même courbe en escalier, comme des pixels.
// Un cube, c'est une donnée ; deux cubes s'en détachent au sommet.
const U = 0.15, DOME = 0.9;
const cubes = [];
const n = Math.floor(DOME / U);
for (let ix = -n; ix <= n; ix++) {
  for (let iz = -n; iz <= n; iz++) {
    const x = ix * U, z = iz * U, d2 = DOME * DOME - x * x - z * z;
    if (d2 <= 0) continue;
    const layers = Math.max(1, Math.round(Math.sqrt(d2) / U));
    for (let k = 0; k < layers; k++) cubes.push([x, rimY - U * 0.35 + k * U, z]);
  }
}
cubes.push([U, rimY - U * 0.35 + (Math.round(DOME / U) + 0.6) * U, 0], [0, rimY - U * 0.35 + (Math.round(DOME / U) + 1.6) * U, 0]);
const voxels = new THREE.InstancedMesh(new THREE.BoxGeometry(U * 0.94, U * 0.94, U * 0.94), clay, cubes.length);
const m4 = new THREE.Matrix4();
cubes.forEach(([x, y, z], i) => voxels.setMatrixAt(i, m4.makeTranslation(x, y + U / 2, z)));
voxels.castShadow = voxels.receiveShadow = true;
scene.add(voxels);

// ---- Deux rendus : réaliste (couleur unique, ombres) et à plat (une couleur, pour l'impression) ----
// Version imprimable : vue exactement de côté, sans perspective. Les cubes s'alignent en grille
// et laissent voir un fin interstice : on lit des pixels même en une seule couleur.
const halfH = Math.tan(THREE.MathUtils.degToRad(VIEW.fov / 2)) * VIEW.dist;
const flatCamera = new THREE.OrthographicCamera(-halfH, halfH, VIEW.lookY + halfH, VIEW.lookY - halfH, 0.1, 50);
flatCamera.position.set(0, 0, VIEW.dist);
const flatVoxelGeo = new THREE.BoxGeometry(U * 0.84, U * 0.84, U * 0.84);
const flatMaterial = new THREE.MeshBasicMaterial({ color: CLAY });

function renderTo(flat) {
  const geo = voxels.geometry;
  if (flat) { voxels.geometry = flatVoxelGeo; scene.overrideMaterial = flatMaterial; }
  renderer.render(scene, flat ? flatCamera : camera);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  c.getContext('2d').drawImage(canvas, 0, 0);
  voxels.geometry = geo; scene.overrideMaterial = null;
  return c;
}
const realistic = renderTo(false);
const flat = renderTo(true);

function compose(source, size, { pad = 0, bg = null } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
  const p = size * pad, inner = size - 2 * p;
  if (source === realistic) { // ombre de contact douce sous la calebasse
    const cy = p + inner * (0.5 - (-0.86 - VIEW.lookY) / (2 * halfH)), rx = inner * 0.3;
    g.save(); g.translate(p + inner / 2, cy); g.scale(1, 0.14);
    const sh = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    sh.addColorStop(0, 'rgba(60,28,8,0.32)'); sh.addColorStop(1, 'rgba(60,28,8,0)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.drawImage(source, p, p, inner, inner);
  return c;
}

const OUTPUTS = [
  { dir: 'brand', name: 'leketia-logo.png', src: realistic, size: 2048 },                     // logo, fond transparent
  { dir: 'brand', name: 'leketia-logo-print.png', src: flat, size: 2048 },                     // impression une couleur
  { dir: 'brand', name: 'leketia-mark.png', src: realistic, size: 256 },                       // dans l'app
  { dir: 'icons', name: 'icon-192.png', src: realistic, size: 192, opts: { bg: CREAM, pad: 0.04 } },
  { dir: 'icons', name: 'icon-512.png', src: realistic, size: 512, opts: { bg: CREAM, pad: 0.04 } },
  { dir: 'icons', name: 'icon-maskable-512.png', src: realistic, size: 512, opts: { bg: CREAM, pad: 0.16 } },
  { dir: 'icons', name: 'apple-touch-icon.png', src: realistic, size: 180, opts: { bg: CREAM, pad: 0.05 } },
];

const done = [];
for (const o of OUTPUTS) {
  const blob = await new Promise((res) => compose(o.src, o.size, o.opts).toBlob(res, 'image/png'));
  const r = await fetch(`/save/${o.dir}/${o.name}`, { method: 'POST', body: blob });
  done.push(`${o.name} ${r.ok ? Math.round(blob.size / 1024) + ' Ko' : 'ÉCHEC'}`);
}

// Planche de contrôle : réaliste, impression, et aux tailles réelles d'une icône.
const out = document.getElementById('out');
for (const [label, src, size, opts] of [
  ['Réaliste', realistic, 380, { bg: CREAM, pad: 0.04 }],
  ['Impression, une couleur', flat, 380, { bg: '#ffffff', pad: 0.04 }],
  ['64 px', realistic, 64, { bg: CREAM, pad: 0.04 }],
  ['32 px', realistic, 32, { bg: CREAM, pad: 0.04 }],
  ['32 px, impression', flat, 32, { bg: '#ffffff', pad: 0.04 }],
]) {
  const fig = document.createElement('figure');
  const img = new Image();
  img.src = compose(src, size * 2, opts).toDataURL();
  img.width = img.height = size;
  img.style.borderRadius = Math.round(size * 0.2) + 'px';
  fig.append(img, label);
  out.appendChild(fig);
}
document.getElementById('status').textContent = 'Enregistré : ' + done.join(' · ');
window.__logoDone = done;
