    // ==================== UI LAYER AMÉLIORÉ ====================
    const UI = {
        currentStatsMode: 'all',
        currentRecordsMode: 'all',
        
        // === INDICATEUR DE CHARGEMENT ===


        // --- Helpers modaux ---
        /** Ouvre un modal par son ID. */
        /**
         * Crée un élément HTML avec une classe CSS et un innerHTML optionnel.
         * @param {string} tag  Tag HTML (ex: 'div')
         * @param {string} cls  className de l'élément
         * @param {string} html innerHTML optionnel
         */
        _makeEl(tag, cls, html = '') {
            const el = document.createElement(tag);
            el.className = cls;
            if (html) el.innerHTML = html;
            return el;
        },

        _open(id)  {
            const el = document.getElementById(id); if (!el) return;
            if (!el.classList.contains('active') && !this._opener) this._opener = document.activeElement;
            el.classList.add('active');
            const box = el.querySelector('.modal-box') || el;
            box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
            const h = box.querySelector('h1,h2,h3'); if (h && !box.hasAttribute('aria-label')) box.setAttribute('aria-label', h.textContent.trim());
            // Le focus passe dans la fenêtre (sauf si un champ est déjà actif)
            setTimeout(() => { if (!el.contains(document.activeElement)) { box.setAttribute('tabindex', '-1'); box.focus({ preventScroll: true }); } }, 60);
        },
        /** Ferme un modal par son ID. */
        _close(id) {
            document.getElementById(id)?.classList.remove('active');
            if (!document.querySelector('.modal-overlay.active')) {
                const o = this._opener; this._opener = null;
                try { if (o && document.contains(o) && o.focus) o.focus({ preventScroll: true }); } catch (e) {}
            }
        },
        /** Échap : ferme la fenêtre ouverte la plus haute (via son propre bouton de fermeture si possible). */
        _escapeTopModal() {
            const all = [...document.querySelectorAll('.modal-overlay.active')]; if (!all.length) return false;
            const top = all[all.length - 1];
            const btn = [...top.querySelectorAll('button')].find(b => /clos|cancel|ferm/i.test(b.getAttribute('onclick') || '') || /Fermer/i.test(b.getAttribute('aria-label') || ''));
            if (btn) btn.click(); else this._close(top.id);
            return true;
        },
        /** Rend visible un élément en retirant la classe 'hidden'. */
        _show(id)  { document.getElementById(id)?.classList.remove('hidden'); },
        /** Masque un élément en ajoutant la classe 'hidden'. */
        _hide(id)  { document.getElementById(id)?.classList.add('hidden'); },

        // --- Loading & Toasts ---
        /**
         * Affiche l'overlay de chargement avec un message.
         * @param {string} [message]
         */
        /** @private Éléments de l'overlay de chargement (récupérés à la demande). */
        _loadingEl() {
            return {
                overlay:  document.getElementById('loading-overlay'),
                text:     document.getElementById('loading-text'),
                progress: document.getElementById('loading-progress'),
            };
        },

        showLoading(message = 'Génération en cours...') {
            const { overlay, text, progress } = this._loadingEl();
            if (!overlay) return;
            if (text) text.textContent = message;
            if (progress) progress.textContent = '';
            overlay.classList.add('active');
        },

        updateLoadingProgress(pct, message = null) {
            const { text, progress } = this._loadingEl();
            if (text && message) text.textContent = message;
            if (progress && pct !== null) progress.textContent = `${Math.round(pct)}%`;
        },

        hideLoading() {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('active');
        },
        
        /**
         * Affiche une notification toast.
         * @param {string} message
         * @param {'default'|'success'|'warning'|'error'|'info'} [type]
         */
        showToast(message, type = 'default') {
            const toast = document.getElementById('toast');
            clearTimeout(this._toastTimer);
            toast.textContent = message;
            toast.className = 'toast show';
            if(type !== 'default') toast.classList.add(type);
            this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
            if(type === 'success') SoundFX.success();
            else if(type === 'error') SoundFX.error();
        },
        /** Toast avec un bouton d'action (ex. « Rétablir »), visible plus longtemps. */
        showActionToast(message, label, onAction, ms = 6000) {
            const toast = document.getElementById('toast');
            clearTimeout(this._toastTimer);
            toast.textContent = '';
            const span = document.createElement('span'); span.textContent = message;
            const btn = document.createElement('button'); btn.className = 'toast-action'; btn.textContent = label;
            btn.onclick = () => { clearTimeout(this._toastTimer); toast.classList.remove('show'); onAction(); };
            toast.append(span, btn);
            toast.className = 'toast show info has-action';
            this._toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
            SoundFX.success();
        },
        confirm(message, onYes, onNo) {
            SoundFX.click();
            const modal = document.getElementById('confirm-modal');
            const msgEl = document.getElementById('confirm-msg');
            const yesBtn = document.getElementById('confirm-yes-btn');
            msgEl.textContent = message;
            modal.classList.add('active');
            
            // Stocker le callback onNo pour pouvoir l'appeler lors de l'annulation
            this._confirmOnNo = onNo || null;
            
            // Utiliser onclick (pas addEventListener) pour éviter l'accumulation de handlers
            yesBtn.onclick = () => {
                modal.classList.remove('active');
                this._confirmOnNo = null; // Nettoyer
                onYes();
            };
        },
        closeConfirm() {
            this._close('confirm-modal');
            // Appeler le callback onNo si défini (pour annulation)
            if (this._confirmOnNo) {
                this._confirmOnNo();
                this._confirmOnNo = null;
            }
        },
        

        // --- Modales (Stats / Paramètres) ---
        showStats() {
            SoundFX.click();
            this._open('stats-modal');
            this._applyStatsTab('rank');
            Hints.show('stats', 900);
        },
        closeStats() { this._close('stats-modal'); },
        showSettings() {
            SoundFX.click();
            this._open('settings-modal');
            this.updateSettingsUI();
        },
        closeSettings() { this._close('settings-modal'); },

        // --- Sauvegarde / Export ---
        showBackup() {
            SoundFX.click();
            this._close('settings-modal');
            this._open('backup-modal');
            this.renderBackup();
        },
        closeBackup() { this._close('backup-modal'); app._pendingImport = null; },

        _fmtDate(iso) {
            const d = new Date(iso);
            return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        },

        /** Met à jour le résumé, le statut de sauvegarde et la pastille d'alerte. */
        renderBackup() {
            const sum = app._dataSummary();
            const dot = document.getElementById('backup-dot');
            if (dot) dot.classList.toggle('visible', sum.stale);
            const body = document.getElementById('backup-summary');
            if (!body) return;
            document.getElementById('backup-import-preview')?.classList.add('hidden');
            document.getElementById('backup-main')?.classList.remove('hidden');
            let status, cls;
            if (!sum.games)              { status = 'Rien à sauvegarder pour le moment.'; cls = ''; }
            else if (sum.last === null)  { status = '⚠️ Jamais sauvegardé — vos données ne sont que sur cet appareil.'; cls = 'warn'; }
            else if (sum.stale)          { status = `⚠️ Dernière sauvegarde il y a ${sum.days} jours.`; cls = 'warn'; }
            else                         { status = `✅ Dernière sauvegarde : ${this._fmtDate(sum.last)}`; cls = 'ok'; }
            body.innerHTML =
                `<div class="backup-stats">
                    <div><b>${sum.games}</b><span>parties</span></div>
                    <div><b>${sum.finished}</b><span>terminées</span></div>
                    <div><b>${sum.players}</b><span>joueurs</span></div>
                 </div>
                 <div class="backup-status ${cls}">${escapeHtml(status)}</div>`;
        },

        /** Aperçu d'un fichier importé avant toute écriture. */
        showImportPreview(data) {
            const n = Array.isArray(data.games) ? data.games.length : 0;
            const local = Storage.loadGames();
            const ids = new Set(local.map(g => String(g.id)));
            const fresh = (data.games || []).filter(g => g && !ids.has(String(g.id))).length;
            const date = data.exportDate ? this._fmtDate(data.exportDate) : 'date inconnue';
            document.getElementById('backup-import-info').innerHTML =
                `<div class="backup-stats">
                    <div><b>${n}</b><span>parties dans le fichier</span></div>
                    <div><b>${fresh}</b><span>nouvelles pour cet appareil</span></div>
                 </div>
                 <div class="backup-status">Sauvegarde du ${escapeHtml(date)}</div>`;
            document.getElementById('backup-main').classList.add('hidden');
            document.getElementById('backup-import-preview').classList.remove('hidden');
            const mergeBtn = document.getElementById('backup-merge-btn');
            if (mergeBtn) mergeBtn.disabled = n === 0 || fresh === 0;
            this._open('backup-modal');
        },
        _renderAppearance() {
            const mode = app.getThemeMode(), pal = app.getPalette();
            document.querySelectorAll('#theme-mode button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
            const ed = document.getElementById('custom-editor');
            if (ed) {
                ed.classList.toggle('hidden', pal !== 'custom');
                const c = app.getCustom();
                const set = (id, v) => { const el = document.getElementById(id); if (el && el !== document.activeElement) el.value = v; };
                set('cp-primary', c.p); set('cp-accent', c.a);
                const t = document.getElementById('cp-tint'); if (t) t.checked = c.tint;
                const bind = (id, key) => { const el = document.getElementById(id); if (el) { el.oninput = el.onchange = () => app.setCustom({ [key]: el.type === 'checkbox' ? el.checked : el.value }); } };
                bind('cp-primary', 'p'); bind('cp-accent', 'a'); bind('cp-tint', 'tint');
            }
            const grid = document.getElementById('palette-grid');
            if (!grid) return;
            grid.innerHTML = '';
            Object.entries(app.PALETTES).forEach(([id, def]) => {
                const b = document.createElement('button');
                b.className = 'palette-btn' + (id === pal ? ' active' : '');
                b.setAttribute('aria-pressed', String(id === pal));
                b.onclick = () => app.setPalette(id);
                const cc = id === 'custom' ? [app.getCustom().p, app.getCustom().a] : def.c;
                b.innerHTML = `<span class="sw" style="background:linear-gradient(135deg, ${cc[0]} 50%, ${cc[1]} 50%)"></span>${id === 'custom' ? '🎨 ' : ''}${def.name}`;
                grid.appendChild(b);
            });
        },
        updateSettingsUI() {
            const theme    = document.documentElement.getAttribute('data-theme');
            const isDark   = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            const s        = app.settings;
            this._renderAppearance();
            { const ir = document.getElementById('install-row'); if (ir) ir.style.display = (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true) ? 'none' : ''; }
            [
                ['settings-sound-btn',     SoundFX.enabled],
                ['settings-vibration-btn', s.vibration],
                ['settings-confetti-btn',  s.confetti],
                ['settings-milestones-btn',s.milestones],
                ['settings-chart-btn',     s.showChart],
                ['settings-tempScore-btn', s.showTempScore],
            ].forEach(([id, val]) => {
                const b = document.getElementById(id); if (!b) return;
                b.classList.toggle('active', val);
                b.setAttribute('role', 'switch');
                b.setAttribute('aria-checked', String(!!val));
                const name = b.closest('.settings-row')?.querySelector('.settings-name')?.textContent.trim();
                if (name) b.setAttribute('aria-label', name);
            });
        },
        /** @private Masque tous les panneaux de stats puis affiche l'onglet sélectionné. */
        // =====================================================================
        // STATISTIQUES (UI)
        // =====================================================================
        statsFilter: { game: 'all', period: 'all' },
        _an: null,
        _statsTab: 'rank',
        _h2h: { a: null, b: null },

        _sd(t) {
            if (!t) return '';
            const d = new Date(t), y = d.getFullYear() !== new Date().getFullYear();
            return d.toLocaleDateString('fr-FR', y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
        },
        _ord(n) { return n === 1 ? '1er' : `${n}e`; },
        _dots(results, max = 5) {
            return `<span class="dots">${results.slice(-max).map(r =>
                `<i class="dot ${r.win ? 'w' : r.draw ? 'd' : 'l'}" title="${escapeHtml(r.game)} · ${this._sd(r.t)} · ${r.draw ? 'égalité' : this._ord(r.place) + '/' + r.n}">${r.win ? 'V' : r.draw ? '=' : r.place}</i>`).join('')}</span>`;
        },
        _analysis() { return (this._an = StatsEngine.analyze(this.statsFilter)); },

        _applyStatsTab(tab) {
            this._statsTab = tab;
            ['rank', 'h2h', 'records'].forEach(t => {
                document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
                UI._hide(`stats-content-${t}`);
            });
            UI._hide('stats-content-player');
            const an = this._analysis();
            this._renderStatsFilters(an);
            UI._show(`stats-content-${tab}`);
            if (tab === 'rank') this.renderRanking(an);
            else if (tab === 'h2h') this.renderH2H(an);
            else this.renderRecords(an);
        },
        switchStatsTab(tab) { SoundFX.click(); this._applyStatsTab(tab); },
        showRanking() { SoundFX.click(); this._applyStatsTab('rank'); },

        _renderStatsFilters(an) {
            const box = document.getElementById('stats-game-chips');
            if (box) {
                const total = an.gameNames.reduce((a, g) => a + g.count, 0);
                const chip = (key, label, n) => `<button class="chip ${this.statsFilter.game === key ? 'active' : ''}" data-key="${escapeHtml(key)}" onclick="UI.setStatsGame(this.dataset.key)">${escapeHtml(label)} <b>${n}</b></button>`;
                box.innerHTML = chip('all', 'Tous', total) + an.gameNames.map(g => chip(g.key, g.label, g.count)).join('');
            }
            const sel = document.getElementById('stats-period');
            if (sel) sel.value = this.statsFilter.period;
        },
        setStatsGame(key) {
            SoundFX.click();
            this.statsFilter.game = key;
            this._h2h = { a: null, b: null };
            this._applyStatsTab(this._statsTab);
        },
        setStatsPeriod(v) {
            this.statsFilter.period = v;
            this._h2h = { a: null, b: null };
            this._applyStatsTab(this._statsTab);
        },
        // Compat : ancien filtre par mode
        filterStats(mode) { this.statsFilter.game = 'all'; this._applyStatsTab(this._statsTab); },

        _empty(msg) { return `<p class="text-empty">${msg}</p>`; },

        // ---------- Classement ----------
        renderSummary(an) {
            const el = document.getElementById('stats-summary');
            if (!el) return;
            if (!an.games) { el.innerHTML = ''; return; }
            const s = an.summary;
            const tile = (v, l) => `<div class="s-tile"><div class="s-val">${v}</div><div class="s-lab">${l}</div></div>`;
            let extra = '';
            if (s.hot) extra += `<div class="s-line">🔥 <b>En forme :</b> ${escapeHtml(s.hot.name)} — ${s.hot.last5Wins} victoire${s.hot.last5Wins > 1 ? 's' : ''} sur ses ${s.hot.last5.length} dernières parties</div>`;
            if (s.last) extra += `<div class="s-line">🕒 <b>Dernière partie :</b> ${escapeHtml(s.last.name)} — ${s.last.draw ? 'égalité' : 'gagnée par ' + escapeHtml(s.last.winners.join(' & '))} <span class="muted">· ${this._sd(s.last.t)}</span></div>`;
            el.innerHTML = `<div class="s-tiles">${tile(s.games, 'parties')}${tile(s.rounds, 'manches')}${tile(s.people, 'joueurs')}</div>${extra}`;
        },

        _buildRankingRow(p, idx, rankNo) {
            const streak = p.currentStreak >= 3 ? '🔥' : p.currentStreak > 0 ? '⚡' : '';
            const el = UI._makeEl('div', `rank-item ${p.reliable ? 'rank-' + rankNo : 'rank-unr'}`);
            el.onclick = () => this.renderPlayerDetail(p.name);
            el.innerHTML = `
                <div class="rank-num">${p.reliable ? rankNo : '–'}</div>
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(p.name)} ${streak}${p.currentStreak > 0 ? p.currentStreak : ''}</div>
                    <div class="rank-sub">${p.played} partie${p.played > 1 ? 's' : ''} · ${p.wins} victoire${p.wins > 1 ? 's' : ''}${p.totalRounds && !p.mixed ? ` · moy. ${p.avgPerRound}/manche` : ''}</div>
                    ${this._dots(p.results)}
                </div>
                ${p.reliable
                    ? `<div class="rank-val" style="color:${p.winRate >= 50 ? 'var(--success)' : 'var(--text)'}">${p.winRate}%</div>`
                    : `<div class="rank-val small">${p.wins} V<div class="rank-hint">peu de parties</div></div>`}`;
            return el;
        },

        renderRanking(an) {
            an = an || this._analysis();
            this.renderSummary(an);
            const c = document.getElementById('ranking-list');
            c.innerHTML = '';
            if (!an.players.length) { c.innerHTML = this._empty('Aucune partie terminée pour ce filtre.'); return; }
            let rankNo = 0, sepDone = false;
            if (!an.reliableCount) c.insertAdjacentHTML('beforeend', `<p class="rank-note">Le pourcentage de victoires est affiché à partir de ${StatsEngine.MIN_RELIABLE} parties jouées.</p>`);
            an.players.forEach((p, i) => {
                if (!p.reliable && an.reliableCount && !sepDone) {
                    sepDone = true;
                    c.insertAdjacentHTML('beforeend', `<p class="rank-note">Moins de ${StatsEngine.MIN_RELIABLE} parties — pas encore classés</p>`);
                }
                if (p.reliable) rankNo++;
                c.appendChild(this._buildRankingRow(p, i, rankNo));
            });
        },

        // ---------- Fiche joueur ----------
        _spark(results) {
            const r = results.slice(-12);
            if (r.length < 2) return '';
            const W = 300, H = 64, px = 14, py = 10;
            const pts = r.map((x, i) => {
                const f = x.n > 1 ? (x.place - 1) / (x.n - 1) : 0;
                return [px + (i * (W - 2 * px)) / (r.length - 1), py + f * (H - 2 * py), x];
            });
            const line = pts.map(p => p.slice(0, 2).join(',')).join(' ');
            return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Classement dans les dernières parties">
                <polyline points="${line}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
                ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${p[2].win ? 'var(--success)' : 'var(--card)'}" stroke="var(--primary)" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}
            </svg><div class="spark-cap"><span>plus ancien</span><span>haut = 1er · bas = dernier</span><span>récent</span></div>`;
        },

        _roundTxt(r) { return r ? `${r.value} pts <span class="muted">· ${escapeHtml(r.game)}, ${this._sd(r.t)}</span>` : '—'; },

        renderPlayerDetail(name) {
            const an = this._an || this._analysis();
            const p = an.players.find(s => s.name === name);
            if (!p) return;
            ['rank', 'h2h', 'records'].forEach(t => UI._hide(`stats-content-${t}`));
            UI._show('stats-content-player');
            const row = (l, v) => `<div class="d-row"><span>${l}</span><span>${v}</span></div>`;
            const card = (t, rows) => `<div class="d-card"><h3 class="card-title">${t}</h3><div class="d-rows">${rows}</div></div>`;
            const streakColor = p.currentStreak >= 3 ? 'var(--danger)' : p.currentStreak > 0 ? 'var(--primary)' : 'var(--text)';
            const mixedTxt = '<span class="muted">voir « Par jeu »</span>';
            const l5 = p.last5;
            const form = l5.length ? `${p.last5Wins} victoire${p.last5Wins > 1 ? 's' : ''} sur ${l5.length}` : '—';

            // Par jeu
            const games = Object.entries(p.byGame).sort((a, b) => b[1].played - a[1].played);
            const byGame = games.length > 1 ? card('🎲 Par jeu', games.map(([g, v]) =>
                row(escapeHtml(g), `${v.played} partie${v.played > 1 ? 's' : ''} · ${v.wins} V <span class="muted">(${Math.round(v.wins / v.played * 100)}%)${v.rounds ? ` · moy. ${v.avg}/manche` : ''}</span>`)).join('')) : '';

            // Rivaux
            const riv = an.players.filter(o => o.name !== p.name).map(o => ({ o, h: StatsEngine.headToHead(an, p.name, o.name) }))
                .filter(x => x.h.aw + x.h.bw + x.h.ties > 0)
                .sort((a, b) => (b.h.aw + b.h.bw + b.h.ties) - (a.h.aw + a.h.bw + a.h.ties)).slice(0, 5);
            const rivals = riv.length ? `<div class="d-card"><h3 class="card-title">⚔️ Face à face</h3><div class="d-rows">${riv.map(x => {
                const c = x.h.aw > x.h.bw ? 'var(--success)' : x.h.aw < x.h.bw ? 'var(--danger)' : 'var(--text)';
                return `<div class="d-row link" data-a="${escapeHtml(p.name)}" data-b="${escapeHtml(x.o.name)}" onclick="UI.openH2H(this.dataset.a, this.dataset.b)"><span>vs ${escapeHtml(x.o.name)}</span><span style="color:${c};font-weight:900">${x.h.aw} – ${x.h.bw}${x.h.ties ? ` <span class="muted">(${x.h.ties} égalité${x.h.ties > 1 ? 's' : ''})</span>` : ''} ›</span></div>`;
            }).join('')}</div></div>` : '';

            document.getElementById('player-detail-content').innerHTML = `
                <h2 class="text-huge" style="margin:0 0 6px 0;">${escapeHtml(p.name)}</h2>
                <div class="muted" style="margin-bottom:14px">${p.played} partie${p.played > 1 ? 's' : ''} jouée${p.played > 1 ? 's' : ''}${an.games ? ' · filtre actuel' : ''}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:6px;">
                    <div class="stat-detail"><h4 class="kpi-label">TAUX DE VICTOIRE</h4>
                        <div class="value" style="font-size:32px; font-weight:900; color:var(--primary);">${p.reliable ? p.winRate + '%' : '—'}</div>
                        ${p.reliable ? '' : `<div class="muted" style="font-size:11px">dès ${StatsEngine.MIN_RELIABLE} parties</div>`}</div>
                    <div class="stat-detail"><h4 class="kpi-label">SÉRIE ACTUELLE</h4>
                        <div class="value" style="font-size:32px; font-weight:900; color:${streakColor};">${p.currentStreak > 0 ? '🔥 ' : ''}${p.currentStreak}</div></div>
                </div>
                <div class="d-card"><h3 class="card-title">🕒 Dernières parties</h3>
                    ${this._dots(p.results, 10)}
                    ${this._spark(p.results)}</div>
                ${card('📊 Statistiques',
                    row('Forme récente', form) +
                    row('Score moyen / manche', p.mixed ? mixedTxt : p.totalRounds ? `${p.avgPerRound} pts` : '—') +
                    row('Régularité', p.mixed ? mixedTxt : p.totalRounds >= 5 ? `±${p.std} pts / manche` : '—') +
                    row('Meilleure manche', p.mixed ? mixedTxt : this._roundTxt(p.bestRound)) +
                    row('Manche la plus faible', p.mixed ? mixedTxt : this._roundTxt(p.worstRound)) +
                    row('Meilleure série', `🏅 ${p.bestStreak} victoire${p.bestStreak > 1 ? 's' : ''}`))}
                ${card('🎮 Historique',
                    row('Victoires', `<span style="color:var(--success-text)">${p.wins} 🏆</span>`) +
                    (p.draws ? row('Égalités', p.draws) : '') +
                    row('Parties jouées', p.played) +
                    row('Manches jouées', p.totalRounds))}
                ${byGame}${rivals}`;
        },

        // ---------- Face à face ----------
        openH2H(a, b) { this._h2h = { a, b }; SoundFX.click(); this._applyStatsTab('h2h'); },
        setH2H(side, v) { this._h2h[side] = v; this.renderH2H(this._an || this._analysis()); },
        renderH2H(an) {
            an = an || this._analysis();
            const box = document.getElementById('h2h-content');
            if (!an.players.length || an.players.length < 2) { box.innerHTML = this._empty('Il faut au moins deux joueurs ayant joué ensemble.'); return; }
            const names = an.players.map(p => p.name);
            if (!names.includes(this._h2h.a)) this._h2h.a = names[0];
            if (!names.includes(this._h2h.b) || this._h2h.b === this._h2h.a) this._h2h.b = names.find(n => n !== this._h2h.a);
            const { a, b } = this._h2h;
            const opt = sel => names.map(n => `<option value="${escapeHtml(n)}" ${n === sel ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
            const h = StatsEngine.headToHead(an, a, b), tot = h.aw + h.bw + h.ties;
            const pc = v => tot ? (v / tot * 100) : 0;
            const lead = h.aw === h.bw ? 'Égalité parfaite' : `${escapeHtml(h.aw > h.bw ? a : b)} mène`;
            const jn = n => escapeHtml(n);
            box.innerHTML = `
                <div class="h2h-pick">
                    <select aria-label="Joueur 1" onchange="UI.setH2H('a', this.value)">${opt(a)}</select>
                    <span class="vs">VS</span>
                    <select aria-label="Joueur 2" onchange="UI.setH2H('b', this.value)">${opt(b)}</select>
                </div>
                ${tot ? `
                <div class="h2h-score"><span class="${h.aw > h.bw ? 'lead' : ''}">${h.aw}</span><em>–</em><span class="${h.bw > h.aw ? 'lead' : ''}">${h.bw}</span></div>
                <div class="h2h-bar"><i style="width:${pc(h.aw)}%;background:var(--primary)"></i><i style="width:${pc(h.ties)}%;background:var(--border)"></i><i style="width:${pc(h.bw)}%;background:var(--accent)"></i></div>
                <div class="h2h-sub">${lead} · ${tot} partie${tot > 1 ? 's' : ''} ensemble${h.ties ? ` · ${h.ties} égalité${h.ties > 1 ? 's' : ''}` : ''}</div>
                <h3 class="card-title" style="margin-top:18px">Dernières parties ensemble</h3>
                <div class="h2h-list">${h.games.slice(-6).reverse().map(g => `
                    <div class="h2h-row"><span class="muted">${this._sd(g.t)} · ${escapeHtml(g.game)}</span>
                    <span><b class="${g.res === 'a' ? 'win' : ''}">${jn(a)} ${g.at}</b> · <b class="${g.res === 'b' ? 'win' : ''}">${jn(b)} ${g.bt}</b></span></div>`).join('')}</div>`
                : this._empty(`${jn(a)} et ${jn(b)} n'ont pas encore joué ensemble${this.statsFilter.game !== 'all' || this.statsFilter.period !== 'all' ? ' (avec ce filtre)' : ''}.`)}`;
        },

        // ---------- Records ----------
        renderRecords(an) {
            an = an || this._analysis();
            const list = document.getElementById('records-list');
            if (!list) return;
            if (!an.games) { list.innerHTML = this._empty('Aucun record pour ce filtre.'); return; }
            const A = an.anecdotes, card = (icon, label, text, sub) => `
                <div class="rec-card"><div class="rec-ic">${icon}</div><div class="rec-body"><div class="rec-lab">${label}</div><div class="rec-txt">${text}</div>${sub ? `<div class="rec-sub">${sub}</div>` : ''}</div></div>`;
            const where = x => `${escapeHtml(x.game)} · ${this._sd(x.t)}`;
            const cards = [];
            if (A.comeback) cards.push(card('⚡', 'Plus grosse remontée', `${escapeHtml(A.comeback.name)} : ${this._ord(A.comeback.from)} → ${this._ord(A.comeback.to)}`, where(A.comeback)));
            if (A.tight) cards.push(card('🤏', 'Partie la plus serrée', A.tight.gap === 0 ? `Égalité ${escapeHtml(A.tight.a.key)} / ${escapeHtml(A.tight.b.key)} (${A.tight.a.total})` : `${escapeHtml(A.tight.a.key)} ${A.tight.a.total} – ${A.tight.b.total} ${escapeHtml(A.tight.b.key)}`, `${A.tight.gap === 0 ? 'Égalité parfaite' : A.tight.gap + ' pt' + (A.tight.gap > 1 ? 's' : '') + ' d\'écart'} · ${where(A.tight)}`));
            if (A.wide && A.wide.gap > 0 && A.wide !== A.tight) cards.push(card('💥', 'Plus large victoire', `${escapeHtml(A.wide.a.key)} ${A.wide.a.total} – ${A.wide.b.total} ${escapeHtml(A.wide.b.key)}`, `${A.wide.gap} pts d'écart · ${where(A.wide)}`));
            an.perGame.forEach(g => { if (g.big && g.big.value > 0) cards.push(card('🔥', `Plus grosse manche · ${escapeHtml(g.game)}`, `${escapeHtml(g.big.name)} : ${g.big.value} pts (M${g.big.round})`, `${this._sd(g.big.t)}${g.isLowest ? ' · jeu où le plus bas gagne' : ''}`)); });
            if (A.long) cards.push(card('🏃', 'Partie la plus longue', `${A.long.rounds} manche${A.long.rounds > 1 ? 's' : ''}`, where(A.long)));
            const P = an.players;
            const bestStreak = [...P].sort((a, b) => b.bestStreak - a.bestStreak)[0];
            if (bestStreak && bestStreak.bestStreak >= 2) cards.push(card('🏅', 'Meilleure série', `${escapeHtml(bestStreak.name)} : ${bestStreak.bestStreak} victoires d'affilée`));
            const reg = P.filter(p => p.reliable && p.totalRounds >= 10).sort((a, b) => a.std - b.std)[0];
            if (reg) cards.push(card('🎯', 'Plus régulier', escapeHtml(reg.name), `±${reg.std} pts / manche`));
            list.innerHTML = `<div class="rec-grid">${cards.join('')}</div>`
                + an.perGame.map(g => `<h3 class="card-title" style="margin-top:18px">🎯 Meilleurs scores · ${escapeHtml(g.game)}${g.isLowest ? ' <span class="muted">(le plus bas)</span>' : ''}</h3>`
                    + g.top.map((r, i) => `<div class="rank-item" style="cursor:default"><div class="rank-num">${i + 1}</div><div class="rank-info"><div class="rank-name">${escapeHtml(r.name)}</div><div class="rank-sub">${this._sd(r.t)}</div></div><div class="rank-val">${r.total}</div></div>`).join('')).join('');
        },

        // ---------- Partage ----------
        _shareText() {
            const an = this._an || this._analysis(), f = this.statsFilter;
            const sel = document.getElementById('stats-period');
            const scope = [f.game !== 'all' ? (an.gameNames.find(g => g.key === f.game)?.label || '') : '', f.period !== 'all' ? sel?.options[sel.selectedIndex]?.text : ''].filter(Boolean).join(' · ');
            const head = `📊 ScoreMaster${scope ? ' — ' + scope : ''}`;
            if (this._statsTab === 'h2h' && this._h2h.a && this._h2h.b) {
                const h = StatsEngine.headToHead(an, this._h2h.a, this._h2h.b);
                return `${head}\n⚔️ ${this._h2h.a} ${h.aw} – ${h.bw} ${this._h2h.b}${h.ties ? ` (${h.ties} égalité${h.ties > 1 ? 's' : ''})` : ''}`;
            }
            if (this._statsTab === 'records') {
                const A = an.anecdotes, L = [head];
                if (A.comeback) L.push(`⚡ Remontée : ${A.comeback.name} (${this._ord(A.comeback.from)} → ${this._ord(A.comeback.to)})`);
                if (A.tight) L.push(`🤏 Plus serrée : ${A.tight.a.key} ${A.tight.a.total} – ${A.tight.b.total} ${A.tight.b.key}`);
                an.perGame.forEach(g => { if (g.big && g.big.value > 0) L.push(`🔥 Plus grosse manche (${g.game}) : ${g.big.name} (${g.big.value} pts)`); });
                return L.join('\n');
            }
            const medals = ['🥇', '🥈', '🥉'];
            const lines = an.players.slice(0, 8).map((p, i) => `${p.reliable ? (medals[i] || `${i + 1}.`) : '•'} ${p.name} — ${p.wins} V / ${p.played}${p.reliable ? ` (${p.winRate}%)` : ''}`);
            return `${head}\n${an.summary.games} parties · ${an.summary.rounds} manches\n${lines.join('\n')}`;
        },
        async shareStats() {
            SoundFX.click();
            const text = this._shareText();
            try {
                if (navigator.share) { await navigator.share({ text }); return; }
            } catch (e) { if (e && e.name === 'AbortError') return; }
            try { await navigator.clipboard.writeText(text); UI.showToast('📋 Copié — prêt à coller', 'success'); }
            catch (e) { UI.showToast('Partage impossible sur cet appareil', 'warning'); }
        },

        // --- Rendus Partie (cartes scores / historique / graphe) ---

        // --- Score card helper ---

        /** Retourne le CSS class et l'emoji pour un badge de rang (0=🥇, 1=🥈, 2=🥉, N=#N+1). */
        _rankBadge(rankIdx) {
            return [
                { cls: 'badge-1', txt: '🥇' },
                { cls: 'badge-2', txt: '🥈' },
                { cls: 'badge-3', txt: '🥉' }
            ][rankIdx] ?? { cls: 'badge-none', txt: `#${rankIdx + 1}` };
        },


        /** Génère le innerHTML d'une carte joueur. */
        _scoreCardHtml(p, state, badgeClass, badgeText, rankChanges, totalScore, tempScore) {
            const tempDisplay = app.settings.showTempScore && tempScore
                ? `<div class="p-temp">${tempScore > 0 ? '+' + tempScore : tempScore}</div>`
                : '';
            const dealerIcon = state.dealerId === p.id
                ? '<div class="p-dealer" title="Distribue" aria-label="Donneur">🃏</div>'
                : '';
            return `
                <div class="rank-badge ${badgeClass} ${rankChanges.has(p.id) ? 'bounce' : ''}">${badgeText}</div>
                <div class="p-name-btn" style="color:${p.color}; border-color:${p.color}40" onclick="app.openModal(${p.id})">${escapeHtml(p.name)}</div>
                <div class="p-score ${String(totalScore).length >= 5 ? 'len5' : String(totalScore).length >= 4 ? 'len4' : ''} ${tempScore !== 0 ? 'score-bump' : ''}" onclick="app.openSheet(${p.id})">${totalScore}</div>
                ${tempDisplay}
                ${dealerIcon}
            `;
        },

        /**
         * Prépare les données et l'élément DOM d'une carte de score.
         * Calcule totalScore, tempScore, badge de rang et applique les classes CSS.
         */
        _prepareScoreCard(p, sorted, state, editIdx, getDisplayScore, rankChanges) {
            const totalScore     = getDisplayScore(p);
            const oldRoundValue  = editIdx !== null ? (state.history[editIdx]?.[p.id] || 0) : 0;
            const tempScore      = editIdx !== null
                ? (state.temp[p.id] || 0) - oldRoundValue
                : (state.temp[p.id] || 0);
            const rankIdx = sorted.findIndex(s => s.id === p.id);
            const { cls: badgeClass, txt: badgeText } = this._rankBadge(rankIdx);
            const card = document.createElement('div');
            card.className = `p-card ${state.dealerId === p.id ? 'is-dealer' : ''}`;
            card.style.setProperty('--pc', /^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : 'var(--primary)');
            if (rankChanges.has(p.id) && !app.focusMode) card.classList.add('rank-change');
            return { totalScore, tempScore, badgeClass, badgeText, card };
        },

        _buildScoreCard(p, sorted, state, editIdx, getDisplayScore, rankChanges) {
            const { totalScore, tempScore, badgeClass, badgeText, card } =
                this._prepareScoreCard(p, sorted, state, editIdx, getDisplayScore, rankChanges);

            card.innerHTML = this._scoreCardHtml(p, state, badgeClass, badgeText, rankChanges, totalScore, tempScore);
            return card;
        },


        /**
         * Détecte quels joueurs ont changé de rang depuis le dernier rendu.
         * Met à jour app.lastRanks en place.
         * @param {Array} players  Joueurs non triés
         * @param {Array} sorted   Joueurs dans l'ordre courant
         * @returns {Set<number>}  IDs des joueurs ayant changé de rang
         */
        _detectRankChanges(players, sorted) {
            app.lastRanks = app.lastRanks || {};
            const rankChanges = new Set();
            players.forEach(p => {
                const newRank = sorted.findIndex(s => s.id === p.id);
                if (app.lastRanks[p.id] !== undefined && app.lastRanks[p.id] !== newRank)
                    rankChanges.add(p.id);
                app.lastRanks[p.id] = newRank;
            });
            return rankChanges;
        },


        /**
         * Calcule le score d'affichage d'un joueur, tenant compte du mode édition.
         * - Mode édition : total - ancienne valeur + nouvelle valeur (ou ancienne si absente)
         * - Mode saisie  : total + valeur temporaire
         */
        _displayScore(p, state, editIdx) {
            if (editIdx !== null) {
                const oldVal = state.history[editIdx]?.[p.id] || 0;
                const newVal = state.temp[p.id] !== undefined ? state.temp[p.id] : oldVal;
                return p.total - oldVal + newVal;
            }
            return p.total + (state.temp[p.id] || 0);
        },

        renderScoreCards(state, editIdx = null) {
            const isLowest = app.currentGame.victoryCondition === VC_LOWEST;
            
            const getDisplayScore = p => this._displayScore(p, state, editIdx);
            
            // Toujours trier selon victoryCondition, même en mode Zen
            // Tiebreaker sur p.id pour un ordre déterministe à égalité (évite les cartes qui "sautent")
            const sorted = [...state.players].sort((a,b) => {
                const scoreA = getDisplayScore(a);
                const scoreB = getDisplayScore(b);
                const diff = isLowest ? scoreA - scoreB : scoreB - scoreA;
                return diff !== 0 ? diff : a.id - b.id;
            });
            const grid = document.getElementById('grid');
            const rankChanges = this._detectRankChanges(state.players, sorted);
            grid.innerHTML = '';
            this._applyView();
            sorted.forEach(p => grid.appendChild(this._buildScoreCard(p, sorted, state, editIdx, getDisplayScore, rankChanges)));
        },

        /** Construit un élément DOM de ligne d'historique de manche. */
        _buildHistoryRow(round, idx, isEditing, state) {
            const row = document.createElement('div');
            row.className = 'h-row';
            row.style.borderColor = isEditing ? 'var(--dealer)' : 'var(--border)';

            const scoresHtml = state.players.map(p => {
                const score = isEditing && state.temp[p.id] !== undefined
                    ? state.temp[p.id]
                    : (round[p.id] || 0);
                return `<div class="h-score-item">
                    <div style="font-size:9px; color:var(--text-sec); font-weight:800; letter-spacing:.2px">${escapeHtml(p.name.substring(0, 4))}</div>
                    <div style="color:${p.color}; font-weight:800; font-size:14px;">${score}</div>
                </div>`;
            }).join('');

            row.innerHTML = `
                <div class="h-idx">M${idx + 1}</div>
                <div class="h-scores" onclick="app.startEdit(${idx})">${scoresHtml}</div>
                <button class="h-del" onclick="app.delRound(${idx})" aria-label="Supprimer la manche">×</button>`;
            return row;
        },

        _histCollapsed() {
            try { return localStorage.getItem('sm_hist_collapsed') !== '0'; } catch (e) { return true; }
        },
        _applyHistoryState(n) {
            const collapsed = this._histCollapsed();
            const h = document.getElementById('history'), t = document.getElementById('history-toggle'), c = document.getElementById('history-count');
            if (h) h.classList.toggle('collapsed', collapsed);
            if (t) t.setAttribute('aria-expanded', String(!collapsed));
            if (c) c.textContent = n ? `(${n})` : '';
            if (!collapsed) { const l = document.getElementById('history-last'); if (l) l.innerHTML = ''; }
        },
        renderHistory(state, editIdx) {
            const hist = document.getElementById('history');
            hist.innerHTML = '';
            this._applyHistoryState(state.history.length);
            // Replié : on garde visible la dernière manche (cliquable pour la modifier)
            const last = document.getElementById('history-last');
            if (last) {
                last.innerHTML = '';
                const n = state.history.length;
                if (n && this._histCollapsed()) last.appendChild(this._buildHistoryRow(state.history[n - 1], n - 1, n - 1 === editIdx, state));
            }
            state.history.slice().reverse().forEach((r, i) => {
                const idx = state.history.length - 1 - i;
                const isEditing = idx === editIdx;
                hist.appendChild(this._buildHistoryRow(r, idx, isEditing, state));
            });
        },

        // --- Chart helpers (renderChart) ---

        // --- _buildChartData helpers ---

        /**
         * Calcule les bornes Y du graphe (avec padding 10 %, snap aux multiples de 50).
         * @param {number[]} allValues Tous les points de données
         * @returns {{ yMin, yMax, hasNegativeScores }}
         */
        _calcYBounds(allValues) {
            const minValue = Math.min(...allValues);
            const maxValue = Math.max(...allValues);
            const range = Math.max(maxValue - minValue, 1);
            // pas « rond » (1, 2, 2.5, 5 × 10ⁿ) pour ~4 graduations : l'échelle colle aux données
            const raw = range / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
            const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(v => v >= raw) || 10 * mag;
            const hasNegativeScores = minValue < 0;
            const yMin = hasNegativeScores ? Math.floor((minValue - range * 0.03) / step) * step : 0;
            const yMax = Math.max(Math.ceil((maxValue + range * 0.03) / step) * step, step);
            return { yMin, yMax, hasNegativeScores };
        },

        /**
         * Construit le dataset Chart.js pour un joueur.
         * Accumule les scores de l'historique et ajoute le point temp en attente si besoin.
         * @param {Object}   p             Joueur
         * @param {Object}   state         État de jeu
         * @param {number|null} editIdx    Manche en édition
         * @param {boolean}  hasPendingTemp  Un score temp est en attente
         * @param {number[]} allValues     Tableau partagé à pousser les valeurs dedans
         * @returns {Object} Dataset Chart.js
         */
        _buildPlayerDataset(p, state, editIdx, hasPendingTemp, allValues) {
            let cumul = 0;
            const data = [0];
            state.history.forEach((h, idx) => {
                cumul += (idx === editIdx && state.temp[p.id] !== undefined)
                    ? state.temp[p.id]
                    : (h[p.id] || 0);
                data.push(cumul);
                allValues.push(cumul);
            });
            if (hasPendingTemp) {
                const tempTotal = cumul + (state.temp[p.id] || 0);
                data.push(tempTotal);
                allValues.push(tempTotal);
            }
            return {
                label: p.name, data,
                borderColor: p.color, backgroundColor: p.color + '20',
                tension: 0.4, pointRadius: UI._chartOpen() ? 3 : 0, pointHoverRadius: UI._chartOpen() ? 6 : 0, borderWidth: 2.5, fill: false
            };
        },

        _buildChartData(state, editIdx) {
            let allValues = [0];
            const hasPendingTemp = Object.keys(state.temp).length > 0 && editIdx === null;

            const datasets = state.players.map(p => this._buildPlayerDataset(p, state, editIdx, hasPendingTemp, allValues));

            const labels = ['0', ...state.history.map((_, i) => `M${i + 1}`)];
            if (hasPendingTemp) labels.push('...');

            const { yMin, yMax, hasNegativeScores } = this._calcYBounds(allValues);

            return { datasets, labels, yMin, yMax, hasNegativeScores };
        },

        /**
         * Retourne la config Chart.js complète (type, data, options).
         */

        /** Retourne l'objet options Chart.js avec les axes et le tooltip configurés. */
        _chartOptions(yMin, yMax, hasNegativeScores) {
            return {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { right: 30, top: 6, left: UI._chartOpen() ? 0 : 26 } }, // compact : gouttière à gauche pour le bouton ⤢
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)', padding: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: UI._chartTicks('x', UI._chartOpen()) },
                    y: {
                        min: yMin, max: yMax, beginAtZero: !hasNegativeScores,
                        grid: { color: 'rgba(128,128,128,0.08)' },
                        ticks: UI._chartTicks('y', UI._chartOpen())
                    }
                },
                animation: { duration: 400 }
            };
        },

        /** Réglages des graduations : compactes (rares, petites) ou détaillées. */
        _chartTicks(axis, open) {
            const base = { display: true, color: '#86868B' };
            if (axis === 'x') return open
                ? { ...base, font: { size: 10, weight: '700' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
                : { ...base, font: { size: 9, weight: '700' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 };
            return open
                ? { ...base, font: { size: 10, weight: '600' }, maxTicksLimit: 5 }
                : { ...base, font: { size: 9, weight: '600' }, count: 2 }; // compact : seulement 0 et le maximum
        },

        /** Écrit le score actuel au bout de chaque courbe (couleur du joueur), sans chevauchement. */
        _endLabelsPlugin() {
            return {
                id: 'endLabels',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart; if (!chartArea) return;
                    const items = [];
                    chart.data.datasets.forEach((d, i) => {
                        const meta = chart.getDatasetMeta(i); if (meta.hidden || !meta.data.length) return;
                        const pt = meta.data[meta.data.length - 1]; if (!pt) return;
                        const v = d.data[d.data.length - 1];
                        items.push({ x: pt.x, y: pt.y, label: String(v), color: d.borderColor });
                    });
                    items.sort((a, b) => a.y - b.y);
                    const gap = 10;
                    ctx.save(); ctx.font = '800 10px -apple-system, system-ui, sans-serif'; ctx.textBaseline = 'middle';
                    let prev = -1e9;
                    items.forEach(it => {
                        let y = it.y; if (y - prev < gap) y = prev + gap; prev = y;
                        ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(it.x, it.y, 3, 0, 6.3); ctx.fill();
                        ctx.fillText(it.label, it.x + 6, y);
                    });
                    ctx.restore();
                }
            };
        },

        _buildChartConfig(labels, datasets, yMin, yMax, hasNegativeScores) {
            return {
                type: 'line',
                data: { labels, datasets },
                plugins: [this._endLabelsPlugin()],
                options: this._chartOptions(yMin, yMax, hasNegativeScores)
            };
        },


        /**
         * Met à jour le chart existant (sans animation) ou en crée un nouveau.
         * Stratégie d'optimisation : update() évite le recalcul complet.
         */
        _updateOrCreateChart(ctx, labels, datasets, yMin, yMax, hasNegativeScores) {
            if (app.chart) {
                app.chart.data.labels   = labels;
                app.chart.data.datasets = datasets;
                app.chart.options.scales.y.min = yMin;
                app.chart.options.scales.y.max = yMax;
                app.chart.options.scales.x.ticks = this._chartTicks('x', this._chartOpen());
                app.chart.options.scales.y.ticks = this._chartTicks('y', this._chartOpen());
                app.chart.update('none');
            } else {
                app.chart = new Chart(ctx, this._buildChartConfig(labels, datasets, yMin, yMax, hasNegativeScores));
            }
        },

        renderChart(state, editIdx) {
            const ctx = document.getElementById('chart');
            const chartBox = ctx?.closest('.chart-box');
            this._applyChartState(); // taille compacte / agrandie, même si la bibliothèque du graphique n'est pas chargée
            if(!ctx || typeof Chart === 'undefined') return;
            
            // Masquer le graphique si le paramètre est désactivé
            if (chartBox) {
                chartBox.style.display = app.settings.showChart ? '' : 'none';
            }
            if (!app.settings.showChart) return;
            
            const { datasets, labels, yMin, yMax, hasNegativeScores } = this._buildChartData(state, editIdx);
            
            this._updateOrCreateChart(ctx, labels, datasets, yMin, yMax, hasNegativeScores);
            this._applyChartState();
        },

        // --- Graphique compact / agrandi (tap) ---
        _chartOpen() { try { return localStorage.getItem('sm_chart_open') === '1'; } catch (e) { return false; } },
        _applyChartState() {
            const open = this._chartOpen();
            document.getElementById('chart-box')?.classList.toggle('open', open);
            const b = document.getElementById('chart-expand');
            if (b) { b.textContent = open ? '⤡' : '⤢'; b.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-label', open ? 'Réduire le graphique' : 'Agrandir le graphique'); }
            if (app.chart) {
                app.chart.options.layout.padding.left = open ? 0 : 26;
                app.chart.options.scales.x.ticks = this._chartTicks('x', open);
                app.chart.options.scales.y.ticks = this._chartTicks('y', open);
                app.chart.data.datasets.forEach(d => { d.pointRadius = open ? 3 : 0; d.pointHoverRadius = open ? 6 : 0; });
                app.chart.update('none');
                setTimeout(() => { try { app.chart.resize(); } catch (e) {} }, 380);
            }
        },
        toggleChart(e) {
            e?.stopPropagation();
            try { localStorage.setItem('sm_chart_open', this._chartOpen() ? '0' : '1'); } catch (err) {}
            SoundFX.click(); this._applyChartState();
        },
        chartTap(e) { if (!this._chartOpen()) this.toggleChart(e); },

        // --- Vue joueurs : cartes / liste ---
        _viewList() { try { return localStorage.getItem('sm_view') === 'list'; } catch (e) { return false; } },
        _applyView() {
            const list = this._viewList();
            document.getElementById('grid')?.classList.toggle('list', list);
            const b = document.getElementById('view-btn');
            if (b) { b.textContent = list ? '⊞' : '☰'; b.setAttribute('aria-label', list ? 'Affichage en cartes' : 'Affichage en liste'); }
        },
        toggleView() {
            try { localStorage.setItem('sm_view', this._viewList() ? 'grid' : 'list'); } catch (e) {}
            SoundFX.click(); this._applyView();
        },

        // --- Écran de Victoire ---
        switchVictoryTab(tab) {
            SoundFX.click();
            document.querySelectorAll('.victory-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('[id^="victory-tab-"]').forEach(t => t.classList.add('hidden'));
            const tabIndex = { podium: 1, stats: 2, highlights: 3 };
            document.querySelector(`.victory-tab:nth-child(${tabIndex[tab]})`).classList.add('active');
            UI._show(`victory-tab-${tab}`);
        },

        // --- Helpers privés (showVictory) ---

        /** Construit le podium (top 3) avec gestion des égalités. */

        /** Crée l'élément DOM d'un slot de podium (avatar + nom + score + barre médaille). */
        _buildPodiumPlace(p, realRank, isTied) {
            const medals = ['🥇', '🥈', '🥉'];
            const place = document.createElement('div');
            place.className = `podium-place p${realRank}`;
            place.innerHTML = `
                <div class="podium-avatar" style="background:${p.color}30; border:3px solid ${p.color};">
                    ${realRank === 1 ? '<div class="podium-crown">👑</div>' : ''}
                    ${isTied ? '<div style="position:absolute;top:-8px;right:-8px;font-size:12px;">🤝</div>' : ''}
                    <span style="color:${p.color}">${escapeHtml(p.name.substring(0, 2))}</span>
                </div>
                <div class="podium-name"  style="color:${p.color}">${escapeHtml(p.name)}${isTied ? ' 🤝' : ''}</div>
                <div class="podium-score" style="color:${p.color}">${p.total}</div>
                <div class="podium-bar">${medals[realRank - 1] || realRank}</div>
            `;
            return place;
        },

        _buildPodium(podiumEl, sorted) {
            const winningScore = sorted[0].total;
            const ties = sorted.filter(p => p.total === winningScore);
            if (ties.length > 1) {
                UI.showToast(`🤝 ÉGALITÉ ! ${ties.length} joueurs à ${winningScore} pts`, 'info');
            }
            [sorted[1], sorted[0], sorted[2]].filter(Boolean).forEach(p => {
                const realRank = sorted.findIndex(s => s.id === p.id || s.total === p.total) + 1;
                const isTied = ties.length > 1 && ties.some(t => t.id === p.id);
                podiumEl.appendChild(this._buildPodiumPlace(p, realRank, isTied));
            });
        },

        /** Construit l'onglet Stats avec classement détaillé. */
        _buildStatsTab(sorted, state, isLowest) {
            const container = document.getElementById('victory-all-players');
            container.innerHTML = '';
            const bestLabel = isLowest ? 'Pire' : 'Meilleur';
            sorted.forEach((p, idx) => {
                const stats = this.calculatePlayerGameStats(p, state);
                const row = document.createElement('div');
                row.className = 'player-stats-row';
                row.innerHTML = `
                    <div class="player-stats-rank" style="color:${idx < 3 ? p.color : 'var(--text-sec)'}">${idx+1}</div>
                    <div class="player-stats-info">
                        <div class="player-stats-name" style="color:${p.color}">${escapeHtml(p.name)}</div>
                        <div style="font-size:11px;color:var(--text-sec);">${bestLabel}: ${stats.best} • Moy: ${stats.avg} • Manches gagnées: ${stats.roundsWon}</div>
                    </div>
                    <div class="player-stats-score" style="color:${p.color}">${p.total}</div>
                `;
                container.appendChild(row);
            });
        },

        /** Construit l'onglet Highlights. */
        _buildHighlightsTab(state) {
            const highlights = StatsEngine.calculateGameHighlights(state, state.victoryCondition);
            const container = document.getElementById('victory-highlights');
            container.innerHTML = '';
            if (highlights.length === 0) {
                container.innerHTML = '<p class="text-empty">Aucun highlight.</p>';
                return;
            }
            highlights.forEach(h => {
                const card = document.createElement('div');
                card.className = 'highlight-card';
                card.innerHTML = `
                    <div class="highlight-icon">${h.icon}</div>
                    <div class="highlight-text">
                        <div class="highlight-label">${h.label}</div>
                        <div class="highlight-value" style="color:${h.color}">${h.value}</div>
                    </div>
                `;
                container.appendChild(card);
            });
        },

        showVictory(winner, score, state) {
            SoundFX.success();
            Hints.show('victory', 2500);
            Community.syncSoon();
            Cloud.backupSoon();
            const overlay = document.getElementById('victory');
            const isLowest = state.victoryCondition === VC_LOWEST;
            const sorted = GameState.getSortedPlayers(state);
            const podium = document.getElementById('podium');
            podium.innerHTML = '';
            
            this._buildPodium(podium, sorted);

            this._buildStatsTab(sorted, state, isLowest);

            this._buildHighlightsTab(state);
            const ser = document.getElementById('victory-series');
            const txt = (app.currentGame?.series?.n > 1) ? app._seriesText(true) : '';
            ser.textContent = txt ? `Revanche n°${app.currentGame.series.n} · ${txt}` : '';
            ser.classList.toggle('hidden', !txt);
            overlay.classList.add('active');
            this.switchVictoryTab('podium');
            if(app.settings.confetti) this.launchFireworks();
            vibrate([100, 50, 100, 50, 200]);
        },
        calculatePlayerGameStats(player, state) {
            const isLowest = state.victoryCondition === VC_LOWEST;
            const scores = state.history.map(r => r[player.id] || 0);
            const nonZero = scores.filter(s => s > 0);
            // Pour le meilleur score: si tous les scores sont négatifs, prendre le max (le moins négatif)
            const best = isLowest 
                ? Math.min(...scores.filter(s => s > 0), 0) 
                : (scores.length > 0 ? Math.max(...scores) : 0);
            const avg = nonZero.length > 0 ? Math.round(nonZero.reduce((a,b) => a+b, 0) / nonZero.length) : 0;
            let roundsWon = 0;
            state.history.forEach(round => {
                const roundScores = state.players.map(p => round[p.id] || 0);
                const targetScore = isLowest ? Math.min(...roundScores.filter(s => s > 0)) : Math.max(...roundScores);
                if(round[player.id] === targetScore && targetScore > 0) roundsWon++;
            });
            return { best, avg, roundsWon };
        },
        closeVictory() { this._close('victory'); },
        launchFireworks() {
            if (typeof confetti === 'undefined') return; // CDN non chargé (hors-ligne)
            const duration = 5000;
            const end = Date.now() + duration;
            const colors = PLAYER_COLORS.slice(0, 6);
            (function frame() {
                confetti({ particleCount:3, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: colors });
                confetti({ particleCount:3, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: colors });
                if (Date.now() < end) requestAnimationFrame(frame);
            })();
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: colors });
        },

        // --- launchMilestoneConfetti helpers ---

        /**
         * Retourne le texte toast du milestone atteint, ou chaîne vide si aucun.
         */
        _getMilestoneText(score, m200, m500, m1000) {
            if (score >= m1000) return `🎉 ${m1000} POINTS !`;
            if (score >= m500)  return `🎊 ${m500} POINTS !`;
            if (score >= m200)  return `✨ ${m200} POINTS !`;
            return '';
        },

        /**
         * Déclenche le pattern de vibration correspondant au milestone atteint.
         */
        _vibrateForMilestone(score, m500, m1000) {
            if      (score >= m1000) vibrate([50, 100, 50, 100, 50]);
            else if (score >= m500)  vibrate([50, 100, 50]);
            else                     vibrate(100);
        },

        launchMilestoneConfetti(score) {
            if (typeof confetti !== 'undefined') { // CDN non chargé (hors-ligne) → skip confetti
                const colors = PLAYER_COLORS.slice(0, 6);
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 }, colors: colors });
            }
            const [m200, m500, m1000] = MILESTONE_SCORES;
            const milestone = this._getMilestoneText(score, m200, m500, m1000);
            this._vibrateForMilestone(score, m500, m1000);
            if (milestone) this.showToast(milestone);
        }
    };

