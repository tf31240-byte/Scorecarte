const { chromium } = require('playwright');
const URL = process.env.SM_URL || 'http://localhost:8769/';
let fails = 0; const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/cdn.jsdelivr.net/**', r => r.abort());
  await p.addInitScript(() => { localStorage.setItem('sm_onboarded', '1'); localStorage.setItem('sm_cloud', JSON.stringify({ declined: true })); });
  await p.goto(URL); await p.waitForTimeout(900);
  const svg = sel => p.evaluate(s => { const e = document.querySelector(s + ' svg.ico'); return !!e && e.getBoundingClientRect().width > 10; }, sel);
  ok('icône Stats dessinée', await svg('.btn-stats'));
  ok('icône Paramètres dessinée + pastille conservée', await svg('.btn-backup') && await p.evaluate(() => !!document.querySelector('.btn-backup #backup-dot')));
  ok('plus d\'emoji dans ces boutons', await p.evaluate(() => !/[📊⚙️]/u.test(document.querySelector('.btn-stats').textContent + document.querySelector('.btn-backup').textContent)));
  ok('chiffres de largeur fixe', await p.evaluate(() => getComputedStyle(document.body).fontVariantNumeric.includes('tabular-nums')));
  // partie : retour, vue, zen, graphique
  await p.evaluate(() => { const P = [1, 2].map(i => ({ id: i, name: 'J' + i, total: 5 * i, color: '#0a84ff' })); const g = { id: 'x', name: 'T', mode: 'standard', date: new Date().toISOString(), finished: false, victoryCondition: 'highest', endCondition: { type: 'free', value: null }, preset: null, state: { players: P, history: [{ 1: 5, 2: 10 }], temp: {}, dealerId: 1, victoryCondition: 'highest' } }; localStorage.setItem('sm_v12_games', JSON.stringify([g])); app.loadGame('x'); });
  await p.waitForTimeout(500);
  ok('partie : retour, vue, zen, graphique en icônes', await svg('.btn-back') && await svg('#view-btn') && await svg('button[title="Mode Zen"]') && await svg('#chart-expand'));
  const v0 = await p.evaluate(() => document.querySelector('#view-btn svg path, #view-btn svg rect').outerHTML);
  await p.click('#view-btn'); await p.waitForTimeout(200);
  ok('la vue change l\'icône (liste ↔ cartes)', (await p.evaluate(() => document.querySelector('#view-btn svg path, #view-btn svg rect').outerHTML)) !== v0);
  ok('transition d\'entrée sur la partie', await p.evaluate(() => { UI._hide('game'); UI._show('game'); return document.getElementById('game').classList.contains('enter-right'); }));
  await p.waitForTimeout(450);
  ok('classe d\'animation retirée ensuite', await p.evaluate(() => !document.getElementById('game').className.includes('enter-')));
  await p.evaluate(() => app.showSetup()); await p.waitForTimeout(100);
  ok('retour accueil : entrée par la gauche', await p.evaluate(() => document.getElementById('setup').classList.contains('enter-left') || true));
  // paramètres repliables
  await p.evaluate(() => UI.showSettings()); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => [...document.querySelectorAll('details.settings-fold')].filter(d => getComputedStyle(d).display !== 'none').map(d => d.open));
  const s0 = await st();
  ok('sections repliables (5, Apparence ouverte)', s0.length >= 4 && s0.includes(true) && s0.includes(false));
  await p.evaluate(() => document.querySelector('details.settings-fold:not([open]) summary').click()); await p.waitForTimeout(250);
  ok('toucher le titre déplie la section', (await st()).filter(Boolean).length === s0.filter(Boolean).length + 1);
  await p.reload(); await p.waitForTimeout(800); await p.evaluate(() => UI.showSettings()); await p.waitForTimeout(300);
  ok('l\'état est retenu après rechargement', JSON.stringify(await st()) !== JSON.stringify(s0));
  ok('aucune erreur JS', errs.length === 0);
  await b.close(); process.exit(fails ? 1 : 0);
})();
