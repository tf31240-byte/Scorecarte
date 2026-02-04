// ScoreMaster Service Worker v13
const CACHE_VERSION = 'scoremaster-v13.0.0';
const CACHE_ASSETS = [
  './',
  './ScoreMaster_PWA.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

// Installation - Mise en cache des ressources
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Mise en cache des assets');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => self.skipWaiting()) // Active immédiatement
  );
});

// Activation - Nettoyage des vieux caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Prend le contrôle immédiatement
  );
});

// Fetch - Stratégie Cache First avec Network Fallback
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorer les requêtes externes (sauf CDN)
  const url = new URL(event.request.url);
  const isCDN = url.hostname.includes('cdn.jsdelivr.net');
  const isSameOrigin = url.origin === self.location.origin;
  
  if (!isSameOrigin && !isCDN) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Si trouvé en cache, le retourner
        if (cachedResponse) {
          console.log('[SW] Cache hit:', event.request.url);
          return cachedResponse;
        }

        // Sinon, fetch depuis le réseau
        console.log('[SW] Network fetch:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Mettre en cache pour les prochaines fois
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_VERSION)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // En cas d'erreur réseau, retourner une page offline si HTML
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./ScoreMaster_PWA.html');
            }
          });
      })
  );
});

// Message - Communication avec l'app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting demandé');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

// Notification de mise à jour disponible
self.addEventListener('controllerchange', () => {
  console.log('[SW] Nouveau Service Worker actif');
});

// Background Sync (optionnel - pour futures fonctionnalités)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-scores') {
    event.waitUntil(syncScores());
  }
});

async function syncScores() {
  // Placeholder pour sync future
  console.log('[SW] Sync des scores...');
  return Promise.resolve();
}
