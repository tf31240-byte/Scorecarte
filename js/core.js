    // ==================== UTILITAIRES ====================
    // Debounce utility pour optimiser les écritures
    const debounce = (fn, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    };
    
    // Escape HTML pour prévenir les XSS
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    

    // Journal de debug : silencieux par défaut. Pour l'activer : localStorage.setItem('sm_debug','1') puis recharger.
    const log = (...args) => { try { if (localStorage.getItem('sm_debug') === '1') console.log(...args); } catch (e) {} };

    // ==================== ICÔNES (dessinées : identiques sur tous les téléphones) ====================
    const ICONS = {
        stats:    '<path d="M3 3v18h18"/><path d="M8 16v-5M12.5 16V8M17 16v-8"/>',
        settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
        back:     '<path d="M15 18l-6-6 6-6"/>',
        eye:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        list:     '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
        grid:     '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
        expand:   '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
        collapse: '<path d="M14 10h6V4M10 14H4v6M20 4l-6 6M4 20l6-6"/>',
        flame:    '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-8z"/>',
        clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        play:     '<path d="M7 4.5v15l12-7.5z"/>',
        trash:    '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/>',
        chevd:    '<path d="M6 9l6 6 6-6"/>',
        history:  '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
        gamepad:  '<path d="M6 8h12a4 4 0 0 1 4 4.2l-.5 3.2a2.6 2.6 0 0 1-4.6 1.2L15.5 15h-7l-1.4 1.6a2.6 2.6 0 0 1-4.6-1.2L2 12.200A4 4 0 0 1 6 8z"/><path d="M7 10.500v3M5.500 12h3"/><circle cx="15.500" cy="11" r=".8" fill="currentColor"/><circle cx="17.800" cy="13" r=".8" fill="currentColor"/>',
        trophy:   '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
        star:     '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/>',
        cloud:    '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18H7z"/>',
        palette:  '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.5-1.2-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7" r="1" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1" fill="currentColor"/>',
        bell:     '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
        volume:   '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
        sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon:     '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
        auto:     '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
        share:    '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'
    };
    const icon = (name, size = 22) => `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
    const icon_ = icon; // alias pour les gabarits où « icon » est déjà un paramètre (icône du jeu)
    /** Remplace le contenu texte des éléments [data-icon] par l'icône (les enfants, comme la pastille rouge, sont conservés). */
    const applyIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => {
        [...el.childNodes].forEach(n => { if (n.nodeType === 3 || (n.nodeType === 1 && n.classList.contains('ico'))) n.remove(); });
        el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon, Number(el.dataset.size) || 22));
    });

    // ==================== CONSTANTS ====================

    /** Nombre minimum de manches pour qualifier une partie de "Marathon" */
    const MARATHON_THRESHOLD = 20;

    /** Longueur maximale d'un nom de joueur */
    const NAME_MAX_LEN = 20;

    /** Score maximum autorisé en saisie */
    const SCORE_MAX = 9999;
    /** Score minimum autorisé en saisie */
    const SCORE_MIN = -9999;
    /** Score total d'une manche de Belote (attaquant + défenseur) */
    const BELOTE_ROUND_TOTAL = 162;
    /** Capot Belote (toutes les levées) */
    const BELOTE_CAPOT = 252;
    /** Score de victoire par défaut en Belote */
    const BELOTE_WIN_SCORE = 1000;
    /** Seuils de milestone confetti */
    const MILESTONE_SCORES = [200, 500, 1000];

    /** Valeurs de condition de victoire (victoryCondition) */
    const VC_HIGHEST = 'highest'; // Le plus haut score gagne
    const VC_LOWEST  = 'lowest';  // Le plus bas score gagne

    /** Valeurs de type de fin de partie (endType / endCondition.type) */
    const END_FREE  = 'free';  // Partie libre, pas de limite
    const END_SCORE = 'score'; // Fin quand un joueur atteint scoreTarget

    /** Palette de couleurs pour les joueurs (ordre de priorité) */
    const PLAYER_COLORS = [
        '#007AFF', '#FF2D55', '#34C759', '#FF9500',
        '#AF52DE', '#5AC8FA', '#FFCC00', '#5856D6',
        '#FF3B30', '#30B0C7', '#8E8E93', '#4CD964'
    ];

    /** Helper vibration — no-op si désactivé ou non supporté.
     *  Appelé uniquement après initialisation de app. */
    const vibrate = (pattern) => {
        if (app.settings && app.settings.vibration && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    };

    // ==================== SOUND ENGINE ====================
    const SoundFX = {
        ctx: null, 
        enabled: true,
        audioAvailable: false,
        

        /** Crée et configure l'AudioContext ; active le mode silencieux si non supporté. */
        _initAudioContext() {
            try {
                if (window.AudioContext || window.webkitAudioContext) {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                    this.audioAvailable = true;
                    if (this.ctx.state === 'suspended') {
                        document.addEventListener('click', () => {
                            if (this.ctx && this.ctx.state === 'suspended')
                                this.ctx.resume().catch(() => {});
                        }, { once: true });
                    }
                } else {
                    console.warn('AudioContext non supporté - mode silencieux');
                    this.enabled = false;
                    this.audioAvailable = false;
                }
            } catch(e) {
                console.warn('Audio API non disponible:', e.message);
                this.enabled = false;
                this.audioAvailable = false;
            }
        },

        init() {
            // Fermer l'ancien AudioContext s'il existe
            if (this.ctx && this.ctx.state !== 'closed') {
                this.ctx.close().catch(() => {});
                this.ctx = null;
            }
            
            this._initAudioContext();
        },
        
        playTone(freq, type, duration) {
            if (!this.enabled || !this.audioAvailable || !this.ctx) return;
            
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }
                
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {
                // Silencieux en cas d'erreur
            }
        },
        
        click() { 
            if (this.enabled) this.playTone(800, 'sine', 0.1); 
        },
        

        /** Joue un bruit blanc filtré passe-bas avec fondu rapide (effet "slide"). */
        _playNoiseSlide() {
            const bufferSize = this.ctx.sampleRate * 0.15;
            const buffer     = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data       = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise  = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const gain   = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            filter.type            = 'lowpass';
            filter.frequency.value = 400;
            gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start();
        },

        slide() { 
            if (!this.enabled || !this.audioAvailable || !this.ctx) return;
            try { this._playNoiseSlide(); } catch (e) {}
        },
        
        success() { 
            if (this.enabled) {
                this.playTone(600, 'sine', 0.1); 
                setTimeout(() => this.playTone(900, 'sine', 0.2), 100);
            }
        },
        
        error() { 
            if (this.enabled) this.playTone(150, 'sawtooth', 0.3); 
        }
    };

