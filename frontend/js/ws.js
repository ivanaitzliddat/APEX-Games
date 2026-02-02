/**
 * WebSocket client with auto-reconnect and event handling
 */
class GameWebSocket {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.handlers = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.connected = false;
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this._emit('_connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const type = data.type;
                if (type) {
                    this._emit(type, data);
                }
            } catch (e) {
                console.error('Failed to parse WS message:', e);
            }
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            this.connected = false;
            this._emit('_disconnected');

            if (event.code !== 4001 && event.code !== 4003 && event.code !== 4004) {
                this._reconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    _reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            this._emit('_reconnect_failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }

    off(event, handler) {
        if (this.handlers[event]) {
            this.handlers[event] = this.handlers[event].filter(h => h !== handler);
        }
    }

    _emit(event, data) {
        const handlers = this.handlers[event] || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (e) {
                console.error(`Error in handler for ${event}:`, e);
            }
        });
    }

    close() {
        this.maxReconnectAttempts = 0; // prevent reconnect
        if (this.ws) {
            this.ws.close();
        }
    }
}
