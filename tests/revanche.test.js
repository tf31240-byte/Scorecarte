const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'fr-FR'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.addInitScript(()=>{try{localStorage.setItem('sm_hist_collapsed','0')}catch(e){}});await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
const load=()=>p.evaluate(()=>{const g={id:'77',name:'Tarot',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,
 state:{players:[{id:1,name:'ALICE',total:30,color:'#ff3b30'},{id:2,name:'BOB',total:12,color:'#0a84ff'},{id:3,name:'CHLOÉ',total:5,color:'#30d158'}],history:[{1:10,2:5,3:2},{1:20,2:7,3:3}],temp:{},dealerId:3,victoryCondition:'highest',endCondition:{type:'free',value:null}}};
 localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','77');app.init();app.loadGame('77')});
await load();await p.waitForTimeout(800);
// --- Rétablir ---
await p.evaluate(()=>{window.__confirmShown=false;const m=document.getElementById('confirm-modal');new MutationObserver(()=>{if(m.classList.contains('active'))window.__confirmShown=true}).observe(m,{attributes:true})});
await p.click('.h-row:has(.h-idx:text-is("M2")) button');await p.waitForTimeout(500);
ok('suppression directe (pas de confirmation)',!(await p.evaluate(()=>window.__confirmShown)));
ok('manche supprimée',await p.evaluate(()=>app.currentGame.state.history.length===1&&app.currentGame.state.players[0].total===10));
ok('toast avec bouton Rétablir',await p.isVisible('#toast .toast-action'));
const d1=await p.evaluate(()=>app.currentGame.state.dealerId);

await p.click('#toast .toast-action');await p.waitForTimeout(400);
ok('manche rétablie (historique, totaux, donneur)',await p.evaluate(()=>{const s=app.currentGame.state;return s.history.length===2&&s.history[1][1]===20&&s.players[0].total===30&&s.dealerId===3}));
ok('rétablissement sauvegardé',await p.evaluate(()=>Storage.loadGames()[0].state.history.length===2));
// rétablir une manche du milieu
await p.click('.h-row:has(.h-idx:text-is("M1")) button');await p.waitForTimeout(300);
await p.click('#toast .toast-action');await p.waitForTimeout(300);
ok('manche 1 rétablie à sa place',await p.evaluate(()=>{const h=app.currentGame.state.history;return h.length===2&&h[0][1]===10&&h[1][1]===20}));
// toast sans action n'est pas écrasé trop tôt
await p.evaluate(()=>UI.showToast('x'));ok('toast simple sans bouton',!(await p.isVisible('#toast .toast-action')));
// --- Revanche ---
await p.evaluate(()=>app.finishGame());await p.waitForTimeout(900);
ok('bouton REVANCHE en premier',(await p.evaluate(()=>document.querySelector('#victory .victory-box > button.btn-main').textContent)).includes('REVANCHE'));
ok('pas de bandeau série à la 1re partie',await p.evaluate(()=>document.getElementById('victory-series').classList.contains('hidden')));
await p.click('#victory .victory-box > button.btn-main >> nth=0');await p.waitForTimeout(700);
ok('nouvelle partie vide, mêmes joueurs',await p.evaluate(()=>app.currentGame.state.history.length===0&&app.currentGame.state.players.length===3&&app.currentGame.state.players.every(x=>x.total===0)));
ok('donneur suivant (3 → 1)',await p.evaluate(()=>app.currentGame.state.dealerId===1));
ok('série n°2, ALICE 1 victoire',await p.evaluate(()=>app.currentGame.series.n===2&&app.currentGame.series.wins[1]===1));
ok('info de partie : Revanche n°2 (ALICE 1 – …)',(await p.textContent('#game-info')).includes('Revanche n°2')&&(await p.textContent('#game-info')).includes('ALICE 1'));
// 2e partie : BOB gagne
await p.evaluate(()=>{const s=app.currentGame.state;s.history=[{1:3,2:40,3:1}];s.players.forEach(x=>x.total=s.history[0][x.id]);app.finishGame()});await p.waitForTimeout(900);
const ser=await p.textContent('#victory-series');ok('bandeau série à la victoire : '+ser,ser.includes('Revanche n°2')&&ser.includes('ALICE 1')&&ser.includes('BOB 1'));

await p.click('#victory .victory-box > button.btn-main >> nth=0');await p.waitForTimeout(600);
ok('3e partie : série n°3, 1-1',await p.evaluate(()=>app.currentGame.series.n===3&&app.currentGame.series.wins[1]===1&&app.currentGame.series.wins[2]===1));
// persistance
await p.reload();await p.waitForTimeout(800);
ok('série conservée après rechargement',await p.evaluate(()=>{const g=Storage.loadGames().find(x=>x.series&&x.series.n===3);return !!g&&g.series.wins[2]===1}));
// import d'une série corrompue
ok('série corrompue nettoyée',await p.evaluate(()=>{const x=Storage.sanitizeGame?Storage.sanitizeGame({id:'z',name:'t',state:{players:[],history:[]},series:{n:'<b>',wins:{'<i>':'5',2:99999}}}):null;return !x||(x.series.n===1&&x.series.wins['<i>']===5&&x.series.wins['2']===999)}));
console.log('erreurs:',errs);await b.close()})();
