// ============================================================
//  ScoreMaster — Service Worker v12
//  Stratégie : cache-first pour l'app shell,
//              stale-while-revalidate pour les CDN.
//  Résultat  : app 100 % fonctionnelle sans connexion
//              après la première visite en ligne.
// ============================================================

const CACHE_APP = 'scoremaster-app-v12';
const CACHE_CDN = 'scoremaster-cdn-v12';

// ── Ressources à précacher à l'install ──────────────────────
const APP_SHELL = [
    './',
    './scoremaster.html',
    './manifest.json',
];

// Icônes : precache uniquement si elles existent (allSettled)
const APP_ICONS = [
    './icon-180.png',
    './icon-192.png',
    './icon-512.png',
];

// Bibliothèques CDN (nécessitent crossorigin="anonymous" dans le HTML)
const CDN_LIBS = [
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
    'https://cdn.jsdelivr.net/npm/gifshot@0.4.5/dist/gifshot.min.js',
];

// ── Install : precache ───────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_APP).then(cache =>
                // allSettled : l'install ne plante pas si une ressource manque
                Promise.allSettled([
                    ...APP_SHELL.map(url => cache.add(url)),
                    ...APP_ICONS.map(url => cache.add(url).catch(() => {})),
                ])
            ),
            caches.open(CACHE_CDN).then(cache =>
                Promise.allSettled(
                    CDN_LIBS.map(url =>
                        cache.add(new Request(url, { mode: 'cors', credentials: 'omit' }))
                             .catch(() => console.warn('[SW] CDN non mis en cache (hors-ligne ?) :', url))
                    )
                )
            ),
        ])
        .then(() => {
            console.log('[SW] Precache terminé');
            return self.skipWaiting(); // Activation immédiate
        })
    );
});

// ── Activate : nettoyer les anciens caches ───────────────────
self.addEventListener('activate', (event) => {
    const CURRENT = new Set([CACHE_APP, CACHE_CDN]);
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys.filter(k => !CURRENT.has(k)).map(k => {
                        console.log('[SW] Suppression ancien cache :', k);
                        return caches.delete(k);
                    })
                )
            )
            .then(() => {
                console.log('[SW] Activé — contrôle immédiat des clients');
                return self.clients.claim();
            })
    );
});

// ── Fetch : stratégie par type de ressource ─────────────────
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // ── CDN : stale-while-revalidate ──────────────────────────
    const isCDN = CDN_LIBS.some(lib => event.request.url.startsWith(lib));
    if (isCDN) {
        event.respondWith(staleWhileRevalidate(event.request, CACHE_CDN));
        return;
    }

    // ── Hors-origine (autres CDN, fonts…) : network-first silencieux ──
    if (url.origin !== location.origin) {
        event.respondWith(
            fetch(event.request).catch(() =>
                caches.match(event.request)
                    .then(cached => cached || new Response('', { status: 503 }))
            )
        );
        return;
    }

    // ── App shell (même origine) : cache-first + revalidation fond ──
    event.respondWith(cacheFirstWithUpdate(event.request));
});

// ── Helpers ─────────────────────────────────────────────────

/**
 * Cache-first avec mise à jour silencieuse en fond.
 * Fallback vers scoremaster.html pour les requêtes de navigation.
 */
async function cacheFirstWithUpdate(request) {
    const cache   = await caches.open(CACHE_APP);
    const cached  = await cache.match(request);

    // Mise à jour en arrière-plan
    const fetchPromise = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => null);

    if (cached) {
        // Retourner le cache immédiatement, fetch en fond
        fetchPromise; // fire-and-forget
        return cached;
    }

    // Pas en cache : attendre le réseau
    const networkResponse = await fetchPromise;
    if (networkResponse) return networkResponse;

    // Hors-ligne et pas en cache : fallback app shell
    if (request.destination === 'document') {
        const shell = await cache.match('./scoremaster.html') || await cache.match('./');
        if (shell) return shell;
    }

    return new Response(
        '<h1 style="font-family:sans-serif;text-align:center;margin-top:30vh">📵 Hors-ligne — ouvrez l\'app une première fois avec une connexion.</h1>',
        { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
    );
}

/**
 * Stale-while-revalidate : retourne le cache immédiatement
 * et met à jour en fond pour la prochaine visite.
 */
async function staleWhileRevalidate(request, cacheName) {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(request);

    // Fetch en fond dans tous les cas
    fetch(request)
        .then(response => { if (response.ok) cache.put(request, response.clone()); })
        .catch(() => {});

    return cached || fetch(request).catch(() =>
        new Response('', { status: 503 })
    );
}

// ── Message : forcer la mise à jour immédiate ────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
