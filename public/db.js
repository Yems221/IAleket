// PROTOTYPE — base locale minimale, chargée à la fois par la page et par le service worker.
const DB_NAME = 'ialeket-proto';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
      req.result.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const req = fn(tx.objectStore(name));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

const addItem = (item) => withStore('items', 'readwrite', (s) => s.add(item));
const allItems = () => withStore('items', 'readonly', (s) => s.getAll());
const clearItems = () => withStore('items', 'readwrite', (s) => s.clear());
const getMeta = (key) => withStore('meta', 'readonly', (s) => s.get(key));
const setMeta = (key, value) => withStore('meta', 'readwrite', (s) => s.put(value, key));

// Les applis mettent souvent le lien dans le champ "text" du partage, pas dans "url".
function firstUrl(text) {
  const m = String(text || '').match(/https?:\/\/\S+/);
  return m ? m[0] : '';
}
