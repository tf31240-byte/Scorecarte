# ScoreMaster — API communauté

Petit Worker Cloudflare + base D1 qui reçoit les **profils facultatifs** des personnes ayant accepté de rejoindre la communauté dans l'app
(pseudo choisi, type d'appareil, nombre de parties terminées, date de la dernière partie).
Les scores, les parties et les noms des joueurs ne sont **jamais** envoyés.

La base D1 `scoremaster-community` est déjà créée sur le compte Cloudflare avec son schéma (`schema.sql`).

## Déploiement (une seule fois)

```bash
cd community-worker
npx wrangler login                 # ouvre le navigateur pour autoriser wrangler
npx wrangler deploy                # publie le Worker, affiche son URL
npx wrangler secret put ADMIN_KEY  # choisir un mot de passe long (protège le tableau de bord)
```

`npx wrangler deploy` affiche une URL du type `https://scoremaster-community.<votre-compte>.workers.dev`.

Ensuite, dans `index.html`, renseigner cette URL dans `Community.API_URL` (tant qu'elle est vide, la fonctionnalité est entièrement désactivée dans l'app), puis incrémenter la version du cache dans `service-worker.js` et pousser.

## Consulter les profils

`https://<url-du-worker>/admin` — identifiant au choix, **mot de passe = `ADMIN_KEY`**.
Tableau de bord (profils, actifs sur 7 jours, parties totales, apps installées), export CSV/JSON (`?format=csv|json`) et bouton de suppression d'un profil.

## Sécurité et données

- Inscription uniquement avec consentement explicite dans l'app (case à cocher + pseudo saisi par la personne).
- Retrait à tout moment dans Paramètres → Communauté : le profil est supprimé du serveur.
- L'API n'accepte que les origines listées dans `ALLOWED_ORIGINS` (`wrangler.jsonc`).
- Entrées nettoyées, requêtes SQL paramétrées, tableau de bord sans JavaScript et avec une politique CSP stricte, suppression protégée contre le CSRF, limite de 5 000 profils.
- Aucune adresse IP ni donnée de localisation n'est enregistrée par ce Worker.

## Test en local

```bash
npx wrangler d1 execute DB --local --file=schema.sql
npx wrangler dev --local --var ADMIN_KEY:test --var ALLOWED_ORIGINS:http://localhost:8000
```
