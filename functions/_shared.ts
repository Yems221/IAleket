// Shared crypto & utilities for HomeBoard API functions

export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.randomUUID();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hash = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expectedHash] = stored.split(':');
  if (!salt || !expectedHash) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const actualHash = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return actualHash === expectedHash;
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function sessionCookie(token: string, maxAge: number): string {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

// Types média autorisés (images + vidéos) : extension, catégorie, taille max (Mo).
// Source unique partagée par l'upload classique (/api/upload) et le partage natif (/share-target).
export const MEDIA_TYPES: Record<string, { ext: string; kind: 'image' | 'video'; max: number }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image', max: 15 },
  'image/png': { ext: 'png', kind: 'image', max: 15 },
  'image/webp': { ext: 'webp', kind: 'image', max: 15 },
  'image/gif': { ext: 'gif', kind: 'image', max: 15 },
  'image/avif': { ext: 'avif', kind: 'image', max: 15 },
  'video/mp4': { ext: 'mp4', kind: 'video', max: 100 },
  'video/quicktime': { ext: 'mov', kind: 'video', max: 100 },
  'video/webm': { ext: 'webm', kind: 'video', max: 100 },
};

// Types
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  R2_PUBLIC_BASE_URL: string;
  SETUP_KEY: string;
  // Cloudflare Browser Rendering binding (fallback pour les pages JS/anti-bot : Instagram, etc.)
  BROWSER?: Fetcher;
}

export interface User {
  id: string;
  username: string;
  display_name: string;
}

export interface Space {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface Item {
  id: string;
  space_id: string;
  type: 'link' | 'photo';
  title: string;
  description: string;
  url: string;
  image_url: string;
  price: string;
  status: 'moodboard' | 'proposition' | 'achete';
  purchased_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  purchased_by_display_name?: string;
  created_by_display_name?: string;
  space_ids?: string[];
}

// ---- Helpers items / catégories / corbeille ------------------------------

// Convertit space_ids_csv (GROUP_CONCAT) en tableau space_ids sur chaque ligne.
export function withSpaceIds<T extends Record<string, unknown>>(row: T): T {
  const csv = row['space_ids_csv'];
  const out = { ...row } as Record<string, unknown>;
  delete out['space_ids_csv'];
  out['space_ids'] = csv ? String(csv).split(',').filter(Boolean) : [];
  return out as T;
}

// image_url stockée = "/images/{key}" ; l'objet R2 = "uploads/{key}".
export function r2KeyFromImageUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/images/')) return null;
  return url.replace('/images/', 'uploads/');
}

// Purge définitive de la corbeille : items supprimés depuis > 30 jours (+ objets R2).
export async function purgeOldTrash(env: Env): Promise<void> {
  const res = await env.DB.prepare(
    `SELECT id, image_url FROM items WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`,
  ).all();
  const rows = (res.results || []) as { id: string; image_url: string }[];
  if (!rows.length) return;

  for (const r of rows) {
    const key = r2KeyFromImageUrl(r.image_url);
    if (key) {
      try { await env.STORAGE.delete(key); } catch { /* ignore */ }
    }
  }
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => '?').join(',');
  await env.DB.prepare(`DELETE FROM item_spaces WHERE item_id IN (${ph})`).bind(...ids).run();
  await env.DB.prepare(`DELETE FROM items WHERE id IN (${ph})`).bind(...ids).run();
}
