/**
 * Telegram WebApp wrapper
 */
const TG = {
    webapp: window.Telegram?.WebApp,

    init() {
        if (!this.webapp) {
            console.warn('Telegram WebApp not available - running in dev mode');
            return;
        }
        this.webapp.ready();
        this.webapp.expand();
    },

    get initData() {
        return this.webapp?.initData || '';
    },

    get user() {
        return this.webapp?.initDataUnsafe?.user || null;
    },

    get userId() {
        return this.user?.id || null;
    },

    get userName() {
        const user = this.user;
        if (!user) return 'Dev User';
        return ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || 'Unknown';
    },

    get colorScheme() {
        return this.webapp?.colorScheme || 'dark';
    },

    hapticImpact(style = 'medium') {
        try {
            this.webapp?.HapticFeedback?.impactOccurred(style);
        } catch (e) { /* ignore */ }
    },

    hapticNotification(type = 'success') {
        try {
            this.webapp?.HapticFeedback?.notificationOccurred(type);
        } catch (e) { /* ignore */ }
    },

    close() {
        this.webapp?.close();
    }
};
