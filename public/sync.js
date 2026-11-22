// leketia — synchronisation entre les appareils d'un même compte Google, sans base de données.
// Le journal partagé est un fichier du dossier caché du Drive (leketia-sync.json), lisible seulement par leketia.
// Chaque passage : lire la version du Drive (si elle a changé), fusionner lien par lien avec cet appareil,
// appliquer ici, renvoyer si le Drive est en retard. Les images voyagent à part, une seule fois chacune.
// Passages : à l'ouverture, au retour sur l'app, toutes les 30 s tant qu'elle est visible, et 2 s après une modification.
const Sync = (() => {
  const FILE = 'leketia-sync.json';
  const MEDIA = 'leketia-media-';
  const MAX_MEDIA = 25 * 1024 * 1024; // les vidéos plus lourdes restent sur l'appareil qui les a
  const BASE = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  let running = null;
  let again = false;
  let state = { status: 'off', at: 0, error: '' }; // off | idle | syncing | error

  const set = (patch) => { state = { ...state, ...patch }; window.dispatchEvent(new CustomEvent('leketia:sync-state', { detail: state })); };
  const q = (s) => encodeURIComponent(s);

  async function findFile(token) {
    const res = await Drive.api(`${BASE}?spaces=appDataFolder&q=${q(`name='${FILE}'`)}&orderBy=modifiedTime%20desc&fields=files(id,version,modifiedTime)`, token);
    return res.files || [];
  }

  async function readFile(token, id) {
    const res = await fetch(`${BASE}/${q(id)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && data.kind === 'leketia-sync' && Array.isArray(data.items) ? data : null;
  }

  async function writeFile(token, id, merged) {
    const body = JSON.stringify({ kind: 'leketia-sync', v: 1, at: new Date().toISOString(), ...merged });
    if (id) {
      return Drive.api(`${UPLOAD}/${q(id)}?uploadType=media&fields=id,version`, token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    }
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: FILE, parents: ['appDataFolder'], mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    return Drive.api(`${UPLOAD}?uploadType=multipart&fields=id,version`, token, { method: 'POST', body: form });
  }

  // Images : chaque image utilisée est envoyée une fois ; une image absente ici est récupérée.
  async function syncMedia(token, merged, meta) {
    const uploaded = new Set(meta.mediaUp || []);
    const used = [...new Set(merged.items.filter((it) => !it.deleted_at).map((it) => Store.refId(it.image_url)).filter(Boolean))];
    let fetched = 0;
    for (const id of used) {
      const rec = await Store.mediaRecord(id);
      if (rec && !uploaded.has(id)) {
        if (rec.blob.size <= MAX_MEDIA) {
          const exists = await Drive.api(`${BASE}?spaces=appDataFolder&q=${q(`name='${MEDIA}${id}'`)}&fields=files(id)`, token);
          if (!(exists.files || []).length) {
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify({ name: MEDIA + id, parents: ['appDataFolder'], mimeType: rec.type || rec.blob.type || 'application/octet-stream', appProperties: { kind: rec.kind } })], { type: 'application/json' }));
            form.append('file', rec.blob);
            await Drive.api(`${UPLOAD}?uploadType=multipart&fields=id`, token, { method: 'POST', body: form });
          }
        }
        uploaded.add(id);
      } else if (!rec) {
        const found = await Drive.api(`${BASE}?spaces=appDataFolder&q=${q(`name='${MEDIA}${id}'`)}&fields=files(id,mimeType,appProperties)`, token);
        const f = (found.files || [])[0];
        if (!f) continue; // pas encore envoyée par l'autre appareil : au prochain passage
        const res = await fetch(`${BASE}/${q(f.id)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) continue;
        const blob = await res.blob();
        await Store.putMediaRecord({ id, blob, kind: (f.appProperties && f.appProperties.kind) || 'image', type: f.mimeType || blob.type, createdAt: Date.now() });
        uploaded.add(id);
        fetched++;
      }
    }
    return { mediaUp: [...uploaded].filter((id) => used.includes(id)), fetched };
  }

  async function mediaPending(state, meta) {
    const up = new Set(meta.mediaUp || []);
    for (const it of state.items) {
      const id = !it.deleted_at && Store.refId(it.image_url);
      if (id && (!up.has(id) || !(await Store.mediaRecord(id)))) return true;
    }
    return false;
  }

  async function once() {
    const token = await Drive.silentToken().catch(() => null);
    if (!token) { set({ status: 'off' }); return { skipped: true }; }
    set({ status: 'syncing', error: '' });
    const M = window.SyncMerge;
    const meta = await Store.syncMeta();
    const local = await Store.syncState();
    const localFp = M.fingerprint(local);

    const files = await findFile(token);
    const head = files[0] || null;
    if (head && head.version === meta.version && localFp === meta.fp) {
      // Rien n'a changé ; reste peut-être une image à envoyer ou à récupérer (échec réseau d'un passage précédent).
      if (await mediaPending(local, meta)) {
        const media = await syncMedia(token, local, meta).catch(() => null);
        if (media) {
          await Store.setSyncMeta({ ...meta, mediaUp: media.mediaUp, at: Date.now() });
          if (media.fetched) window.dispatchEvent(new CustomEvent('leketia:synced', { detail: { applied: 0, media: media.fetched } }));
        }
      }
      set({ status: 'idle', at: Date.now() });
      return { applied: 0 };
    }

    // Plusieurs fichiers (deux appareils l'ont créé en même temps) : on les fusionne tous, on garde le plus récent.
    let remote = null;
    for (const f of files) {
      const data = await readFile(token, f.id);
      remote = data ? (remote ? M.merge(remote, data) : data) : remote;
    }
    const merged = M.merge(local, remote);
    const mergedFp = M.fingerprint(merged);
    const applied = mergedFp !== localFp ? await Store.syncApply(merged) : 0;

    let version = head ? head.version : null;
    let fileId = head ? head.id : null;
    if (!remote || M.fingerprint(M.merge(remote, null)) !== mergedFp || files.length > 1) {
      const w = await writeFile(token, fileId, merged);
      fileId = w.id;
      version = w.version;
      for (const extra of files.slice(1)) await fetch(`${BASE}/${q(extra.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }

    const media = await syncMedia(token, merged, meta).catch(() => ({ mediaUp: meta.mediaUp || [], fetched: 0 }));
    await Store.setSyncMeta({ version, fp: mergedFp, mediaUp: media.mediaUp, at: Date.now() });
    set({ status: 'idle', at: Date.now() });
    if (applied || media.fetched) window.dispatchEvent(new CustomEvent('leketia:synced', { detail: { applied, media: media.fetched } }));
    return { applied };
  }

  // Un seul passage à la fois ; une demande pendant un passage en relance un juste après.
  function run() {
    if (running) { again = true; return running; }
    running = once()
      .catch((e) => { set({ status: 'error', error: e && e.message ? e.message : 'Synchronisation impossible' }); return { error: true }; })
      .finally(() => { running = null; if (again) { again = false; setTimeout(run, 500); } });
    return running;
  }

  let timer = null;
  let debounce = null;
  function start() {
    run();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
    window.addEventListener('online', run);
    window.addEventListener('leketia:changed', () => { clearTimeout(debounce); debounce = setTimeout(run, 2000); });
    clearInterval(timer);
    timer = setInterval(() => { if (document.visibilityState === 'visible') run(); }, 30000);
  }

  return { start, run, state: () => state };
})();
