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

-- Sauvegardes cloud : une ligne par code de récupération (seule l'empreinte du code est conservée)
CREATE TABLE IF NOT EXISTS backups (
  code_hash   TEXT PRIMARY KEY,   -- SHA-256 du code de récupération
  payload     TEXT NOT NULL,      -- sauvegarde (JSON, éventuellement gzip + base64)
  enc         TEXT NOT NULL,      -- 'json' ou 'gzip'
  size        INTEGER NOT NULL,
  games       INTEGER NOT NULL DEFAULT 0,
  device      TEXT,               -- libellé de l'appareil ayant fait la sauvegarde
  app_version TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
