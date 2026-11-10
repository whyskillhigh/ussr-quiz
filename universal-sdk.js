/**
 * UNIVERSAL GAME SDK ADAPTER
 * Поддержка: VK Mini Apps (ВКонтакте) / OK (Одноклассники) / Yandex Games / Standalone Web
 * Официальная группа автора: https://vk.com/club243027245 (ID: 243027245)
 */
window.GameSDK = {
    platform: 'web', // 'vk' | 'yandex' | 'web'
    ysdk: null,
    vkUser: null,
    lastInterstitialTime: 0,
    INTERSTITIAL_COOLDOWN_MS: 90000, // 90 секунд между полноэкранной рекламой
    VK_GROUP_ID: 243027245, // ID группы ВК «Ностальгия по ГОСТу»
    LINKS: {
        vk: 'https://vk.com/club243027245',
        ok: 'https://ok.ru/group/70000059630813',
        dzen: 'https://dzen.ru/nostalgiya_ussr',
        tg: 'https://t.me/nostalgiya_po_gostu'
    },

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const isVKEnv = urlParams.has('vk_app_id') || urlParams.has('vk_user_id') || urlParams.has('odr_enabled') || urlParams.has('api_url');

        // 1. Проверка VK Mini Apps / OK
        if (isVKEnv && typeof window.vkBridge !== 'undefined') {
            try {
                await Promise.race([window.vkBridge.send('VKWebAppInit'), new Promise((_, r) => setTimeout(() => r(new Error('VK timeout')), 1500))]);
                this.platform = 'vk';
                console.log('[GameSDK] Инициализация VK/OK успешна');
                // Запрашиваем комфортный размер окна в десктопном iframe ВК
                window.vkBridge.send('VKWebAppResizeWindow', { width: 800, height: 950 }).catch(() => {});
                // Фоновая предзагрузка рекламы ВК
                window.vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' }).catch(() => {});
                window.vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' }).catch(() => {});
                return this.platform;
            } catch (e) {
                console.warn('[GameSDK] Ошибка VKWebAppInit, откат:', e);
            }
        }

        // 2. Проверка Яндекс Игр
        if (typeof window.YaGames !== 'undefined') {
            try {
                const ysdk = await Promise.race([
                    window.YaGames.init(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('YaGames timeout')), 2500))
                ]);
                this.ysdk = ysdk;
                this.platform = 'yandex';
                if (ysdk.features && ysdk.features.LoadingAPI) {
                    ysdk.features.LoadingAPI.ready();
                }
                console.log('[GameSDK] Инициализация Яндекс Игр успешна');
                return this.platform;
            } catch (e) {
                console.warn('[GameSDK] Ошибка YaGames.init, откат:', e);
            }
        }

        // 3. Fallback (Standalone Web / Local test)
        if (typeof window.vkBridge !== 'undefined') {
            window.vkBridge.send('VKWebAppInit').catch(() => {});
        }
        this.platform = 'web';
        console.log('[GameSDK] Режим Standalone Web / Тест');
        return this.platform;
    },

    // Полноэкранная реклама между главами
    async showInterstitial() {
        const now = Date.now();
        if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_MS) {
            console.log('[GameSDK] Interstitial cooldown active, пропускаем');
            return false;
        }

        if (this.platform === 'vk' && window.vkBridge) {
            try {
                const data = await window.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' });
                if (data && data.result) {
                    this.lastInterstitialTime = Date.now();
                    return true;
                }
            } catch (e) {
                console.warn('[GameSDK] VK Interstitial error:', e);
            }
            return false;
        }

        if (this.platform === 'yandex' && this.ysdk) {
            return new Promise((resolve) => {
                this.ysdk.adv.showFullscreenAdv({
                    callbacks: {
                        onClose: (wasShown) => {
                            if (wasShown) this.lastInterstitialTime = Date.now();
                            resolve(wasShown);
                        },
                        onError: () => resolve(false)
                    }
                });
            });
        }

        this.lastInterstitialTime = Date.now();
        return true;
    },

    // Реклама за вознаграждение (Подсказки ОБХСС, удвоение премии x2)
    async showRewarded(onRewardCallback) {
        if (this.platform === 'vk' && window.vkBridge) {
            try {
                const data = await window.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' });
                if (data && data.result) {
                    if (onRewardCallback) onRewardCallback();
                    window.vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' }).catch(() => {});
                    return true;
                }
            } catch (e) {
                console.warn('[GameSDK] VK Rewarded error:', e);
            }
            return false;
        }

        if (this.platform === 'yandex' && this.ysdk) {
            return new Promise((resolve) => {
                let rewarded = false;
                this.ysdk.adv.showRewardedVideo({
                    callbacks: {
                        onRewarded: () => {
                            rewarded = true;
                            if (onRewardCallback) onRewardCallback();
                        },
                        onClose: () => resolve(rewarded),
                        onError: () => resolve(false)
                    }
                });
            });
        }

        // В локальном/веб режиме для теста даём награду сразу
        if (onRewardCallback) onRewardCallback();
        return true;
    },

    // Сохранение данных (LocalStorage + Cloud ВК/Яндекс)
    async saveData(key, dataObj) {
        const raw = JSON.stringify(dataObj);
        try {
            localStorage.setItem(key, raw);
        } catch (e) {}

        if (this.platform === 'vk' && window.vkBridge) {
            try {
                await window.vkBridge.send('VKWebAppStorageSet', { key: key, value: raw });
            } catch (e) {}
        } else if (this.platform === 'yandex' && this.ysdk) {
            try {
                const player = await this.ysdk.getPlayer({ scopes: false });
                await player.setData({ [key]: dataObj }, true);
            } catch (e) {}
        }
    },

    // Загрузка данных
    async loadData(key, defaultObj = {}) {
        let localData = null;
        try {
            const raw = localStorage.getItem(key);
            if (raw) localData = JSON.parse(raw);
        } catch (e) {}

        if (this.platform === 'vk' && window.vkBridge) {
            try {
                const res = await window.vkBridge.send('VKWebAppStorageGet', { keys: [key] });
                if (res && res.keys && res.keys[0] && res.keys[0].value) {
                    return JSON.parse(res.keys[0].value);
                }
            } catch (e) {}
        } else if (this.platform === 'yandex' && this.ysdk) {
            try {
                const player = await this.ysdk.getPlayer({ scopes: false });
                const cloud = await player.getData([key]);
                if (cloud && cloud[key]) return cloud[key];
            } catch (e) {}
        }

        return localData || defaultObj;
    },

    // Вступить в официальную группу ВК «Ностальгия по ГОСТу» за бонус
    async joinClubVK(onSuccessCallback) {
        if (this.platform === 'vk' && window.vkBridge) {
            try {
                const res = await window.vkBridge.send('VKWebAppJoinGroup', { group_id: this.VK_GROUP_ID });
                if (res && res.result) {
                    if (onSuccessCallback) onSuccessCallback();
                    return true;
                }
            } catch (e) {
                console.warn('[GameSDK] VKWebAppJoinGroup fallback to link:', e);
            }
        }
        window.open(this.LINKS.vk, '_blank');
        if (onSuccessCallback) onSuccessCallback();
        return true;
    },

    // Поделиться результатом на стене ВКонтакте (виральный трафик)
    async shareResult(rankTitle, score) {
        const message = `Я сдал Экзамен СССР на звание «${rankTitle}» (${score} очков)! А ты помнишь цены по ГОСТу? Проверь себя! ☭`;
        if (this.platform === 'vk' && window.vkBridge) {
            try {
                await window.vkBridge.send('VKWebAppShowWallPostBox', {
                    message: `${message}\n\nАрхив СССР «Ностальгия по ГОСТу»: ${this.LINKS.dzen}`
                });
                return true;
            } catch (e) {}
        }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(`${message} ${this.LINKS.dzen}`).catch(() => {});
        }
        return false;
    }
};
