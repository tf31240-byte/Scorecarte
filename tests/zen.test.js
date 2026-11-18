const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
await p.evaluate(()=>{window.__wl=0;Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{window.__wl++;return{release:async()=>{window.__wl--},addEventListener(){}}}}});
 const g={id:'77',name:'Uno',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,
 state:{players:[{id:1,name:'ALICE',total:38,color:'#ff3b30'},{id:2,name:'BOB',total:-4,color:'#0a84ff'},{id:3,name:'CHLOÉ',total:15,color:'#30d158'}],history:[{1:10,2:5,3:2},{1:20,2:-9,3:3},{1:3,2:0,3:5},{1:5,2:0,3:5}],temp:{},dealerId:2,victoryCondition:'highest',endCondition:{type:'free',value:null}}};
 localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','77');app.init();app.loadGame('77')});await p.waitForTimeout(700);

await p.click('button[title="Mode Zen"]');await p.waitForTimeout(1300);
ok('zen : plus de mini-historique',(await p.$$('.p-zen-hist')).length===0);

ok('libellé manche',(await p.textContent('#zen-round')).includes('MANCHE 5'));
ok('wake lock actif',await p.evaluate(()=>window.__wl===1));

await p.click('button[title="Mode Zen"]');await p.waitForTimeout(300);
ok('wake lock libéré',await p.evaluate(()=>window.__wl===0));
ok('libellé caché hors zen',!(await p.isVisible('#zen-round')));
console.log('errs',errs);await b.close()})();
