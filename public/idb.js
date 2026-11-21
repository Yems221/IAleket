// Leketia — ouverture de la base locale (IndexedDB).
// Chargé par la page ET par le service worker : le schéma n'est défini qu'ici.
const LEKETIA_DB = 'leketia';
const LEKETIA_DB_VERSION = 1;

function openLeketiaDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEKETIA_DB, LEKETIA_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('spaces')) db.createObjectStore('spaces', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Une opération sur un magasin ; résout avec le résultat de la requête renvoyée par fn.
async function idbRun(store, mode, fn) {
  const db = await openLeketiaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Enregistre un fichier (image ou vidéo) et renvoie son identifiant.
async function idbSaveMedia(blob, kind) {
  const id = crypto.randomUUID();
  await idbRun('media', 'readwrite', (s) => s.put({ id, blob, kind, type: blob.type || '', createdAt: Date.now() }));
  return id;
}
