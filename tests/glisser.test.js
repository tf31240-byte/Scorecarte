const { chromium } = require('playwright');
const URL = process.env.SM_URL || 'http://localhost:8769/';
let fails = 0; const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/cdn.jsdelivr.net/**', r => r.abort());
  await p.addInitScript(() => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
    const mk = (id, name) => ({ id, name, mode: 'standard', date: new Date().toISOString(), finished: false, victoryCondition: 'highest', endCondition: { type: 'free', value: null }, preset: null,
      state: { players: [1, 2].map(i => ({ id: i, name: 'J' + i, total: 10 * i, color: '#0a84ff' })), history: [{ 1: 10, 2: 20 }], temp: {}, dealerId: 1, victoryCondition: 'highest' } });
    localStorage.setItem('sm_v12_games', JSON.stringify([mk('g1', 'Partie A'), mk('g2', 'Partie B')]));
    localStorage.removeItem('sm_v12_current'); localStorage.setItem('sm_onboarded', '1');
  });
  await p.goto(URL); await p.waitForTimeout(900);
  const rows = () => p.$$('.swipe-wrap');
  ok('2 parties en cours, lignes glissables', (await rows()).length === 2);
  const box = async i => (await (await rows())[i].$('.current-game-item')).boundingBox();
  const drag = async (i, dx, dy = 0) => { const bx = await box(i); const x = bx.x + bx.width - 30, y = bx.y + bx.height / 2;
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x - dx / 2, y + dy / 2, { steps: 4 }); await p.mouse.move(x - dx, y + dy, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(700); };
  const isOpen = async i => (await rows())[i].evaluate(w => w.classList.contains('open'));
  const tx = async i => (await rows())[i].evaluate(w => new DOMMatrix(getComputedStyle(w.querySelector('.current-game-item')).transform).m41);

  await p.evaluate(() => { app._swipeLongMs = 60000; }); // les glissés lents (machine chargée) ne doivent pas passer pour des appuis longs
  await drag(0, 150, 0);
  ok('glissé gauche : la ligne s\'ouvre', await isOpen(0));
  await p.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.swipe-wrap .current-game-item')).transform).m41 + 94) < 2, null, { timeout: 4000 }).catch(() => {});
  ok('décalage de la largeur du bouton', Math.abs(await tx(0) + 94) < 2);
  ok('bouton Supprimer visible', await p.evaluate(() => getComputedStyle(document.querySelector('.swipe-wrap.open .swipe-del')).display !== 'none'));
  await drag(1, 150, 0);
  ok('une seule ligne ouverte à la fois', !(await isOpen(0)) && await isOpen(1));
  await (await rows())[1].$eval('.current-game-item', e => e.click()); await p.waitForTimeout(300);
  ok('toucher une ligne ouverte la referme (sans ouvrir la partie)', !(await isOpen(1)) && await p.evaluate(() => !app.currentGame));
  await drag(0, 20, 0);
  ok('petit glissé : la ligne revient', !(await isOpen(0)));
  await drag(0, 5, 120);
  ok('défilement vertical : ne déclenche rien', !(await isOpen(0)));
  await drag(0, -120, 0);
  ok('glissé vers la droite : rien', !(await isOpen(0)));

  await p.evaluate(() => { app._swipeLongMs = 550; });
  const bx = await box(0); await p.mouse.move(bx.x + 100, bx.y + 40); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(700);
  ok('appui prolongé : la ligne s\'ouvre', await isOpen(0));
  ok('et ne lance pas la partie', await p.evaluate(() => !app.currentGame));
  await p.click('.swipe-wrap.open .swipe-del'); await p.waitForTimeout(300);
  ok('Supprimer demande confirmation', await p.evaluate(() => document.getElementById('confirm-modal').classList.contains('active')));
  ok('rien supprimé avant confirmation', (await rows()).length === 2);
  await p.evaluate(() => UI.closeConfirm()); await p.waitForTimeout(300);
  ok('annuler : les 2 parties sont conservées', await p.evaluate(() => Storage.loadGames().length === 2));
  await p.click('.swipe-wrap.open .swipe-del'); await p.waitForTimeout(300);
  await p.click('#confirm-yes-btn'); await p.waitForTimeout(500);
  ok('confirmer : la partie est supprimée', (await rows()).length === 1 && await p.evaluate(() => Storage.loadGames().length === 1));

  await p.evaluate(() => { app._swipeLongMs = 60000; });
  await drag(0, 330, 0); await p.waitForTimeout(200);
  ok('grand glissé : demande la suppression', await p.evaluate(() => document.getElementById('confirm-modal').classList.contains('active')));
  await p.evaluate(() => UI.closeConfirm()); await p.waitForTimeout(300);
  ok('et la ligne revient en place', !(await isOpen(0)));
  await (await rows())[0].$eval('.current-game-item', e => e.click()); await p.waitForTimeout(500);
  ok('un simple toucher ouvre toujours la partie', await p.evaluate(() => !!app.currentGame));
  ok('aucune erreur JS', errs.length === 0);
  await b.close(); process.exit(fails ? 1 : 0);
})();
