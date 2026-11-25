    // ==================== PWA MANAGER ====================
    // ==================== COMMUNAUTÉ (profil facultatif, avec consentement) ====================
    // Envoie, UNIQUEMENT après consentement explicite : pseudo choisi, type d'appareil, nombre de parties
    // terminées, date de la dernière partie. Jamais les scores, parties ni noms de joueurs.
    // API_URL vide = fonctionnalité totalement désactivée (aucune interface, aucun envoi).
    const Community = {
        API_URL: 'https://scoremaster-community.tf31240.workers.dev',                       // ex. 'https://scoremaster-community.<compte>.workers.dev'
        KEY: 'sm_community',
        APP_VERSION: '74', // = numéro de version du cache dans service-worker.js (à incrémenter ensemble à chaque publication)
        SYNC_MIN_INTERVAL: 6 * 3600 * 1000, // au plus une synchro automatique toutes les 6 h
        SNOOZE_MS: 7 * 86400 * 1000,        // « Plus tard » : on ne redemande pas avant 7 jours
        _state: null, _promptedThisSession: false, _syncTimer: null, _busy: false,

        get enabled() { return !!this.API_URL; },

        load() {
            let s = {};
            try { const p = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (p && typeof p === 'object') s = p; } catch (e) {}
            // mise à jour en place : les références déjà prises (ex. pendant un envoi) restent valides
            if (!this._state) this._state = {};
            Object.keys(this._state).forEach(k => delete this._state[k]);
            Object.assign(this._state, s);
            return this._state;
        },
        save() { try { localStorage.setItem(this.KEY, JSON.stringify(this._state)); } catch (e) {} },
        isMember() { const s = this.load(); return s.consent === true && !!s.id && !s.pendingDelete; },

        _uuid() {
            if (crypto.randomUUID) return crypto.randomUUID();
            const b = crypto.getRandomValues(new Uint8Array(16));
            b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
            const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
            return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        },
        _cleanPseudo(v) { return String(v || '').replace(/[\u0000-\u001f\u007f<>"'&`\\]/g, '').trim().slice(0, 30); },

        /** Type d'appareil (déduit du user-agent ; modèle exact si le navigateur le fournit). */
        async _device() {
            const ua = navigator.userAgent || '';
            let platform = 'Autre', os = '', model = '', browser = 'Autre';
            if (/iPhone|iPod/.test(ua)) { platform = 'iOS'; model = 'iPhone'; }
            else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) { platform = 'iOS'; model = 'iPad'; }
            else if (/Android/.test(ua)) platform = 'Android';
            else if (/Windows/.test(ua)) platform = 'Windows';
            else if (/CrOS/.test(ua)) platform = 'ChromeOS';
            else if (/Mac OS X/.test(ua)) platform = 'macOS';
            else if (/Linux/.test(ua)) platform = 'Linux';
            let m;
            if (platform === 'iOS') {
                // Le « OS 18_x » du user-agent est figé par Apple : la vraie version se lit dans « Version/xx » (Safari).
                if ((m = ua.match(/Version\/(\d+)(?:\.(\d+))?/))) os = `iOS ${m[1]}${m[2] ? '.' + m[2] : ''}`;
                else if (window.CSS?.supports?.('anchor-name: --a')) os = 'iOS 26+';          // app installée : pas de « Version/ »
                else if ((m = ua.match(/OS (\d+)[_.](\d+)/))) os = `iOS ${m[1]}.${m[2]}`;
                else os = 'iOS';
            }
            else if (platform === 'Android' && (m = ua.match(/Android (\d+(?:\.\d+)?)/))) os = `Android ${m[1]}`;
            else os = platform;
            if (platform === 'Android' && (m = ua.match(/Android [^;]+; ([^;)]+?)(?: Build|\))/)) && m[1].length > 1) model = m[1].trim();
            if (/Edg\//.test(ua)) browser = 'Edge';
            else if (/OPR\//.test(ua)) browser = 'Opera';
            else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
            else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
            else if (/Chrome|CriOS/.test(ua)) browser = 'Chrome';
            else if (/Safari/.test(ua)) browser = 'Safari';
            else if (platform === 'iOS') browser = 'Safari'; // app installée sur l'écran d'accueil (WebKit sans mention Safari)
            try { // Chrome/Android : modèle et version précis
                if (navigator.userAgentData?.getHighEntropyValues) {
                    const hv = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
                    if (hv.model) model = hv.model;
                    if (platform === 'Android' && hv.platformVersion) os = `Android ${hv.platformVersion.split('.')[0]}`;
                }
            } catch (e) {}
            const standalone = !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
            return { platform, os, browser, model, standalone };
        },

        // ---------- Erreurs techniques (consentement v3 pour l'envoi ; comptage local sinon) ----------
        ERR_KEY: 'sm_errors',
        _errorInfo() {
            try { const e = JSON.parse(localStorage.getItem(this.ERR_KEY) || '{}'); return { errors: e.count || 0, lastError: e.last || '', lastErrorAt: e.lastAt || null }; }
            catch (x) { return { errors: 0 }; }
        },
        _watchErrors() {
            if (this._watching) return; this._watching = true;
            const rec = (raw) => {
                // on retire tout texte entre guillemets et les adresses : aucun contenu de partie ne doit partir
                const msg = String(raw || '').replace(/(["'`])(?:(?!\1).)*\1/g, '$1…$1').replace(/https?:\/\/\S+/g, '<url>').slice(0, 150);
                if (!msg || /ResizeObserver|Script error/i.test(msg)) return;
                try {
                    const e = JSON.parse(localStorage.getItem(this.ERR_KEY) || '{}');
                    e.count = (e.count || 0) + 1; e.last = msg; e.lastAt = new Date().toISOString();
                    localStorage.setItem(this.ERR_KEY, JSON.stringify(e));
                } catch (x) {}
                if (this._state?.consentV >= 3 && this.enabled) { clearTimeout(this._errTimer); this._errTimer = setTimeout(() => this.sync(true), 30000); }
            };
            window.addEventListener('error', ev => rec(ev.message + (ev.lineno ? ` (ligne ${ev.lineno})` : '')));
            window.addEventListener('unhandledrejection', ev => rec('Promesse rejetée : ' + (ev.reason?.message || ev.reason)));
        },

        /** Informations détaillées (consentement v2) : écran, langue, fuseau, thème, usage. Aucun nom de joueur. */
        _detail() {
            const w = Math.min(screen.width, screen.height), h = Math.max(screen.width, screen.height);
            const dpr = Math.round((window.devicePixelRatio || 1) * 10) / 10;
            const dark = document.documentElement.getAttribute('data-theme') === 'dark'
                || (document.documentElement.getAttribute('data-theme') !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
            let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
            const st = this._stats();
            return { screen: `${w}x${h}@${dpr}`, lang: navigator.language || '', tz, theme: dark ? 'dark' : 'light',
                     sessions: this.load().sessions || 0, players: st.players, topGame: st.topGame,
                     ...(this.load().consentV >= 3 ? this._errorInfo() : {}) };
        },

        _stats() {
            let games = 0, last = null;
            const names = new Set(), byGame = {};
            try {
                Storage.loadGames().forEach(g => {
                    if (!g.finished) return;
                    games++;
                    (g.state?.players || []).forEach(p => names.add(String(p.name).toLowerCase()));
                    const k = g.preset || g.mode || 'standard'; byGame[k] = (byGame[k] || 0) + 1;
                    const t = new Date(g.date).getTime();
                    if (!isNaN(t) && (last === null || t > last)) last = t;
                });
            } catch (e) {}
            const topKey = Object.entries(byGame).sort((a, b) => b[1] - a[1])[0]?.[0];
            let topGame = topKey || '';
            try { topGame = app.getAllPresets()[topKey]?.name || topKey || ''; } catch (e) {}
            return { games, lastGameAt: last === null ? null : new Date(last).toISOString(), players: names.size, topGame };
        },

        async _post(path, body) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 10000);
            try {
                const res = await fetch(this.API_URL.replace(/\/$/, '') + path, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body), signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
                });
                return res.ok;
            } catch (e) { return false; }
            finally { clearTimeout(timer); }
        },

        /** Envoie le profil (uniquement si la personne est inscrite). */
        async sync(force = false) {
            if (!this.enabled || !this.isMember() || this._busy) return false;
            const st = this._state;
            if (!force && st.lastSync && Date.now() - st.lastSync < this.SYNC_MIN_INTERVAL) return false;
            if (!navigator.onLine) return false;
            this._busy = true;
            try {
                const { games, lastGameAt } = this._stats();
                const ok = await this._post('/api/profile', {
                    id: st.id, consent: true, pseudo: st.pseudo, device: await this._device(),
                    games, lastGameAt, appVersion: this.APP_VERSION,
                    ...(st.consentV >= 2 ? { detail: this._detail() } : {})
                });
                if (ok) { st.lastSync = Date.now(); this.save(); }
                return ok;
            } finally { this._busy = false; }
        },
        /** Après une partie terminée : met à jour le profil (léger délai pour laisser la partie s'enregistrer). */
        syncSoon() {
            if (!this.enabled || !this.isMember()) return;
            clearTimeout(this._syncTimer);
            this._syncTimer = setTimeout(() => this.sync(true), 3000);
        },

        init() {
            this.load();
            this._watchErrors();
            if (this.isMember() && this._state.consentV >= 2) { this._state.sessions = (this._state.sessions || 0) + 1; this.save(); }
            this.renderSettings();
            if (!this.enabled) return;
            if (this._state.pendingDelete) this._flushDelete();
            else if (this.isMember()) this.sync(false);
            window.addEventListener('online', () => {
                if (this._state.pendingDelete) this._flushDelete(); else this.sync(false);
            });
        },

        // ---------- Inscription / retrait (pilotés par le module Cloud : un seul consentement) ----------
        enroll(pseudo) {
            const s = this.load();
            s.id = s.id || this._uuid();
            s.pseudo = pseudo; s.consent = true; s.consentAt = new Date().toISOString(); s.consentV = 3;
            s.declined = false; s.pendingDelete = false; delete s.snoozeUntil; delete s.lastSync;
            this.save();
            return this.sync(true);
        },
        unenroll() {
            const s = this.load();
            if (!s.id) return Promise.resolve(true);
            s.pendingDelete = true; s.consent = false; this.save();
            return this._flushDelete();
        },
        async _flushDelete() {
            const s = this.load();
            if (!s.pendingDelete || !s.id) return true;
            if (!navigator.onLine) return false;
            const ok = await this._post('/api/profile/delete', { id: s.id });
            if (ok) { delete s.id; delete s.pseudo; delete s.pendingDelete; delete s.lastSync; delete s.consentAt; this.save(); }
            return ok;
        },
        renderSettings() { const sec = document.getElementById('community-section'); if (sec) sec.style.display = 'none'; },
        /** Profil créé avant l'ajout des informations détaillées : elles ne sont envoyées qu'après accord explicite. */
        upgradeConsent() {
            const s = this.load(); if (!s.id) return;
            s.consentV = 3; s.consentAt = new Date().toISOString(); this.save();
            this.sync(true);
            Cloud.renderSettings();
            UI.showToast('✅ Merci ! Informations détaillées activées', 'success');
        }
    };

    // ======================================================================
    // MON PROFIL & SAUVEGARDE CLOUD (facultatif, un seul consentement)
    // Identité = pseudo (unique) + couleur préférée. Le profil partage avec l'éditeur : pseudo,
    // type d'appareil, nombre de parties, date de la dernière partie ; et il sauvegarde les parties
    // (noms des joueurs inclus) dans le cloud pour les retrouver sur un autre appareil.
    // ======================================================================
    const Cloud = {
        KEY: 'sm_cloud',
        COLORS: [
            ['rouge', '#e74c3c'], ['orange', '#f39c12'], ['jaune', '#f1c40f'], ['vert', '#2ecc71'],
            ['turquoise', '#1abc9c'], ['bleu', '#3498db'], ['violet', '#9b59b6'], ['rose', '#fd79a8'],
            ['marron', '#8d6e63'], ['noir', '#222222'], ['blanc', '#ffffff'], ['gris', '#95a5a6']
        ],
        MAX_CHARS: 1400000,
        AUTO_MIN_INTERVAL: 20000,
        SNOOZE_MS: 7 * 86400 * 1000,
        _state: null, _busy: false, _timer: null, _pending: null, _lastAttempt: 0,
        _color: null, _mode: 'create', _askedThisSession: false, _promptedThisSession: false,

        get apiUrl() { return Community.API_URL; },
        get enabled() { return !!this.apiUrl; },

        load() {
            let s = {};
            try { const p = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (p && typeof p === 'object') s = p; } catch (e) {}
            // mise à jour en place : les références déjà prises (ex. pendant un envoi) restent valides
            if (!this._state) this._state = {};
            Object.keys(this._state).forEach(k => delete this._state[k]);
            Object.assign(this._state, s);
            return this._state;
        },
        save() { try { localStorage.setItem(this.KEY, JSON.stringify(this._state)); } catch (e) {} },
        isActive() { const s = this.load(); return !!s.pseudo && !!s.color && s.consent === true; },
        _cleanPseudo(v) { return Community._cleanPseudo(v); },
        _auth() { const s = this.load(); return { pseudo: s.pseudo, color: s.color }; },

        // ---------- Réseau ----------
        async _call(path, body) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 20000);
            try {
                const res = await fetch(this.apiUrl.replace(/\/$/, '') + path, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body), signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
                });
                let j = null; try { j = await res.json(); } catch (e) {}
                return { ok: res.ok, status: res.status, json: j };
            } catch (e) { return { ok: false, status: 0, json: null }; }
            finally { clearTimeout(timer); }
        },
        _errText(r) {
            if (r.status === 0) return 'Serveur injoignable, réessayez.';
            if (r.status === 404) return 'Aucun profil trouvé avec ce pseudo.';
            if (r.status === 403) {
                const left = r.json?.left;
                return `Pseudo ou couleur incorrects${left > 0 ? ` (${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''})` : ''}.`;
            }
            if (r.status === 429 && r.json?.error === 'verrouillé') return `Trop d'essais : réessayez dans ${Math.ceil((r.json.retryInSec || 900) / 60)} min.`;
            return 'Erreur du serveur, réessayez.';
        },

        // ---------- Compression ----------
        async _pack(text) {
            if (typeof CompressionStream === 'undefined') return { enc: 'json', payload: text };
            try {
                const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
                const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
                let bin = '';
                for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                return { enc: 'gzip', payload: btoa(bin) };
            } catch (e) { return { enc: 'json', payload: text }; }
        },
        async _unpack(payload, enc) {
            if (enc !== 'gzip') return JSON.parse(payload);
            const bin = atob(payload);
            const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            return JSON.parse(await new Response(stream).text());
        },
        _fingerprint(s) {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return `${s.length}:${h}`;
        },

        // ---------- Données locales ----------
        _hasData() {
            try {
                return Storage.loadGames().length > 0
                    || (app.savedPlayers || []).length > 0
                    || Object.keys(app._readJsonKey(Storage.CUSTOM_PRESETS_KEY, {})).length > 0;
            } catch (e) { return false; }
        },
        _snapshot() {
            const data = app._buildExportData(Storage.loadCurrentGame());
            delete data.exportDate;
            return JSON.stringify(data);
        },
        async _deviceLabel() {
            try {
                const d = await Community._device();
                return [d.model || d.platform, d.browser].filter(Boolean).join(' · ').slice(0, 60);
            } catch (e) { return ''; }
        },
        _fmtDate(iso) {
            const d = new Date(iso);
            return isNaN(d) ? 'date inconnue' : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
        },

        // ---------- Sauvegarde ----------
        /** Multi-appareils : si un autre appareil a sauvegardé depuis, ajoute ses parties absentes ici (par identifiant). */
        async _pullOthers() {
            const st = this._state;
            const i = await this._call('/api/backup/info', this._auth());
            if (!i.ok || !i.json?.updatedAt || i.json.updatedAt === st.lastBackupAt) return 0;
            const r = await this._fetch(st.pseudo, st.color);
            if (r.error || !Array.isArray(r.data?.games)) return 0;
            const local = Storage.loadGames();
            const byId = new Map(local.map(g => [String(g.id), g]));
            const added = [], newer = new Map();
            r.data.games.forEach(g => {
                if (!g) return;
                const mine = byId.get(String(g.id));
                if (!mine) added.push(g);
                else if (g.lastModified && (!mine.lastModified || g.lastModified > mine.lastModified)) newer.set(String(g.id), g); // plus récente ailleurs
            });
            if (!added.length && !newer.size) return 0;
            Storage.importGames([...local.map(g => newer.get(String(g.id)) || g), ...added]);
            try { app.renderGamesList(); } catch (e) {}
            const n = added.length + newer.size;
            UI.showToast(`☁️ ${n} partie(s) mise(s) à jour depuis un autre appareil`, 'success');
            return n;
        },
        /** Envoie la sauvegarde. manual = true : retour visuel et envoi même sans changement. */
        async backup(manual = false) {
            if (!this.enabled || !this.isActive() || this._busy) return false;
            if (!navigator.onLine) { if (manual) UI.showToast('📵 Pas de connexion — réessayez plus tard', 'warning'); return false; }
            if (!this._hasData()) { if (manual) UI.showToast('Rien à sauvegarder pour le moment', 'info'); return false; }
            this._busy = true; this._lastAttempt = Date.now();
            try {
                const st = this._state;
                try { await this._pullOthers(); } catch (e) {}
                const text = this._snapshot();
                const fp = this._fingerprint(text);
                if (!manual && fp === st.lastHash) return true;
                const { enc, payload } = await this._pack(text);
                if (payload.length > this.MAX_CHARS) {
                    if (manual) UI.showToast('❌ Sauvegarde trop volumineuse pour le cloud — utilisez l\'export fichier', 'error');
                    return false;
                }
                const r = await this._call('/api/backup/put', {
                    ...this._auth(), payload, enc,
                    meta: { games: Storage.loadGames().length, device: await this._deviceLabel(), appVersion: Community.APP_VERSION }
                });
                if (r.ok) {
                    st.lastHash = fp; st.lastBackupAt = r.json?.updatedAt || new Date().toISOString(); this.save();
                    this.renderSettings();
                    if (manual) UI.showToast('☁️ Sauvegarde envoyée', 'success');
                    return true;
                }
                if (manual) UI.showToast(r.status === 429 ? '⏳ Un instant, puis réessayez' : `❌ ${this._errText(r)}`, 'error');
                return false;
            } finally { this._busy = false; }
        },
        backupSoon(delay = 5000) {
            if (!this.enabled || !this.isActive()) return;
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this.backup(false), delay);
        },

        // ---------- Restauration ----------
        async _fetch(pseudo, color) {
            const r = await this._call('/api/backup/get', { pseudo, color });
            if (!r.ok) return { error: this._errText(r), status: r.status };
            try {
                const data = await this._unpack(r.json.payload, r.json.enc);
                app._validateImportData(data);
                return { data, meta: r.json };
            } catch (e) { return { error: 'Sauvegarde illisible.', status: 0 }; }
        },
        _apply(data, meta, mode) {
            data.exportDate = meta?.updatedAt || data.exportDate;
            app._restoreImportedData(data, mode);
        },
        /** Appareil vide mais profil connu : on propose de retrouver les données (la personne répond oui ou non). */
        async _offerRestore() {
            if (this._askedThisSession || !this.isActive() || this._hasData() || !navigator.onLine) return false;
            if (this._state.restoreSnoozeUntil && Date.now() < this._state.restoreSnoozeUntil) return false;
            this._askedThisSession = true;
            const { pseudo, color } = this._auth();
            const r = await this._fetch(pseudo, color);
            if (r.error || this._hasData()) return false;
            this._pending = { ...r, pseudo, color, offer: true };
            UI._close('settings-modal'); UI._open('cloud-modal');
            this._view('preview');
            return true;
        },

        // ---------- Initialisation ----------
        async init() {
            this.load();
            this.renderSettings();
            if (!this.enabled) return;
            if (this._state.pendingDelete) this._flushDelete();
            window.addEventListener('online', () => {
                if (this._state.pendingDelete) this._flushDelete(); else this.backupSoon(2000);
            });
            document.addEventListener('visibilitychange', () => {
                if (Date.now() - this._lastAttempt <= this.AUTO_MIN_INTERVAL) return;
                if (document.visibilityState === 'hidden') this.backup(false);
                else if (this.isActive()) this.backupSoon(2500); // retour sur l'app : récupère les parties des autres appareils
            });
            if (this.isActive()) {
                if (await this._offerRestore()) return;
                this.backupSoon(6000);
            }
        },

        // ---------- Invitation (une seule fois, après une première partie terminée) ----------
        maybePrompt() {
            if (!this.enabled || this._promptedThisSession) return;
            const s = this.load();
            if (s.consent === true || s.declined || s.pendingDelete) return;
            if (s.snoozeUntil && Date.now() < s.snoozeUntil) return;
            if (Community._stats().games < 1) return;
            this._promptedThisSession = true;
            setTimeout(() => {
                const busy = document.querySelector('.modal-overlay.active, .victory-overlay.active');
                const home = document.getElementById('setup');
                if (!busy && home && getComputedStyle(home).display !== 'none') this.open('create');
            }, 1200);
        },
        later() {
            const s = this.load();
            if (!s.consent) { s.snoozeUntil = Date.now() + this.SNOOZE_MS; this.save(); }
            this.close();
        },
        declineOffer() {
            const s = this.load(); s.restoreSnoozeUntil = Date.now() + this.SNOOZE_MS; this.save(); this.close();
        },
        decline() {
            const s = this.load(); s.declined = true; this.save(); this.close();
        },

        // ---------- Fenêtre ----------
        _el() { return document.getElementById('cloud-body'); },
        open(mode = 'create') {
            UI._close('settings-modal');
            UI._open('cloud-modal');
            this._pending = null; this._color = null;
            this._view(mode === 'enter' ? 'enter' : 'create');
        },
        close() { UI._close('cloud-modal'); this._pending = null; this.renderSettings(); },
        _btn(label, icon, fn, sub, cls = '', extra = '') {
            return `<button class="backup-action ${cls}" onclick="${fn}" ${extra}><span class="ba-icon">${icon}</span><span class="ba-text"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
        },
        _swatches() {
            return `<div id="cloud-colors" role="radiogroup" aria-label="Couleur préférée" style="display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:14px;">${
                this.COLORS.map(([n, c]) => `<button type="button" role="radio" aria-checked="false" aria-label="${n}" data-color="${n}" onclick="Cloud.pick('${n}')" style="aspect-ratio:1; border-radius:50%; border:3px solid var(--border); background:${c}; cursor:pointer; padding:0;"></button>`).join('')
            }</div>`;
        },
        pick(name) {
            this._color = name;
            document.querySelectorAll('#cloud-colors button').forEach(b => {
                const on = b.dataset.color === name;
                b.setAttribute('aria-checked', on);
                b.style.borderColor = on ? 'var(--text)' : 'var(--border)';
                b.style.transform = on ? 'scale(1.12)' : '';
            });
            const l = document.getElementById('cloud-color-label'); if (l) l.textContent = name;
            this.validate();
        },
        validate() {
            const pseudo = this._cleanPseudo(document.getElementById('cloud-pseudo')?.value);
            const consent = !!document.getElementById('cloud-consent')?.checked;
            const btn = document.getElementById('cloud-go');
            if (btn) btn.disabled = !(pseudo.length >= 2 && this._color && consent);
            const m = document.getElementById('cloud-msg'); if (m) m.textContent = '';
        },
        _view(name) {
            const el = this._el(); if (!el) return;
            const field = 'width:100%; padding:12px; border:2px solid var(--border); border-radius:12px; font-size:16px; font-weight:700; background:var(--bg); color:var(--text); box-sizing:border-box; margin-bottom:12px;';
            const label = 'display:block; font-size:12px; font-weight:800; color:var(--text-sec); margin-bottom:6px;';
            if (name === 'create' || name === 'enter') {
                const create = name === 'create';
                this._mode = name;
                el.innerHTML = `
                    <p style="margin:0 0 12px; font-size:14px; line-height:1.45;">${create
                        ? 'Facultatif : créez votre profil pour retrouver vos parties si vous changez de téléphone ou perdez vos données.'
                        : 'Entrez votre pseudo et votre couleur préférée pour retrouver vos données sur cet appareil.'}</p>
                    ${create ? `<div class="backup-status" style="margin-bottom:12px;">
                        <b>Ce qui est envoyé</b><br>
                        • votre pseudo ; votre appareil (modèle approximatif, système, navigateur, taille d'écran, thème) ; votre langue et fuseau horaire ; app installée ou non : visibles par l'éditeur de ScoreMaster<br>
                        • des statistiques d'usage : nombre de lancements, de parties, de joueurs différents (sans leurs noms), jeu le plus joué, date de la dernière partie<br>
                        • la version de l'app et les erreurs techniques rencontrées (leur nombre et le dernier message, sans contenu de vos parties)<br>
                        • une copie de vos parties, joueurs et réglages, gardée dans le cloud pour la restauration
                    </div>` : ''}
                    <label for="cloud-pseudo" style="${label}">VOTRE PSEUDO</label>
                    <input type="text" id="cloud-pseudo" maxlength="30" autocomplete="off" autocapitalize="words" placeholder="Ex : Camille" oninput="Cloud.validate()" style="${field}">
                    <label style="${label}">VOTRE COULEUR PRÉFÉRÉE : <span id="cloud-color-label" style="text-transform:uppercase; color:var(--text);">—</span></label>
                    ${this._swatches()}
                    <label style="display:flex; gap:10px; align-items:flex-start; font-size:13px; line-height:1.4; margin-bottom:12px; cursor:pointer;">
                        <input type="checkbox" id="cloud-consent" onchange="Cloud.validate()" style="margin-top:3px; width:18px; height:18px; flex-shrink:0;">
                        <span>J'accepte que ces informations soient envoyées à l'éditeur de ScoreMaster et conservées (chez Cloudflare) tant que mon profil existe. Je peux le supprimer à tout moment dans Paramètres : tout est alors effacé.</span>
                    </label>
                    <div id="cloud-msg" style="font-size:13px; min-height:18px; margin-bottom:10px; color:var(--danger, #e74c3c);"></div>
                    ${this._btn(create ? 'Créer mon profil' : 'Retrouver mes données', create ? '✅' : '🔎', 'Cloud.submit()', create ? 'Première sauvegarde immédiate' : 'Rien n\'est modifié avant votre confirmation', 'primary', 'id="cloud-go" disabled')}
                    <button class="btn-modal-cancel" style="width:100%; margin-bottom:8px;" onclick="Cloud._view('${create ? 'enter' : 'create'}')">${create ? 'J\'ai déjà un profil' : 'Créer un nouveau profil'}</button>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-modal-cancel" style="flex:1;" onclick="Cloud.later()">Plus tard</button>
                        ${create ? '<button class="btn-modal-cancel" style="flex:1;" onclick="Cloud.decline()">Non merci</button>' : ''}
                    </div>`;
                this._color = null;
                setTimeout(() => document.getElementById('cloud-pseudo')?.focus(), 60);
            } else if (name === 'done') {
                const s = this.load();
                el.innerHTML = `
                    <p style="margin:0 0 12px; font-size:14px; line-height:1.5;">✅ Profil <b>${escapeHtml(s.pseudo)}</b> créé. Pour retrouver vos données plus tard : votre pseudo et la couleur <b>${escapeHtml(s.color)}</b>.</p>
                    <div class="backup-status" style="margin-bottom:14px;">Sur cet appareil, tout se fera automatiquement : si vos données disparaissent, l'app vous proposera de les retrouver.</div>
                    <button class="btn-modal-cancel" style="width:100%;" onclick="Cloud.close()">Terminer</button>`;
            } else if (name === 'preview') {
                const { data, meta, offer, pseudo } = this._pending;
                const n = Array.isArray(data.games) ? data.games.length : 0;
                const local = Storage.loadGames();
                const ids = new Set(local.map(g => String(g.id)));
                const fresh = (data.games || []).filter(g => g && !ids.has(String(g.id))).length;
                el.innerHTML = `
                    ${offer ? `<p style="margin:0 0 12px; font-size:15px; line-height:1.45; font-weight:700;">Retrouver vos données de « ${escapeHtml(pseudo)} » ?</p>` : ''}
                    <div class="backup-stats">
                        <div><b>${n}</b><span>parties dans la sauvegarde</span></div>
                        <div><b>${fresh}</b><span>nouvelles pour cet appareil</span></div>
                    </div>
                    <div class="backup-status" style="margin:10px 0 14px;">Sauvegardé le ${escapeHtml(this._fmtDate(meta.updatedAt))}${meta.device ? `<br>depuis : ${escapeHtml(meta.device)}` : ''}</div>
                    ${this._btn('Restaurer', '♻️', 'Cloud.confirmRestore(\'replace\')', local.length ? `Remplace les ${local.length} partie(s) de cet appareil` : 'Récupère toutes vos données', 'primary')}
                    ${local.length ? this._btn('Fusionner', '➕', 'Cloud.confirmRestore(\'merge\')', 'Ajoute seulement les parties absentes', '', fresh === 0 ? 'disabled' : '') : ''}
                    <button class="btn-modal-cancel" style="width:100%;" onclick="Cloud.${offer ? 'declineOffer' : 'close'}()">${offer ? 'Non merci' : 'Annuler'}</button>`;
            }
        },

        // ---------- Actions ----------
        async submit() {
            const pseudo = this._cleanPseudo(document.getElementById('cloud-pseudo')?.value);
            const color = this._color, msg = document.getElementById('cloud-msg'), btn = document.getElementById('cloud-go');
            if (pseudo.length < 2 || !color || !document.getElementById('cloud-consent')?.checked) return;
            if (!navigator.onLine) { msg.textContent = '📵 Pas de connexion.'; return; }
            btn.disabled = true;
            if (this._mode === 'create') {
                const c = await this._call('/api/backup/check', { pseudo });
                if (!c.ok) { msg.textContent = this._errText(c); btn.disabled = false; return; }
                if (c.json.exists) {
                    msg.textContent = 'Ce pseudo existe déjà. Si c\'est vous, touchez « J\'ai déjà un profil » ; sinon choisissez un autre pseudo.';
                    btn.disabled = false; return;
                }
                const s = this.load();
                Object.assign(s, { pseudo, color, consent: true, consentAt: new Date().toISOString(), declined: false, lastHash: null });
                delete s.snoozeUntil; delete s.pendingDelete; this.save();
                this._view('done');
                this.renderSettings();
                Community.enroll(pseudo);
                const ok = this._hasData() ? await this.backup(true) : true;
                if (!ok) UI.showToast('☁️ Profil créé — la première sauvegarde partira dès que possible', 'info');
            } else {
                const r = await this._fetch(pseudo, color);
                if (r.error) { msg.textContent = r.error; btn.disabled = false; return; }
                this._pending = { ...r, pseudo, color };
                this._view('preview');
            }
        },
        async restoreFromCloud() { // bouton Paramètres
            if (!this.isActive()) return;
            if (!navigator.onLine) { UI.showToast('📵 Pas de connexion', 'warning'); return; }
            const { pseudo, color } = this._auth();
            const r = await this._fetch(pseudo, color);
            if (r.error) { UI.showToast(`❌ ${r.error}`, 'error'); return; }
            UI._close('settings-modal'); UI._open('cloud-modal');
            this._pending = { ...r, pseudo, color };
            this._view('preview');
        },
        confirmRestore(mode) {
            const p = this._pending; if (!p) return;
            const s = this.load();
            Object.assign(s, { pseudo: p.pseudo, color: p.color, consent: true, consentAt: s.consentAt || new Date().toISOString(), declined: false, lastBackupAt: p.meta.updatedAt, lastHash: null });
            delete s.pendingDelete; this.save();
            Community.enroll(p.pseudo);
            UI._close('cloud-modal'); this._pending = null;
            try { this._apply(p.data, p.meta, mode); }
            catch (e) { console.error(e); UI.showToast(`❌ Restauration échouée : ${e.message}`, 'error'); }
            this.renderSettings();
        },
        disable() {
            UI.confirm('Supprimer votre profil ? Votre pseudo et la copie cloud de vos parties seront effacés du serveur (vos parties restent sur cet appareil).', async () => {
                const s = this.load();
                s.pendingDelete = { pseudo: s.pseudo, color: s.color };
                ['pseudo', 'color', 'consent', 'lastHash', 'lastBackupAt'].forEach(k => delete s[k]);
                s.declined = true;
                this.save(); this.renderSettings();
                Community.unenroll();
                const ok = await this._flushDelete();
                UI.showToast(ok ? '🗑️ Profil et sauvegarde supprimés' : '🗑️ Suppression dès que la connexion revient', ok ? 'success' : 'info');
            });
        },
        async _flushDelete() {
            const s = this.load();
            if (!s.pendingDelete || !navigator.onLine) return false;
            const r = await this._call('/api/backup/delete', { pseudo: s.pendingDelete.pseudo, color: s.pendingDelete.color });
            if (r.ok || r.status === 404 || r.status === 403) { delete s.pendingDelete; this.save(); this.renderSettings(); return true; }
            return false;
        },

        // ---------- Paramètres ----------
        renderSettings() {
            const sec = document.getElementById('cloud-section');
            if (!sec) return;
            sec.style.display = this.enabled ? '' : 'none';
            if (!this.enabled) return;
            const s = this.load();
            const st = document.getElementById('cloud-status');
            const act = document.getElementById('cloud-actions');
            const b = (l, i, f, sub) => this._btn(l, i, f, sub);
            const adv = document.getElementById('cloud-adv-actions');
            if (adv) adv.innerHTML = '';
            if (this.isActive()) {
                st.textContent = `✅ Profil « ${s.pseudo} »`;
                act.innerHTML = ((Community.load().consentV || 1) >= 3 ? '' : b('Partager les infos détaillées', '📊', 'Community.upgradeConsent()', 'Écran, langue, lancements, jeu favori, erreurs techniques… (facultatif, à votre accord)'))
                    + b('Synchroniser maintenant', '🔄', 'Cloud.backup(true)', s.lastBackupAt ? `Dernière : ${this._fmtDate(s.lastBackupAt)}` : 'Première sauvegarde en attente')
                    + b('Restaurer ma sauvegarde', '⬇️', 'Cloud.restoreFromCloud()', 'Relire la copie du cloud');
                if (adv) adv.innerHTML = b('Utiliser un autre profil', '🔁', 'Cloud.open(\'enter\')', 'Autre pseudo (ex. une autre personne sur ce téléphone)')
                    + b('Supprimer mon profil', '🗑️', 'Cloud.disable()', 'Efface pseudo et sauvegarde du serveur');
            } else if (s.pendingDelete) {
                st.textContent = '⏳ Suppression en cours : elle sera finalisée dès que la connexion revient.';
                act.innerHTML = '';
            } else {
                st.textContent = 'Facultatif : créez un profil (pseudo + couleur préférée) pour sauvegarder vos parties dans le cloud et les retrouver sur un nouvel appareil.';
                act.innerHTML = b('Créer mon profil', '👤', 'Cloud.open(\'create\')', 'Pseudo + couleur préférée')
                    + b('J\'ai déjà un profil', '🔎', 'Cloud.open(\'enter\')', 'Retrouver mes données');
            }
        }
    };

