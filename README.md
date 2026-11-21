# IAleket

Une calebasse de données : un journal de liens personnel, open source, qui reçoit les liens
partagés depuis d'autres applis (X, Instagram, YouTube, TikTok, Pinterest…) et les garde
sur l'appareil.

**État : conception.** Aucun code d'application ici pour l'instant.

## Principes

- Les données restent dans le stockage local de l'appareil : pas de compte, pas de base serveur.
- Un petit serveur Cloudflare sans stockage sert l'app et va chercher les aperçus de liens.
- L'export est la sauvegarde : fichier, Telegram par la feuille de partage, Google Drive (optionnel).
- Chacun peut déployer sa propre instance.

## Prototype en cours

La branche `prototype/partage-ios` contient un prototype jetable qui répond à une question :
par quel chemin un lien partagé arrive-t-il dans IAleket sur iPhone et sur Android, et dans
quel stockage ? Son verdict sera consigné ici ; le code du prototype ne sera pas fusionné.

## Origine

IAleket reprend les idées de HomeBoard (moodboard collaboratif), sans ses comptes ni sa base.

## Licence

IAleket est distribué sous licence [GNU AGPL v3 ou ultérieure](LICENSE).

Tu peux l'utiliser, le modifier et le déployer librement. Si tu en héberges une version
modifiée que d'autres personnes utilisent, tu dois leur donner accès au code de cette version.
