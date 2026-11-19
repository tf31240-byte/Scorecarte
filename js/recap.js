    // ==================== PUNCHLINES ====================
    // Répliques contextuelles pour le récap : chaque situation détectée (égalité, remontada,
    // dernier qui a signé la meilleure manche…) apporte ses propres lignes ; le tirage est
    // déterministe (même partie = même réplique) sauf si l'utilisateur relance (roll).
    const Punchlines = {
        // Poids : une situation rare compte plus (ses lignes sont ajoutées plusieurs fois au tirage)
        SITUATIONS: [
            { id: 'tie', weight: 6, when: c => c.tie, lines: [
                '{w} et {s} : égalité parfaite. Le pire scénario pour les mauvais perdants.',
                '0 point d\'écart ! {w} et {s} se regardent en chiens de faïence.',
                'Égalité entre {w} et {s}. Quelqu\'un va réclamer une revanche, et vite.',
                'Personne ne gagne, tout le monde râle. Classique.',
                '{w} = {s}. Les mathématiques ont tranché : il faudra rejouer.',
                'Match nul entre {w} et {s}. Le canapé est neutre, la revanche ne le sera pas.',
                'Égalité : {w} et {s} ont tous les deux raison, c\'est insupportable.',
                'Ni vainqueur ni vaincu. Juste deux ego à calmer.'
            ]},
            { id: 'comeback', weight: 4, when: c => c.comeback, lines: [
                'Belle remontée de {w} ! {f} menait, mais ça, c\'était avant.',
                '{f} a mené la danse… jusqu\'à ce que {w} change la musique.',
                'Remontada : {w} était derrière, {w} est devant. Les autres regardent le plafond.',
                '{w} a laissé les autres y croire. Puis il a tout repris.',
                'Comme quoi, ce n\'est jamais fini tant que {w} n\'a pas fini de jouer.'
            ]},
            { id: 'chaos', weight: 4, when: c => c.changes >= 3, lines: [
                '{changes} changements de leader : même les joueurs ne savent plus qui gagne.',
                'Le classement a changé plus souvent que la météo.',
                'Un vrai ascenseur émotionnel, avec {w} qui descend à l\'étage du haut.',
                'Partie folle : personne n\'a gardé la tête plus de deux manches.'
            ]},
            { id: 'thriller', weight: 4, when: c => !c.tie && c.n > 1 && c.ratio <= 0.1, lines: [
                'Suspense jusqu\'au bout : {gap} d\'écart seulement !',
                '{gap} d\'écart. {s} va rejouer cette partie dans sa tête toute la nuit.',
                '{s} est à {gap} de la victoire. Ça pique.',
                'Gagner de {gap}, c\'est gagner quand même. Demandez à {w}.'
            ]},
            { id: 'domination', weight: 4, when: c => !c.tie && c.n > 1 && c.ratio >= 0.5, lines: [
                '{w} a joué, les autres ont regardé.',
                'Démonstration de {w}. Les autres, on en reparle.',
                '{w} gagne avec une facilité insolente.',
                'À ce niveau-là, ce n\'est plus une victoire, c\'est une visite guidée.',
                '{w} a écrasé la partie. Les chaises des autres sont encore chaudes.'
            ]},
            { id: 'wire', weight: 3, when: c => c.wire && c.rounds >= 3, lines: [
                '{w} en tête du début à la fin. Zéro suspense, 100 % classe.',
                '{w} a pris le volant dès la première manche et n\'a plus jamais lâché.',
                'Premier de la première à la dernière manche : {w} ne fait pas dans la dentelle.'
            ]},
            { id: 'late', weight: 4, when: c => c.late && c.rounds >= 3, lines: [
                '{w} attend la dernière manche pour passer devant. Le sens du spectacle.',
                'Cuisiné à la dernière minute : {w} double tout le monde au finish.',
                '{w} a gardé ses cartouches pour la fin. Les autres ont dû apprécier.'
            ]},
            { id: 'lucky', weight: 5, when: c => c.moreWinsElsewhere, lines: [
                '{t} a gagné plus de manches, {w} a gagné la partie. C\'est ça, la vraie vie.',
                '{w} gagne sans être le roi des manches. La régularité, ça paie.',
                '{t} a brillé manche après manche. {w} a juste eu le meilleur total. Détail.'
            ]},
            { id: 'loserBest', weight: 5, when: c => c.loserBest, lines: [
                '{l} signe la meilleure manche… et finit dernier. Le talent ne fait pas tout.',
                'Un éclair de génie de {l}, puis plus rien. Dommage.',
                '{l} a eu le meilleur coup de la partie. Et le pire classement. Bravo ?'
            ]},
            { id: 'roast', weight: 2, when: c => c.n >= 3 && !c.tie, lines: [
                '{l} termine dernier, mais avec panache.',
                'Mention spéciale à {l}, qui a fait monter la moyenne des autres.',
                '{l} jure qu\'il réchauffait la place pour la revanche.',
                '{l} a joué avec le cœur. Pas avec les points.',
                'Dernier, {l} ? Non : stratégiquement placé.'
            ]},
            { id: 'duel', weight: 2, when: c => c.n === 2 && !c.tie, lines: [
                'Un duel, un vainqueur : {w} l\'emporte sur {s}.',
                '{s} a perdu la bataille, mais pas sa mauvaise foi.',
                '{w} 1 – 0 {s}. La revanche est déjà réclamée, j\'imagine.'
            ]},
            { id: 'short', weight: 3, when: c => c.rounds <= 2, lines: [
                'Partie express : {w} gagne avant que les autres aient fini leur verre.',
                'Déjà fini ? {w} n\'a pas laissé le temps de s\'installer.'
            ]},
            { id: 'long', weight: 3, when: c => c.rounds >= 10, lines: [
                '{rounds} manches : {w} gagne à l\'usure.',
                'Un vrai marathon. {w} termine avec la tête haute (et les jambes lourdes).',
                '{rounds} manches plus tard, {w} est toujours debout. Respect.'
            ]},
            { id: 'streak', weight: 4, when: c => c.streakCount >= 3, lines: [
                '{p} enchaîne {streakCount} manches de suite. Ça devient personnel.',
                '{streakCount} manches d\'affilée pour {p}. Quelqu\'un peut l\'arrêter ?'
            ]},
            { id: 'lowest', weight: 2, when: c => c.isLowest && !c.tie, lines: [
                '{w} gagne en marquant le moins. Faire le moins a parfois du bon.',
                'Ici, le plus petit score gagne : {w} a très bien compris le principe.'
            ]},
            { id: 'base', weight: 1, when: () => true, lines: [
                '{w} s\'impose. Les autres préparent leur revanche.',
                'Victoire de {w}. Les perdants réclament déjà un nouveau match.',
                '{w} remporte la partie. Propre, net, sans bavure.',
                '{w} gagne. Les excuses des autres arrivent dans 3, 2, 1…'
            ]}
        ],

        _hash(str) {
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
            return h >>> 0;
        },
        _rng(seed) { // mulberry32
            let t = seed >>> 0;
            return () => { t = (t + 0x6D2B79F5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
        },
        _fill(tpl, c) {
            const pts = n => `${n} pt${Math.abs(n) > 1 ? 's' : ''}`;
            const v = { w: c.w, s: c.s, l: c.l, f: c.f, t: c.t, p: c.p, changes: c.changes, rounds: c.rounds, streakCount: c.streakCount, gap: pts(c.gap) };
            return tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
        },

        /** @param {Object} c contexte de partie  @param {string} seedStr graine  @param {number} roll relances */
        pick(c, seedStr, roll = 0) {
            const pool = [];
            // Égalité : on ne garde que les répliques qui ne désignent pas de vainqueur
            const sits = c.tie ? this.SITUATIONS.filter(x => x.id === 'tie') : this.SITUATIONS;
            sits.forEach(sit => { if (sit.when(c)) for (let i = 0; i < sit.weight; i++) pool.push(...sit.lines); });
            const unique = [...new Set(pool)];
            // roll décale la sélection : relancer ne retombe pas sur la même réplique
            const rnd = this._rng(this._hash(seedStr));
            const weighted = pool[Math.floor(rnd() * pool.length)];
            const first = unique.indexOf(weighted);
            return this._fill(unique[(first + roll) % unique.length], c);
        }
    };

    // ==================== UNIFIED RECAP GENERATOR V6.0 ====================
    // Récap carré (1080×1080 en PNG, 540×540 en GIF) : podium, courbe d'évolution, temps forts.
    // PNG = image finale ; GIF = même rendu animé (podium qui monte, courbe qui se dessine).
    
    const UnifiedRecapGenerator = {
        // Carré 540×540 (logique) : PNG rendu en ×2 (1080 px), GIF en ×1.
        CONFIG: { SIZE: 540, PAD: 28, FPS: 8, DURATION: 5, STATIC_SCALE: 2 },
        FONT: '-apple-system, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        MEDALS: {
            1: ['#FFE27A', '#F2A900'],
            2: ['#F3F4F6', '#9CA3AF'],
            3: ['#F0B27A', '#B4682A']
        },

        // ---------- Helpers ----------
        _clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; },
        _ease(x)    { x = this._clamp01(x); return 1 - Math.pow(1 - x, 3); },
        _seg(u, a, b) { return this._ease((u - a) / (b - a)); },
        _back(x)    { x = this._clamp01(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
        _fit(ctx, text, maxW) {
            let t = String(text);
            if (ctx.measureText(t).width <= maxW) return t;
            while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
            return t + '…';
        },
        _pts(n) { return `${n} pt${Math.abs(n) > 1 ? 's' : ''}`; },

        roundRect(ctx, x, y, w, h, r) {
            if (typeof r === 'number') r = [r, r, r, r];
            ctx.beginPath();
            ctx.moveTo(x + r[0], y);
            ctx.lineTo(x + w - r[1], y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
            ctx.lineTo(x + w, y + h - r[2]);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
            ctx.lineTo(x + r[3], y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
            ctx.lineTo(x, y + r[0]);
            ctx.quadraticCurveTo(x, y, x + r[0], y);
            ctx.closePath();
        },

        // ---------- Analyse ----------
        /** Calcule tout ce qui est affiché : classement, courbes, temps forts, narration. */
        analyze(gs) {
            const players = gs.players || [];
            if (!players.length) return null;
            const history = gs.history || [];
            const isLowest = gs.victoryCondition === VC_LOWEST;
            const better = (a, b) => isLowest ? a < b : a > b;

            const sorted = GameState.getSortedPlayers({ ...gs, victoryCondition: gs.victoryCondition || VC_HIGHEST });
            let prev = null, rank = 0;
            const ranked = sorted.map((p, i) => {
                const idx = players.indexOf(p);
                const curve = [0]; let cum = 0;
                history.forEach(r => { cum += Number(r[p.id]) || 0; curve.push(cum); });
                const total = Number.isFinite(p.total) ? p.total : cum;
                if (total !== prev) { rank = i + 1; prev = total; }
                return { id: p.id, name: String(p.name), color: p.color || PLAYER_COLORS[idx % PLAYER_COLORS.length], total, rank, curve };
            });

            // Meilleure manche (tient compte du sens de la victoire)
            let best = null;
            history.forEach((r, ri) => players.forEach(p => {
                const s = Number(r[p.id]) || 0;
                if (!best || better(s, best.score)) best = { name: String(p.name), score: s, round: ri + 1 };
            }));

            // Victoires de manche + meilleure série
            const wins = {}; const run = {}; let streak = { name: null, count: 0 };
            players.forEach(p => { wins[p.id] = 0; run[p.id] = 0; });
            history.forEach(r => {
                const sc = players.map(p => Number(r[p.id]) || 0);
                const bestS = isLowest ? Math.min(...sc) : Math.max(...sc);
                const winners = players.filter(p => (Number(r[p.id]) || 0) === bestS);
                const w = winners.length === 1 ? winners[0] : null; // ex æquo : pas de série
                players.forEach(p => { if (w && p.id === w.id) { wins[p.id]++; run[p.id]++; if (run[p.id] > streak.count) streak = { name: String(p.name), count: run[p.id] }; } else run[p.id] = 0; });
            });
            const topWin = players.map(p => ({ name: String(p.name), n: wins[p.id] })).sort((a, b) => b.n - a.n)[0];

            // Changements de leader
            let changes = 0, lastLeader = null, firstLeader = null;
            const leaders = [];
            const cum = {}; players.forEach(p => cum[p.id] = 0);
            history.forEach((r, i) => {
                players.forEach(p => cum[p.id] += Number(r[p.id]) || 0);
                const lead = [...players].sort((a, b) => isLowest ? cum[a.id] - cum[b.id] : cum[b.id] - cum[a.id])[0].id;
                leaders.push(lead);
                if (i === 0) firstLeader = lead;
                else if (lead !== lastLeader) changes++;
                lastLeader = lead;
            });

            const winner = ranked[0], second = ranked[1];
            const gap = second ? Math.abs(winner.total - second.total) : 0;
            const tie = !!second && gap === 0;
            const ratio = gap / Math.max(1, Math.abs(winner.total));
            const loser = ranked[ranked.length - 1];
            const firstPlayer = players.find(p => p.id === firstLeader);
            const ctx = {
                n: ranked.length, rounds: history.length, gap, ratio, tie, changes, isLowest,
                w: winner.name, s: second ? second.name : '', l: loser.name,
                f: firstPlayer ? String(firstPlayer.name) : winner.name,
                t: topWin.name, p: streak.name || '', streakCount: streak.count,
                comeback: firstLeader !== null && firstLeader !== winner.id && history.length > 2,
                wire: history.length > 0 && leaders.every(l => l === winner.id),
                late: history.length >= 3 && leaders[leaders.length - 1] === winner.id && leaders.slice(0, -1).every(l => l !== winner.id),
                moreWinsElsewhere: !tie && topWin.name !== winner.name && topWin.n > (wins[winner.id] || 0),
                loserBest: !!best && ranked.length >= 3 && best.name === loser.name && loser.name !== winner.name
            };
            const seed = `${gs.name}|${gs.date}|${ranked.map(r => r.name + r.total).join(',')}`;
            const narrative = Punchlines.pick(ctx, seed, gs.roll || 0);

            const d = gs.date ? new Date(gs.date) : new Date();
            return {
                name: gs.name || 'Partie', isLowest, ranked, rounds: history.length,
                date: (isNaN(d) ? new Date() : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
                best, streak, topWin, changes, gap, tie, narrative
            };
        },

        // ---------- Mise en page ----------
        _layout(a) {
            const n = a.ranked.length;
            const H1 = n <= 3 ? 110 : 72;
            const baseline = 166 + H1;
            const rest = Math.max(0, n - 3);
            const rows = rest === 0 ? 0 : (rest <= 4 ? rest : 3);   // au-delà : 2 joueurs + « + N autres »
            const othersH = rows ? rows * 24 : 0;
            const chartTop = rows ? baseline + 12 + othersH + 8 : baseline + 22;
            return { n, H1, baseline, rows, rest, chartTop, chartBottom: 432, chipsY: 442 };
        },

        // ---------- Dessin ----------
        drawFrame(ctx, a, time, animated) {
            const S = this.CONFIG.SIZE;
            const u = animated ? Math.min(1, time / 0.78) : 1;
            const L = this._layout(a);
            this._drawBackground(ctx, S, time);
            this._drawBeams(ctx, S, time, u);
            this._drawConfetti(ctx, S, time, u);
            this._drawHeader(ctx, a, S, u);
            this._drawPodium(ctx, a, L, S, u, time);
            this._drawOthers(ctx, a, L, S, u, time);
            this._drawChart(ctx, a, L, S, u);
            this._drawChips(ctx, a, L, S, u);
            this._drawFloaters(ctx, S, time, u);
            this._drawFooter(ctx, a, S, u);
        },

        _drawBackground(ctx, S, time) {
            const g = ctx.createLinearGradient(0, 0, 0, S);
            g.addColorStop(0, '#1C2042'); g.addColorStop(1, '#0B1020');
            ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
            const r = ctx.createRadialGradient(S / 2, 170, 10, S / 2, 170, 280);
            r.addColorStop(0, 'rgba(255,196,60,0.16)'); r.addColorStop(1, 'rgba(255,196,60,0)');
            ctx.fillStyle = r; ctx.fillRect(0, 0, S, S);
            // particules dorées : mouvement périodique → boucle parfaite
            for (let i = 0; i < 22; i++) {
                const k = 1 + (i % 2);
                const x = ((i * 97) % S) + Math.sin(2 * Math.PI * time * k + i) * 10;
                const y = (((i * 53) % S) - time * S * k + S * 4) % S;
                const alpha = 0.22 + 0.2 * Math.sin(2 * Math.PI * time * k + i * 1.7);
                ctx.fillStyle = i % 3 ? `rgba(255,214,102,${alpha})` : `rgba(255,255,255,${alpha * 0.8})`;
                ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, Math.PI * 2); ctx.fill();
            }
        },

        // ---------- Effets festifs ----------
        // Tous les mouvements sont périodiques (cycles entiers) : le GIF boucle sans à-coup.

        /** Faisceaux de projecteurs dorés qui balayent le podium. */
        _drawBeams(ctx, S, time, u) {
            const a = this._seg(u, 0.05, 0.3);
            if (a <= 0) return;
            ctx.save();
            ctx.globalAlpha = a * 0.55;
            [-1, 1].forEach(side => {
                const sway = Math.sin(2 * Math.PI * time + (side > 0 ? 0 : Math.PI)) * 0.1;
                ctx.save();
                ctx.translate(S / 2 + side * 150, -20);
                ctx.rotate(-side * 0.38 + sway);
                const g = ctx.createLinearGradient(0, 0, 0, 380);
                g.addColorStop(0, 'rgba(255,220,120,0.20)'); g.addColorStop(1, 'rgba(255,220,120,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(70, 380); ctx.lineTo(-70, 380); ctx.closePath(); ctx.fill();
                ctx.restore();
            });
            ctx.restore();
        },

        /** Pluie de confettis (rectangles et ronds colorés qui tournent en tombant). */
        _drawConfetti(ctx, S, time, u) {
            const a = this._seg(u, 0.12, 0.35);
            if (a <= 0) return;
            const cols = ['#FF3B6B', '#FFD23F', '#3BB4FF', '#4ADE80', '#C084FC', '#FF8A3D'];
            ctx.save();
            for (let i = 0; i < 44; i++) {
                const k = 1 + (i % 2);
                const x = ((i * 73) % S) + Math.sin(2 * Math.PI * time * k + i) * 14;
                const y = (((i * 131) % S) + time * S * k) % S;
                const rot = i + 2 * Math.PI * time * (1 + (i % 3));
                const w = 6 + (i % 3) * 2, h = 3 + (i % 2) * 2;
                ctx.globalAlpha = a * 0.85;
                ctx.fillStyle = cols[i % cols.length];
                ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
                if (i % 4 === 0) { ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
                else ctx.fillRect(-w / 2, -h / 2, w, h);
                ctx.restore();
            }
            ctx.restore();
        },

        /** Étoile à 4 branches (étincelle). */
        _sparkle(ctx, x, y, r) {
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const ang = i * Math.PI / 4, rad = i % 2 ? r * 0.35 : r;
                ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
            }
            ctx.closePath(); ctx.fill();
        },

        /** Emojis de fête qui montent sur les bords. */
        _drawFloaters(ctx, S, time, u) {
            const a = this._seg(u, 0.3, 0.5);
            if (a <= 0) return;
            const em = ['🎉', '🥳', '✨', '🔥', '🎊', '⭐', '🍾', '👏'];
            ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            em.forEach((e, i) => {
                const t = (time + i / em.length) % 1;
                const left = i % 2 === 0;
                const x = (left ? 15 : S - 15) + Math.sin(2 * Math.PI * time * 2 + i) * 3;
                const y = S - 40 - t * (S - 150);
                ctx.globalAlpha = a * Math.sin(Math.PI * t) * 0.95;
                ctx.font = `${18 + (i % 3) * 2}px ${this.FONT}`;
                ctx.fillText(e, x, y);
            });
            ctx.restore();
        },

        /** Emoji de réaction : fête pour le vainqueur, drame pour le dernier. */
        _reaction(a, p) {
            const n = a.ranked.length;
            if (p.rank === 1) return a.tie ? '🤝' : '🥳';
            if (!a.tie && n >= 2 && p === a.ranked[n - 1]) {
                return ['😭', '🤡', '💀', '🫠'][Punchlines._hash(p.name) % 4];
            }
            return '';
        },

        _drawHeader(ctx, a, S, u) {
            const P = this.CONFIG.PAD, F = this.FONT;
            ctx.save();
            ctx.globalAlpha = this._seg(u, 0, 0.1);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            ctx.font = `800 28px ${F}`; ctx.fillStyle = '#FFFFFF';
            ctx.fillText(this._fit(ctx, '🏆 ' + a.name, S - 2 * P - 120), P, 44);
            ctx.font = `500 14px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(`${a.date} · ${a.rounds} manche${a.rounds > 1 ? 's' : ''}`, P, 66);
            // pastille marque
            const w = 104, x = S - P - w, y = 24;
            ctx.fillStyle = 'rgba(255,214,102,0.12)'; this.roundRect(ctx, x, y, w, 24, 12); ctx.fill();
            ctx.strokeStyle = 'rgba(255,214,102,0.6)'; ctx.lineWidth = 1; this.roundRect(ctx, x, y, w, 24, 12); ctx.stroke();
            ctx.font = `800 10px ${F}`; ctx.fillStyle = '#FFD666'; ctx.textAlign = 'center';
            ctx.fillText('SCOREMASTER', x + w / 2, y + 16);
            ctx.restore();
        },

        _drawPodium(ctx, a, L, S, u, time) {
            const F = this.FONT, n = L.n;
            const order  = n >= 3 ? [1, 0, 2] : n === 2 ? [0, 1] : [0];
            const colW = 112, gap = 10;
            const x0 = (S - (order.length * colW + (order.length - 1) * gap)) / 2;
            const delay = [0.24, 0.16, 0.08];
            const hFrac = [1, 0.78, 0.6];
            order.forEach((pos, ci) => {
                const p = a.ranked[pos];
                const d = delay[pos] ?? 0.08;
                const raw = this._clamp01((u - d) / 0.22);
                if (raw <= 0) return;
                const h = L.H1 * (hFrac[pos] ?? 0.5) * this._back(raw);   // léger rebond
                const x = x0 + ci * (colW + gap), top = L.baseline - h, cx = x + colW / 2;
                const isWin = p.rank === 1;
                const [c1, c2] = this.MEDALS[p.rank] || ['#94A3B8', '#64748B'];
                // colonne
                const g = ctx.createLinearGradient(0, top, 0, L.baseline);
                g.addColorStop(0, c1); g.addColorStop(1, c2);
                ctx.fillStyle = g; this.roundRect(ctx, x, top, colW, h, [12, 12, 0, 0]); ctx.fill();
                ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
                ctx.globalAlpha = this._clamp01((raw - 0.35) / 0.5);
                if (h >= 84) { // colonne trop basse : le chiffre chevaucherait le score
                    ctx.font = `900 ${Math.round(Math.min(46, h * 0.5))}px ${F}`;
                    ctx.fillStyle = 'rgba(0,0,0,0.16)';
                    ctx.fillText(String(p.rank), cx, L.baseline - 8);
                }
                // score qui défile jusqu'à sa valeur finale
                const k = this._ease((u - d - 0.08) / 0.28);
                const shown = k >= 1 ? p.total : (Number.isInteger(p.total) ? Math.round(p.total * k) : (p.total * k).toFixed(1));
                ctx.font = `800 21px ${F}`; ctx.fillStyle = '#1B1B2F';
                ctx.fillText(String(shown), cx, top + 28);
                // nom + avatar
                ctx.font = `700 15px ${F}`; ctx.fillStyle = '#FFFFFF';
                ctx.fillText(this._fit(ctx, p.name, colW), cx, top - 10);
                const r = isWin ? 22 : 19, cy = top - 28 - r;
                if (isWin) { ctx.shadowColor = 'rgba(255,210,63,0.9)'; ctx.shadowBlur = 16; }
                ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.lineWidth = 2.5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
                ctx.font = `800 ${r}px ${F}`; ctx.fillStyle = '#FFFFFF';
                ctx.fillText(p.name.charAt(0).toUpperCase(), cx, cy + r * 0.36);
                // couronne qui se balance
                if (isWin) {
                    ctx.save(); ctx.translate(cx, cy - r - 3);
                    ctx.rotate(Math.sin(2 * Math.PI * time * 2) * 0.12);
                    ctx.font = `20px ${F}`; ctx.fillText('👑', 0, 0); ctx.restore();
                    // couronne d'étincelles autour du vainqueur
                    const burst = this._seg(u, d + 0.2, d + 0.36);
                    ctx.fillStyle = '#FFE27A';
                    for (let j = 0; j < 8; j++) {
                        const ang = j * Math.PI / 4 + 2 * Math.PI * time;
                        const dist = r + 14 + burst * 6 + Math.sin(2 * Math.PI * time * 2 + j) * 3;
                        ctx.globalAlpha = burst * (j % 2 ? 0.6 : 0.95);
                        this._sparkle(ctx, cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 3.5 + (j % 2) * 2.5);
                    }
                    ctx.globalAlpha = 1;
                }
                // réaction rigolote (🥳 / 😭 / 🤡…)
                const em = this._reaction(a, p);
                if (em) {
                    ctx.font = `22px ${F}`; ctx.textAlign = 'center';
                    const bob = Math.sin(2 * Math.PI * time * 2 + pos * 1.3) * 3;
                    ctx.fillText(em, cx + r + 12, cy - r * 0.5 + bob);
                }
                ctx.restore();
            });
        },

        _drawOthers(ctx, a, L, S, u, time) {
            if (!L.rows) return;
            const P = this.CONFIG.PAD, F = this.FONT, W = S - 2 * P;
            const rest = a.ranked.slice(3);
            const shown = L.rest > 4 ? rest.slice(0, 2) : rest;
            const items = shown.map(p => ({ p }));
            if (L.rest > 4) items.push({ more: L.rest - 2 });
            items.forEach((it, i) => {
                const prog = this._seg(u, 0.4 + i * 0.04, 0.54 + i * 0.04);
                const y = L.baseline + 12 + i * 24;
                ctx.save(); ctx.globalAlpha = prog; ctx.translate(-(1 - prog) * 24, 0);
                ctx.fillStyle = 'rgba(255,255,255,0.07)'; this.roundRect(ctx, P, y, W, 22, 11); ctx.fill();
                ctx.textBaseline = 'alphabetic';
                if (it.p) {
                    ctx.textAlign = 'left'; ctx.font = `800 13px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    ctx.fillText(String(it.p.rank), P + 12, y + 15.5);
                    ctx.fillStyle = it.p.color; ctx.beginPath(); ctx.arc(P + 38, y + 11, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.font = `700 13px ${F}`; ctx.fillStyle = '#FFFFFF';
                    const em = this._reaction(a, it.p);
                    ctx.fillText(this._fit(ctx, it.p.name, W - 170), P + 52, y + 15.5);
                    if (em) {
                        const nw = ctx.measureText(this._fit(ctx, it.p.name, W - 170)).width;
                        ctx.font = `14px ${F}`; ctx.fillText(em, P + 52 + nw + 8, y + 16 + Math.sin(2 * Math.PI * time * 2 + i) * 1.5);
                        ctx.font = `700 13px ${F}`;
                    }
                    ctx.textAlign = 'right'; ctx.font = `800 13px ${F}`; ctx.fillStyle = '#FFD666';
                    ctx.fillText(this._pts(it.p.total), P + W - 12, y + 15.5);
                } else {
                    ctx.textAlign = 'center'; ctx.font = `600 12px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    ctx.fillText(`+ ${it.more} autre${it.more > 1 ? 's' : ''} joueur${it.more > 1 ? 's' : ''}`, S / 2, y + 15);
                }
                ctx.restore();
            });
        },

        _drawChart(ctx, a, L, S, u) {
            if (a.rounds < 2) return;
            const P = this.CONFIG.PAD, F = this.FONT;
            const top = L.chartTop, bottom = L.chartBottom, W = S - 2 * P;
            const pAll = this._seg(u, 0.42, 0.52);
            if (pAll <= 0 || bottom - top < 70) return;
            const R = a.rounds;
            const series = a.ranked.slice(0, 6);

            // --- cadre + titre + légende (noms colorés) ---
            ctx.save(); ctx.globalAlpha = pAll;
            ctx.fillStyle = 'rgba(255,255,255,0.05)'; this.roundRect(ctx, P, top, W, bottom - top, 16); ctx.fill();
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            ctx.font = `800 10px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText('SCORE PAR MANCHE', P + 14, top + 18);
            ctx.font = `700 10.5px ${F}`;
            let lx = S - P - 14;                                   // légende alignée à droite
            [...series].reverse().forEach(sr => {
                const label = this._fit(ctx, sr.name, 64);
                const w = ctx.measureText(label).width;
                if (lx - w - 14 < P + 130) return;                 // plus de place : on omet
                lx -= w;
                ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(label, lx, top + 18);
                ctx.fillStyle = sr.color; ctx.beginPath(); ctx.arc(lx - 7, top + 15, 4, 0, Math.PI * 2); ctx.fill();
                lx -= 20;
            });
            ctx.restore();

            // --- zone de tracé ---
            const compact = bottom - top < 110;
            const px0 = P + 40, px1 = S - P - 16;
            const py0 = top + 28, py1 = bottom - (compact ? 16 : 20);
            let lo = 0, hi = 0;
            series.forEach(sr => sr.curve.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
            if (hi === lo) hi = lo + 1;
            const X = i => px0 + (px1 - px0) * (i / R);
            const Y = v => py1 - (py1 - py0) * ((v - lo) / (hi - lo));
            const fmt = v => String(Math.round(v));

            ctx.save(); ctx.globalAlpha = pAll;
            // repères horizontaux + valeurs
            ctx.font = `600 9.5px ${F}`; ctx.textAlign = 'right';
            for (let g = 0; g <= 2; g++) {
                const v = lo + (hi - lo) * (g / 2), y = Y(v);
                ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px1, y); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText(fmt(v), px0 - 6, y + 3);
            }
            // ligne zéro mise en évidence si les scores passent en négatif
            if (lo < 0 && hi > 0) {
                ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(px0, Y(0)); ctx.lineTo(px1, Y(0)); ctx.stroke(); ctx.setLineDash([]);
            }
            // repères verticaux : une graduation par manche, étiquetée M1, M2…
            const step = R <= 10 ? 1 : Math.ceil(R / 8);
            ctx.textAlign = 'center';
            for (let i = 1; i <= R; i++) {
                const x = X(i), labeled = i === R || (i % step === 0 && R - i >= Math.ceil(step / 2));
                ctx.strokeStyle = labeled ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
                ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py1); ctx.stroke();
                if (labeled) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(R <= 10 ? `M${i}` : String(i), x, py1 + 12); }
            }
            ctx.restore();

            // --- courbes + marqueurs sur chaque manche ---
            const f = R * this._seg(u, 0.45, 0.8);                // progression de l'animation
            const dots = R <= 14;
            [...series].reverse().forEach(sr => {
                const isWin = sr.rank === 1;
                ctx.strokeStyle = sr.color; ctx.lineWidth = isWin ? 3.2 : 2;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.globalAlpha = isWin ? 1 : 0.9;
                ctx.beginPath(); ctx.moveTo(X(0), Y(sr.curve[0]));
                const whole = Math.min(Math.floor(f), R);
                for (let i = 1; i <= whole; i++) ctx.lineTo(X(i), Y(sr.curve[i]));
                let hx = X(whole), hy = Y(sr.curve[whole]);
                if (whole < R && f > whole) {
                    const t = f - whole;
                    hx = X(whole) + (X(whole + 1) - X(whole)) * t;
                    hy = Y(sr.curve[whole]) + (Y(sr.curve[whole + 1]) - Y(sr.curve[whole])) * t;
                    ctx.lineTo(hx, hy);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
                // un point par manche (anneau sombre pour rester lisible quand les courbes se croisent)
                if (dots || isWin) {
                    for (let i = 1; i <= whole; i++) {
                        ctx.fillStyle = sr.color; ctx.strokeStyle = '#0B1020'; ctx.lineWidth = 1.5;
                        ctx.beginPath(); ctx.arc(X(i), Y(sr.curve[i]), isWin ? 3.6 : 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    }
                }
                // tête de courbe + valeur finale
                ctx.fillStyle = sr.color; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(hx, hy, isWin ? 5.2 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                if (isWin && f >= R) {
                    ctx.font = `800 11px ${F}`; ctx.textAlign = 'right'; ctx.fillStyle = '#FFFFFF';
                    const ly = hy < py0 + 14 ? hy + 16 : hy - 9;
                    ctx.fillText(fmt(sr.curve[R]), hx - 6, ly);
                }
            });
        },

        _drawChips(ctx, a, L, S, u) {
            if (!a.rounds) return;
            const P = this.CONFIG.PAD, F = this.FONT;
            const gap = 8, w = (S - 2 * P - 2 * gap) / 3, h = 58;
            const b = a.best;
            const second = a.ranked[1];
            const chips = [
                { label: 'MEILLEURE MANCHE', main: b.name, sub: `${b.score} pts · manche ${b.round}` },
                a.streak.count >= 2
                    ? { label: 'EN SÉRIE', main: a.streak.name, sub: `${a.streak.count} manches de suite` }
                    : { label: 'MANCHES GAGNÉES', main: a.topWin.name, sub: `${a.topWin.n} sur ${a.rounds}` },
                a.tie
                    ? { label: 'ÉGALITÉ', main: '0 pt d\'écart', sub: `${a.ranked[0].name} = ${second.name}` }
                    : a.changes >= 2
                        ? { label: 'LEADER CHANGÉ', main: `${a.changes} fois`, sub: 'au classement' }
                        : { label: 'ÉCART FINAL', main: second ? this._pts(a.gap) : '—', sub: second ? `${a.ranked[0].name} devant ${second.name}` : '' }
            ];
            chips.forEach((c, i) => {
                const prog = this._seg(u, 0.68 + i * 0.06, 0.82 + i * 0.06);
                if (prog <= 0) return;
                const x = P + i * (w + gap), y = L.chipsY;
                const sc = 0.88 + 0.12 * this._back(prog);
                ctx.save(); ctx.globalAlpha = this._clamp01(prog * 1.4);
                ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
                ctx.fillStyle = 'rgba(255,255,255,0.07)'; this.roundRect(ctx, x, y, w, h, 14); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; this.roundRect(ctx, x, y, w, h, 14); ctx.stroke();
                ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                ctx.font = `800 9.5px ${F}`; ctx.fillStyle = '#FFD666';
                ctx.fillText(this._fit(ctx, c.label, w - 20), x + 10, y + 17);
                ctx.font = `800 15px ${F}`; ctx.fillStyle = '#FFFFFF';
                ctx.fillText(this._fit(ctx, c.main, w - 20), x + 10, y + 36);
                ctx.font = `500 11px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fillText(this._fit(ctx, c.sub, w - 20), x + 10, y + 51);
                ctx.restore();
            });
        },

        _wrap(ctx, text, maxW, maxLines) {
            const words = String(text).split(' '); const lines = []; let cur = '';
            words.forEach(w => {
                const t = cur ? cur + ' ' + w : w;
                if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
            });
            if (cur) lines.push(cur);
            if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = this._fit(ctx, lines[maxLines - 1] + '…', maxW); }
            return lines;
        },

        _drawFooter(ctx, a, S, u) {
            const P = this.CONFIG.PAD;
            ctx.save();
            const pop = this._seg(u, 0.86, 0.98);
            ctx.globalAlpha = pop;
            const sc = 0.9 + 0.1 * this._back(pop);
            ctx.translate(S / 2, 520); ctx.scale(sc, sc); ctx.translate(-S / 2, -520);
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = `italic 600 13.5px ${this.FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.8)';
            const lines = this._wrap(ctx, a.narrative, S - 2 * P - 36, 2);
            lines[0] = '« ' + lines[0]; lines[lines.length - 1] += ' »';
            const y0 = lines.length === 1 ? 524 : 515;
            lines.forEach((ln, i) => ctx.fillText(ln, S / 2, y0 + i * 16));
            ctx.restore();
        },

        // ---------- PNG ----------
        generateStatic(gameState, scale = this.CONFIG.STATIC_SCALE) {
            try {
                const a = this.analyze(gameState);
                if (!a) return null;
                const S = this.CONFIG.SIZE;
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = Math.round(S * scale);
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                this.drawFrame(ctx, a, 0.35, false);
                return canvas;
            } catch (error) {
                console.error('[UnifiedRecap] Erreur PNG:', error);
                return null;
            }
        },

        // ---------- GIF ----------
        _calcFrameCount() {
            const base = this.CONFIG.FPS * this.CONFIG.DURATION;
            return (navigator.deviceMemory && navigator.deviceMemory < 4) ? Math.floor(base * 0.6) : base;
        },

        _renderFrames(a, totalFrames, updateProgress) {
            const S = this.CONFIG.SIZE;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = S;
            const ctx = canvas.getContext('2d');
            const frames = [];
            for (let f = 0; f < totalFrames; f++) {
                ctx.clearRect(0, 0, S, S);
                this.drawFrame(ctx, a, f / totalFrames, true);
                frames.push(canvas.toDataURL('image/png'));
                if (f % 4 === 0) updateProgress(10 + Math.round((f / totalFrames) * 50), `Frame ${f + 1}/${totalFrames}`);
            }
            canvas.width = 1; canvas.height = 1; // libère la mémoire
            return frames;
        },

        _onGifSuccess(obj, updateProgress) {
            updateProgress(95, 'Finalisation...');
            const binary = atob(obj.image.split(',')[1]);
            const arr = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
            updateProgress(100, 'Terminé !');
            if (app._gifTimeoutId) { clearTimeout(app._gifTimeoutId); app._gifTimeoutId = null; }
            app._gifGenerating = false;
            const gifBlob = new Blob([arr], { type: 'image/gif' });
            setTimeout(() => app.onGifReady(gifBlob), 300);
        },

        _onGifFail(errorMsg) {
            UI.hideLoading();
            UI.showToast('❌ Erreur: ' + errorMsg, 'error');
            app._gifGenerating = false;
            if (app._gifTimeoutId) { clearTimeout(app._gifTimeoutId); app._gifTimeoutId = null; }
        },

        _handleGifError(error) {
            UI.hideLoading();
            UI.showToast('❌ Erreur: ' + error.message, 'error');
            app._gifGenerating = false;
        },

        _encodeGIF(frames, totalFrames, updateProgress) {
            const S = this.CONFIG.SIZE;
            gifshot.createGIF({
                images: frames, gifWidth: S, gifHeight: S,
                interval: 1 / this.CONFIG.FPS, numFrames: totalFrames, frameDuration: 1,
                sampleInterval: 8,
                progressCallback: (p) => updateProgress(60 + Math.round(p * 35), `Encodage: ${Math.round(p * 100)}%`)
            }, (obj) => obj.error ? this._onGifFail(obj.error) : this._onGifSuccess(obj, updateProgress));
        },

        generateAnimated(gameState, progressCallback = null) {
            const updateProgress = (p, m) => { if (progressCallback) progressCallback(p, m); };
            try {
                if (typeof gifshot === 'undefined') { UI.hideLoading(); throw new Error('Bibliothèque gifshot non chargée'); }
                updateProgress(5, 'Analyse des données...');
                const a = this.analyze(gameState);
                if (!a) throw new Error('Aucun joueur');
                const total = this._calcFrameCount();
                updateProgress(10, `Génération de ${total} images...`);
                const frames = this._renderFrames(a, total, updateProgress);
                updateProgress(60, 'Encodage du GIF...');
                this._encodeGIF(frames, total, updateProgress);
            } catch (error) {
                this._handleGifError(error);
            }
        },

        // ---------- Fichiers ----------
        canvasToBlobAsync(canvas) {
            return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
        }
    };


