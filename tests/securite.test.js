// Données piégées (import / sauvegarde cloud) : rien ne doit s'exécuter ni casser l'affichage.
const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
const URL=(process.env.SM_URL||'http://localhost:8769/');
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fr-FR'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{errs.push('DIALOG '+d.message());d.dismiss()});
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto(URL);await p.waitForTimeout(900);
const res=await p.evaluate(async()=>{
 const X='<img src=x onerror="window.__x=(window.__x||0)+1">',Y='"><svg onload="window.__x=(window.__x||0)+1">';
 const bad='red;" onmouseover="window.__x=(window.__x||0)+1" x="';
 const g=(id)=>({id,name:X,mode:'standard',date:new Date().toISOString(),finished:true,victoryCondition:'highest',endCondition:{type:'free',value:null},preset:null,
  state:{players:[{id:1,name:X,total:30,color:bad},{id:2,name:Y,total:12,color:Y},{id:3,name:'C',total:5,color:'#30d158'}],history:[{1:10,2:5,3:2},{1:20,2:7,3:3}],temp:{},dealerId:3,victoryCondition:'highest'}});
 const data={version:'x',games:[g('1'),g('2')],customPresets:{"a');window.__x=9;('":{name:X,icon:Y,tag:X},ok1:{name:X,icon:Y,tag:X,evil:{a:1}}},hiddenPresets:["b');window.__x=9;('",'ok1'],exportDate:new Date().toISOString()};
 localStorage.setItem('sm_v12_games',JSON.stringify(data.games));localStorage.setItem('sm_v12_current','1');
 try{app._applyImportedExtras(data)}catch(e){return 'ERR '+e.message}
 app.init();app.loadGame('1');await new Promise(r=>setTimeout(r,500));
 const out=[];const T=async(n,f)=>{try{f()}catch(e){out.push(n+':'+e.message)}await new Promise(r=>setTimeout(r,250))};
 await T('victory',()=>UI.showVictory(app.currentGame.state.players[0],30,app.currentGame.state));
 await T('home',()=>app.goHome&&app.goHome());
 await T('setup',()=>app.showSetup&&app.showSetup());
 await T('hidden',()=>app.showHiddenPresets&&app.showHiddenPresets());
 await T('stats',()=>UI.showStats());
 return out});
await p.waitForTimeout(500);
ok('rien ne s\'exécute (données importées piégées)',(await p.evaluate(()=>window.__x||0))===0);
ok('couleurs invalides remplacées à la lecture',await p.evaluate(()=>Storage.sanitizeGame(JSON.parse(localStorage.getItem('sm_v12_games'))[0]).state.players.every(q=>/^#[0-9a-f]{3,8}$/i.test(q.color))));
ok('jeux perso : clé piégée refusée',await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem('sm_custom_presets')||'{}');return Object.keys(c).every(k=>/^[\w-]+$/.test(k))&&c.ok1&&!c.ok1.evil}));
ok('pas d\'erreur pendant l\'affichage',!res||(Array.isArray(res)&&res.length===0));if(Array.isArray(res)&&res.length)console.log(res);
ok('aucune erreur JS',errs.length===0);if(errs.length)console.log(errs);
await b.close()})();
