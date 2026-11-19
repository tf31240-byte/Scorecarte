    // ==================== STATS ENGINE OPTIMISÉ ====================
    const StatsEngine = {

        // --- Calculs Stats ---


        /**
         * Calcule le score de régularité (0-5) et le pourcentage de forme récente.
         * @param {Object} data       Stats brutes du joueur (roundScores, gameScores)
         * @param {number} avgPerRound Moyenne des scores par manche
         * @returns {{ regularityScore: number, formPercent: number }}
         */
        _calcRegularityAndForm(data, avgPerRound) {
            const variance = data.roundScores.length > 0
                ? data.roundScores.reduce((acc, v) => acc + (v - avgPerRound) ** 2, 0) / data.roundScores.length
                : 0;
            const regularityScore = Math.max(0, Math.min(5, 5 - Math.floor((Math.sqrt(variance) / 50) * 5)));

            const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
            const recentGames = data.gameScores.slice(-5);
            const olderGames  = data.gameScores.slice(0, -5);
            const recentAvg   = avg(recentGames);
            const olderAvg    = olderGames.length ? avg(olderGames) : recentAvg;
            const formPercent = olderAvg !== 0
                ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
                : 0;

            return { regularityScore, formPercent };
        },


        /**
         * Assemble l'objet stats complet d'un joueur à partir des données brutes et calculées.
         * @returns {Object} stats enrichies avec winRate, regularityStars, formTrend…
         */
        _buildPlayerStatObj(name, data, streaks, avgPerRound, regularityScore, formPercent) {
            return {
                name, ...data,
                winRate:         data.played ? Math.round((data.wins / data.played) * 100) : 0,
                avgPerRound,
                lowestRound:     data.lowestRound === Infinity ? 0 : data.lowestRound,
                regularityScore,
                regularityStars: '⭐'.repeat(regularityScore) + '☆'.repeat(5 - regularityScore),
                currentStreak:   streaks[name]?.current || 0,
                bestStreak:      streaks[name]?.best    || 0,
                formPercent,
                formTrend:       formPercent > 0 ? '↗️' : formPercent < 0 ? '↘️' : '➡️'
            };
        },


        /** Calcule la moyenne de score par manche d'un joueur (0 si aucune manche). */
        _calcAvgPerRound(data) {
            return data.totalRounds > 0
                ? Math.round(data.roundScores.reduce((a, b) => a + b, 0) / data.totalRounds)
                : 0;
        },

        _derivePlayerStats(name, data, streaks) {
            const avgPerRound = this._calcAvgPerRound(data);
            const { regularityScore, formPercent } = this._calcRegularityAndForm(data, avgPerRound);
            return this._buildPlayerStatObj(name, data, streaks, avgPerRound, regularityScore, formPercent);
        },


        /**
         * Accumule les statistiques brutes d'une partie dans les maps stats/streaks.
         * Appelé une fois par partie terminée par calculateStats.
         */

        // --- _accumulatePlayerStats helpers ---

        /**
         * Accumule les scores de manche d'un joueur dans son entrée stats.
         * Met à jour roundScores, totalRounds, highestRound, lowestRound.
         */
        _accumulateRoundScores(s, playerId, history) {
            for (const round of history) {
                const rs = round[playerId] || 0;
                s.roundScores.push(rs);
                s.totalRounds++;
                if (rs > s.highestRound) s.highestRound = rs;
                if (rs > 0 && rs < s.lowestRound) s.lowestRound = rs;
            }
        },

        /**
         * Met à jour le compteur de série (wins + streak) pour un joueur.
         */
        _updatePlayerStreak(key, playerId, winner, s, streaks) {
            if (winner && playerId === winner.id) {
                s.wins++;
                streaks[key].current++;
                streaks[key].best = Math.max(streaks[key].best, streaks[key].current);
            } else {
                streaks[key].current = 0;
            }
        },

        _accumulatePlayerStats(p, history, winner, stats, streaks) {
            const key = p.name.toUpperCase();
            if (!stats[key]) {
                stats[key]   = { wins: 0, played: 0, totalScoreSum: 0, highestScore: 0,
                                 highestRound: 0, lowestRound: Infinity,
                                 roundScores: [], totalRounds: 0, gameScores: [] };
                streaks[key] = { current: 0, best: 0 };
            }
            const s = stats[key];
            s.played++;
            s.totalScoreSum += p.total;
            s.highestScore   = Math.max(s.highestScore, p.total);
            s.gameScores.push(p.total);

            this._accumulateRoundScores(s, p.id, history);

            this._updatePlayerStreak(key, p.id, winner, s, streaks);
        },

        _accumulateGameStats(game, stats, streaks) {
            const sorted   = GameState.getSortedPlayers(game.state);
            const winner   = sorted[0];

            game.state.players.forEach(p => this._accumulatePlayerStats(p, game.state.history, winner, stats, streaks));
        },

        calculateStats(mode = 'all') {
            const games = Storage.loadGames().filter(g =>
                g.finished && (mode === 'all' || g.mode === mode)
            );

            // Trier les jeux par date une seule fois (gérer les dates invalides)
            games.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (isNaN(dateA)) return 1;  // Dates invalides à la fin
                if (isNaN(dateB)) return -1;
                return dateA - dateB;
            });

            const stats = {};
            const streaks = {};

            games.forEach(game => this._accumulateGameStats(game, stats, streaks));

            return Object.entries(stats).map(([name, data]) => this._derivePlayerStats(name, data, streaks)).sort((a,b) => b.winRate - a.winRate);
        },

        // =====================================================================
        // ANALYSE COMPLÈTE (écran Statistiques) — filtres jeu / période,
        // équité (min. de parties), jeux « plus bas gagne », face-à-face, anecdotes.
        // =====================================================================
        MIN_RELIABLE: 3,

        /** Rang de chaque joueur d'une partie (1 = meilleur, égalités partagées). */
        _placesOf(players, isLowest) {
            const better = (a, b) => isLowest ? a < b : a > b;
            const out = {};
            players.forEach(p => { out[p.id] = 1 + players.filter(o => better(o.total, p.total)).length; });
            return out;
        },

        /** Identité d'un joueur : insensible à la casse, aux accents et aux espaces. */
        _nk(s) { return String(s || '?').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); },

        analyze(opts = {}) {
            const now = Date.now();
            // Règle app : une partie sans aucune manche n'a pas de vainqueur → ignorée
            const all = Storage.loadGames().filter(g => g && g.finished && g.state
                && Array.isArray(g.state.players) && g.state.players.length
                && Array.isArray(g.state.history) && g.state.history.length > 0);
            const time = g => { const t = Date.parse(g.date); return isNaN(t) ? 0 : t; };
            const nameKey = g => String(g.name || 'Partie').trim().toLowerCase();

            const counts = {};
            all.forEach(g => {
                const k = nameKey(g);
                if (!counts[k]) counts[k] = { key: k, label: String(g.name || 'Partie').trim(), count: 0 };
                counts[k].count++;
            });
            const gameNames = Object.values(counts).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

            let games = all;
            if (opts.game && opts.game !== 'all') games = games.filter(g => nameKey(g) === opts.game);
            if (opts.period === '30') games = games.filter(g => time(g) >= now - 30 * 864e5);
            else if (opts.period === 'year') games = games.filter(g => new Date(time(g)).getFullYear() === new Date(now).getFullYear());
            games = games.slice().sort((a, b) => time(a) - time(b));

            // Belote = équipes (NOUS / EUX) : pas des joueurs. On ne les classe comme tels
            // que si le filtre ne contient que des parties de Belote.
            const teamOnly = games.length > 0 && games.every(g => g.mode === 'belote');

            const P = {}, pair = {};
            const A = { tight: null, wide: null, long: null, comeback: null, bigBy: {} };
            const byGameRes = {};
            let rounds = 0, last = null;
            const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1); // écart relatif (jeux de barèmes différents)

            games.forEach(g => {
                const st = g.state, isLowest = st.victoryCondition === VC_LOWEST;
                const isTeam = g.mode === 'belote';
                const players = st.players.map(p => ({ id: p.id, key: this._nk(p.name), label: String(p.name || '?').trim().toUpperCase(), total: Number(p.total) || 0 }));
                const places = this._placesOf(players, isLowest);
                const n = players.length, t = time(g), gname = String(g.name || 'Partie').trim();
                const sorted = [...players].sort((a, b) => isLowest ? a.total - b.total : b.total - a.total);
                // Règle app (_gameWinnerId) : égalité en tête = pas de vainqueur
                const tops = players.filter(p => places[p.id] === 1);
                const draw = tops.length > 1;
                rounds += st.history.length;
                last = { name: gname, t, draw, winners: draw ? [] : tops.map(w => w.label) };

                const seen = new Set();
                const stats = players.filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return !(isTeam && !teamOnly); });

                stats.forEach(p => {
                    const s = P[p.key] || (P[p.key] = { name: p.label, played: 0, wins: 0, draws: 0, results: [], roundScores: [], totalRounds: 0,
                        bestRound: null, worstRound: null, currentStreak: 0, bestStreak: 0, byGame: {} });
                    const win = places[p.id] === 1 && !draw, isDraw = places[p.id] === 1 && draw;
                    s.played++; if (win) s.wins++; if (isDraw) s.draws++;
                    s.results.push({ win, draw: isDraw, place: places[p.id], n, total: p.total, game: gname, t, isLowest });
                    const bg = s.byGame[gname] || (s.byGame[gname] = { played: 0, wins: 0, rounds: 0, sum: 0, isLowest });
                    bg.played++; if (win) bg.wins++;
                    s.currentStreak = win ? s.currentStreak + 1 : 0;
                    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
                    st.history.forEach(r => {
                        const rs = Number(r[p.id]) || 0, good = isLowest ? -rs : rs;
                        s.roundScores.push(rs); s.totalRounds++; bg.rounds++; bg.sum += rs;
                        if (!s.bestRound || good > s.bestRound.good) s.bestRound = { good, value: rs, game: gname, t, isLowest };
                        if (!s.worstRound || good < s.worstRound.good) s.worstRound = { good, value: rs, game: gname, t, isLowest };
                    });
                });

                // Records : toujours comparés à l'intérieur d'un même jeu (barèmes différents)
                const gk = gname.toLowerCase();
                const BR = A.bigBy[gk] || (A.bigBy[gk] = { game: gname, isLowest, count: 0, big: null, res: [] });
                BR.count++;
                players.forEach(p => {
                    BR.res.push({ name: p.label, total: p.total, t });
                    st.history.forEach((r, ri) => {
                        const rs = Number(r[p.id]) || 0;
                        if (!BR.big || rs > BR.big.value) BR.big = { value: rs, name: p.label, round: ri + 1, t };
                    });
                });

                if (!isTeam || teamOnly) for (let i = 0; i < stats.length; i++) for (let j = i + 1; j < stats.length; j++) {
                    const a = stats[i], b = stats[j];
                    const [x, y] = a.key < b.key ? [a, b] : [b, a];
                    const id = x.key + '|' + y.key;
                    const e = pair[id] || (pair[id] = { a: x.key, b: y.key, aw: 0, bw: 0, ties: 0, games: [] });
                    const pa = places[x.id], pb = places[y.id];
                    if (pa < pb) e.aw++; else if (pb < pa) e.bw++; else e.ties++;
                    e.games.push({ t, game: gname, at: x.total, bt: y.total, res: pa < pb ? 'a' : pb < pa ? 'b' : 't' });
                }

                if (n >= 2) {
                    const gap = Math.abs(sorted[0].total - sorted[1].total), r = rel(sorted[0].total, sorted[1].total);
                    const info = { gap, rel: r, a: sorted[0], b: sorted[1], game: gname, t };
                    if (!A.tight || r < A.tight.rel) A.tight = info;
                    if (!A.wide || r > A.wide.rel) A.wide = info;
                    if (st.history.length >= 2) {
                        const prog = this._computeRankProgression(st, isLowest);
                        Object.values(prog).forEach(pr => {
                            if (pr.improvement > 0 && (!A.comeback || pr.improvement > A.comeback.improvement))
                                A.comeback = { improvement: pr.improvement, name: String(pr.player.name).trim().toUpperCase(), from: pr.maxRank, to: pr.finalRank, game: gname, t };
                        });
                    }
                }
                if (!A.long || st.history.length > A.long.rounds) A.long = { rounds: st.history.length, game: gname, t };
            });

            const players = Object.values(P).map(s => {
                const avg = s.totalRounds ? s.roundScores.reduce((a, b) => a + b, 0) / s.totalRounds : 0;
                const std = s.totalRounds ? Math.sqrt(s.roundScores.reduce((a, v) => a + (v - avg) ** 2, 0) / s.totalRounds) : 0;
                const last5 = s.results.slice(-5);
                Object.values(s.byGame).forEach(b => { b.avg = b.rounds ? Math.round(b.sum / b.rounds) : 0; });
                return Object.assign(s, {
                    winRate: s.played ? Math.round((s.wins / s.played) * 100) : 0,
                    reliable: s.played >= this.MIN_RELIABLE,
                    avgPerRound: Math.round(avg), std: Math.round(std),
                    mixed: Object.keys(s.byGame).length > 1,      // barèmes mélangés : moyenne/écart/extrêmes non comparables
                    last5, last5Wins: last5.filter(r => r.win).length
                });
            }).sort((a, b) => {
                if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
                if (a.reliable) return b.winRate - a.winRate || b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name);
                return b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name);
            });

            // Records par jeu (les plus joués d'abord)
            const perGame = Object.values(A.bigBy).sort((a, b) => b.count - a.count).slice(0, 3).map(b => ({
                game: b.game, isLowest: b.isLowest, big: b.big,
                top: b.res.sort((x, y) => b.isLowest ? x.total - y.total : y.total - x.total).slice(0, 3)
            }));

            const reliable = players.filter(p => p.reliable);
            const hot = reliable.filter(p => p.last5Wins > 0)
                .sort((a, b) => b.last5Wins / b.last5.length - a.last5Wins / a.last5.length || b.winRate - a.winRate)[0] || null;

            return {
                gameNames, games: games.length, rounds, players, teamOnly,
                summary: { games: games.length, rounds, people: players.length, last, hot },
                pair, anecdotes: A, perGame, reliableCount: reliable.length
            };
        },

        /** Face-à-face de deux joueurs, du point de vue de `a`. */
        headToHead(an, a, b) {
            const [x, y] = a < b ? [a, b] : [b, a];
            const e = an.pair[x + '|' + y];
            if (!e) return { aw: 0, bw: 0, ties: 0, games: [] };
            const swap = a !== x;
            return {
                aw: swap ? e.bw : e.aw, bw: swap ? e.aw : e.bw, ties: e.ties,
                games: e.games.map(g => ({ t: g.t, game: g.game, at: swap ? g.bt : g.at, bt: swap ? g.at : g.bt, res: g.res === 't' ? 't' : (g.res === 'a') !== swap ? 'a' : 'b' }))
            };
        },

        // --- Records & Highlights ---
        getRecordScores(mode = 'all') {
            const stats = this.calculateStats(mode);
            return stats.sort((a,b) => b.highestScore - a.highestScore).slice(0, 10);
        },

        // --- Helpers (calculateGameHighlights) ---

        /** Highlight: meilleure manche individuelle. */
        _hlBestRound(state, highlights) {
            let best = { score: 0, player: null, roundIdx: 0 };
            state.history.forEach((round, idx) => {
                state.players.forEach(p => {
                    if (round[p.id] > best.score)
                        best = { score: round[p.id], player: p, roundIdx: idx + 1 };
                });
            });
            if (best.player) highlights.push({
                icon: '🔥', label: 'Meilleure manche',
                value: `${escapeHtml(best.player.name)} - ${best.score} pts (M${best.roundIdx})`,
                color: best.player.color
            });
        },

        /** Highlight: plus grande remontée de classement. */

        /**
         * Calcule la progression de rang de chaque joueur au fil des manches.
         * Pour chaque joueur : rang initial, rang à chaque manche, rang final.
         * @returns {Object} Map id → { player, improvement, maxRank, finalRank }
         */
        _computeRankProgression(state, isLowest) {
            // O(P×R) using running totals instead of O(P²×R²) slice-and-resum
            const running = {};
            state.players.forEach(p => { running[p.id] = 0; });

            // ranks[playerId] = list of rank at each round (starts at worst rank)
            const rankHistory = {};
            state.players.forEach(p => { rankHistory[p.id] = [state.players.length]; });

            state.history.forEach(round => {
                state.players.forEach(p => { running[p.id] = (running[p.id] || 0) + (round[p.id] || 0); });
                const sorted = state.players
                    .map(p => ({ id: p.id, total: running[p.id] }))
                    .sort((a, b) => isLowest ? a.total - b.total : b.total - a.total);
                sorted.forEach((entry, idx) => { rankHistory[entry.id].push(idx + 1); });
            });

            const prog = {};
            state.players.forEach(p => {
                const ranks   = rankHistory[p.id].slice(1); // ignore le rang « initial » artificiel
                if (!ranks.length) { prog[p.id] = { player: p, improvement: 0, maxRank: state.players.length, finalRank: state.players.length }; return; }
                const maxRank = Math.max(...ranks);
                prog[p.id] = { player: p, improvement: maxRank - ranks[ranks.length - 1], maxRank, finalRank: ranks[ranks.length - 1] };
            });
            return prog;
        },

        _hlComeback(state, isLowest, highlights) {
            const prog = this._computeRankProgression(state, isLowest);
            const best = Object.values(prog).sort((a, b) => b.improvement - a.improvement)[0];
            if (best?.improvement > 0) highlights.push({
                icon: '⚡', label: 'Comeback King',
                value: `${escapeHtml(best.player.name)} (${best.maxRank}e → ${best.finalRank}e)`,
                color: best.player.color
            });
        },

        /** Highlight: joueur le plus régulier (écart-type minimal). */
        _hlConsistency(state, highlights) {
            const best = state.players.map(p => {
                const scores = state.history.map(r => r[p.id] || 0).filter(s => s > 0);
                if (!scores.length) return { player: p, std: Infinity };
                const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
                const variance = scores.reduce((acc, v) => acc + (v - mean) ** 2, 0) / scores.length;
                return { player: p, std: Math.sqrt(variance), mean };
            }).sort((a, b) => a.std - b.std)[0];
            if (best?.std !== Infinity) highlights.push({
                icon: '🎯', label: 'Joueur régulier',
                value: `${escapeHtml(best.player.name)} (${Math.round(best.mean)} pts/manche)`,
                color: best.player.color
            });
        },

        calculateGameHighlights(state, victoryCondition = VC_HIGHEST) {
            const isLowest = victoryCondition === VC_LOWEST;
            const highlights = [];
            this._hlBestRound(state, highlights);
            
            this._hlComeback(state, isLowest, highlights);

            this._hlConsistency(state, highlights);
            
            if(state.history.length >= MARATHON_THRESHOLD) highlights.push({ icon: '🏃', label: 'Partie Marathon', value: `${state.history.length} manches jouées`, color: 'var(--primary)' });
            return highlights;
        }
    };

