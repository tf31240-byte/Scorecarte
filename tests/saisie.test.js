const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'fr-FR'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
const load=(mode)=>p.evaluate((mode)=>{const g={id:'77',name:'Test',mode,date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,
 state:{players:[{id:1,name:'ALICE',total:30,color:'#ff3b30'},{id:2,name:'BOB',total:12,color:'#0a84ff'},{id:3,name:'CHLOÉ',total:5,color:'#30d158'}],history:[{1:10,2:5,3:2},{1:20,2:7,3:3}],temp:{},dealerId:3,victoryCondition:'highest',endCondition:{type:'free',value:null}}};
 localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','77');app.init();app.loadGame('77')},mode);
const num=d=>p.click(`#sheet .btn-nb:text-is("${d}")`);
const act=()=>p.evaluate(()=>app.activePlayerId);
await load('standard');await p.waitForTimeout(800);
// historique replié par défaut
ok('historique replié par défaut',!(await p.isVisible('#history')));
ok('compteur (2)',(await p.textContent('#history-toggle')).includes('(2)'));
await p.click('#history-toggle');ok('déplié au clic',await p.isVisible('#history'));
await p.reload();await p.waitForTimeout(800);ok('état mémorisé après rechargement',await p.isVisible('#history'));
await p.click('#history-toggle');ok('replié',!(await p.isVisible('#history')));

// saisie : commence par CHLOÉ
await p.evaluate(()=>app.openSheet(3));await p.waitForTimeout(400);
ok('Suivant affiché',(await p.textContent('#next-btn')).includes('Suivant'));
await num(7);await p.click('#next-btn');ok('CHLOÉ → ALICE (1er non rempli)',await act()===1);
await p.click('#next-btn');ok('sans saisie : saute à BOB (non rempli), ALICE reste à faire',await act()===2);
await p.click('#next-btn');ok('revient à ALICE (non remplie)',await act()===1);
await num(4);await p.click('#next-btn');ok('→ BOB',await act()===2);
ok('un seul bouton OK',!(await p.isVisible('#ok-btn'))&&await p.isVisible('#next-btn'));ok('BOB : dernier à remplir → bouton OK',(await p.textContent('#next-btn')).includes('OK'));
await num(5);
ok('pas encore enregistré',await p.evaluate(()=>app.currentGame.state.history.length===2));
await p.click('#next-btn');await p.waitForTimeout(500);
ok('sheet fermée',!(await p.evaluate(()=>document.getElementById('sheet').classList.contains('active'))));
ok('manche PAS enregistrée automatiquement',await p.evaluate(()=>app.currentGame.state.history.length===2));
ok('bouton Enregistrer en couleur (ready)',await p.evaluate(()=>document.getElementById('save-btn').classList.contains('ready')));

await p.click('#save-btn',{force:true});await p.waitForTimeout(500);
ok('manche enregistrée au clic',await p.evaluate(()=>{const s=app.currentGame.state;return s.history.length===3&&s.history[2][1]===4&&s.history[2][2]===5&&s.history[2][3]===7}));
ok('ready retiré',!(await p.evaluate(()=>document.getElementById('save-btn').classList.contains('ready'))));
ok('compteur (3)',(await p.textContent('#history-toggle')).includes('(3)'));
// réouverture : ready retiré
await p.evaluate(()=>app.openSheet(1));await num(1);await p.evaluate(()=>app.closeSheet());
ok('saisie partielle : pas ready',!(await p.evaluate(()=>document.getElementById('save-btn').classList.contains('ready'))));
await p.evaluate(()=>{app.state=null});
// édition : ordre séquentiel
await p.evaluate(()=>{app.currentGame.state.temp={};app.startEdit(0);app.openSheet(1)});await p.waitForTimeout(300);
await p.click('#next-btn');ok('édition : ALICE → BOB',await act()===2);await p.click('#next-btn');ok('→ CHLOÉ',await act()===3);
ok('édition : dernier → OK',(await p.textContent('#next-btn')).includes('OK'));
await p.click('#next-btn');await p.waitForTimeout(300);ok('édition : ferme sans enregistrer',await p.evaluate(()=>app.currentGame.state.history.length===3&&app.editIdx===0));
await p.evaluate(()=>app.cancelEdit());
// belote inchangé
await load('belote');await p.waitForTimeout(600);
await p.evaluate(()=>app.openSheet(1));await p.waitForTimeout(300);
ok('belote : pas de Suivant, OK présent',!(await p.isVisible('#next-btn'))&&await p.isVisible('#ok-btn'));
await p.click('#ok-btn');ok('belote : pas de ready',!(await p.evaluate(()=>document.getElementById('save-btn').classList.contains('ready'))));
console.log('errs',errs);await b.close()})();
