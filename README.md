# ScoreMaster

Application web (PWA) de suivi de scores pour jeux de cartes et de société : Belote / Coinche, Skyjo, Tarot, Rami, Uno, Flip 7…
Fonctionne **hors-ligne**, s'installe sur l'écran d'accueil, et garde toutes les données **sur l'appareil** (aucun compte, aucun serveur).

## Fonctionnalités

- Saisie rapide des scores (clavier dédié), bouton **Suivant** qui boucle sur les joueurs sans score, aperçu du total et du classement, clavier physique, mode Belote (capot, « reste »)
- Manches modifiables (cadre orange), suppression avec « Rétablir », **revanche** en un clic avec compteur de série
- Historique des manches repliable ; **mode Zen** (plein écran, écran maintenu allumé)
- **Thèmes** : mode Auto / Clair / Sombre + palettes (Océan, Forêt, Crépuscule, Minuit, Tapis vert) et une palette **Perso** (couleurs au choix)
- **Statistiques** : filtres par jeu et par période, classement équitable (pourcentage dès 3 parties), fiche joueur (forme, courbe, par jeu), **duels** entre deux joueurs, records et anecdotes, partage en texte
  - Règles : égalité en tête = pas de vainqueur, parties sans manche ignorées, Belote = équipes, records comparés jeu par jeu
- Fin de partie : partage du résultat en **texte**, **image** (1080×1080) ou **GIF animé**
- **Sauvegarde** (Paramètres → Sauvegarde) : fichier JSON complet, export CSV, restauration avec aperçu (fusion ou remplacement)
- Mode hors-ligne via Service Worker, indicateur 📵 discret

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | L'application complète (HTML, CSS, JS) |
| `service-worker.js` | Cache hors-ligne (app + bibliothèques CDN) |
| `manifest.json` | Installation PWA (icônes, raccourcis, captures) |
| `icon-*.png`, `screenshot*.png` | Icônes et captures d'écran |
| `community-worker/` | API facultative des profils communauté (Worker Cloudflare + D1) |
| `tests/` | Tests de bout en bout (Playwright) sur le vrai `index.html` |

## Développement

Aucune étape de build : ouvrir `index.html` via un serveur statique (le Service Worker exige http/https) :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Tests

Suite de bout en bout (Playwright / Chromium) qui pilote le vrai `index.html` : saisie, modification, revanche, zen, thèmes, statistiques (dont la cohérence des règles), robustesse et 600 parties aléatoires.

```bash
cd tests
npm install && npx playwright install chromium   # une seule fois
node run.js            # toute la suite
node run.js stats      # seulement les fichiers contenant « stats »
```

Chaque fichier `*.test.js` affiche ✅ / ❌ par vérification ; `run.js` renvoie un code de sortie 1 en cas d'échec. Les tests du Worker communauté (profils, sauvegarde cloud) demandent `wrangler dev` en local et ne font pas partie de cette suite.

## Mise à jour du cache hors-ligne

À chaque version publiée, incrémenter `scoremaster-app-vXX` et `scoremaster-cdn-vXX` dans `service-worker.js` pour que les appareils récupèrent la nouvelle version au prochain chargement.

Bibliothèques CDN (versions figées) : Chart.js 4.6.1, canvas-confetti 1.6.0, gifshot 0.4.5.

## Statistiques de fréquentation

L'app inclut [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) (sans cookie, sans donnée personnelle) : visites, pays, appareils, sources. Les parties ne quittent jamais l'appareil. Mention affichée dans Paramètres.

## Communauté (facultatif)

Sur le principe du volontariat, une personne peut rejoindre la communauté depuis l'app (pseudo + consentement explicite) ; l'éditeur voit alors son pseudo, son type d'appareil, son nombre de parties et la date de sa dernière partie. Détails, déploiement et sécurité : [`community-worker/README.md`](community-worker/README.md).

**Profil & sauvegarde cloud (facultatif)** : dans Paramètres, un seul consentement permet de créer un profil (pseudo unique + couleur préférée). L'éditeur voit pseudo, type d'appareil, nombre de parties et date de la dernière partie ; une copie des parties est gardée dans Cloudflare. Sur un appareil vidé, l'app propose de retrouver les données (oui/non) ; sur un nouvel appareil, pseudo + couleur suffisent. La couleur n'est stockée que sous forme d'empreinte salée, et 5 essais ratés bloquent le pseudo 15 minutes.


## Structure du code
- `index.html` : squelette de la page (HTML uniquement)
- `css/styles.css` : tous les styles
- `js/` : un fichier par grande partie (core, data, stats, ui, presets, app, community-cloud, onboarding, pwa, recap, boot), chargés dans cet ordre
- `scripts/release.sh <n°> "message"` : met la version à jour partout, lance les tests, fabrique la version autonome, commit et push
- `scripts/inline.py` : fabrique un fichier HTML unique (CSS + JS intégrés)
- `tests/run.js` : toute la suite de tests en une commande (4 fichiers en parallèle)
- Démarrage rapide : bouton optionnel sur l'accueil (Paramètres → Affichage), lance le jeu favori (le plus joué), Belote / Coinche ou un jeu au choix
