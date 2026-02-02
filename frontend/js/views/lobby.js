/**
 * Lobby view - waiting room before game starts
 */
const LobbyView = {
    container: null,
    state: null,
    isHost: false,

    render(data, isHost) {
        this.isHost = isHost;
        this.state = data;
        this.container = document.getElementById('lobby-view');
        this.container.innerHTML = '';

        // Room code
        const roomCode = document.createElement('div');
        roomCode.className = 'room-code';
        roomCode.innerHTML = `
            <div class="label">ROOM CODE</div>
            <div class="code">${data.room_code || ''}</div>
        `;
        this.container.appendChild(roomCode);

        // Game info
        const gameInfo = document.createElement('div');
        gameInfo.style.cssText = 'text-align:center;margin-bottom:16px';
        gameInfo.innerHTML = `
            <div style="font-size:18px;font-weight:600">Ride the Bus</div>
            <div class="drinks-badge ${data.drinks_mode ? 'on' : 'off'}">
                ${data.drinks_mode ? 'Drinks Mode ON' : 'Drinks Mode OFF'}
            </div>
        `;
        this.container.appendChild(gameInfo);

        // Players section
        const playersSection = document.createElement('div');
        playersSection.innerHTML = '<div class="section-title">Players</div>';
        const playerList = document.createElement('div');
        playerList.className = 'player-list';
        playerList.id = 'lobby-player-list';

        const players = (data.players || []).map(p => ({
            name: p.name,
            is_host: p.is_host,
        }));
        PlayerListComponent.render(playerList, players, { showStatus: false });
        playersSection.appendChild(playerList);
        this.container.appendChild(playersSection);

        // Host controls
        if (isHost) {
            const controls = document.createElement('div');
            controls.style.cssText = 'margin-top:auto;padding-top:16px;display:flex;flex-direction:column;gap:8px';

            const startBtn = document.createElement('button');
            startBtn.className = 'btn btn-primary';
            startBtn.textContent = 'Start Game';
            startBtn.id = 'start-game-btn';
            startBtn.addEventListener('click', () => {
                if (window.gameWs) {
                    window.gameWs.send({ type: 'start_game' });
                    startBtn.disabled = true;
                    startBtn.textContent = 'Starting...';
                }
            });
            controls.appendChild(startBtn);

            this.container.appendChild(controls);
        } else {
            const waitMsg = document.createElement('div');
            waitMsg.className = 'waiting-state';
            waitMsg.style.marginTop = 'auto';
            waitMsg.innerHTML = `
                <div class="lock-icon">&#x23F3;</div>
                <p>Waiting for host to start the game...</p>
            `;
            this.container.appendChild(waitMsg);
        }
    },

    update(data) {
        this.state = { ...this.state, ...data };
        const playerList = document.getElementById('lobby-player-list');
        if (playerList && data.players) {
            const players = data.players.map(p => ({
                name: p.name,
                is_host: p.is_host,
            }));
            PlayerListComponent.render(playerList, players, { showStatus: false });
        }
    }
};
