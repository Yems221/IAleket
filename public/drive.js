// leketia — sauvegarde dans Google Drive, sans serveur, dans le dossier caché de l'app (comme WhatsApp).
// Interface : Drive.available(), Drive.save(file), Drive.list(), Drive.download(id).
// Le dossier caché (appDataFolder) n'apparaît pas dans la liste des fichiers du Drive : seule leketia peut le lire,
// depuis n'importe quel appareil connecté au même compte Google. Autorisation drive.appdata, non sensible.
// Le jeton reste en mémoire : il n'est jamais écrit sur l'appareil.
const Drive = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  // Publier une page : accès aux seuls fichiers créés par leketia (drive.file, non sensible), demandé au premier « Publier ».
  const SCOPE_PUBLISH = 'https://www.googleapis.com/auth/drive.file';
  const KEEP = 10; // sauvegardes gardées ; chacune contient tout le journal, la plus récente suffit pour tout restaurer
  let clientId = null;   // identifiant Google de cette instance (public, pas un secret)
  let gisReady = null;   // chargement de la bibliothèque Google, une seule fois
  let tokenClient = null;
  let token = null;      // { value, expiresAt, scope }

  // L'identifiant est propre à chaque instance : il vient de sa configuration serveur.
  async function available() {
    if (clientId !== null) return !!clientId;
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      clientId = res.ok ? (await res.json()).googleClientId || '' : '';
    } catch { clientId = ''; }
    if (clientId) loadGis(); // charger tôt : la fenêtre Google doit s'ouvrir dans le geste du toucher
    return !!clientId;
  }

  function loadGis() {
    if (!gisReady) {
      gisReady = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { gisReady = null; reject(new Error('Connexion à Google impossible')); };
        document.head.appendChild(s);
      });
    }
    return gisReady;
  }

  // Demande un jeton à Google : une fenêtre s'ouvre au premier usage, puis plus rien tant qu'il est valide.
  const hasScope = (scope) => !!token && Date.now() < token.expiresAt - 60000 && token.scope.split(' ').includes(scope);
  async function getToken(scope = SCOPE) {
    if (hasScope(scope)) return token.value;
    await loadGis();
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => {} });
      }
      tokenClient.callback = (resp) => {
        if (resp.error) { reject(new Error('Accès à Google Drive refusé')); return; }
        if (!String(resp.scope || '').split(' ').includes(scope)) { reject(new Error('Accès à Google Drive refusé')); return; }
        token = { value: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000, scope: String(resp.scope || '') };
        try { localStorage.setItem('leketia:drive-lie', '1'); } catch { /* mémoire indisponible */ }
        resolve(token.value);
        window.dispatchEvent(new Event('leketia:drive-token')); // l'app en profite pour relever sa boîte d'arrivée
      };
      tokenClient.error_callback = (err) => {
        reject(new Error(err && err.type === 'popup_closed' ? 'Fenêtre Google fermée : rien n’a été envoyé' : 'Connexion à Google impossible'));
      };
      tokenClient.requestAccessToken({ prompt: '', scope, include_granted_scopes: true });
    });
  }

  async function api(url, accessToken, options = {}) {
    const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
    if (res.status === 401) { token = null; throw new Error('Session Google expirée : réessaie'); }
    if (res.status === 404) throw Object.assign(new Error('Fichier introuvable dans Google Drive'), { status: 404 });
    if (!res.ok) throw new Error(`Google Drive a refusé l’envoi (${res.status})`);
    return res.status === 204 ? null : res.json();
  }

  // Envoie une sauvegarde complète dans le dossier caché, puis ne garde que les KEEP plus récentes.
  // (Le dossier caché n'a pas de corbeille : une sauvegarde retirée l'est définitivement.)
  async function save(file) {
    if (!(await available())) throw new Error('Google Drive n’est pas configuré sur cette instance');
    const accessToken = await getToken();
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify({ name: file.name, parents: ['appDataFolder'], mimeType: file.type || 'text/html' })], { type: 'application/json' }));
    body.append('file', file);
    const sent = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', accessToken, { method: 'POST', body });
    await idbRun('meta', 'readwrite', (s) => s.put(Date.now(), 'lastDriveBackupAt'));
    try {
      const all = await listWith(accessToken);
      for (const old of all.slice(KEEP)) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(old.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      }
    } catch { /* le ménage réessaiera à la prochaine sauvegarde */ }
    return { name: sent.name };
  }

  async function listWith(accessToken) {
    const res = await api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=createdTime%20desc&pageSize=100&fields=files(id,name,createdTime,size)', accessToken);
    return (res.files || []).filter((f) => /^leketia-.*\.html$/.test(f.name));
  }

  // Sauvegardes de ce compte Google, de la plus récente à la plus ancienne, quel que soit l'appareil d'origine.
  async function list() {
    if (!(await available())) throw new Error('Google Drive n’est pas configuré sur cette instance');
    return listWith(await getToken());
  }

  // Télécharge une sauvegarde sous forme de fichier, prête à être importée.
  async function download(id, name) {
    const accessToken = await getToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Sauvegarde illisible (${res.status})`);
    return new File([await res.blob()], name || 'leketia.html', { type: 'text/html' });
  }

  // ---- Boîte d'arrivée : le pont Safari → app installée sur iPhone ---------------------------
  // Sur iPhone, un lien s'ouvre dans Safari, dont la mémoire est séparée de l'app installée. Safari dépose la page
  // dans le dossier caché du Drive (même compte Google) ; l'app la relève dès qu'elle a accès au Drive.
  // C'est le « cookie » de la Biennale, mais rangé dans le Drive de l'utilisateur au lieu d'un serveur.
  const INBOX = /^leketia-inbox-.*\.json$/;

  async function sendToInbox(ref) {
    if (!(await available())) throw new Error('Google Drive n’est pas configuré sur cette instance');
    const accessToken = await getToken();
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify({ name: `leketia-inbox-${Date.now()}.json`, parents: ['appDataFolder'], mimeType: 'application/json' })], { type: 'application/json' }));
    body.append('file', new Blob([JSON.stringify({ kind: 'leketia-inbox', v: 1, ...ref, at: new Date().toISOString() })], { type: 'application/json' }));
    await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', accessToken, { method: 'POST', body });
  }

  // Relève la boîte sans ouvrir de fenêtre Google : seulement si l'accès est déjà donné dans cette session.
  async function takeInbox() {
    if (!hasScope(SCOPE)) return [];
    const accessToken = token.value;
    const res = await api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=createdTime&pageSize=50&fields=files(id,name)', accessToken);
    const out = [];
    for (const f of (res.files || []).filter((x) => INBOX.test(x.name))) {
      try {
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const item = r.ok ? await r.json() : null;
        if (item && item.kind === 'leketia-inbox') out.push(item);
      } catch { /* illisible : on le jette quand même */ }
      await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {});
    }
    return out;
  }

  const linked = () => { try { return localStorage.getItem('leketia:drive-lie') === '1'; } catch { return false; } };
  const connect = () => getToken();

  // ---- Pages publiées : un fichier JSON public, visible dans le Drive de l'auteur -------------
  // Toute personne qui a le lien peut le lire ; leketia.pages.dev/p/<id> l'affiche.

  async function publish(page, name) {
    if (!(await available())) throw new Error('Google Drive n’est pas configuré sur cette instance');
    const accessToken = await getToken(SCOPE_PUBLISH);
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify({
      name: `leketia – ${name}.json`, mimeType: 'application/json',
      description: 'Page publique leketia : toute personne qui a le lien peut la lire. La supprimer retire la page.',
    })], { type: 'application/json' }));
    body.append('file', new Blob([JSON.stringify(page)], { type: 'application/json' }));
    const sent = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', accessToken, { method: 'POST', body });
    try {
      await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sent.id)}/permissions`, accessToken, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
    } catch (e) {
      await unpublish(sent.id).catch(() => {});
      throw new Error('Google Drive refuse de rendre ce fichier public (compte professionnel ou scolaire ?)');
    }
    return sent.id;
  }

  // Réécrit le contenu du fichier publié : même identifiant, donc même adresse publique.
  async function update(id, page) {
    const accessToken = await getToken(SCOPE_PUBLISH);
    await api(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=id`, accessToken, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(page),
    });
  }

  // Retire la page : le fichier est supprimé du Drive.
  async function unpublish(id) {
    const accessToken = await getToken(SCOPE_PUBLISH);
    try { await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' }); }
    catch (e) { if (e.status !== 404) throw e; } // déjà supprimé à la main : c'est retiré
  }

  const canPublishSilently = () => hasScope(SCOPE_PUBLISH);

  return { available, save, list, download, publish, update, unpublish, canPublishSilently, sendToInbox, takeInbox, linked, connect };
})();
