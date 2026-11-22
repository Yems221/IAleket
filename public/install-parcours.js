// leketia — parcours d'installation selon le téléphone et le navigateur.
// Repris du protocole de l'app de la Biennale de Dakar (guide-install.ts, décisions des 14-17 nov. 2026),
// vérifié sur de vrais téléphones. Lecture pure de l'agent du navigateur : testable (tests/install-parcours.test.mjs).
const InstallParcours = (() => {
  /** Navigateur intégré à une application (Instagram, Facebook, TikTok, LinkedIn, Snapchat, Line, X) : il n'installe pas. */
  const INTEGRE = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|TikTok|musical_ly|Bytedance|Snapchat|Line\/|Twitter/i;
  /** Navigateurs Android autres que Chrome : ils fabriquent eux-mêmes le paquet de l'app installée, que Google Play
   * Protect bloque (« Appli non sécurisée bloquée », vu sur Samsung Internet). On installe depuis Chrome. */
  const ANDROID_AUTRE = /SamsungBrowser|EdgA|OPR\/|Opera Mini|Firefox|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser|HeyTapBrowser|DuckDuckGo/;
  /** Vue web d'une application Android (« ; wv) » dans l'agent) : elle n'installe pas. */
  const VUE_WEB_ANDROID = /Android.*; wv\)/;

  function parcours(ua, pointsTactiles = 0, brave = false) {
    if (INTEGRE.test(ua) || VUE_WEB_ANDROID.test(ua)) return 'integre';
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && pointsTactiles > 1);
    if (ios) {
      if (/CriOS/.test(ua)) return 'ios-chrome';
      if (/FxiOS|EdgiOS|OPiOS|OPT\//.test(ua) || brave) return 'ios-autre';
      // Safari 27 : le menu est le bouton ≡ à côté de l'adresse ; Safari 26 : Partager rangé sous ⋯.
      const v = /Version\/(\d+)/.exec(ua);
      const n = v ? Number(v[1]) : 0;
      return n >= 27 ? 'ios-safari-27' : n >= 26 ? 'ios-safari-26' : 'ios-safari';
    }
    if (!/Android/.test(ua)) return 'ordinateur';
    // Brave a le même agent que Chrome mais n'installe pas l'app de façon fiable sur Android : Chrome aussi.
    return ANDROID_AUTRE.test(ua) || brave ? 'android-autre' : 'android';
  }

  // Une étape : [texte, dessin du geste ou null].
  const ETAPES = {
    'ios-safari-27': [['Touchez ≡ à côté de l’adresse, en bas de Safari.', 'safari-menu-adresse'], ['Faites défiler, puis touchez Sur l’écran d’accueil.', 'ligne-accueil'], ['Laissez Ouvrir comme app web activé, puis touchez Ajouter.', 'bascule']],
    'ios-safari-26': [['Touchez ⋯ en bas à droite de Safari.', 'safari-plus'], ['Touchez Partager.', 'ligne-partager'], ['Faites défiler, puis touchez Sur l’écran d’accueil.', 'ligne-accueil'], ['Laissez Ouvrir comme app web activé, puis touchez Ajouter.', 'bascule']],
    'ios-safari': [['Touchez Partager, en bas de Safari.', 'safari-partager'], ['Faites défiler, puis touchez Sur l’écran d’accueil.', 'ligne-accueil'], ['Touchez Ajouter.', null]],
    'ios-chrome': [['Touchez Partager, en haut à droite dans la barre d’adresse.', 'chrome-partager'], ['Faites défiler, puis touchez Sur l’écran d’accueil.', 'ligne-accueil'], ['Touchez Ajouter.', null]],
    'ios-autre': [['Ouvrez le menu de votre navigateur, puis touchez Partager.', 'ligne-partager'], ['Faites défiler, puis touchez Sur l’écran d’accueil.', 'ligne-accueil'], ['Touchez Ajouter.', null]],
    android: [['Touchez le menu ⋮ de votre navigateur.', 'menu-android'], ['Touchez Installer l’application ou Ajouter à l’écran d’accueil.', 'ligne-installer'], ['Confirmez.', null]],
    'android-autre': [['Ce navigateur ne peut pas installer l’application. Ouvrez cette page dans Chrome.', null], ['Dans Chrome, touchez Installer l’application, puis Installer.', 'ligne-installer']],
    integre: [['Touchez le menu de l’application ouverte (⋯ ou ⋮).', 'menu-integre'], ['Touchez Ouvrir dans le navigateur.', null], ['Dans votre navigateur, revenez sur cette page pour installer l’application.', null]],
  };

  /** Rappel court gardé sous le bouton une fois le guide fermé (on ne peut pas toucher le navigateur guide ouvert). */
  const RAPPEL = {
    'ios-safari-27': '≡ › Sur l’écran d’accueil › Ajouter',
    'ios-safari-26': '⋯ › Partager › Sur l’écran d’accueil › Ajouter',
    'ios-safari': 'Partager › Sur l’écran d’accueil › Ajouter',
    'ios-chrome': 'Partager (en haut) › Sur l’écran d’accueil › Ajouter',
    'ios-autre': 'Menu › Partager › Sur l’écran d’accueil › Ajouter',
    android: '⋮ › Installer l’application',
    'android-autre': 'Ouvrir dans Chrome › Installer l’application',
    integre: 'Menu › Ouvrir dans le navigateur',
  };

  const NAVIGATEUR = {
    'ios-safari-27': 'Safari sur iPhone', 'ios-safari-26': 'Safari sur iPhone', 'ios-safari': 'Safari sur iPhone',
    'ios-chrome': 'Chrome sur iPhone', 'ios-autre': 'Votre navigateur sur iPhone', android: 'Votre navigateur sur Android',
    'android-autre': 'Navigateur sur Android', integre: 'Navigateur d’une application',
  };

  return { parcours, ETAPES, RAPPEL, NAVIGATEUR };
})();
if (typeof module !== 'undefined') module.exports = InstallParcours;
