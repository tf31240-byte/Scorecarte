const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
const URL=(process.env.SM_URL||'http://localhost:8769/');
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true,locale:'fr-FR'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto(URL);await p.waitForTimeout(900);
await p.evaluate(()=>{const g={id:'9',name:'T',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,state:{players:[{id:1,name:'A',total:30,color:'#ff3b30'},{id:2,name:'B',total:12,color:'#0a84ff'},{id:3,name:'C',total:5,color:'#30d158'}],history:[{1:10,2:5,3:2},{1:20,2:7,3:3}],temp:{},dealerId:3,victoryCondition:'highest'}};localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','9');app.init();app.loadGame('9')});await p.waitForTimeout(700);
ok('zoom désactivé (voulu : il cassait la mise en page)',/user-scalable=no/.test(await p.getAttribute('meta[name=viewport]','content'))&&await p.evaluate(()=>getComputedStyle(document.body).touchAction==='pan-x pan-y'));
ok('aucun débordement horizontal à 320 px',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
ok('champs ≥ 16 px (pas de zoom iOS)',await p.evaluate(()=>[...document.querySelectorAll('input:not([type=color]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),select')].every(e=>e.getBoundingClientRect().width===0||parseFloat(getComputedStyle(e).fontSize)>=16)));
await p.evaluate(()=>UI.showSettings());await p.waitForTimeout(500);
const sw=await p.evaluate(()=>[...document.querySelectorAll('.settings-toggle')].map(b=>[b.getAttribute('role'),b.getAttribute('aria-checked'),b.getAttribute('aria-label')]));
ok('interrupteurs : role=switch + état + nom',sw.length>=6&&sw.every(x=>x[0]==='switch'&&/^(true|false)$/.test(x[1])&&x[2]));
await p.evaluate(()=>document.querySelector('details.settings-fold:has(#settings-sound-btn)').open=true);await p.click('#settings-sound-btn');await p.waitForTimeout(150);
ok('aria-checked suit le clic',await p.evaluate(()=>document.getElementById('settings-sound-btn').getAttribute('aria-checked')===String(document.getElementById('settings-sound-btn').classList.contains('active'))));
ok('fenêtre : role=dialog + aria-modal',await p.evaluate(()=>{const b=document.querySelector('#settings-modal .modal-box');return b.getAttribute('role')==='dialog'&&b.getAttribute('aria-modal')==='true'&&!!b.getAttribute('aria-label')}));
ok('focus dans la fenêtre',await p.evaluate(()=>document.getElementById('settings-modal').contains(document.activeElement)));
await p.keyboard.press('Escape');await p.waitForTimeout(400);
ok('Échap ferme les Paramètres',!(await p.evaluate(()=>document.getElementById('settings-modal').classList.contains('active'))));
// empilé : stats puis échap
await p.evaluate(()=>UI.showStats());await p.waitForTimeout(400);await p.keyboard.press('Escape');await p.waitForTimeout(400);
ok('Échap ferme les Stats',!(await p.evaluate(()=>document.getElementById('stats-modal').classList.contains('active'))));
// pavé : Échap ferme le pavé, pas autre chose
await p.evaluate(()=>app.openSheet(1));await p.waitForTimeout(400);await p.keyboard.press('Escape');await p.waitForTimeout(400);
ok('Échap ferme le pavé',!(await p.evaluate(()=>document.getElementById('sheet').classList.contains('active'))));
const small=await p.evaluate(()=>{const o=[];document.querySelectorAll('.btn-icon,#history-toggle').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&(r.height<40||(e.classList.contains('btn-icon')&&r.width<40)))o.push(e.className+Math.round(r.width)+'x'+Math.round(r.height))});return o});
ok('boutons ✕/icônes ≥ 40 px',small.length===0);if(small.length)console.log(small);
ok('aucune erreur JS',errs.length===0);if(errs.length)console.log(errs);
await b.close()})();
