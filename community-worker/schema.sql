-- Profils communauté ScoreMaster (inscription volontaire, avec consentement)
CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY,           -- identifiant aléatoire généré par l'app
  pseudo       TEXT NOT NULL,              -- prénom/pseudo saisi par la personne
  platform     TEXT,                       -- iOS, Android, Windows, macOS, Linux…
  os           TEXT,                       -- ex. "iOS 18.1", "Android 14"
  browser      TEXT,                       -- Safari, Chrome, Firefox…
  model        TEXT,                       -- modèle si disponible (ex. "SM-S918B")
  standalone   INTEGER NOT NULL DEFAULT 0, -- 1 = app installée sur l'écran d'accueil
  app_version  TEXT,
  games        INTEGER NOT NULL DEFAULT 0, -- nombre de parties terminées
  last_game_at TEXT,                       -- date de la dernière partie terminée (ISO)
  consent_at   TEXT NOT NULL,              -- date du consentement
  first_seen   TEXT NOT NULL,
  last_seen    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);
