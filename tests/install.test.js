const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
const URL=(process.env.SM_URL||'http://localhost:8769/');
const UAS={
 iosSafari:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
 iosChrome:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
 iosInApp:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0',
 androidChrome:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
 samsung:'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36',
 androidFx:'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
 desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'};
(async()=>{const b=await chromium.launch();const errs=[];
async function run(name,fn){const ctx=await b.newContext({viewport:{width:393,height:852},locale:'fr-FR',userAgent:UAS[name]});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.goto(URL);await p.waitForTimeout(800);await fn(p);await ctx.close();}
const det=p=>p.evaluate(()=>{const d=Install.detect();return d.os+'/'+d.browser});
const open=async(p)=>{await p.evaluate(()=>Install.open());await p.waitForTimeout(250);return p.textContent('#install-body')};
await run('iosSafari',async p=>{ok('iOS Safari détecté',await det(p)==='ios/safari');const t=await open(p);
 ok('iOS : Partager + Sur l\'écran d\'accueil + avertissement données',t.includes('Sur l\'écran d\'accueil')&&t.includes('démarre vide'));
 ok('modale visible',await p.isVisible('#install-modal'));
 await p.click('#install-body .seg button:has-text("Android")');await p.waitForTimeout(150);
 ok('onglet Android sans « cet appareil »',(await p.textContent('#install-body')).includes('Installer l\'application')&&!(await p.textContent('#install-body')).includes('cet appareil'));
 await p.evaluate(()=>Install.close());await p.waitForTimeout(300);
 await p.evaluate(()=>UI.showSettings());await p.waitForTimeout(250);
 ok('ligne Paramètres visible',await p.isVisible('#install-row'));
 await p.click('#install-row');await p.waitForTimeout(400);
 ok('Paramètres → Installer',await p.isVisible('#install-modal'));});
await run('iosChrome',async p=>{ok('iOS Chrome détecté',await det(p)==='ios/chrome');ok('conseille Safari',(await open(p)).includes('Safari'));});
await run('iosInApp',async p=>{ok('navigateur intégré détecté',await det(p)==='ios/inapp');ok('demande d\'ouvrir dans Safari',(await open(p)).includes('Ouvrir dans Safari'));});
await run('androidChrome',async p=>{ok('Android Chrome détecté',await det(p)==='android/chrome');
 let t=await open(p);ok('étapes menu ⋮ sans bouton direct',t.includes('Installer l\'application')&&!t.includes('📲 Installer ScoreMaster'));
 await p.evaluate(()=>{PWA.deferredPrompt={prompt(){window.__p=1},userChoice:Promise.resolve({outcome:'accepted'})};Install.refresh()});await p.waitForTimeout(200);
 ok('bouton direct quand le prompt est dispo',(await p.textContent('#install-body')).includes('📲 Installer ScoreMaster'));});
await run('samsung',async p=>{ok('Samsung détecté',await det(p)==='android/samsung');ok('Ajouter la page à',(await open(p)).includes('Ajouter la page à'));});
await run('androidFx',async p=>{ok('Firefox Android',await det(p)==='android/firefox');});
await run('desktop',async p=>{ok('Desktop',await det(p)==='desktop/chrome');ok('icône barre d\'adresse',(await open(p)).includes('barre d\'adresse'));});
// déjà installée
{const ctx=await b.newContext({viewport:{width:393,height:852},userAgent:UAS.iosSafari});const p=await ctx.newPage();
 await p.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
 await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.goto(URL);await p.waitForTimeout(800);ok('standalone : « déjà installée »',(await open(p)).includes('déjà installée'));
 await p.evaluate(()=>{Install.close();UI.showSettings()});await p.waitForTimeout(250);
 ok('standalone : ligne Paramètres masquée',!(await p.isVisible('#install-row')));await ctx.close();}
// guide : slide installation
{const ctx=await b.newContext({viewport:{width:393,height:852},userAgent:UAS.androidChrome});const p=await ctx.newPage();
 await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.goto(URL+'?guide=1');await p.waitForTimeout(1200);
 let found=false;for(let i=0;i<8;i++){if((await p.textContent('.ob-title')).includes('Installe')){found=true;break}await p.click('.ob-actions .ob-primary');await p.waitForTimeout(120)}
 ok('guide Android : slide installation avec étapes ⋮',found&&(await p.textContent('.ob-text')).includes('Installer l\'application'));await ctx.close();}
ok('aucune erreur JS',errs.length===0);if(errs.length)console.log(errs);
await b.close();})();
