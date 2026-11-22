// leketia — stockage sur l'appareil.
// Remplace la base serveur de HomeBoard (D1 + R2) en répondant aux mêmes adresses
// (/api/spaces, /api/items…) avec les mêmes formes de réponse : l'interface n'a pas
// à savoir que les données sont locales. Seuls les aperçus de liens passent par le réseau.
const Store = (() => {
  const MEDIA_PREFIX = 'media:';
  const TRASH_DAYS = 30;
  const STATUSES = ['a_voir', 'vu', 'favori'];
  const urlByMedia = new Map(); // id du média → adresse blob: affichable
  const mediaByUrl = new Map(); // adresse blob: → { id, kind }

  const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  const fail = (message) => { throw new Error(message); };
  const text = (v, max = 2000) => String(v == null ? '' : v).slice(0, max);

  // Seuls les liens http(s) sont conservés : bloque javascript:, data:, etc.
  function safeLink(raw) {
    const s = text(raw).trim();
    if (!s) return '';
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch { return ''; }
  }

  // ---- Médias (photos, vidéos, miniatures) --------------------------------
  async function urlForMedia(id) {
    if (urlByMedia.has(id)) return urlByMedia.get(id);
    const rec = await idbRun('media', 'readonly', (s) => s.get(id));
    if (!rec) return '';
    const url = URL.createObjectURL(rec.blob);
    urlByMedia.set(id, url);
    mediaByUrl.set(url, { id, kind: rec.kind });
    return url;
  }

  async function saveMedia(blob, kind) {
    const id = await idbSaveMedia(blob, kind);
    return { id, url: await urlForMedia(id), kind };
  }

  const kindOf = (url) => (mediaByUrl.get(url) || {}).kind || 'image';
  // L'interface manipule des adresses blob: ; en base on garde « media:<id> ».
  const toRef = (url) => (mediaByUrl.has(url) ? MEDIA_PREFIX + mediaByUrl.get(url).id : '');
  const refId = (ref) => (typeof ref === 'string' && ref.startsWith(MEDIA_PREFIX) ? ref.slice(MEDIA_PREFIX.length) : '');

  async function deleteMediaRef(ref) {
    const id = refId(ref);
    if (!id) return;
    const url = urlByMedia.get(id);
    if (url) { URL.revokeObjectURL(url); urlByMedia.delete(id); mediaByUrl.delete(url); }
    await idbRun('media', 'readwrite', (s) => s.delete(id));
  }

  // Réduit une image à une miniature légère avant de la garder.
  async function shrink(blob, maxSide = 640) {
    try {
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const out = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.82));
      return out || blob;
    } catch { return blob; }
  }

  // ---- Lecture -------------------------------------------------------------
  const allSpaces = () => idbRun('spaces', 'readonly', (s) => s.getAll());
  const allItems = () => idbRun('items', 'readonly', (s) => s.getAll());
  const putItem = (item) => idbRun('items', 'readwrite', (s) => s.put(item));

  async function present(item) {
    const id = refId(item.image_url);
    const out = { ...item, media_kind: 'image' };
    if (id) {
      out.image_url = await urlForMedia(id);
      out.media_kind = kindOf(out.image_url);
    } else {
      out.image_url = ''; // jamais d'image chargée depuis un site tiers
    }
    return out;
  }

  async function listItems(filter) {
    const rows = (await allItems()).filter(filter).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return Promise.all(rows.map(present));
  }

  async function getItem(id) {
    return (await idbRun('items', 'readonly', (s) => s.get(id))) || fail('Élément introuvable');
  }

  // ---- Entretien -----------------------------------------------------------
  // Corbeille : suppression définitive après 30 jours. Médias orphelins : nettoyés après un jour.
  async function housekeeping() {
    const items = await allItems();
    const limit = Date.now() - TRASH_DAYS * 86400000;
    for (const it of items) {
      if (it.deleted_at && new Date(it.deleted_at.replace(' ', 'T') + 'Z').getTime() < limit) {
        await deleteMediaRef(it.image_url);
        await idbRun('items', 'readwrite', (s) => s.delete(it.id));
      }
    }
    const used = new Set(items.map((it) => refId(it.image_url)).filter(Boolean));
    const media = await idbRun('media', 'readonly', (s) => s.getAll());
    for (const m of media) {
      if (!used.has(m.id) && m.createdAt < Date.now() - 86400000) await deleteMediaRef(MEDIA_PREFIX + m.id);
    }
    // Demande au navigateur de ne pas effacer ces données de lui-même.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  async function ensureDefaultSpace() {
    const spaces = await allSpaces();
    if (spaces.length) return;
    await idbRun('spaces', 'readwrite', (s) => s.put({
      id: crypto.randomUUID(), name: 'Journal', sort_order: 0, created_at: nowSql(), updated_at: nowSql(),
    }));
  }

  // ---- Aperçu d'un lien (seul appel réseau) --------------------------------
  async function fetchLink(body) {
    const res = await fetch('/api/fetch-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok && !data.ok) fail(data.error || `Erreur ${res.status}`);
    const remote = data.preview && data.preview.image_url;
    if (remote) {
      data.preview.image_url = '';
      try {
        const img = await fetch('/api/thumb?url=' + encodeURIComponent(remote));
        if (img.ok) data.preview.image_url = (await saveMedia(await shrink(await img.blob()), 'image')).url;
      } catch { /* pas de miniature : la carte s'affiche sans image */ }
    }
    return data;
  }

  // ---- Mêmes adresses que l'ancienne API serveur ----------------------------
  async function api(path, { method = 'GET', body } = {}) {
    const url = new URL(path, location.origin);
    const p = url.pathname;
    let m;

    if (p === '/api/fetch-link' && method === 'POST') return fetchLink(body);

    if (p === '/api/spaces' && method === 'GET') {
      await ensureDefaultSpace();
      const items = (await allItems()).filter((it) => !it.deleted_at);
      const spaces = (await allSpaces())
        .sort((a, b) => (a.sort_order - b.sort_order) || (a.created_at < b.created_at ? -1 : 1))
        .map((s) => ({ ...s, item_count: items.filter((it) => (it.space_ids || []).includes(s.id)).length }));
      return { ok: true, spaces };
    }

    if (p === '/api/spaces' && method === 'POST') {
      const name = text(body && body.name, 60).trim() || fail('Nom requis');
      const spaces = await allSpaces();
      if (spaces.some((s) => s.name.toLowerCase() === name.toLowerCase())) fail('Cette collection existe déjà');
      const space = { id: crypto.randomUUID(), name, sort_order: spaces.length, created_at: nowSql(), updated_at: nowSql() };
      await idbRun('spaces', 'readwrite', (s) => s.put(space));
      return { ok: true, space };
    }

    if (p === '/api/items' && method === 'GET') {
      const trash = url.searchParams.get('trash') === '1';
      return { ok: true, items: await listItems((it) => (trash ? !!it.deleted_at : !it.deleted_at)) };
    }

    if ((m = p.match(/^\/api\/spaces\/([^/]+)\/items$/))) {
      const spaceId = decodeURIComponent(m[1]);
      if (method === 'GET') {
        return { ok: true, items: await listItems((it) => !it.deleted_at && (it.space_ids || []).includes(spaceId)) };
      }
      if (method === 'POST') {
        const known = new Set((await allSpaces()).map((s) => s.id));
        const spaceIds = [...new Set([spaceId, ...((body && body.space_ids) || [])])].filter((id) => known.has(id));
        if (!spaceIds.length) fail('Collection introuvable');
        const type = body.type === 'photo' ? 'photo' : 'link';
        const link = safeLink(body.url);
        if (type === 'link' && !link) fail('Lien invalide : il doit commencer par http ou https');
        const item = {
          id: crypto.randomUUID(), space_id: spaceIds[0], space_ids: spaceIds, type,
          title: text(body.title, 300).trim() || (link ? new URL(link).hostname.replace(/^www\./, '') : 'Sans titre'),
          description: text(body.description).trim(), url: link, image_url: toRef(body.image_url),
          price: '', status: 'a_voir', deleted_at: null, created_at: nowSql(), updated_at: nowSql(),
        };
        await putItem(item);
        return { ok: true, item: await present(item) };
      }
    }

    if ((m = p.match(/^\/api\/items\/([^/]+)\/status$/)) && method === 'PATCH') {
      const item = await getItem(decodeURIComponent(m[1]));
      if (!STATUSES.includes(body && body.status)) fail('Statut inconnu');
      await putItem({ ...item, status: body.status, updated_at: nowSql() });
      return { ok: true };
    }

    if ((m = p.match(/^\/api\/items\/([^/]+)$/))) {
      const item = await getItem(decodeURIComponent(m[1]));
      if (method === 'PUT') {
        if (body && body.restore) {
          await putItem({ ...item, deleted_at: null, updated_at: nowSql() });
          return { ok: true };
        }
        const known = new Set((await allSpaces()).map((s) => s.id));
        const spaceIds = ((body && body.space_ids) || item.space_ids).filter((id) => known.has(id));
        if (!spaceIds.length) fail('Choisis au moins une collection');
        const link = item.type === 'link' ? safeLink(body.url) || item.url : safeLink(body.url);
        await putItem({
          ...item, title: text(body.title, 300).trim() || item.title, description: text(body.description).trim(),
          url: link, space_ids: spaceIds, space_id: spaceIds[0], updated_at: nowSql(),
        });
        return { ok: true };
      }
      if (method === 'DELETE') {
        if (url.searchParams.get('permanent') === '1') {
          await deleteMediaRef(item.image_url);
          await idbRun('items', 'readwrite', (s) => s.delete(item.id));
        } else {
          await putItem({ ...item, deleted_at: nowSql(), updated_at: nowSql() });
        }
        return { ok: true };
      }
    }

    fail('Action inconnue');
  }

  // ---- Sauvegarde : export et import ---------------------------------------
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

  // Tout le journal, ou seulement une collection. Les vidéos ne sont pas incluses (trop lourdes).
  async function exportData(spaceId) {
    const items = (await allItems()).filter((it) => !it.deleted_at && (!spaceId || (it.space_ids || []).includes(spaceId)));
    const keep = new Set(items.flatMap((it) => it.space_ids || []));
    const spaces = (await allSpaces()).filter((s) => !spaceId || keep.has(s.id));
    const media = [];
    let skippedVideos = 0;
    for (const it of items) {
      const id = refId(it.image_url);
      if (!id) continue;
      const rec = await idbRun('media', 'readonly', (s) => s.get(id));
      if (!rec) continue;
      if (rec.kind === 'video') { skippedVideos++; continue; }
      media.push({ id, kind: rec.kind, type: rec.type || rec.blob.type || 'image/webp', data: await blobToBase64(rec.blob) });
    }
    return {
      data: { format: 'leketia-export', schemaVersion: 1, exportedAt: new Date().toISOString(), spaces, items, media },
      count: items.length, skippedVideos,
    };
  }

  // Fichier lisible tel quel dans un navigateur, et réimportable : les données sont dans une balise <script>.
  async function exportFile(spaceId) {
    const { data, count, skippedVideos } = await exportData(spaceId);
    const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rows = data.items.map((it) => `<li><strong>${escHtml(it.title)}</strong>${it.url ? ` — <a href="${escHtml(it.url)}">${escHtml(it.url)}</a>` : ''}<br><small>${escHtml(it.created_at)}</small></li>`).join('\n');
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const day = data.exportedAt.slice(0, 10);
    const stamp = data.exportedAt.slice(0, 16).replace('T', '-').replace(':', 'h');
    const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>leketia — sauvegarde du ${day}</title><body style="font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.5"><h1>leketia — sauvegarde du ${day}</h1><p>${count} élément(s). Pour restaurer : ouvre leketia, « Sauvegarde », puis « Importer un fichier ».</p><ol>${rows}</ol><script type="application/json" id="leketia-data">${json}</script></body></html>`;
    await idbRun('meta', 'readwrite', (s) => s.put(Date.now(), 'lastBackupAt'));
    return { file: new File([html], `leketia-${stamp}.html`, { type: 'text/html' }), count, skippedVideos };
  }

  // Un fichier importé n'est pas digne de confiance : chaque champ est revérifié.
  async function importFile(file) {
    const raw = await file.text();
    let data;
    try {
      const m = raw.match(/<script type="application\/json" id="leketia-data">([\s\S]*?)<\/script>/);
      data = JSON.parse(m ? m[1] : raw);
    } catch { fail('Ce fichier n’est pas une sauvegarde leketia lisible'); }
    if (!data || data.format !== 'leketia-export' || !Array.isArray(data.items)) fail('Ce fichier n’est pas une sauvegarde leketia');
    if (data.schemaVersion !== 1) fail('Sauvegarde créée par une version plus récente d’leketia');

    const spaces = await allSpaces();
    const byName = new Map(spaces.map((s) => [s.name.toLowerCase(), s.id]));
    const spaceMap = new Map();
    for (const s of Array.isArray(data.spaces) ? data.spaces : []) {
      const name = text(s && s.name, 60).trim();
      if (!name) continue;
      let id = byName.get(name.toLowerCase());
      if (!id) {
        id = crypto.randomUUID();
        await idbRun('spaces', 'readwrite', (st) => st.put({ id, name, sort_order: byName.size, created_at: nowSql(), updated_at: nowSql() }));
        byName.set(name.toLowerCase(), id);
      }
      spaceMap.set(String(s.id), id);
    }
    await ensureDefaultSpace();
    const fallback = (await allSpaces())[0].id;

    const mediaById = new Map((Array.isArray(data.media) ? data.media : []).map((m) => [String(m && m.id), m]));
    const existing = new Set((await allItems()).map((it) => it.id));
    let added = 0, skipped = 0;
    for (const it of data.items) {
      const id = text(it && it.id, 80);
      const type = it && it.type === 'photo' ? 'photo' : 'link';
      const link = safeLink(it && it.url);
      if (!id || existing.has(id) || (type === 'link' && !link)) { skipped++; continue; }
      let imageRef = '';
      const m = mediaById.get(refId(it.image_url));
      if (m && typeof m.data === 'string' && /^image\/(webp|jpeg|png|gif|avif)$/.test(m.type)) {
        try {
          const bytes = Uint8Array.from(atob(m.data), (c) => c.charCodeAt(0));
          imageRef = MEDIA_PREFIX + (await idbSaveMedia(new Blob([bytes], { type: m.type }), 'image'));
        } catch { /* image illisible : l'élément est importé sans elle */ }
      }
      const spaceIds = [...new Set((Array.isArray(it.space_ids) ? it.space_ids : []).map((s) => spaceMap.get(String(s))).filter(Boolean))];
      if (!spaceIds.length) spaceIds.push(fallback);
      const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(it.created_at) ? it.created_at : nowSql();
      await putItem({
        id, type, space_id: spaceIds[0], space_ids: spaceIds, title: text(it.title, 300) || 'Sans titre',
        description: text(it.description), url: link, image_url: imageRef, price: '',
        status: STATUSES.includes(it.status) ? it.status : 'a_voir', deleted_at: null, created_at: date, updated_at: nowSql(),
      });
      existing.add(id);
      added++;
    }
    return { added, skipped };
  }

  // Board reçu par QR ou lien : ajouté dans une collection du même nom, sans doublon de lien.
  async function importShared(board) {
    const name = text(board.name, 60).trim() || 'Board partagé';
    const spaces = await allSpaces();
    let space = spaces.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!space) {
      space = { id: crypto.randomUUID(), name, sort_order: spaces.length, created_at: nowSql(), updated_at: nowSql() };
      await idbRun('spaces', 'readwrite', (s) => s.put(space));
    }
    const known = new Set((await allItems()).filter((it) => !it.deleted_at).map((it) => it.url));
    let added = 0, skipped = 0;
    for (const l of board.links) {
      const link = safeLink(l.url);
      if (!link || known.has(link)) { skipped++; continue; }
      await putItem({
        id: crypto.randomUUID(), type: 'link', space_id: space.id, space_ids: [space.id],
        title: text(l.title, 300) || new URL(link).hostname.replace(/^www\./, ''), description: text(l.note, 2000),
        url: link, image_url: '', price: '', status: 'a_voir', deleted_at: null, created_at: nowSql(), updated_at: nowSql(),
      });
      known.add(link);
      added++;
    }
    return { added, skipped, collection: name };
  }

  const lastBackupAt = () => idbRun('meta', 'readonly', (s) => s.get('lastBackupAt'));

  // Prévenir l'app quand le journal change (ex. pour mettre à jour une page publiée).
  const changed = () => window.dispatchEvent(new Event('leketia:changed'));
  const notifying = (fn) => async (...args) => { const out = await fn(...args); changed(); return out; };
  async function apiNotifying(path, opts = {}) {
    const out = await api(path, opts);
    if (opts.method && opts.method !== 'GET' && path !== '/api/fetch-link') changed();
    return out;
  }

  // Pages publiées : quelle collection, quel fichier Drive, quel contenu a été envoyé.
  const publications = async () => (await idbRun('meta', 'readonly', (s) => s.get('publications'))) || {};
  const savePublications = (all) => idbRun('meta', 'readwrite', (s) => s.put(all, 'publications'));

  return { api: apiNotifying, saveMedia, urlForMedia, kindOf, housekeeping, exportFile, importFile: notifying(importFile), importShared: notifying(importShared), lastBackupAt, safeLink, publications, savePublications };
})();
