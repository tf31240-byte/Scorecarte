#!/usr/bin/env node
/**
 * Lance toute la suite de tests ScoreMaster sur le VRAI index.html (Playwright + Chromium).
 *
 *   cd tests && npm install && npx playwright install chromium   (une seule fois)
 *   node run.js            # toute la suite
 *   node run.js stats      # seulement les fichiers dont le nom contient « stats »
 *
 * Chaque fichier *.test.js affiche ✅ / ❌ par vérification ; le code de sortie est 1 s'il y a un ❌.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/json', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
});

const run = (file, url) => new Promise(resolve => {
    let out = '';
    const c = spawn(process.execPath, [path.join(__dirname, file)], { env: { ...process.env, SM_URL: url } });
    c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
    const timer = setTimeout(() => { c.kill(); out += '\n❌ délai dépassé (240 s)'; }, 240000);
    c.on('close', code => { clearTimeout(timer); resolve({ file, out, code }); });
});

server.listen(0, '127.0.0.1', async () => {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const filter = process.argv[2];
    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!filter || f.includes(filter))).sort();
    let pass = 0, fail = 0;
    const WORKERS = Number(process.env.SM_WORKERS) || 4;   // fichiers de test lancés en parallèle
    const queue = [...files], results = new Map();
    await Promise.all(Array.from({ length: WORKERS }, async () => {
        while (queue.length) { const f = queue.shift(); results.set(f, await run(f, url)); }
    }));
    for (const f of files) {
        const r = results.get(f);
        const ok = (r.out.match(/✅/g) || []).length, ko = (r.out.match(/❌/g) || []).length + (r.code ? 1 : 0);
        pass += ok; fail += ko;
        console.log(`${ko ? '❌' : '✅'} ${f.padEnd(28)} ${ok} ok${ko ? `, ${ko} échec(s)` : ''}`);
        if (ko) console.log(r.out.split('\n').filter(l => /❌|Error|errs/.test(l)).map(l => '    ' + l).join('\n'));
    }
    console.log(`\n${fail ? '❌' : '✅'} ${pass} vérifications réussies, ${fail} échec(s)`);
    server.close(); process.exit(fail ? 1 : 0);
});
