const { chromium } = require('playwright');
const URL = process.env.SM_URL || 'http://localhost:8769/';
let fails = 0; const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) fails++; };
const seed = n => () => {};
(async () => {
  const b = await chromium.launch();
  const open = async (nFinished) => {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.route('**/cdn.jsdelivr.net/**', r => r.abort());
    await p.addInitScript(n => {
      localStorage.setItem('sm_onboarded', '1'); localStorage.setItem('sm_cloud', JSON.stringify({ declined: true }));
      const mk = (id, fin) => ({ id, name: 'Partie ' + id, mode: 'standard', date: new Date().toISOString(), finished: fin, victoryCondition: 'highest', endCondition: { type: 'free', value: null }, preset: null,
        state: { players: [1, 2].map(i => ({ id: i, name: 'J' + i, total: 10 * i, color: '#0a84ff' })), history: [{ 1: 10, 2: 20 }], temp: {}, dealerId: 1, victoryCondition: 'highest' } });
      localStorage.setItem('sm_v12_games', JSON.stringify(Array.from({ length: n }, (_, i) => mk('g' + i, true)).concat([mk('cur', false)])));
    }, nFinished);
    await p.goto(URL); await p.waitForTimeout(900); return p;
  };
  let p = await open(1);
  ok('« Tout effacer » n\'est plus sur l\'accueil', !(await p.$('#clear-all-btn')) && !(await p.evaluate(() => document.getElementById('history-section').innerText.toUpperCase().includes('TOUT EFFACER'))));
  ok('Guide Rapide visible avec peu de parties', await p.evaluate(() => getComputedStyle(document.getElementById('home-guide')).display !== 'none'));
  ok('« Nouvelle partie » est le bouton principal', await p.evaluate(() => document.querySelector('.mode-btn-main h2').textContent === 'Nouvelle partie'));
  ok('filtres en pastilles sur une ligne', await p.evaluate(() => { const b = document.querySelector('.history-filter-btn'); return !!b && getComputedStyle(b).flexDirection === 'row' && b.getBoundingClientRect().height < 44; }));
  ok('message de vide sur une ligne courte', await p.evaluate(() => { const e = document.getElementById('history-placeholder'); return e.getBoundingClientRect().height < 70; }));
  await p.evaluate(() => { UI.showSettings(); document.querySelector('.settings-advanced').open = true; }); await p.waitForTimeout(300);
  const row = await p.$('text=Effacer toutes les parties');
  ok('réglage « Effacer toutes les parties » dans les paramètres avancés', !!row);
  await row.click(); await p.waitForTimeout(300);
  ok('demande confirmation', await p.evaluate(() => document.getElementById('confirm-modal').classList.contains('active')));
  ok('rien effacé avant confirmation', await p.evaluate(() => Storage.loadGames().length === 2));
  await p.click('#confirm-yes-btn'); await p.waitForTimeout(500);
  ok('confirmé : tout est effacé', await p.evaluate(() => Storage.loadGames().length === 0));
  ok('aucune erreur JS', p.errs.length === 0);
  p = await open(3);
  ok('Guide Rapide masqué dès 3 parties', await p.evaluate(() => getComputedStyle(document.getElementById('home-guide')).display === 'none'));
  ok('Entrée sur « Nouvelle partie » (clavier)', await (async () => { await p.focus('.mode-btn-main'); await p.keyboard.press('Enter'); await p.waitForTimeout(400); return p.evaluate(() => document.querySelector('.preset-card, .preset-grid, #preset-modal.active, #presets-modal.active') !== null); })());
  await b.close(); process.exit(fails ? 1 : 0);
})();
