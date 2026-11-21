# Leketia — notes de design

Deux skills ont été appliqués à l'interface reprise de HomeBoard : `emil-design-eng` (revue des animations et
des états) et `frontend-component-build` (anatomie et états des composants ajoutés).

## Revue des animations (`emil-design-eng`)

| Avant (HomeBoard) | Après (Leketia) | Pourquoi |
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

## Ce qui reste à faire côté design

- Le focus n'est pas piégé dans les fenêtres (hérité de HomeBoard).
- Les boutons des cartes utilisent encore des attributs `onclick` dans le HTML : cela empêche une politique de
  sécurité stricte.
- Aucun test visuel ni d'accessibilité automatisé.
