/**
 * Games view - game selection, room code input, create room
 */
const GamesView = {
    container: null,
    games: [],
    selectedGame: null,

    async render() {
        this.container = document.getElementById('games-view');
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = '<h2>Games</h2>';
        this.container.appendChild(header);

        // Fetch available games
        await this._loadGames();

        // Game selection section
        const gameSection = document.createElement('div');
        gameSection.className = 'landing-section';
        gameSection.innerHTML = '<div class="section-title">Select a Game</div>';

        const gameGrid = document.createElement('div');
        gameGrid.className = 'game-grid';

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
                       id="games-room-code-input"
                       class="room-code-input"
                       placeholder="Enter room code"
                       maxlength="6"
                       autocomplete="off"
                       autocapitalize="characters">
                <button id="games-join-btn" class="btn btn-primary">Join</button>
            </div>
        `;
        this.container.appendChild(roomSection);

        // Create room section
        const createSection = document.createElement('div');
        createSection.className = 'landing-section';
        createSection.innerHTML = '<div class="section-title">Or Create a New Room</div>';

        const createBtn = document.createElement('button');
        createBtn.id = 'games-create-btn';
        createBtn.className = 'btn btn-outline';
        createBtn.textContent = 'Create Room';
        createBtn.disabled = true;
        createSection.appendChild(createBtn);

        const createHint = document.createElement('p');
        createHint.className = 'create-hint';
        createHint.textContent = 'Select a game above to create a room';
        createHint.id = 'games-create-hint';
        createSection.appendChild(createHint);

        this.container.appendChild(createSection);

        this._bindEvents();
    },

    async _loadGames() {
        try {
            const data = await API.get('/api/games');
            this.games = data.games || [];
        } catch (e) {
            console.error('Error loading games:', e);
            this.games = [];
        }
    },

    _createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = game.id;

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

        card.addEventListener('click', () => this._selectGame(game, card));
        return card;
    },

    _selectGame(game, card) {
        const prev = this.container.querySelector('.game-card.selected');
        if (prev) prev.classList.remove('selected');

        card.classList.add('selected');
        this.selectedGame = game;

        const createBtn = document.getElementById('games-create-btn');
        createBtn.disabled = false;

        const createHint = document.getElementById('games-create-hint');
        createHint.textContent = `Create a ${game.name} room`;

        TG.hapticImpact('light');
    },

    _bindEvents() {
        const roomCodeInput = document.getElementById('games-room-code-input');
        const joinBtn = document.getElementById('games-join-btn');
        const createBtn = document.getElementById('games-create-btn');

        roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        joinBtn.addEventListener('click', () => {
            const code = roomCodeInput.value.trim();
            if (code.length > 0) this._navigateToRoom(code);
        });

        roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = roomCodeInput.value.trim();
                if (code.length > 0) this._navigateToRoom(code);
            }
        });

        createBtn.addEventListener('click', () => {
            if (this.selectedGame) this._createRoom();
        });
    },

    _navigateToRoom(code) {
        TG.hapticImpact('medium');
        let url = `${window.location.origin}?room=${code}`;

        if (!TG.isInTelegram) {
            url += `&session_id=${encodeURIComponent(TG.sessionId)}`;
            if (TG.playerName) {
                url += `&player_name=${encodeURIComponent(TG.playerName)}`;
            }
        }

        window.location.href = url;
    },

    async _createRoom() {
        if (!this.selectedGame) return;

        const createBtn = document.getElementById('games-create-btn');
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';

        try {
            const data = await API.post('/api/rooms', {
                host_id: TG.playerId || Math.floor(Math.random() * 100000),
                host_name: TG.playerName || 'Host',
                game_id: this.selectedGame.id,
            });

            const roomCode = data.room.code;
            TG.hapticNotification('success');
            this._navigateToRoom(roomCode);
        } catch (e) {
            console.error('Failed to create room:', e);
            TG.hapticNotification('error');
            createBtn.textContent = 'Create Room';
            createBtn.disabled = false;
            alert(e.message || 'Failed to create room');
        }
    }
};
