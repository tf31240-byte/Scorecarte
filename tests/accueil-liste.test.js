const { chromium } = require('playwright');
const URL = process.env.SM_URL || 'http://localhost:8769/';
let fails = 0; const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const w of [390, 320]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 844 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/cdn.jsdelivr.net/**', r => r.abort());
    await p.addInitScript(() => {
      localStorage.setItem('sm_onboarded', '1'); localStorage.setItem('sm_cloud', JSON.stringify({ declined: true }));
      const mk = (id, name, n, d) => ({ id, name, mode: 'standard', date: new Date(Date.now() - d * 60000).toISOString(), finished: false, victoryCondition: 'highest', endCondition: { type: 'free', value: null }, preset: null,
        state: { players: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: ['Levi', 'Quentin', 'Valentin', 'Emma', 'Arthur', 'Thibo', 'Nath'][i], total: 0, color: '#0a84ff' })), history: [{ 1: 1 }], temp: {}, dealerId: 1, victoryCondition: 'highest' } });
      localStorage.setItem('sm_v12_games', JSON.stringify([mk('a', 'Partie Standard', 5, 1), mk('b', 'Partie Standard', 7, 2), mk('c', 'Duel', 2, 3), mk('d', 'Partie Standard', 3, 4)]));
    });
    await p.goto(URL); await p.waitForTimeout(900);
    ok(`${w}px : pastilles de chaque partie sur une seule ligne`, await p.evaluate(() => [...document.querySelectorAll('.current-scores')].every(e => e.getBoundingClientRect().height < 50)));
    ok(`${w}px : aucune pastille ne déborde de la carte`, await p.evaluate(() => [...document.querySelectorAll('.current-scores')].every(box => { const r = box.getBoundingClientRect(); return [...box.children].filter(c => c.style.display !== 'none').every(c => c.getBoundingClientRect().right <= r.right + 1); })));
    ok(`${w}px : « +N » = joueurs masqués`, await p.evaluate(() => [...document.querySelectorAll('.current-scores')].every(box => { const chips = [...box.querySelectorAll('.player-chip:not(.player-chip-more)')], hid = chips.filter(c => c.style.display === 'none').length, m = box.querySelector('.player-chip-more'); return hid === 0 ? m.style.display === 'none' : m.textContent === '+' + hid; })));
    ok(`${w}px : titre et boutons sur la même ligne, titre non coupé`, await p.evaluate(() => { const t = document.querySelector('.welcome-title'), s = document.querySelector('.btn-stats'); const a = t.getBoundingClientRect(), b = s.getBoundingClientRect(); return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 30 && t.scrollWidth <= t.clientWidth + 1 && a.right < b.left; }));
    ok(`${w}px : écart entre le titre et les boutons ≥ 10 px`, await p.evaluate(() => document.querySelector('.btn-stats').getBoundingClientRect().left - document.querySelector('.welcome-title').getBoundingClientRect().right >= 10 || document.querySelector('.welcome-title').scrollWidth + 10 <= document.querySelector('.btn-stats').getBoundingClientRect().left - document.querySelector('.welcome-title').getBoundingClientRect().left));
    if (w === 390) {
      const titles = await p.evaluate(() => [...document.querySelectorAll('.current-title')].map(e => e.textContent));
      ok('noms identiques : la plus ancienne garde son nom, les autres (2), (3)', titles.filter(t => t === 'Partie Standard').length === 1 && titles.includes('Partie Standard (2)') && titles.includes('Partie Standard (3)'));
      ok('le nom enregistré n\'est pas modifié', await p.evaluate(() => Storage.loadGames().every(g => !/\(\d\)$/.test(g.name))));
      ok('Skyjo n\'est plus un carré bleu', await p.evaluate(() => GAME_PRESETS.skyjo.icon !== '🟦'));
    }
    ok(`${w}px : aucune erreur JS`, errs.length === 0);
  }
  await b.close(); process.exit(fails ? 1 : 0);
})();
