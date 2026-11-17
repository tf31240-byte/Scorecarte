const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.dismiss());
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
const mk=(n,mode,vc,names)=>p.evaluate(([n,mode,vc,names])=>{const cols=['#ff3b30','#0a84ff','#30d158','#ff9f0a','#bf5af2','#64d2ff'];
 const players=Array.from({length:n},(_,i)=>({id:i+1,name:(names&&names[i])||'J'+(i+1),total:i*3,color:cols[i%6]}));
 const g={id:'88',name:'Audit',mode,date:new Date().toISOString(),finished:false,victoryCondition:vc,endCondition:{type:'free',value:null},preset:null,state:{players,history:[players.reduce((o,x)=>(o[x.id]=x.total,o),{})],temp:{},dealerId:1,victoryCondition:vc,endCondition:{type:'free',value:null}}};
 localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','88');app.init();app.loadGame('88')},[n,mode,vc,names]);
// 1. 12 joueurs, victoire au plus bas, nom HTML
await mk(12,'standard','lowest',['<img src=x onerror=window.__xss=1>']);await p.waitForTimeout(600);
await p.evaluate(()=>app.openSheet(1));await p.waitForTimeout(300);
let guard=0;while((await p.textContent('#next-btn')).includes('Suivant')&&guard++<30){await p.keyboard.press(String(guard%10));await p.click('#next-btn');}
ok('12 joueurs : le tour se termine en OK ('+guard+' pas)',(await p.textContent('#next-btn')).includes('OK')&&guard<=12);
ok('pas de XSS via chips',!(await p.evaluate(()=>window.__xss)));
await p.keyboard.press('3');await p.click('#next-btn');await p.waitForTimeout(300);
ok('lowest : sheet fermée, ready',await p.evaluate(()=>!document.getElementById('sheet').classList.contains('active')&&document.getElementById('save-btn').classList.contains('ready')));
await p.click('#save-btn',{force:true});await p.waitForTimeout(500);
ok('manche enregistrée (12 joueurs)',await p.evaluate(()=>app.currentGame.state.history.length===2));
// 2. aucune saisie sur un joueur : tour => OK ferme sans ready si tous non définis
await p.evaluate(()=>app.openSheet(2));await p.keyboard.press('Escape');await p.waitForTimeout(200);
ok('Échap ferme, pas ready',await p.evaluate(()=>!document.getElementById('sheet').classList.contains('active')&&!document.getElementById('save-btn').classList.contains('ready')));
// 3. Clavier ignoré hors sheet
await p.keyboard.press('5');ok('chiffre hors sheet sans effet',await p.evaluate(()=>Object.keys(app.currentGame.state.temp).length===0));
// 4. Belote : saisie complète + Entrée
await mk(2,'belote','highest',null);await p.waitForTimeout(500);
await p.evaluate(()=>app.openSheet(1));await p.waitForTimeout(300);
await p.keyboard.press('8');await p.keyboard.press('2');
ok('belote clavier: 82',await p.evaluate(()=>app.currentGame.state.temp[1]===82));
await p.keyboard.press('Enter');await p.waitForTimeout(300);ok('belote Entrée ferme',await p.evaluate(()=>!document.getElementById('sheet').classList.contains('active')));
ok('belote : pas de ready',!(await p.evaluate(()=>document.getElementById('save-btn').classList.contains('ready'))));
await p.click('#save-btn');await p.waitForTimeout(500);
ok('belote : manche enregistrée',await p.evaluate(()=>app.currentGame.state.history.length===2));
// 5. Historique : partie vide, changement de partie
await mk(3,'standard','highest',null);await p.evaluate(()=>{app.currentGame.state.history=[];app.render()});
ok('0 manche : pas de ligne ni compteur',await p.evaluate(()=>document.getElementById('history-last').innerHTML===''&&document.getElementById('history-count').textContent===''));
// 6. Zen puis retour accueil : wake lock/état
await p.evaluate(()=>{window.__wl=0;Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{window.__wl++;return{release:async()=>{window.__wl--},addEventListener(){}}}}})});
await p.click('.btn-focus');await p.waitForTimeout(500);
await p.evaluate(()=>app.showSetup());await p.waitForTimeout(300);
ok('quitter la partie en Zen : verrou libéré',await p.evaluate(()=>window.__wl===0&&!document.body.classList.contains('focus-mode')));
// 7. Mode édition + zen label
await mk(3,'standard','highest',null);await p.waitForTimeout(400);
await p.evaluate(()=>{app.currentGame.state.history=[{1:1,2:2,3:3},{1:4,2:5,3:6}];app.currentGame.state.players.forEach(x=>x.total=[5,7,9][x.id-1]);app.render()});
await p.evaluate(()=>app.startEdit(0));await p.evaluate(()=>app.openSheet(1));
ok('édition : chips avec total, pas de "–"',(await p.$$eval('.sel-val',e=>e.map(x=>x.textContent))).every(t=>t!=='–'));
await p.evaluate(()=>app.cancelEdit());
console.log('errs',errs);await b.close()})();
