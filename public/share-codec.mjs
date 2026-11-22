// leketia — format de partage d'un board, sans aucun stockage.
// Tout le contenu voyage dans le lien : JSON compressé (deflate-raw) puis encodé en base64url.
// Source unique, utilisée par l'app (navigateur), la page /b (serveur) et les tests (Node).

export const MAX_DECODED = 256 * 1024; // garde-fou contre un lien piégé qui se décompresserait à l'infini
export const MAX_LINKS = 1000;

const textEncoder = new TextEncoder();

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pump(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new Error('Partage trop volumineux'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

const safeLink = (raw) => {
  try {
    const u = new URL(String(raw || '').trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch { return ''; }
};
const text = (v, max) => String(v == null ? '' : v).slice(0, max);
// Miniature intégrée à une page publiée : petite image JPEG/PNG/WebP en data:, rien d'autre.
export const MAX_IMG_CHARS = 40000;
const safeImg = (v) => (typeof v === 'string' && v.length <= MAX_IMG_CHARS && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v) ? v : '');

/** Board partagé : { name, date, links: [{ title, url, note }] }, nettoyé (liens http(s) seulement). */
export function clean(board) {
  const links = (Array.isArray(board && board.links) ? board.links : [])
    .map((l) => { const img = safeImg(l && l.img); return { title: text(l && l.title, 300).trim(), url: safeLink(l && l.url), note: text(l && l.note, 1000).trim(), ...(img ? { img } : {}) }; })
    .filter((l) => l.url)
    .slice(0, MAX_LINKS);
  const x = board && typeof board.expires === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(board.expires) ? board.expires : '';
  return { name: text(board && board.name, 80).trim() || 'Board partagé', date: text(board && board.date, 10), links, ...(x ? { expires: x } : {}) };
}

/** Vrai si le partage porte une date d'expiration dépassée. */
export const isExpired = (board, now = Date.now()) => !!(board && board.expires && Date.parse(board.expires) <= now);

export async function encode(board) {
  const b = clean(board);
  const compact = { v: 1, n: b.name, d: b.date, l: b.links.map((l) => (l.note ? [l.title, l.url, l.note] : [l.title, l.url])), ...(b.expires ? { x: b.expires } : {}) };
  const stream = new Blob([textEncoder.encode(JSON.stringify(compact))]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return toBase64Url(await pump(stream, Infinity));
}

export async function decode(param) {
  if (!param || typeof param !== 'string' || !/^[A-Za-z0-9_-]+$/.test(param)) throw new Error('Lien de partage invalide');
  let raw;
  try {
    const stream = new Blob([fromBase64Url(param)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    raw = JSON.parse(new TextDecoder().decode(await pump(stream, MAX_DECODED)));
  } catch (e) {
    throw new Error(e && e.message === 'Partage trop volumineux' ? e.message : 'Lien de partage illisible');
  }
  if (!raw || raw.v !== 1 || !Array.isArray(raw.l)) throw new Error('Lien de partage illisible');
  return clean({ name: raw.n, date: raw.d, expires: raw.x, links: raw.l.map((x) => ({ title: x && x[0], url: x && x[1], note: x && x[2] })) });
}

// ---- Partage protégé par mot de passe ------------------------------------------------------
// Le contenu est chiffré dans le navigateur (AES-GCM, clé tirée du mot de passe par PBKDF2) :
// ni le serveur ni Google ne peuvent le lire, et la page le déchiffre chez le visiteur.
export const KDF_ITERATIONS = 600000;

async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey('raw', textEncoder.encode(String(password)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Chiffre un texte avec une clé déjà dérivée ; renvoie sel + iv + texte chiffré en base64url. */
export async function sealWithKey(key, salt, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(plain)));
  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0); out.set(iv, salt.length); out.set(ct, salt.length + iv.length);
  return toBase64Url(out);
}

/** Nouvelle clé pour un mot de passe (sel aléatoire). La clé brute peut être gardée sur l'appareil pour les mises à jour. */
export async function newKey(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await keyFrom(password, salt);
  return { key, salt, raw: toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', key))), saltB64: toBase64Url(salt) };
}
export async function importKey(rawB64) {
  return crypto.subtle.importKey('raw', fromBase64Url(rawB64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}
export const saltFrom = (b64) => fromBase64Url(b64);

/** Déchiffre ; erreur « Mot de passe incorrect » si la clé ne convient pas. */
export async function unseal(sealed, password) {
  if (!sealed || !/^[A-Za-z0-9_-]+$/.test(sealed)) throw new Error('Partage illisible');
  const bytes = fromBase64Url(sealed);
  if (bytes.length < 16 + 12 + 17) throw new Error('Partage illisible');
  const key = await keyFrom(password, bytes.slice(0, 16));
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(16, 28) }, key, bytes.slice(28));
    return new TextDecoder().decode(plain);
  } catch { throw new Error('Mot de passe incorrect'); }
}

/** Lien /b protégé : le paramètre « d » habituel, chiffré avec le mot de passe. */
export async function encodeLocked(board, password) {
  const { key, salt } = await newKey(password);
  return sealWithKey(key, salt, await encode(board));
}
export async function decodeLocked(e, password) {
  return decode(await unseal(e, password));
}

// ---- Page publiée : un fichier JSON public dans le Drive de son auteur ------------------
// Le Drive sert de « disque dur public » ; la page /p/<id> le lit et l'affiche, sans rien garder.
export const PAGE_KIND = 'leketia-page';
export const MAX_PAGE_BYTES = 1024 * 1024;

/** Contenu du fichier publié dans le Drive. */
export function toPage(board) {
  const b = clean(board);
  return { kind: PAGE_KIND, v: 1, n: b.name, d: b.date, l: b.links.map((l) => (l.img ? [l.title, l.url, l.note, l.img] : l.note ? [l.title, l.url, l.note] : [l.title, l.url])), ...(b.expires ? { x: b.expires } : {}) };
}

/** Page publiée protégée : le contenu est chiffré, seule la date d'expiration reste lisible (le serveur la fait respecter). */
export async function toLockedPage(board, key, salt) {
  const page = toPage(board);
  return { kind: PAGE_KIND, v: 2, enc: await sealWithKey(key, salt, JSON.stringify(page)), ...(page.x ? { x: page.x } : {}) };
}
export async function openLockedPage(raw, password) {
  if (!raw || raw.kind !== PAGE_KIND || raw.v !== 2 || typeof raw.enc !== 'string') throw new Error('Ce n’est pas une page leketia protégée');
  return fromPage(JSON.parse(await unseal(raw.enc, password)));
}

/** Lit un fichier publié ; refuse tout ce qui n'est pas une page leketia. */
export function fromPage(raw) {
  if (!raw || raw.kind !== PAGE_KIND || raw.v !== 1 || !Array.isArray(raw.l)) throw new Error('Ce n’est pas une page leketia');
  return clean({ name: raw.n, date: raw.d, expires: raw.x, links: raw.l.map((x) => ({ title: x && x[0], url: x && x[1], note: x && x[2], img: x && x[3] })) });
}

/** Empreinte du contenu (sans la date) : sert à savoir si la page publiée est à jour. */
export async function pageHash(board) {
  const { n, l } = toPage(board);
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(JSON.stringify([n, l])));
  return toBase64Url(new Uint8Array(digest)).slice(0, 22);
}

/** Texte Markdown, le format que les agents IA lisent le mieux. */
export function toMarkdown(board, { source } = {}) {
  const b = clean(board);
  const esc = (s) => s.replace(/([\[\]])/g, '\\$1');
  const lines = [`# ${b.name}`, '', `${b.links.length} lien${b.links.length > 1 ? 's' : ''}${b.date ? `, partagé le ${b.date}` : ''} depuis leketia.`, ''];
  for (const l of b.links) {
    lines.push(`- [${esc(l.title || l.url)}](${l.url})`);
    if (l.note) lines.push(`  ${l.note.replace(/\s*\n\s*/g, ' ')}`);
  }
  if (source) lines.push('', `Source : ${source}`);
  return lines.join('\n') + '\n';
}
