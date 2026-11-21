// Logo de Leketia : une calebasse (le bol taillé dans la gourde) remplie de 0 et de 1.
// Modelé en 3D avec three.js, puis rendu en images fixes pour les icônes de l'app.
import * as THREE from 'three';

const SIZE = 1024;
const INK = '#4a2410';

// Hasard reproductible : le même logo à chaque rendu.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(221);

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 50);
camera.position.set(0, 2.9, 4.7);
camera.lookAt(0, 0.02, 0);

scene.add(new THREE.HemisphereLight(0xfff4e2, 0x6b3d1c, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(2.6, 4.2, 3.2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffd7a3, 0.9);
fill.position.set(-3.2, 1.6, 2.2);
scene.add(fill);

// ---- La calebasse : une sphère coupée au-dessus de son équateur, avec une vraie épaisseur ----
const R = 1, WALL = 0.09, CUT = 16, STEPS = 48; // CUT : hauteur de la coupe, en degrés
const profile = [];
for (let i = 0; i <= STEPS; i++) {
  const a = THREE.MathUtils.degToRad(-90 + (i * (90 + CUT)) / STEPS);
  profile.push(new THREE.Vector2(Math.cos(a) * R, Math.max(Math.sin(a) * R, -0.965))); // fond légèrement aplati
}
for (let i = STEPS; i >= 0; i--) {
  const a = THREE.MathUtils.degToRad(-90 + (i * (90 + CUT)) / STEPS);
  profile.push(new THREE.Vector2(Math.cos(a) * (R - WALL), Math.sin(a) * (R - WALL) + 0.01));
}

// Peau de la calebasse : ocre moucheté, frise pyrogravée sous le bord, intérieur sombre.
function gourdTexture() {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const y = (v) => H * (1 - v); // v = 0 au fond extérieur, 0.5 au bord, 1 au fond intérieur

  const skin = g.createLinearGradient(0, y(0), 0, y(0.5));
  skin.addColorStop(0, '#a9601f'); skin.addColorStop(0.55, '#cf8a33'); skin.addColorStop(1, '#e0a045');
  g.fillStyle = skin; g.fillRect(0, y(0.5), W, H / 2);
  for (let i = 0; i < 2600; i++) { // mouchetures et veines
    g.fillStyle = `rgba(${rand() < 0.5 ? '90,45,12' : '255,214,150'},${0.03 + rand() * 0.07})`;
    g.beginPath();
    g.ellipse(rand() * W, y(rand() * 0.5), 2 + rand() * 9, 6 + rand() * 30, 0, 0, Math.PI * 2);
    g.fill();
  }

  const inside = g.createLinearGradient(0, y(0.5), 0, y(1));
  inside.addColorStop(0, '#9a5a26'); inside.addColorStop(0.35, '#6f3c17'); inside.addColorStop(1, '#4b260d');
  g.fillStyle = inside; g.fillRect(0, 0, W, H / 2);

  // Frise : deux filets et une rangée de triangles, comme une calebasse gravée.
  g.strokeStyle = INK; g.fillStyle = INK; g.lineCap = 'round';
  const top = y(0.455), bottom = y(0.385);
  g.lineWidth = 9;
  for (const yy of [top, bottom]) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
  const N = 28, step = W / N;
  for (let i = 0; i < N; i++) {
    g.beginPath();
    g.moveTo(i * step + step * 0.12, bottom - 9);
    g.lineTo(i * step + step * 0.5, top + 12);
    g.lineTo(i * step + step * 0.88, bottom - 9);
    g.closePath(); g.fill();
  }
  // Rangée de losanges plus bas sur la panse.
  for (let i = 0; i < N; i++) {
    const cx = i * step + step / 2, cy = y(0.3), s = 15;
    g.beginPath(); g.moveTo(cx, cy - s * 1.5); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s * 1.5); g.lineTo(cx - s, cy); g.closePath(); g.fill();
  }
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, y(0.335)); g.lineTo(W, y(0.335)); g.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const bowl = new THREE.Mesh(
  new THREE.LatheGeometry(profile, 128),
  new THREE.MeshPhysicalMaterial({ map: gourdTexture(), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45, side: THREE.DoubleSide }),
);
bowl.rotation.y = 0.11; // un triangle de la frise bien face à l'objectif
scene.add(bowl);

// ---- Les 0 et les 1, en volume ----
const cream = new THREE.MeshStandardMaterial({ color: 0xfff7e8, roughness: 0.35, emissive: 0xfff1d6, emissiveIntensity: 0.18 });
const amber = new THREE.MeshStandardMaterial({ color: 0xf59a23, roughness: 0.35, emissive: 0xe07a10, emissiveIntensity: 0.25 });
// Terre cuite : pour les grands chiffres du sommet, qui se détachent sur un fond clair comme sur un fond sombre.
const clay = new THREE.MeshStandardMaterial({ color: 0xb4571b, roughness: 0.4, emissive: 0x7a2f08, emissiveIntensity: 0.25 });
const zeroGeo = new THREE.TorusGeometry(0.5, 0.17, 20, 56);
const barGeo = new THREE.CapsuleGeometry(0.17, 0.98, 8, 18);
const flagGeo = new THREE.CapsuleGeometry(0.155, 0.3, 8, 14);

function digit(value, material) {
  const group = new THREE.Group();
  if (value === 0) {
    const ring = new THREE.Mesh(zeroGeo, material);
    ring.scale.set(0.68, 1, 1);
    group.add(ring);
  } else {
    group.add(new THREE.Mesh(barGeo, material));
    const flag = new THREE.Mesh(flagGeo, material);
    flag.rotation.z = -0.95;
    flag.position.set(-0.19, 0.44, 0);
    group.add(flag);
  }
  return group;
}

const rimY = Math.sin(THREE.MathUtils.degToRad(CUT)) * R;
const heap = new THREE.Group();

// Un lit sombre sous le tas, pour qu'on ne voie jamais le fond vide.
const bed = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), new THREE.MeshStandardMaterial({ color: 0x3a1d0a, roughness: 1 }));
bed.rotation.x = -Math.PI / 2;
bed.position.y = rimY - 0.2;
heap.add(bed);

// Le tas : bombé au centre, il dépasse du bord. La calebasse déborde de données.
for (let i = 0; i < 120; i++) {
  const r = 0.8 * Math.sqrt(rand()), phi = rand() * Math.PI * 2;
  const d = digit(rand() < 0.5 ? 0 : 1, rand() < 0.24 ? amber : cream);
  d.scale.setScalar(0.17 + rand() * 0.06);
  d.position.set(Math.cos(phi) * r, rimY - 0.16 + 0.46 * (1 - (r / 0.82) ** 2) + rand() * 0.07, Math.sin(phi) * r);
  d.rotation.set(-1.1 + rand() * 1.0, (rand() - 0.5) * 1.4, (rand() - 0.5) * 1.2);
  heap.add(d);
}

// Trois grands chiffres bien lisibles au sommet : c'est eux qu'on reconnaît en petit.
[[1, -0.36, 0.5, 0.2, -0.18, clay], [0, 0.02, 0.62, 0.3, 0.06, amber], [1, 0.4, 0.5, 0.16, 0.2, clay]].forEach(([value, x, y, z, tilt, material]) => {
  const d = digit(value, material);
  d.scale.setScalar(0.34);
  d.position.set(x, rimY + y, z);
  d.rotation.set(-0.42, tilt, tilt * 0.9);
  heap.add(d);
});
scene.add(heap);

renderer.render(scene, camera);

// ---- Export : une image transparente pour l'app, des icônes sur fond clair pour l'écran d'accueil ----
const OUTPUTS = [
  { name: 'logo.png', size: 256, pad: 0, bg: null },
  { name: 'logo-512.png', size: 512, pad: 0, bg: null },
  { name: 'icon-192.png', size: 192, pad: 0.04, bg: '#fbf3e6' },
  { name: 'icon-512.png', size: 512, pad: 0.04, bg: '#fbf3e6' },
  { name: 'icon-maskable-512.png', size: 512, pad: 0.17, bg: '#fbf3e6' },
  { name: 'apple-touch-icon.png', size: 180, pad: 0.06, bg: '#fbf3e6' },
];

async function exportAll() {
  const status = document.getElementById('status');
  const out = document.getElementById('out');
  const saved = [];
  for (const o of OUTPUTS) {
    const c = document.createElement('canvas');
    c.width = c.height = o.size;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    const p = o.size * o.pad;
    if (o.bg) {
      g.fillStyle = o.bg; g.fillRect(0, 0, o.size, o.size);
      // Ombre de contact douce sous la calebasse (icônes sur fond seulement).
      const inner = o.size - 2 * p, cx = o.size / 2, cy = p + inner * 0.845, rx = inner * 0.34;
      g.save(); g.translate(cx, cy); g.scale(1, 0.2);
      const shade = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      shade.addColorStop(0, 'rgba(74,36,16,0.38)'); shade.addColorStop(1, 'rgba(74,36,16,0)');
      g.fillStyle = shade; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.drawImage(canvas, p, p, o.size - 2 * p, o.size - 2 * p);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const r = await fetch('/save/' + o.name, { method: 'POST', body: blob });
    saved.push(`${o.name} ${r.ok ? Math.round(blob.size / 1024) + ' Ko' : 'ÉCHEC'}`);
    if (o.name === 'icon-192.png' || o.name === 'logo.png') { const img = new Image(); img.src = URL.createObjectURL(blob); img.width = o.size > 200 ? 200 : o.size; out.appendChild(img); }
  }
  status.textContent = 'Enregistré dans public/icons : ' + saved.join(' · ');
  window.__logoDone = saved;
}
exportAll();
