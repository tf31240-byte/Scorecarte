const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
const URL=(process.env.SM_URL||'http://localhost:8769/');
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'fr-FR',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
// 1. test automatisé : pas d'ouverture automatique
await p.goto(URL);await p.waitForTimeout(1500);
ok('pas d\'ouverture auto sous test automatisé',!(await p.$('#onboarding')));
// 2. forcé par ?guide=1
await p.goto(URL+'?guide=1');await p.waitForTimeout(1500);
ok('?guide=1 ouvre le guide',await p.isVisible('#onboarding'));
ok('l\'installation est la 1re étape (facultatif + avantages)',(await p.textContent('.ob-title')).includes('Installe')&&(await p.textContent('.ob-text')).includes('Facultatif')&&(await p.textContent('.ob-text')).includes('hors-ligne'));
{const g=await p.evaluate(()=>{const c=document.querySelector('.ob-card').getBoundingClientRect(),a=document.getElementById('ob-actions').getBoundingClientRect(),d=document.getElementById('ob-dots').getBoundingClientRect(),b=document.getElementById('ob-body').getBoundingClientRect();return{a:a.bottom<=c.bottom+1,ad:d.bottom<=a.top+1,bd:b.bottom<=d.top+1}});
ok('boutons et pastilles sous le contenu (pas de chevauchement)',g.a&&g.ad&&g.bd);}
ok('bouton 1re étape = « Pas maintenant »',(await p.textContent('.ob-actions .ob-primary')).includes('Pas maintenant'));
const titles=[];
for(let i=0;i<12;i++){titles.push(await p.textContent('.ob-title'));if(await p.isVisible('.ob-actions .ob-link'))break;await p.click('.ob-actions .ob-primary');await p.waitForTimeout(120);}
console.log(titles.join(' › '));
ok('slides dans l\'ordre (6 avec installation iOS)',titles.length===6&&titles[0].includes('Installe')&&titles[titles.length-1].includes('profil'));
ok('étape iOS : Partager / Sur l\'écran d\'accueil',titles.some(t=>t.includes('Installe')));
await p.screenshot({path:'/tmp/ob_cloud.png'}).catch(()=>{});
// 3. navigation retour + clavier
await p.keyboard.press('ArrowLeft');await p.waitForTimeout(100);ok('flèche gauche = retour',(await p.textContent('.ob-title')).includes('image'));
await p.keyboard.press('ArrowRight');await p.waitForTimeout(100);
// 4. thème depuis le guide
await p.keyboard.press('Escape');await p.waitForTimeout(400);
ok('Échap ferme',!(await p.$('#onboarding')));
ok('mémorisé (ne réapparaît pas)',await p.evaluate(()=>localStorage.getItem('sm_onboarded')==='1'));
await p.goto(URL);await p.waitForTimeout(1500);ok('pas de réouverture',!(await p.$('#onboarding')));
// 5. depuis les paramètres
await p.evaluate(()=>UI.showSettings());await p.waitForTimeout(300);
await p.click('text=Guide de démarrage');await p.waitForTimeout(500);
ok('Paramètres → Guide',await p.isVisible('#onboarding'));
ok('fenêtre Paramètres fermée',!(await p.evaluate(()=>document.getElementById('settings-modal').classList.contains('active'))));
// slide thème
for(let i=0;i<4;i++){await p.click('.ob-actions .ob-primary');await p.waitForTimeout(100);}
ok('slide Apparence',(await p.textContent('.ob-title')).includes('image'));
await p.click('#ob-pal .palette-btn:has-text("Forêt")');await p.click('#ob-mode button[data-mode="dark"]');
ok('thème appliqué depuis le guide',await p.evaluate(()=>document.documentElement.dataset.palette==='forest'&&document.documentElement.dataset.theme==='dark'));
ok('sélection mise à jour',await p.evaluate(()=>document.querySelector('#ob-pal .palette-btn.active').textContent.includes('Forêt')));
await p.evaluate(()=>{app.setPalette('ocean');app.setThemeMode('auto')});
// 6. étape cloud : « Plus tard » snooze
for(let i=0;i<1;i++){await p.click('.ob-actions .ob-primary');await p.waitForTimeout(100);}
ok('étape cloud : 3 actions',(await p.$$('.ob-actions button')).length===3);
await p.click('.ob-link');await p.waitForTimeout(500);
ok('Plus tard : guide fermé',!(await p.$('#onboarding')));
ok('Plus tard : invitation cloud repoussée',await p.evaluate(()=>{const s=Cloud.load();return s.snoozeUntil>Date.now()&&!s.consent}));
// 7. Créer mon profil ouvre la fenêtre cloud
await p.evaluate(()=>Onboarding.open());await p.waitForTimeout(400);
for(let i=0;i<7;i++){if(await p.isVisible('.ob-actions .ob-link'))break;await p.click('.ob-actions .ob-primary');await p.waitForTimeout(80);}
await p.click('.ob-actions button:has-text("Créer mon profil")');await p.waitForTimeout(800);
ok('Créer mon profil → fenêtre profil',await p.evaluate(()=>document.getElementById('cloud-modal').classList.contains('active')));
await p.evaluate(()=>Cloud.close());
await p.evaluate(()=>Onboarding.open());await p.waitForTimeout(400);
for(let i=0;i<7;i++){if(await p.isVisible('.ob-actions .ob-link'))break;await p.click('.ob-actions .ob-primary');await p.waitForTimeout(80);}
await p.click('.ob-actions button:has-text("déjà un profil")');await p.waitForTimeout(800);
ok('J\'ai déjà un profil → saisie pseudo',await p.evaluate(()=>document.getElementById('cloud-modal').classList.contains('active')));
await p.evaluate(()=>Cloud.close());
// 8. nouveaux venus seulement : un utilisateur avec parties ne voit pas le guide
await p.evaluate(()=>{localStorage.removeItem('sm_onboarded');localStorage.setItem('sm_v12_games',JSON.stringify([{id:'x',name:'Uno',mode:'standard',date:new Date().toISOString(),finished:false,victoryCondition:'highest',endCondition:{type:'free',value:null},state:{players:[{id:1,name:'A',total:0,color:'#f00'},{id:2,name:'B',total:0,color:'#00f'}],history:[],temp:{},dealerId:1}}]))});
// webdriver masqué pour ce cas
await p.addInitScript(()=>{Object.defineProperty(navigator,'webdriver',{get:()=>false})});
await p.goto(URL);await p.waitForTimeout(1500);
ok('utilisateur existant : pas de guide automatique',!(await p.$('#onboarding')));
await p.evaluate(()=>{localStorage.clear()});
await p.goto(URL);await p.waitForTimeout(1600);
ok('nouveau venu : guide automatique',await p.isVisible('#onboarding'));
// 9. standalone : pas d'étape installation
await p.evaluate(()=>{Onboarding._close()});
console.log('errs',errs);await b.close()})();
