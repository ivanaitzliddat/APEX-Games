/**
 * Telegram WebApp wrapper with session fallback
 *
 * Supports two modes:
 * 1. Telegram mode: Uses initData for auth, Telegram user for identity
 * 2. Session mode: Uses session ID + player name for identity
 */
const TG = {
    webapp: null,
    _sessionId: null,
    _playerName: null,
    _initialized: false,
    _userRole: null,
    _dbUserId: null,

    init() {
        if (this._initialized) {
            console.log('TG.init() already called, skipping');
            return;
        }
        this._initialized = true;

        console.log('TG.init() called');

        // Get Telegram WebApp reference
        this.webapp = window.Telegram?.WebApp;
        console.log('  window.Telegram:', window.Telegram ? 'present' : 'absent');
        console.log('  webapp:', this.webapp ? 'present' : 'absent');
        console.log('  webapp.initData:', this.webapp?.initData ? 'present' : 'absent');

        // Always ensure we have a session ID (works even without sessionStorage)
        this._ensureSessionId();

        // Load player name from storage or URL
        this._loadPlayerName();

        // Initialize Telegram WebApp if available
        if (this.webapp && this.webapp.initData) {
            console.log('Telegram WebApp available');
            console.log('  user:', JSON.stringify(this.webapp.initDataUnsafe?.user));
            try {
                this.webapp.ready();
                this.webapp.expand();
            } catch (e) {
                console.warn('Failed to init Telegram WebApp:', e);
            }
        } else {
            console.log('Session mode - sessionId:', this._sessionId, 'playerName:', this._playerName || '(not set)');
        }
    },

    _ensureSessionId() {
        // Try to get from URL first (highest priority for consistency)
        const params = new URLSearchParams(window.location.search);
        const urlSessionId = params.get('session_id');
        if (urlSessionId) {
            this._sessionId = urlSessionId;
            this._saveToStorage('apex_session_id', urlSessionId);
            console.log('Session ID from URL:', this._sessionId);
            return;
        }

        // Try to get from storage
        const storedId = this._getFromStorage('apex_session_id');
        if (storedId) {
            this._sessionId = storedId;
            console.log('Session ID from storage:', this._sessionId);
            return;
        }

        // Generate new session ID
        this._sessionId = 'S' + Math.random().toString(36).substr(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
        this._saveToStorage('apex_session_id', this._sessionId);
        console.log('Generated new session ID:', this._sessionId);
    },

    _loadPlayerName() {
        // Try URL first
        const params = new URLSearchParams(window.location.search);
        const urlName = params.get('player_name');
        if (urlName) {
            this._playerName = urlName;
            this._saveToStorage('apex_player_name', urlName);
            console.log('Player name from URL:', this._playerName);
            return;
        }

        // Try storage
        const storedName = this._getFromStorage('apex_player_name');
        if (storedName) {
            this._playerName = storedName;
            console.log('Player name from storage:', this._playerName);
        }
    },

    _saveToStorage(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn('sessionStorage.setItem failed:', e);
        }
    },

    _getFromStorage(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            console.warn('sessionStorage.getItem failed:', e);
            return null;
        }
    },

    get sessionId() {
        if (!this._sessionId) {
            this._ensureSessionId();
        }
        return this._sessionId;
    },

    get initData() {
        return this.webapp?.initData || '';
    },

    get user() {
        return this.webapp?.initDataUnsafe?.user || null;
    },

    get isInTelegram() {
        return !!(this.webapp && this.webapp.initData);
    },

    get playerId() {
        // For Telegram users, use their Telegram ID
        const telegramUser = this.user;
        if (telegramUser?.id) {
            return telegramUser.id;
        }
        // For session users, use session ID
        return this.sessionId;
    },

    get playerName() {
        // Priority: Telegram name > saved name > null
        const telegramUser = this.user;
        if (telegramUser) {
            const name = ((telegramUser.first_name || '') + ' ' + (telegramUser.last_name || '')).trim();
            return name || 'Unknown';
        }
        return this._playerName;
    },

    setPlayerName(name) {
        this._playerName = name;
        this._saveToStorage('apex_player_name', name);
        console.log('Player name set to:', name);
    },

    needsNamePrompt() {
        // Need name if not in Telegram and no saved name
        return !this.isInTelegram && !this._playerName;
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
        try {
            this.webapp?.close();
        } catch (e) { /* ignore */ }
    },

    get userRole() {
        return this._userRole || 'guest';
    },

    get dbUserId() {
        return this._dbUserId;
    },

    isAdmin() {
        return this._userRole === 'admin' || this._userRole === 'owner';
    },

    isOwner() {
        return this._userRole === 'owner';
    },

    async fetchUserInfo() {
        /**
         * Call /api/me to get the user's DB record and role.
         * Must be called after init() and after API is available.
         */
        try {
            const data = await API.get('/api/me');
            if (data.user) {
                this._userRole = data.user.role;
                this._dbUserId = data.user.id;
                console.log('User info loaded: role=' + this._userRole + ', dbId=' + this._dbUserId);
            } else {
                this._userRole = 'guest';
                console.log('No authenticated user, role=guest');
            }
        } catch (e) {
            console.warn('Failed to fetch user info:', e);
            this._userRole = 'guest';
        }
    }
};
