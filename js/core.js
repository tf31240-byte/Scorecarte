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
        collapse: '<path d="M14 10h6V4M10 14H4v6M20 4l-6 6M4 20l6-6"/>'
    };
    const icon = (name, size = 22) => `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
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

