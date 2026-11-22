// leketia — mesure d'audience anonyme (voir docs/TELEMETRIE.md et /confidentialite).
// Ce qui part : des compteurs et des catégories (type d'appareil, réseau social d'un lien, page publiée oui/non).
// Ce qui ne part jamais : les liens, les titres, les notes, les noms de collections, le compte Google, l'adresse IP.
// Seul point de jonction : un identifiant tiré au hasard sur cet appareil, renouvelé tous les 13 mois.
// La personne peut refuser (case dans Sauvegarde, ou « Global Privacy Control » du navigateur) : plus rien ne part.
const Telemetry = (() => {
  const KEY_ID = 'leketia:device';
  const KEY_OFF = 'leketia:mesure-off';
  const KEY_QUEUE = 'leketia:mesure-file';
  const KEY_DAY = 'leketia:mesure-jour';
  const KEY_INSTALL = 'leketia:mesure-install';
  const ROTATE = 395 * 86400000; // 13 mois (recommandation CNIL pour la mesure d'audience exemptée)
  const ENDPOINT = '/api/t';
  const MAX_QUEUE = 200;

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };
  const drop = (k) => { try { localStorage.removeItem(k); } catch { /* idem */ } };

  const gpc = () => navigator.globalPrivacyControl === true;
  const enabled = () => read(KEY_OFF) !== '1' && !gpc();

  function deviceId() {
    let rec = null;
    try { rec = JSON.parse(read(KEY_ID) || 'null'); } catch { rec = null; }
    if (!rec || !rec.id || Date.now() - rec.at > ROTATE) {
      rec = { id: crypto.randomUUID(), at: Date.now() };
      write(KEY_ID, JSON.stringify(rec));
    }
    return rec.id;
  }

  // Catégories, jamais le contenu.
  function rsOf(url) {
    let h = '';
    try { h = new URL(url).hostname.replace(/^www\.|^m\./, '').toLowerCase(); } catch { return 'autre'; }
    if (h.endsWith('instagram.com')) return 'instagram';
    if (h.endsWith('tiktok.com')) return 'tiktok';
    if (h === 'x.com' || h.endsWith('twitter.com')) return 'x';
    if (h.endsWith('youtube.com') || h === 'youtu.be') return 'youtube';
    if (/(^|\.)pinterest\.[a-z.]+$/.test(h) || h === 'pin.it') return 'pinterest';
    if (h.endsWith('linkedin.com') || h === 'lnkd.in') return 'linkedin';
    if (h.endsWith('facebook.com') || h === 'fb.watch') return 'facebook';
    if (h.endsWith('threads.net') || h.endsWith('threads.com')) return 'threads';
    if (h.endsWith('reddit.com')) return 'reddit';
    if (h.endsWith('spotify.com')) return 'spotify';
    return 'autre';
  }
  function context() {
    const ua = navigator.userAgent;
    const touch = navigator.maxTouchPoints || 0;
    const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1) ? 'ios' : /Android/.test(ua) ? 'android' : /Windows|Macintosh|Linux|CrOS/.test(ua) ? 'desktop' : 'autre';
    const p = typeof InstallParcours !== 'undefined' ? InstallParcours.parcours(ua, touch, 'brave' in navigator) : '';
    const browser = /integre/.test(p) ? 'appli' : 'brave' in navigator ? 'brave' : /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox|FxiOS/.test(ua) ? 'firefox' : /Edg/.test(ua) ? 'edge' : /CriOS|Chrome/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'autre';
    const w = Math.min(screen.width, screen.height);
    const form = os === 'desktop' ? 'ordinateur' : w >= 600 ? 'tablette' : 'telephone';
    const installed = typeof Install !== 'undefined' && Install.ouverteInstallee();
    let theme = 'clair';
    try { theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair'; } catch { /* idem */ }
    return { os, browser, form, mode: installed ? 'app' : 'navigateur', theme, lang: (navigator.language || '').slice(0, 2).toLowerCase() };
  }

  // File d'attente gardée sur l'appareil : rien ne se perd hors ligne, tout part en un envoi groupé.
  let queue = [];
  try { queue = JSON.parse(read(KEY_QUEUE) || '[]'); } catch { queue = []; }
  const save = () => write(KEY_QUEUE, JSON.stringify(queue.slice(-MAX_QUEUE)));

  function track(name, props = {}) {
    if (!enabled()) return;
    queue.push({ n: name, t: Date.now(), p: props });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    save();
    clearTimeout(timer);
    timer = setTimeout(flush, 5000);
  }
  let timer = null;

  function flush() {
    if (!enabled()) { queue = []; drop(KEY_QUEUE); return; }
    if (!queue.length || !navigator.onLine) return;
    const batch = queue.slice(0, 50);
    const body = JSON.stringify({ d: deviceId(), v: version, e: batch });
    let sent = false;
    try { sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' })); } catch { sent = false; }
    if (!sent) {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
    queue = queue.slice(batch.length);
    save();
    if (queue.length) setTimeout(flush, 1000);
  }

  let version = '';
  // Une photo du journal par jour : combien de liens par réseau social, de collections, de pages publiées.
  async function dailySnapshot() {
    const day = new Date().toISOString().slice(0, 10);
    if (read(KEY_DAY) === day || typeof Store === 'undefined') return;
    try {
      const items = (await Store.api('/api/items')).items || [];
      const spaces = (await Store.api('/api/spaces')).spaces || [];
      const pubs = await Store.publications();
      const byRs = {};
      let links = 0, photos = 0, videos = 0;
      for (const it of items) {
        if (it.type === 'photo') { if (it.media_kind === 'video') videos++; else photos++; continue; }
        links++;
        const rs = rsOf(it.url);
        byRs[rs] = (byRs[rs] || 0) + 1;
      }
      const pages = Object.values(pubs);
      const sync = typeof Drive !== 'undefined' ? await Drive.syncLinked().catch(() => false) : false;
      track('snapshot', {
        links, photos, videos, collections: spaces.length,
        pages: pages.length, pages_mdp: pages.filter((p) => p.keyRaw).length, pages_limite: pages.filter((p) => p.expires).length,
        sync: !!sync, ...Object.fromEntries(Object.entries(byRs).map(([k, v]) => ['rs_' + k, v])),
      });
      write(KEY_DAY, day);
    } catch { /* au prochain lancement */ }
  }

  function start(v) {
    version = v || '';
    if (!enabled()) return;
    const ctx = context();
    track('app_open', ctx);
    // Installation : l'événement du navigateur (Android, ordinateur), ou la première ouverture depuis l'icône (iPhone).
    if (ctx.mode === 'app' && read(KEY_INSTALL) !== '1') { write(KEY_INSTALL, '1'); track('install', { os: ctx.os, browser: ctx.browser, form: ctx.form, via: 'icone' }); }
    window.addEventListener('appinstalled', () => { if (read(KEY_INSTALL) !== '1') { write(KEY_INSTALL, '1'); track('install', { os: ctx.os, browser: ctx.browser, form: ctx.form, via: 'navigateur' }); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', flush);
    setTimeout(dailySnapshot, 8000);
    setTimeout(flush, 3000);
  }

  function setEnabled(on) {
    if (on) { drop(KEY_OFF); track('mesure_on'); }
    else { write(KEY_OFF, '1'); queue = []; drop(KEY_QUEUE); }
  }

  return { start, track, flush, rsOf, enabled, setEnabled, gpc };
})();
