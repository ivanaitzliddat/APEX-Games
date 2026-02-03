/**
 * Telegram WebApp wrapper
 */
const TG = {
    webapp: window.Telegram?.WebApp,
    _devUserId: null,
    _devUserName: null,

    init() {
        if (!this.webapp || !this.webapp.initData) {
            console.warn('Telegram WebApp not available - running in dev mode');
            // Parse dev user from URL params
            const params = new URLSearchParams(window.location.search);
            const devId = params.get('dev_user_id');
            if (devId) {
                this._devUserId = parseInt(devId, 10);
                this._devUserName = params.get('dev_user_name') || 'Dev User';
                console.log('Dev mode: userId set to', this._devUserId, 'userName:', this._devUserName);
            } else {
                console.warn('No dev_user_id in URL params');
            }
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
        // Return dev user ID if in dev mode
        if (this._devUserId) return this._devUserId;
        return this.user?.id || null;
    },

    get userName() {
        // Return dev user name if in dev mode
        if (this._devUserName) return this._devUserName;
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
