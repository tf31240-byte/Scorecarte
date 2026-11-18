const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
const URL=(process.env.SM_URL||'http://localhost:8769/');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,locale:'fr-FR'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
// 1. sous test automatisé : aucun conseil
await p.goto(URL);await p.waitForTimeout(800);
await p.evaluate(()=>{Hints.show('stats',0)});await p.waitForTimeout(300);
ok('désactivé sous test automatisé',!(await p.$('#hint')));
// 2. avec ?hints=1
await p.goto(URL+'?hints=1');await p.waitForTimeout(900);
await p.evaluate(()=>UI.showStats());await p.waitForTimeout(1500);
ok('stats : bulle affichée',await p.isVisible('#hint')&&(await p.textContent('#hint')).includes('fiche'));
await p.click('#hint button');await p.waitForTimeout(400);
ok('fermeture par ✕',!(await p.$('#hint')));
await p.evaluate(()=>{UI.closeStats();UI.showStats()});await p.waitForTimeout(1500);
ok('stats : ne réapparaît pas',!(await p.$('#hint')));
ok('mémorisé',await p.evaluate(()=>!!JSON.parse(localStorage.getItem('sm_hints')).stats));
// 3. disparition automatique
await p.evaluate(()=>Hints.show('round',0));await p.waitForTimeout(500);ok('round : bulle',await p.isVisible('#hint'));
await p.waitForTimeout(9600);ok('disparaît seule après ~9 s',!(await p.$('#hint')));
// 4. pas pendant le guide
await p.evaluate(()=>{localStorage.removeItem('sm_hints');Onboarding.open()});await p.waitForTimeout(500);
await p.evaluate(()=>Hints.show('victory',0));await p.waitForTimeout(400);
ok('rien pendant le guide',!(await p.$('#hint')));
ok('… et pas marqué comme vu',await p.evaluate(()=>!JSON.parse(localStorage.getItem('sm_hints')||'{}').victory));
await p.keyboard.press('Escape');await p.waitForTimeout(400);
// 5. réinitialisation
await p.evaluate(()=>{Hints._mark('stats');Hints.reset()});
ok('réinitialisation',await p.evaluate(()=>!localStorage.getItem('sm_hints')));
// 6. branché sur la manche n°2
await p.evaluate(()=>{const g={id:'88',name:'T',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,state:{players:[{id:1,name:'A',total:0,color:'#ff3b30'},{id:2,name:'B',total:0,color:'#0a84ff'}],history:[],temp:{},dealerId:2,victoryCondition:'highest'}};
 localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','88');app.init();app.loadGame('88')});await p.waitForTimeout(700);
for(let r=0;r<2;r++){await p.evaluate(()=>{const g=app.currentGame;g.state.temp={1:5,2:3};app.validateRound()});await p.waitForTimeout(400);}
await p.waitForTimeout(3200);
ok('manche 2 : conseil historique',await p.isVisible('#hint')&&(await p.textContent('#hint')).includes('historique'));
ok('aucune erreur JS',errs.length===0);if(errs.length)console.log(errs);
await b.close()})();
