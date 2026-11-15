/**
 * ЭКЗАМЕН СССР: Цены, ГОСТы и Быт
 * Процедурный Web Audio API звуковой движок высокого качества
 * 0 внешних файлов, 0 КБ трафика, 100% совместимость со всеми браузерами и мобилками.
 * 
 * Без шума, треска и резких пищалок:
 * - Уютная ностальгическая мелодия советского кино (ламповое вибро-электропиано / колокольчики)
 * - Мягкий тактильный клик переключателя
 * - Аутентичный двойной перезвон латунных советских копеек
 * - Тёплый мажорный аккорд «ГОСТ соблюдён!»
 * - Мягкий деревянный глухой стук при ошибке (без мерзкого зуммера)
 * - Торжественные куранты и победные фанфары
 */

window.GameAudio = {
    ctx: null,
    muted: localStorage.getItem('ussr_sound_muted') === 'true',
    musicMuted: localStorage.getItem('ussr_music_muted') === 'true',
    masterVolume: 0.75,
    musicPlaying: false,
    musicInterval: null,
    musicGain: null,
    _adPaused: false,

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended' && !this._adPaused) {
            this.ctx.resume().catch(() => {});
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('ussr_sound_muted', this.muted);
        if (!this.muted) {
            this.init();
            this.playClick();
        }
        return this.muted;
    },

    toggleMusic() {
        this.musicMuted = !this.musicMuted;
        localStorage.setItem('ussr_music_muted', this.musicMuted);
        if (this.musicMuted) {
            this.stopMusic();
        } else {
            this.init();
            this.startMusic();
        }
        return this.musicMuted;
    },

    isMuted() {
        return this.muted;
    },

    isMusicMuted() {
        return this.musicMuted;
    },

    pauseForAd() {
        this._adPaused = true;
        this.stopMusic();
        if (this.ctx && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
            this.ctx.suspend().catch(() => {});
        }
    },

    resumeAfterAd() {
        this._adPaused = false;
        if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
            this.ctx.resume().catch(() => {});
        }
        if (!this.musicMuted) {
            this.startMusic();
        }
    },

    /**
     * УЮТНАЯ СОВЕТСКАЯ МЕЛОДИЯ («Ностальгия / Добрый вечер»)
     * Тёплый ламповый синтезатор: мягкое электропиано с аналоговым фильтром и нежным эхом.
     * НИКАКОГО ШУМА И ТРЕСКА.
     */
    startMusic() {
        if (this.musicPlaying || this.musicMuted || this._adPaused) return;
        this.init();
        if (!this.ctx) return;
        this.musicPlaying = true;

        // Ноты мелодии в C major / A minor (MIDI номера)
        // Ностальгический, светлый ретро-мотив
        const MELODY = [
            // Такт 1: C - E - G - B
            { m: 60, d: 0.45 }, { m: 64, d: 0.45 }, { m: 67, d: 0.45 }, { m: 71, d: 0.55 },
            // Такт 2: A - C - E - G
            { m: 69, d: 0.45 }, { m: 64, d: 0.45 }, { m: 60, d: 0.45 }, { m: 67, d: 0.55 },
            // Такт 3: F - A - C - E
            { m: 65, d: 0.45 }, { m: 69, d: 0.45 }, { m: 72, d: 0.45 }, { m: 71, d: 0.55 },
            // Такт 4: G - B - D - G (разрешение)
            { m: 67, d: 0.45 }, { m: 71, d: 0.45 }, { m: 74, d: 0.65 }, { m: 0,  d: 0.45 },
            // Такт 5: A - C5 - E5
            { m: 69, d: 0.45 }, { m: 72, d: 0.45 }, { m: 76, d: 0.55 }, { m: 74, d: 0.45 },
            // Такт 6: G - B - D5
            { m: 67, d: 0.45 }, { m: 71, d: 0.45 }, { m: 74, d: 0.55 }, { m: 72, d: 0.45 },
            // Такт 7: F - A - C5
            { m: 65, d: 0.45 }, { m: 69, d: 0.45 }, { m: 72, d: 0.55 }, { m: 69, d: 0.45 },
            // Такт 8: E - G - C5 (финал петли)
            { m: 64, d: 0.45 }, { m: 67, d: 0.45 }, { m: 72, d: 0.85 }, { m: 0,  d: 0.55 }
        ];

        let noteIdx = 0;
        const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);

        // Главный регулятор громкости музыки
        const master = this.ctx.createGain();
        master.gain.setValueAtTime(0.18 * this.masterVolume, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

        // Нежное эхо (delay)
        const delay = this.ctx.createDelay();
        delay.delayTime.value = 0.28;
        const delayGain = this.ctx.createGain();
        delayGain.gain.value = 0.22;

        delay.connect(delayGain);
        delayGain.connect(delay);
        delayGain.connect(master);

        filter.connect(master);
        filter.connect(delay);
        master.connect(this.ctx.destination);

        this.musicGain = master;

        const playNextNote = () => {
            if (!this.musicPlaying || this.musicMuted || this._adPaused || !this.ctx) return;
            const item = MELODY[noteIdx % MELODY.length];
            noteIdx++;

            if (item.m > 0) {
                const now = this.ctx.currentTime;
                const freq = m2f(item.m);

                // Тёплый синус + мягкая треугольная гармоника (а-ля вибро-пианино / металлофон)
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const noteGain = this.ctx.createGain();

                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(freq, now);

                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(freq, now);

                noteGain.gain.setValueAtTime(0.001, now);
                noteGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
                noteGain.gain.exponentialRampToValueAtTime(0.0001, now + item.d + 0.35);

                osc1.connect(noteGain);
                osc2.connect(noteGain);
                noteGain.connect(filter);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + item.d + 0.4);
                osc2.stop(now + item.d + 0.4);
            }

            this.musicInterval = setTimeout(playNextNote, (item.d + 0.06) * 1000);
        };

        playNextNote();
    },

    stopMusic() {
        this.musicPlaying = false;
        if (this.musicInterval) {
            clearTimeout(this.musicInterval);
            this.musicInterval = null;
        }
        if (this.musicGain && this.ctx) {
            try {
                this.musicGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);
                setTimeout(() => {
                    try { this.musicGain.disconnect(); } catch (e) {}
                    this.musicGain = null;
                }, 160);
            } catch (e) {
                this.musicGain = null;
            }
        }
    },

    // Совместимость со старыми вызовами
    startVinylAmbience() {
        this.startMusic();
    },
    stopVinylAmbience() {
        this.stopMusic();
    },

    /**
     * ТАКТИЛЬНЫЙ ЩЕЛЧОК КЛАВИШИ (ASMR приятный мягкий переключатель)
     */
    playClick() {
        if (this.muted || this._adPaused) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

        gain.gain.setValueAtTime(0.22 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    },

    /**
     * ПЕРЕЗВОН ЛАТУННЫХ КОПЕЕК (Кристальный монетный звук)
     */
    playCoin() {
        if (this.muted || this._adPaused) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const freqs = [2100, 2850];
        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);

            gain.gain.setValueAtTime(0.12 * this.masterVolume, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.32);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.35);
        });
    },

    /**
     * ПРАВИЛЬНЫЙ ОТВЕТ: Тёплый мажорный арпеджио «ГОСТ соблюдён!»
     */
    playCorrect() {
        if (this.muted || this._adPaused) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Мажорный перелив До-Ми-Соль-До (C5, E5, G5, C6) с мягкой колокольной атакой
        const notes = [
            { f: 523.25, t: 0.00, d: 0.30 },
            { f: 659.25, t: 0.06, d: 0.30 },
            { f: 783.99, t: 0.12, d: 0.35 },
            { f: 1046.50, t: 0.18, d: 0.50 }
        ];

        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.f, now + n.t);

            gain.gain.setValueAtTime(0.14 * this.masterVolume, now + n.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + n.t);
            osc.stop(now + n.t + n.d + 0.02);
        });
    },

    /**
     * ОШИБКА: Мягкий деревянный стук (не режет ухо, не раздражает)
     */
    playWrong() {
        if (this.muted || this._adPaused) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.16);

        gain.gain.setValueAtTime(0.24 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.20);
    },

    /**
     * ПОБЕДНЫЕ ФАНФАРЫ: Торжественный советский аккорд завершения главы
     */
    playFanfare() {
        if (this.muted || this._adPaused) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [
            { f: 523.25, t: 0.00, d: 0.14 },
            { f: 523.25, t: 0.14, d: 0.14 },
            { f: 523.25, t: 0.28, d: 0.14 },
            { f: 659.25, t: 0.42, d: 0.28 },
            { f: 783.99, t: 0.70, d: 0.45 },
            { f: 1046.50, t: 1.00, d: 0.70 }
        ];

        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, now + n.t);

            gain.gain.setValueAtTime(0.18 * this.masterVolume, now + n.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + n.t);
            osc.stop(now + n.t + n.d + 0.02);
        });
    }
};
