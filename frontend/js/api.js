/**
 * API wrapper - auto-includes auth headers on every request
 */
const API = {
    _getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (TG.initData) {
            headers['X-Telegram-InitData'] = TG.initData;
        } else if (TG.sessionId) {
            headers['X-Session-Id'] = TG.sessionId;
            if (TG.playerName) {
                headers['X-Player-Name'] = TG.playerName;
            }
        }
        return headers;
    },

    async get(url) {
        const res = await fetch(url, { headers: this._getHeaders() });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Request failed: ${res.status}`);
        }
        return res.json();
    },

    async post(url, body = {}) {
        const res = await fetch(url, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Request failed: ${res.status}`);
        }
        return res.json();
    },

    async put(url, body = {}) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: this._getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Request failed: ${res.status}`);
        }
        return res.json();
    },

    async patch(url, body = {}) {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: this._getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Request failed: ${res.status}`);
        }
        return res.json();
    },

    async delete(url) {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: this._getHeaders(),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Request failed: ${res.status}`);
        }
        return res.json();
    },
};
