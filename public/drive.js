// leketia — sauvegarde dans Google Drive, sans serveur, dans le dossier caché de l'app (comme WhatsApp).
// Interface : Drive.available(), Drive.save(file), Drive.list(), Drive.download(id).
// Le dossier caché (appDataFolder) n'apparaît pas dans la liste des fichiers du Drive : seule leketia peut le lire,
// depuis n'importe quel appareil connecté au même compte Google. Autorisation drive.appdata, non sensible.
// Le jeton reste en mémoire : il n'est jamais écrit sur l'appareil.
const Drive = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const KEEP = 10; // sauvegardes gardées ; chacune contient tout le journal, la plus récente suffit pour tout restaurer
  let clientId = null;   // identifiant Google de cette instance (public, pas un secret)
  let gisReady = null;   // chargement de la bibliothèque Google, une seule fois
  let tokenClient = null;
  let token = null;      // { value, expiresAt }

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
  async function getToken() {
    if (token && Date.now() < token.expiresAt - 60000) return token.value;
    await loadGis();
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => {} });
      }
      tokenClient.callback = (resp) => {
        if (resp.error) { reject(new Error('Accès à Google Drive refusé')); return; }
        token = { value: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        resolve(token.value);
      };
      tokenClient.error_callback = (err) => {
        reject(new Error(err && err.type === 'popup_closed' ? 'Fenêtre Google fermée : rien n’a été envoyé' : 'Connexion à Google impossible'));
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  async function api(url, accessToken, options = {}) {
    const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
    if (res.status === 401) { token = null; throw new Error('Session Google expirée : réessaie'); }
    if (!res.ok) throw new Error(`Google Drive a refusé l’envoi (${res.status})`);
    return res.json();
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

  return { available, save, list, download };
})();
