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

