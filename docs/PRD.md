# Leketia — cahier des charges (PRD)

Version du 21 novembre 2026. Document vivant : il décrit le problème, la solution et ce qui reste à décider.
Structure issue du skill `prd-development`, complétée par les rubriques du gabarit `to-prd`
(récits utilisateurs, décisions d'implémentation et de test).

Repères : 🔶 hypothèse plausible mais non vérifiée · 🔵 question ouverte.

## 1. Résumé

Leketia est un journal de liens personnel et open source. Il s'adresse aux personnes qui mettent de côté
beaucoup de contenus vus sur X, Instagram, YouTube, TikTok ou Pinterest, et qui veulent les garder chez elles
plutôt que dans le nuage d'un service. On partage un lien depuis n'importe quelle appli, il devient une carte
avec aperçu, et tout reste sur l'appareil. Une sauvegarde en un geste part vers Telegram, Drive ou un fichier.

## 2. Problème

- **Qui ?** Une personne curieuse, surtout sur téléphone, qui fait de la veille (IA, design, culture).
- **Quoi ?** Ses « enregistrés » sont éparpillés dans chaque plateforme. Impossible de les chercher ensemble,
  et un contenu peut disparaître avec le compte ou la publication.
- **Pourquoi c'est gênant ?** Les outils qui centralisent ces liens les stockent sur leurs serveurs : il faut
  créer un compte et faire confiance à un tiers pour des données qui dessinent ses centres d'intérêt.
- **Preuves.** 🔶 Aucune étude : le besoin vient de l'usage personnel de la porteuse du projet et de HomeBoard,
  son moodboard collaboratif, dont Leketia reprend l'interface.

## 3. Utilisateurs

- **Principal — la curieuse mobile.** Partage 5 à 30 liens par semaine depuis ses applis. Veut retrouver un
  contenu plus tard sans se demander sur quelle plateforme il était. Ne veut ni compte ni réglage.
- **Secondaire — la personne qui déploie.** Installe sa propre instance sur Cloudflare pour elle ou ses proches.
- **Tâche à accomplir.** « Quand je tombe sur un post intéressant, je veux le mettre de côté sans quitter
  l'appli, pour le retrouver et le relire plus tard, même si la plateforme le retire. »

## 4. Contexte

- Projet personnel, sans objectif commercial. Licence AGPL-3.0-or-later.
- Base existante : HomeBoard (interface, lecteurs intégrés, réception de partage Android), copiée telle quelle
  puis ajustée.
- **Pourquoi maintenant ?** L'hébergement sans serveur à gérer rend l'auto-déploiement accessible, et depuis
  iOS 26 toute icône ajoutée à l'écran d'accueil s'ouvre comme une app.
- 🔵 Quelle part d'utilisatrices sur iPhone ? La réponse pèse sur la priorité du partage iOS (section 9).

## 5. Solution

1. **Recevoir.** Android : Leketia apparaît dans la feuille de partage ; le lien, l'image ou la vidéo arrive
   dans la fenêtre d'ajout pré-remplie. iPhone : bouton « Coller le lien », ou un Raccourci Apple qui ouvre
   `/add?u=<lien>`.
2. **Ranger.** Chaque élément devient une carte avec titre, miniature et lecteur intégré (YouTube, X,
   Instagram, TikTok, Pinterest). Collections, tags (#mots et plateformes), statut « À voir / Vu / Favori »,
   corbeille de 30 jours.
3. **Garder.** Tout est dans le stockage local du navigateur. Le serveur ne garde rien : il ne sert qu'à lire
   le titre et l'image d'un lien, ce qu'un navigateur n'a pas le droit de faire seul.
4. **Sauvegarder.** Un fichier `.html` lisible tel quel et réimportable, envoyé par la feuille de partage
   (Telegram, Drive, e-mail) ou téléchargé. Un point sur le bouton « Sauvegarde » rappelle quand la dernière
   date de plus de 7 jours.

## 6. Mesures de réussite

Aucune donnée d'usage n'est envoyée nulle part : ces mesures se vérifient à la main ou par des tests.

- **Principale.** Du partage à la carte enregistrée : moins de 3 secondes sur Android. 🔶 Non mesuré.
- **Secondaires.** Part des cartes avec miniature ; âge de la dernière sauvegarde (cible : moins de 7 jours).
- **Garde-fou.** Zéro perte à l'aller-retour export puis import (vérifié à la main le 21 nov. 2026 :
  3 éléments sur 3, images comprises).

## 7. Récits utilisateurs

1. En tant qu'utilisatrice Android, je veux partager un lien vers Leketia depuis n'importe quelle appli, pour
   le mettre de côté sans quitter ce que je regardais.
2. En tant qu'utilisatrice Android, je veux partager une capture d'écran ou une vidéo de ma galerie, pour
   garder aussi ce qui n'a pas de lien.
3. En tant qu'utilisatrice iPhone, je veux coller un lien copié en un toucher, pour ne pas le retaper.
4. En tant qu'utilisatrice iPhone, je veux un Raccourci dans la feuille de partage, pour envoyer un lien aussi
   vite que sur Android.
5. En tant qu'utilisatrice, je veux que le titre et l'image se remplissent seuls, pour ne rien saisir.
6. En tant qu'utilisatrice, je veux pouvoir enregistrer un lien même sans aperçu, pour ne jamais être bloquée.
7. En tant qu'utilisatrice, je veux regarder la vidéo ou le post sans quitter Leketia, pour relire vite.
8. En tant qu'utilisatrice, je veux ranger un élément dans une ou plusieurs collections, pour m'y retrouver.
9. En tant qu'utilisatrice, je veux filtrer par plateforme ou par #tag, pour retrouver un contenu.
10. En tant qu'utilisatrice, je veux marquer un élément « À voir », « Vu » ou « Favori », pour suivre ma lecture.
11. En tant qu'utilisatrice, je veux modifier le titre, la note et les collections d'un élément.
12. En tant qu'utilisatrice, je veux récupérer pendant 30 jours un élément supprimé par erreur.
13. En tant qu'utilisatrice, je veux utiliser Leketia sans créer de compte.
14. En tant qu'utilisatrice, je veux consulter mon journal hors connexion.
15. En tant qu'utilisatrice, je veux m'envoyer tout mon journal ou une seule collection sur Telegram, pour en
    garder une copie hors du téléphone.
16. En tant qu'utilisatrice, je veux télécharger ma sauvegarde en fichier, pour la ranger où je veux.
17. En tant qu'utilisatrice, je veux qu'on me rappelle de sauvegarder, parce que mon journal n'existe que sur
    cet appareil.
18. En tant qu'utilisatrice, je veux réimporter une sauvegarde sur un nouvel appareil sans créer de doublons.
19. En tant qu'utilisatrice, je veux que rien de ce que j'enregistre ne soit lisible par l'hébergeur.
20. En tant que personne qui déploie, je veux installer ma propre instance sans base de données à créer.
21. En tant que personne qui déploie, je veux que mon instance ne puisse pas servir de relais à d'autres sites.
22. En tant qu'utilisatrice, je veux exporter vers mon Google Drive en un toucher. *(pas encore construit)*

## 8. Décisions d'implémentation

- **Point de départ.** Le code de HomeBoard est copié en entier, puis ajusté. L'interface n'est pas réécrite.
- **Stockage local.** Un module unique répond aux mêmes adresses que l'ancien serveur de HomeBoard
  (collections, éléments, corbeille, statut). L'interface ne sait pas que les données sont locales : c'est la
  seule couture entre l'écran et les données, et c'est là que se branchera un futur stockage différent.
- **Base locale.** IndexedDB, quatre magasins : collections, éléments, médias (photos, vidéos, miniatures),
  réglages. Le schéma est défini à un seul endroit, partagé avec le service worker.
- **Médias.** Une miniature est réduite (640 px, WebP) avant d'être gardée. Aucune image n'est chargée depuis
  un site tiers à l'affichage du journal.
- **Serveur sans mémoire.** Deux fonctions : lire l'aperçu d'un lien, et relayer une miniature. Aucune base,
  aucun fichier, aucun compte. Garde-fous : seules les demandes de l'app elle-même sont servies ; seuls les
  sites publics en http(s) sont lus ; tailles et délais plafonnés ; redirections revérifiées une à une.
- **Aperçus.** Service officiel de la plateforme quand il existe (YouTube, X, TikTok, Pinterest), sinon les
  balises de la page. Instagram et TikTok ne fournissent plus de miniature : la carte affiche alors un bouton
  de lecture aux couleurs de la plateforme.
- **Partage Android.** Le service worker reçoit le partage sur l'appareil. Une fonction serveur prend le
  relais au tout premier lancement, pour les liens seulement.
- **Sauvegarde.** Fichier `.html` contenant un index lisible et les données dans une balise dédiée. Le format
  `.json` est refusé par la feuille de partage d'Android, d'où ce choix. Format versionné (`schemaVersion: 1`).
- **Import.** Un fichier importé n'est jamais cru sur parole : chaque champ est revérifié, les liens qui ne
  sont pas en http(s) sont refusés, les éléments déjà présents sont ignorés.
- **Sécurité.** Le texte affiché est échappé, guillemets compris (défaut de HomeBoard corrigé). Une politique
  de sécurité du contenu limite les sites que la page peut contacter ou intégrer.

## 9. Décisions de test

- Un bon test vérifie ce que l'utilisatrice ou un attaquant peut observer, pas la façon dont c'est écrit.
- **Automatisé :** les garde-fous du serveur (liens refusés, origine de la demande, tailles). 5 tests.
- **Vérifié à la main dans un navigateur d'ordinateur, le 21 nov. 2026 :** ajout par `/add?u=` et par
  `?share_url=`, aperçus YouTube et X, carte Instagram sans miniature, partage d'une image reçu par le service
  worker, corbeille et restauration, export puis réimport, import d'un fichier piégé.
- **Pas encore vérifié :** tout ce qui demande un vrai téléphone (installation, feuille de partage Android,
  Raccourci et presse-papiers iPhone, envoi vers Telegram), et le déploiement.
- 🔵 Aucun test automatisé de l'interface pour l'instant.

## 10. Hors périmètre de cette version

- Comptes, synchronisation entre appareils, collaboration (HomeBoard l'avait, Leketia non).
- Export automatique en arrière-plan : impossible sans serveur qui garde un accès permanent au Drive.
- Application iPhone native (99 $ par an, validation Apple, contraire à « chacun installe la sienne »).
- Téléchargement des vidéos des plateformes. Statistiques d'usage.

## 11. Dépendances et risques

- **iPhone.** Safari ne sait pas recevoir un partage, et un lien ouvert par un Raccourci s'ouvre dans Safari,
  dont les données sont séparées de l'app installée. 🔶 Ce dernier point repose sur des témoignages, pas sur
  une documentation Apple : à vérifier sur un vrai iPhone.
- **Plateformes.** Les services d'aperçu changent sans prévenir (TikTok a déjà retiré sa miniature).
  🔶 Depuis les serveurs de l'hébergeur, certaines plateformes peuvent refuser de répondre.
- **Perte de données.** Désinstaller l'app ou effacer les données du site supprime le journal. La sauvegarde
  est la seule protection : c'est pourquoi le rappel est visible en permanence.
- **Polices.** Les polices viennent encore de Google Fonts, comme dans HomeBoard : c'est la seule requête vers
  un tiers au chargement. 🔵 Les héberger avec l'app ?

## 12. Questions ouvertes

- 🔵 Partage rapide sur iPhone : accepter qu'un lien transite quelques minutes, chiffré, par le serveur
  (Raccourci en 2 gestes), ou s'en tenir au bouton « Coller » (5 gestes, rien sur le serveur) ?
- 🔵 Google Drive : chaque instance doit créer son propre accès Google. Le rendre optionnel et le documenter ?
- 🔵 Inclure les vidéos dans la sauvegarde, au prix de fichiers très lourds ?
- 🔵 Le logo actuel est une première version dessinée par programme. Le faire redessiner ?

## Auto-évaluation

- **Section la plus solide :** 8, parce qu'elle décrit du code qui existe et qui a été essayé.
- **Section la plus faible :** 2, sans aucune preuve extérieure.
- **Hypothèses à vérifier en premier :** le comportement du Raccourci sur iPhone ; les aperçus une fois
  l'app déployée.
- **Prochaine étape :** déployer, puis essayer sur un téléphone Android et un iPhone.
