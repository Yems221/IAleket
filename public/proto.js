// PROTOTYPE — répond à une question : par quel chemin un lien partagé arrive-t-il dans
// IAleket, et dans quel stockage ? Tout l'état utile est affiché après chaque action.
(() => {
  const $ = (id) => document.getElementById(id);
  const events = [];

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const modeLabel = standalone ? 'App installée' : 'Navigateur';

  function log(message) {
    events.unshift(`${new Date().toLocaleTimeString('fr-FR')} — ${message}`);
    const list = $('log');
    list.replaceChildren(...events.map((e) => Object.assign(document.createElement('li'), { textContent: e })));
  }

  function notice(message) {
    $('notice').textContent = message;
    $('notice').hidden = false;
  }

  // Seuls les liens http(s) sont acceptés : bloque javascript:, data:, etc.
  function safeUrl(raw) {
    try {
      const u = new URL(String(raw || '').trim());
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch {
      return '';
    }
  }

  function readCookie(name) {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? m[1] : '';
  }

  // Un code par type de stockage : on voit lequel est partagé entre Safari et l'app installée.
  async function storageCodes() {
    const fresh = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    let idb = await getMeta('code');
    if (!idb) { idb = fresh(); await setMeta('code', idb); await setMeta('creeLe', Date.now()); }
    let local = '';
    try {
      local = localStorage.getItem('ialeket-proto-code') || '';
      if (!local) { local = fresh(); localStorage.setItem('ialeket-proto-code', local); }
    } catch { local = 'indisponible'; }
    let cookie = readCookie('ialeket_proto_code');
    if (!cookie) {
      cookie = fresh();
      document.cookie = `ialeket_proto_code=${cookie}; Max-Age=${400 * 86400}; Path=/; SameSite=Lax; Secure`;
      cookie = readCookie('ialeket_proto_code') || 'refusé';
    }
    return { idb, local, cookie, creeLe: await getMeta('creeLe') };
  }

  function browserName() {
    const ua = navigator.userAgent;
    if (/CriOS/.test(ua)) return 'Chrome sur iPhone';
    if (/FxiOS/.test(ua)) return 'Firefox sur iPhone';
    if (/EdgiOS/.test(ua)) return 'Edge sur iPhone';
    if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
    if (/Firefox/.test(ua)) return 'Firefox';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome/.test(ua)) return 'Chrome';
    if (/Safari/.test(ua)) return 'Safari';
    return 'inconnu';
  }

  async function renderContext() {
    $('modeLine').textContent = `Mode : ${modeLabel}`;
    const codes = await storageCodes();
    let persisted = 'non disponible';
    let usage = 'non disponible';
    if (navigator.storage) {
      if (navigator.storage.persisted) persisted = (await navigator.storage.persisted()) ? 'oui' : 'non';
      if (navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        usage = `${Math.round((e.usage || 0) / 1024)} Ko sur ${Math.round((e.quota || 0) / 1048576)} Mo`;
      }
    }
    const rows = [
      ['Navigateur', browserName()],
      ['Code de stockage (base locale)', codes.idb],
      ['Code localStorage', codes.local],
      ['Code cookie', codes.cookie],
      ['Stockage créé le', codes.creeLe ? new Date(codes.creeLe).toLocaleString('fr-FR') : '—'],
      ['Stockage protégé contre l’effacement', persisted],
      ['Espace utilisé', usage],
      ['Service worker actif', navigator.serviceWorker && navigator.serviceWorker.controller ? 'oui' : 'non'],
      ['Peut recevoir un partage (Android)', 'serviceWorker' in navigator && !/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'oui, une fois installée depuis Chrome' : 'non sur cet appareil'],
      ['Adresse', location.origin],
      ['Agent', navigator.userAgent],
    ];
    $('context').replaceChildren(...rows.flatMap(([k, v]) => [
      Object.assign(document.createElement('dt'), { textContent: k }),
      Object.assign(document.createElement('dd'), { textContent: v }),
    ]));
  }

  async function renderItems() {
    const items = (await allItems()).sort((a, b) => b.recuLe - a.recuLe);
    $('count').textContent = items.length;
    $('empty').hidden = items.length > 0;
    $('items').replaceChildren(...items.map((item) => {
      const li = document.createElement('li');
      const href = safeUrl(item.url);
      if (href) {
        li.append(Object.assign(document.createElement('a'), { href, textContent: href, target: '_blank', rel: 'noopener noreferrer' }));
      } else {
        li.append(Object.assign(document.createElement('strong'), { textContent: item.texte || item.titre || '(aucun lien lisible)' }));
      }
      const details = [
        `Arrivé par : ${item.via}`,
        `Mode à la réception : ${item.mode}`,
        new Date(item.recuLe).toLocaleString('fr-FR'),
      ];
      if (item.titre) details.push(`Titre : ${item.titre}`);
      if (item.fichier) details.push(`Fichier : ${item.fichier}`);
      details.forEach((d) => li.append(Object.assign(document.createElement('small'), { textContent: d })));
      return li;
    }));
  }

  async function save(rawUrl, via, titre = '') {
    const url = safeUrl(rawUrl);
    if (!url) { notice('Ce n’est pas un lien http(s) valide : rien n’a été enregistré.'); log(`Refusé (${via}) : « ${String(rawUrl).slice(0, 80)} »`); return false; }
    await addItem({ url, titre, texte: '', fichier: '', via, mode: modeLabel, recuLe: Date.now() });
    notice(`Lien enregistré ici, en mode « ${modeLabel} ».`);
    log(`Enregistré (${via}) : ${url}`);
    await renderItems();
    return true;
  }

  // Arrivées par l'adresse : /add?u=… (Raccourci iPhone, ou secours serveur) et /?recu=sw.
  async function handleArrival() {
    const params = new URLSearchParams(location.search);
    if (location.pathname === '/add') {
      const via = params.get('via') === 'secours'
        ? 'Partage Android, rattrapé par le serveur (service worker pas encore actif)'
        : 'Adresse /add (Raccourci iPhone)';
      await save(params.get('u'), via, params.get('t') || '');
    } else if (params.get('recu') === 'sw') {
      notice(`Partage reçu et enregistré ici, en mode « ${modeLabel} ».`);
      log('Partage Android reçu par le service worker');
    }
    if (location.pathname !== '/' || location.search) history.replaceState(null, '', '/');
  }

  async function shareFile(name, type, content) {
    const file = new File([content], name, { type });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
      notice(`Ce navigateur refuse de partager un fichier ${name}.`);
      log(`Partage de fichier impossible : ${name} (${type})`);
      return;
    }
    try {
      await navigator.share({ files: [file], title: 'Export IAleket (test)' });
      log(`Feuille de partage ouverte et validée pour ${name}`);
    } catch (err) {
      log(`Partage de ${name} non abouti : ${err.name}`);
    }
  }

  async function exportPayload() {
    return JSON.stringify({ format: 'ialeket-proto-export', exportedAt: new Date().toISOString(), items: await allItems() }, null, 2);
  }

  $('pasteBtn').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      await save(firstUrl(text) || text, 'Bouton « Coller »');
    } catch (err) {
      notice('Lecture du presse-papiers refusée ou impossible.');
      log(`Presse-papiers : ${err.name}`);
    }
  });

  $('manualForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (await save($('manualUrl').value, 'Saisie manuelle')) $('manualUrl').value = '';
  });

  $('shareHtml').addEventListener('click', async () => {
    // Le JSON est échappé pour ne jamais fermer la balise <script> du fichier exporté.
    const json = (await exportPayload()).replace(/</g, '\\u003c');
    const html = `<!doctype html><meta charset="utf-8"><title>Export IAleket (test)</title><h1>Export IAleket (test)</h1><script type="application/json" id="ialeket-data">${json}</script>`;
    await shareFile('ialeket-test.html', 'text/html', html);
  });

  $('shareJson').addEventListener('click', async () => {
    await shareFile('ialeket-test.json', 'application/json', await exportPayload());
  });

  const shortcutBase = `${location.origin}/add?u=`;
  $('shortcutUrl').textContent = shortcutBase;
  $('copyShortcut').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shortcutBase); notice('Adresse copiée.'); }
    catch { notice('Copie impossible : recopie l’adresse à la main.'); }
  });

  $('clearBtn').addEventListener('click', async () => {
    if (!confirm('Effacer tous les liens enregistrés sur cet appareil ?')) return;
    await clearItems();
    log('Liens effacés');
    await renderItems();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => log(`Service worker non installé : ${err.name}`));
    navigator.serviceWorker.addEventListener('controllerchange', renderContext);
  }

  (async () => {
    log(`Ouverture en mode « ${modeLabel} »`);
    await handleArrival();
    await renderContext();
    await renderItems();
  })();
})();
