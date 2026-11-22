# Mesure d'audience anonyme

But : savoir ce qui marche dans leketia et ce qui bloque, sans rien apprendre sur les personnes ni sur leurs liens.

## Principes

- **Ce qui part** : des catégories et des compteurs. Type d'appareil, navigateur, app installée ou non, réseau social d'un lien ajouté, page publiée avec ou sans mot de passe.
- **Ce qui ne part jamais** : les liens, les titres, les notes, les noms de collections, le compte Google, l'adresse IP, l'agent complet du navigateur.
- **Point de jonction unique** : un identifiant d'appareil tiré au hasard (`crypto.randomUUID()`), propre à ce navigateur ou à cette app installée. Il n'est relié à rien d'autre et il est renouvelé tous les 13 mois.
- **Pays** : le code à deux lettres fourni par Cloudflare (`SN`, `FR`…). Jamais la ville ni l'adresse IP.
- **Durée** : les données de plus de 25 mois sont effacées automatiquement.
- **Refus** : case « Mesure d'audience anonyme » dans la fenêtre Sauvegarde. Le réglage « Global Privacy Control » du navigateur coupe aussi la mesure. Une fois coupée, plus rien ne part et la file d'attente est vidée.
- **Filtrage serveur** : `functions/api/t.ts` n'accepte que des événements et des champs connus, de types bornés. Une valeur inattendue (une adresse, un texte libre) est écartée avant l'enregistrement.

Ces règles suivent les conditions de la CNIL pour une mesure d'audience exemptée de consentement : finalité limitée à la mesure, données anonymes, identifiant de 13 mois au plus, conservation de 25 mois au plus, droit d'opposition simple.

## Où ça vit

| Partie | Fichier |
|---|---|
| Collecte dans l'app | `public/telemetry.js` |
| Points de mesure | `public/app.js` (`Telemetry.track(...)`) |
| Réception et filtrage | `functions/api/t.ts` |
| Écriture en base, vues des pages publiques | `functions/_telemetry.ts` |
| Base | D1 `leketia-telemetry`, branchée sous le nom `TELEMETRY` dans `wrangler.toml` |

La table est créée toute seule au premier envoi. Une instance sans base D1 fonctionne normalement : la mesure est ignorée.

## La table

```sql
events (
  id      INTEGER PRIMARY KEY,
  ts      INTEGER,  -- heure en millisecondes
  day     TEXT,     -- AAAA-MM-JJ
  device  TEXT,     -- identifiant d'appareil tiré au hasard ; NULL pour les vues de pages publiques
  name    TEXT,     -- nom de l'événement
  props   TEXT,     -- détails en JSON (catégories et compteurs)
  country TEXT,     -- code pays à deux lettres
  v       TEXT      -- version de l'app
)
```

## Les événements

| Événement | Quand | Détails |
|---|---|---|
| `app_open` | ouverture de l'app | `os` (android, ios, desktop), `browser`, `form` (telephone, tablette, ordinateur), `mode` (app, navigateur), `theme`, `lang` |
| `install` | installation sur l'écran d'accueil | `os`, `browser`, `form`, `via` (navigateur, icone) |
| `link_added` | lien ajouté | `rs` (instagram, tiktok, x, youtube, pinterest, linkedin, facebook, threads, reddit, spotify, autre), `via` (partage, collage, manuel), `image`, `collections` |
| `photo_added` | photo ou vidéo ajoutée | `kind`, `via` |
| `collection_created` | nouvelle collection | `from` (fenetre, ajout) |
| `share_made` | QR affiché, lien copié ou envoyé, texte IA copié | `tab` (qr, lien, ia), `how`, `scope` (journal, collection, selection), `mdp`, `limite`, `liens` |
| `page_published` | page publique créée | `scope`, `mdp`, `limite`, `liens` |
| `page_edited` | réglages d'une page modifiés | `mdp`, `limite`, `mdp_change` |
| `page_removed` | page retirée | |
| `page_view` | page publique servie (sans identifiant d'appareil) | `kind` (p : page publiée, b : lien autoporteur), `statut`, `format` (html, md, json), `lecteur` (personne, apercu, ia, robot), `protegee`, `page` (empreinte courte de la page) |
| `board_imported` | board reçu ajouté au journal | `source`, `liens` |
| `sync_on`, `sync_off` | synchronisation activée ou arrêtée | |
| `backup`, `restore` | sauvegarde et restauration | `to` / `from`, `elements` |
| `snapshot` | une fois par jour et par appareil | `links`, `photos`, `videos`, `collections`, `pages`, `pages_mdp`, `pages_limite`, `sync`, `rs_<réseau>` (liens par réseau) |
| `mesure_on` | la personne réactive la mesure | |

## Lire les chiffres

Dans le tableau de bord Cloudflare : compte **ialeket** › Stockage et bases de données › D1 › `leketia-telemetry` › Console. Colle une requête et lance-la.

**Appareils actifs par jour (30 derniers jours)**
```sql
SELECT day, COUNT(DISTINCT device) AS appareils
FROM events WHERE name = 'app_open' AND day >= date('now', '-30 days')
GROUP BY day ORDER BY day;
```

**Appareils actifs sur 7 et 30 jours**
```sql
SELECT
  (SELECT COUNT(DISTINCT device) FROM events WHERE name = 'app_open' AND day >= date('now', '-7 days'))  AS sur_7_jours,
  (SELECT COUNT(DISTINCT device) FROM events WHERE name = 'app_open' AND day >= date('now', '-30 days')) AS sur_30_jours;
```

**Installations par système et navigateur**
```sql
SELECT json_extract(props, '$.os') AS systeme, json_extract(props, '$.browser') AS navigateur, COUNT(*) AS installations
FROM events WHERE name = 'install' GROUP BY 1, 2 ORDER BY 3 DESC;
```

**Types d'appareils (appareils distincts)**
```sql
SELECT json_extract(props, '$.form') AS type, json_extract(props, '$.os') AS systeme,
       json_extract(props, '$.mode') AS ouverture, COUNT(DISTINCT device) AS appareils
FROM events WHERE name = 'app_open' GROUP BY 1, 2, 3 ORDER BY 4 DESC;
```

**Liens ajoutés par réseau social, et comment**
```sql
SELECT json_extract(props, '$.rs') AS reseau, json_extract(props, '$.via') AS via, COUNT(*) AS liens
FROM events WHERE name = 'link_added' GROUP BY 1, 2 ORDER BY 3 DESC;
```

**Liens enregistrés par réseau social, dans les journaux (dernière photo de chaque appareil)**
```sql
WITH last AS (
  SELECT device, props FROM events e
  WHERE name = 'snapshot' AND ts = (SELECT MAX(ts) FROM events WHERE name = 'snapshot' AND device = e.device)
)
SELECT key AS reseau, SUM(value) AS liens
FROM last, json_each(last.props)
WHERE key LIKE 'rs_%' GROUP BY key ORDER BY liens DESC;
```

**Taille des journaux (dernière photo de chaque appareil)**
```sql
WITH last AS (
  SELECT props FROM events e
  WHERE name = 'snapshot' AND ts = (SELECT MAX(ts) FROM events WHERE name = 'snapshot' AND device = e.device)
)
SELECT COUNT(*) AS appareils,
       SUM(json_extract(props, '$.links')) AS liens,
       ROUND(AVG(json_extract(props, '$.links')), 1) AS liens_par_appareil,
       SUM(json_extract(props, '$.sync')) AS avec_synchro
FROM last;
```

**Pages publiques créées, et avec quelle protection**
```sql
SELECT json_extract(props, '$.scope') AS source, json_extract(props, '$.mdp') AS mot_de_passe,
       json_extract(props, '$.limite') AS date_limite, COUNT(*) AS pages
FROM events WHERE name = 'page_published' GROUP BY 1, 2, 3 ORDER BY 4 DESC;
```

**Qui lit les pages publiques**
```sql
SELECT json_extract(props, '$.kind') AS type, json_extract(props, '$.lecteur') AS lecteur,
       json_extract(props, '$.format') AS format, COUNT(*) AS vues
FROM events WHERE name = 'page_view' AND json_extract(props, '$.statut') = 200
GROUP BY 1, 2, 3 ORDER BY 4 DESC;
```

**Pages publiées les plus vues (empreintes)**
```sql
SELECT json_extract(props, '$.page') AS page, COUNT(*) AS vues
FROM events WHERE name = 'page_view' AND json_extract(props, '$.kind') = 'p' AND json_extract(props, '$.lecteur') = 'personne'
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

**Partages : QR, lien ou IA**
```sql
SELECT json_extract(props, '$.tab') AS moyen, json_extract(props, '$.how') AS geste, COUNT(*) AS partages
FROM events WHERE name = 'share_made' GROUP BY 1, 2 ORDER BY 3 DESC;
```

**Rétention : appareils revenus 7 jours après leur première ouverture**
```sql
WITH first AS (SELECT device, MIN(day) AS d0 FROM events WHERE name = 'app_open' GROUP BY device)
SELECT d0 AS premiere_ouverture, COUNT(*) AS nouveaux,
       SUM(EXISTS (SELECT 1 FROM events e WHERE e.device = first.device AND e.name = 'app_open'
                   AND e.day BETWEEN date(d0, '+7 days') AND date(d0, '+13 days'))) AS revenus_semaine_2
FROM first GROUP BY d0 ORDER BY d0 DESC LIMIT 30;
```

**Parcours d'ajout : d'où viennent les liens (partage depuis une autre appli, collage, saisie)**
```sql
SELECT json_extract(props, '$.via') AS via,
       COUNT(*) AS liens, COUNT(DISTINCT device) AS appareils
FROM events WHERE name = 'link_added' GROUP BY 1 ORDER BY 2 DESC;
```

**Pays**
```sql
SELECT country, COUNT(DISTINCT device) AS appareils
FROM events WHERE name = 'app_open' GROUP BY 1 ORDER BY 2 DESC;
```
