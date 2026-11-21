# Prototype jetable : réception d'un partage

**Question :** par quel chemin un lien partagé depuis une autre appli arrive-t-il dans IAleket,
sur iPhone et sur Android, et dans quel stockage (Safari ou app installée) ?

Ce code ne sera pas fusionné dans `main`. Il n'a ni tests, ni cache hors ligne, ni finition.

## Lancer

    npm install
    npm run dev        # http://localhost:8788

Le test sur téléphone demande une adresse en HTTPS, donc un déploiement (`npm run deploy`).

## Ce que la page montre

- le mode d'ouverture (navigateur ou app installée) ;
- un code tiré au hasard par type de stockage (base locale, localStorage, cookie) : deux
  contextes qui affichent le même code partagent leurs données ;
- chaque lien reçu, avec son chemin d'arrivée et le mode au moment de la réception.

## Chemins d'arrivée testés

| Chemin | Où |
|---|---|
| `POST /share` lu par le service worker | Android, app installée depuis Chrome |
| `POST /share` rattrapé par le serveur, puis `/add?u=` | Android, service worker pas encore actif |
| `/add?u=<lien>` | Raccourci iPhone dans la feuille de partage |
| Bouton « Coller » | partout |

## Vérifié en local (Chrome sur ordinateur, 21 nov. 2026)

- `/add?u=` enregistre un lien http(s) et refuse `javascript:`.
- Le service worker lit titre, texte et fichier d'un `POST /share` et extrait le lien du texte.
- Sans service worker, le serveur répond 303 vers `/add?u=…`.

## Pas encore vérifié

Tout ce qui concerne un vrai téléphone : installation, feuille de partage Android, Raccourci
iPhone, stockage partagé ou non entre Safari et l'app installée, partage de fichier vers Telegram.

## Verdict

À remplir après les essais sur appareil.
