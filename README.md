# leketia

<img src="public/brand/leketia-logo.png" alt="Logo de leketia : une calebasse bleu roi de profil, gravée du mot leket écrit en bits" width="200">

Une calebasse de données : un journal de liens personnel et open source. Tu partages un lien depuis
X, Instagram, YouTube, TikTok ou Pinterest, il devient une carte avec aperçu, et tout reste sur ton appareil.

**En ligne : [leketia.pages.dev](https://leketia.pages.dev)** (Cloudflare Pages, déployé à chaque mise à jour de `main`). Pas encore testé sur téléphone.

## Ce que fait cette version

- Reçoit un lien, une image ou une vidéo partagés depuis une autre appli (Android), ou collés (partout).
- Affiche chaque élément en carte, avec lecteur intégré pour YouTube, X, Instagram, TikTok et Pinterest.
- Range par collections et par tags, avec un statut « À voir / Vu / Favori » et une corbeille de 30 jours.
- Garde tout dans le navigateur de l'appareil : pas de compte, pas de base de données.
- Sauvegarde le journal dans un fichier à s'envoyer (Telegram, Drive, e-mail) et à réimporter.

- Sauvegarde dans Google Drive, d'un toucher, si l'instance a son identifiant Google ([guide](docs/GOOGLE_DRIVE.md)).

Pas encore fait : partage rapide depuis iPhone.

## Principes

- Les données restent sur l'appareil. Le serveur ne garde rien : il lit seulement le titre et l'image d'un lien.
- La sauvegarde est la seule protection contre la perte du journal : l'app le rappelle.
- Chacun peut déployer sa propre instance.

## Lancer en local

    npm install
    npm run dev      # http://localhost:8788
    npm test

## Documents

- [Cahier des charges](docs/PRD.md) : problème, solution, décisions, questions ouvertes.
- [Notes de design](docs/DESIGN.md) : revue des animations, états des composants.
- [Sauvegarde Google Drive](docs/GOOGLE_DRIVE.md) : créer l'identifiant Google de ton instance.

## Origine

leketia part d'une copie complète de HomeBoard (moodboard collaboratif), ajustée : sans comptes, sans base
serveur, avec un stockage local et une sauvegarde par fichier. La branche `prototype/partage-ios` contient un
banc d'essai jetable pour les tests de partage sur téléphone.

## Licence

leketia est distribué sous licence [GNU AGPL v3 ou ultérieure](LICENSE).

Tu peux l'utiliser, le modifier et le déployer librement. Si tu en héberges une version
modifiée que d'autres personnes utilisent, tu dois leur donner accès au code de cette version.
