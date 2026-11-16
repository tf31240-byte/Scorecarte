// ScoreMaster — API communauté (profils facultatifs, avec consentement)
// Routes :
//   POST /api/profile         crée/met à jour le profil de la personne (consentement donné dans l'app)
//   POST /api/profile/delete  supprime le profil (retrait du consentement)
//   POST /api/backup/put      enregistre la sauvegarde cloud (identité = pseudo unique + couleur préférée)
//   POST /api/backup/check    indique si un pseudo existe déjà
//   POST /api/backup/get      récupère la sauvegarde complète
//   POST /api/backup/info     métadonnées seulement (date, appareil, nb de parties)
//   POST /api/backup/delete   supprime la sauvegarde
//   GET  /admin               tableau de bord (Basic Auth : mot de passe = secret ADMIN_KEY)
//   POST /admin/delete        suppression manuelle d'un profil depuis le tableau de bord
//   GET  /admin?format=json|csv

const MAX_BODY = 2048;
const MAX_PROFILES = 5000;
const MAX_BACKUPS = 2000;
const MAX_BACKUP_BODY = 1_500_000;   // ~1,5 Mo (limite de ligne D1 : 2 Mo)
const MIN_BACKUP_INTERVAL_MS = 4000; // anti-rafale : une écriture toutes les 4 s au plus par sauvegarde

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
  const d = b.detail && typeof b.detail === 'object' ? b.detail : {};
  const num = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
  const screen = /^\d{2,5}x\d{2,5}@\d(\.\d)?$/.test(String(d.screen || '')) ? String(d.screen) : null;
  const theme = ['dark', 'light'].includes(d.theme) ? d.theme : null;
  let lastErrAt = null; if (d.lastErrorAt) { const e = new Date(d.lastErrorAt); if (!isNaN(e)) lastErrAt = e.toISOString(); }

  const exists = await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ?').bind(b.id).first();
  if (!exists) {
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first();
    if (n >= MAX_PROFILES) return json({ error: 'capacité atteinte' }, 503, cors);
  }
  await env.DB.prepare(
    `INSERT INTO profiles (id, pseudo, platform, os, browser, model, standalone, app_version, games, last_game_at, consent_at, first_seen, last_seen,
                           screen, lang, tz, sessions, players, top_game, theme, errors, last_error, last_error_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
     ON CONFLICT(id) DO UPDATE SET pseudo = ?2, platform = ?3, os = ?4, browser = ?5, model = ?6, standalone = ?7,
       app_version = ?8, games = ?9, last_game_at = ?10, last_seen = ?11,
       screen = COALESCE(?12, screen), lang = COALESCE(?13, lang), tz = COALESCE(?14, tz),
       sessions = MAX(sessions, ?15), players = ?16, top_game = COALESCE(?17, top_game), theme = COALESCE(?18, theme),
       errors = MAX(errors, ?19), last_error = COALESCE(?20, last_error), last_error_at = COALESCE(?21, last_error_at)`
  ).bind(
    b.id, pseudo, clean(dev.platform, 30), clean(dev.os, 40), clean(dev.browser, 40), clean(dev.model, 40),
    dev.standalone ? 1 : 0, clean(b.appVersion, 20), games, lastGame, now,
    screen, clean(d.lang, 12) || null, clean(d.tz, 40) || null, num(d.sessions, 1e6), num(d.players, 10000), clean(d.topGame, 30) || null, theme,
    num(d.errors, 1e6), clean(d.lastError, 160) || null, lastErrAt
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


// ---------- sauvegarde cloud ----------
// Identité = pseudo (unique) + couleur préférée. La couleur n'est jamais stockée en clair :
// seule une empreinte salée est conservée. 5 essais ratés bloquent le pseudo 15 minutes.
const COLORS = ['rouge', 'orange', 'jaune', 'vert', 'turquoise', 'bleu', 'violet', 'rose', 'marron', 'noir', 'blanc', 'gris'];
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function pseudoKey(v) {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const colorHash = (salt, key, color) => sha(`scoremaster-backup:${salt}:${key}:${color}`);

async function readBackupBody(request, max) {
  const text = await request.text();
  if (text.length > max) throw new Error('payload trop gros');
  return JSON.parse(text);
}

async function backup(request, env, url) {
  const cors = corsHeaders(request, env);
  if (!cors['Access-Control-Allow-Origin']) return json({ error: 'origine non autorisée' }, 403);
  const action = url.pathname.replace('/api/backup/', '');
  let b;
  try { b = await readBackupBody(request, action === 'put' ? MAX_BACKUP_BODY : MAX_BODY); }
  catch (e) { return json({ error: e.message === 'payload trop gros' ? 'payload trop gros' : 'requête invalide' }, e.message === 'payload trop gros' ? 413 : 400, cors); }

  const key = pseudoKey(b.pseudo);
  if (key.length < 2 || key.length > 30) return json({ error: 'pseudo invalide' }, 400, cors);
  const pseudo = clean(b.pseudo, 30);
  const now = Date.now();
  const row = await env.DB.prepare('SELECT pseudo_key, pseudo, salt, color_hash, fails, locked_until, enc, size, games, device, app_version, updated_at FROM backups WHERE pseudo_key = ?').bind(key).first();

  if (action === 'check') return json({ ok: true, exists: !!row }, 200, cors);

  const color = String(b.color ?? '');
  if (!COLORS.includes(color)) return json({ error: 'couleur invalide' }, 400, cors);

  // Authentification (si le pseudo existe déjà)
  if (row) {
    if (row.locked_until && row.locked_until > now) {
      return json({ error: 'verrouillé', retryInSec: Math.ceil((row.locked_until - now) / 1000) }, 429, cors);
    }
    if ((await colorHash(row.salt, key, color)) !== row.color_hash) {
      const fails = (row.fails || 0) + 1;
      const lock = fails >= MAX_FAILS ? now + LOCK_MS : 0;
      await env.DB.prepare('UPDATE backups SET fails = ?, locked_until = ? WHERE pseudo_key = ?').bind(lock ? 0 : fails, lock, key).run();
      return json({ error: 'identifiants incorrects', left: lock ? 0 : MAX_FAILS - fails }, 403, cors);
    }
    if (row.fails || row.locked_until) await env.DB.prepare('UPDATE backups SET fails = 0, locked_until = 0 WHERE pseudo_key = ?').bind(key).run();
  }

  if (action === 'put') {
    if (typeof b.payload !== 'string' || !b.payload.length) return json({ error: 'sauvegarde vide' }, 400, cors);
    const enc = b.enc === 'gzip' ? 'gzip' : 'json';
    const games = Math.max(0, Math.min(100000, parseInt(b.meta?.games, 10) || 0));
    const device = clean(b.meta?.device, 80);
    const iso = new Date(now).toISOString();
    if (row) {
      if (now - new Date(row.updated_at).getTime() < MIN_BACKUP_INTERVAL_MS) return json({ error: 'trop rapide' }, 429, cors);
      await env.DB.prepare('UPDATE backups SET payload=?1, enc=?2, size=?3, games=?4, device=?5, app_version=?6, updated_at=?7 WHERE pseudo_key=?8')
        .bind(b.payload, enc, b.payload.length, games, device, clean(b.meta?.appVersion, 20), iso, key).run();
    } else {
      const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM backups').first();
      if (n >= MAX_BACKUPS) return json({ error: 'capacité atteinte' }, 503, cors);
      const salt = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO backups (pseudo_key, pseudo, salt, color_hash, fails, locked_until, payload, enc, size, games, device, app_version, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, 0, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`
      ).bind(key, pseudo, salt, await colorHash(salt, key, color), b.payload, enc, b.payload.length, games, device, clean(b.meta?.appVersion, 20), iso).run();
    }
    return json({ ok: true, updatedAt: iso }, 200, cors);
  }
  if (action === 'get' || action === 'info') {
    if (!row) return json({ error: 'introuvable' }, 404, cors);
    const out = { ok: true, pseudo: row.pseudo, enc: row.enc, size: row.size, games: row.games, device: row.device, appVersion: row.app_version, updatedAt: row.updated_at };
    if (action === 'get') out.payload = (await env.DB.prepare('SELECT payload FROM backups WHERE pseudo_key = ?').bind(key).first())?.payload;
    return json(out, 200, cors);
  }
  if (action === 'delete') {
    await env.DB.prepare('DELETE FROM backups WHERE pseudo_key = ?').bind(key).run();
    return json({ ok: true }, 200, cors);
  }
  return json({ error: 'action inconnue' }, 404, cors);
}

// ---------- tableau de bord ----------
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
};

// Modèle probable d'après la taille d'écran (en points, portrait). Safari ne donne pas le modèle exact.
const IPHONES = {
  '320x568@2': 'iPhone SE (1re gén.)', '375x667@2': 'iPhone SE / 8', '414x736@3': 'iPhone 8 Plus',
  '375x812@3': 'iPhone X / XS / 11 Pro / 12-13 mini', '414x896@2': 'iPhone XR / 11', '414x896@3': 'iPhone XS Max / 11 Pro Max',
  '390x844@3': 'iPhone 12 / 13 / 14', '428x926@3': 'iPhone 12-13 Pro Max / 14 Plus',
  '393x852@3': 'iPhone 14 Pro / 15 / 15 Pro / 16', '430x932@3': 'iPhone 14-15 Pro Max / 15-16 Plus',
  '402x874@3': 'iPhone 16 Pro / 17 / 17 Pro', '440x956@3': 'iPhone 16-17 Pro Max', '420x912@3': 'iPhone Air',
};
function deviceName(r) {
  let name = r.model || '';
  if (r.platform === 'iOS' && /^iPhone$/i.test(name) && r.screen && IPHONES[r.screen]) name = IPHONES[r.screen] + ' (probable)';
  if (!name) name = r.platform || '';
  const browser = r.browser === 'Autre' ? '' : r.browser;
  return [name, r.os && r.os !== r.platform ? r.os : '', browser].filter(Boolean).join(' · ') || '—';
}
const ago = (iso, now) => {
  const t = new Date(iso).getTime();
  if (!iso || isNaN(t)) return '—';
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 2) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d < 60 ? `il y a ${d} j` : fmtDate(iso);
};
const tally = (arr) => {
  const m = new Map(); arr.filter(Boolean).forEach((k) => m.set(k, (m.get(k) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const dayKey = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }); // AAAA-MM-JJ
const VIEWS = { all: 'Tous', active: 'Actifs (7 j)', inactive: 'Inactifs', errors: 'Avec erreurs', outdated: 'Pas à jour', nocloud: 'Sans sauvegarde' };
const SORTS = { recent: 'Vu récemment', games: 'Plus de parties', first: 'Plus anciens', name: 'Nom (A-Z)' };

function renderDashboard(rows, backups, params = new URLSearchParams()) {
  const now = Date.now();
  const q = String(params.get('q') || '').trim().slice(0, 40);
  const view = VIEWS[params.get('f')] ? params.get('f') : 'all';
  const sort = SORTS[params.get('s')] ? params.get('s') : 'recent';
  const bkBy = new Map(backups.map((b) => [b.pseudo_key, b]));
  const ageDays = (iso) => (now - new Date(iso).getTime()) / 86400000;
  const maxVer = Math.max(0, ...rows.map((r) => parseInt(r.app_version, 10) || 0));
  const isOutdated = (r) => (parseInt(r.app_version, 10) || 0) < maxVer;
  const hasCloud = (r) => bkBy.has(pseudoKey(r.pseudo));
  const perPerson = new Map();
  rows.forEach((r) => perPerson.set(pseudoKey(r.pseudo), (perPerson.get(pseudoKey(r.pseudo)) || 0) + 1));

  // ----- Chiffres clés -----
  const people = new Set(rows.map((r) => pseudoKey(r.pseudo)));
  const act = (d) => rows.filter((r) => ageDays(r.last_seen) <= d).length;
  const games = rows.reduce((s, r) => s + (r.games || 0), 0);
  const installed = rows.filter((r) => r.standalone).length;
  const newWeek = rows.filter((r) => ageDays(r.first_seen) <= 7).length;
  const bkSize = backups.reduce((s, b) => s + (b.size || 0), 0);
  const kpi = (n, label, sub = '') => `<div class="stat"><b>${n}</b><span>${label}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;

  // ----- Graphiques -----
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(dayKey(new Date(now - i * 86400000).toISOString()));
  const signups = new Map(days.map((d) => [d, 0]));
  rows.forEach((r) => { const k = dayKey(r.first_seen); if (signups.has(k)) signups.set(k, signups.get(k) + 1); });
  const sMax = Math.max(1, ...signups.values());
  const signupChart = `<div class="bars">${days.map((d) => {
    const n = signups.get(d);
    return `<i title="${esc(d)} : ${n}" style="height:${n ? Math.max(8, Math.round(n / sMax * 100)) : 3}%" class="${n ? 'on' : ''}"></i>`;
  }).join('')}</div><div class="axis"><span>${esc(days[0].slice(5))}</span><span>${rows.filter((r) => ageDays(r.first_seen) <= 30).length} inscrit(s) en 30 j</span><span>aujourd'hui</span></div>`;

  const hbar = (title, entries, limit = 6) => {
    const top = entries.slice(0, limit), max = Math.max(1, ...top.map((e) => e[1]));
    return top.length ? `<section class="panel"><h3>${title}</h3>${top.map(([k, n]) => `<div class="hb"><span class="hl">${esc(k)}</span><span class="ht"><i style="width:${Math.round(n / max * 100)}%"></i></span><b>${n}</b></div>`).join('')}</section>` : '';
  };
  const buckets = [
    ["Aujourd'hui", rows.filter((r) => ageDays(r.last_seen) < 1).length],
    ['2 à 7 jours', rows.filter((r) => ageDays(r.last_seen) >= 1 && ageDays(r.last_seen) <= 7).length],
    ['8 à 30 jours', rows.filter((r) => ageDays(r.last_seen) > 7 && ageDays(r.last_seen) <= 30).length],
    ['Plus de 30 jours', rows.filter((r) => ageDays(r.last_seen) > 30).length],
  ];
  const topPlayers = [...rows].sort((a, b) => (b.games || 0) - (a.games || 0)).filter((r) => r.games > 0).map((r) => [r.pseudo, r.games]);

  // ----- À surveiller -----
  const names = (list) => list.slice(0, 6).map((r) => esc(r.pseudo)).join(', ') + (list.length > 6 ? '…' : '');
  const alerts = [];
  const withErr = rows.filter((r) => r.errors > 0), old = rows.filter(isOutdated), dormant = rows.filter((r) => ageDays(r.last_seen) > 14), noCloud = rows.filter((r) => !hasCloud(r));
  if (withErr.length) alerts.push(`<li class="bad">🐞 <b>${withErr.length}</b> appareil(s) avec erreurs : ${names(withErr)}</li>`);
  if (old.length) alerts.push(`<li class="warn">⬆️ <b>${old.length}</b> appareil(s) pas à jour (dernière version : v${maxVer}) : ${names(old)}</li>`);
  if (dormant.length) alerts.push(`<li>💤 <b>${dormant.length}</b> inactif(s) depuis plus de 14 jours : ${names(dormant)}</li>`);
  if (noCloud.length) alerts.push(`<li>☁️ <b>${noCloud.length}</b> sans sauvegarde cloud : ${names(noCloud)}</li>`);

  // ----- Liste filtrée -----
  const match = {
    all: () => true, active: (r) => ageDays(r.last_seen) <= 7, inactive: (r) => ageDays(r.last_seen) > 7,
    errors: (r) => r.errors > 0, outdated: isOutdated, nocloud: (r) => !hasCloud(r),
  }[view];
  const needle = pseudoKey(q);
  let list = rows.filter(match).filter((r) => !needle || pseudoKey(r.pseudo).includes(needle) || pseudoKey(deviceName(r)).includes(needle));
  const cmp = {
    recent: (a, b) => new Date(b.last_seen) - new Date(a.last_seen),
    games: (a, b) => (b.games || 0) - (a.games || 0),
    first: (a, b) => new Date(a.first_seen) - new Date(b.first_seen),
    name: (a, b) => String(a.pseudo).localeCompare(String(b.pseudo), 'fr'),
  }[sort];
  list = list.sort(cmp);

  const href = (over) => { const p = new URLSearchParams({ ...(q ? { q } : {}), f: view, s: sort, ...over }); return '/admin?' + p.toString(); };
  const chips = Object.entries(VIEWS).map(([k, l]) => `<a class="fc ${k === view ? 'sel' : ''}" href="${esc(href({ f: k }))}">${l}</a>`).join('');
  const sortLinks = Object.entries(SORTS).map(([k, l]) => `<a class="fc ${k === sort ? 'sel' : ''}" href="${esc(href({ s: k }))}">${l}</a>`).join('');

  const cards = list.map((r) => {
    const key = pseudoKey(r.pseudo), bk = bkBy.get(key), active = ageDays(r.last_seen) <= 7, devs = perPerson.get(key);
    const line = (k, v) => v ? `<div class="l"><dt>${k}</dt><dd>${v}</dd></div>` : '';
    const scr = r.screen ? esc(r.screen.replace('x', ' × ').replace('@', ' pts · ') + 'x') : '';
    const ver = r.app_version ? `v${esc(r.app_version)}${isOutdated(r) ? ` <span class="warn">⚠️ pas à jour (dernière : v${maxVer})</span>` : ' ✅'}` : '';
    return `<details class="card">
  <summary>
    <span class="dot ${active ? 'on' : ''}" title="${active ? 'actif' : 'inactif'}"></span>
    <span class="sm"><b class="who">${esc(r.pseudo)}</b>${devs > 1 ? ` <span class="badge">${devs} appareils</span>` : ''}${r.errors > 0 ? ' <span class="badge bad">🐞 ' + r.errors + '</span>' : ''}${isOutdated(r) ? ' <span class="badge warnb">⬆️</span>' : ''}
      <small>${esc(deviceName(r))}</small></span>
    <span class="sr"><b>${r.games}</b> partie${r.games > 1 ? 's' : ''}<small>${esc(ago(r.last_seen, now))}</small></span>
  </summary>
  <dl>
    ${line('Écran', scr)}
    ${line('Utilisation', r.standalone ? '📲 app installée' : '🌐 navigateur')}
    ${line('Région', esc([r.lang, r.tz].filter(Boolean).join(' · ')))}
    ${line('Joueurs', r.players ? `${r.players} différent${r.players > 1 ? 's' : ''}` : '')}
    ${line('Jeu favori', esc(r.top_game || ''))}
    ${line('Lancements', r.sessions ? String(r.sessions) : '')}
    ${line('Dernière partie', r.last_game_at ? esc(ago(r.last_game_at, now)) : '')}
    ${line('Thème', r.theme === 'dark' ? '🌙 sombre' : r.theme === 'light' ? '☀️ clair' : '')}
    ${line('Cloud', bk ? `☁️ ${esc(ago(bk.updated_at, now))} · ${(bk.size / 1024).toFixed(0)} Ko · ${bk.games} partie${bk.games > 1 ? 's' : ''}` : 'pas de sauvegarde')}
    ${line('Inscrit', esc(fmtDate(r.first_seen)))}
    ${line('Version app', ver)}
    ${line('Erreurs', r.errors ? `<span class="warn"><b>${r.errors}</b></span> · ${esc(ago(r.last_error_at, now))}<br><code>${esc(r.last_error || '')}</code>` : (r.sessions ? 'aucune ✅' : ''))}
  </dl>
  <details class="del"><summary>🗑️ Supprimer ce profil…</summary>
    <form method="post" action="/admin/delete"><input type="hidden" name="id" value="${esc(r.id)}"><span>Cette action est définitive.</span> <button>Confirmer la suppression</button></form>
  </details>
</details>`;
  }).join('');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ScoreMaster — Communauté</title><meta name="robots" content="noindex">
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px;background:#0f1226;color:#eef;max-width:1100px;margin-inline:auto}
header.top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:14px}
h1{margin:0;font-size:22px}.upd{font-size:12px;color:#889}.upd a{margin-left:8px}
h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#889;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin-bottom:14px}
.stat{background:#1b1f3b;border-radius:14px;padding:12px 14px}
.stat b{display:block;font-size:26px;color:#ffd666}.stat span{font-size:12px;color:#aab}.stat em{display:block;font-style:normal;font-size:11px;color:#7be0a0;margin-top:2px}
.alerts{background:#1c1730;border:1px solid #3a2f63;border-radius:14px;padding:12px 16px;margin-bottom:14px}
.alerts ul{margin:0;padding:0;list-style:none}.alerts li{padding:4px 0;font-size:14px;line-height:1.4}
.alerts .bad{color:#ffb3a7}.alerts .warn{color:#ffd9a0}.ok{color:#7be0a0;font-size:14px}
.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:18px}
.panel{background:#161a33;border:1px solid #262b52;border-radius:14px;padding:14px 16px}
.bars{display:flex;align-items:flex-end;gap:2px;height:70px}
.bars i{flex:1;background:#262b52;border-radius:2px 2px 0 0;min-height:2px}.bars i.on{background:#ffd666}
.axis{display:flex;justify-content:space-between;font-size:11px;color:#889;margin-top:6px}
.hb{display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0}.hl{flex:0 0 38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ht{flex:1;height:8px;background:#20254a;border-radius:4px;overflow:hidden}.ht i{display:block;height:100%;background:#7fb2ff;border-radius:4px}.hb b{color:#ffd666;min-width:18px;text-align:right}
.tools{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.tools form{display:flex;gap:8px}.tools input[type=search]{flex:1;min-width:0;background:#1b1f3b;border:1px solid #2c3260;border-radius:10px;padding:9px 12px;color:#eef;font-size:15px}
.tools button{background:#2a3470;color:#dfe6ff;border:1px solid #3d49a0;border-radius:10px;padding:9px 14px;cursor:pointer;font-size:14px}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.rl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#889;margin-right:4px}
.fc{background:#1b1f3b;border-radius:999px;padding:5px 11px;font-size:13px;color:#ccd;text-decoration:none;border:1px solid transparent}.fc.sel{border-color:#7fb2ff;color:#fff;background:#243064}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:10px;align-items:start}
.card{background:#161a33;border-radius:14px;padding:12px 14px;border:1px solid #262b52}
.card summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none}.card summary::-webkit-details-marker{display:none}
.sm{flex:1;min-width:0}.sm small,.sr small{display:block;color:#99a;font-size:12px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr{text-align:right;font-size:13px;white-space:nowrap}.sr b{color:#ffd666;font-size:16px}
.who{font-size:16px}.badge{font-size:11px;background:#2a2f5c;border-radius:999px;padding:2px 7px;color:#bcd;margin-left:4px}.badge.bad{background:#4a2330;color:#ffb3a7}.badge.warnb{background:#4a3a1c}
.dot{width:10px;height:10px;border-radius:50%;background:#555;flex:0 0 10px}.dot.on{background:#37d67a;box-shadow:0 0 6px #37d67a88}
.warn{color:#ffd9a0}code{font-size:12px;color:#ffb3a7;word-break:break-word}
dl{margin:10px 0 0}.l{display:flex;gap:10px;padding:5px 0;border-top:1px solid #20254a;font-size:14px}
dt{flex:0 0 105px;color:#889;font-size:12px;text-transform:uppercase;letter-spacing:.04em;padding-top:2px}dd{margin:0;flex:1;word-break:break-word}
details.del{margin-top:10px}details.del summary{display:block;font-size:13px;color:#ff8a9b;cursor:pointer}.card form{margin:8px 0 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:#aab}.card button{background:#3a1d2a;color:#ff8a9b;border:1px solid #6b2c3e;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}
a{color:#7fb2ff}.foot{margin-top:18px;font-size:12px;color:#889;line-height:1.5}.empty{padding:24px;color:#889}
</style></head><body>
<header class="top"><h1>👥 Communauté ScoreMaster</h1><span class="upd">Mis à jour ${esc(new Date(now).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }))}<a href="${esc(href({}))}">↻ Actualiser</a></span></header>
<div class="stats">
${kpi(people.size, 'personnes', newWeek ? `+${newWeek} cette semaine` : '')}
${kpi(rows.length, 'appareils')}
${kpi(act(1), 'actifs 24 h')}
${kpi(act(7), 'actifs 7 j')}
${kpi(act(30), 'actifs 30 j')}
${kpi(games, 'parties terminées')}
${kpi(installed, 'apps installées')}
${kpi(backups.length, 'sauvegardes cloud', (bkSize / 1024).toFixed(0) + ' Ko')}
</div>
<section class="alerts"><h3>À surveiller</h3>${alerts.length ? `<ul>${alerts.join('')}</ul>` : '<div class="ok">✅ Rien à signaler</div>'}</section>
<div class="panels">
<section class="panel"><h3>Inscriptions (30 derniers jours)</h3>${signupChart}</section>
<section class="panel"><h3>Dernière activité</h3>${buckets.map(([k, n]) => `<div class="hb"><span class="hl">${k}</span><span class="ht"><i style="width:${rows.length ? Math.round(n / rows.length * 100) : 0}%"></i></span><b>${n}</b></div>`).join('')}</section>
${hbar('Systèmes', tally(rows.map((r) => r.platform)))}
${hbar('Versions du système', tally(rows.map((r) => r.os && r.os !== r.platform ? r.os : null)))}
${hbar('Navigateurs', tally(rows.map((r) => r.browser === 'Autre' ? null : r.browser)))}
${hbar('Jeux favoris', tally(rows.map((r) => r.top_game)))}
${hbar('Versions de l\'app', tally(rows.map((r) => r.app_version ? 'v' + r.app_version : null)))}
${hbar('Parties par personne', topPlayers)}
</div>
<div class="tools">
<form method="get" action="/admin"><input type="search" name="q" value="${esc(q)}" placeholder="Rechercher…" maxlength="40"><input type="hidden" name="f" value="${esc(view)}"><input type="hidden" name="s" value="${esc(sort)}"><button>Chercher</button></form>
<div class="row"><span class="rl">Afficher</span>${chips}</div>
<div class="row"><span class="rl">Trier</span>${sortLinks}</div>
</div>
<div class="row" style="margin-bottom:10px;color:#99a;font-size:13px">${list.length} appareil${list.length > 1 ? 's' : ''}${q || view !== 'all' ? ` (filtré sur ${rows.length})` : ''}</div>
<div class="grid">${cards || '<div class="empty">Aucun résultat.</div>'}</div>
<p class="foot">Export : <a href="/admin?format=csv">CSV</a> · <a href="/admin?format=json">JSON</a><br>Données fournies volontairement par les personnes (consentement dans l'app). Le modèle d'iPhone est une estimation d'après la taille d'écran : Safari ne communique pas le modèle exact. Chaque personne peut se retirer depuis l'app ; vous pouvez aussi supprimer un profil ici sur demande.</p>
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
    const head = ['pseudo', 'plateforme', 'os', 'navigateur', 'modèle', 'écran', 'langue', 'fuseau', 'installée', 'parties', 'joueurs', 'jeu_favori', 'lancements', 'version', 'erreurs', 'dernière_erreur', 'dernière_partie', 'inscrit', 'vu'];
    const lines = [head.join(',')].concat(results.map((r) =>
      [r.pseudo, r.platform, r.os, r.browser, r.model, r.screen, r.lang, r.tz, r.standalone ? 'oui' : 'non', r.games, r.players, r.top_game, r.sessions, r.app_version, r.errors, r.last_error, r.last_game_at, r.first_seen, r.last_seen].map(csvCell).join(',')));
    return new Response('﻿' + lines.join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="scoremaster-communaute.csv"', ...secure } });
  }
  const { results: bks } = await env.DB.prepare('SELECT pseudo_key, size, games, updated_at FROM backups').all();
  return new Response(renderDashboard(results, bks, url.searchParams), {
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
      if (/^\/api\/backup\/(put|get|info|delete|check)$/.test(url.pathname) && request.method === 'POST') return await backup(request, env, url);
      if (url.pathname.startsWith('/admin')) return await admin(request, env, url);
      if (url.pathname === '/') return new Response('ScoreMaster community API', { headers: { 'Content-Type': 'text/plain' } });
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error(e);
      return json({ error: 'erreur serveur' }, 500, corsHeaders(request, env));
    }
  },
};
