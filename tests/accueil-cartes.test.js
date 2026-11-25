const { chromium } = require('playwright');
let fails = 0; const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('sm_onboarded', '1'); localStorage.setItem('sm_cloud', '{"declined":true}');
    const N = ['Emma', 'Levi', 'Arthur'], C = ['#3b82f6', '#ef4444', '#22c55e'];
    const hist = n => Array.from({ length: n }, (_, r) => Object.fromEntries(N.map((_, i) => [i + 1, ((r * 7 + i * 11) % 23) + 2])));
    const g = (id, preset, nm, h, f, d, ec) => ({ id, name: nm, mode: 'standard', date: new Date(Date.now() - d * 86400000).toISOString(), finished: f, victoryCondition: 'lowest', endCondition: ec, preset, state: { players: N.map((n, i) => ({ id: i + 1, name: n, total: 0, color: C[i] })), history: h, temp: {}, dealerId: 1, victoryCondition: 'lowest' } });
    const free = { type: 'free', value: null }, lim = { type: 'score', value: 100 };
    localStorage.setItem('sm_v12_games', JSON.stringify([g('old', 'skyjo', 'Vieux', hist(3), true, 9, free), g('rec', 'uno', 'Récent', hist(2), true, 1, free), g('a', 'skyjo', 'Skyjo', hist(4), false, 0, lim), g('b', 'uno', 'Libre', hist(2), false, 0, free)]));
  });
  await p.goto('http://localhost:8769/'); await p.waitForTimeout(900);
  ok('plus de badge « En cours » redondant', await p.evaluate(() => !document.querySelector('.current-badge') && !document.body.innerText.toUpperCase().includes('EN COURS •')));
  ok('date relative « Aujourd\'hui »', await p.evaluate(() => document.querySelector('.current-meta').textContent.includes("Aujourd'hui")));
  ok('barre de limite uniquement pour la partie avec limite', await p.evaluate(() => document.querySelectorAll('.cg-prog').length === 1 && document.querySelector('.cg-prog').textContent.includes('Limite 100')));
  ok('barre : largeur cohérente avec le score max', await p.evaluate(() => { const w = parseFloat(document.querySelector('.cg-bar i').style.width); return w > 0 && w <= 100; }));
  ok('meneur mis en valeur', await p.evaluate(() => document.querySelectorAll('.player-chip.lead').length >= 1));
  await p.evaluate(() => { const b = document.querySelector('.filter-pill, #history-filters button'); b && b.click(); }); await p.waitForTimeout(400);
  const titles = await p.evaluate(() => [...document.querySelectorAll('.game-item-collapsed .collapsed-title')].map(e => e.textContent));
  ok('historique trié du plus récent au plus ancien', titles[0] === 'Récent' && titles[1] === 'Vieux');
  ok('« Hier » pour la partie d\'hier', await p.evaluate(() => document.querySelector('.collapsed-date').textContent.startsWith('Hier')));
  ok('vainqueur en pastille avec icône SVG', await p.evaluate(() => !!document.querySelector('.collapsed-winner svg') && !document.getElementById('games-list').innerText.includes('▼')));
  await p.click('.collapsed-header'); await p.waitForTimeout(400);
  ok('détails : boutons avec icônes SVG, sans emoji', await p.evaluate(() => { const d = document.querySelector('.game-item-collapsed.expanded .game-item-actions'); return !!d && d.querySelectorAll('svg').length === 2 && !/[▶🗑]/.test(d.textContent); }));
  ok('aucune erreur JS', errs.length === 0); if (errs.length) console.log(errs);
  await b.close(); process.exit(fails ? 1 : 0);
})();
