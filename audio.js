/**
 * Web Audio API синтезатор эпохи СССР по стандарту casual-game-audio
 * 0 внешних файлов, 0 КБ трафика, 100% совместимость на смартфонах и ПК.
 * 
 * Включает:
 * 1. Уютный ламповый фон виниловой пластинки (МЕЛОДИЯ 1970-х): теплый аналоговый шорох и мягкие микро-трески
 * 2. Механический щелчок советского кассового аппарата / клавиши радио
 * 3. Натуральный металлический перезвон советских латунных копеек (автомат с газировкой)
 * 4. Тёплый органный аккорд «ГОСТ соблюдён»
 * 5. Мягкий басовый щелчок при ошибке (вместо резкого зуммера)
 * 6. Торжественный аккорд советских победных курантов
 */
window.GameAudio = {
    ctx: null,
    muted: false,
    vinylNode: null,
    vinylGain: null,
    isVinylPlaying: false,

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        if (!this.muted && !this.isVinylPlaying && this.ctx) {
            this.startVinylAmbience();
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stopVinylAmbience();
        } else {
            this.init();
            this.startVinylAmbience();
            this.playClick();
        }
        return this.muted;
    },

    /**
     * Создает процедурный бесконечный шорох и теплоту советской виниловой пластинки
     */
    startVinylAmbience() {
        if (!this.ctx || this.isVinylPlaying || this.muted) return;
        try {
            // Буфер розового/коричневого шума с фильтрацией под ламповый проигрыватель
            const bufferSize = this.ctx.sampleRate * 2; // 2 секунды петли
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0;

            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                // Pink noise filter (1/f)
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                let pink = b0 + b1 + b2 + white * 0.5362;

                // Случайные редкие микрощелчки винила (crackle)
                if (Math.random() < 0.0008) {
                    pink += (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.7);
                }

                output[i] = pink * 0.08;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;

            // Полосовой фильтр теплого винилового диапазона (250 Гц - 3500 Гц)
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1200;
            filter.Q.value = 0.8;

            const gain = this.ctx.createGain();
            // Очень тихий, деликатный фон (не мешает, создает уют)
            gain.gain.setValueAtTime(0.04, this.ctx.currentTime);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start();
            this.vinylNode = noise;
            this.vinylGain = gain;
            this.isVinylPlaying = true;
        } catch (e) {
            console.warn('[GameAudio] Ошибка винилового шума:', e);
        }
    },

    stopVinylAmbience() {
        if (this.vinylGain && this.ctx) {
            try {
                this.vinylGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.2);
                setTimeout(() => {
                    if (this.vinylNode) {
                        try { this.vinylNode.stop(); } catch(e){}
                        this.vinylNode.disconnect();
                        this.vinylNode = null;
                    }
                    this.isVinylPlaying = false;
                }, 220);
            } catch (e) {
                this.isVinylPlaying = false;
            }
        }
    },

    // Реалистичный тактильный щелчок советской клавиши / тумблера
    playClick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // 1. Механический микро-импульс
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.035);
    },

    // Натуральный перезвон советских латунных копеек (правильный ответ / монеты)
    playCoin() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Два гармонических тона латунной монеты: 1850 Гц и 3100 Гц
        const freqs = [1850, 3100];
        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);

            gain.gain.setValueAtTime(0.14, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.32);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.35);
        });
    },

    // Теплый благородный аккорд советской телепередачи («ГОСТ соблюдён!»)
    playCorrect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Мажорный перелив До-Ми-Соль-До (523, 659, 784, 1046) с мягкой колокольной атакой
        const notes = [
            { f: 523.25, t: 0.00, d: 0.35 },
            { f: 659.25, t: 0.06, d: 0.35 },
            { f: 783.99, t: 0.12, d: 0.40 },
            { f: 1046.50, t: 0.18, d: 0.55 }
        ];

        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, now + n.t);

            gain.gain.setValueAtTime(0.12, now + n.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + n.t);
            osc.stop(now + n.t + n.d);
        });
    },

    // Мягкий советский зуммер ОБХСС (не режет ухо)
    playWrong() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Мягкий нисходящий тон с приглушенным фильтром
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.linearRampToValueAtTime(115, now + 0.22);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(550, now);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.24);
    },

    // Торжественные советские фанфары (победа / награда)
    playFanfare() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [
            { f: 523.25, t: 0.00, d: 0.14 },
            { f: 523.25, t: 0.15, d: 0.14 },
            { f: 523.25, t: 0.30, d: 0.14 },
            { f: 659.25, t: 0.45, d: 0.28 },
            { f: 783.99, t: 0.75, d: 0.55 },
            { f: 1046.50, t: 1.05, d: 0.75 }
        ];

        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, now + n.t);

            gain.gain.setValueAtTime(0.18, now + n.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + n.t);
            osc.stop(now + n.t + n.d);
        });
    }
};
