/**
 * Landing view - game selection, name input, and room code input
 */
const LandingView = {
    container: null,
    games: [],
    selectedGame: null,
    pendingRoomCode: null, // Room code to join after name is entered

    async render(roomCodeToJoin = null) {
        this.container = document.getElementById('landing-view');
        this.container.innerHTML = '';
        this.pendingRoomCode = roomCodeToJoin;

        // App title
        const header = document.createElement('div');
        header.className = 'landing-header';
        header.innerHTML = `
            <h1 class="app-title">APEX Games</h1>
            <p class="app-subtitle">Multiplayer Party Games</p>
        `;
        this.container.appendChild(header);

        // If need name prompt, show name input first
        if (TG.needsNamePrompt()) {
            this._renderNameInput();
            return;
        }

        // Show welcome message with player name
        if (TG.playerName) {
            const welcome = document.createElement('div');
            welcome.className = 'welcome-message';
            welcome.innerHTML = `<p>Welcome, <strong>${TG.playerName}</strong>!</p>`;
            this.container.appendChild(welcome);
        }

        // If we have a pending room code, show join confirmation
        if (this.pendingRoomCode) {
            this._renderJoinConfirmation();
            return;
        }

        // Fetch available games
        await this._loadGames();

        // Game selection section
        const gameSection = document.createElement('div');
        gameSection.className = 'landing-section';
        gameSection.innerHTML = '<div class="section-title">Select a Game</div>';

        const gameGrid = document.createElement('div');
        gameGrid.className = 'game-grid';
        gameGrid.id = 'game-grid';

        if (this.games.length === 0) {
            gameGrid.innerHTML = '<p style="color:var(--hint);text-align:center">No games available</p>';
        } else {
            this.games.forEach(game => {
                const gameCard = this._createGameCard(game);
                gameGrid.appendChild(gameCard);
            });
        }

        gameSection.appendChild(gameGrid);
        this.container.appendChild(gameSection);

        // Room code section
        const roomSection = document.createElement('div');
        roomSection.className = 'landing-section';
        roomSection.innerHTML = `
            <div class="section-title">Join a Room</div>
            <div class="room-input-group">
                <input type="text"
                       id="room-code-input"
                       class="room-code-input"
                       placeholder="Enter room code"
                       maxlength="6"
                       autocomplete="off"
                       autocapitalize="characters">
                <button id="join-room-btn" class="btn btn-primary">Join</button>
            </div>
        `;
        this.container.appendChild(roomSection);

        // Create room section
        const createSection = document.createElement('div');
        createSection.className = 'landing-section';
        createSection.innerHTML = '<div class="section-title">Or Create a New Room</div>';

        const createBtn = document.createElement('button');
        createBtn.id = 'create-room-btn';
        createBtn.className = 'btn btn-outline';
        createBtn.textContent = 'Create Room';
        createBtn.disabled = true;
        createSection.appendChild(createBtn);

        const createHint = document.createElement('p');
        createHint.className = 'create-hint';
        createHint.textContent = 'Select a game above to create a room';
        createHint.id = 'create-hint';
        createSection.appendChild(createHint);

        this.container.appendChild(createSection);

        // Bind events
        this._bindEvents();
    },

    _renderNameInput() {
        const nameSection = document.createElement('div');
        nameSection.className = 'landing-section';
        nameSection.style.marginTop = '24px';

        const title = this.pendingRoomCode ? 'Enter your name to join' : 'Enter your name to play';

        nameSection.innerHTML = `
            <div class="section-title">${title}</div>
            <div class="room-input-group" style="margin-top:12px;">
                <input type="text"
                       id="player-name-input"
                       class="room-code-input"
                       placeholder="Your name"
                       maxlength="20"
                       autocomplete="off"
                       style="text-transform:none;">
                <button id="set-name-btn" class="btn btn-primary">Continue</button>
            </div>
        `;
        this.container.appendChild(nameSection);

        // Focus the input
        setTimeout(() => {
            document.getElementById('player-name-input')?.focus();
        }, 100);

        // Bind name input events
        const nameInput = document.getElementById('player-name-input');
        const setNameBtn = document.getElementById('set-name-btn');

        const submitName = () => {
            const name = nameInput.value.trim();
            if (name.length >= 2) {
                TG.setPlayerName(name);
                TG.hapticImpact('medium');
                console.log('Name set to:', name);

                // If we have a pending room code, join it
                if (this.pendingRoomCode) {
                    this._navigateToRoom(this.pendingRoomCode);
                } else {
                    // Re-render to show main menu
                    this.render();
                }
            } else {
                nameInput.style.borderColor = 'var(--danger)';
                TG.hapticNotification('error');
            }
        };

        setNameBtn.addEventListener('click', submitName);
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitName();
        });
        nameInput.addEventListener('input', () => {
            nameInput.style.borderColor = '';
        });
    },

    _renderJoinConfirmation() {
        const joinSection = document.createElement('div');
        joinSection.className = 'landing-section';
        joinSection.style.marginTop = '24px';
        joinSection.innerHTML = `
            <div class="section-title">Join Room</div>
            <p style="text-align:center;margin:16px 0;font-size:24px;font-weight:bold;letter-spacing:4px;">
                ${this.pendingRoomCode}
            </p>
            <button id="confirm-join-btn" class="btn btn-primary" style="width:100%;">Join Game</button>
            <button id="cancel-join-btn" class="btn btn-outline" style="width:100%;margin-top:8px;">Cancel</button>
        `;
        this.container.appendChild(joinSection);

        document.getElementById('confirm-join-btn').addEventListener('click', () => {
            TG.hapticImpact('medium');
            this._navigateToRoom(this.pendingRoomCode);
        });

        document.getElementById('cancel-join-btn').addEventListener('click', () => {
            this.pendingRoomCode = null;
            this.render();
        });
    },

    async _loadGames() {
        try {
            const response = await fetch('/api/games');
            if (response.ok) {
                const data = await response.json();
                this.games = data.games || [];
            } else {
                console.error('Failed to load games:', response.status);
                this.games = [];
            }
        } catch (e) {
            console.error('Error loading games:', e);
            this.games = [];
        }
    },

    _createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = game.id;

        // Game icons mapping
        const icons = {
            'ride_the_bus': '&#x1F68C;',
            'default': '&#x1F3B2;'
        };

        const icon = icons[game.id] || icons.default;

        card.innerHTML = `
            <div class="game-icon">${icon}</div>
            <div class="game-name">${game.name}</div>
            <div class="game-players">${game.min_players}-${game.max_players} players</div>
        `;

        card.addEventListener('click', () => {
            this._selectGame(game, card);
        });

        return card;
    },

    _selectGame(game, card) {
        // Deselect previous
        const prev = this.container.querySelector('.game-card.selected');
        if (prev) prev.classList.remove('selected');

        // Select new
        card.classList.add('selected');
        this.selectedGame = game;

        // Enable create button
        const createBtn = document.getElementById('create-room-btn');
        createBtn.disabled = false;

        const createHint = document.getElementById('create-hint');
        createHint.textContent = `Create a ${game.name} room`;

        TG.hapticImpact('light');
    },

    _bindEvents() {
        const roomCodeInput = document.getElementById('room-code-input');
        const joinBtn = document.getElementById('join-room-btn');
        const createBtn = document.getElementById('create-room-btn');

        // Auto uppercase room code
        roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        // Join room
        joinBtn.addEventListener('click', () => {
            const code = roomCodeInput.value.trim();
            if (code.length > 0) {
                this._navigateToRoom(code);
            }
        });

        // Enter key to join
        roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = roomCodeInput.value.trim();
                if (code.length > 0) {
                    this._navigateToRoom(code);
                }
            }
        });

        // Create room
        createBtn.addEventListener('click', () => {
            if (this.selectedGame) {
                this._createRoom();
            }
        });
    },

    _navigateToRoom(code) {
        TG.hapticImpact('medium');
        let url = `${window.location.origin}?room=${code}`;

        // Add session_id and player_name params if in session mode
        // This ensures consistency even if sessionStorage fails
        if (!TG.isInTelegram) {
            url += `&session_id=${encodeURIComponent(TG.sessionId)}`;
            if (TG.playerName) {
                url += `&player_name=${encodeURIComponent(TG.playerName)}`;
            }
        }

        console.log('Navigating to room:', url);
        window.location.href = url;
    },

    async _createRoom() {
        if (!this.selectedGame) return;

        const createBtn = document.getElementById('create-room-btn');
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';

        // Use playerId and playerName from TG
        const hostId = TG.playerId;
        const hostName = TG.playerName || 'Host';

        console.log('Creating room with hostId:', hostId, 'hostName:', hostName);

        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host_id: hostId,
                    host_name: hostName,
                    game_id: this.selectedGame.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Room creation response:', JSON.stringify(data));
                const roomCode = data.room?.code;
                if (!roomCode) {
                    console.error('No room code in response:', data);
                    TG.hapticNotification('error');
                    createBtn.textContent = 'Create Room';
                    createBtn.disabled = false;
                    alert('Server returned invalid room data');
                    return;
                }
                console.log('Room created successfully:', roomCode);
                TG.hapticNotification('success');
                this._navigateToRoom(roomCode);
            } else {
                const error = await response.json();
                console.error('Failed to create room:', error);
                TG.hapticNotification('error');
                createBtn.textContent = 'Create Room';
                createBtn.disabled = false;
                alert(error.detail || 'Failed to create room');
            }
        } catch (e) {
            console.error('Error creating room:', e);
            TG.hapticNotification('error');
            createBtn.textContent = 'Create Room';
            createBtn.disabled = false;
            alert('Failed to create room. Please try again.');
        }
    }
};
