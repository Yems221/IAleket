// leketia — sauvegarde dans Google Drive, sans serveur.
// Interface : Drive.available() puis Drive.save(file) → { name, link }.
// Connexion Google « Identity Services » côté navigateur, accès limité aux fichiers créés par
// leketia (scope drive.file). Le jeton reste en mémoire : il n'est jamais écrit sur l'appareil.
const Drive = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'leketia';
  const FOLDER_KEY = 'driveFolderId';
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

  // Dossier « leketia » dans le Drive. drive.file ne voit que ce que leketia a créé : on retrouve
  // le dossier par son identifiant mémorisé, sinon on en crée un.
  async function folderId(accessToken) {
    const known = await idbRun('meta', 'readonly', (s) => s.get(FOLDER_KEY));
    if (known) {
      try {
        const f = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(known)}?fields=id,trashed`, accessToken);
        if (!f.trashed) return f.id;
      } catch { /* dossier supprimé ou inaccessible : on en recrée un */ }
    }
    const created = await api('https://www.googleapis.com/drive/v3/files?fields=id', accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
    });
    await idbRun('meta', 'readwrite', (s) => s.put(created.id, FOLDER_KEY));
    return created.id;
  }

  // Envoie le fichier dans le dossier leketia. Chaque sauvegarde est un nouveau fichier daté :
  // on garde l'historique, rien n'est écrasé.
  async function save(file) {
    if (!(await available())) throw new Error('Google Drive n’est pas configuré sur cette instance');
    const accessToken = await getToken();
    const parent = await folderId(accessToken);
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify({ name: file.name, parents: [parent], mimeType: file.type || 'text/html' })], { type: 'application/json' }));
    body.append('file', file);
    const sent = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', accessToken, {
      method: 'POST', body,
    });
    await idbRun('meta', 'readwrite', (s) => s.put(Date.now(), 'lastDriveBackupAt'));
    return { name: sent.name, link: sent.webViewLink };
  }

  return { available, save };
})();
