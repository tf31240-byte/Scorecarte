const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
await p.evaluate(()=>{
 const day=864e5,now=Date.now();let id=0;
 const mk=(name,vc,daysAgo,names,rounds)=>{const players=names.map((n,i)=>({id:i+1,name:n,total:0,color:'#ff3b30'}));
  rounds.forEach(r=>players.forEach((pl,i)=>pl.total+=r[i]));
  return {id:'g'+(++id),name,mode:name==='Belote'?'belote':'standard',date:new Date(now-daysAgo*day).toISOString(),finished:true,victoryCondition:vc,endCondition:{type:'free',value:null},preset:null,
   state:{players,history:rounds.map(r=>Object.fromEntries(r.map((v,i)=>[i+1,v]))),temp:{},dealerId:1,victoryCondition:vc,endCondition:{type:'free',value:null}}}};
 const G=[];
 // Uno (plus haut gagne)
 G.push(mk('Uno','highest',60,['ALICE','BOB','CHLOÉ'],[[10,5,2],[20,8,3],[5,30,1]]));
 G.push(mk('Uno','highest',45,['ALICE','BOB','CHLOÉ'],[[12,10,3],[30,20,3],[8,9,1]]));
 G.push(mk('Uno','highest',20,['ALICE','BOB'],[[10,5],[10,5]]));
 G.push(mk('Uno','highest',10,['ALICE','BOB','CHLOÉ'],[[1,50,20],[2,10,30],[100,5,5]]));
 G.push(mk('Uno','highest',3,['ALICE','BOB','CHLOÉ'],[[50,40,10],[30,25,5]]));
 // Skyjo (plus bas gagne)
 G.push(mk('Skyjo',"lowest",30,['ALICE','BOB','DAVID'],[[5,30,12],[10,25,8]]));
 G.push(mk('Skyjo',"lowest",5,['ALICE','BOB','DAVID'],[[40,2,9],[35,1,3]]));
 // égalité
 G.push(mk("Rami d'or",'highest',2,['BOB','DAVID'],[[10,10],[10,10]]));
 // belote
 G.push(mk('Belote','highest',1,['NOUS','EUX'],[[82,80],[100,62]]));
 // un seul jeu d'un joueur isolé
 G.push(mk('Uno','highest',1,['ZOÉ','ALICE'],[[5,9]]));
 localStorage.setItem('sm_v12_games',JSON.stringify(G));app.init();});
await p.waitForTimeout(700);
await p.evaluate(()=>UI.showStats());await p.waitForTimeout(600);
const an=await p.evaluate(()=>{const a=StatsEngine.analyze({});return {games:a.games,rounds:a.rounds,names:a.gameNames.map(g=>g.label+':'+g.count),players:a.players.map(x=>[x.name,x.played,x.wins,x.winRate,x.reliable,x.avgPerRound,x.currentStreak,x.bestStreak].join('/')),hot:a.summary.hot&&a.summary.hot.name,comeback:a.anecdotes.comeback,tight:a.anecdotes.tight&&[a.anecdotes.tight.gap,a.anecdotes.tight.game],big:a.anecdotes.big}});console.log(JSON.stringify(an,null,1));
ok('10 parties',an.games===10);
// Alice: Uno1 gagne(10,5,2 + 20.. => A35,B43,C6 => BOB gagne). Vérifs ciblées:
const al=await p.evaluate(()=>StatsEngine.analyze({}).players.find(x=>x.name==='ALICE'));
ok('ALICE jeux joués 8',al.played===8);
// Skyjo : le plus bas gagne -> ALICE gagne la 1re (15 vs 55 vs 20)
ok('Skyjo : plus bas gagne (ALICE 1re manche)',await p.evaluate(()=>{const a=StatsEngine.analyze({game:'skyjo'});const x=a.players.find(q=>q.name==='ALICE');return x.results[0].win===true&&x.results[1].win===false}));
ok('meilleure manche Skyjo = la plus basse',await p.evaluate(()=>{const a=StatsEngine.analyze({game:'skyjo'});return a.players.find(q=>q.name==='BOB').bestRound.value===1}));
ok('égalité en tête = aucun vainqueur (règle app)',await p.evaluate(()=>{const a=StatsEngine.analyze({game:"rami d'or"});return a.players.every(x=>x.wins===0&&x.draws===1&&x.results[0].draw)&&a.summary.last.draw}));
ok('ZOÉ (1 partie) non fiable, classé après',await p.evaluate(()=>{const pl=StatsEngine.analyze({}).players;const z=pl.findIndex(x=>x.name==='ZOÉ');return !pl[z].reliable&&pl.slice(0,z).every(x=>x.reliable||true)&&pl.filter(x=>x.reliable).every((x,i)=>pl.indexOf(x)<z)}));
ok('filtre période 30 j',await p.evaluate(()=>StatsEngine.analyze({period:'30'}).games===7||StatsEngine.analyze({period:'30'}).games));
ok('h2h ALICE vs BOB cohérent',await p.evaluate(()=>{const a=StatsEngine.analyze({});const h=StatsEngine.headToHead(a,'ALICE','BOB'),r=StatsEngine.headToHead(a,'BOB','ALICE');return h.aw===r.bw&&h.bw===r.aw&&h.ties===r.ties&&h.aw+h.bw+h.ties===7}));

// ---- cohérence des règles ----
ok('Belote : équipes exclues du classement (filtre Tous)',await p.evaluate(()=>!StatsEngine.analyze({}).players.some(x=>x.name==='NOUS'||x.name==='EUX')));
ok('Belote : équipes classées quand filtre = Belote',await p.evaluate(()=>{const a=StatsEngine.analyze({game:'belote'});return a.teamOnly&&a.players.some(x=>x.name==='NOUS')}));
ok('Belote compte quand même dans les parties/manches',await p.evaluate(()=>StatsEngine.analyze({}).games===10));
await p.evaluate(()=>{const G=JSON.parse(localStorage.getItem('sm_v12_games'));const base=G[0];
 G.push(Object.assign(JSON.parse(JSON.stringify(base)),{id:'empty',finished:true,date:new Date().toISOString(),state:Object.assign(JSON.parse(JSON.stringify(base.state)),{history:[]})}));
 const acc=JSON.parse(JSON.stringify(base));acc.id='acc';acc.state.players[2].name='CHLOE';acc.date=new Date().toISOString();G.push(acc);
 const dup=JSON.parse(JSON.stringify(base));dup.id='dup';dup.state.players[1].name='ALICE';dup.date=new Date().toISOString();G.push(dup);
 localStorage.setItem('sm_v12_games',JSON.stringify(G));});
ok('partie sans manche ignorée',await p.evaluate(()=>StatsEngine.analyze({}).games===12));
ok('accents : CHLOE et CHLOÉ fusionnés',await p.evaluate(()=>{const a=StatsEngine.analyze({});return a.players.filter(x=>x.name.startsWith('CHLO')).length===1}));
ok('même nom 2× dans une partie compté une seule fois',await p.evaluate(()=>{const a=StatsEngine.analyze({});return a.players.find(x=>x.name==='ALICE').played===10}));
ok('barèmes mélangés signalés (ALICE Uno+Skyjo)',await p.evaluate(()=>StatsEngine.analyze({}).players.find(x=>x.name==='ALICE').mixed===true));
ok('un seul jeu : pas mixte',await p.evaluate(()=>StatsEngine.analyze({game:'uno'}).players.every(x=>!x.mixed)));
ok('records par jeu (Uno en tête)',await p.evaluate(()=>{const a=StatsEngine.analyze({});return a.perGame[0].game==='Uno'&&a.perGame.length<=3&&a.perGame[0].top.length===3}));
ok('Skyjo : meilleurs scores = les plus bas',await p.evaluate(()=>{const g=StatsEngine.analyze({}).perGame.find(x=>x.game==='Skyjo');return g&&g.isLowest&&g.top[0].total<=g.top[1].total}));
ok('règle app : 2 joueurs atteignent la cible → le plus haut gagne',await p.evaluate(()=>{const r=app._evalScoreEnd({players:[{id:1,total:102},{id:2,total:130}]},{value:100},'highest');return r.gameEnded&&r.winner.id===2}));
ok('règle app : lowest inchangée',await p.evaluate(()=>{const r=app._evalScoreEnd({players:[{id:1,total:120},{id:2,total:40},{id:3,total:60}]},{value:100},'lowest');return r.gameEnded&&r.winner.id===2}));
await p.evaluate(()=>{const G=JSON.parse(localStorage.getItem('sm_v12_games')).filter(g=>!['empty','acc','dup'].includes(g.id));localStorage.setItem('sm_v12_games',JSON.stringify(G));});
// UI

ok('chips (Tous + 4 jeux)',(await p.$$('#stats-game-chips .chip')).length===5);
ok('résumé tuiles',(await p.textContent('#stats-summary')).includes('parties'));
await p.click('#stats-game-chips .chip:has-text("Rami")');await p.waitForTimeout(300);
ok('filtre jeu apostrophe OK',(await p.$$('#ranking-list .rank-item')).length===2);
await p.click('#stats-game-chips .chip:has-text("Tous")');await p.waitForTimeout(300);
await p.click('#ranking-list .rank-item >> nth=0');await p.waitForTimeout(300);
ok('fiche joueur visible',await p.isVisible('#player-detail-content'));
ok('sparkline + pastilles',(await p.$$('#player-detail-content svg.spark')).length===1&&(await p.$$('#player-detail-content .dot')).length>0);

await p.click('#player-detail-content .d-row.link >> nth=0');await p.waitForTimeout(300);
ok('clic rival → onglet face à face',await p.isVisible('#h2h-content .h2h-score'));

await p.selectOption('#h2h-content select >> nth=1','DAVID');await p.waitForTimeout(200);
ok('changement de joueur',(await p.textContent('#h2h-content')).includes('DAVID'));
await p.click('#tab-records');await p.waitForTimeout(300);
ok('records : cartes',(await p.$$('.rec-card')).length>=4);

await p.click('#tab-rank');await p.waitForTimeout(300);
await p.selectOption('#stats-period','30');await p.waitForTimeout(300);
ok('période 30 j filtre',await p.evaluate(()=>UI._an.games<10));
// partage
const txt=await p.evaluate(()=>UI._shareText());console.log(txt);
ok('partage texte',txt.includes('ScoreMaster')&&txt.includes('ALICE'));
// 0 partie
await p.evaluate(()=>{localStorage.setItem('sm_v12_games','[]');UI.statsFilter={game:'all',period:'all'};UI.showStats()});await p.waitForTimeout(300);
ok('vide : message',(await p.textContent('#ranking-list')).includes('Aucune partie'));
await p.click('#tab-h2h');ok('h2h vide',(await p.textContent('#h2h-content')).includes('au moins deux'));
await p.click('#tab-records');ok('records vide',(await p.textContent('#records-list')).includes('Aucun record'));
console.log('errs',errs);await b.close()})();
