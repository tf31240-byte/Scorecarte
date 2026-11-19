    // ==================== DATA LAYER ====================
    const GameState = {

        // --- Création ---
        /**
         * Génère le tableau de joueurs par défaut pour un nouvel état de jeu.
         * Noms Belote : "NOUS" / "EUX". Autres : "J1", "J2", …
         */
        _defaultPlayers(mode, count, colors) {
            return Array.from({ length: count }, (_, i) => ({
                id:           i + 1,
                name:         mode === 'belote' ? (i === 0 ? 'NOUS' : 'EUX') : `J${i + 1}`,
                color:        colors[i] || '#000000',
                total:        0,
                previousRank: null
            }));
        },

        create(mode, playerCount) {
            const colors = PLAYER_COLORS;
            // Force minimum 2 joueurs, maximum 12
            const validPlayerCount = Math.max(2, Math.min(playerCount, 12));
            return {
                mode,
                victoryCondition: VC_HIGHEST,
                players: this._defaultPlayers(mode, validPlayerCount, colors),
                history: [], temp: {}, dealerId: 1, celebratedMilestones: {}
            };
        },

        // --- Manipulation des manches ---


        /**
         * Ajoute une manche à l'historique et recalcule les totaux.
         * @param {Object} state
         * @param {Object} scores  { playerId: number }
         */
        addRound(state, scores) {
            const round = {};
            state.players.forEach(p => {
                const score = scores[p.id] || 0;
                round[p.id] = score;
                p.total += score;
            });
            state.history.push(round);
            return state;
        },
        updateRound(state, index, scores) {
            const oldRound = state.history[index];
            state.players.forEach(p => p.total -= (oldRound[p.id] || 0));
            const newRound = {};
            state.players.forEach(p => {
                const score = scores[p.id] || 0;
                newRound[p.id] = score;
                p.total += score;
            });
            state.history[index] = newRound;
            return state;
        },
        deleteRound(state, index) {
            const round = state.history[index];
            state.players.forEach(p => p.total -= (round[p.id] || 0));
            state.history.splice(index, 1);
            return state;
        },
        // Recalculer les totaux depuis l'historique (pour réparer les données corrompues)

        /**
         * Ajoute les scores d'une manche aux totaux des joueurs (avec validation).
         * Ignore les valeurs non-numériques ou non-finies.
         */
        _applyRoundToTotals(players, round) {
            players.forEach(p => {
                const score = round[p.id];
                if (typeof score === 'number' && isFinite(score) && !isNaN(score))
                    p.total += score;
            });
        },

        rebuildTotals(state) {
            if (!state || !state.players || !state.history) return state;
            // Réinitialiser tous les totaux à 0
            state.players.forEach(p => { p.total = 0; });
            state.history.forEach(round => this._applyRoundToTotals(state.players, round));
            return state;
        },

        // --- Lecture ---

        // --- Lecture & Validation ---
        /**
         * Retourne les joueurs triés selon la condition de victoire.
         * @param {Object} state
         * @returns {Array}
         */
        getSortedPlayers(state) {
            const isLowest = state.victoryCondition === VC_LOWEST;
            return [...state.players].sort((a, b) => 
                isLowest ? a.total - b.total : b.total - a.total
            );
        },

        // --- Validation ---

        /**
         * Valide que chaque valeur de score est un nombre fini dans les bornes.
         * @param {number[]} values  Valeurs de scores
         * @param {string}   mode   Mode de jeu (ex: 'belote')
         * @returns {{ valid: boolean, error?: string }}
         */
        _validateScoreValues(values, mode) {
            for (const v of values) {
                if (typeof v !== 'number' || isNaN(v) || !isFinite(v))
                    return { valid: false, error: 'Score invalide (doit être un nombre)' };
            }
            if (values.some(v => v > SCORE_MAX))
                return { valid: false, error: `Score trop élevé (max ${SCORE_MAX})` };
            if (values.some(v => v < SCORE_MIN))
                return { valid: false, error: `Score trop bas (min ${SCORE_MIN})` };
            if (mode === 'belote' && values.some(v => v < 0))
                return { valid: false, error: 'Score négatif impossible en Belote' };
            return { valid: true };
        },

        validate(scores, mode) {
            if (!scores || typeof scores !== 'object')
                return { valid: false, error: 'Scores invalides' };
            return this._validateScoreValues(Object.values(scores), mode);
        }
    };

    // ==================== STORAGE LAYER AMÉLIORÉ ====================
    const Storage = {
        GAMES_KEY:         'sm_v12_games',
        CURRENT_KEY:       'sm_v12_current',
        LEGACY_GAMES_KEY:  'sm_v11_games',
        LEGACY_CURRENT_KEY:'sm_v11_current',
        THEME_KEY:         'sm_theme',
        PALETTE_KEY:       'sm_palette',
        CUSTOM_KEY:        'sm_custom',
        SOUND_KEY:         'sm_sound',
        SETTINGS_KEY:      'sm_settings',
        SAVED_PLAYERS_KEY: 'sm_saved_players',
        RECENT_KEY:        'sm_recent_players',
        PRESET_STATS_KEY:  'sm_preset_stats',
        CUSTOM_PRESETS_KEY:'sm_custom_presets',
        HIDDEN_PRESETS_KEY:'sm_hidden_presets',
        PLAYER_STATS_KEY:  'sm_player_stats',
        memoryFallback: null, // Fallback en mémoire si localStorage désactivé
        storageAvailable: true,
        
        // Vérifier la disponibilité du localStorage

        // --- Initialisation & Migration ---
        /**
         * Teste localStorage et configure le fallback mémoire si nécessaire.
         */
        checkStorageAvailability() {
            try {
                const testKey = '__storage_test__';
                localStorage.setItem(testKey, testKey);
                localStorage.removeItem(testKey);
                this.storageAvailable = true;
                return true;
            } catch (e) {
                console.warn("localStorage non disponible - utilisation mémoire tampon");
                this.storageAvailable = false;
                if (!this.memoryFallback) {
                    this.memoryFallback = { games: [], current: null };
                }
                return false;
            }
        },
        

        /**
         * Tente la migration des données de la version 11 vers la version 12.
         * Copie GAMES_KEY et CURRENT_KEY si les parties v11 existent.
         */
        _migrateV11ToV12() {
            const v11Data = localStorage.getItem(this.LEGACY_GAMES_KEY);
            if (!v11Data) return;
            try {
                const parsed = JSON.parse(v11Data);
                if (!Array.isArray(parsed) || parsed.length === 0) return;
                localStorage.setItem(this.GAMES_KEY, v11Data);
                log('SM: Migration v11->v12 OK');
                const v11Current = localStorage.getItem(this.LEGACY_CURRENT_KEY);
                if (v11Current && parsed.find(g => String(g.id) === String(v11Current)))
                    localStorage.setItem(this.CURRENT_KEY, v11Current);
            } catch (e) { console.error('SM: Migration échouée', e); }
        },

        migrateData() {
            if (!this._requireStorage()) return;
            
            if (!localStorage.getItem(this.GAMES_KEY)) this._migrateV11ToV12();
        },
        
        // Valider les données avant sauvegarde

        // --- Validation & Sanitisation ---
        validateGameData(game) {
            if (!game || typeof game !== 'object') return false;
            if (!game.id || !game.mode || !game.state) return false;
            if (!Array.isArray(game.state.players)) return false;
            if (!Array.isArray(game.state.history)) return false;
            
            // Valider chaque joueur
            for (const player of game.state.players) {
                if (!player.id || typeof player.name !== 'string') return false;
                if (typeof player.total !== 'number') return false;
            }
            
            return true;
        },
        
        // Nettoyer les données corrompues

        // --- Sanitize helpers ---

        /**
         * Sanitise le tableau de joueurs : normalise id, name, color, total.
         * @param {Array} players Raw players from storage
         * @returns {Array} Sanitised player objects
         */
        _sanitizePlayers(players) {
            return players.map((p, i) => {
                // Strip des caractères HTML dangereux sur les noms importés.
                // _validatePlayerName le fait à la saisie, mais pas sur les données JSON importées.
                const rawName = String(p.name || `J${i + 1}`).toUpperCase().substring(0, NAME_MAX_LEN);
                const cleanName = rawName.replace(/[<>"'&]/g, '') || `J${i + 1}`;
                return {
                    id:           p.id || (i + 1),
                    name:         cleanName,
                    color:        (typeof p.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(p.color)) ? p.color : PLAYER_COLORS[i % PLAYER_COLORS.length],
                    total:        typeof p.total === 'number' ? p.total : 0,
                    previousRank: p.previousRank || null
                };
            });
        },

        /**
         * Sanitise l'historique des manches : ne conserve que les scores numériques valides.
         * @param {Array} history Raw history rounds from storage
         * @returns {Array} Sanitised history rounds
         */
        _sanitizeHistory(history) {
            return history.map(round => {
                const out = {};
                for (const [id, score] of Object.entries(round)) {
                    const n = Number(score);
                    if (!isNaN(n)) out[id] = n;
                }
                return out;
            });
        },


        /**
         * Construit l'objet state initial sanitisé avec les valeurs par défaut sûres.
         * @param {Object} game  Partie source (peut être corrompue)
         */
        _buildSanitizedState(game) {
            return {
                mode:                 game.state?.mode || game.mode || 'standard',
                victoryCondition:     game.state?.victoryCondition || game.victoryCondition || VC_HIGHEST,
                players:              [],
                history:              [],
                temp:                 {},
                dealerId:             game.state?.dealerId || 1,
                celebratedMilestones: game.state?.celebratedMilestones || {}
            };
        },

        /** Série de revanches : { n: 2..99, wins: { id: 0..999 } } ; sinon rien. */
        _sanitizeSeries(sr) {
            if (!sr || typeof sr !== 'object') return {};
            const n = Math.max(1, Math.min(99, parseInt(sr.n, 10) || 1));
            const wins = {};
            Object.entries(sr.wins && typeof sr.wins === 'object' ? sr.wins : {}).slice(0, 20).forEach(([k, v]) => {
                const c = Math.max(0, Math.min(999, parseInt(v, 10) || 0)); if (c) wins[String(k).slice(0, 20)] = c;
            });
            return { series: { n, wins } };
        },

        _buildSanitizedShell(game) {
            return {
                id:               game.id || Date.now().toString(),
                name:             String(game.name || 'Partie'),
                mode:             game.mode || 'standard',
                date:             game.date || new Date().toISOString(),
                victoryCondition: game.victoryCondition || VC_HIGHEST,
                endCondition:     game.endCondition || { type: END_FREE, value: null },
                finished:         Boolean(game.finished),
                ...this._sanitizeSeries(game.series),
                preset:           game.preset || null,
                ...(game.lastModified ? { lastModified: String(game.lastModified) } : {}),
                state: this._buildSanitizedState(game)
            };
        },


        /**
         * Sanitise players et history d'un état source dans un état destination,
         * puis reconstruit les totaux. Appelé par sanitizeGame.
         */
        _sanitizeStateInto(dest, src) {
            if (Array.isArray(src?.players))
                dest.players = this._sanitizePlayers(src.players);
            if (Array.isArray(src?.history))
                dest.history = this._sanitizeHistory(src.history);
            GameState.rebuildTotals(dest);
        },

        sanitizeGame(game, forceRebuild = false) {
            if (!game) return null;
            
            // Ignorer le flag _sanitized legacy - toujours reconstruire pour garantir l'intégrité
            
            const sanitized = this._buildSanitizedShell(game);
            this._sanitizeStateInto(sanitized.state, game.state);
            return sanitized;
        },
        

        // --- CRUD ---
        /**
         * Tente de récupérer de l'espace localStorage en supprimant les vieilles parties,
         * puis réessaie UNE SEULE FOIS la sauvegarde (pas de récursion).
         * @param {Object} game Partie à sauvegarder
         * @returns {boolean}
         */
        _saveAfterEviction(game) {
            try {
                const games = this.loadGames() || [];
                if (games.length <= 5) return false;
                const trimmed = games.slice(-5);
                localStorage.setItem(this.GAMES_KEY, JSON.stringify(trimmed));
                try {
                    localStorage.setItem(this.GAMES_KEY, JSON.stringify([...trimmed, game]));
                    localStorage.setItem(this.CURRENT_KEY, game.id);
                    return true;
                } catch(e3) {
                    console.error('SM: Impossible de sauvegarder même après nettoyage');
                    return false;
                }
            } catch(e2) {
                console.error('SM: Impossible de nettoyer', e2);
                return false;
            }
        },


        // --- saveGame helpers ---

        /** Sauvegarde une partie dans le fallback mémoire (localStorage indisponible). */
        _saveToMemory(game) {
            if (!this.memoryFallback) this.memoryFallback = { games: [], current: null };
            const idx = this.memoryFallback.games.findIndex(g => g.id === game.id);
            if (idx >= 0) this.memoryFallback.games[idx] = game;
            else this.memoryFallback.games.push(game);
            this.memoryFallback.current = game.id;
            return true;
        },

        /**
         * Écrit la partie dans localStorage (upsert dans la liste).
         * @returns {boolean}
         */
        _persistGame(game) {
            const games = this.loadGames() || [];
            const idx   = games.findIndex(g => g.id === game.id);
            if (idx >= 0) games[idx] = game;
            else games.push(game);
            localStorage.setItem(this.GAMES_KEY, JSON.stringify(games));
            localStorage.setItem(this.CURRENT_KEY, game.id);
            return true;
        },


        /**
         * Valide les données de jeu et tente une réparation si invalides.
         * @returns {Object|null} game réparé, ou null si la réparation échoue
         */
        _validateOrRepair(game) {
            if (this.validateGameData(game)) return game;
            console.error('SM: Données invalides, tentative de réparation');
            const repaired = this.sanitizeGame(game);
            if (!repaired) console.error('SM: Impossible de réparer les données');
            return repaired;
        },


        /**
         * Tente la persistance localStorage avec gestion QuotaExceededError.
         * @returns {boolean}
         */
        _trySave(game) {
            try {
                return this._persistGame(game);
            } catch (e) {
                console.error('SM: Save failed', e);
                if (e.name === 'QuotaExceededError') return this._saveAfterEviction(game);
                return false;
            }
        },

        saveGame(game) {
            // Mettre à jour la date de dernière modification
            game.lastModified = new Date().toISOString();
            
            game = this._validateOrRepair(game);
            if (!game) return false;
            
            if (!this._requireStorage()) return this._saveToMemory(game);
            return this._trySave(game);
        },
        

        /**
         * Parse et valide le JSON brut des parties.
         * Nettoie les entrées corrompues sans planter.
         * @param {string} raw JSON string from localStorage
         * @returns {Array} Parties valides sanitisées
         */
        _parseGamesArray(raw) {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                console.warn('SM: Données corrompues, réinitialisation');
                localStorage.removeItem(this.GAMES_KEY);
                return [];
            }
            return parsed.map(game => {
                try   { return this.sanitizeGame(game); }
                catch (e) { console.warn('SM: Partie corrompue ignorée', e); return null; }
            }).filter(g => g !== null);
        },

        loadGames() {
            // Utiliser le fallback mémoire si localStorage indisponible
            if (!this._requireStorage()) {
                return this.memoryFallback?.games || [];
            }
            
            try {
                const data = localStorage.getItem(this.GAMES_KEY);
                if (!data) return [];
                
                return this._parseGamesArray(data);
                
            } catch(e) { 
                console.error("SM: Corrupt data", e); 
                return []; 
            }
        },
        
        loadCurrentGame() {
            // Utiliser le fallback mémoire si localStorage indisponible
            if (!this._requireStorage()) {
                if (!this.memoryFallback) return null;
                return this.memoryFallback.games.find(g => g.id === this.memoryFallback.current);
            }
            
            try {
                const currentId = localStorage.getItem(this.CURRENT_KEY);
                if (!currentId) return null;
                return this.loadGames().find(g => g.id === currentId);
            } catch(e) { return null; }
        },
        

        // --- deleteGame helpers ---

        /** Supprime une partie du fallback mémoire. */
        _deleteFromMemory(gameId) {
            if (!this.memoryFallback) return;
            this.memoryFallback.games = this.memoryFallback.games.filter(g => g.id !== gameId);
            if (this.memoryFallback.current === gameId) this.memoryFallback.current = null;
        },

        /** Supprime une partie de localStorage. */
        _deleteFromStorage(gameId) {
            const games = this.loadGames().filter(g => g.id !== gameId);
            localStorage.setItem(this.GAMES_KEY, JSON.stringify(games));
            if (localStorage.getItem(this.CURRENT_KEY) === gameId)
                localStorage.removeItem(this.CURRENT_KEY);
        },


        /**
         * Sanitise et persiste une liste de parties importées.
         * Garantit l'intégrité des données avant écriture en localStorage.
         * @param {Array} games - Parties brutes issues du fichier d'import
         */
        importGames(games) {
            if (!Array.isArray(games)) return;
            const sanitized = games.map(g => this.sanitizeGame(g));
            try {
                localStorage.setItem(this.GAMES_KEY, JSON.stringify(sanitized));
            } catch(e) {
                if (this.memoryFallback) this.memoryFallback.games = sanitized;
            }
        },

        /** Efface toutes les parties et la partie courante (localStorage + fallback). */
        /** Persiste this.savedPlayers dans localStorage. */
        saveSavedPlayers(savedPlayers) {
            try {
                localStorage.setItem(this.SAVED_PLAYERS_KEY, JSON.stringify(savedPlayers));
            } catch(e) {
                if (this.memoryFallback) this.memoryFallback.savedPlayers = savedPlayers;
            }
        },

        /**
         * Vérifie la disponibilité du stockage, l'initialise si besoin.
         * @returns {boolean} true si le stockage est utilisable
         */
        _requireStorage() {
            return this.storageAvailable || this.checkStorageAvailability();
        },

        clearGames() {
            try {
                localStorage.removeItem(this.GAMES_KEY);
                localStorage.removeItem(this.CURRENT_KEY);
            } catch(e) { /* Ignore */ }
            if (this.memoryFallback) { this.memoryFallback.games = []; this.memoryFallback.current = null; }
        },

        deleteGame(gameId) {
            if (!this._requireStorage()) {
                this._deleteFromMemory(gameId); return;
            }
            this._deleteFromStorage(gameId);
        }
    };

