/**
 * Landing view - game selection and room code input
 */
const LandingView = {
    container: null,
    games: [],
    selectedGame: null,

    async render() {
        this.container = document.getElementById('landing-view');
        this.container.innerHTML = '';

        // App title
        const header = document.createElement('div');
        header.className = 'landing-header';
        header.innerHTML = `
            <h1 class="app-title">APEX Games</h1>
            <p class="app-subtitle">Multiplayer Party Games</p>
        `;
        this.container.appendChild(header);

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
                this._joinRoom(code);
            }
        });

        // Enter key to join
        roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = roomCodeInput.value.trim();
                if (code.length > 0) {
                    this._joinRoom(code);
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

    _joinRoom(code) {
        TG.hapticImpact('medium');

        // Build URL with room code and dev params
        let url = `${window.location.origin}?room=${code}`;

        // Preserve dev mode params if present
        const params = new URLSearchParams(window.location.search);
        const devId = params.get('dev_user_id');
        const devName = params.get('dev_user_name');

        if (devId) {
            url += `&dev_user_id=${devId}`;
            if (devName) {
                url += `&dev_user_name=${encodeURIComponent(devName)}`;
            }
        }

        window.location.href = url;
    },

    async _createRoom() {
        if (!this.selectedGame) return;

        const createBtn = document.getElementById('create-room-btn');
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';

        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host_id: TG.userId || Math.floor(Math.random() * 100000),
                    host_name: TG.userName || 'Host',
                    game_id: this.selectedGame.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                const roomCode = data.room.code;
                TG.hapticNotification('success');
                this._joinRoom(roomCode);
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
