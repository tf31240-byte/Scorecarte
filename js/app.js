    // ==================== APP CONTROLLER ====================
    const app = {
        currentGame: null, activePlayerId: null, editIdx: null, chart: null, savedPlayers: {}, focusMode: false,
        recentPlayers: [], // Les 8 derniers noms de joueurs utilisés
        _addValPlayers: new Set(), // Joueurs dont le score a été posé par addVal (pour typeNum)
        
        // Paramètres par défaut
        settings: {
            vibration: true,
            confetti: true,
            milestones: true,
            showChart: true,
            showTempScore: true
        },
        lastRanks: {}, // Pour le suivi des animations de rang
        pendingPreset: null, // Preset en attente lors de la sélection du nombre de joueurs
        tempCustomMode: null, // Configuration temporaire pour la sauvegarde de mode personnalisé

        // Noms par défaut à ne pas suggérer
        defaultNames: ['NOUS', 'EUX', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9', 'J10', 'J11', 'J12'],

        // Démarrage rapide Belote (2 équipes)

        // -----------------------------------------------------------------------
        // INITIALISATION & THÈME
        // -----------------------------------------------------------------------
        quickStartBelote() {
            SoundFX.click();
            this.createGame('belote', 2);
        },


        // --- Helpers (init) ---

        /** Charge toutes les préférences utilisateur depuis localStorage au démarrage. */

        // --- _loadPreferences sub-loaders ---

        _loadThemePref() {
            try {
                const theme = localStorage.getItem(Storage.THEME_KEY);
                const pal = localStorage.getItem(Storage.PALETTE_KEY);
                this.applyAppearance(theme === 'light' || theme === 'dark' ? theme : 'auto', pal);
                // En mode Auto : suivre les changements du système
                if (!this._schemeBound && window.matchMedia) {
                    this._schemeBound = true;
                    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.applyAppearance(this.getThemeMode(), this.getPalette()));
                }
            } catch(e) {}
        },
        _loadSoundPref() {
            try {
                const v = localStorage.getItem(Storage.SOUND_KEY);
                if (v !== null) SoundFX.enabled = (v === '1');
                this.updateSoundIcon();
            } catch(e) {}
        },
        _loadSettingsPref() {
            try {
                const v = localStorage.getItem(Storage.SETTINGS_KEY);
                if (v) this.settings = { ...this.settings, ...JSON.parse(v) };
            } catch(e) {}
        },
        _loadSavedPlayersPref() {
            try {
                const v = localStorage.getItem(Storage.SAVED_PLAYERS_KEY);
                if (v) this.savedPlayers = JSON.parse(v);
            } catch(e) { console.warn('Corrupt saved players data', e); this.savedPlayers = {}; }
        },
        _loadRecentPlayersPref() {
            try {
                const v = localStorage.getItem(Storage.RECENT_KEY);
                if (v) this.recentPlayers = JSON.parse(v);
            } catch(e) { console.warn('Corrupt recent players data', e); this.recentPlayers = []; }
        },

        _loadPreferences() {
            this._loadThemePref();
            this._loadSoundPref();
            this._loadSettingsPref();
            this._loadSavedPlayersPref();
            this._loadRecentPlayersPref();
        },


        /**
         * Charge la partie en cours depuis Storage, migre les champs manquants,
         * et affiche soit le jeu soit l'écran de setup.
         */
        _restoreCurrentGame() {
            const game = Storage.loadCurrentGame();
            if (game) {
                if (!game.victoryCondition) game.victoryCondition = VC_HIGHEST;
                if (!game.endCondition) game.endCondition = this._resolveEndCondition(game.mode, END_FREE, null);
                this.currentGame = game;
                this.showGame();
            } else {
                this.showSetup();
            }
        },

        init() {
            Storage.checkStorageAvailability();
            if (!this._keyBound) {
                this._keyBound = true;
                ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault())); // iOS : bloque le zoom par pincement
                document.addEventListener('keydown', e => this._sheetKey(e));
                document.addEventListener('keydown', e => {
                    if (e.key !== 'Escape' || document.getElementById('onboarding') || document.getElementById('sheet')?.classList.contains('active')) return;
                    if (UI._escapeTopModal()) e.preventDefault();
                });
            }
            Storage.migrateData();
            
            // Initialiser le moteur sonore
            SoundFX.init();
            
            this._loadPreferences();

            this._restoreCurrentGame();
            this.renderGamesList();
        },

        // -----------------------------------------------------------------------
        // THÈME, SON & PARAMÈTRES
        // -----------------------------------------------------------------------
        PALETTES: {
            ocean:    { name: 'Océan',      c: ['#006FE9', '#5856D6'] },
            forest:   { name: 'Forêt',      c: ['#1E864A', '#2E7D6B'] },
            dusk:     { name: 'Crépuscule', c: ['#8E4DE0', '#E0489A'] },
            midnight: { name: 'Minuit',     c: ['#E8B64C', '#111111'] },
            felt:     { name: 'Tapis vert', c: ['#1B6B3A', '#B8860B'] },
            custom:   { name: 'Perso',      c: ['#FF2D55', '#FF9500'] }
        },
        getThemeMode() {
            const t = document.documentElement.getAttribute('data-theme');
            return t === 'light' || t === 'dark' ? t : 'auto';
        },
        getPalette() {
            const p = document.documentElement.getAttribute('data-palette');
            return p && this.PALETTES[p] ? p : 'ocean';
        },
        _store(key, val) {
            try { if (Storage.storageAvailable) { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } }
            catch (e) { console.warn('Impossible de sauvegarder le thème:', e); }
        },
        /** Applique mode + palette sur <html> et met à jour la couleur de la barre du navigateur. */
        _HEX: /^#[0-9a-fA-F]{6}$/,
        getCustom() {
            try {
                const c = JSON.parse(localStorage.getItem(Storage.CUSTOM_KEY));
                if (c && this._HEX.test(c.p) && this._HEX.test(c.a)) return { p: c.p, a: c.a, tint: !!c.tint };
            } catch (e) {}
            return { p: '#FF2D55', a: '#FF9500', tint: true };
        },
        _rgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); },
        _hex(rgb) { return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); },
        _mix(a, b, t) { const A = this._rgb(a), B = this._rgb(b); return this._hex(A.map((v, i) => v * (1 - t) + B[i] * t)); },
        _lum(h) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = this._rgb(h); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); },
        /** Ajuste une couleur pour que le texte blanc reste lisible dessus (et qu'elle reste visible en sombre). */
        _fit(hex, dark) {
            let c = hex, n = 0;
            if (!dark) while (this._lum(c) > 0.18 && n++ < 25) c = this._mix(c, '#000000', 0.1); // lisible en texte sur fond clair
            n = 0;
            if (dark) while (this._lum(c) < 0.25 && n++ < 30) c = this._mix(c, '#ffffff', 0.1); // assez clair pour rester lisible en texte sur fond sombre
            return c;
        },
        _CUSTOM_VARS: ['--on-primary', '--primary', '--accent', '--bg', '--card', '--border', '--bg-gradient', '--glass-bg'],
        _applyCustomVars(on, dark) {
            const st = document.documentElement.style;
            this._CUSTOM_VARS.forEach(v => st.removeProperty(v));
            if (!on) return;
            const c = this.getCustom(), p = this._fit(c.p, dark), a = this._fit(c.a, dark);
            st.setProperty('--primary', p); st.setProperty('--accent', a);
            st.setProperty('--on-primary', this._lum(p) > 0.18 ? '#0B0B0F' : '#FFFFFF');
            if (!c.tint) return;
            if (dark) {
                const bg = this._mix('#000000', p, 0.10), card = this._mix('#000000', p, 0.17);
                st.setProperty('--bg', bg); st.setProperty('--card', card);
                st.setProperty('--border', this._mix('#000000', p, 0.30));
                st.setProperty('--bg-gradient', `radial-gradient(circle at 50% 0%, ${this._mix('#000000', p, 0.24)}, ${bg})`);
                const [r, g, b] = this._rgb(card); st.setProperty('--glass-bg', `rgba(${r},${g},${b},0.65)`);
            } else {
                const bg = this._mix('#ffffff', p, 0.07);
                st.setProperty('--bg', bg); st.setProperty('--card', '#FFFFFF');
                st.setProperty('--border', this._mix('#ffffff', p, 0.18));
                st.setProperty('--bg-gradient', `radial-gradient(circle at 50% 0%, #ffffff, ${bg})`);
                st.setProperty('--glass-bg', 'rgba(255,255,255,0.65)');
            }
        },
        setCustom(part) {
            const c = Object.assign(this.getCustom(), part);
            if (!this._HEX.test(c.p) || !this._HEX.test(c.a)) return;
            this._store(Storage.CUSTOM_KEY, JSON.stringify({ p: c.p, a: c.a, tint: !!c.tint }));
            this._store(Storage.PALETTE_KEY, 'custom');
            this.applyAppearance(this.getThemeMode(), 'custom', true);
            const sw = document.querySelector('.palette-btn.active .sw');
            if (sw) sw.style.background = `linear-gradient(135deg, ${c.p} 50%, ${c.a} 50%)`;
        },
        applyAppearance(mode, palette, skipUI) {
            const root = document.documentElement;
            if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode); else root.removeAttribute('data-theme');
            if (palette && palette !== 'ocean' && this.PALETTES[palette]) root.setAttribute('data-palette', palette); else root.removeAttribute('data-palette');
            const dark = mode === 'dark' || (mode !== 'light' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
            root.setAttribute('data-scheme', dark ? 'dark' : 'light');
            this._applyCustomVars(palette === 'custom', dark);
            const meta = document.getElementById('theme-color-meta');
            if (meta) { const c = getComputedStyle(root).getPropertyValue('--primary').trim(); if (c) meta.setAttribute('content', c); }
            if (!skipUI) UI.updateSettingsUI();
        },
        setThemeMode(mode) {
            if (!['auto', 'light', 'dark'].includes(mode)) return;
            this._store(Storage.THEME_KEY, mode === 'auto' ? null : mode);
            this.applyAppearance(mode, this.getPalette());
            vibrate(20);
        },
        setPalette(id) {
            if (!this.PALETTES[id]) return;
            this._store(Storage.PALETTE_KEY, id === 'ocean' ? null : id);
            this.applyAppearance(this.getThemeMode(), id);
            vibrate(20);
        },
        toggleTheme() {
            const dark = document.documentElement.getAttribute('data-scheme') === 'dark';
            this.setThemeMode(dark ? 'light' : 'dark');
        },
        updateThemeIcon() {
            // Met à jour le toggle dans le modal paramètres si ouvert
            UI.updateSettingsUI();
        },
        toggleSound() {
            SoundFX.enabled = !SoundFX.enabled;
            try {
                if (Storage.storageAvailable) {
                    localStorage.setItem(Storage.SOUND_KEY, SoundFX.enabled ? '1' : '0');
                }
            } catch(e) {
                console.warn('Impossible de sauvegarder le son:', e);
            }
            this.updateSoundIcon();
            vibrate(30);
        },
        updateSoundIcon() {
            // Met à jour le toggle dans le modal paramètres si ouvert
            UI.updateSettingsUI();
        },
        toggleSetting(key) {
            this.settings[key] = !this.settings[key];
            this.saveSettings();
            vibrate(30);
        },
        saveSettings() {
            try {
                localStorage.setItem(Storage.SETTINGS_KEY, JSON.stringify(this.settings));
            } catch(e) {
                console.warn('Impossible de sauvegarder les paramètres:', e);
            }
        },
        clearRecentPlayers() {
            SoundFX.click();
            UI.confirm('Effacer la liste des joueurs récents ?', () => {
                this.recentPlayers = [];
                try {
                    localStorage.removeItem(Storage.RECENT_KEY);
                } catch(e) {}
                UI.showToast('🗑️ Joueurs récents effacés', 'success');
            });
        },

        /**
         * Efface les données de statistiques et réinitialise les milestones de toutes les parties.
         * Appelé après confirmation dans resetStats.
         */
        _clearStatsData() {
            try {
                localStorage.removeItem(Storage.PLAYER_STATS_KEY);
                const games = Storage.loadGames();
                if (games) {
                    games.forEach(game => {
                        if (game.state?.celebratedMilestones)
                            game.state.celebratedMilestones = {};
                    });
                    localStorage.setItem(Storage.GAMES_KEY, JSON.stringify(games));
                }
                UI.showToast('📊 Statistiques réinitialisées', 'success');
            } catch(e) {
                console.error('Erreur reset stats:', e);
                UI.showToast('❌ Erreur lors de la réinitialisation', 'error');
            }
        },

        resetStats() {
            SoundFX.click();
            UI.confirm('Réinitialiser tous les classements et records ?', () => {
                this._clearStatsData();
            });
        },

        // -----------------------------------------------------------------------
        // EXPORT / IMPORT / STATS
        // -----------------------------------------------------------------------

        LAST_EXPORT_KEY: 'sm_last_export',
        BACKUP_STALE_DAYS: 30,

        _readJsonKey(key, fallback) {
            try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
            catch(e) { return fallback; }
        },

        /** Télécharge un Blob via un lien temporaire (révocation différée pour Safari/Android). */
        _downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href = url; a.download = filename; a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
        },

        /**
         * Partage le fichier via la feuille de partage native (mobile) si possible,
         * sinon télécharge. Retourne 'shared' | 'downloaded' | 'cancelled'.
         */
        async _deliverFile(blob, filename) {
            try {
                const file = new File([blob], filename, { type: blob.type });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'ScoreMaster' });
                    return 'shared';
                }
            } catch(e) {
                if (e && e.name === 'AbortError') return 'cancelled';
                // autre erreur : repli sur le téléchargement
            }
            this._downloadBlob(blob, filename);
            return 'downloaded';
        },

        /**
         * Construit l'objet d'export complet : parties, préférences, joueurs, jeux perso, stats.
         * @param {Object|null} currentGame  Partie courante chargée depuis Storage
         * @returns {Object}
         */
        _buildExportData(currentGame) {
            const games = Storage.loadGames();
            return {
                app:           'ScoreMaster',
                version:       2,
                exportDate:    new Date().toISOString(),
                counts:        { games: games.length },
                games:         games,
                currentGameId: currentGame?.id || null,
                settings:      this.settings,
                savedPlayers:  this.savedPlayers,
                recentPlayers: this.recentPlayers,
                customPresets: this._readJsonKey(Storage.CUSTOM_PRESETS_KEY, {}),
                hiddenPresets: this._readJsonKey(Storage.HIDDEN_PRESETS_KEY, []),
                presetStats:   this._readJsonKey(Storage.PRESET_STATS_KEY, {}),
                playerStats:   this._readJsonKey(Storage.PLAYER_STATS_KEY, {}),
                sound:         SoundFX.enabled,
                theme:         localStorage.getItem(Storage.THEME_KEY),
                palette:       localStorage.getItem(Storage.PALETTE_KEY),
                customPalette: localStorage.getItem(Storage.CUSTOM_KEY)
            };
        },

        _stamp() { return new Date().toISOString().split('T')[0]; },

        _markExported() {
            try { localStorage.setItem(this.LAST_EXPORT_KEY, new Date().toISOString()); } catch(e) {}
            UI.renderBackup();
        },

        _dataSummary() {
            const games = Storage.loadGames();
            const names = new Set();
            games.forEach(g => (g.state?.players || []).forEach(p => names.add(String(p.name).toLowerCase())));
            let last = null;
            try { last = localStorage.getItem(this.LAST_EXPORT_KEY); } catch(e) {}
            const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
            return {
                games: games.length,
                finished: games.filter(g => g.finished).length,
                players: names.size,
                last, days,
                stale: games.length > 0 && (days === null || days >= this.BACKUP_STALE_DAYS)
            };
        },

        /** Sauvegarde complète (.json) : partage natif sur mobile, téléchargement sinon. */
        async exportData() {
            SoundFX.click();
            try {
                const data = this._buildExportData(Storage.loadCurrentGame());
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const res  = await this._deliverFile(blob, `ScoreMaster_Sauvegarde_${this._stamp()}.json`);
                if (res === 'cancelled') return;
                this._markExported();
                UI.showToast(res === 'shared' ? '📤 Sauvegarde partagée' : '📤 Sauvegarde téléchargée', 'success');
            } catch(e) {
                console.error('Erreur export:', e);
                UI.showToast('❌ Erreur lors de l\'export', 'error');
            }
        },

        // --- CSV ---
        _csvCell(v) {
            let t = String(v ?? '');
            if (/^[=+\-@\t\r]/.test(t) && isNaN(Number(t))) t = "'" + t; // anti-injection de formule tableur
            return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
        },

        /** Une ligne par joueur et par partie (séparateur ';' + BOM : s'ouvre direct dans Excel FR). */
        _buildCsv(games) {
            const rows = [['Date', 'Jeu', 'Mode', 'Statut', 'Rang', 'Joueur', 'Score', 'Manches']];
            games.forEach(g => {
                const players = (g.state?.players || []).map(p => ({ name: p.name, total: Number(p.total) || 0 }));
                const lowest  = g.victoryCondition === VC_LOWEST;
                const sorted  = [...players].sort((a, b) => lowest ? a.total - b.total : b.total - a.total);
                const date    = (g.date || '').slice(0, 10);
                const rounds  = (g.state?.history || []).length;
                players.forEach(p => {
                    const rank = sorted.findIndex(x => x.total === p.total) + 1;
                    rows.push([date, g.name, g.mode, g.finished ? 'Terminée' : 'En cours', rank, p.name, p.total, rounds]);
                });
            });
            return '﻿' + rows.map(r => r.map(c => this._csvCell(c)).join(';')).join('\r\n');
        },

        /** Export tableur de l'historique (lecture seule, non réimportable). */
        async exportCsv() {
            SoundFX.click();
            const games = Storage.loadGames();
            if (!games.length) { UI.showToast('Aucune partie à exporter', 'warning'); return; }
            try {
                const blob = new Blob([this._buildCsv(games)], { type: 'text/csv;charset=utf-8' });
                const res  = await this._deliverFile(blob, `ScoreMaster_Historique_${this._stamp()}.csv`);
                if (res === 'cancelled') return;
                UI.showToast('📊 Tableau exporté', 'success');
            } catch(e) {
                console.error('Erreur export CSV:', e);
                UI.showToast('❌ Erreur lors de l\'export', 'error');
            }
        },

        // --- Import ---

        /** Ne garde que des clés sûres et des valeurs simples (texte borné, nombres, booléens) pour les jeux importés. */
        _cleanPresets(obj) {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
            const out = {};
            Object.entries(obj).slice(0, 100).forEach(([k, v]) => {
                if (!/^[\w-]{1,60}$/.test(k) || !v || typeof v !== 'object') return;
                const c = {};
                Object.entries(v).forEach(([f, x]) => {
                    if (typeof x === 'string') c[f] = x.slice(0, 80);
                    else if (typeof x === 'number' || typeof x === 'boolean' || x === null) c[f] = x;
                    else if (x && typeof x === 'object' && f === 'endCondition') c[f] = { type: String(x.type || '').slice(0, 20), value: typeof x.value === 'number' ? x.value : null };
                });
                out[k] = c;
            });
            return out;
        },

        _applyImportedExtras(data) {
            const putObj = (key, v, type) => {
                const ok = type === 'array' ? Array.isArray(v) : (v && typeof v === 'object' && !Array.isArray(v));
                if (ok) { try { localStorage.setItem(key, JSON.stringify(v)); } catch(e) {} }
            };
            putObj(Storage.CUSTOM_PRESETS_KEY, this._cleanPresets(data.customPresets), 'object');
            putObj(Storage.HIDDEN_PRESETS_KEY, data.hiddenPresets, 'array');
            putObj(Storage.PRESET_STATS_KEY,   data.presetStats,   'object');
            putObj(Storage.PLAYER_STATS_KEY,   data.playerStats,   'object');
        },

        // --- _applyImportedPrefs helpers ---

        /** Applique et persiste le thème importé. */
        _applyImportedTheme(theme) {
            if (theme !== 'light' && theme !== 'dark') return;
            localStorage.setItem(Storage.THEME_KEY, theme);
            app.applyAppearance(theme, app.getPalette());
        },

        /** Applique et persiste la palette importée (sauvegarde fichier ou cloud). */
        _applyImportedPalette(pal) {
            if (typeof pal !== 'string' || !app.PALETTES[pal]) return;
            if (pal === 'ocean') localStorage.removeItem(Storage.PALETTE_KEY); else localStorage.setItem(Storage.PALETTE_KEY, pal);
            app.applyAppearance(app.getThemeMode(), pal);
        },

        /** Applique et persiste l'état du son importé. */
        _applyImportedSound(sound) {
            SoundFX.enabled = !!sound;
            localStorage.setItem(Storage.SOUND_KEY, sound ? '1' : '0');
        },

        _applyImportedPrefs(data) {
            if (data.settings && typeof data.settings === 'object') {
                this.settings = { ...this.settings, ...data.settings };
                this.saveSettings();
            }
            if (Array.isArray(data.savedPlayers)) {
                this.savedPlayers = data.savedPlayers;
                Storage.saveSavedPlayers(data.savedPlayers);
            }
            if (Array.isArray(data.recentPlayers)) {
                // Sanitiser les noms importés pour éviter XSS dans renderRecentSuggestions
                this.recentPlayers = data.recentPlayers
                    .filter(n => typeof n === 'string')
                    .map(n => n.replace(/[<>"'&]/g, '').substring(0, 20))
                    .filter(n => n.length > 0);
                localStorage.setItem(Storage.RECENT_KEY, JSON.stringify(this.recentPlayers));
            }
            this._applyImportedExtras(data);
            if (data.sound !== undefined) this._applyImportedSound(data.sound);
            if (data.theme) this._applyImportedTheme(data.theme);
            if (typeof data.customPalette === 'string') { try { const c = JSON.parse(data.customPalette); if (app._HEX.test(c.p) && app._HEX.test(c.a)) localStorage.setItem(Storage.CUSTOM_KEY, JSON.stringify({ p: c.p, a: c.a, tint: !!c.tint })); } catch (e) {} }
            if (data.palette !== undefined) this._applyImportedPalette(data.palette || 'ocean');
        },

        /**
         * Applique l'import. mode = 'replace' (remplace tout) ou 'merge' (ajoute les parties absentes).
         */
        _restoreImportedData(data, mode = 'replace') {
            if (Array.isArray(data.games)) {
                if (mode === 'merge') {
                    const local = Storage.loadGames();
                    const ids = new Set(local.map(g => String(g.id)));
                    const added = data.games.filter(g => g && !ids.has(String(g.id)));
                    Storage.importGames([...local, ...added]);
                    this._lastMergeAdded = added.length;
                } else {
                    Storage.importGames(data.games);
                }
            }
            if (mode === 'replace') this._applyImportedPrefs(data);

            const msg = mode === 'merge'
                ? `📥 ${this._lastMergeAdded || 0} nouvelle(s) partie(s) ajoutée(s)`
                : '📥 Données restaurées !';
            UI.showToast(msg, 'success');
            UI.closeBackup();
            localStorage.removeItem(Storage.CURRENT_KEY); // évite le flash d'écran au redémarrage
            setTimeout(() => this.init(), 500);
        },

        /** Valide la structure d'un objet d'import. Lève une Error si invalide. */
        _validateImportData(data) {
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('fichier non reconnu');
            if (!data.version)                                    throw new Error('version manquante');
            if (data.games !== undefined && !Array.isArray(data.games)) throw new Error('structure games invalide');
            if (!data.games?.length && !data.settings && !data.savedPlayers) throw new Error('fichier vide ou incompatible');
        },

        /** Étape 1 : lit et valide le fichier, puis affiche l'aperçu (rien n'est écrit encore). */
        importData(input) {
            const file = input.files[0];
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
                UI.showToast('❌ Format invalide — fichier .json requis', 'error');
                input.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this._validateImportData(data);
                    this._pendingImport = data;
                    UI.showImportPreview(data);
                } catch(err) {
                    console.error('Erreur import:', err);
                    UI.showToast(`❌ Import échoué : ${err.message}`, 'error');
                }
            };
            reader.onerror = () => UI.showToast('❌ Lecture du fichier impossible', 'error');
            reader.readAsText(file);
            input.value = ''; // Reset pour permettre de réimporter le même fichier
        },

        /** Étape 2 : confirmation de l'utilisateur. */
        confirmImport(mode) {
            const data = this._pendingImport;
            if (!data) return;
            this._pendingImport = null;
            try { this._restoreImportedData(data, mode); }
            catch(err) { console.error(err); UI.showToast(`❌ Import échoué : ${err.message}`, 'error'); }
        },

        cancelImport() { this._pendingImport = null; UI.renderBackup(); },

        // -----------------------------------------------------------------------
        // NAVIGATION ENTRE ÉCRANS
        // -----------------------------------------------------------------------

        // --- showSetup helpers ---

        /** Détruit le chart.js actif pour éviter les fuites mémoire. */
        _destroyChart() {
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }
        },

        /** Persiste la partie en cours si elle n'est pas encore terminée. */
        _saveCurrentIfActive() {
            if (this.currentGame && !this.currentGame.finished)
                Storage.saveGame(this.currentGame);
        },

        showSetup() {
            UI.closeVictory();
            this.focusMode = false;
            document.body.classList.remove('focus-mode');
            this._wakeLock(false);
            UI._hide('dock');
            
            this._saveCurrentIfActive();
            
            this._destroyChart();
            
            this.currentGame = null;
            this.editIdx = null;
            document.body.classList.remove('is-editing');
            UI._show('setup');
            UI._hide('game');
            this.renderGamesList();
        },
        // === GESTION DES PRESETS ===

        // -----------------------------------------------------------------------
        // GESTION DES PRESETS
        // -----------------------------------------------------------------------
        getPresetStats() {
            // Récupérer les statistiques d'utilisation des presets
            try {
                const stats = localStorage.getItem(Storage.PRESET_STATS_KEY);
                return stats ? JSON.parse(stats) : {};
            } catch(e) {
                return {};
            }
        },
        getCustomPresets() {
            // Récupérer les presets personnalisés
            try {
                const custom = localStorage.getItem(Storage.CUSTOM_PRESETS_KEY);
                return custom ? JSON.parse(custom) : {};
            } catch(e) {
                return {};
            }
        },
        saveCustomPreset(key, preset) {
            const custom = this.getCustomPresets();
            custom[key] = preset;
            try {
                localStorage.setItem(Storage.CUSTOM_PRESETS_KEY, JSON.stringify(custom));
                return true;
            } catch(e) {
                return false;
            }
        },
        deleteCustomPreset(key) {
            const custom = this.getCustomPresets();
            delete custom[key];
            try {
                localStorage.setItem(Storage.CUSTOM_PRESETS_KEY, JSON.stringify(custom));
                // Supprimer aussi des stats
                const stats = this.getPresetStats();
                delete stats[key];
                localStorage.setItem(Storage.PRESET_STATS_KEY, JSON.stringify(stats));
                return true;
            } catch(e) {
                return false;
            }
        },
        getHiddenPresets() {
            // Liste des presets cachés par l'utilisateur
            try {
                const hidden = localStorage.getItem(Storage.HIDDEN_PRESETS_KEY);
                return hidden ? JSON.parse(hidden) : [];
            } catch(e) {
                return [];
            }
        },
        hidePreset(key) {
            const hidden = this.getHiddenPresets();
            if (!hidden.includes(key)) {
                hidden.push(key);
                try {
                    localStorage.setItem(Storage.HIDDEN_PRESETS_KEY, JSON.stringify(hidden));
                    return true;
                } catch(e) {
                    return false;
                }
            }
            return true;
        },
        unhidePreset(key) {
            const hidden = this.getHiddenPresets();
            const index = hidden.indexOf(key);
            if (index > -1) {
                hidden.splice(index, 1);
                try {
                    localStorage.setItem(Storage.HIDDEN_PRESETS_KEY, JSON.stringify(hidden));
                    return true;
                } catch(e) {
                    return false;
                }
            }
            return true;
        },
        getAllPresets() {
            // Combiner les presets par défaut et personnalisés
            const custom = this.getCustomPresets();
            return { ...GAME_PRESETS, ...custom };
        },
        savePresetUsage(key) {
            // Sauvegarder l'utilisation d'un preset
            const stats = this.getPresetStats();
            stats[key] = {
                count: (stats[key]?.count || 0) + 1,
                lastUsed: Date.now()
            };
            try {
                localStorage.setItem(Storage.PRESET_STATS_KEY, JSON.stringify(stats));
            } catch(e) {}
        },
        getSortedPresets() {
            const stats = this.getPresetStats();
            const hidden = this.getHiddenPresets();
            const allPresets = this.getAllPresets();
            
            // Filtrer les presets cachés
            const presets = Object.entries(allPresets).filter(([key]) => !hidden.includes(key));
            
            // Trier par nombre d'utilisations (décroissant) puis par dernière utilisation
            return presets.sort(([keyA, gameA], [keyB, gameB]) => {
                const statA = stats[keyA] || { count: 0, lastUsed: 0 };
                const statB = stats[keyB] || { count: 0, lastUsed: 0 };
                
                // D'abord par count décroissant
                if (statA.count !== statB.count) {
                    return statB.count - statA.count;
                }
                // Ensuite par dernière utilisation décroissante
                return statB.lastUsed - statA.lastUsed;
            });
        },
        openPresets() {
            this.refreshPresetsGrid();
            UI._open('preset-modal');
        },

        // --- refreshPresetsGrid helpers ---

        /** Ajoute un titre de section + les cartes de la liste (si non vide). */
        _appendPresetSection(grid, title, presets) {
            if (!presets.length) return;
            const h = UI._makeEl('div', 'preset-section-title');
            h.textContent = title;
            grid.appendChild(h);
            presets.forEach(([key, game]) => grid.appendChild(this.createPresetCard(key, game)));
        },

        /** Ajoute la carte fixe "Personnaliser" à la grille. */
        _appendCustomCard(grid) {
            const card = document.createElement('div');
            card.className = 'preset-card custom';
            card.onclick = () => this.openCustomSetup();
            card.innerHTML = `
                <span class="preset-icon">⚙️</span>
                <span class="preset-name">Personnaliser</span>
                <span class="preset-tag">Créer votre config</span>`;
            grid.appendChild(card);
        },

        /** Ajoute le bouton "Restaurer X jeux masqués" si des presets sont cachés. */
        _appendRestoreBtn(grid) {
            const hidden = this.getHiddenPresets();
            if (!hidden.length) return;
            const btn = document.createElement('button');
            btn.className = 'preset-restore-btn';
            const s = hidden.length > 1;
            btn.innerHTML = `↩️ Restaurer ${hidden.length} jeu${s ? 'x' : ''} masqué${s ? 's' : ''}`;
            btn.onclick = () => this.showHiddenPresets();
            grid.appendChild(btn);
        },

        refreshPresetsGrid() {
            const grid = document.getElementById('presets-grid');
            grid.innerHTML = '';
            
            // Reset le mode édition
            grid.classList.remove('edit-mode');
            document.getElementById('preset-edit-btn')?.classList.remove('active');
            
            const sortedPresets = this.getSortedPresets();
            
            // Les 2 premiers sont les favoris (les plus joués)
            const favorites = sortedPresets.slice(0, 2);
            const others = sortedPresets.slice(2);
            
            this._appendPresetSection(grid, '⭐ Vos favoris', favorites);
            this._appendPresetSection(grid, '🎮 Tous les jeux', others);
            this._appendCustomCard(grid);
            this._appendRestoreBtn(grid);
        },

        /** Construit le HTML du modal des jeux masqués. */
        _buildHiddenPresetsHtml(hidden, allPresets) {
            const rows = hidden
                .filter(key => /^[\w-]{1,60}$/.test(key) && allPresets[key])
                .map(key => {
                    const g = allPresets[key];
                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--card); border-radius:12px; margin-bottom:8px;">
                            <div class="flex-ai-gap10">
                                <span style="font-size:24px;">${escapeHtml(g.icon)}</span>
                                <span style="font-weight:700;">${escapeHtml(g.name)}</span>
                            </div>
                            <button onclick="app.restorePreset('${key}')" class="btn-action-success">Restaurer</button>
                        </div>`;
                }).join('');
            return `
                <div class="modal-box" style="max-width:340px;">
                    <h3 class="centered-title">↩️ Jeux masqués</h3>
                    <div style="max-height:300px; overflow-y:auto;">
                        ${rows || '<p style="text-align:center; color:var(--text-sec);">Aucun jeu masqué</p>'}
                    </div>
                    <button onclick="document.getElementById('hidden-presets-modal').remove()" class="btn-full-secondary">Fermer</button>
                </div>`;
        },

        showHiddenPresets() {
            const hidden = this.getHiddenPresets();
            if (hidden.length === 0) return;
            
            const allPresets = this.getAllPresets();
            
            // Créer un modal pour afficher les jeux masqués
            const existingModal = document.getElementById('hidden-presets-modal');
            if (existingModal) existingModal.remove();
            
            const modal = document.createElement('div');
            modal.id = 'hidden-presets-modal';
            modal.className = 'modal-overlay active';
            modal.style.zIndex = '11000';
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
            
            modal.innerHTML = this._buildHiddenPresetsHtml(hidden, allPresets);
            document.body.appendChild(modal);
        },
        restorePreset(key) {
            this.unhidePreset(key);
            const allPresets = this.getAllPresets();
            const game = allPresets[key];
            UI.showToast(`↩️ ${game?.name || 'Jeu'} restauré`, 'success');
            
            // Vérifier s'il reste des jeux masqués
            const remaining = this.getHiddenPresets();
            if (remaining.length === 0) {
                // Fermer le modal si plus de jeux masqués
                const modal = document.getElementById('hidden-presets-modal');
                if (modal) modal.remove();
            } else {
                // Rafraîchir le modal des jeux masqués
                this.showHiddenPresets();
            }
            // Rafraîchir la grille principale
            this.refreshPresetsGrid();
        },

        // --- createPresetCard helpers ---

        /** Crée le bouton ✕ de suppression/masquage d'une carte preset. */
        _buildPresetDeleteBtn(key, name, isCustom) {
            const btn = document.createElement('button');
            btn.className = 'preset-delete';
            btn.textContent = '✕';
            btn.onclick = (e) => {
                e.stopPropagation();
                this.confirmDeletePreset(key, name, isCustom);
            };
            return btn;
        },

        /** Crée le div de contenu d'une carte preset (icône + nom + tag). */
        _buildPresetCardContent(game) {
            const div = document.createElement('div');
            div.innerHTML = `
                <span class="preset-icon">${escapeHtml(game.icon)}</span>
                <span class="preset-name">${escapeHtml(game.name)}</span>
                <span class="preset-tag">${escapeHtml(game.tag)}</span>
            `;
            return div;
        },

        createPresetCard(key, game) {
            const card = document.createElement('div');
            const isCustom = game.custom === true;
            card.className = 'preset-card' + (isCustom ? ' custom-mode' : '');
            
            card.appendChild(this._buildPresetDeleteBtn(key, game.name, isCustom));
            
            card.onclick = () => this.applyPreset(key);
            
            card.appendChild(this._buildPresetCardContent(game));
            
            return card;
        },
        confirmDeletePreset(key, name, isCustom) {
            const title = isCustom ? 'Supprimer' : 'Masquer';
            
            // Message court pour le modal (textContent ne gère pas les \n)
            UI.confirm(`${title} "${name}" ?`, () => {
                if (isCustom) {
                    this.deleteCustomPreset(key);
                } else {
                    this.hidePreset(key);
                }
                UI.showToast(`🗑️ ${name} ${isCustom ? 'supprimé' : 'masqué'}`, 'success');
                // Rafraîchir la grille sans fermer le modal
                this.refreshPresetsGrid();
            });
        },
        togglePresetEditMode() {
            const grid = document.getElementById('presets-grid');
            const btn = document.getElementById('preset-edit-btn');
            
            grid.classList.toggle('edit-mode');
            btn.classList.toggle('active');
            
            // Feedback sonore
            SoundFX.click();
        },
        closePresets() {
            const grid = document.getElementById('presets-grid');
            grid.classList.remove('edit-mode');
            document.getElementById('preset-edit-btn')?.classList.remove('active');
            UI._close('preset-modal');
        },

        /**
         * Aiguille vers la création directe (nombre de joueurs connu)
         * ou l'ouverture du sélecteur de joueurs (nombre libre).
         */
        _routePreset(key, game) {
            if (game.players) this.createGameWithPreset(key, game);
            else               this.openPlayerCountWithPreset(key, game);
        },

        applyPreset(key) {
            const allPresets = this.getAllPresets();
            const game = allPresets[key];
            if (!game) return;
            
            SoundFX.click();
            this.closePresets();
            
            // Enregistrer l'utilisation
            this.savePresetUsage(key);
            
            this._routePreset(key, game);
        },

        /**
         * Construit l'objet partie à partir d'un preset et applique les joueurs sauvegardés.
         * @param {string} key   Clé du preset
         * @param {Object} game  Config du preset (name, victory, endType, endValue, players)
         * @returns {Object} currentGame
         */
        _buildPresetGameObject(key, game) {
            const state = GameState.create('standard', game.players);
            const obj = {
                id:               Date.now().toString(),
                name:             game.name,
                mode:             'standard',
                date:             new Date().toISOString(),
                victoryCondition: game.victory || VC_HIGHEST,
                endCondition:     { type: game.endType || END_FREE, value: game.endValue ?? null },
                state,
                finished:         false,
                preset:           key
            };
            this._restoreSavedPlayers(obj.state, 'standard', game.players);
            return obj;
        },

        createGameWithPreset(key, game) {
            this.currentGame = this._buildPresetGameObject(key, game);
            
            if(!Storage.saveGame(this.currentGame)) { UI.showToast('⚠️ Erreur de sauvegarde', 'warning'); return; }
            
            UI.showToast(`🎮 ${game.name} configuré !`, 'success');
            this.showGame();
        },

        /**
         * Pré-remplit les radios et inputs du modal "player count" selon un preset.
         * @param {Object} game Config du preset
         */
        _applyPresetToModal(game) {
            const victoryRadio = document.querySelector(`input[name="victory-condition"][value="${game.victory}"]`);
            if (victoryRadio) { victoryRadio.checked = true; this.updateVictoryCondition(); }

            const endRadio = document.querySelector(`input[name="end-condition"][value="${game.endType}"]`);
            if (endRadio) { endRadio.checked = true; this.updateEndCondition(); }

            const scoreInput = document.getElementById('score-target');
            scoreInput.value = (game.endType === END_SCORE && game.endValue) ? game.endValue : 100;
        },

        openPlayerCountWithPreset(key, game) {
            // Pré-configurer les options dans le modal player count
            document.getElementById('mode-setup-title').textContent = game.name;
            
            // Afficher le bouton retour
            UI._show('btn-back-to-presets');
            
            this._applyPresetToModal(game);
            this.pendingPreset = { key, game };
            UI._open('modal-player-count');
        },
        openCustomSetup() {
            SoundFX.click();
            this.closePresets();
            
            // Afficher le bouton retour
            UI._show('btn-back-to-presets');
            
            // Reset des options
            document.getElementById('mode-setup-title').textContent = 'Mode Personnalisé';
            document.querySelector(`input[name="victory-condition"][value="${VC_HIGHEST}"]`).checked = true;
            document.querySelector(`input[name="end-condition"][value="${END_FREE}"]`).checked = true;
            document.getElementById('score-target').value = 100;
            this.updateVictoryCondition();
            this.updateEndCondition();
            
            this.pendingPreset = null;
            UI._open('modal-player-count');
        },
        backToPresets() {
            SoundFX.click();
            // Cacher le bouton retour
            UI._hide('btn-back-to-presets');
            // Fermer le modal player count
            UI._close('modal-player-count');
            // Réouvrir le modal presets
            this.openPresets();
        },
        closePlayerCountModal() {
            UI._close('modal-player-count');
            UI._hide('btn-back-to-presets');
            this.pendingPreset = null;
        },
        // === SAUVEGARDE MODE PERSONNALISÉ ===

        // -----------------------------------------------------------------------
        // MODE PERSONNALISÉ (création / sauvegarde)
        // -----------------------------------------------------------------------

        /** Remet les boutons emoji du picker à leur état initial (sélection du premier). */
        _resetEmojiPicker() {
            document.querySelectorAll('.emoji-option').forEach(btn => btn.classList.remove('selected'));
            document.querySelector('.emoji-option')?.classList.add('selected');
            const addBtn = document.querySelector('.emoji-add');
            if (addBtn) { addBtn.textContent = '+'; addBtn.classList.remove('selected'); }
        },

        openSaveCustomModal() {
            // Récupérer les valeurs actuelles
            const victory = document.querySelector('input[name="victory-condition"]:checked')?.value || VC_HIGHEST;
            const endType = document.querySelector('input[name="end-condition"]:checked')?.value || END_FREE;
            const rawTarget = parseInt(document.getElementById('score-target').value);
            const endValue = endType === END_SCORE ? (isNaN(rawTarget) ? null : rawTarget) : null;
            
            // Stocker temporairement
            this.tempCustomMode = { victory, endType, endValue };
            
            // Reset le formulaire
            document.getElementById('custom-mode-name').value = '';
            document.getElementById('custom-mode-emoji').value = '🎮';
            
            this._resetEmojiPicker();
            
            UI._open('save-custom-modal');
        },
        selectEmoji(emoji, event) {
            document.getElementById('custom-mode-emoji').value = emoji;
            document.querySelectorAll('.emoji-option').forEach(btn => btn.classList.remove('selected'));
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('selected');
            }
            
            // Reset le bouton "+" à son état initial
            const addBtn = document.querySelector('.emoji-add');
            if (addBtn) {
                addBtn.textContent = '+';
            }
        },

        /** Crée et retourne le modal de saisie d'emoji personnalisé (compatible iOS). */
        _createEmojiModal() {
            const modal = document.createElement('div');
            modal.id = 'emoji-input-modal';
            modal.className = 'modal-overlay active';
            modal.style.zIndex = '11000';
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
            modal.innerHTML = `
                <div class="modal-box" style="max-width:300px;">
                    <h3 class="centered-title">🎨 Choisissez un emoji</h3>
                    <input type="text" id="emoji-text-input" placeholder="Tapez votre emoji" maxlength="2"
                           style="width:100%; padding:15px; border:2px solid var(--primary); border-radius:14px;
                                  font-size:32px; text-align:center; background:var(--bg); color:var(--text);
                                  box-sizing:border-box; margin-bottom:15px;">
                    <div class="flex-gap10">
                        <button id="emoji-cancel-btn" style="flex:1; padding:14px; background:var(--card); color:var(--text);
                                border:1px solid var(--border); border-radius:14px; font-size:14px; font-weight:700; cursor:pointer;">Annuler</button>
                        <button id="emoji-confirm-btn" style="flex:1; padding:14px; background:var(--primary); color:var(--on-primary);
                                border:none; border-radius:14px; font-size:14px; font-weight:700; cursor:pointer;">✓ OK</button>
                    </div>
                </div>`;
            return modal;
        },

        openCustomEmojiPicker() {
            // Créer un modal temporaire avec un input visible pour iOS
            const existingModal = document.getElementById('emoji-input-modal');
            if (existingModal) existingModal.remove();
            
            const modal = this._createEmojiModal();
            document.body.appendChild(modal);
            document.getElementById('emoji-cancel-btn').onclick = () => modal.remove();
            document.getElementById('emoji-confirm-btn').onclick = () => this.confirmCustomEmoji();
            setTimeout(() => document.getElementById('emoji-text-input')?.focus(), 100);
        },

        /** Applique l'emoji personnalisé au champ caché et met à jour le bouton "+". */
        _applyCustomEmoji(emoji) {
            document.getElementById('custom-mode-emoji').value = emoji;
            const addBtn = document.querySelector('.emoji-add');
            if (addBtn) { addBtn.textContent = emoji; addBtn.classList.add('selected'); }
            document.querySelectorAll('.emoji-option:not(.emoji-add)')
                .forEach(btn => btn.classList.remove('selected'));
        },

        confirmCustomEmoji() {
            const input = document.getElementById('emoji-text-input');
            const modal = document.getElementById('emoji-input-modal');
            if (!input || !modal) return;
            
            const emoji = input.value.trim();
            if (!emoji) { UI.showToast('⚠️ Veuillez entrer un emoji', 'warning'); return; }
            this._applyCustomEmoji(emoji);
            modal.remove();
        },

        /**
         * Valide les champs du formulaire de sauvegarde de mode personnalisé.
         * @returns {boolean} true si valide (toasts déclenchés si invalide)
         */

        /**
         * Vérifie si un nom de preset existe déjà (comparaison insensible à la casse).
         * @param {string} name
         * @returns {boolean}
         */
        _isPresetNameTaken(name) {
            return Object.values(this.getAllPresets())
                .some(p => p.name.toLowerCase() === name.toLowerCase());
        },

        _validateCustomMode(name, emoji) {
            if (!name) {
                UI.showToast('⚠️ Veuillez entrer un nom', 'warning');
                return false;
            }
            if (!emoji || !emoji.trim()) {
                UI.showToast('⚠️ Veuillez choisir un emoji', 'warning');
                return false;
            }
            if (this._isPresetNameTaken(name)) {
                UI.showToast(`⚠️ Un jeu "${name}" existe déjà`, 'warning');
                return false;
            }
            if (!this.tempCustomMode) {
                UI.showToast('⚠️ Configuration manquante', 'warning');
                return false;
            }
            return true;
        },

        saveCustomMode() {
            const name = document.getElementById('custom-mode-name').value.trim();
            const emoji = document.getElementById('custom-mode-emoji').value;
            
            if (!this._validateCustomMode(name, emoji)) return;
            
            const { victory, endType, endValue } = this.tempCustomMode;
            const key    = 'custom_' + Date.now();
            const tag    = endType === END_FREE ? 'Partie libre' : (victory === VC_LOWEST ? `Limite ${endValue}` : `Objectif ${endValue}`);
            const preset = { name, icon: emoji, victory, endType, endValue, tag, custom: true };

            if (this.saveCustomPreset(key, preset)) {
                UI.showToast(`✅ ${name} sauvegardé !`, 'success');
                UI._close('save-custom-modal');
            } else {
                UI.showToast('⚠️ Erreur de sauvegarde', 'warning');
            }
            this.tempCustomMode = null;
        },
        updateVictoryCondition() {
            const isLowest = document.querySelector('input[name="victory-condition"]:checked')?.value === VC_LOWEST;
            const scoreLabel = document.getElementById('score-label-text');
            const highestLabel = document.getElementById('victory-highest-label');
            const lowestLabel = document.getElementById('victory-lowest-label');
            
            if (this.currentGame?.state) {
                this.currentGame.state.victoryCondition = isLowest ? VC_LOWEST : VC_HIGHEST;
            }
            
            highestLabel.style.borderColor = !isLowest ? 'var(--primary)' : 'var(--border)';
            lowestLabel.style.borderColor = isLowest ? 'var(--primary)' : 'var(--border)';
            
            if(isLowest) {
                scoreLabel.textContent = '⚠️ Limite de défaite :';
            } else {
                scoreLabel.textContent = '🎯 Score objectif :';
            }
        },
        updateEndCondition() {
            const endType = document.querySelector('input[name="end-condition"]:checked')?.value;
            const freeLabel = document.getElementById('end-free-label');
            const scoreLabel = document.getElementById('end-score-label');
            
            freeLabel.style.borderColor = endType === END_FREE ? 'var(--primary)' : 'var(--border)';
            scoreLabel.style.borderColor = endType === END_SCORE ? 'var(--primary)' : 'var(--border)';
        },
        toggleMorePlayers() {
            const extraDiv = document.getElementById('extra-players');
            const btn = document.getElementById('btn-toggle-players');
            if (extraDiv.classList.contains('hidden')) { extraDiv.classList.remove('hidden'); btn.textContent = 'Moins ▲'; }
            else { extraDiv.classList.add('hidden'); btn.textContent = 'Plus ▼'; }
        },

        // -----------------------------------------------------------------------
        // CONFIGURATION DU NOMBRE DE JOUEURS
        // -----------------------------------------------------------------------

        // --- selectPlayerCount helpers ---

        /**
         * Lit et valide le champ score-target si endType === END_SCORE.
         * @returns {number|null|false} Score validé, null si libre, false si invalide.
         */
        _readScoreTarget(endType) {
            if (endType !== END_SCORE) return null;
            const val = parseInt(document.getElementById('score-target').value);
            if (isNaN(val) || val < 10) {
                UI.showToast('⚠️ Score minimum : 10 points', 'warning');
                return false;
            }
            if (val > SCORE_MAX) {
                UI.showToast(`⚠️ Score maximum : ${SCORE_MAX} points`, 'warning');
                return false;
            }
            return val;
        },

        /** Réinitialise l'UI du sélecteur de nombre de joueurs. */
        _resetPlayerCountUI() {
            UI._hide('btn-back-to-presets');
            UI._hide('extra-players');
            document.getElementById('btn-toggle-players').textContent = 'Plus ▼';
        },

        /**
         * Consomme le preset en attente et retourne ses valeurs clés.
         * @returns {{ presetName: string|null, presetKey: string|null }}
         */
        _consumePendingPreset() {
            const presetName = this.pendingPreset?.game?.name || null;
            const presetKey  = this.pendingPreset?.key       || null;
            this.pendingPreset = null;
            return { presetName, presetKey };
        },


        /**
         * Lit les valeurs du formulaire modal de sélection du nombre de joueurs.
         * @returns {{ victoryCondition, endType, scoreTarget }} ou null si validation échoue
         */
        _readPlayerCountForm() {
            const victoryCondition = document.querySelector('input[name="victory-condition"]:checked')?.value || VC_HIGHEST;
            const endType          = document.querySelector('input[name="end-condition"]:checked')?.value   || END_FREE;
            const scoreTarget      = this._readScoreTarget(endType);
            if (scoreTarget === false) return null;
            return { victoryCondition, endType, scoreTarget };
        },

        selectPlayerCount(count) {
            const gameConfig = this._readPlayerCountForm();
            if (!gameConfig) return;
            UI._close('modal-player-count');
            this._resetPlayerCountUI();
            const { presetName, presetKey } = this._consumePendingPreset();
            this.createGame('standard', count, gameConfig.victoryCondition, gameConfig.endType, gameConfig.scoreTarget, presetName, presetKey);
        },

        // -----------------------------------------------------------------------
        // CRÉATION & AFFICHAGE DE PARTIE
        // -----------------------------------------------------------------------

        /**
         * Réapplique les noms et couleurs sauvegardés de la dernière partie du même mode.
         * Ne fait rien si aucune composition sauvegardée ne correspond.
         */
        _restoreSavedPlayers(state, mode, playerCount) {
            const saved = this.savedPlayers[`${mode}_${playerCount}`];
            if (saved) {
                state.players.forEach((p, i) => {
                    if (saved[i]) { p.name = saved[i].name; p.color = saved[i].color; }
                });
            }
        },


        /**
         * Retourne la condition de fin adaptée au mode :
         * Belote → toujours score/1000, sinon utilise endType/scoreTarget.
         */
        _resolveEndCondition(mode, endType, scoreTarget) {
            return mode === 'belote'
                ? { type: END_SCORE, value: BELOTE_WIN_SCORE }
                : { type: endType, value: scoreTarget };
        },

        _buildGameObject(state, mode, playerCount, victoryCondition, endType, scoreTarget, presetName, presetKey) {
            const game = {
                id:             Date.now().toString(),
                name:           presetName || (mode === 'belote' ? 'Belote' : 'Partie Standard'),
                mode,
                date:           new Date().toISOString(),
                victoryCondition: state.victoryCondition,
                endCondition:   this._resolveEndCondition(mode, endType, scoreTarget),
                state,
                finished:       false,
                preset:         presetKey
            };

            this._restoreSavedPlayers(game.state, mode, playerCount);
            return game;
        },

        createGame(mode, playerCount, victoryCondition = VC_HIGHEST, endType = END_FREE, scoreTarget = null, presetName = null, presetKey = null) {
            // Créer le state et propager victoryCondition
            const state = GameState.create(mode, playerCount);
            state.victoryCondition = mode === 'belote' ? VC_HIGHEST : victoryCondition;
            
            this.currentGame = this._buildGameObject(state, mode, playerCount, victoryCondition, endType, scoreTarget, presetName, presetKey);
            if(!this._saveOrWarn()) return;
            this.showGame();
        },

        // --- showGame helpers ---

        /**
         * Construit le texte d'info affiché sous le titre de partie
         * (objectif / victoire / limite selon le mode).
         */
        _buildGameInfoText(isBelote) {
            if (isBelote) return '🎯 Premier à 1000 pts';
            const isLowest = this.currentGame.victoryCondition === VC_LOWEST;
            const endCond  = this.currentGame.endCondition;
            let text = isLowest ? '⬇️ Score le plus BAS' : '⬆️ Score le plus HAUT';
            if (endCond.type === END_SCORE)
                text += isLowest ? ` • Limite ${endCond.value} pts` : ` • Objectif ${endCond.value} pts`;
            return text;
        },

        /** Ajuste la visibilité des boutons spécifiques Belote (calc, 82, 50, capot). */
        _toggleBeloteButtons(isBelote) {
            document.getElementById('calc-btn').classList.toggle('hidden', !isBelote);
            document.getElementById('btn-82').classList.toggle('hidden', !isBelote);
            document.getElementById('btn-50').classList.toggle('hidden', isBelote);
            document.getElementById('smart-btn').textContent = isBelote ? 'CAPOT' : '+/-';
            document.getElementById('sheet').classList.toggle('belote', isBelote);
        },

        showGame() {
            UI._hide('setup');
            UI._show('game');
            UI._show('dock');
            const isBelote = this.currentGame.mode === 'belote';
            // Afficher le nom du jeu (preset ou mode)
            const gameName = this.currentGame.name || (isBelote ? 'BELOTE' : 'STANDARD');
            document.getElementById('mode-title').textContent = gameName.toUpperCase();
            
            document.getElementById('game-info').textContent = this._buildGameInfoText(isBelote)
                + (this.currentGame.series?.n > 1 ? ` • Revanche n°${this.currentGame.series.n} (${this._seriesText(false)})` : '');
            
            this._toggleBeloteButtons(isBelote);
            this.render();
        },
        toggleFocusMode() {
            SoundFX.click();
            this.focusMode = !this.focusMode;
            const root = document.body;

            if(this.focusMode) { 
                root.classList.add('focus-mode');
                vibrate(20);
                this._updateZenLabel();
                this._wakeLock(true);
            }
            else { 
                root.classList.remove('focus-mode');
                this._wakeLock(false);
            }
        },
        _updateZenLabel() {
            const el = document.getElementById('zen-round');
            if (!el || !this.currentGame) return;
            const n = this.currentGame.state.history.length;
            el.textContent = `${this.currentGame.name || ''} · MANCHE ${this.editIdx !== null ? this.editIdx + 1 : n + 1}`.toUpperCase();
        },
        /** Garde l'écran allumé en mode Zen (si le navigateur le permet). */
        async _wakeLock(on) {
            try {
                if (!on) { if (this._wl) { await this._wl.release(); this._wl = null; } return; }
                if (!('wakeLock' in navigator) || this._wl) return;
                this._wl = await navigator.wakeLock.request('screen');
                this._wl.addEventListener('release', () => { this._wl = null; });
                if (!this._wlBound) {
                    this._wlBound = true;
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'visible' && this.focusMode) this._wakeLock(true);
                    });
                }
            } catch (e) { /* refusé ou non supporté : sans conséquence */ }
        },
        showStats() { UI.showStats(); },
        // Chart avec debounce pour optimiser les performances
        _debouncedRenderChart: debounce(function(state, editIdx) {
            // Vérifier que currentGame existe toujours (peut avoir été effacé pendant le debounce)
            if (!app.currentGame) return;
            UI.renderChart(state, editIdx);
        }, 100),
        

        // -----------------------------------------------------------------------
        // RENDU PRINCIPAL & LISTES
        // -----------------------------------------------------------------------
        render() {
            if(!this.currentGame) return;
            UI.renderScoreCards(this.currentGame.state, this.editIdx);
            UI.renderHistory(this.currentGame.state, this.editIdx);
            if (this.focusMode) this._updateZenLabel();
            // Utiliser le chart avec debounce pour éviter les re-rendus excessifs
            this._debouncedRenderChart(this.currentGame.state, this.editIdx);
            
            // Mettre à jour le texte du bouton avec le numéro de manche
            if (this.editIdx === null) {
                this._setSaveBtn('save', this.currentGame.state.history.length + 1);
            }
        },

        // --- Helpers privés (renderGamesList) ---

        /**
         * Construit l'élément DOM d'une partie EN COURS pour la liste d'accueil.
         * @param {Object} game
         * @returns {HTMLElement}
         */
        /**
         * Extrait les métadonnées communes d'une partie (preset, icon, safeId, sortedPlayers).
         * @param {Object} game
         * @returns {{ preset, icon, safeId, sortedPlayers, isLowest }}
         */
        _getGameMeta(game) {
            const isLowest = game.state.victoryCondition === VC_LOWEST;
            const sortedPlayers = GameState.getSortedPlayers(game.state);
            const preset = this.getAllPresets()[game.preset] || null;
            const icon = preset?.icon || (game.mode === 'belote' ? '🃏' : '🎲');
            const safeId = String(game.id).replace(/[^a-zA-Z0-9_-]/g, '');
            return { isLowest, sortedPlayers, preset, icon, safeId };
        },


        /** Template HTML d'une carte de partie EN COURS dans l'accueil. */
        _currentItemHtml(icon, name, dateStr, timeStr, rounds, playersHtml) {
            return `
                <div class="current-header">
                    <span class="current-icon">${icon}</span>
                    <div class="current-info">
                        <div class="current-title-row">
                            <span class="current-title">${name}</span>
                            <span class="current-badge">En cours</span>
                        </div>
                        <div class="current-meta">${dateStr} • ${timeStr} • ${rounds} manche${rounds > 1 ? 's' : ''}</div>
                    </div>
                    <span class="current-arrow">›</span>
                </div>
                <div class="current-scores">${playersHtml}</div>`;
        },


        /** Génère le HTML d'une puce joueur (nom + couleur + score). */
        _playerChipHtml(p) {
            return `<div class="player-chip" style="background:${p.color}18; color:${p.color};">
                <span class="player-chip-dot" style="background:${p.color};"></span>
                <span class="player-chip-name">${escapeHtml(p.name)}</span>
                <span class="player-chip-score">${p.total}</span>
            </div>`;
        },

        _buildCurrentGameItem(game) {
            const { sortedPlayers, icon, safeId } = this._getGameMeta(game);
            const safeGameName = escapeHtml(game.name);
            const gameDate = new Date(game.lastModified || game.date);
            const dateStr = gameDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            const timeStr = gameDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const rounds = game.state.history.length;

            const playersHtml = sortedPlayers.map(p => this._playerChipHtml(p)).join('');

            const item = UI._makeEl('div', 'current-game-item', this._currentItemHtml(icon, safeGameName, dateStr, timeStr, rounds, playersHtml));
            item.onclick = () => this.loadGame(safeId);
            return item;
        },

        /** Template HTML d'un élément de partie terminée (liste historique). */
        _finishedItemHtml(safeId, icon, name, date, rounds, winner, winnerName, playersHtml) {
            return `
                <div class="collapsed-header" onclick="app.toggleGameItem('${safeId}')">
                    <div class="collapsed-info">
                        <span class="collapsed-icon">${icon}</span>
                        <div>
                            <div class="collapsed-title">${name}</div>
                            <div class="collapsed-date">${date} • ${rounds} manche${rounds !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div class="flex-ai-gap10">
                        <div class="collapsed-winner" style="color:${winner.color};">🏆 ${winnerName} (${winner.total})</div>
                        <span class="expand-icon">▼</span>
                    </div>
                </div>
                <div class="game-item-details">
                    <div class="game-item-players">${playersHtml}</div>
                    <div class="game-item-actions">
                        <button onclick="app.loadGame('${safeId}')" class="btn-action-primary">▶️ Voir</button>
                        <button onclick="event.stopPropagation(); app.deleteGame('${safeId}')" class="btn-ghost-danger">🗑️</button>
                    </div>
                </div>`;
        },

        _buildFinishedGameItem(game) {
            const { sortedPlayers, icon, safeId } = this._getGameMeta(game);
            const winner = sortedPlayers[0];
            const date = new Date(game.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            const safeGameName = escapeHtml(game.name);
            const safeWinnerName = escapeHtml(winner.name);
            const rounds = game.state.history.length;

            const playersHtml = sortedPlayers.map(p =>
                `<div class="game-player-score" style="background:${p.color}20; color:${p.color}; border:1px solid ${p.color}40;">${escapeHtml(p.name)}: ${p.total}</div>`
            ).join('');

            const item = UI._makeEl('div', 'game-item-collapsed', this._finishedItemHtml(safeId, icon, safeGameName, date, rounds, winner, safeWinnerName, playersHtml));
            item.setAttribute('data-game-id', safeId);
            return item;
        },


        // --- renderGamesList helpers ---

        /** Affiche l'état vide quand aucune partie n'est enregistrée. */
        _renderGamesEmpty(historyList, currentSection, filtersContainer, placeholder, clearAllBtn) {
            historyList.innerHTML = '';
            currentSection.style.display = 'none';
            filtersContainer.innerHTML = '';
            placeholder.innerHTML = '<div class="empty-icon">🎮</div><div>Aucune partie enregistrée<br>Lancez votre première partie !</div>';
            placeholder.style.display = 'block';
            clearAllBtn.style.display = 'none';
        },

        /** Filtre les parties terminées selon le filtre actif et les affiche dans la liste. */
        _renderFilteredGames(historyList, finishedGames, filter) {
            let games = filter === 'all' || filter === 'recent'
                ? finishedGames
                : finishedGames.filter(g =>
                    filter === 'belote' ? (g.mode === 'belote' || g.preset === 'belote') : g.preset === filter
                );

            if (!games.length) {
                historyList.innerHTML = '<p class="text-empty">Aucune partie dans cette catégorie</p>';
                return;
            }

            games = games.slice().reverse();
            if (filter === 'recent') games = games.slice(0, 10);

            historyList.innerHTML = '';
            games.forEach(game => historyList.appendChild(this._buildFinishedGameItem(game)));
        },


        /** Affiche les parties EN COURS triées par dernière modification. */
        _renderCurrentGames(currentGames, currentSection, currentGamesList) {
            if (!currentGames.length) { currentSection.style.display = 'none'; return; }
            currentSection.style.display = 'block';
            currentGamesList.innerHTML = '';
            const sorted = [...currentGames].sort((a, b) => {
                const da = a.lastModified || a.date || 0;
                const db = b.lastModified || b.date || 0;
                return new Date(db) - new Date(da);
            });
            sorted.forEach(game => currentGamesList.appendChild(this._buildCurrentGameItem(game)));
        },

        /** Affiche le placeholder d'historique quand aucun filtre n'est actif. */
        _showHistoryPlaceholder(historyList, placeholder, clearAllBtn, finishedCount) {
            historyList.innerHTML = '';
            const show = finishedCount > 0 ? 'block' : 'none';
            placeholder.style.display = show;
            clearAllBtn.style.display = show;
        },


        /** Collecte et retourne les éléments DOM utilisés par renderGamesList. */
        _gamesListElements() {
            return {
                currentGamesList: document.getElementById('current-games-list'),
                historyList:      document.getElementById('games-list'),
                currentSection:   document.getElementById('current-games-section'),
                filtersContainer: document.getElementById('history-filters'),
                placeholder:      document.getElementById('history-placeholder'),
                clearAllBtn:      document.getElementById('clear-all-btn')
            };
        },


        /**
         * Affiche le placeholder ou les parties filtrées selon si un filtre est actif.
         * Gère aussi la visibilité du bouton "Tout supprimer".
         */
        _renderHistorySection(historyList, placeholder, clearAllBtn, finishedGames, filter) {
            if (!filter) {
                this._showHistoryPlaceholder(historyList, placeholder, clearAllBtn, finishedGames.length);
                return;
            }
            placeholder.style.display  = 'none';
            clearAllBtn.style.display  = 'block';
            this._renderFilteredGames(historyList, finishedGames, filter);
        },


        /**
         * Sépare les parties en cours / terminées, rend les deux sections
         * et les filtres d'historique.
         */
        _renderAllGamesSections(games, els, filter) {
            const { currentGamesList, historyList, currentSection, placeholder, clearAllBtn } = els;
            const currentGames  = games.filter(g => !g.finished);
            const finishedGames = games.filter(g =>  g.finished);
            this._renderCurrentGames(currentGames, currentSection, currentGamesList);
            this.renderHistoryFilters(finishedGames, filter);
            this._renderHistorySection(historyList, placeholder, clearAllBtn, finishedGames, filter);
        },

        renderGamesList(filter = null) {
            try { Cloud.maybePrompt(); } catch(e) {}
            try { UI.renderBackup(); } catch(e) {} // met à jour la pastille « sauvegarde conseillée »
            const games = Storage.loadGames();
            const els = this._gamesListElements();
            if (!games?.length) {
                this._renderGamesEmpty(els.historyList, els.currentSection, els.filtersContainer, els.placeholder, els.clearAllBtn);
                return;
            }
            const { currentGamesList, historyList, currentSection, filtersContainer, placeholder, clearAllBtn } = els;
            this._renderAllGamesSections(games, els, filter);
        },
        /**
         * Retourne l'icône et le libellé court d'un filtre d'historique.
         * @param {string} key   Clé du preset/mode
         * @param {Object|null} preset
         * @returns {{ icon: string, label: string }}
         */
        _getFilterMeta(key, preset) {
            if (key === 'belote')   return { icon: '🃏', label: 'Belote' };
            if (key === 'standard') return { icon: '🎲', label: 'Standard' };
            const name = preset?.name || key;
            const label = name.length > 8 ? name.substring(0, 7) + '.' : name;
            return { icon: preset?.icon || '🎮', label };
        },


        // --- renderHistoryFilters helper ---

        /**
         * Construit le HTML de tous les boutons de filtre d'historique.
         * Toujours: "Récents". Par preset existant. "Tous" si > 1 type.
         */
        _buildFilterButtons(gameCounts, allPresets, activeFilter) {
            const btn = (filter, icon, label) => {
                const active = activeFilter === filter ? ' active' : '';
                const f = escapeHtml(filter);
                return `<button class="history-filter-btn${active}" data-filter="${f}" onclick="app.filterHistory('${f}')">
                    <span class="filter-icon">${icon}</span><span class="filter-label">${escapeHtml(label)}</span>
                </button>`;
            };

            let html = btn('recent', '🕐', 'Récents');

            Object.keys(gameCounts).sort().forEach(key => {
                const { icon, label } = this._getFilterMeta(key, allPresets[key]);
                html += btn(key, icon, label);
            });

            if (Object.keys(gameCounts).length > 1)
                html += btn('all', '📋', 'Tous');

            return html;
        },

        renderHistoryFilters(finishedGames, activeFilter = null) {
            const filtersContainer = document.getElementById('history-filters');
            if(!finishedGames || finishedGames.length === 0) {
                filtersContainer.innerHTML = '';
                return;
            }
            
            // Compter les parties par type
            const gameCounts = {};
            finishedGames.forEach(g => {
                const key = g.preset || (g.mode === 'belote' ? 'belote' : 'standard');
                gameCounts[key] = (gameCounts[key] || 0) + 1;
            });
            
            // Récupérer les infos des presets
            const allPresets = this.getAllPresets();
            
            filtersContainer.innerHTML = this._buildFilterButtons(gameCounts, allPresets, activeFilter);
        },
        toggleGameItem(id) {
            const item = document.querySelector(`.game-item-collapsed[data-game-id="${CSS.escape(id)}"]`);
            if(item) {
                item.classList.toggle('expanded');
            }
        },
        filterHistory(filter) {
            SoundFX.click();
            // Vérifier si ce filtre est déjà actif
            const activeBtn = document.querySelector('.history-filter-btn.active');
            const currentFilter = activeBtn?.getAttribute('data-filter');
            
            // Si le filtre est déjà actif, on le désélectionne et on ferme l'historique
            if(currentFilter === filter) {
                this.renderGamesList(null); // Ferme l'historique
                return;
            }
            
            // Re-render avec le filtre
            this.renderGamesList(filter);
        },

        // -----------------------------------------------------------------------
        // CHARGEMENT / SUPPRESSION DE PARTIES
        // -----------------------------------------------------------------------

        /**
         * Mémorise la composition joueurs d'une partie terminée/chargée dans savedPlayers.
         * @param {string} mode    Mode de jeu
         * @param {Array}  players Liste des joueurs
         */
        _memoizeComposition(mode, players) {
            const key = `${mode}_${players.length}`;
            this.savedPlayers[key] = players.map(p => ({ name: p.name, color: p.color }));
            Storage.saveSavedPlayers(this.savedPlayers);
        },

        /**
         * Persiste le joueur courant dans savedPlayers et marque la partie comme active.
         * Gère QuotaExceededError séparément pour afficher un toast pertinent.
         */
        _persistLoadedGame(game, id) {
            try {
                this._memoizeComposition(game.mode, game.state.players);
                localStorage.setItem(Storage.CURRENT_KEY, id);
            } catch(e) {
                if (e.name === 'QuotaExceededError')
                    UI.showToast('⚠️ Mémoire pleine ! Supprimez des parties.', 'warning');
                else
                    console.error('localStorage error:', e);
            }
        },

        /**
         * Sauvegarde this.currentGame. Affiche un toast et retourne false si échec.
         */
        _saveOrWarn() {
            if (!Storage.saveGame(this.currentGame)) {
                UI.showToast('⚠️ Mémoire pleine ! Supprimez des parties.', 'warning');
                return false;
            }
            return true;
        },

        loadGame(id) {
            SoundFX.click();
            
            // Sauvegarder la partie en cours avant de charger la nouvelle
            if (this.currentGame && !this.currentGame.finished) {
                Storage.saveGame(this.currentGame);
            }
            
            const game = Storage.loadGames().find(g => g.id === id);
            if(game) {
                this._persistLoadedGame(game, id);
                
                this.currentGame = game;
                this.showGame();
            } else {
                UI.showToast('⚠️ Partie introuvable', 'error');
            }
        },
        deleteGame(gameId) {
            UI.confirm('Supprimer cette partie ?', () => {
                Storage.deleteGame(gameId);
                // Réinitialiser currentGame si c'était la partie en cours
                if (this.currentGame && this.currentGame.id === gameId) {
                    this.currentGame = null;
                }
                UI.showToast('✅ Partie supprimée', 'success');
                this.renderGamesList();
            });
        },
        clearAll() {
            UI.confirm("⚠️ Supprimer TOUTES les parties ?", () => {
                Storage.clearGames();
                UI.showToast('✅ Historique effacé', 'success');
                this.renderGamesList();
            });
        },

        // -----------------------------------------------------------------------
        // VICTOIRE, REDÉMARRAGE & PARTAGE
        // -----------------------------------------------------------------------

        /**
         * Construit l'objet partie pour un redémarrage avec les mêmes joueurs.
         * Remet tous les totaux à 0, vide l'historique et le temp.
         */
        _buildRestartGame(oldState) {
            return {
                id:               Date.now().toString(),
                name:             this.currentGame.name ||
                                  (this.currentGame.mode === 'belote' ? 'Belote' : 'Partie Standard'),
                mode:             this.currentGame.mode,
                date:             new Date().toISOString(),
                victoryCondition: this.currentGame.victoryCondition || VC_HIGHEST,
                endCondition:     this.currentGame.endCondition || { type: END_FREE, value: null },
                state: {
                    mode:                 oldState.mode,
                    victoryCondition:     oldState.victoryCondition || VC_HIGHEST,
                    players:              oldState.players.map(p => ({ ...p, total: 0, previousRank: null })),
                    history:              [],
                    temp:                 {},
                    dealerId:             this._nextDealerId(oldState),
                    celebratedMilestones: {}
                },
                finished: false,
                preset:   this.currentGame.preset || null,
                series:   this._nextSeries(oldState)
            };
        },

        /** Le donneur passe au joueur suivant à chaque revanche. */
        _nextDealerId(state) {
            const i = state.players.findIndex(p => p.id === state.dealerId);
            return state.players[(i + 1) % state.players.length]?.id ?? state.dealerId;
        },

        /** Vainqueur de la partie (null si égalité ou aucune manche). */
        _gameWinnerId(state) {
            if (!state.history.length) return null;
            const sorted = GameState.getSortedPlayers(state);
            if (sorted.length > 1 && sorted[0].total === sorted[1].total) return null;
            return sorted[0]?.id ?? null;
        },

        /** Série de revanches : { n: numéro de la partie, wins: { idJoueur: victoires } } avant la partie en cours. */
        _nextSeries(oldState) {
            const prev = this.currentGame.series || { n: 1, wins: {} };
            const wins = { ...prev.wins };
            const w = this._gameWinnerId(oldState);
            if (w !== null) wins[w] = (wins[w] || 0) + 1;
            return { n: Math.min(99, prev.n + 1), wins };
        },

        /** Texte « ALICE 2 – BOB 1 » (victoires déjà acquises, + éventuellement la partie en cours terminée). */
        _seriesText(includeCurrent) {
            const g = this.currentGame; if (!g || !g.series || g.series.n < 2 && !includeCurrent) return '';
            const wins = { ...(g.series?.wins || {}) };
            if (includeCurrent) { const w = this._gameWinnerId(g.state); if (w !== null) wins[w] = (wins[w] || 0) + 1; }
            return g.state.players.map(p => ({ n: p.name, w: wins[p.id] || 0 }))
                .sort((a, b) => b.w - a.w).map(x => `${x.n} ${x.w}`).join(' – ');
        },

        restartWithSamePlayers() {
            UI.closeVictory();
            if(!this.currentGame) return;
            if(!this.currentGame.finished) { this.currentGame.finished = true; Storage.saveGame(this.currentGame); }
            const oldState = this.currentGame.state;
            const newGame = this._buildRestartGame(oldState);
            this.currentGame = newGame;
            if(!this._saveOrWarn()) return;
            // Réinitialiser les rangs précédents pour éviter les animations incorrectes
            this.lastRanks = {};
            UI.showToast('🎮 Nouvelle partie lancée !', 'success');
            this.showGame(); // met aussi à jour le titre et la ligne « Revanche n°N »
        },

        /**
         * Persiste la composition de joueurs courante dans savedPlayers et localStorage.
         * Utilisé à la fin d'une partie (finishGame) pour le rechargement rapide.
         */
        _saveCurrentComposition() { this._memoizeComposition(this.currentGame.mode, this.currentGame.state.players); },

        finishGame() {
            if(this.currentGame.state.history.length === 0) { UI.showToast('⚠️ Aucune manche jouée', 'warning'); return; }
            this.currentGame.finished = true;
            Storage.saveGame(this.currentGame);
            
            this._saveCurrentComposition();
            const winner = GameState.getSortedPlayers(this.currentGame.state)[0];
            UI.showVictory(winner, winner.total, this.currentGame.state);
        },

        // --- Share helpers ---

        /**
         * Crée une copie profonde de l'état de jeu courant pour la génération de récap.
         * Protège contre les race conditions (modal de victoire fermé pendant l'attente).
         * @returns {Object} snapshot de state + victoryCondition
         */
        _snapshotGameState() {
            const s = this.currentGame.state;
            return {
                players:              JSON.parse(JSON.stringify(s.players)),
                history:              JSON.parse(JSON.stringify(s.history)),
                temp:                 {},
                dealerId:             s.dealerId,
                celebratedMilestones: { ...s.celebratedMilestones },
                victoryCondition:     this.currentGame.victoryCondition,
                name:                 this.currentGame.name,
                date:                 this.currentGame.date,
                roll:                 this._punchRoll || 0
            };
        },


        // -----------------------------------------------------------------------
        // PARTAGE DE FIN DE PARTIE
        // -----------------------------------------------------------------------

        /** Classement avec rangs (ex æquo = même rang). */
        _shareRanking(game) {
            const sorted = GameState.getSortedPlayers(game.state);
            let prev = null, rank = 0;
            return sorted.map((p, i) => {
                if (p.total !== prev) { rank = i + 1; prev = p.total; }
                return { rank, name: p.name, total: p.total };
            });
        },

        /** Texte de partage : titre, classement avec médailles, infos de la partie. */
        buildShareText(game = this.currentGame) {
            const ranking = this._shareRanking(game).slice(0, 10);
            const medals  = { 1: '🥇', 2: '🥈', 3: '🥉' };
            const winners = ranking.filter(r => r.rank === 1);
            const title = winners.length > 1
                ? `🤝 Égalité sur ${game.name} : ${winners.map(w => w.name).join(' & ')} !`
                : `🏆 ${winners[0]?.name ?? '?'} remporte ${game.name} !`;
            const lines = ranking.map(r => `${medals[r.rank] || (r.rank + '.')} ${r.name} — ${r.total} pt${Math.abs(r.total) > 1 ? 's' : ''}`);
            const rounds = game.state.history.length;
            const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            const a = UnifiedRecapGenerator.analyze({ ...game.state, victoryCondition: game.victoryCondition, name: game.name, date: game.date, roll: this._punchRoll || 0 });
            const punch = a ? `💬 ${a.narrative}` : '';
            return [title, '', ...lines, '', punch, `🎲 ${rounds} manche${rounds > 1 ? 's' : ''} · ${date}`, '— ScoreMaster'].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
        },

        _requireFinished() {
            if (!this.currentGame || !this.currentGame.finished) {
                UI.showToast("⚠️ Terminez d'abord la partie", 'warning');
                return false;
            }
            return true;
        },

        openShareSheet() {
            if (!this._requireFinished()) return;
            SoundFX.click();
            this._punchRoll = 0;
            this.backToShareChoices();
            UI._open('share-modal');
        },
        closeShareSheet() {
            UI._close('share-modal');
            this._clearShareResult();
        },
        _clearShareResult() {
            if (this._shareResult?.url) URL.revokeObjectURL(this._shareResult.url);
            this._shareResult = null;
        },
        backToShareChoices() {
            this._clearShareResult();
            document.getElementById('share-choices').classList.remove('hidden');
            document.getElementById('share-result').classList.add('hidden');
            document.getElementById('share-title').textContent = '📤 Partager';
        },

        /** Partage le texte : feuille native si dispo, sinon copie dans le presse-papiers. */
        async shareText() {
            if (!this._requireFinished()) return;
            SoundFX.click();
            const text = this.buildShareText();
            try {
                if (navigator.share) {
                    await navigator.share({ text });
                    UI.showToast('✅ Résultat partagé', 'success');
                    return;
                }
            } catch(e) {
                if (e?.name === 'AbortError') return;
            }
            try {
                await navigator.clipboard.writeText(text);
                UI.showToast('📋 Texte copié — collez-le où vous voulez', 'success');
            } catch(e) {
                // Dernier recours : copie via textarea
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta); ta.select();
                let ok = false; try { ok = document.execCommand('copy'); } catch(_) {}
                ta.remove();
                UI.showToast(ok ? '📋 Texte copié' : '❌ Copie impossible', ok ? 'success' : 'error');
            }
        },

        /** Affiche le résultat prêt (aperçu + boutons : un vrai geste utilisateur déclenche le partage). */
        _showShareResult(blob, filename, label) {
            this._clearShareResult();
            const url = URL.createObjectURL(blob);
            this._shareResult = { blob, filename, url, text: this.buildShareText() };
            document.getElementById('share-preview').src = url;
            document.getElementById('share-title').textContent = label;
            document.getElementById('share-choices').classList.add('hidden');
            document.getElementById('share-result').classList.remove('hidden');
            UI._open('share-modal');
        },

        async sendResult() {
            const r = this._shareResult;
            if (!r) return;
            SoundFX.click();
            try {
                const file = new File([r.blob], r.filename, { type: r.blob.type });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], text: r.text, title: 'ScoreMaster' });
                    UI.showToast('✅ Partagé !', 'success');
                    return;
                }
                UI.showToast('ℹ️ Partage indisponible ici — fichier enregistré', 'info');
                this.saveResult(true);
            } catch(e) {
                if (e?.name === 'AbortError') return;
                console.warn('Partage impossible', e);
                this.saveResult(true);
            }
        },

        /** Nouvelle punchline : régénère l'image (ou redemande le GIF) avec la réplique suivante. */
        rerollPunchline() {
            this._punchRoll = (this._punchRoll || 0) + 1;
            SoundFX.click();
            if (this._lastKind === 'gif') this.prepareGif(); else this.prepareImage();
        },

        saveResult(silent = false) {
            const r = this._shareResult;
            if (!r) return;
            this._downloadBlob(r.blob, r.filename);
            if (!silent) UI.showToast('💾 Fichier enregistré', 'success');
        },

        /** Génère l'image PNG puis affiche l'aperçu. */
        async prepareImage() {
            if (!this._requireFinished()) return;
            this._lastKind = 'image';
            SoundFX.click();
            try {
                UI.showLoading('📸 Génération de l\'image...');
                UI.updateLoadingProgress(30, 'Création du visuel...');
                const gs = { ...this.currentGame.state, victoryCondition: this.currentGame.victoryCondition, name: this.currentGame.name, date: this.currentGame.date, roll: this._punchRoll || 0 };
                const canvas = UnifiedRecapGenerator.generateStatic(gs);
                if (!canvas) { UI.hideLoading(); return; }
                const blob = await UnifiedRecapGenerator.canvasToBlobAsync(canvas);
                UI.updateLoadingProgress(100, 'Terminé !');
                UI.hideLoading();
                this._showShareResult(blob, `ScoreMaster_${this._stamp()}.png`, '📸 Image prête');
                vibrate([50, 30, 50]);
            } catch (error) {
                UI.hideLoading();
                console.error('[ScoreMaster] Erreur image:', error);
                UI.showToast('❌ Erreur lors de la création de l\'image', 'error');
            }
        },

        /** Appelé par le générateur quand le GIF est prêt. */
        onGifReady(blob) {
            UI.hideLoading();
            this._showShareResult(blob, `ScoreMaster_${this._stamp()}.gif`, '🎬 GIF prêt');
            vibrate([50, 30, 50]);
        },

        prepareGif() {
            if (!this._requireFinished()) return;
            this._lastKind = 'gif';
            this._confirmGifGeneration();
        },

        /**
         * Lance la génération GIF après confirmation utilisateur.
         * Gère le verrou, la barre de progression et la libération en cas d'erreur.
         */
        _startGifGeneration(savedGameState) {
            this._gifGenerating = true;
            this._confirmPending = false;
            UI._close('share-modal');
            UI.showLoading('🎬 Génération du GIF...');
            UI.updateLoadingProgress(0, 'Initialisation...');
            try {
                UnifiedRecapGenerator.generateAnimated(savedGameState, (progress, message) => {
                    UI.updateLoadingProgress(progress, message);
                });
            } catch (error) {
                console.error('[ScoreMaster] Erreur GIF:', error);
                UI.hideLoading();
                UI.showToast('❌ Erreur: ' + error.message, 'error');
                this._gifGenerating = false;
            }
            // Verrou de sécurité : libère automatiquement après 90 s si le callback n'a pas été appelé
            if (this._gifTimeoutId) clearTimeout(this._gifTimeoutId);
            this._gifTimeoutId = setTimeout(() => { this._gifGenerating = false; this._gifTimeoutId = null; }, 90000);
        },


        /**
         * Vérifie les verrous, la disponibilité de gifshot, et ouvre la confirm dialog.
         * Centralise toute la logique de pré-lancement GIF.
         */
        _confirmGifGeneration() {
            if (this._gifGenerating) {
                UI.showToast('⏳ Génération en cours...', 'warning'); return;
            }
            if (this._confirmPending) return;

            SoundFX.click();

            if (typeof gifshot === 'undefined') {
                UI.showToast('⏳ Bibliothèque GIF en cours de chargement, réessaie dans un instant', 'warning'); return;
            }

            const savedGameState = this._snapshotGameState();
            this._confirmPending = true;
            UI.confirm('Générer le GIF ? (~15 secondes)',
                () => this._startGifGeneration(savedGameState),
                () => { this._confirmPending = false; }
            );
        },

        // -----------------------------------------------------------------------
        // GESTION DES JOUEURS
        // -----------------------------------------------------------------------
        openModal(playerId) {
            SoundFX.click();
            this.editPlayerId = playerId;
            const player = this.currentGame.state.players.find(p => p.id === playerId);
            document.getElementById('modal-title').textContent = player.name;
            document.getElementById('modal-title').style.color = player.color;
            document.getElementById('edit-name').value = player.name;
            document.getElementById('edit-dealer').checked = (this.currentGame.state.dealerId === playerId);
            this.renderRecentSuggestions(player.name);
            UI._open('modal-player');
        },

        /** Construit et insère le titre + les chips de suggestions dans le conteneur. */
        _renderSuggestionItems(container, suggestions) {
            const title = document.createElement('div');
            title.className = 'recent-suggestions-title';
            title.textContent = 'Récents';
            container.appendChild(title);

            suggestions.forEach(name => {
                const item = UI._makeEl('div', 'recent-suggestion-item', `<span class="add-icon">+</span><span>${escapeHtml(name)}</span>`);
                item.onclick = () => this.selectSuggestion(name);
                container.appendChild(item);
            });
        },

        renderRecentSuggestions(currentName) {
            const container = document.getElementById('recent-players-suggestions');
            container.innerHTML = '';
            
            // Noms déjà dans la partie
            const namesInGame = this.currentGame.state.players.map(p => p.name);
            
            // Filtrer les suggestions : pas les noms par défaut, pas le nom actuel, pas déjà dans la partie
            const suggestions = this.recentPlayers
                .filter(name => 
                    !this.defaultNames.some(d => d.toUpperCase() === name.toUpperCase()) &&
                    name !== currentName &&
                    !namesInGame.includes(name)
                )
                .slice(0, 5);
            
            if(suggestions.length === 0) {
                container.style.display = 'none';
                return;
            }
            
            container.style.display = 'flex';
            this._renderSuggestionItems(container, suggestions);
        },
        selectSuggestion(name) {
            SoundFX.click();
            document.getElementById('edit-name').value = name;
            this.renderRecentSuggestions(name);
        },
        addRecentPlayer(name) {
            // Ne pas ajouter les noms par défaut (comparaison insensible à la casse :
            // _validatePlayerName met en majuscules, defaultNames sont en casse mixte)
            if(this.defaultNames.some(d => d.toUpperCase() === name.toUpperCase())) return;
            
            // Retirer si déjà présent, puis ajouter en premier
            this.recentPlayers = this.recentPlayers.filter(n => n !== name);
            this.recentPlayers.unshift(name);
            
            // Garder seulement les 8 derniers
            this.recentPlayers = this.recentPlayers.slice(0, 8);
            
            // Sauvegarder
            try {
                localStorage.setItem(Storage.RECENT_KEY, JSON.stringify(this.recentPlayers));
            } catch(e) { console.warn('Erreur sauvegarde recentPlayers', e); }
        },
        closeModal() { UI._close('modal-player'); },


        // --- _validatePlayerName helpers ---

        /** Retourne true si le nom existe déjà (hors du joueur exclu) et affiche un toast. */
        _isNameDuplicate(name, excludeId) {
            const dup = this.currentGame.state.players.find(
                p => p.id !== excludeId && p.name.toUpperCase() === name
            );
            if (dup) { UI.showToast(`⚠️ "${name}" existe déjà !`, 'warning'); return true; }
            return false;
        },

        /**
         * Supprime les caractères interdits (<>"'&) du nom.
         * Affiche un toast si supprimés, retourne null si le nom devient vide.
         * @returns {string|null}
         */
        _stripForbiddenChars(name) {
            const forbidden = /[<>"'&]/g;
            if (!forbidden.test(name)) return name;
            const clean = name.replace(forbidden, '');
            if (!clean) {
                UI.showToast('⚠️ Nom invalide après suppression des caractères', 'warning');
                return null;
            }
            UI.showToast('⚠️ Caractères spéciaux supprimés', 'warning');
            return clean;
        },

        _validatePlayerName(raw, excludeId) {
            if (!raw) {
                UI.showToast('⚠️ Le nom ne peut pas être vide', 'warning');
                return null;
            }

            let name = raw.length > NAME_MAX_LEN ? raw.substring(0, NAME_MAX_LEN) : raw;
            if (raw.length > NAME_MAX_LEN)
                UI.showToast(`⚠️ Nom limité à ${NAME_MAX_LEN} caractères`, 'warning');

            // Strip AVANT le check doublon : "ALICE!!" → "ALICE" avant de comparer.
            // Sans ça, "ALICE!!" passe le check doublon (≠ "ALICE"), puis est strippé
            // en "ALICE", créant silencieusement deux joueurs avec le même nom.
            name = this._stripForbiddenChars(name);
            if (name === null) return null;

            if (this._isNameDuplicate(name, excludeId)) return null;

            return name;
        },


        /**
         * Applique le nom validé, met à jour le donneur si coché,
         * ferme la modal et affiche le toast de confirmation.
         */
        _applyPlayerEdit(player, newName) {
            player.name = newName;
            this.addRecentPlayer(newName);
            if (document.getElementById('edit-dealer').checked)
                this.currentGame.state.dealerId = player.id;
            // Sauvegarder immédiatement : sans ça, un renommage suivi d'une fermeture
            // de l'app avant la prochaine manche entraîne la perte du nouveau nom.
            this._saveOrWarn();
            this.closeModal();
            this.render();
            UI.showToast(`✅ ${newName} mis à jour`, 'success');
        },

        savePlayer() {
            SoundFX.click();
            const player = this.currentGame.state.players.find(p => p.id === this.editPlayerId);
            
            // Vérifier que le joueur existe
            if (!player) {
                UI.showToast('⚠️ Erreur: joueur introuvable', 'error');
                return;
            }
            
            const raw = document.getElementById('edit-name').value.trim().toUpperCase();
            const newName = this._validatePlayerName(raw, this.editPlayerId);
            if (newName === null) return;
            this._applyPlayerEdit(player, newName);
        },

        // -----------------------------------------------------------------------
        // SAISIE DE SCORE (feuille numérique)
        // -----------------------------------------------------------------------

        /**
         * Met à jour le bouton ENREGISTRER/MODIFIER.
         * @param {'edit'|'save'} mode
         * @param {number} roundNumber  Numéro de manche affiché
         */
        _setSaveBtn(mode, roundNumber) {
            const btn = document.getElementById('save-btn');
            if (!btn) return;
            btn.classList.remove('ready');
            if (mode === 'edit') {
                btn.textContent = `MODIFIER MANCHE ${roundNumber}`;
                btn.classList.add('editing');
                const t = document.getElementById('edit-tab-text'); if (t) t.textContent = `✏️ MANCHE ${roundNumber}`;
            } else {
                btn.textContent = `ENREGISTRER MANCHE ${roundNumber}`;
                btn.classList.remove('editing');
            }
            document.body.classList.toggle('is-editing', mode === 'edit');
        },

        /** Abandonne la modification en cours sans rien enregistrer. */
        cancelEdit() {
            if (this.editIdx === null) return;
            SoundFX.click();
            this.editIdx = null;
            this.currentGame.state.temp = {};
            this._addValPlayers.clear();
            UI._close('sheet');
            this._setSaveBtn('save', this.currentGame.state.history.length + 1);
            this.render();
        },

        /**
         * Vérifie les bornes [SCORE_MIN, SCORE_MAX].
         * @returns {boolean} true si hors bornes (affiche un toast + vibration)
         */
        _checkBounds(val) {
            if (!isFinite(val) || isNaN(val)) { vibrate([50, 50, 50]); UI.showToast('⚠️ Score invalide', 'warning'); return true; }
            if (val > SCORE_MAX) { vibrate([50, 50, 50]); UI.showToast(`⚠️ Maximum ${SCORE_MAX} points`, 'warning'); return true; }
            if (val < SCORE_MIN) { vibrate([50, 50, 50]); UI.showToast(`⚠️ Minimum ${SCORE_MIN} points`, 'warning'); return true; }
            return false;
        },

        openSheet(playerId) {
            SoundFX.click();
            this.activePlayerId = playerId;
            const sb0 = document.getElementById('save-btn'); if (sb0) sb0.classList.remove('ready');
            const isBelote = this.currentGame.mode === 'belote';
            this._toggleBeloteButtons(isBelote);
            this.renderSwitcher();
            UI._open('sheet');
        },
        closeSheet() { 
            UI._close('sheet');
            // Ne PAS réinitialiser editIdx ni temp ici
            // L'utilisateur doit valider via le bouton dock
            // validateRound() s'en chargera après validation
            this.render();
            // Tout le monde a un score (hors Belote) : on met « Enregistrer » en avant
            const st = this.currentGame.state;
            const ready = this.currentGame.mode !== 'belote' && st.players.every(p => st.temp[p.id] !== undefined)
                && Object.values(st.temp).some(v => v !== 0);
            const sb = document.getElementById('save-btn'); if (sb) sb.classList.toggle('ready', ready);
        },
        renderSwitcher() {
            const cont = document.getElementById('input-switcher');
            if (!cont) return;
            cont.innerHTML = '';
            const state = this.currentGame.state;
            const isBelote = this.currentGame.mode === 'belote';
            const isLowest = state.victoryCondition === VC_LOWEST;
            // Rang (compétition) d'une valeur parmi une liste de totaux
            const rankOf = (v, arr) => 1 + arr.filter(o => isLowest ? o < v : o > v).length;
            const before = state.players.map(p => p.total);
            const after = state.players.map(p => UI._displayScore(p, state, this.editIdx));
            state.players.forEach((p, i) => {
                const isActive = p.id === this.activePlayerId;
                const touched = state.temp[p.id] !== undefined;
                // Number() normalise -0 → 0 pour éviter un affichage trompeur
                const tempScore = Number(state.temp[p.id] || 0);
                const div = document.createElement('div');
                div.className = `sel-box ${isActive ? 'active' : ''}`;
                div.dataset.pid = p.id;
                if(isActive) div.style.setProperty('--p-color', p.color);
                div.onclick = () => { this.activePlayerId = p.id; this.renderSwitcher(); SoundFX.click(); };
                let valHtml = String(tempScore), extra = '';
                if (!isBelote) {
                    if (!touched) valHtml = '–';
                    else {
                        const r0 = rankOf(before[i], before), r1 = rankOf(after[i], after);
                        const arrow = r1 < r0 ? '<span class="sel-up">↑</span>' : r1 > r0 ? '<span class="sel-down">↓</span>' : '';
                        extra = `→ ${after[i]} ${arrow}`;
                    }
                }
                div.innerHTML = `<div style="font-size:10px; font-weight:800; color:${isActive ? p.color : 'var(--text-sec)'}">${escapeHtml(p.name)}</div><div class="sel-val${(!isBelote && !touched) ? ' untouched' : ''}" style="font-size:20px; font-weight:900">${valHtml}</div>` + (isBelote ? '' : `<div class="sel-total">${extra || '&nbsp;'}</div>`);
                cont.appendChild(div);
            });
            // Bouton « Suivant » → « OK » quand il n'y a plus personne à remplir
            const nb = document.getElementById('next-btn');
            if (nb) {
                const ps = state.players, ai = ps.findIndex(p => p.id === this.activePlayerId);
                const more = this.editIdx !== null ? ai < ps.length - 1
                    : ps.some(p => p.id !== this.activePlayerId && state.temp[p.id] === undefined);
                nb.textContent = more ? 'Suivant →' : '✓ OK';
                const bar = nb.parentElement; if (bar) bar.classList.toggle('done', !more && !isBelote);
            }
            const act = cont.querySelector('.sel-box.active');
            if (act && act.scrollIntoView) act.scrollIntoView({ inline: 'center', block: 'nearest' });
        },
        toggleHistory() {
            const collapsed = !app.currentGame ? true : UI._histCollapsed();
            try { localStorage.setItem('sm_hist_collapsed', collapsed ? '0' : '1'); } catch (e) {}
            if (this.currentGame) UI.renderHistory(this.currentGame.state, this.editIdx);
            SoundFX.click();
        },
        nextInSheet() {
            const players = this.currentGame.state.players;
            const temp = this.currentGame.state.temp;
            const idx = players.findIndex(p => p.id === this.activePlayerId);
            let next = null;
            if (this.editIdx !== null) {
                // Modification : tour dans l'ordre, fin après le dernier
                next = players[idx + 1] || null;
            } else {
                // Saisie : prochain joueur sans score (en repartant du début si besoin)
                for (let k = 1; k < players.length; k++) {
                    const q = players[(idx + k) % players.length];
                    if (temp[q.id] === undefined) { next = q; break; }
                }
            }
            if (next) { this.activePlayerId = next.id; SoundFX.click(); this.renderSwitcher(); }
            else this.closeSheet(); // tout est rempli : on ferme, « Enregistrer » est mis en avant
        },
        _sheetKey(e) {
            const sheet = document.getElementById('sheet');
            if (!sheet || !sheet.classList.contains('active') || !this.currentGame) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target && e.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA') return;
            const players = this.currentGame.state.players;
            const idx = players.findIndex(p => p.id === this.activePlayerId);
            const go = d => { const n = players[(idx + d + players.length) % players.length]; if (n) { this.activePlayerId = n.id; this.renderSwitcher(); } };
            if (/^[0-9]$/.test(e.key)) { this.typeNum(Number(e.key)); }
            else if (e.key === 'Backspace') { this.backspace(); }
            else if (e.key === 'Enter') {
                if (this.currentGame.mode === 'belote') this.closeSheet(); else this.nextInSheet();
            }
            else if (e.key === 'Escape') { this.closeSheet(); }
            else if (e.key === 'ArrowRight') { go(1); }
            else if (e.key === 'ArrowLeft') { go(-1); }
            else if (e.key === 'Tab') { go(e.shiftKey ? -1 : 1); }
            else return;
            e.preventDefault();
        },
        typeNum(n) {
            // Number() convertit -0 en 0, évitant que (-0).toString() = "0" fasse perdre le signe
            // (cas théoriquement bloqué par handleSmart fix, mais guard défensif)
            const raw = this.currentGame.state.temp[this.activePlayerId];
            // Fix : CAPOT (252) ne doit pas être concaténé avec un nouveau chiffre.
            // Sans ce guard: 252 + typeNum(5) → parseInt("2525") = 2525 — score aberrant.
            // On repart de 0 si la valeur courante est une valeur spéciale Belote.
            const isBeloteSpecial = this.currentGame.mode === 'belote' && raw === BELOTE_CAPOT;

            // Fix : si addVal a posé un score complet pour ce joueur, typeNum repart
            // de zéro plutôt que de concaténer.
            // Ex: +20 → typeNum(5) donne 5 (pas 205).
            // On préserve le signe si +/- a été pressé après addVal (ex: +20→+/-→5 = -5).
            const wasAddVal = this._addValPlayers.has(this.activePlayerId);
            if (wasAddVal) this._addValPlayers.delete(this.activePlayerId);

            let current;
            if (isBeloteSpecial) {
                current = '';
            } else if (wasAddVal) {
                // Signe préservé : +20 → +/- (=-20) → typeNum(5) = -5 (pas -205)
                current = (raw !== undefined && raw !== null && raw < 0) ? '-' : '';
            } else {
                current = (raw !== undefined && raw !== null ? Number(raw) : 0).toString();
            }

            const newVal = parseInt((current === '0' || current === '' ? '' : current) + n);
            if (this._checkBounds(newVal)) return;
            // En Belote : si on retape après un CAPOT, annuler aussi le score adverse
            if (isBeloteSpecial) {
                const other = this.currentGame.state.players.find(p => p.id !== this.activePlayerId);
                if (other) this.currentGame.state.temp[other.id] = 0;
            }
            vibrate(10);
            this.currentGame.state.temp[this.activePlayerId] = newVal;
            this.renderSwitcher();
            this.render();
        },
        addVal(value) {
            const current = this.currentGame.state.temp[this.activePlayerId] || 0;
            const newVal = current + value;
            if (this._checkBounds(newVal)) return;
            vibrate(20);
            // En mode belote, pas de scores négatifs
            this.currentGame.state.temp[this.activePlayerId] = this.currentGame.mode === 'belote' ? Math.max(0, newVal) : newVal;
            // Marquer ce joueur : addVal a posé un score "complet".
            // Quand typeNum sera appelé ensuite pour ce même joueur, il repartira
            // de zéro plutôt que de concaténer sur le score addVal.
            // Ex sans fix : +20 → typeNum(5) = parseInt("20"+"5") = 205
            // Ex avec fix  : +20 → typeNum(5) = 5 (repart de zéro)
            this._addValPlayers.add(this.activePlayerId);
            this.renderSwitcher();
            this.render();
        },
        backspace() {
            const val = this.currentGame.state.temp[this.activePlayerId];
            // Fix : CAPOT (252) et autres valeurs spéciales Belote ne doivent pas être
            // modifiées partiellement par ⌫ — 252 → 25 produirait un score invalide.
            // Utiliser C (clearInput) pour réinitialiser une valeur spéciale.
            if (this.currentGame.mode === 'belote' && val === BELOTE_CAPOT) {
                this.currentGame.state.temp[this.activePlayerId] = 0;
                // Remettre l'adversaire à 0 également (CAPOT annulé)
                const other = this.currentGame.state.players.find(p => p.id !== this.activePlayerId);
                if (other) this.currentGame.state.temp[other.id] = 0;
                this._addValPlayers.delete(this.activePlayerId);
                vibrate(15);
                this.renderSwitcher();
                this.render();
                return;
            }
            // ⌫ = modification manuelle : annule le flag addVal pour ce joueur
            this._addValPlayers.delete(this.activePlayerId);
            const current = (val || 0).toString();
            const sliced = current.slice(0, -1);
            // Gérer le cas "-" ou "" qui donnerait NaN avec parseInt
            this.currentGame.state.temp[this.activePlayerId] = (sliced === '' || sliced === '-') ? 0 : parseInt(sliced);
            vibrate(15);
            this.renderSwitcher();
            this.render();
        },
        clearInput() {
            this.currentGame.state.temp[this.activePlayerId] = 0;
            // Effacer manuellement annule le flag addVal pour ce joueur
            this._addValPlayers.delete(this.activePlayerId);
            vibrate([30, 50, 30]);
            this.renderSwitcher();
            this.render();
        },
        handleSmart() {
            SoundFX.click();
            if(this.currentGame.mode === 'belote') {
                this.currentGame.state.temp[this.activePlayerId] = BELOTE_CAPOT;
                // Mettre l'autre équipe à 0 pour le CAPOT
                const otherPlayer = this.currentGame.state.players.find(p => p.id !== this.activePlayerId);
                if (otherPlayer) this.currentGame.state.temp[otherPlayer.id] = 0;
            } else {
                const current = this.currentGame.state.temp[this.activePlayerId] || 0;
                // Correction : current * -1 produit -0 quand current = 0 (JavaScript negative zero).
                // -0 est FALSY : `(-0 || 0)` = 0, donc le signe est perdu partout dans le code.
                // typeNum() suivant produirait un score POSITIF au lieu de négatif.
                // Fix : ne stocker -0 que si current !== 0.
                this.currentGame.state.temp[this.activePlayerId] = current !== 0 ? current * -1 : 0;
            }
            this.renderSwitcher();
            this.render();
        },

        /**
         * Calcule le "reste" pour l'adversaire en Belote (BELOTE_ROUND_TOTAL - score courant),
         * puis passe le focus au joueur suivant.
         */
        _applyBeloteRest(players) {
            const other = players.find(p => p.id !== this.activePlayerId);
            if (!other) return;
            const cur = this.currentGame.state.temp[this.activePlayerId] || 0;
            if (cur > BELOTE_ROUND_TOTAL) {
                UI.showToast(`⚠️ Score supérieur à ${BELOTE_ROUND_TOTAL} impossible`, 'warning');
                return;
            }
            this.currentGame.state.temp[other.id] = Math.max(0, BELOTE_ROUND_TOTAL - cur);
            // Fix : ne PAS basculer activePlayerId après =Reste.
            // Avant : activePlayerId passait sur l'adversaire → les pressions suivantes
            // (typeNum, backspace, C) modifiaient son score au lieu du score saisi.
            // Ex: saisir 82 → =Reste → puis ⌫ effaçait 80 (Éq2) au lieu de 82 (Éq1).
            this.renderSwitcher();
            this.render();
        },

        calcRest() {
            SoundFX.click();
            // Ne fonctionne qu'à 2 joueurs (Belote uniquement)
            const players = this.currentGame.state.players;
            if(players.length !== 2) return; // Sécurité explicite
            this._applyBeloteRest(players);
        },


        // -----------------------------------------------------------------------
        // HELPERS PRIVÉS (validateRound)
        // -----------------------------------------------------------------------

        /**
         * Vérifie les jalons de score et déclenche les confettis si nécessaire.
         * @param {Object} state
         * @param {Object} previousTotals  { playerId: number } avant la manche
         */

        /**
         * Vérifie chaque jalon pour un joueur et déclenche les confettis si franchi.
         */
        _triggerMilestoneIfReached(p, state, previousTotals) {
            MILESTONE_SCORES.forEach(milestone => {
                const key = `${p.id}-${milestone}`;
                if (!state.celebratedMilestones[key] &&
                    previousTotals[p.id] < milestone &&
                    p.total >= milestone) {
                    state.celebratedMilestones[key] = true;
                    setTimeout(() => UI.launchMilestoneConfetti(milestone), 300);
                }
            });
        },

        _checkMilestones(state, previousTotals) {
            if (this.currentGame.mode !== 'standard' ||
                this.currentGame.victoryCondition !== VC_HIGHEST ||
                !this.settings.milestones) return;

            state.players.forEach(p => this._triggerMilestoneIfReached(p, state, previousTotals));
        },

        /**
         * Détermine si la partie est terminée et qui a gagné.
         * @param {Object} state
         * @returns {{ gameEnded: boolean, winner: Object|null }}
         */

        /**
         * Évalue les conditions de fin de partie selon le mode et la condition de victoire.
         * Séparé de _checkEndCondition pour tester chaque cas indépendamment.
         * @returns {{ gameEnded: boolean, winner: Object|null }}
         */

        // --- _evalEndCondition helpers ---

        /** Évalue la condition de fin pour la Belote (premier à BELOTE_WIN_SCORE). */
        _evalBeloteEnd(state) {
            const over = state.players.filter(p => p.total >= BELOTE_WIN_SCORE);
            if (over.length > 0)
                return { gameEnded: true, winner: over.sort((a, b) => b.total - a.total)[0] };
            return { gameEnded: false, winner: null };
        },

        /**
         * Évalue la condition de fin par score cible.
         * - highest : premier à atteindre la valeur gagne
         * - lowest  : premier à dépasser la limite est éliminé, le moins haut restant gagne
         */
        _evalScoreEnd(state, endCond, victCond) {
            if (victCond === VC_HIGHEST) {
                // Plusieurs joueurs peuvent atteindre la cible dans la même manche : le plus haut score gagne
                const reached = state.players.filter(p => p.total >= endCond.value).sort((a, b) => b.total - a.total);
                const winner = reached[0] || null;
                return { gameEnded: !!winner, winner };
            }
            const overLimit = state.players.filter(p => p.total >= endCond.value);
            if (overLimit.length === 0) return { gameEnded: false, winner: null };
            const pool   = state.players.filter(p => p.total < endCond.value);
            const winner = (pool.length > 0 ? pool : [...state.players])
                .sort((a, b) => a.total - b.total)[0];
            return { gameEnded: true, winner };
        },

        _evalEndCondition(state, endCond, victCond) {
            let gameEnded = false;
            let winner    = null;

            if (this.currentGame.mode === 'belote') {
                ({ gameEnded, winner } = this._evalBeloteEnd(state));
            } else if (endCond.type === END_SCORE) {
                ({ gameEnded, winner } = this._evalScoreEnd(state, endCond, victCond));
            }
            return { gameEnded, winner };
        },

        _checkEndCondition(state) {
            const endCond = this.currentGame.endCondition;
            const victCond = this.currentGame.victoryCondition;
            let gameEnded = false;
            let winner = null;

            ({ gameEnded, winner } = this._evalEndCondition(state, endCond, victCond));
            return { gameEnded, winner };
        },

        // -----------------------------------------------------------------------
        // GESTION DES MANCHES
        // -----------------------------------------------------------------------

        // --- _applyRoundEnd helpers ---

        /**
         * Mémorise la composition de joueurs, marque la partie terminée
         * et déclenche l'écran de victoire après 500 ms.
         */
        _finalizeGameEnd(state, winner) {
            this._memoizeComposition(this.currentGame.mode, state.players);
            this.currentGame.finished = true;
            setTimeout(() => UI.showVictory(winner, winner.total, state), 500);
        },

        /**
         * Passe le donneur au joueur suivant en ordre circulaire.
         * Réinitialise au premier joueur si le donneur actuel est introuvable.
         */
        _rotateDealerAfterRound(state) {
            const idx = state.players.findIndex(p => p.id === state.dealerId);
            if (idx === -1) {
                console.warn('Dealer not found, resetting to first player');
                state.dealerId = state.players[0]?.id ?? state.dealerId;
            } else {
                state.dealerId = state.players[(idx + 1) % state.players.length].id;
            }
        },

        _applyRoundEnd(state, gameEnded, winner) {
            if (gameEnded && winner) {
                this._finalizeGameEnd(state, winner);
            } else if (this.editIdx === null) {
                this._rotateDealerAfterRound(state);
            }
        },


        /**
         * Applique les données temp à l'historique (edit ou ajout) et affiche le toast approprié.
         * @param {Object} state
         * @returns {number} Numéro de manche (pour affichage/log)
         */
        _applyRoundData(state) {
            if (this.editIdx !== null) {
                const roundNumber = this.editIdx + 1;
                GameState.updateRound(state, this.editIdx, state.temp);
                this.editIdx = null;
                this._setSaveBtn('save', state.history.length + 1);
                UI.showToast(`✅ Manche ${roundNumber} modifiée`, 'success');
                return roundNumber;
            }
            const roundNumber = state.history.length + 1;
            GameState.addRound(state, state.temp);
            UI.showToast(`✅ Manche ${roundNumber} enregistrée`, 'success');
            if (roundNumber === 2) Hints.show('round', 3000);
            return roundNumber;
        },


        /**
         * Vérifie les pré-conditions avant d'enregistrer une manche :
         * - au moins un score saisi
         * - pas tous à zéro
         * - validation métier (belote, total, etc.)
         * @returns {boolean} true si valide, false + toast si invalide
         */
        _preValidateRound(state) {
            if (Object.keys(state.temp).length === 0) {
                UI.showToast('⚠️ Aucun score saisi', 'warning'); return false;
            }
            if (Object.values(state.temp).every(v => v === 0)) {
                UI.showToast('⚠️ Tous les scores sont à zéro', 'warning'); return false;
            }
            const validation = GameState.validate(state.temp, this.currentGame.mode);
            if (!validation.valid) {
                UI.showToast(validation.error, 'error'); return false;
            }
            return true;
        },

        validateRound() {
            SoundFX.click();
            const state = this.currentGame.state;
            if (!this._preValidateRound(state)) return;
            const previousTotals = {};
            state.players.forEach(p => previousTotals[p.id] = p.total);

            // Capturer AVANT _applyRoundData qui remet editIdx à null
            const wasEditing = this.editIdx !== null;
            const roundNumber = this._applyRoundData(state);
            this._checkMilestones(state, previousTotals);

            // Ne vérifier la fin de partie QUE si ce n'était pas une édition.
            // Sans ce guard, corriger un score historique peut déclencher
            // accidentellement showVictory si le total corrigé dépasse le seuil.
            if (!wasEditing) {
                const { gameEnded, winner } = this._checkEndCondition(state);
                this._applyRoundEnd(state, gameEnded, winner);
            }

            Storage.saveGame(this.currentGame) || UI.showToast('⚠️ Mémoire pleine ! Supprimez des parties.', 'warning');
            state.temp = {};
            this._addValPlayers.clear(); // reset flags addVal pour tous les joueurs
            this.render();
        },
        startEdit(idx) {
            SoundFX.click();
            const state = this.currentGame.state;
            if(Object.keys(state.temp).length > 0) {
                UI.confirm('Abandonner la saisie en cours ?', () => {
                    this.editIdx = idx;
                    state.temp = {...state.history[idx]};
                    this._setSaveBtn('edit', idx + 1);
                    if (state.players[0]) this.openSheet(state.players[0].id);
                });
                return;
            }
            this.editIdx = idx;
            state.temp = {...state.history[idx]};
            this._setSaveBtn('edit', idx + 1);
            if (state.players[0]) this.openSheet(state.players[0].id);
        },

        /**
         * Exécute la suppression d'une manche : reset editIdx si nécessaire,
         * supprime, ajuste editIdx, sauvegarde et re-rend.
         */
        _executeDelRound(idx) {
            const snap = { gameId: this.currentGame.id, idx, round: { ...this.currentGame.state.history[idx] }, dealerId: this.currentGame.state.dealerId };
            if (this.editIdx !== null && this.editIdx === idx) {
                this.editIdx = null;
                this.currentGame.state.temp = {};
                this._addValPlayers.clear();
                this._setSaveBtn('save', this.currentGame.state.history.length);
            }
            const wasLast = idx === this.currentGame.state.history.length - 1;
            GameState.deleteRound(this.currentGame.state, idx);
            if (wasLast) { this.lastRanks = {}; this._undoDealer(); } // le donneur revient en arrière avec la dernière manche
            if (this.editIdx !== null && this.editIdx > idx) this.editIdx--;
            Storage.saveGame(this.currentGame);
            UI.showActionToast(`🗑️ Manche ${idx + 1} supprimée`, '↩️ Rétablir', () => this._restoreRound(snap));
            this.render();
        },

        /** Remet une manche supprimée à sa place (donneur et totaux inclus). */
        _restoreRound(snap) {
            const g = this.currentGame;
            if (!g || g.id !== snap.gameId) { UI.showToast('⚠️ Impossible de rétablir', 'warning'); return; }
            const state = g.state;
            const at = Math.min(snap.idx, state.history.length);
            state.history.splice(at, 0, snap.round);
            GameState.rebuildTotals(state);
            state.dealerId = snap.dealerId;
            if (this.editIdx !== null && this.editIdx >= at) this.editIdx++;
            this.lastRanks = {};
            Storage.saveGame(g);
            UI.showToast(`↩️ Manche ${at + 1} rétablie`, 'success');
            this.render();
        },

        delRound(idx) {
            // Plus de confirmation : « Rétablir » permet de rattraper un appui par erreur
            this._executeDelRound(idx);
        },

        /** Recule le donneur d'un cran (après suppression de la dernière manche). */
        _undoDealer() {
            const state = this.currentGame.state;
            const idx  = state.players.findIndex(p => p.id === state.dealerId);
            const prev = (idx - 1 + state.players.length) % state.players.length;
            state.dealerId = state.players[prev].id;
        },
        };
    
