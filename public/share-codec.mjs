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

/** Board partagé : { name, date, links: [{ title, url, note }] }, nettoyé (liens http(s) seulement). */
export function clean(board) {
  const links = (Array.isArray(board && board.links) ? board.links : [])
    .map((l) => ({ title: text(l && l.title, 300).trim(), url: safeLink(l && l.url), note: text(l && l.note, 1000).trim() }))
    .filter((l) => l.url)
    .slice(0, MAX_LINKS);
  return { name: text(board && board.name, 80).trim() || 'Board partagé', date: text(board && board.date, 10), links };
}

export async function encode(board) {
  const b = clean(board);
  const compact = { v: 1, n: b.name, d: b.date, l: b.links.map((l) => (l.note ? [l.title, l.url, l.note] : [l.title, l.url])) };
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
  return clean({ name: raw.n, date: raw.d, links: raw.l.map((x) => ({ title: x && x[0], url: x && x[1], note: x && x[2] })) });
}

// ---- Page publiée : un fichier JSON public dans le Drive de son auteur ------------------
// Le Drive sert de « disque dur public » ; la page /p/<id> le lit et l'affiche, sans rien garder.
export const PAGE_KIND = 'leketia-page';
export const MAX_PAGE_BYTES = 1024 * 1024;

/** Contenu du fichier publié dans le Drive. */
export function toPage(board) {
  const b = clean(board);
  return { kind: PAGE_KIND, v: 1, n: b.name, d: b.date, l: b.links.map((l) => (l.note ? [l.title, l.url, l.note] : [l.title, l.url])) };
}

/** Lit un fichier publié ; refuse tout ce qui n'est pas une page leketia. */
export function fromPage(raw) {
  if (!raw || raw.kind !== PAGE_KIND || raw.v !== 1 || !Array.isArray(raw.l)) throw new Error('Ce n’est pas une page leketia');
  return clean({ name: raw.n, date: raw.d, links: raw.l.map((x) => ({ title: x && x[0], url: x && x[1], note: x && x[2] })) });
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
