// leketia — inviter à installer l'application, selon le protocole de la Biennale de Dakar.
// - Bannière sous la barre du haut, sur téléphone, dans le navigateur, tant que l'app n'est pas connue installée.
//   La croix la ferme pour la visite en cours seulement ; elle revient à la visite suivante.
// - Le bouton ouvre la fenêtre d'installation du navigateur quand il la propose (Chrome sur Android) ;
//   sinon un guide à étapes montre les gestes du navigateur utilisé, une étape par vue, défilée à la main.
// - Hors de Chrome sur Android et dans le navigateur intégré d'une app, le guide passe avant la fenêtre du navigateur.
// - Guide fermé, un rappel court reste sous le bouton : sur iPhone, on ne peut pas toucher Safari guide ouvert.
// Sur Android, l'app installée depuis Chrome apparaît dans la feuille de partage du téléphone : c'est ce qui rend
// possible le partage d'un lien vers leketia depuis Instagram, X, YouTube…
const Install = (() => {
  const CLE_INSTALLEE = 'leketia:app-installee';
  const CLE_BANNIERE = 'leketia:banniere-installation';
  let deferred = null;           // fenêtre d'installation gardée (beforeinstallprompt)
  const parcours = InstallParcours.parcours(navigator.userAgent, navigator.maxTouchPoints || 0, 'brave' in navigator);

  const lire = (store, k) => { try { return store.getItem(k); } catch { return null; } };
  const ecrire = (store, k, v) => { try { store.setItem(k, v); } catch { /* stockage indisponible */ } };

  // App ouverte depuis son icône, quel que soit le mode d'affichage déclaré par le système.
  const MODES = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  function ouverteInstallee() {
    try { return navigator.standalone === true || MODES.some((m) => matchMedia(`(display-mode: ${m})`).matches); } catch { return false; }
  }
  const noterInstallee = () => ecrire(localStorage, CLE_INSTALLEE, '1');
  const installeeConnue = () => ouverteInstallee() || lire(localStorage, CLE_INSTALLEE) === '1';

  // Chrome propose l'installation par un événement : on le garde, la proposition ne s'ouvre que sur le bouton.
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; render(); });
  window.addEventListener('appinstalled', () => { deferred = null; noterInstallee(); installee(); });
  if (ouverteInstallee()) noterInstallee();
  // L'app passe en mode installé sans recharger la page (ouverture depuis le navigateur) : on masque aussitôt.
  MODES.forEach((m) => { try { matchMedia(`(display-mode: ${m})`).addEventListener('change', (e) => { if (e.matches) { noterInstallee(); render(); } }); } catch { /* ancien navigateur */ } });
  // Dans un onglet Chrome (Android), le navigateur sait si cette PWA est installée, même installée lors d'une autre
  // visite ou depuis son menu : le manifeste la déclare comme sa propre « application liée ».
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => { if (apps && apps.length) { noterInstallee(); render(); } }).catch(() => {});
  }

  const direct = () => !!deferred && parcours !== 'integre' && parcours !== 'ios-integre' && parcours !== 'android-autre';

  async function lancer() {
    if (!direct()) { ouvrirGuide(); return; }
    const ev = deferred;
    deferred = null;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === 'accepted') installee();
    else render();
  }

  // ---- Bannière ----
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  let banniere = null;
  let rappel = false;

  function visible() {
    return parcours !== 'ordinateur' && !installeeConnue() && lire(sessionStorage, CLE_BANNIERE) !== '1';
  }

  function render() {
    if (!banniere) return;
    if (!visible()) { banniere.hidden = true; return; }
    banniere.hidden = false;
    banniere.querySelector('.install-rappel').hidden = !(rappel && !direct());
  }

  function installee() {
    if (!banniere) return;
    banniere.replaceChildren(el('p', 'install-fait', 'Application installée. Ouvre leketia depuis ton écran d’accueil : tu pourras y partager tes liens.'));
    banniere.setAttribute('role', 'status');
    setTimeout(() => { banniere.hidden = true; }, 8000);
  }

  function monter() {
    if (parcours === 'ordinateur') return;
    banniere = el('aside', 'install-banniere');
    banniere.setAttribute('aria-label', 'Installer l’application');
    const ligne = el('div', 'install-ligne');
    const bouton = el('button', 'btn install-bouton');
    bouton.type = 'button';
    bouton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    bouton.append('Installer l’application');
    bouton.addEventListener('click', () => { lancer(); });
    const fermer = el('button', 'install-fermer');
    fermer.type = 'button';
    fermer.setAttribute('aria-label', 'Fermer');
    fermer.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    fermer.addEventListener('click', () => { ecrire(sessionStorage, CLE_BANNIERE, '1'); banniere.hidden = true; });
    ligne.append(el('span'), bouton, fermer);
    // Sur iPhone, l'onglet Safari ne peut pas savoir que l'app est déjà sur l'écran d'accueil : on peut le dire, une fois.
    const deja = el('button', 'install-deja', 'Déjà installée sur ce téléphone');
    deja.type = 'button';
    deja.addEventListener('click', () => { noterInstallee(); banniere.hidden = true; });
    const r = el('p', 'install-rappel');
    r.append(el('strong', '', 'Pour installer : '), InstallParcours.RAPPEL[parcours] || '');
    r.hidden = true;
    banniere.append(ligne, r, deja);
    document.querySelector('.navbar').after(banniere);
    render();
  }

  // ---- Guide à étapes ----
  const PARTAGER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/></svg>';
  function dessin(d) {
    const h = location.host;
    switch (d) {
      case 'safari-menu-adresse': return `<div class="gi-barre"><span class="gi-rond">‹</span><span class="gi-url"><span class="gi-rond gi-cible gi-menu">≡</span>${h}</span><span class="gi-rond">□</span></div>`;
      case 'safari-plus': return `<div class="gi-barre"><span class="gi-rond">‹</span><span class="gi-url">${h}</span><span class="gi-rond gi-cible">⋯</span></div>`;
      case 'safari-partager': return `<div class="gi-barre"><span class="gi-rond">‹</span><span class="gi-rond gi-cible">${PARTAGER}</span><span class="gi-rond">□</span></div>`;
      case 'chrome-partager': return `<div class="gi-barre"><span class="gi-url">${h}</span><span class="gi-rond gi-cible">${PARTAGER}</span></div>`;
      case 'ligne-partager': return `<div class="gi-ligne gi-cible"><span>Partager</span>${PARTAGER}</div>`;
      case 'ligne-accueil': return '<div class="gi-ligne gi-cible"><span>Sur l’écran d’accueil</span><span aria-hidden="true">⊞</span></div>';
      case 'bascule': return '<div class="gi-ligne"><span>Ouvrir comme app web</span><span class="gi-bascule" aria-hidden="true"></span></div>';
      case 'menu-android': return `<div class="gi-barre"><span class="gi-url">${h}</span><span class="gi-rond gi-cible">⋮</span></div>`;
      case 'ligne-installer': return '<div class="gi-ligne gi-cible"><span>Installer l’application</span><span aria-hidden="true">⤓</span></div>';
      case 'menu-integre': return `<div class="gi-barre"><span class="gi-url">${h}</span><span class="gi-rond gi-cible">⋯</span></div>`;
      default: return '';
    }
  }

  let dialog = null;
  function ouvrirGuide() {
    const etapes = InstallParcours.ETAPES[parcours];
    if (!etapes) return;
    if (!dialog) {
      dialog = el('dialog', 'gi');
      dialog.setAttribute('aria-labelledby', 'gi-titre');
      dialog.addEventListener('close', () => { rappel = true; render(); });
      document.body.appendChild(dialog);
    }
    let i = 0;
    const copier = async (btn) => {
      try { await navigator.clipboard.writeText(location.origin + '/'); btn.textContent = 'Lien copié'; } catch { /* presse-papiers refusé */ }
    };
    const draw = () => {
      const [texte, d] = etapes[i];
      const derniere = i === etapes.length - 1;
      dialog.innerHTML = `
        <div class="gi-tete"><div><h2 id="gi-titre">Installer l’application</h2><p class="gi-nav">${InstallParcours.NAVIGATEUR[parcours]}</p></div>
          <button type="button" class="modal-close gi-fermer" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <p class="gi-compte" aria-live="polite">Étape ${i + 1} sur ${etapes.length}</p>
        <div class="gi-points" aria-hidden="true">${etapes.map((_, k) => `<i class="${k <= i ? 'is-on' : ''}"></i>`).join('')}</div>
        <div class="gi-etape"><p class="gi-texte"></p>${d ? dessin(d) : ''}<div class="gi-extra"></div></div>
        <div class="gi-actions"></div>`;
      dialog.querySelector('.gi-texte').textContent = texte;
      dialog.querySelector('.gi-fermer').addEventListener('click', () => dialog.close());
      const extra = dialog.querySelector('.gi-extra');
      if (parcours === 'android-autre' && i === 0) {
        // Ouvrir la même page dans Chrome (lien « intent » d'Android ; sans Chrome, la page se recharge ici).
        const ouvrir = el('button', 'btn btn-primary', 'Ouvrir dans Chrome');
        ouvrir.type = 'button';
        ouvrir.addEventListener('click', () => {
          location.href = `intent://${location.host}/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(location.origin + '/')};end`;
        });
        const cp = el('button', 'btn btn-ghost', 'Copier le lien');
        cp.type = 'button';
        cp.addEventListener('click', () => copier(cp));
        extra.append(ouvrir, cp, el('p', 'gi-note', 'Sans Chrome sur ton téléphone, utilise l’application ici, sans l’installer.'));
      }
      if (['ios-chrome', 'ios-autre', 'ios-integre'].includes(parcours) && i === 0) {
        // Ouvrir la même page dans Safari (schéma x-safari-https, iOS 17 et plus). Le choix d'un seul navigateur
        // pour l'iPhone est assumé ici : c'est là que s'ouvrent les liens partagés vers leketia.
        const ouvrir = el('button', 'btn btn-primary', 'Ouvrir dans Safari');
        ouvrir.type = 'button';
        ouvrir.addEventListener('click', () => { location.href = `x-safari-${location.origin}/`; });
        const cp = el('button', 'btn btn-ghost', 'Copier le lien');
        cp.type = 'button';
        cp.addEventListener('click', () => copier(cp));
        extra.append(ouvrir, cp, el('p', 'gi-note', 'Rien ne s’ouvre ? Copie le lien, ouvre Safari et colle-le dans la barre d’adresse.'));
      }
      if (parcours === 'integre' && derniere) {
        const cp = el('button', 'btn btn-ghost', 'Copier le lien');
        cp.type = 'button';
        cp.addEventListener('click', () => copier(cp));
        extra.append(cp);
      }
      const actions = dialog.querySelector('.gi-actions');
      const suite = el('button', 'btn btn-primary', derniere ? 'J’ai compris' : 'Étape suivante');
      suite.type = 'button';
      suite.addEventListener('click', () => { if (derniere) dialog.close(); else { i++; draw(); } });
      actions.append(suite);
      if (i > 0) {
        const prec = el('button', 'btn btn-ghost', 'Étape précédente');
        prec.type = 'button';
        prec.addEventListener('click', () => { i--; draw(); });
        actions.append(prec);
      }
    };
    draw();
    if (!dialog.open) dialog.showModal();
  }

  monter();
  return { parcours, ouverteInstallee, lancer, ouvrirGuide };
})();
