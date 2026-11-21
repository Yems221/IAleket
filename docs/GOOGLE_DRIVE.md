# Activer la sauvegarde Google Drive sur ton instance

leketia sauvegarde le journal dans le Google Drive de la personne qui l'utilise, dans un dossier
`leketia`, un fichier daté par sauvegarde. Rien ne passe par le serveur de l'instance : le navigateur
parle directement à Google.

Pour cela, chaque instance a besoin de son propre **identifiant client Google** (Client ID), lié à son
adresse. Ce n'est pas un secret : il est visible par tous, et il n'y a aucun « client secret ».
Sans lui, le bouton Drive est simplement masqué ; le reste de l'app fonctionne.

## Ce que l'app demande à Google

- **Accès :** `drive.file`, le plus restreint. leketia ne voit que les fichiers qu'elle a créés elle-même,
  jamais le reste du Drive. Google le classe « non sensible » : pas de vérification de l'app imposée.
- **Durée :** un jeton d'environ une heure, gardé en mémoire et jamais enregistré. Il n'y a pas d'envoi
  automatique en arrière-plan : on sauvegarde d'un toucher, et l'app rappelle quand la dernière
  sauvegarde date de plus de 7 jours.

## Créer l'identifiant (une fois par instance, environ 15 minutes)

Dans la [console Google Cloud](https://console.cloud.google.com/), avec le compte Google qui gérera l'instance :

1. **Créer un projet**, par exemple « leketia ».
2. **API et services → Bibliothèque :** activer **Google Drive API**.
3. **API et services → Écran de consentement OAuth** (ou « Google Auth Platform ») :
   - type d'utilisateurs **Externe** ;
   - nom de l'app, adresse e-mail d'assistance, logo facultatif ;
   - accès (scopes) : ajouter `.../auth/drive.file` ;
   - **Public :** en mode « Test », ajouter les adresses Gmail autorisées (100 au maximum). Pour une
     instance ouverte à tous, publier l'app (« En production »).
4. **API et services → Identifiants → Créer des identifiants → ID client OAuth :**
   - type **Application Web** ;
   - **Origines JavaScript autorisées :** l'adresse de l'instance, par exemple `https://leketia.pages.dev`
     (ajouter aussi `http://localhost:8788` pour essayer en local) ;
   - aucune URI de redirection n'est nécessaire.
5. Copier l'**ID client** (il se termine par `.apps.googleusercontent.com`).

## Le donner à l'instance

Dans `wrangler.toml`, renseigner la variable puis publier sur `main` :

```toml
[vars]
GOOGLE_CLIENT_ID = "123456789-xxxx.apps.googleusercontent.com"
```

Cloudflare redéploie l'instance ; le bouton « Sauvegarder dans Google Drive » apparaît dans la fenêtre
Sauvegarde.

## Retrouver ses fichiers

Dans Google Drive, dossier **leketia** : un fichier `leketia-AAAA-MM-JJ.html` par sauvegarde. Il s'ouvre
dans un navigateur (liste lisible des liens) et se réimporte dans leketia : Sauvegarde → Importer un fichier.
