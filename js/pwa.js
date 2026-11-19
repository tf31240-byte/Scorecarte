    const PWA = {
        deferredPrompt: null,
        isInstalled: false,
        
        init() {
            this.checkIfInstalled();
            this.registerServiceWorker();
            this.setupInstallPrompt();
            this.setupUpdateNotification();
            this.addInstallButton();
            this.setupOfflineDetection();
        },
        

        // --- Détection hors-ligne ---
        setupOfflineDetection() {
            const badge = document.getElementById('offline-badge');
            if (!badge) return;

            // Tooltip au tap : affiche 2s puis disparaît
            let tipTimer = null;
            badge.addEventListener('click', () => {
                badge.classList.add('show-tip');
                clearTimeout(tipTimer);
                tipTimer = setTimeout(() => badge.classList.remove('show-tip'), 2000);
            });

            const update = (isOnline) => {
                badge.classList.toggle('visible', !isOnline);
                badge.classList.remove('show-tip');
                if (!isOnline) {
                    UI.showToast('📵 Connexion perdue — mode hors-ligne', 'warning');
                } else {
                    UI.showToast('✅ Connexion rétablie', 'success');
                    if (navigator.serviceWorker?.controller) {
                        navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {});
                    }
                }
            };

            window.addEventListener('online',  () => update(true));
            window.addEventListener('offline', () => update(false));

            // État au démarrage
            if (!navigator.onLine) {
                badge.classList.add('visible');
                log('[PWA] Démarrage hors-ligne');
            }
        },

        // --- Détection & Installation ---
        checkIfInstalled() {
            // Vérifier si l'app est installée
            if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
                this.isInstalled = true;
                log('[PWA] App installée');
            }
        },
        

        // --- Service Worker ---
        async registerServiceWorker() {
            if (!('serviceWorker' in navigator)) {
                console.warn('[PWA] Service Worker non supporté — mode hors-ligne indisponible');
                return;
            }
            try {
                const registration = await navigator.serviceWorker.register('./service-worker.js');
                log('[PWA] Service Worker enregistré:', registration.scope);
                
                // Vérifier les mises à jour
                registration.addEventListener('updatefound', () => {
                    log('[PWA] Mise à jour trouvée');
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });

                // Écouter les messages du SW (ex: update disponible)
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data?.type === 'UPDATE_AVAILABLE') {
                        this.showUpdateNotification();
                    }
                });

            } catch (error) {
                // SW introuvable ou protocole non supporté (ex: file://)
                // L'app reste fonctionnelle, juste sans cache offline
                console.warn('[PWA] Service Worker non enregistré (normal en local) :', error.message);
            }
        },
        
        setupInstallPrompt() {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                log('[PWA] Installation disponible');
                try { Install.refresh(); } catch (err) {}
                this.showInstallButton();
            });
            
            window.addEventListener('appinstalled', () => {
                log('[PWA] App installée avec succès');
                this.isInstalled = true;
                this.hideInstallButton();
                UI.showToast('✅ ScoreMaster installé !', 'success');
            });
        },
        
        async installApp() {
            if (!this.deferredPrompt) {
                log('[PWA] Pas de prompt disponible');
                return;
            }
            
            this.deferredPrompt.prompt();
            try {
                const { outcome } = await this.deferredPrompt.userChoice;
                log('[PWA] Installation:', outcome);
                if (outcome === 'accepted') SoundFX.success();
                this.deferredPrompt = null;
                this.hideInstallButton();
            } catch (e) { log('[PWA] Install prompt error:', e); }
        },
        

        /** Crée et insère le bandeau d'installation PWA dans le setup. */

        /** Applique les styles CSS et le contenu HTML du bandeau d'installation. */
        _styleInstallBanner(banner) {
            banner.style.cssText = [
                'background:linear-gradient(135deg,var(--primary),#0051D5)',
                'color:white', 'padding:15px 20px', 'border-radius:16px',
                'margin:20px 0', 'display:none', 'align-items:center',
                'gap:15px', 'box-shadow:0 8px 20px rgba(0,122,255,0.3)',
                'cursor:pointer', 'transition:transform 0.2s'
            ].join(';');
            banner.innerHTML = `
                <div style="font-size:32px;">📱</div>
                <div style="flex:1;">
                    <div style="font-weight:900; font-size:16px; margin-bottom:3px;">Installer ScoreMaster</div>
                    <div style="font-size:12px; opacity:0.9;">Accédez rapidement depuis votre écran d'accueil</div>
                </div>
                <div style="font-size:24px;">→</div>`;
            banner.onclick = () => this.installApp();
        },

        _insertInstallBanner() {
            const setupContainer = document.getElementById('setup');
            if (!setupContainer) return;

            const banner = document.createElement('div');
            banner.id = 'install-banner';
            this._styleInstallBanner(banner);

            const anchor = setupContainer.querySelector('.header-controls');
            if (anchor?.nextSibling) setupContainer.insertBefore(banner, anchor.nextSibling);
        },

        addInstallButton() {
            // Supprimer un éventuel ancien banner
            const existing = document.getElementById('install-banner');
            if (existing) existing.remove();
            
            if (!this.isInstalled) this._insertInstallBanner();
        },
        
        showInstallButton() {
            const banner = document.getElementById('install-banner');
            if (banner) {
                banner.style.display = 'flex';
                setTimeout(() => {
                    banner.style.animation = 'slideIn 0.4s ease-out';
                }, 100);
            }
        },
        
        hideInstallButton() {
            const banner = document.getElementById('install-banner');
            if (banner) {
                banner.style.display = 'none';
            }
        },
        
        setupUpdateNotification() {
            // Écouter les messages du Service Worker
            navigator.serviceWorker?.addEventListener('message', (event) => {
                if (event.data.type === 'UPDATE_AVAILABLE') {
                    this.showUpdateNotification();
                }
            });
        },
        

        /** Crée l'élément DOM du bandeau de mise à jour disponible. */

        /** Applique les styles CSS et le contenu HTML du bandeau de mise à jour. */
        _styleUpdateBanner(el) {
            el.style.cssText = [
                'position:fixed',
                'top:max(20px,env(safe-area-inset-top))',
                'left:50%', 'transform:translateX(-50%)',
                'background:var(--card)', 'border:2px solid var(--primary)',
                'padding:12px 20px', 'border-radius:16px',
                'box-shadow:0 8px 20px rgba(0,0,0,0.2)',
                'z-index:9999', 'display:flex', 'align-items:center',
                'gap:12px', 'max-width:90%', 'animation:slideIn 0.4s ease-out'
            ].join(';');
            el.innerHTML = `
                <div style="font-size:20px;">🆕</div>
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:14px; color:var(--text);">Mise à jour disponible</div>
                    <div style="font-size:12px; color:var(--text-sec);">Rechargez pour la dernière version</div>
                </div>
                <button onclick="location.reload()" style="background:var(--primary); color:var(--on-primary); border:none; padding:8px 16px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">
                    RECHARGER
                </button>`;
        },

        _createUpdateBanner() {
            const el = document.createElement('div');
            el.className = 'pwa-update-banner';
            this._styleUpdateBanner(el);
            return el;
        },


        /**
         * Programme la disparition du bandeau de mise à jour :
         * fondu en 300 ms après 10 secondes, puis suppression du DOM.
         */
        _scheduleUpdateBannerDismiss(banner) {
            setTimeout(() => {
                banner.style.opacity    = '0';
                banner.style.transition = 'opacity 0.3s';
                setTimeout(() => banner.remove(), 300);
            }, 10000);
        },

        showUpdateNotification() {
            // Supprimer un éventuel ancien banner de mise à jour
            document.querySelectorAll('.pwa-update-banner').forEach(b => b.remove());
            
            const updateBanner = this._createUpdateBanner();
            document.body.appendChild(updateBanner);
            this._scheduleUpdateBannerDismiss(updateBanner);
        }
    };
    

