const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(1200);
const res=await p.evaluate(()=>{
 let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
 const bad=[];const cols=['#f00','#00f','#0a0','#fa0','#a0f','#0af','#fc0','#50f','#0bb','#999','#b05','#5b0'];
 const names=['ALICE','BOB','CHLOÉ','DAN','ÉMILIE','FRANÇOIS','GINO','HUGO','INÈS','JULES','KARIM','LÉA','ÉLÉONORE-MARIE-ANTOINETTE-DE-LA-TOUR'];
 for(let k=0;k<600;k++){
  const n=1+Math.floor(rnd()*12),R=Math.floor(rnd()*30);
  const neg=rnd()<.4,flt=rnd()<.1,low=rnd()<.5,same=rnd()<.15;
  const players=Array.from({length:n},(_,i)=>({id:i+1,name:names[Math.floor(rnd()*names.length)],color:cols[i],total:0}));
  const history=[];for(let r=0;r<R;r++){const o={};players.forEach(pl=>{let v=same?5:Math.floor(rnd()*60)-(neg?20:0);if(flt)v+=0.5;o[pl.id]=v});history.push(o)}
  players.forEach(pl=>pl.total=history.reduce((s,r)=>s+r[pl.id],0));
  const gs={players,history,victoryCondition:low?'lowest':'highest',name:rnd()<.2?'Un nom de jeu vraiment très très très long pour tester':'Skyjo',date:rnd()<.1?'not a date':new Date().toISOString(),roll:Math.floor(rnd()*5)};
  try{
   const a=UnifiedRecapGenerator.analyze(gs);
   const c=UnifiedRecapGenerator.generateStatic(gs,1);
   if(!c) bad.push(['nocanvas',k]);
   const txt=JSON.stringify(a);
   if(/undefined|NaN|\[object/.test(a.narrative+a.name+a.date)) bad.push(['txt',k,a.narrative]);
   if(!a.narrative) bad.push(['empty',k]);
   // frame animée à plusieurs instants
   const cv=document.createElement('canvas');cv.width=cv.height=540;const ctx=cv.getContext('2d');
   [0,0.1,0.3,0.5,0.7,0.99].forEach(t=>UnifiedRecapGenerator.drawFrame(ctx,a,t,true));
   app.currentGame={name:gs.name,date:gs.date,victoryCondition:gs.victoryCondition,finished:true,state:{players,history,temp:{},dealerId:1}};
   const t=app.buildShareText();if(/undefined|NaN/.test(t)) bad.push(['share',k,t]);
  }catch(e){bad.push(['throw',k,n,R,String(e.stack).slice(0,200)])}
 }
 return bad.slice(0,10).concat([['total bad',bad.length]]);});
const nbad=res[res.length-1][1];console.log(nbad===0&&!errs.length?'✅':'❌','fuzz : 600 parties aléatoires, aucune anomalie (anomalies='+nbad+')');if(nbad)console.log(JSON.stringify(res,null,1),errs);
await b.close()})();
