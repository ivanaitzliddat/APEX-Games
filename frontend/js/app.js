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
    console.log('TG initialized:');
    console.log('  isInTelegram:', TG.isInTelegram);
    console.log('  playerId:', TG.playerId);
    console.log('  playerName:', TG.playerName);
    console.log('  needsNamePrompt:', TG.needsNamePrompt());

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room') || '';
    console.log('Room code from URL:', roomCode || '(none)');

    // No room code - show landing page
    if (!roomCode) {
        showView('landing-view');
        LandingView.render();
        return;
    }

    // Have room code but need name - redirect to landing with room code
    if (TG.needsNamePrompt()) {
        console.log('Need name prompt, redirecting to landing');
        showView('landing-view');
        LandingView.render(roomCode); // Pass room code to show join flow
        return;
    }

    // Build WebSocket URL with auth
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    let wsUrl = `${wsProtocol}//${wsHost}/ws/${roomCode}`;

    // Add auth params
    if (TG.initData) {
        // Telegram mode: use initData for cryptographic auth
        wsUrl += `?initData=${encodeURIComponent(TG.initData)}`;
        console.log('Using Telegram auth for WebSocket');
    } else {
        // Session mode: use session_id + player_name
        const sessionId = TG.sessionId;
        const playerName = TG.playerName || 'Player';
        wsUrl += `?session_id=${encodeURIComponent(sessionId)}&player_name=${encodeURIComponent(playerName)}`;
        console.log('Using session auth for WebSocket. sessionId:', sessionId, 'name:', playerName);
    }

    console.log('Connecting to WebSocket for room:', roomCode);
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
            ResultsView.render(data, ws, role === 'host');
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
        const myId = TG.playerId;
        console.log('My playerId:', myId, 'type:', typeof myId);
        console.log('alive_players:', data.alive_players);
        gameState = { ...gameState, ...data };

        // Check if we're alive - handle both number and string IDs
        const isAlive = data.alive_players && data.alive_players.some(id => String(id) === String(myId));
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

    ws.on('player_left', (data) => {
        console.log('player_left received:', data);
        // Show a brief notification
        const reason = data.reason === 'disconnected' ? 'disconnected' : 'left the game';
        console.log(`${data.player_name} ${reason}`);
        TG.hapticNotification('warning');

        // If in observer view during game, update the player grid
        if (role === 'host' && gameState && !gameState.is_alive) {
            // The elimination event will handle updating the observer view
            // This is just for notification purposes
        }
    });

    ws.on('game_over', (data) => {
        console.log('game_over received:', data);
        setTimeout(() => {
            showView('results-view');
            ResultsView.render(data, ws, role === 'host');
        }, 2500); // Delay to let card reveal sink in
    });

    ws.on('error', (data) => {
        console.error('Server error:', data.message);
        // Show error on the loading view
        const loadingP = document.querySelector('#loading p');
        if (loadingP) {
            loadingP.textContent = data.message || 'An error occurred';
            loadingP.style.color = 'var(--danger, #e94560)';
        }
        showView('loading');
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
