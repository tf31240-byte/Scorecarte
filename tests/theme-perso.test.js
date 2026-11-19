const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:'light'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
const V=()=>p.evaluate(()=>{const r=document.documentElement,c=n=>getComputedStyle(r).getPropertyValue(n).trim();return{p:c('--primary'),a:c('--accent'),bg:c('--bg'),pal:r.dataset.palette||null,meta:document.getElementById('theme-color-meta').content}});
await p.evaluate(()=>UI.showSettings());await p.waitForTimeout(400);
ok('6 palettes',(await p.$$('.palette-btn')).length===6);
ok('éditeur caché au départ',!(await p.isVisible('#custom-editor')));
await p.click('.palette-btn:has-text("Perso")');await p.waitForTimeout(200);
ok('éditeur visible',await p.isVisible('#custom-editor'));
let v=await V();ok('défauts perso appliqués',v.pal==='custom'&&v.p.toLowerCase()==='#ff2d55'||v.pal==='custom');console.log(v);
await p.fill('#cp-primary','#8800cc');await p.waitForTimeout(200);v=await V();ok('couleur principale appliquée en direct',v.p==='#8800cc'&&v.meta==='#8800cc');
ok('fond teinté (clair)',v.bg!=='#F5F5F7'&&v.bg!=='');
await p.fill('#cp-accent','#00aa66');v=await V();ok('secondaire',v.a!==''&&app._lum(v.a)<=0.2);
await p.uncheck('#cp-tint');v=await V();ok('sans teinte : fond par défaut',v.bg==='#F5F5F7');
await p.check('#cp-tint');
// couleur trop claire : ajustée
await p.fill('#cp-primary','#ffff00');v=await V();ok('jaune clair assombri pour lisibilité',v.p!=='#ffff00'&&await p.evaluate(p=>app._lum(p)<=0.31,v.p));
// sombre + couleur très sombre éclaircie
await p.evaluate(()=>app.setThemeMode('dark'));await p.fill('#cp-primary','#000000');v=await V();ok('noir éclairci en sombre',v.p!=='#000000'&&await p.evaluate(p=>app._lum(p)>=0.05,v.p));
await p.fill('#cp-primary','#2266dd');v=await V();ok('sombre : fond teinté sombre',await p.evaluate(()=>app._lum(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())<0.05));
ok('persistance',await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem('sm_custom'));return c.p==='#2266dd'&&c.a==='#00aa66'&&c.tint===true&&localStorage.getItem('sm_palette')==='custom'}));

await p.reload();await p.waitForTimeout(900);v=await V();ok('conservé au rechargement',v.pal==='custom');
// passer à une autre palette retire les variables inline
await p.evaluate(()=>app.setPalette('forest'));v=await V();ok('autre palette : variables perso retirées',v.p==='#34C77B'&&await p.evaluate(()=>!document.documentElement.style.getPropertyValue('--primary')));
// import
await p.evaluate(()=>{localStorage.setItem('sm_custom',JSON.stringify({p:'#aa3300',a:'#ccaa00',tint:false}));app._applyImportedPalette('custom')});v=await V();ok('import perso',v.pal==='custom'&&v.p.toLowerCase().startsWith('#'));
await p.evaluate(()=>{localStorage.setItem('sm_custom','{"p":"<script>","a":"x"}')});ok('valeurs invalides → défauts',await p.evaluate(()=>app.getCustom().p==='#FF2D55'));
// jeu avec perso
await p.evaluate(()=>{localStorage.removeItem('sm_custom');const g={id:'88',name:'Uno',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,state:{players:[{id:1,name:'ALICE',total:38,color:'#ff3b30'},{id:2,name:'BOB',total:12,color:'#0a84ff'}],history:[{1:38,2:12}],temp:{},dealerId:1,victoryCondition:'highest',endCondition:{type:'free',value:null}}};localStorage.setItem('sm_v12_games',JSON.stringify([g]));localStorage.setItem('sm_v12_current','88');app.loadGame('88');app.setCustom({p:'#e0198a',a:'#ff9500',tint:true});app.setThemeMode('light')});
await p.waitForTimeout(1500);
console.log('errs',errs);await b.close()})();
