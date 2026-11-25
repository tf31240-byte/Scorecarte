/* Graphique plein écran : grande courbe, légende cliquable (noms + scores), Total / Par manche, ligne de limite. */
const ChartFull = {
    chart: null, mode: 'total', hidden: new Set(),

    open() {
        if (!app.currentGame) return;
        this.hidden = new Set();
        UI._open('chart-full');
        document.body.classList.add('chart-full-open');
        this._buildUI();
        // laisse le temps au volet de s'afficher pour que le canvas ait sa vraie taille
        setTimeout(() => this.render(), 60);
    },
    close() {
        this._destroy();
        UI._close('chart-full');
        document.body.classList.remove('chart-full-open');
    },
    _destroy() { if (this.chart) { try { this.chart.destroy(); } catch (e) {} this.chart = null; } },

    setMode(m) {
        this.mode = m;
        document.querySelectorAll('#chart-full-mode button').forEach(b => {
            const on = b.dataset.mode === m; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
        });
        this.render();
    },
    toggle(id) {
        id = String(id);
        this.hidden.has(id) ? this.hidden.delete(id) : this.hidden.add(id);
        this._buildUI(); this.render();
    },

    _state() { return app.currentGame.state; },

    /** Légende : un bouton par joueur (couleur, nom, score), classé comme dans la partie. */
    _buildUI() {
        const g = app.currentGame, st = g.state;
        const sorted = GameState.getSortedPlayers(st);
        const total = p => st.history.reduce((s, h) => s + (h[p.id] || 0), 0);
        const box = document.getElementById('chart-full-legend');
        box.innerHTML = sorted.map(p => {
            const off = this.hidden.has(String(p.id));
            return `<button class="cf-chip${off ? ' off' : ''}" aria-pressed="${!off}" onclick="ChartFull.toggle('${String(p.id).replace(/[^\w-]/g, '')}')" style="--c:${escapeHtml(p.color)}">
                <i class="cf-dot"></i><span class="cf-name">${escapeHtml(p.name)}</span><b class="cf-score">${total(p)}</b></button>`;
        }).join('');
        const t = document.getElementById('chart-full-title');
        if (t) t.textContent = g.name || 'Évolution';
    },

    render() {
        const cv = document.getElementById('chart-full-canvas');
        const empty = document.getElementById('chart-full-empty');
        if (!cv) return;
        const g = app.currentGame; if (!g) return;
        const st = g.state, rounds = st.history.length, isTotal = this.mode === 'total';
        if (typeof Chart === 'undefined') { empty.textContent = 'Le graphique se charge… réessaie dans un instant.'; empty.hidden = false; return; }
        empty.hidden = rounds > 0; empty.textContent = 'Le graphique apparaît après la première manche.';
        cv.style.visibility = rounds > 0 ? 'visible' : 'hidden';
        this._destroy();
        if (!rounds) return;

        const cs = getComputedStyle(document.body);
        const txt = (cs.getPropertyValue('--text-sec') || '#86868B').trim();
        const labels = isTotal ? ['0', ...st.history.map((_, i) => 'M' + (i + 1))] : st.history.map((_, i) => 'M' + (i + 1));
        const datasets = st.players.map(p => {
            let c = 0;
            const data = isTotal ? [0, ...st.history.map(h => (c += (h[p.id] || 0)))] : st.history.map(h => h[p.id] || 0);
            return { label: p.name, data, borderColor: p.color, backgroundColor: p.color, borderWidth: 3, tension: isTotal ? 0.25 : 0,
                pointRadius: rounds > 15 ? 2 : 4, pointHoverRadius: 7, hidden: this.hidden.has(String(p.id)) };
        });
        const ec = g.endCondition, limit = (isTotal && ec && ec.type === END_SCORE && ec.value) ? ec.value : null;
        const limitPlugin = {
            id: 'limitLine',
            afterDatasetsDraw(ch) {
                if (limit == null) return;
                const { ctx, chartArea: a, scales: { y } } = ch; if (limit < y.min || limit > y.max) return;
                const py = y.getPixelForValue(limit);
                ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke(); ctx.setLineDash([]);
                ctx.fillStyle = '#ef4444'; ctx.font = '800 11px -apple-system, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
                ctx.fillText((g.victoryCondition === VC_LOWEST ? 'Limite ' : 'Objectif ') + limit, a.right - 4, py - 3); ctx.restore();
            }
        };
        this.chart = new Chart(cv, {
            type: 'line', data: { labels, datasets }, plugins: [limitPlugin],
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { top: 14, right: 14, left: 2, bottom: 2 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)', padding: 12, itemSort: (a, b) => b.parsed.y - a.parsed.y,
                        titleFont: { size: 14, weight: '800' }, bodyFont: { size: 13, weight: '600' }, boxPadding: 4, usePointStyle: true,
                        callbacks: {
                            label: it => {
                                const i = it.dataIndex, d = it.dataset.data;
                                const delta = isTotal && i > 0 ? ` (${d[i] - d[i - 1] >= 0 ? '+' : ''}${d[i] - d[i - 1]})` : '';
                                return ` ${it.dataset.label} : ${it.parsed.y}${delta}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: txt, font: { size: 12, weight: '700' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
                    y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.18)' }, ticks: { color: txt, font: { size: 12, weight: '700' }, maxTicksLimit: 8, precision: 0 } }
                }
            }
        });
    }
};
