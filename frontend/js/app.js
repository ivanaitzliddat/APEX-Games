/**
 * APEX Games - Main App Entry Point
 *
 * Two modes:
 * 1. Platform mode (no room code): hash-based routing with bottom nav
 * 2. Game mode (?room=XXX): WebSocket-based game session
 */
(function () {
    'use strict';

    // --- View Management ---
    function showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const el = document.getElementById(viewId);
        if (el) el.classList.add('active');
    }

    // Make showView globally accessible for views
    window.showView = showView;

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

    // --- Mode Decision ---
    if (roomCode) {
        enterGameMode(roomCode);
    } else {
        enterPlatformMode();
    }

    // ============================
    // PLATFORM MODE (hash routing)
    // ============================
    async function enterPlatformMode() {
        console.log('Entering platform mode');

        // Show bottom nav
        const nav = document.getElementById('bottom-nav');
        if (nav) nav.style.display = 'flex';

        // Fetch user info for role-based UI
        await TG.fetchUserInfo();
        console.log('User role:', TG.userRole);

        // Hide home button when keyboard is open
        const hideNavOnKeyboard = () => {
            if (!nav) return;
            // Use visualViewport API (reliable on iOS/Android)
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', () => {
                    const keyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
                    nav.style.display = keyboardOpen ? 'none' : 'flex';
                });
            } else {
                // Fallback: listen for focus/blur on inputs
                document.addEventListener('focusin', (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                        nav.style.display = 'none';
                    }
                });
                document.addEventListener('focusout', () => {
                    nav.style.display = 'flex';
                });
            }
        };
        hideNavOnKeyboard();

        // Listen for hash changes
        window.addEventListener('hashchange', route);

        // Initial route
        route();
    }

    function route() {
        const hash = window.location.hash.slice(1) || 'home';
        console.log('Routing to:', hash);

        // Highlight home button when on home route
        const homeBtn = document.querySelector('.nav-home-btn');
        if (homeBtn) {
            homeBtn.style.opacity = hash === 'home' ? '1' : '0.7';
        }

        switch (hash) {
            case 'home':
                showView('home-view');
                if (typeof HomeView !== 'undefined') HomeView.render();
                break;
            case 'games':
                showView('games-view');
                if (typeof GamesView !== 'undefined') GamesView.render();
                break;
            case 'calendar':
                showView('calendar-view');
                if (typeof CalendarView !== 'undefined') CalendarView.render();
                break;
            case 'challenges':
                showView('challenges-view');
                if (typeof ChallengesView !== 'undefined') ChallengesView.render();
                break;
            case 'newsletter':
                showView('newsletter-view');
                if (typeof NewsletterView !== 'undefined') NewsletterView.render();
                break;
            case 'feedback':
                showView('feedback-view');
                if (typeof FeedbackView !== 'undefined') FeedbackView.render();
                break;
            case 'about':
                showView('about-view');
                if (typeof AboutView !== 'undefined') AboutView.render();
                break;
            case 'admin':
                showView('admin-view');
                if (typeof AdminView !== 'undefined') AdminView.render();
                break;
            default:
                showView('home-view');
                if (typeof HomeView !== 'undefined') HomeView.render();
                break;
        }
    }

    // ============================
    // GAME MODE (WebSocket)
    // ============================
    function enterGameMode(roomCode) {
        console.log('Entering game mode for room:', roomCode);

        // Hide bottom nav during game
        const nav = document.getElementById('bottom-nav');
        if (nav) nav.style.display = 'none';

        // Need name prompt?
        if (TG.needsNamePrompt()) {
            console.log('Need name prompt, redirecting to landing');
            showView('landing-view');
            LandingView.render(roomCode);
            return;
        }

        let role = null;
        let gameState = null;

        // Build WebSocket URL with auth
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        let wsUrl = `${wsProtocol}//${wsHost}/ws/${roomCode}`;

        if (TG.initData) {
            wsUrl += `?initData=${encodeURIComponent(TG.initData)}`;
            console.log('Using Telegram auth for WebSocket');
        } else {
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
            console.log('Game started:', data.game_id);
        });

        ws.on('game_state', (data) => {
            gameState = data;

            if (data.is_finished) {
                showView('results-view');
                ResultsView.render(data, ws, role === 'host');
                return;
            }

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

            const isAlive = data.alive_players && data.alive_players.some(id => String(id) === String(myId));
            console.log('isAlive:', isAlive, 'role:', role);

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
            if (role === 'host' && gameState && !gameState.is_alive) {
                ObserverView.onPlayerLocked(data);
            }
        });

        ws.on('card_revealed', (data) => {
            console.log('card_revealed received:', data);
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
            const reason = data.reason === 'disconnected' ? 'disconnected' : 'left the game';
            console.log(`${data.player_name} ${reason}`);
            TG.hapticNotification('warning');
        });

        ws.on('game_over', (data) => {
            console.log('game_over received:', data);
            setTimeout(() => {
                showView('results-view');
                ResultsView.render(data, ws, role === 'host');
            }, 2500);
        });

        ws.on('error', (data) => {
            console.error('Server error:', data.message);
            // Reset lobby start button if applicable
            if (typeof LobbyView !== 'undefined' && LobbyView.onError) {
                LobbyView.onError(data.message);
            } else {
                const loadingP = document.querySelector('#loading p');
                if (loadingP) {
                    loadingP.textContent = data.message || 'An error occurred';
                    loadingP.style.color = 'var(--danger, #e94560)';
                }
                showView('loading');
            }
            TG.hapticNotification('error');
        });

        ws.on('_disconnected', () => {
            console.log('Disconnected, will try to reconnect...');
        });

        ws.on('_reconnect_failed', () => {
            document.getElementById('loading').querySelector('p').textContent =
                'Connection lost. Please close and reopen the game.';
            showView('loading');
        });

        ws.connect();
    }

})();
