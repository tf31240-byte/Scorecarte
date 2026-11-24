    // ---------- Bibliothèques externes : chargées après l'affichage (ne bloquent plus le démarrage) ----------
    document.addEventListener('pointerdown', (e) => { if (app._swipeOpen && !app._swipeOpen.contains(e.target)) app._closeSwipe(); }, true);
    window.addEventListener('resize', () => UI._fitSoon());
    window.addEventListener('orientationchange', () => UI._fitSoon());
    const Libs = {
        BASE: 'https://cdn.jsdelivr.net/npm/',
        load(path, onload) {
            const el = document.createElement('script');
            el.src = this.BASE + path; el.crossOrigin = 'anonymous'; el.async = true;
            if (onload) el.onload = onload;
            document.head.appendChild(el);
        },
        start() {
            // Le graphique est nécessaire tout de suite : il arrive juste après le premier affichage et se redessine
            this.load('chart.js@4.6.1/dist/chart.umd.min.js', () => { try { if (app.currentGame) app.render(); } catch (e) {} });
            // Confettis et GIF ne servent qu'en fin de manche/partie : on attend que l'appli soit au repos
            const later = () => {
                this.load('canvas-confetti@1.6.0/dist/confetti.browser.min.js');
                this.load('gifshot@0.4.5/dist/gifshot.min.js');
            };
            const idle = () => (window.requestIdleCallback ? requestIdleCallback(later, { timeout: 4000 }) : setTimeout(later, 2500));
            if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            app.init();
            PWA.init();
            Community.init();
            Cloud.init();
            Onboarding.maybeShow();
            Libs.start();
        });
    } else {
        app.init();
        PWA.init();
        Community.init();
        Cloud.init();
        Onboarding.maybeShow();
        Libs.start();
    }
