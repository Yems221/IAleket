# leketia — notes de design

Deux skills ont été appliqués à l'interface reprise de HomeBoard : `emil-design-eng` (revue des animations et
des états) et `frontend-component-build` (anatomie et états des composants ajoutés).

## Revue des animations (`emil-design-eng`)

| Avant (HomeBoard) | Après (leketia) | Pourquoi |
| --- | --- | --- |
| `transition: all` sur 8 éléments | Propriétés nommées (`transform`, couleurs, ombre) | `all` anime aussi ce qu'on n'a pas prévu et coûte plus cher |
| Les cartes rejouent leur entrée (0,5 s, en cascade) à chaque filtre ou ajout | Entrée de 300 ms, au premier affichage seulement | Une action répétée des dizaines de fois par jour ne doit pas être ralentie par une animation |
| Délai de cascade illimité (`index × 35 ms`) | Plafonné à 350 ms | La 30e carte attendait plus d'une seconde |
| Survol des cartes actif sur écran tactile | Limité aux appareils à souris (`hover: hover`) | Au doigt, le survol reste collé après un toucher |
| Bouton « ⋯ » des cartes visible seulement au survol | Toujours visible au doigt, et au clavier | Sans survol, le menu était introuvable sur téléphone |
| Zoom de l'image au survol en 600 ms | 300 ms | Au-delà de 300 ms une interface paraît lente |
| Toast en `@keyframes` avec rebond, 350 ms | Transition de 200 ms, interruptible | Plusieurs toasts d'affilée repartaient de zéro ; le rebond n'apporte rien ici |
| Sortie du toast en `transition: all 0.25s ease` | `opacity` et `transform`, 200 ms | Mêmes raisons ; la sortie est plus rapide que l'entrée |
| `.btn:active { scale(0.96) }` | `scale(0.97)` | Retour d'appui plus discret |
| `will-change` permanent sur chaque carte | Retiré | Réservait de la mémoire graphique pour rien une fois l'entrée jouée |

Conservé tel quel, parce que déjà juste : courbe `ease-out` personnalisée, menu des cartes qui s'ouvre depuis son
coin (`transform-origin: top right`, 120 ms), fenêtres en 200 ms, mouvement réduit respecté.

## Composants ajoutés (`frontend-component-build`)

### Bouton « Sauvegarde » (barre du haut)

- **Anatomie :** icône, libellé, point de rappel.
- **États :** normal · à sauvegarder (bordure et point de couleur quand la dernière sauvegarde a plus de
  7 jours ou n'existe pas) · survol · focus · appui.
- **Accessibilité :** vrai `<button>`, hauteur de 40 px ; le point est décoratif, l'information est répétée en
  texte dans la fenêtre.

### Fenêtre « Sauvegarde »

- **Anatomie :** titre, état de la dernière sauvegarde, explication, choix de la portée, deux actions d'export,
  note sur les vidéos, import.
- **États :** au repos · export en cours (boutons désactivés) · rien à exporter · envoi indisponible (bascule
  sur le téléchargement, avec un message) · envoi annulé (rien ne se passe) · import réussi (compte des
  éléments ajoutés et ignorés) · fichier invalide (message précis).
- **Accessibilité :** `role="dialog"` relié à son titre, fermeture par Échap et par le fond, état annoncé
  (`role="status"`), cibles de 44 px, champ de fichier atteignable au clavier.
- **Portée :** une liste (« tout » ou une collection) plutôt que plusieurs cases à cocher.

### Bouton « Coller le lien »

- **États :** normal · lien collé (l'aperçu se lance seul) · presse-papiers sans lien (message) · lecture
  refusée par le navigateur (message qui invite à coller à la main).
- **Pourquoi :** c'est la seule voie de capture qui fonctionne partout, iPhone compris, sans aucun réglage.

### État vide

- **Variantes :** journal vide (invite à partager ou ajouter) · filtre sans résultat · corbeille vide.

## Logo (21 novembre 2026)

Démarche reprise après trois propositions refusées, en suivant la recherche
[docs/recherche/logo-leketia.md](recherche/logo-leketia.md) : idée unique, croquis noir sur blanc testés
jusqu'à 16 px, choix d'une silhouette, puis seulement la matière.

- **Piste retenue : A3, « le leket gravé », puis précisée par la porteuse :** le mot « leket » écrit en bits et
  posé sur la calebasse, couleur bleu roi.
- **Le code :** une rangée par lettre, ASCII sur 7 bits (l 1101100 · e 1100101 · k 1101011 · e 1100101 ·
  t 1110100), soit une grille de 7 × 5 sur la panse. Un 1 est un carré gravé, un 0 reste bleu.
  Définition unique : `tools/logo/leket-bits.js`.
- **Couleurs :** la calebasse est d'un seul bleu roi uniforme (`#1F4BC9`), sans dégradé ni veinure ; les bits
  sont gravés en blanc. Le volume ne vient que de la lumière.
- **Fichiers :** `public/brand/leketia-logo.svg` (bleu roi), `leketia-logo-mono.svg` (une couleur, suit le texte,
  pour l'impression), `leketia-favicon.svg` (sous 48 px : trois gros carrés, les 35 bits s'y fondraient),
  `leketia-logo.png` (rendu réaliste three.js, 2048 px), `leketia-mark.webp` (barre du haut). Les SVG se
  régénèrent avec `node tools/logo/build-svg.mjs`, le rendu avec `node tools/logo/server.mjs`.
- **Couleur de l'app :** l'accent passe du terre cuite au bleu roi du logo.
- **Planches de travail :** `tools/logo/esquisses-a.html`, `esquisses-b.html`, `a3.html`, `leket-bits.html`.
- **Écartés :** les chiffres 0 et 1 ; les cubes (territoire de Docker) ; la terre cuite (une calebasse est une
  écorce de fruit) ; les effets figés avant d'avoir une silhouette.
- **Reste à faire :** recherche de marques déposées (OAPI, EUIPO, INPI, USPTO) avant toute diffusion publique ;
  calques séparés pour l'icône iOS 26 si une app native voit le jour.

## Mise en page (21 novembre 2026)

| Before | After | Why |
| --- | --- | --- |
| Barre du haut en verre dépoli, ombre intérieure | Fond de la page, flou léger, sans trait ni ombre | Moins de cadres : le contenu commence plus haut |
| Logo dessiné au trait, nom « IAleket » | Leket gravé réaliste en 40 px, nom « leketia » en minuscules | La silhouette validée reste lisible petit ; le nom suit la graphie demandée |
| Collections en pastilles noires pleines | Onglets texte, soulignement de 2 px qui s'étire en 200 ms | Un seul repère actif, plus calme ; l'animation montre d'où vient la sélection |
| Filtres en pastilles de 40 px | Pastilles de 32 px, fond transparent | Secondaires par rapport aux collections : ils doivent peser moins |
| Badge « lien » sur chaque image | Retiré | Information inutile : presque tout est un lien |
| Collection affichée sur chaque carte, en capitales | Affichée seulement s'il en existe plusieurs, en casse normale | Moins de bruit quand on n'a qu'une collection |
| Ombre portée en trois couches sur les cartes | Contour d'un pixel ; ombre seulement au survol, à la souris | Une grille de cartes ombrées paraît chargée |
| Statut en pastille colorée | Texte discret ; « Favori » seul en couleur | Le statut n'est pas l'information principale |
| Fenêtre d'ajout centrée sur téléphone | Feuille qui monte du bas, coins arrondis en haut | Plus naturel au pouce, comme les feuilles du système |

## Design system (22 novembre 2026)

Source unique : [`public/tokens.css`](../public/tokens.css). L'app la charge avant `app.css`, et les pages publiques
(`/b`, `/p`, page protégée) la chargent aussi : un lien partagé a les mêmes couleurs, en clair comme en sombre.
Il est né du carrousel marketing ([`docs/marketing/carrousel`](marketing/carrousel)) et l'applique à l'app.

### Couleurs : quatre rôles

| Rôle | Clair | Sombre | Sert à |
|---|---|---|---|
| Bleu roi `--accent` / `--accent-fill` | `#1F4BC9` | `#8fa9ff` (texte) / `#3a62e6` (fond de bouton) | toute action, les liens, la marque |
| Fond `--paper` | `#f2f5fc` (légèrement bleuté) | `#0b1640` (bleu nuit) | le fond des pages |
| Surfaces `--surface-elevated` / `--surface-sunken` | `#ffffff` / `#e9eef9` | `#14215a` / `#1a2a68` | cartes et fenêtres / champs, onglets, survols |
| Ocre `--highlight` | `#e8a93c` | `#e8a93c` | **une seule chose par écran** qui demande l'attention |

- **L'ocre est rare, sinon il ne signale plus rien.** Aujourd'hui : le point du bouton Sauvegarde (rappel) et
  « Synchroniser mes appareils » sur l'écran vide (bouton `.btn-cta`). Jamais deux par écran.
- **Encre** `--ink`, `--ink-secondary`, `--ink-muted` et **bordures** `--border-light`, `--border-strong` :
  teintées de bleu pour aller avec le bleu roi.
- **Couleurs qui restent fixes, volontairement** : celles des plateformes (badge X, YouTube, Instagram…), le
  noir des vidéos, le blanc derrière un QR code, et le guide d'installation, qui imite l'écran du téléphone.
- **Mode sombre automatique** (réglage du téléphone), avec `color-scheme` et deux `theme-color` (bleu roi en
  clair, bleu nuit en sombre).

### Typographie

- **Sora** pour les titres ; en **800** pour les grands (écran vide, titres de fenêtre). **DM Sans** pour le
  texte. **JetBrains Mono** pour les bits et les petites étiquettes.
- Échelle `--text-xs` 12 → `--text-3xl` 36 px.
- Les pages publiques gardent la police du système : leur politique de sécurité n'autorise pas Google Fonts,
  et elles s'ouvrent plus vite ainsi.

### Formes et mouvement

- **Boutons et pastilles en pilule** (`--r-full`), cartes en 16 px, fenêtres en 24 px.
- Ombres teintées d'encre (`--shadow-card`, `--shadow-dialog`…).
- Courbes et durées dans `--ease-*` et `--dur-*` ; la feuille mobile utilise `--ease-drawer`.

### Le motif des bits « leket »

Les 7 bits du « l » (`1101100`) servent de signature, à deux endroits seulement :
- **sous la calebasse de l'écran vide** ;
- **l'indicateur de chargement**, dont les bits s'allument en douceur (pas de rotation).

Ailleurs, le motif deviendrait du bruit.

### Règles pour la suite

1. Une nouvelle couleur passe d'abord par `tokens.css`, avec ses valeurs claire **et** sombre.
2. Pas de couleur en dur dans `app.css`, sauf celles listées plus haut comme fixes.
3. Ocre : une seule utilisation par écran.
4. Vérifier tout nouvel écran en clair et en sombre, sur téléphone.

## Ce qui reste à faire côté design

- Le focus n'est pas piégé dans les fenêtres (hérité de HomeBoard).
- Les boutons des cartes utilisent encore des attributs `onclick` dans le HTML : cela empêche une politique de
  sécurité stricte.
- Aucun test visuel ni d'accessibilité automatisé.
