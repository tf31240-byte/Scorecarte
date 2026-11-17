const {chromium}=require('playwright');const ok=(n,c)=>console.log((c?'✅':'❌'),n);
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:'light'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await p.goto((process.env.SM_URL||'http://localhost:8769/'));await p.waitForTimeout(900);
const A=()=>p.evaluate(()=>{const r=document.documentElement;return{t:r.dataset.theme||null,p:r.dataset.palette||null,s:r.dataset.scheme,bg:getComputedStyle(r).getPropertyValue('--bg').trim(),pr:getComputedStyle(r).getPropertyValue('--primary').trim(),meta:document.getElementById('theme-color-meta').content}});
let a=await A();ok('défaut : Auto/Océan, scheme light',a.t===null&&a.p===null&&a.s==='light'&&a.pr==='#007AFF');
await p.evaluate(()=>UI.showSettings());await p.waitForTimeout(500);
ok('sélecteur de mode + 6 palettes',(await p.$$('#theme-mode button')).length===3&&(await p.$$('#palette-grid .palette-btn')).length===6);
ok('Auto actif, Océan actif',await p.evaluate(()=>document.querySelector('#theme-mode button.active').dataset.mode==='auto'&&document.querySelector('.palette-btn.active').textContent.includes('Océan')));
await p.click('.palette-btn:has-text("Forêt")');a=await A();ok('Forêt clair',a.p==='forest'&&a.s==='light'&&a.pr==='#1F8A4C'&&a.meta==='#1F8A4C');
await p.click('#theme-mode button[data-mode="dark"]');a=await A();ok('Forêt sombre',a.t==='dark'&&a.s==='dark'&&a.pr==='#34C77B'&&a.bg==='#07120B');

await p.click('.palette-btn:has-text("Tapis vert")');a=await A();ok('Tapis vert sombre',a.pr==='#3FBF73');
ok('persistance localStorage',await p.evaluate(()=>localStorage.getItem('sm_palette')==='felt'&&localStorage.getItem('sm_theme')==='dark'));
await p.reload();await p.waitForTimeout(900);a=await A();ok('conservé après rechargement (sans flash : appliqué avant JS)',a.p==='felt'&&a.s==='dark');
await p.click('.palette-btn:has-text("Océan")').catch(()=>{});
await p.evaluate(()=>UI.showSettings());await p.waitForTimeout(300);
await p.click('.palette-btn:has-text("Océan")');await p.click('#theme-mode button[data-mode="auto"]');a=await A();
ok('retour Auto/Océan : attributs retirés',a.t===null&&a.p===null&&a.pr==='#007AFF'&&(await p.evaluate(()=>localStorage.getItem('sm_palette')===null&&localStorage.getItem('sm_theme')===null)));
// Auto suit le système
await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(300);a=await A();ok('Auto : suit le système (dark)',a.s==='dark'&&a.bg==='#000000');
await p.click('.palette-btn:has-text("Crépuscule")');a=await A();ok('Crépuscule + système sombre',a.s==='dark'&&a.pr==='#A56BFF');
await p.emulateMedia({colorScheme:'light'});await p.waitForTimeout(300);a=await A();ok('système repasse clair',a.s==='light'&&a.pr==='#8E4DE0');
// export / import
const exp=await p.evaluate(()=>Storage.getAllData?Storage.getAllData():null);
const ex=await p.evaluate(()=>{const keys=Object.getOwnPropertyNames(Storage).filter(k=>/export|collect|snapshot/i.test(k));return keys});console.log('storage fns',ex);
// toggleTheme
await p.evaluate(()=>app.toggleTheme());a=await A();ok('toggleTheme bascule en sombre',a.t==='dark'&&a.s==='dark');
// import palette
await p.evaluate(()=>app._applyImportedPalette('felt'));a=await A();ok('import palette',a.p==='felt');
await p.evaluate(()=>app._applyImportedPalette('bidon'));a=await A();ok('palette invalide ignorée',a.p==='felt');
console.log('errs',errs);await b.close()})();
