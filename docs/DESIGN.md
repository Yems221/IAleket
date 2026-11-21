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

Consignes : une vraie calebasse, vue de profil, une seule couleur, reconnaissable, moderne, imprimable,
réaliste et post-moderne, remplie de quelque chose qui représente la donnée (pas de 0 et de 1).

- **Idée :** la calebasse est pleine à ras bord. En bas, la courbe lisse du fruit ; en haut, la même courbe
  en escalier, faite de cubes, comme des pixels. Deux cubes s'en détachent au sommet.
- **Fabrication :** modelé en 3D avec three.js (`tools/logo/`), puis rendu en images fixes.
- **Deux versions :** réaliste (une seule teinte, terre cuite `#B4571B`, lumière et relief) et à plat
  (une couleur, vue exactement de côté, pour l'impression et les petites tailles).
- **Fichiers :** `public/brand/leketia-logo.png` et `leketia-logo-print.png` (2048 px, fond transparent),
  `public/icons/` (icônes d'écran d'accueil), `public/brand/leketia-mark.webp` (barre du haut).
- **Écartés :** les chiffres 0 et 1 (refusés) ; un pictogramme vectoriel (pas assez réaliste) ; un tas de
  cubes multicolores sur un disque (trop de couleurs) ; des cubes empilés en escalier au-dessus du bol
  (trop proche du logo de Docker).
- **Pas encore fait :** une version vectorielle (SVG) de la version à plat, pour l'impression en grand.

## Mise en page (21 novembre 2026)

| Before | After | Why |
| --- | --- | --- |
| Barre du haut en verre dépoli, ombre intérieure | Fond de la page, flou léger, sans trait ni ombre | Moins de cadres : le contenu commence plus haut |
| Logo dessiné au trait, nom « IAleket » | Logo à plat 32 px, nom « leketia » en minuscules | Le logo réaliste devient une tache à 32 px ; la version à plat reste lisible |
| Collections en pastilles noires pleines | Onglets texte, soulignement de 2 px qui s'étire en 200 ms | Un seul repère actif, plus calme ; l'animation montre d'où vient la sélection |
| Filtres en pastilles de 40 px | Pastilles de 32 px, fond transparent | Secondaires par rapport aux collections : ils doivent peser moins |
| Badge « lien » sur chaque image | Retiré | Information inutile : presque tout est un lien |
| Collection affichée sur chaque carte, en capitales | Affichée seulement s'il en existe plusieurs, en casse normale | Moins de bruit quand on n'a qu'une collection |
| Ombre portée en trois couches sur les cartes | Contour d'un pixel ; ombre seulement au survol, à la souris | Une grille de cartes ombrées paraît chargée |
| Statut en pastille colorée | Texte discret ; « Favori » seul en couleur | Le statut n'est pas l'information principale |
| Fenêtre d'ajout centrée sur téléphone | Feuille qui monte du bas, coins arrondis en haut | Plus naturel au pouce, comme les feuilles du système |

## Ce qui reste à faire côté design

- Le focus n'est pas piégé dans les fenêtres (hérité de HomeBoard).
- Les boutons des cartes utilisent encore des attributs `onclick` dans le HTML : cela empêche une politique de
  sécurité stricte.
- Aucun test visuel ni d'accessibilité automatisé.
