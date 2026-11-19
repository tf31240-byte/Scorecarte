    // =========================================================================
    // INSTALLATION SUR L'ÉCRAN D'ACCUEIL — étapes adaptées à l'appareil détecté
    // =========================================================================
    const Install = {
        _view: null,   // plateforme affichée : 'ios' | 'android' | 'desktop'

        /** Détecte système, navigateur et état d'installation. */
        detect() {
            const ua = navigator.userAgent || '';
            const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const android = /Android/.test(ua);
            const os = ios ? 'ios' : android ? 'android' : 'desktop';
            let browser = 'other';
            if (ios) {
                if (!/Safari\//.test(ua) || /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|MicroMessenger|GSA\//.test(ua)) browser = 'inapp';
                else if (/CriOS/.test(ua)) browser = 'chrome';
                else if (/FxiOS/.test(ua)) browser = 'firefox';
                else if (/EdgiOS/.test(ua)) browser = 'edge';
                else browser = 'safari';
            } else if (android) {
                if (/FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|MicroMessenger/.test(ua) || /; wv\)/.test(ua)) browser = 'inapp';
                else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
                else if (/Firefox/.test(ua)) browser = 'firefox';
                else if (/EdgA/.test(ua)) browser = 'edge';
                else if (/Chrome\//.test(ua)) browser = 'chrome';
            } else {
                if (/Edg\//.test(ua)) browser = 'edge';
                else if (/Firefox\//.test(ua)) browser = 'firefox';
                else if (/Chrome\//.test(ua)) browser = 'chrome';
                else if (/Safari\//.test(ua)) browser = 'safari';
            }
            const standalone = !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
            return { os, browser, standalone, canPrompt: !!PWA.deferredPrompt };
        },

        _hasData() { try { return Storage.loadGames().length > 0; } catch (e) { return false; } },
        _k(t) { return `<span class="ob-k">${t}</span>`; },

        /** Contenu (HTML) pour une plateforme. `d` = détection de l'appareil réel. */
        body(os, d, compact) {
            d = d || this.detect();
            const real = os === d.os;                 // on affiche les étapes de l'appareil utilisé ?
            const br = real ? d.browser : (os === 'ios' ? 'safari' : os === 'android' ? 'chrome' : 'chrome');
            const ol = steps => `<ol class="ob-list ob-ol">${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
            const note = (t, cls = '') => `<div class="inst-note ${cls}">${t}</div>`;
            const btn = (label, fn, cls = 'btn-main ob-inline') => `<button class="${cls}" onclick="${fn}">${label}</button>`;
            let h = '';

            if (real && d.standalone) return note('✅ <b>ScoreMaster est déjà installée</b> sur cet appareil : tu l\'utilises en plein écran.', 'ok');

            if (br === 'inapp') {
                h += note(`⚠️ Tu es dans le navigateur intégré d'une autre appli (réseaux sociaux, messagerie…). L'installation n'y est pas possible.`, 'warn');
                h += ol([`Touche le menu ${this._k('⋯')} ou ${this._k('⋮')} de cette page`, `Choisis <b>Ouvrir dans ${os === 'ios' ? 'Safari' : 'Chrome'}</b> (ou « Ouvrir dans le navigateur »)`, `Puis reviens ici : les étapes d'installation s'afficheront`]);
                h += btn('📋 Copier le lien', 'Install.copyLink()', 'ob-secondary ob-inline');
                return h;
            }

            if (os === 'ios') {
                h += this._iosMock();
                if (real && br !== 'safari') {
                    h += note(`💡 Sur iPhone, l'installation est la plus fiable depuis <b>Safari</b>. Copie le lien et ouvre-le dans Safari.`, 'warn');
                    h += btn('📋 Copier le lien', 'Install.copyLink()', 'ob-secondary ob-inline');
                }
                h += ol([
                    `Touche le menu ${this._k('≡')} (à gauche de l'adresse) ou ${this._k('⋯')}, puis <b>Partager</b> ${this._k('⬆︎')} <small>(iOS plus ancien : le bouton ⬆︎ en bas)</small>`,
                    `Dans la feuille de partage, touche <b>En voir plus</b> ${this._k('⌄')}`,
                    `Choisis <b>Sur l'écran d'accueil</b> ${this._k('⊞')} (fais défiler la liste si besoin)`,
                    `Garde « Ouvrir comme app web » activé, puis touche <b>Ajouter</b> en haut à droite`,
                    `Ouvre ScoreMaster depuis son <b>icône</b> : plein écran, hors-ligne`
                ]);
                if (compact) h += note(`⚠️ L'appli installée démarre <b>vide</b> (données séparées de Safari). Crée ton profil ☁️ à la dernière étape <b>avant</b>, puis choisis « J'ai déjà un profil » dedans.`, 'warn');
                else {
                    h += note(`⚠️ <b>Sur iPhone, l'appli installée démarre vide</b> : ses données sont séparées de Safari.${this._hasData() ? ' Tu as déjà des parties : sauvegarde-les d\'abord avec ton profil ☁️.' : ''}<br>Dans l'appli installée, choisis ensuite <b>« J'ai déjà un profil »</b> pour tout retrouver.`, 'warn');
                    h += btn(Cloud.load().consent ? '🔄 Synchroniser maintenant' : '☁️ Créer mon profil avant d\'installer', Cloud.load().consent ? 'Cloud.backup(true)' : 'Install.toCloud()', 'ob-secondary ob-inline');
                }
                return h;
            }

            if (os === 'android') {
                if (real && d.canPrompt) {
                    h += `<p class="inst-lead">Un seul bouton suffit :</p>` + btn('📲 Installer ScoreMaster', 'Install.now()');
                    h += `<p class="inst-or">ou à la main :</p>`;
                }
                if (br === 'samsung') h += ol([`Touche le menu ${this._k('☰')}`, `Choisis <b>Ajouter la page à</b> puis <b>Écran d'accueil</b>`, `Valide avec <b>Ajouter</b>`]);
                else if (br === 'firefox') h += ol([`Touche le menu ${this._k('⋮')}`, `Choisis <b>Installer</b>`, `Valide avec <b>Ajouter</b>`]);
                else h += ol([`Touche le menu ${this._k('⋮')} en haut à droite`, `Choisis <b>Installer l'application</b> (ou « Ajouter à l'écran d'accueil »)`, `Valide avec <b>Installer</b>`]);
                h += note('Sur Android, l\'appli installée garde tes parties actuelles.', 'ok');
                return h;
            }

            // Ordinateur
            if (real && d.canPrompt) h += btn('📲 Installer ScoreMaster', 'Install.now()');
            if (br === 'safari') h += ol([`Dans la barre de menus : <b>Fichier</b>`, `Choisis <b>Ajouter au Dock…</b>`]);
            else if (br === 'firefox') h += note('Firefox ne sait pas installer les applis web sur ordinateur : utilise Chrome ou Edge.', 'warn');
            else h += ol([`Clique sur l'icône d'installation ${this._k('⊕')} à droite de la barre d'adresse`, `Choisis <b>Installer</b>`]);
            return h;
        },

        /** Illustration animée des 3 gestes dans Safari (barre → feuille de partage → Ajouter). */
        _iosMock() {
            const row = (t, hot) => `<div${hot ? ' class="hot"' : ''}>${t}</div>`;
            return `<div class="ios-mock" aria-hidden="true">
                <div class="ios-fr f1"><div class="ios-cap">① Menu ≡ → Partager</div>
                    <div class="ios-bar"><span>‹</span><span class="hot">≡</span><span class="ios-url">adresse ↻</span><span>⧉</span></div>
                    <div class="ios-sheet ios-mini">${row('Traduire…')}${row('Partager <b>⬆︎</b>', 1)}</div></div>
                <div class="ios-fr f2"><div class="ios-cap">② « En voir plus » ⌄</div>
                    <div class="ios-bar ios-act"><span>Copier</span><span>Signets</span><span>Lecture</span><span class="hot">⌄<br><small>En voir plus</small></span></div></div>
                <div class="ios-fr f3"><div class="ios-cap">③ « Sur l'écran d'accueil »</div>
                    <div class="ios-sheet">${row('Ajouter un signet à…')}${row('Ajouter aux favoris')}${row('Rechercher dans la page')}${row('Sur l\'écran d\'accueil <b>⊞</b>', 1)}</div></div>
                <div class="ios-fr f4"><div class="ios-cap">④ Touche Ajouter</div>
                    <div class="ios-add"><span>✕</span><b>Ajouter</b></div><div class="ios-name">🎴 ScoreMaster<small>Ouvrir comme app web ●</small></div></div>
            </div>`;
        },

        _label(os, d) {
            const m = { safari: 'Safari', chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge', samsung: 'Samsung Internet', inapp: 'navigateur intégré', other: '' };
            const dev = { ios: '📱 iPhone / iPad', android: '📱 Android', desktop: '💻 Ordinateur' }[os];
            return os === d.os && m[d.browser] ? `${dev} · ${m[d.browser]}` : dev;
        },

        /** Fenêtre « Installer l'application » */
        open(os) {
            const d = this.detect();
            this._view = os || (this._view && !os ? this._view : d.os);
            const el = document.getElementById('install-body');
            if (!el) return;
            const tab = (k, l) => `<button class="${this._view === k ? 'active' : ''}" onclick="Install.open('${k}')">${l}</button>`;
            el.innerHTML = `
                <div class="seg" role="group" aria-label="Appareil">${tab('ios', '🍎 iPhone')}${tab('android', '🤖 Android')}${tab('desktop', '💻 PC / Mac')}</div>
                <div class="inst-device">${this._label(this._view, d)}${this._view === d.os ? ' <span class="inst-you">· cet appareil</span>' : ''}</div>
                ${this.body(this._view, d)}`;
            UI._open('install-modal');
        },
        close() { UI._close('install-modal'); },
        refresh() { if (document.getElementById('install-modal')?.classList.contains('active')) this.open(this._view); },

        async now() {
            await PWA.installApp();
            this.close();
        },
        async copyLink() {
            const url = location.href.split('#')[0].replace(/[?&]guide=1\b/, '');
            try { await navigator.clipboard.writeText(url); UI.showToast('📋 Lien copié — colle-le dans le navigateur', 'success'); }
            catch (e) { UI.showToast('Copie impossible : ' + url, 'warning'); }
        },
        toCloud() { this.close(); Onboarding._close(); setTimeout(() => Cloud.open('create'), 280); }
    };

    // =========================================================================
    // CONSEILS CONTEXTUELS — une petite bulle, une seule fois, au bon moment
    // =========================================================================
    const Hints = {
        KEY: 'sm_hints',
        TEXTS: {
            round:   { ic: '📋', t: 'Une erreur de saisie ? Touche une manche dans l\'<b>historique</b> pour la corriger.' },
            stats:   { ic: '👆', t: 'Touche un joueur pour sa <b>fiche détaillée</b> ; l\'onglet <b>⚔️ Duels</b> compare deux joueurs.' },
            victory: { ic: '📤', t: 'Partage la victoire en <b>image</b>, <b>GIF</b> ou <b>texte</b> avec les boutons de partage.' },
        },
        _seen() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { return {}; } },
        _mark(id) { try { const o = this._seen(); o[id] = 1; localStorage.setItem(this.KEY, JSON.stringify(o)); } catch (e) {} },
        /** Désactivé sous test automatisé (sauf ?hints=1) et pendant le guide. */
        _allowed() {
            if (document.getElementById('onboarding')) return false;
            if (navigator.webdriver && !/[?&]hints=1/.test(location.search)) return false;
            return true;
        },
        /** Affiche le conseil `id` après `delay` ms, s'il n'a jamais été vu. */
        show(id, delay = 0) {
            const h = this.TEXTS[id];
            if (!h || this._seen()[id]) return;
            setTimeout(() => {
                if (this._seen()[id] || !this._allowed()) return;
                this._mark(id);
                this.hide();
                const el = document.createElement('div');
                el.id = 'hint'; el.className = 'hint'; el.setAttribute('role', 'status');
                el.innerHTML = `<span class="hint-ic" aria-hidden="true">${h.ic}</span><span class="hint-t">${h.t}</span><button aria-label="Fermer le conseil" onclick="Hints.hide()">✕</button>`;
                document.body.appendChild(el);
                requestAnimationFrame(() => el.classList.add('show'));
                this._timer = setTimeout(() => this.hide(), 9000);
            }, delay);
        },
        hide() {
            clearTimeout(this._timer);
            const el = document.getElementById('hint'); if (!el) return;
            el.classList.remove('show'); setTimeout(() => el.remove(), 250);
        },
        reset() {
            try { localStorage.removeItem(this.KEY); } catch (e) {}
            UI.showToast('💡 Les conseils réapparaîtront au fil de l\'utilisation', 'success');
        }
    };

    // =========================================================================
    // GUIDE DE PREMIÈRE CONNEXION (facultatif, repassable depuis les Paramètres)
    // =========================================================================
    const Onboarding = {
        KEY: 'sm_onboarded',
        _i: 0, _slides: [], _el: null, _touchX: null, _prevFocus: null,

        _isDone() { try { return localStorage.getItem(this.KEY) === '1'; } catch (e) { return true; } },
        _markDone() { try { localStorage.setItem(this.KEY, '1'); } catch (e) {} },

        /** Affiché seulement aux nouveaux venus (aucune partie, jamais vu). ?guide=1 force l'affichage. */
        maybeShow() {
            const force = /[?&]guide=1\b/.test(location.search);
            if (!force) {
                if (navigator.webdriver || this._isDone()) return;
                const hasData = Storage.loadGames().length > 0 || !!localStorage.getItem(Storage.CURRENT_KEY);
                if (hasData) return;
            }
            setTimeout(() => {
                if (document.querySelector('.modal-overlay.active, .victory-overlay.active')) return;
                this.open();
            }, 700);
        },

        _standalone() { return !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true); },
        _ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },

        _build() {
            const S = [];
            if (!this._standalone()) {
                S.push({ ic: '📲', t: "Installe l'appli", next: 'Pas maintenant →', html: `
                    <p><b>Facultatif</b>, mais plus pratique :</p>
                    <div class="ob-perks"><span>⚡ Icône d'accueil</span><span>🖥️ Plein écran</span><span>📵 Hors-ligne</span></div>
                    ${Install.body(Install.detect().os, null, true)}
                    <button class="ob-link" onclick="Install.open()">Autre appareil ?</button>` });
            }
            S.push({ ic: '🎴', t: 'Bienvenue sur ScoreMaster', html: `
                <p>Le carnet de scores de vos soirées jeux : Belote, Uno, Skyjo, Tarot, Rami…</p>
                <ul class="ob-list">
                    <li>🎮 Un jeu <b>prédéfini</b> (règles et fin de partie réglées) ou une partie <b>libre</b> ; les derniers joueurs sont proposés</li>
                    <li>🃏 La <b>Belote</b> a son mode : équipes NOUS / EUX, capot, belote…</li>
                    <li>📵 <b>Sans internet</b> ; tes parties restent sur ton appareil</li>
                    <li>💡 De petites <b>astuces</b> s'afficheront au bon moment, une seule fois</li>
                </ul>` });
            S.push({ ic: '✍️', t: 'Saisis les scores', onShow: () => this._demo(), html: `
                <div class="ob-demo" id="ob-demo" aria-hidden="true"></div>
                <ul class="ob-list">
                    <li>👆 Touche un joueur : le <b>pavé</b> s'ouvre ; <b>Suivant</b> passe au joueur sans score</li>
                    <li>✅ Tout est rempli ? <b>OK</b> ferme le pavé, puis bouton vert <b>ENREGISTRER</b></li>
                    <li>✏️ Une erreur ? Touche la manche dans l'<b>historique</b> pour la corriger ; supprimée par erreur ? <b>Rétablir</b></li>
                </ul>` });
            S.push({ ic: '👀', t: "Garde l'œil sur la partie", html: `
                <ul class="ob-list">
                    <li>☰ Bouton en haut : bascule entre <b>cartes</b> et <b>liste</b> pour voir plus de joueurs sans défiler</li>
                    <li>📈 Le <b>graphique</b> est réduit pour gagner de la place : <b>touche-le</b> pour l'agrandir (⤢), re-touche pour le réduire</li>
                    <li>🥇 Le <b>rang</b> de chaque joueur est dans le coin de sa carte</li>
                    <li>🧘 <b>Mode Zen</b> : scores en grand, écran allumé</li>
                </ul>` });
            S.push({ ic: '📊', t: 'Stats, duels et partage', html: `
                <ul class="ob-list">
                    <li>🏆 <b>Classement</b> par jeu et par période, fiche de chaque joueur</li>
                    <li>⚔️ <b>Duels</b> et 🔥 <b>records</b> : qui gagne le plus souvent contre qui</li>
                    <li>📤 Partage la victoire en <b>image</b>, <b>GIF</b> ou <b>texte</b></li>
                    <li>🔁 <b>Revanche</b> avec les mêmes joueurs : le compteur de série continue</li>
                </ul>` });
            S.push({ ic: '🎨', t: 'Fais-le à ton image', html: `
                <p>Choisis maintenant, tu pourras changer dans <b>Paramètres → Apparence</b> (avec une palette <b>Perso</b>).</p>
                <div class="seg" id="ob-mode" role="group" aria-label="Mode">
                    <button data-mode="auto">🌓 Auto</button><button data-mode="light">☀️ Clair</button><button data-mode="dark">🌙 Sombre</button>
                </div>
                <div class="ob-pal" id="ob-pal"></div>`, onShow: () => this._renderLook() });
            S.push({ ic: '☁️', t: 'Sauvegarde ton profil', cloud: true, html: `
                <p><b>Facultatif.</b> Un pseudo et une couleur suffisent, sans mot de passe ni e-mail.</p>
                <ul class="ob-list">
                    <li>📱 Tu changes de téléphone ? <b>Retrouve tes parties</b> avec ton profil</li>
                    <li>🔄 Plusieurs appareils : tes parties se <b>synchronisent</b></li>
                    <li>🛡️ Sauvegarde <b>automatique</b> ; tu vois ce qui est partagé avant de valider</li>
                </ul>` });
            return S;
        },

        /** Mini-démo animée de la saisie des scores (boucle ; image fixe si mouvement réduit). */
        _demo() {
            const el = document.getElementById('ob-demo'); if (!el) return;
            const P = [['ALICE', 30, 12], ['BOB', 25, 20], ['CHLOÉ', 18, 5]];
            const frame = f => {
                const done = [f >= 2, f >= 3, f >= 4];
                const active = f === 1 ? 0 : f === 2 ? 1 : f === 3 ? 2 : -1;
                const tot = P.map((q, i) => q[1] + (done[i] ? q[2] : 0));
                const lead = done[1] ? 1 : done[0] ? 0 : -1;
                const chips = P.map((q, i) => {
                    const v = done[i] ? q[2] : (active === i ? q[2] : '–');
                    const t = done[i] ? `→ ${tot[i]}${i === lead && f >= 2 ? ' ↑' : ''}` : '&nbsp;';
                    return `<div class="ob-chip${active === i ? ' on' : ''}${done[i] ? ' done' : ''}"><small>${q[0]}</small><b>${v}</b><i>${t}</i></div>`;
                }).join('');
                const cap = ['👆 Touche un joueur', '⌨️ Tape le score, puis <b>Suivant</b>', '➡️ Joueur suivant…', '➡️ Dernier joueur : <b>OK</b>', '✅ Tout est rempli', '💾 Puis <b>ENREGISTRER</b>'][f];
                el.innerHTML = `<div class="ob-mock">${chips}</div><div class="ob-cap">${cap}</div><div class="ob-fakebtn${f >= 4 ? ' ready' : ''}">ENREGISTRER LA MANCHE</div>`;
            };
            clearInterval(this._t);
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return frame(5);
            let f = 0; frame(0);
            this._t = setInterval(() => { if (!document.getElementById('ob-demo')) return clearInterval(this._t); f = (f + 1) % 6; frame(f); }, 1300);
        },

        _renderLook() {
            const mode = app.getThemeMode(), pal = app.getPalette();
            document.querySelectorAll('#ob-mode button').forEach(b => {
                b.classList.toggle('active', b.dataset.mode === mode);
                b.onclick = () => { app.setThemeMode(b.dataset.mode); this._renderLook(); };
            });
            const box = document.getElementById('ob-pal');
            if (!box) return;
            box.innerHTML = '';
            Object.entries(app.PALETTES).filter(([id]) => id !== 'custom').forEach(([id, d]) => {
                const b = document.createElement('button');
                b.className = 'palette-btn' + (id === pal ? ' active' : '');
                b.setAttribute('aria-pressed', String(id === pal));
                b.innerHTML = `<span class="sw" style="background:linear-gradient(135deg, ${d.c[0]} 50%, ${d.c[1]} 50%)"></span>${d.name}`;
                b.onclick = () => { app.setPalette(id); this._renderLook(); };
                box.appendChild(b);
            });
        },

        open() {
            if (this._el) return;
            UI._close('settings-modal');
            this._slides = this._build(); this._i = 0;
            this._prevFocus = document.activeElement;
            const el = document.createElement('div');
            el.id = 'onboarding'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Guide de démarrage');
            el.innerHTML = `
                <div class="ob-card">
                    <button class="ob-skip" onclick="Onboarding.skip()" aria-label="Passer le guide">Passer ✕</button>
                    <div class="ob-body" id="ob-body" aria-live="polite"></div>
                    <div class="ob-dots" id="ob-dots" aria-hidden="true"></div>
                    <div class="ob-actions" id="ob-actions"></div>
                </div>`;
            document.body.appendChild(el);
            this._el = el;
            el.addEventListener('touchstart', e => { this._touchX = e.touches[0].clientX; }, { passive: true });
            el.addEventListener('touchend', e => {
                if (this._touchX === null) return;
                const dx = e.changedTouches[0].clientX - this._touchX; this._touchX = null;
                if (Math.abs(dx) > 60) this.go(dx < 0 ? 1 : -1);
            }, { passive: true });
            this._keys = e => {
                if (e.key === 'Escape') this.skip();
                else if (e.key === 'ArrowRight') this.go(1);
                else if (e.key === 'ArrowLeft') this.go(-1);
            };
            document.addEventListener('keydown', this._keys);
            requestAnimationFrame(() => el.classList.add('show'));
            this._render();
        },

        _render() {
            clearInterval(this._t);
            const s = this._slides[this._i], last = this._i === this._slides.length - 1;
            document.getElementById('ob-body').innerHTML = `<div class="ob-ic" aria-hidden="true">${s.ic}</div><h2 class="ob-title">${s.t}</h2><div class="ob-text">${s.html}</div>`;
            document.getElementById('ob-dots').innerHTML = this._slides.map((_, k) => `<i class="${k === this._i ? 'on' : ''}"></i>`).join('');
            const A = document.getElementById('ob-actions');
            if (s.cloud) {
                A.innerHTML = `<button class="btn-main ob-primary" onclick="Onboarding.cloud('create')">☁️ Créer mon profil</button>
                    <button class="ob-secondary" onclick="Onboarding.cloud('enter')">J'ai déjà un profil</button>
                    <button class="ob-link" onclick="Onboarding.finish(true)">Plus tard — commencer</button>`;
            } else {
                A.innerHTML = `<div class="ob-row">${this._i > 0 ? '<button class="ob-secondary" onclick="Onboarding.go(-1)">← Retour</button>' : '<span></span>'}
                    <button class="btn-main ob-primary" onclick="Onboarding.go(1)">${last ? 'C\'est parti !' : (s.next || 'Suivant →')}</button></div>`;
            }
            if (s.onShow) s.onShow();
            A.querySelector('.ob-primary')?.focus({ preventScroll: true });
        },

        go(d) {
            const n = this._i + d;
            if (n < 0) return;
            if (n >= this._slides.length) return this.finish(false);
            this._i = n; SoundFX.click(); this._render();
        },

        _close() {
            if (!this._el) return;
            document.removeEventListener('keydown', this._keys);
            clearInterval(this._t);
            const el = this._el; this._el = null;
            el.classList.remove('show');
            setTimeout(() => el.remove(), 250);
            this._markDone();
            try { this._prevFocus?.focus?.({ preventScroll: true }); } catch (e) {}
        },
        skip() { this._close(); },
        /** « Plus tard » sur l'étape cloud : on ne relance pas l'invitation juste après la 1re partie. */
        finish(snoozeCloud) {
            if (snoozeCloud && Cloud.enabled) { const s = Cloud.load(); if (!s.consent) { s.snoozeUntil = Date.now() + Cloud.SNOOZE_MS; Cloud.save(); } }
            this._close();
        },
        cloud(mode) {
            this._close();
            setTimeout(() => Cloud.open(mode), 280);
        }
    };

