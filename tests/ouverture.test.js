const { chromium } = require('playwright');
const URL = process.env.SM_URL || 'http://localhost:8769/';
let fails = 0; const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/cdn.jsdelivr.net/**', r => r.abort());
  await p.addInitScript(() => {
    localStorage.setItem('sm_onboarded', '1'); localStorage.setItem('sm_cloud', JSON.stringify({ declined: true }));
    const mk = (id, tot) => ({ id, name: 'P' + id, mode: 'standard', date: new Date().toISOString(), finished: false, victoryCondition: 'highest', endCondition: { type: 'free', value: null }, preset: null,
      state: { players: tot.map((t, i) => ({ id: i + 1, name: 'J' + (i + 1), total: t, color: '#0a84ff' })), history: [Object.fromEntries(tot.map((t, i) => [i + 1, t]))], temp: {}, dealerId: 1, victoryCondition: 'highest' } });
    localStorage.setItem('sm_v12_games', JSON.stringify([mk('a', [50, 40, 30, 20]), mk('b', [10, 20, 30, 40])]));
  });
  await p.goto(URL); await p.waitForTimeout(800);
  const anims = () => p.evaluate(() => ({ cards: document.querySelectorAll('.p-card.rank-change').length, badges: document.querySelectorAll('.rank-badge.bounce').length }));
  await p.evaluate(() => app.loadGame('a')); await p.waitForTimeout(300);
  let a = await anims(); ok('1re partie ouverte : aucune carte ne rebondit', a.cards === 0 && a.badges === 0);
  await p.evaluate(() => app.showSetup()); await p.waitForTimeout(200);
  await p.evaluate(() => app.loadGame('b')); await p.waitForTimeout(300);
  a = await anims(); ok('2e partie (classement inverse) : aucune carte ne rebondit à l\'ouverture', a.cards === 0 && a.badges === 0);
  ok('aucune erreur JS', errs.length === 0);
  await b.close(); process.exit(fails ? 1 : 0);
})();
