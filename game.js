/**
 * ОСНОВНАЯ ЛОГИКА ИГРЫ «ЭКЗАМЕН СССР: ЦЕНЫ, ГОСТЫ И БЫТ»
 */
window.QuizGame = {
    state: {
        coins: 15,          // Советские рубли
        score: 0,           // Очки опыта
        hints5050: 2,       // Подсказки 50/50
        hintsShield: 1,     // Право на ошибку (Блат)
        shieldActive: false,// Активен ли блат на текущий вопрос
        trophies: [],       // Купленные раритеты в Сервант
        completedChapters: {}, // { [chapterId]: { stars: 3, score: 95 } }
        claimedClubBonus: false,
        soundMuted: false
    },

    currentChapter: null,
    chapterQuestions: [],
    currentQIndex: 0,
    currentQuestion: null,
    chapterCoinsEarned: 0,
    chapterCorrectCount: 0,
    streakCount: 0,

    async init() {
        // 1. Инициализация SDK
        await window.GameSDK.init();

        // 2. Загрузка сохранения
        const saved = await window.GameSDK.loadData('ussr_quiz_save_v1', null);
        if (saved && typeof saved === 'object') {
            this.state = Object.assign(this.state, saved);
        }

        // 3. Инициализация звука
        if (this.state.soundMuted) {
            window.GameAudio.muted = true;
        }
        this.updateSoundBtn();

        const unlockAudio = () => {
            window.GameAudio.init();
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);

        // 4. Отрисовка главного меню
        this.renderMainMenu();
        this.bindEvents();

        console.log('[QuizGame] Игра запущена успешно!');
    },

    showToast(msg) {
        let t = document.getElementById('ussr-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'ussr-toast';
            t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2b1810;color:#ffd700;border:2px solid #d4af37;padding:12px 20px;border-radius:10px;font-weight:700;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.6);text-align:center;max-width:90%;transition:opacity 0.3s;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = '1';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 3200);
    },

    save() {
        window.GameSDK.saveData('ussr_quiz_save_v1', this.state);
    },

    // Расчет текущего ранга
    getCurrentRank() {
        const ranks = window.QUIZ_RANKS;
        let current = ranks[0];
        for (let i = 0; i < ranks.length; i++) {
            if (this.state.score >= ranks[i].minScore) {
                current = ranks[i];
            }
        }
        return current;
    },

    // Пассивный доход с предметов серванта
    getServantPassiveBonus() {
        let bonus = 0;
        const owned = this.state.trophies || [];
        window.SERVANT_TROPHIES.forEach(t => {
            if (owned.includes(t.id)) {
                bonus += t.bonusPerAnswer;
            }
        });
        return bonus;
    },

    updateTopBar() {
        const rank = this.getCurrentRank();
        const elCoins = document.getElementById('stat-coins');
        const elScore = document.getElementById('stat-score');
        const elRank = document.getElementById('stat-rank');

        if (elCoins) elCoins.textContent = `${this.state.coins} ₽`;
        if (elScore) elScore.textContent = `${this.state.score}`;
        if (elRank) elRank.textContent = `${rank.icon} ${rank.title}`;
    },

    updateSoundBtn() {
        const btn = document.getElementById('btn-sound-toggle');
        if (btn) {
            btn.textContent = window.GameAudio.muted ? '🔇' : '🔊';
        }
    },

    bindEvents() {
        // Звук
        const soundBtn = document.getElementById('btn-sound-toggle');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const muted = window.GameAudio.toggleMute();
                this.state.soundMuted = muted;
                this.updateSoundBtn();
                this.save();
            });
        }

        // Сервант
        const servantBtn = document.getElementById('btn-open-servant');
        if (servantBtn) {
            servantBtn.addEventListener('click', () => {
                window.GameAudio.playClick();
                this.openServant();
            });
        }

        const closeServantBtn = document.getElementById('btn-close-servant');
        if (closeServantBtn) {
            closeServantBtn.addEventListener('click', () => {
                window.GameAudio.playClick();
                this.closeServant();
            });
        }

        // Кнопка возврата в меню
        const backBtn = document.getElementById('btn-back-main');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.GameAudio.playClick();
                this.renderMainMenu();
            });
        }

        // Кнопка следующего вопроса
        const nextQBtn = document.getElementById('btn-next-question');
        if (nextQBtn) {
            nextQBtn.addEventListener('click', () => {
                window.GameAudio.playClick();
                this.nextQuestion();
            });
        }

        // Подсказка 50/50
        const btn5050 = document.getElementById('btn-hint-5050');
        if (btn5050) {
            btn5050.addEventListener('click', () => this.useHint5050());
        }

        // Подсказка Блат (Право на ошибку)
        const btnShield = document.getElementById('btn-hint-shield');
        if (btnShield) {
            btnShield.addEventListener('click', () => this.useHintShield());
        }

        // Забрать бонус вступления в клуб
        const claimClubBtn = document.getElementById('btn-claim-club-bonus');
        if (claimClubBtn) {
            claimClubBtn.addEventListener('click', () => this.claimClubBonus());
        }

        // Поделиться результатом
        const shareBtn = document.getElementById('btn-share-result');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const rank = this.getCurrentRank();
                window.GameSDK.shareResult(rank.title, this.state.score);
                alert('Результат скопирован! Делитесь с друзьями в соцсетях ☭');
            });
        }

        // Удвоение награды за просмотр рекламы
        const doubleRewardBtn = document.getElementById('btn-double-reward');
        if (doubleRewardBtn) {
            doubleRewardBtn.addEventListener('click', () => this.doubleChapterReward());
        }
    },

    renderMainMenu() {
        document.getElementById('screen-quiz').classList.add('hidden');
        document.getElementById('screen-chapter-result').classList.add('hidden');
        document.getElementById('screen-main').classList.remove('hidden');

        this.updateTopBar();

        // Отрисовка списка глав
        const listEl = document.getElementById('chapters-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        window.QUIZ_CHAPTERS.forEach((ch, idx) => {
            const card = document.createElement('div');
            card.className = 'chapter-card';

            const comp = this.state.completedChapters[ch.id];
            const isCompleted = !!comp;
            const starsText = isCompleted ? '⭐'.repeat(comp.stars || 1) : '';

            // Главы открыты последовательно или первая открыта
            const isLocked = idx > 0 && !this.state.completedChapters[window.QUIZ_CHAPTERS[idx - 1].id];

            card.innerHTML = `
                <div class="chapter-img-wrap">
                    <img src="img/${ch.image}" alt="${ch.title}" class="chapter-img" loading="lazy">
                    <div class="chapter-badge">${isCompleted ? 'СДАНО ' + starsText : 'ЭКЗАМЕН'}</div>
                </div>
                <div class="chapter-body">
                    <h3 class="chapter-title">${ch.title}</h3>
                    <p class="chapter-desc">${ch.desc}</p>
                    <div class="chapter-footer">
                        <span class="chapter-meta">📋 10 вопросов ГОСТ</span>
                        <button class="btn btn-primary btn-start-chapter" ${isLocked ? 'disabled' : ''}>
                            ${isLocked ? '🔒 Закрыто' : (isCompleted ? 'Пересдать' : 'Начать')}
                        </button>
                    </div>
                </div>
            `;

            if (!isLocked) {
                card.querySelector('.btn-start-chapter').addEventListener('click', () => {
                    window.GameAudio.playClick();
                    this.startChapter(ch.id);
                });
            }

            listEl.appendChild(card);
        });

        // Проверка плашки бонуса клуба
        const clubBanner = document.getElementById('club-bonus-banner');
        if (clubBanner) {
            if (this.state.claimedClubBonus) {
                clubBanner.classList.add('bonus-claimed');
                const claimBtn = document.getElementById('btn-claim-club-bonus');
                if (claimBtn) {
                    claimBtn.textContent = '✅ Бонус +50 ₽ получен';
                    claimBtn.disabled = true;
                }
            }
        }
    },

    startChapter(chapterId) {
        this.currentChapter = window.QUIZ_CHAPTERS.find(c => c.id === chapterId);
        if (!this.currentChapter) return;

        // Фильтруем вопросы главы
        this.chapterQuestions = window.QUIZ_QUESTIONS.filter(q => q.chapterId === chapterId);
        this.currentQIndex = 0;
        this.chapterCoinsEarned = 0;
        this.chapterCorrectCount = 0;
        this.streakCount = 0;

        document.getElementById('screen-main').classList.add('hidden');
        document.getElementById('screen-chapter-result').classList.add('hidden');
        document.getElementById('screen-quiz').classList.remove('hidden');

        this.renderQuestion();
    },

    renderQuestion() {
        this.currentQuestion = this.chapterQuestions[this.currentQIndex];
        if (!this.currentQuestion) {
            this.finishChapter();
            return;
        }

        this.state.shieldActive = false;
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e){}

        // Обновляем шапку квиза
        document.getElementById('quiz-chapter-name').textContent = this.currentChapter.title;
        document.getElementById('quiz-progress-text').textContent = `Вопрос ${this.currentQIndex + 1} из ${this.chapterQuestions.length}`;
        
        const progressPct = ((this.currentQIndex) / this.chapterQuestions.length) * 100;
        document.getElementById('quiz-progress-fill').style.width = `${progressPct}%`;

        // Изображение вопроса
        const qImg = document.getElementById('quiz-image');
        if (qImg) {
            const imgName = this.currentQuestion.image || this.currentChapter.image || 'gastronom.jpg';
            qImg.src = `img/${imgName}`;
        }

        // Текст вопроса
        document.getElementById('quiz-question-text').textContent = this.currentQuestion.question;

        // Варианты ответов
        const optionsContainer = document.getElementById('quiz-options-container');
        optionsContainer.innerHTML = '';

        this.currentQuestion.options.forEach((optText, optIdx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-opt-btn';
            btn.dataset.idx = optIdx;
            btn.innerHTML = `<span class="opt-letter">${['А', 'Б', 'В', 'Г'][optIdx]}</span> <span class="opt-text">${optText}</span>`;
            
            btn.addEventListener('click', () => this.handleAnswer(optIdx, btn));
            optionsContainer.appendChild(btn);
        });

        // Скрываем карточку факта и кнопку далее
        const factCard = document.getElementById('quiz-fact-card');
        factCard.classList.add('hidden');
        document.getElementById('btn-next-question').classList.add('hidden');

        // Обновляем счетчики подсказок
        this.updateHintsUI();
        this.updateTopBar();
    },

    updateHintsUI() {
        const el5050Count = document.getElementById('hint-5050-count');
        const elShieldCount = document.getElementById('hint-shield-count');

        if (el5050Count) el5050Count.textContent = `(${this.state.hints5050})`;
        if (elShieldCount) elShieldCount.textContent = `(${this.state.hintsShield})`;

        const btnShield = document.getElementById('btn-hint-shield');
        if (btnShield) {
            if (this.state.shieldActive) {
                btnShield.classList.add('active-shield');
            } else {
                btnShield.classList.remove('active-shield');
            }
        }
    },

    useHint5050() {
        if (this.state.hints5050 > 0) {
            this.state.hints5050--;
            this.apply5050();
            this.updateHintsUI();
            this.save();
        } else {
            // Предлагаем видео за рекламу
            window.GameSDK.showRewarded(() => {
                this.state.hints5050 += 2;
                this.apply5050();
                this.updateHintsUI();
                this.save();
                window.GameAudio.playCoin();
            });
        }
    },

    apply5050() {
        window.GameAudio.playClick();
        const correctIdx = this.currentQuestion.correct;
        const buttons = Array.from(document.querySelectorAll('.quiz-opt-btn'));
        const wrongButtons = buttons.filter(b => parseInt(b.dataset.idx, 10) !== correctIdx);

        // Убираем 2 неверных
        wrongButtons.slice(0, 2).forEach(btn => {
            btn.classList.add('disabled-opt');
            btn.disabled = true;
        });
    },

    useHintShield() {
        if (this.state.shieldActive) return;

        if (this.state.hintsShield > 0) {
            this.state.hintsShield--;
            this.state.shieldActive = true;
            this.updateHintsUI();
            this.save();
            window.GameAudio.playClick();
        } else {
            window.GameSDK.showRewarded(() => {
                this.state.hintsShield += 1;
                this.state.shieldActive = true;
                this.updateHintsUI();
                this.save();
                window.GameAudio.playCoin();
            });
        }
    },

    handleAnswer(chosenIdx, clickedBtn) {
        const correctIdx = this.currentQuestion.correct;
        const isCorrect = chosenIdx === correctIdx;
        const allButtons = document.querySelectorAll('.quiz-opt-btn');

        // Блокируем повторные клики
        allButtons.forEach(b => b.disabled = true);

        if (isCorrect) {
            clickedBtn.classList.add('opt-correct');
            window.GameAudio.playCorrect();
            window.GameAudio.playCoin();

            this.streakCount++;
            this.chapterCorrectCount++;

            // Награда за верный ответ
            const baseCoins = 3;
            const passiveBonus = this.getServantPassiveBonus();
            const streakBonus = this.streakCount >= 3 ? 2 : 0;
            const totalCoins = baseCoins + passiveBonus + streakBonus;
            const earnedScore = 15 + this.streakCount * 2;

            this.state.coins += totalCoins;
            this.state.score += earnedScore;
            this.chapterCoinsEarned += totalCoins;

            this.showAnswerFact(true, `Правильно! ГОСТ соблюдён! (+${totalCoins} ₽, +${earnedScore} очков)`);
        } else {
            // Если был активен щит (блат) — спасаем от поражения
            if (this.state.shieldActive) {
                this.state.shieldActive = false;
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e){}
                clickedBtn.classList.add('opt-shielded');
                window.GameAudio.playCoin();
                alert('🛡️ Сработал блат от Завскладом! Ошибка аннулирована, попробуйте снова!');
                allButtons.forEach(b => {
                    if (b !== clickedBtn) b.disabled = false;
                });
                clickedBtn.disabled = true;
                this.updateHintsUI();
                return;
            }

            clickedBtn.classList.add('opt-wrong');
            window.GameAudio.playWrong();
            this.streakCount = 0;

            // Подсвечиваем верный
            const correctBtn = document.querySelector(`.quiz-opt-btn[data-idx="${correctIdx}"]`);
            if (correctBtn) correctBtn.classList.add('opt-correct');

            this.showAnswerFact(false, `Ошибка! ОТК не пропускает этот ответ.`);
        }

        this.updateTopBar();
        this.save();
    },

    showAnswerFact(isSuccess, statusMsg) {
        const factCard = document.getElementById('quiz-fact-card');
        const factStatus = document.getElementById('fact-status-badge');
        const factText = document.getElementById('fact-historical-text');

        factStatus.className = isSuccess ? 'status-badge-success' : 'status-badge-fail';
        factStatus.textContent = statusMsg;
        factText.textContent = this.currentQuestion.fact || "Исторический факт зафиксирован в архивах Госплана.";

        factCard.classList.remove('hidden');
        const nextBtn = document.getElementById('btn-next-question');
        nextBtn.classList.remove('hidden');

        // Автоматический плавный доскролл к карточке факта и кнопке далее
        setTimeout(() => {
            try {
                nextBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) {}
        }, 70);
    },

    nextQuestion() {
        this.currentQIndex++;
        this.renderQuestion();
    },

    async finishChapter() {
        document.getElementById('screen-quiz').classList.add('hidden');
        document.getElementById('screen-chapter-result').classList.remove('hidden');

        // Полноэкранная реклама при завершении главы (с учетом кулдауна 90 сек)
        await window.GameSDK.showInterstitial();

        const correct = this.chapterCorrectCount;
        const total = this.chapterQuestions.length;
        let stars = 1;
        if (correct >= 9) stars = 3;
        else if (correct >= 7) stars = 2;

        // Сохраняем прогресс главы
        const prevStars = (this.state.completedChapters[this.currentChapter.id] && this.state.completedChapters[this.currentChapter.id].stars) || 0;
        this.state.completedChapters[this.currentChapter.id] = {
            stars: Math.max(stars, prevStars),
            score: correct * 15
        };
        this.save();

        window.GameAudio.playFanfare();

        document.getElementById('res-chapter-title').textContent = this.currentChapter.title;
        document.getElementById('res-stars').textContent = '⭐'.repeat(stars);
        document.getElementById('res-correct-stat').textContent = `${correct} из ${total}`;
        document.getElementById('res-coins-earned').textContent = `+${this.chapterCoinsEarned} ₽`;

        const rank = this.getCurrentRank();
        document.getElementById('res-rank-current').textContent = `${rank.icon} ${rank.title}`;

        this.updateTopBar();
    },

    doubleChapterReward() {
        window.GameSDK.showRewarded(() => {
            const bonus = this.chapterCoinsEarned;
            this.state.coins += bonus;
            this.save();
            this.updateTopBar();
            window.GameAudio.playFanfare();

            const btn = document.getElementById('btn-double-reward');
            btn.disabled = true;
            btn.textContent = `✅ Премия удвоена (+${bonus} ₽)`;
            document.getElementById('res-coins-earned').textContent = `+${this.chapterCoinsEarned + bonus} ₽`;
        });
    },

    openServant() {
        const modal = document.getElementById('modal-servant');
        if (!modal) return;
        modal.classList.remove('hidden');

        const listEl = document.getElementById('servant-items-list');
        listEl.innerHTML = '';

        const owned = this.state.trophies || [];

        window.SERVANT_TROPHIES.forEach(t => {
            const isOwned = owned.includes(t.id);
            const card = document.createElement('div');
            card.className = `servant-card ${isOwned ? 'owned' : ''}`;

            card.innerHTML = `
                <div class="servant-icon">${t.icon}</div>
                <div class="servant-info">
                    <div class="servant-name">${t.name}</div>
                    <div class="servant-desc">${t.desc}</div>
                </div>
                <div class="servant-action">
                    ${isOwned 
                        ? '<span class="badge-owned">В Серванте</span>' 
                        : `<button class="btn btn-buy-trophy" ${this.state.coins < t.cost ? 'disabled' : ''}>Купить за ${t.cost} ₽</button>`
                    }
                </div>
            `;

            if (!isOwned) {
                const buyBtn = card.querySelector('.btn-buy-trophy');
                buyBtn.addEventListener('click', () => this.buyTrophy(t));
            }

            listEl.appendChild(card);
        });

        const passiveTotal = this.getServantPassiveBonus();
        document.getElementById('servant-passive-total').textContent = `+${passiveTotal} ₽ к каждому верному ответу`;
    },

    closeServant() {
        const modal = document.getElementById('modal-servant');
        if (modal) modal.classList.add('hidden');
        this.updateTopBar();
    },

    buyTrophy(trophy) {
        if (this.state.coins < trophy.cost) return;

        this.state.coins -= trophy.cost;
        if (!this.state.trophies) this.state.trophies = [];
        this.state.trophies.push(trophy.id);

        this.save();
        window.GameAudio.playFanfare();
        this.openServant(); // Перерисовать
    },

    claimClubBonus() {
        if (this.state.claimedClubBonus) return;

        window.GameSDK.joinClubVK(() => {
            this.state.coins += 50;
            this.state.hints5050 += 2;
            this.state.claimedClubBonus = true;
            this.save();
            this.updateTopBar();
            window.GameAudio.playFanfare();

            alert('🎉 Поздравляем! Вам начислено +50 советских рублей и +2 подсказки ОБХСС за поддержку клуба «Ностальгия по ГОСТу»!');
            this.renderMainMenu();
        });
    }
};

// Запуск при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
    window.QuizGame.init();
});
