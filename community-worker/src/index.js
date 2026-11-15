// ScoreMaster — API communauté (profils facultatifs, avec consentement)
// Routes :
//   POST /api/profile         crée/met à jour le profil de la personne (consentement donné dans l'app)
//   POST /api/profile/delete  supprime le profil (retrait du consentement)
//   GET  /admin               tableau de bord (Basic Auth : mot de passe = secret ADMIN_KEY)
//   POST /admin/delete        suppression manuelle d'un profil depuis le tableau de bord
//   GET  /admin?format=json|csv

const MAX_BODY = 2048;
const MAX_PROFILES = 5000;

// ---------- utilitaires ----------
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>"'&`\\]/g, '').trim().slice(0, max);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isId = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const h = { 'Vary': 'Origin' };
  if (origin && allowedOrigins(env).includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

const json = (obj, status, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('payload trop gros');
  return JSON.parse(text);
}

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function isAdmin(request, env) {
  if (!env.ADMIN_KEY) return null; // non configuré
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  let pass = '';
  try { pass = atob(auth.slice(6)).split(':').slice(1).join(':'); } catch { return false; }
  return safeEqual(pass, env.ADMIN_KEY);
}

// ---------- API publique ----------
async function upsertProfile(request, env) {
  const cors = corsHeaders(request, env);
  if (!cors['Access-Control-Allow-Origin']) return json({ error: 'origine non autorisée' }, 403);
  let b;
  try { b = await readJson(request); } catch { return json({ error: 'requête invalide' }, 400, cors); }
  if (!isId(b.id)) return json({ error: 'id invalide' }, 400, cors);
  if (b.consent !== true) return json({ error: 'consentement requis' }, 400, cors);
  const pseudo = clean(b.pseudo, 30);
  if (!pseudo) return json({ error: 'pseudo requis' }, 400, cors);

  const dev = b.device && typeof b.device === 'object' ? b.device : {};
  const games = Math.max(0, Math.min(100000, parseInt(b.games, 10) || 0));
  let lastGame = null;
  if (b.lastGameAt) { const d = new Date(b.lastGameAt); if (!isNaN(d)) lastGame = d.toISOString(); }
  const now = new Date().toISOString();

  const exists = await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ?').bind(b.id).first();
  if (!exists) {
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first();
    if (n >= MAX_PROFILES) return json({ error: 'capacité atteinte' }, 503, cors);
  }
  await env.DB.prepare(
    `INSERT INTO profiles (id, pseudo, platform, os, browser, model, standalone, app_version, games, last_game_at, consent_at, first_seen, last_seen)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?11)
     ON CONFLICT(id) DO UPDATE SET pseudo = ?2, platform = ?3, os = ?4, browser = ?5, model = ?6, standalone = ?7,
       app_version = ?8, games = ?9, last_game_at = ?10, last_seen = ?11`
  ).bind(
    b.id, pseudo, clean(dev.platform, 30), clean(dev.os, 40), clean(dev.browser, 40), clean(dev.model, 40),
    dev.standalone ? 1 : 0, clean(b.appVersion, 20), games, lastGame, now
  ).run();
  return json({ ok: true }, 200, cors);
}

async function deleteProfile(request, env) {
  const cors = corsHeaders(request, env);
  if (!cors['Access-Control-Allow-Origin']) return json({ error: 'origine non autorisée' }, 403);
  let b;
  try { b = await readJson(request); } catch { return json({ error: 'requête invalide' }, 400, cors); }
  if (!isId(b.id)) return json({ error: 'id invalide' }, 400, cors);
  await env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(b.id).run();
  return json({ ok: true }, 200, cors);
}

// ---------- tableau de bord ----------
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
};

function renderDashboard(rows) {
  const total = rows.length;
  const week = Date.now() - 7 * 86400000;
  const active = rows.filter((r) => new Date(r.last_seen).getTime() >= week).length;
  const games = rows.reduce((s, r) => s + (r.games || 0), 0);
  const installed = rows.filter((r) => r.standalone).length;
  const body = rows.map((r) => `<tr>
    <td><b>${esc(r.pseudo)}</b></td>
    <td>${esc([r.model, r.os, r.browser].filter(Boolean).join(' · ') || r.platform || '—')}</td>
    <td>${r.standalone ? '📲 installée' : 'navigateur'}</td>
    <td class="n">${r.games}</td>
    <td>${fmtDate(r.last_game_at)}</td>
    <td>${fmtDate(r.first_seen)}</td>
    <td>${fmtDate(r.last_seen)}</td>
    <td><form method="post" action="/admin/delete" onsubmit="return confirm('Supprimer ce profil ?')"><input type="hidden" name="id" value="${esc(r.id)}"><button>Supprimer</button></form></td>
  </tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ScoreMaster — Communauté</title><meta name="robots" content="noindex">
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:20px;background:#0f1226;color:#eef;}
h1{margin:0 0 16px;font-size:22px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.stat{background:#1b1f3b;border-radius:14px;padding:14px 18px;min-width:120px}
.stat b{display:block;font-size:26px;color:#ffd666}.stat span{font-size:12px;color:#aab}
.wrap{overflow-x:auto;background:#161a33;border-radius:14px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #262b52;white-space:nowrap}
th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#aab}
td.n{text-align:right;font-weight:700}
button{background:#3a1d2a;color:#ff8a9b;border:1px solid #6b2c3e;border-radius:8px;padding:4px 10px;cursor:pointer}
a{color:#7fb2ff}.foot{margin-top:14px;font-size:12px;color:#889}
</style></head><body>
<h1>👥 Communauté ScoreMaster</h1>
<div class="stats">
<div class="stat"><b>${total}</b><span>profils</span></div>
<div class="stat"><b>${active}</b><span>actifs (7 j)</span></div>
<div class="stat"><b>${games}</b><span>parties terminées</span></div>
<div class="stat"><b>${installed}</b><span>apps installées</span></div>
</div>
<div class="wrap"><table><thead><tr><th>Pseudo</th><th>Appareil</th><th>Usage</th><th>Parties</th><th>Dernière partie</th><th>Inscrit</th><th>Vu</th><th></th></tr></thead>
<tbody>${body || '<tr><td colspan="8" style="padding:24px;color:#889">Aucun profil pour le moment.</td></tr>'}</tbody></table></div>
<p class="foot">Export : <a href="/admin?format=csv">CSV</a> · <a href="/admin?format=json">JSON</a> — Données fournies volontairement par les personnes (consentement dans l'app). Chaque personne peut se retirer depuis l'app ; vous pouvez aussi supprimer un profil ici sur demande.</p>
</body></html>`;
}

const csvCell = (v) => {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[";\n\r,]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};

async function admin(request, env, url) {
  const auth = await isAdmin(request, env);
  if (auth === null) return new Response('ADMIN_KEY non configuré', { status: 503 });
  if (!auth) return new Response('Authentification requise', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="ScoreMaster", charset="UTF-8"' } });

  if (request.method === 'POST' && url.pathname === '/admin/delete') {
    // anti-CSRF : la requête doit provenir de ce même site
    if (request.headers.get('Origin') !== url.origin) return new Response('Origine invalide', { status: 403 });
    const form = await request.formData();
    const id = String(form.get('id') || '');
    if (isId(id)) await env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(id).run();
    return Response.redirect(url.origin + '/admin', 303);
  }
  if (request.method !== 'GET') return new Response('Méthode non autorisée', { status: 405 });

  const { results } = await env.DB.prepare('SELECT * FROM profiles ORDER BY last_seen DESC').all();
  const fmt = url.searchParams.get('format');
  const secure = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (fmt === 'json') return json(results, 200, secure);
  if (fmt === 'csv') {
    const head = ['pseudo', 'plateforme', 'os', 'navigateur', 'modèle', 'installée', 'parties', 'dernière_partie', 'inscrit', 'vu'];
    const lines = [head.join(',')].concat(results.map((r) =>
      [r.pseudo, r.platform, r.os, r.browser, r.model, r.standalone ? 'oui' : 'non', r.games, r.last_game_at, r.first_seen, r.last_seen].map(csvCell).join(',')));
    return new Response('﻿' + lines.join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="scoremaster-communaute.csv"', ...secure } });
  }
  return new Response(renderDashboard(results), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", ...secure },
  });
}

// ---------- routage ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (url.pathname === '/api/profile' && request.method === 'POST') return await upsertProfile(request, env);
      if (url.pathname === '/api/profile/delete' && request.method === 'POST') return await deleteProfile(request, env);
      if (url.pathname.startsWith('/admin')) return await admin(request, env, url);
      if (url.pathname === '/') return new Response('ScoreMaster community API', { headers: { 'Content-Type': 'text/plain' } });
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error(e);
      return json({ error: 'erreur serveur' }, 500, corsHeaders(request, env));
    }
  },
};
