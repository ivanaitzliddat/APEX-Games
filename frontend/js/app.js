/**
 * APEX Games - Main App Entry Point
 *
 * Initializes Telegram WebApp, connects WebSocket, and routes between views.
 */
(function () {
    'use strict';

    let role = null;     // 'host', 'player', 'spectator'
    let gameState = null;

    // --- View Management ---
    function showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const el = document.getElementById(viewId);
        if (el) el.classList.add('active');
    }

    // --- Initialization ---
    TG.init();

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room') || '';

    // No room code - show landing page
    if (!roomCode) {
        showView('landing-view');
        LandingView.render();
        return;
    }

    // Build WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    let wsUrl = `${wsProtocol}//${wsHost}/ws/${roomCode}`;

    // Add auth
    if (TG.initData) {
        wsUrl += `?initData=${encodeURIComponent(TG.initData)}`;
    } else {
        // Dev mode: use query params for testing
        const devId = params.get('dev_user_id') || '12345';
        const devName = params.get('dev_user_name') || 'Dev User';
        wsUrl += `?dev_user_id=${devId}&dev_user_name=${encodeURIComponent(devName)}`;
    }

    const ws = new GameWebSocket(wsUrl);
    window.gameWs = ws;

    // --- Event Handlers ---

    ws.on('role', (data) => {
        role = data.role;
        console.log('Assigned role:', role);
    });

    ws.on('lobby_update', (data) => {
        console.log('lobby_update received:', data, 'role:', role);
        showView('lobby-view');
        LobbyView.render(data, role === 'host');
    });

    ws.on('game_start', (data) => {
        // Transition from lobby to game
        console.log('Game started:', data.game_id);
    });

    ws.on('game_state', (data) => {
        gameState = data;

        if (data.is_finished) {
            showView('results-view');
            ResultsView.render(data);
            return;
        }

        // Host who is playing (is_alive) sees player view, otherwise observer view
        if (role === 'host' && !data.is_alive) {
            showView('observer-view');
            ObserverView.render(data);
        } else {
            showView('game-view');
            GameView.render(data);
        }
    });

    ws.on('phase_start', (data) => {
        console.log('phase_start received:', data);
        console.log('TG.userId:', TG.userId, 'type:', typeof TG.userId);
        console.log('alive_players:', data.alive_players);
        gameState = { ...gameState, ...data };

        const isAlive = data.alive_players && data.alive_players.includes(TG.userId);
        console.log('isAlive:', isAlive, 'role:', role);

        // Host who is not playing sees observer view
        if (role === 'host' && !isAlive) {
            console.log('Calling ObserverView.nextPhase');
            ObserverView.nextPhase(data);
        } else {
            console.log('Calling GameView.nextPhase');
            const stateForPlayer = {
                ...data,
                is_alive: isAlive,
                has_chosen: false,
            };
            GameView.nextPhase(stateForPlayer);
        }
    });

    ws.on('player_locked', (data) => {
        // Only observer-only host needs this
        if (role === 'host' && gameState && !gameState.is_alive) {
            ObserverView.onPlayerLocked(data);
        }
    });

    ws.on('card_revealed', (data) => {
        console.log('card_revealed received:', data);
        // Host who is not playing sees observer view
        if (role === 'host' && gameState && !gameState.is_alive) {
            ObserverView.showCardReveal(data);
        } else {
            GameView.showCardReveal(data);
        }
    });

    ws.on('elimination', (data) => {
        console.log('elimination received:', data);
        if (role === 'host' && gameState && !gameState.is_alive) {
            ObserverView.onElimination(data);
        }
    });

    ws.on('game_over', (data) => {
        console.log('game_over received:', data);
        setTimeout(() => {
            showView('results-view');
            ResultsView.render(data);
        }, 2500); // Delay to let card reveal sink in
    });

    ws.on('error', (data) => {
        console.error('Server error:', data.message);
    });

    ws.on('_disconnected', () => {
        console.log('Disconnected, will try to reconnect...');
    });

    ws.on('_reconnect_failed', () => {
        document.getElementById('loading').querySelector('p').textContent =
            'Connection lost. Please close and reopen the game.';
        showView('loading');
    });

    // --- Connect ---
    ws.connect();

})();
