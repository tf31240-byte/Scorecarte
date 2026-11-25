const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.SM_URL || 'http://localhost:8769/';
const CJ = process.env.CHARTJS || '/tmp/claude-0/-home-claude/d8ad8805-45ec-505d-8ce0-a82400af1b78/scratchpad/cj/package/dist/chart.umd.js';
let fails = 0; const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/cdn.jsdelivr.net/**', r => fs.existsSync(CJ) ? r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(CJ) }) : r.abort());
  await p.addInitScript(() => {
    localStorage.setItem('sm_onboarded', '1'); localStorage.setItem('sm_cloud', JSON.stringify({ declined: true }));
    const names = ['Emma', 'Levi', 'Arthur', 'Quentin', 'Valentin'], cols = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7'];
    const hist = Array.from({ length: 6 }, (_, r) => Object.fromEntries(names.map((_, i) => [i + 1, ((r * 7 + i * 11) % 23) + 2])));
    const g = (id, h) => ({ id, name: 'Skyjo', mode: 'standard', date: new Date().toISOString(), finished: false, victoryCondition: 'lowest', endCondition: { type: 'score', value: 100 }, preset: 'skyjo',
      state: { players: names.map((n, i) => ({ id: i + 1, name: n, total: 0, color: cols[i] })), history: h, temp: {}, dealerId: 1, victoryCondition: 'lowest' } });
    localStorage.setItem('sm_v12_games', JSON.stringify([g('a', hist), g('e', [])]));
  });
  await p.goto(URL); await p.waitForTimeout(900);
  await p.evaluate(() => app.loadGame('a')); await p.waitForTimeout(900);
  const chartOk = await p.evaluate(() => typeof Chart !== 'undefined');
  ok('Chart.js disponible pour le test', chartOk);
  await p.click('#chart-box'); await p.waitForTimeout(700);
  ok('plein écran ouvert', await p.evaluate(() => document.getElementById('chart-full').classList.contains('active')));
  ok('le canvas occupe une vraie surface (≥ 250 px de haut)', await p.evaluate(() => document.getElementById('chart-full-canvas').getBoundingClientRect().height >= 250));
  ok('avec manches : pas de message parasite', await p.evaluate(() => getComputedStyle(document.getElementById('chart-full-empty')).display === 'none'));
  ok('courbe : 5 joueurs, 7 points (0 + 6 manches)', await p.evaluate(() => ChartFull.chart.data.datasets.length === 5 && ChartFull.chart.data.labels.length === 7));
  ok('légende : 5 pastilles avec nom et score', await p.evaluate(() => document.querySelectorAll('.cf-chip').length === 5 && [...document.querySelectorAll('.cf-chip')].every(c => c.querySelector('.cf-name').textContent && c.querySelector('.cf-score').textContent !== '')));
  ok('pastilles ≥ 44 px (tactile)', await p.evaluate(() => [...document.querySelectorAll('.cf-chip')].every(c => c.getBoundingClientRect().height >= 43)));
  await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/cf-total.png' : '/dev/null'.replace('/dev/null', '/tmp/cf-total.png') });
  await p.click('.cf-chip'); await p.waitForTimeout(300);
  ok('toucher une pastille masque la courbe', await p.evaluate(() => document.querySelectorAll('.cf-chip.off').length === 1 && ChartFull.chart.data.datasets.filter(d => d.hidden).length === 1));
  await p.click('.cf-chip.off'); await p.waitForTimeout(300);
  ok('retoucher la réaffiche', await p.evaluate(() => document.querySelectorAll('.cf-chip.off').length === 0));
  await p.click('#chart-full-mode button[data-mode=round]'); await p.waitForTimeout(400);
  ok('« Par manche » : 6 points par joueur', await p.evaluate(() => ChartFull.chart.data.datasets[0].data.length === 6 && ChartFull.mode === 'round'));
  await p.screenshot({ path: '/tmp/cf-round.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok('Échap ferme', await p.evaluate(() => !document.getElementById('chart-full').classList.contains('active') && !ChartFull.chart));
  // partie sans manche
  await p.evaluate(() => app.loadGame('e')); await p.waitForTimeout(800);
  await p.click('#chart-box'); await p.waitForTimeout(500);
  ok('sans manche : message au lieu d\'un graphique vide', await p.evaluate(() => !document.getElementById('chart-full-empty').hidden));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('axe compact vide : pas de graduations décimales', await p.evaluate(() => { const y = app.chart && app.chart.options.scales.y; return !y || Number.isInteger(y.max); }));
  // paysage
  await p.evaluate(() => app.loadGame('a')); await p.waitForTimeout(600);
  await p.setViewportSize({ width: 844, height: 390 }); await p.click('#chart-expand'); await p.waitForTimeout(600);
  ok('paysage : graphique ≥ 160 px de haut', await p.evaluate(() => document.getElementById('chart-full-canvas').getBoundingClientRect().height >= 160));
  await p.screenshot({ path: '/tmp/cf-land.png' });
  ok('aucune erreur JS', errs.length === 0);
  if (errs.length) console.log(errs);
  await b.close(); process.exit(fails ? 1 : 0);
})();
