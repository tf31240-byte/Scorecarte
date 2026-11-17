const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
await p.evaluate(()=>{const g={id:'77',name:'Test',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,
 state:{players:[{id:1,name:'ALICE',total:30,color:'#ff3b30'},{id:2,name:'BOB',total:12,color:'#0a84ff'}],history:[{1:10,2:5},{1:20,2:7}],temp:{},dealerId:2,victoryCondition:'highest',endCondition:{type:'free',value:null}}};
 localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','77');app.init();app.loadGame('77')});await p.waitForTimeout(700);
ok('replié : dernière manche M2 visible',(await p.textContent('#history-last')).includes('M2')&&!(await p.isVisible('#history')));

await p.click('#history-toggle');ok('déplié : plus de doublon',(await p.textContent('#history-last')).trim()===''&&await p.isVisible('#history'));
await p.click('#history-toggle');ok('replié à nouveau',(await p.textContent('#history-last')).includes('M2'));
await p.click('#history-last .h-scores');await p.waitForTimeout(300);ok('clic = modifier M2',await p.evaluate(()=>app.editIdx===1));
await p.evaluate(()=>app.cancelEdit());
await p.click('#history-last button');await p.waitForTimeout(400);ok('× supprime M2, M1 devient la dernière',(await p.textContent('#history-last')).includes('M1'));
console.log('errs',errs);await b.close()})();
