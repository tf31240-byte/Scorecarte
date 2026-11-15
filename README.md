# ScoreMaster

Application web (PWA) de suivi de scores pour jeux de cartes et de société : Belote / Coinche, Skyjo, Tarot, Rami, Uno, Flip 7…
Fonctionne **hors-ligne**, s'installe sur l'écran d'accueil, et garde toutes les données **sur l'appareil** (aucun compte, aucun serveur).

## Fonctionnalités

- Saisie rapide des scores (clavier dédié), mode Belote (capot, « reste »), manches modifiables, annulation
- Statistiques par joueur et par jeu, courbes d'évolution
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

## Développement

Aucune étape de build : ouvrir `index.html` via un serveur statique (le Service Worker exige http/https) :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Mise à jour du cache hors-ligne

À chaque version publiée, incrémenter `scoremaster-app-vXX` et `scoremaster-cdn-vXX` dans `service-worker.js` pour que les appareils récupèrent la nouvelle version au prochain chargement.

Bibliothèques CDN (versions figées) : Chart.js 4.6.1, canvas-confetti 1.6.0, gifshot 0.4.5.
