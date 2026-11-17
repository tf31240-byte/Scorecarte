const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'fr-FR'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.addInitScript(()=>{try{localStorage.setItem('sm_hist_collapsed','0')}catch(e){}});await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
await p.evaluate(()=>{const g={id:77,name:'Tarot',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},
 state:{players:[{id:1,name:'ALICE',total:30,color:'#ff3b30'},{id:2,name:'BOB',total:12,color:'#0a84ff'},{id:3,name:'CHLOÉ',total:5,color:'#30d158'}],history:[{1:10,2:5,3:2},{1:20,2:7,3:3}],temp:{},dealerId:3,victoryCondition:'highest',endCondition:{type:'free',value:null}}};
 localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','77');app.init();app.loadGame(77)});
await p.waitForTimeout(900);
ok('bouton ANNULER supprimé',!(await p.content()).includes('ANNULER'));
ok('TERMINER toujours présent',await p.isVisible('text=✓ TERMINER'));
ok('pas d\'API undo résiduelle',await p.evaluate(()=>typeof app.undo==='undefined'));
ok('hors édition : pas de cadre',await p.evaluate(()=>!document.body.classList.contains('is-editing')));

// éditer la manche 1
await p.click('.h-row:has(.h-idx:text-is("M1")) .h-scores');await p.waitForTimeout(500);
ok('édition : body.is-editing',await p.evaluate(()=>document.body.classList.contains('is-editing')));
ok('cadre orange (::after)',await p.evaluate(()=>{const c=getComputedStyle(document.body,'::after');return c.boxShadow.includes('255, 149, 0')&&c.position==='fixed'&&c.pointerEvents==='none'}));
ok('onglet visible avec le n° de manche',(await p.textContent('.edit-tab')).includes('MANCHE 1'));
ok('bouton dock : MODIFIER MANCHE 1',(await p.textContent('#save-btn')).includes('MODIFIER MANCHE 1'));

// abandon par la croix
await p.click('.edit-tab button');await p.waitForTimeout(400);
ok('croix : cadre retiré, état propre',await p.evaluate(()=>!document.body.classList.contains('is-editing')&&app.editIdx===null&&Object.keys(app.currentGame.state.temp).length===0));
ok('croix : scores inchangés',await p.evaluate(()=>app.currentGame.state.history[0][1]===10));
ok('bouton redevient ENREGISTRER MANCHE 3',(await p.textContent('#save-btn')).includes('ENREGISTRER MANCHE 3'));
// édition + validation
await p.click('.h-row:has(.h-idx:text-is("M2")) .h-scores');await p.waitForTimeout(400);
ok('édition manche 2 : onglet',(await p.textContent('.edit-tab')).includes('MANCHE 2'));
await p.evaluate(()=>{app.currentGame.state.temp[1]=99});await p.evaluate(()=>app.validateRound());await p.waitForTimeout(500);
ok('validation : cadre retiré + valeur appliquée',await p.evaluate(()=>!document.body.classList.contains('is-editing')&&app.currentGame.state.history[1][1]===99));
// suppression de la dernière manche : le donneur recule
const d0=await p.evaluate(()=>app.currentGame.state.dealerId);
await p.evaluate(()=>app._executeDelRound(1));await p.waitForTimeout(300);
const d1=await p.evaluate(()=>app.currentGame.state.dealerId);
ok(`suppression de la dernière manche : donneur recule (${d0}→${d1})`,d0===3&&d1===2);
await p.evaluate(()=>app._executeDelRound(0));await p.waitForTimeout(200);
ok('suppression d\'une manche : historique vide, pas d\'erreur',await p.evaluate(()=>app.currentGame.state.history.length===0));
// édition puis retour accueil : cadre retiré
await p.evaluate(()=>{app.currentGame.state.history.push({1:1,2:2,3:3});app.startEdit(0)});await p.waitForTimeout(300);
ok('édition active',await p.evaluate(()=>document.body.classList.contains('is-editing')));
await p.evaluate(()=>app.goHome?app.goHome():app.exit&&app.exit());await p.waitForTimeout(300);
console.log('home fn present:',await p.evaluate(()=>['goHome','exit','home','backToSetup'].filter(k=>typeof app[k]==='function')));
console.log('erreurs:',errs);await b.close()})();
