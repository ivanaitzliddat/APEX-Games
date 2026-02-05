/**
 * Results view - final game standings and winner celebration
 */
const ResultsView = {
    container: null,
    ws: null,
    isHost: false,

    render(data, ws, isHost) {
        this.container = document.getElementById('results-view');
        this.container.innerHTML = '';
        this.ws = ws;
        this.isHost = isHost || false;

        const winners = data.winners || [];
        const standings = data.final_standings || [];
        const drinksMode = data.drinks_mode || false;

        // Winner announcement
        if (winners.length > 0) {
            const trophy = document.createElement('div');
            trophy.className = 'trophy-container';
            trophy.innerHTML = `
                <div class="trophy">&#x1F3C6;</div>
                <h1 style="margin-top:12px;font-size:24px">
                    ${winners.length === 1 ? 'Winner!' : 'Winners!'}
                </h1>
                <div style="margin-top:8px;font-size:18px;color:var(--success)">
                    ${winners.map(w => w.player_name).join(', ')}
                </div>
            `;
            this.container.appendChild(trophy);

            // Confetti
            this._spawnConfetti();
        } else {
            const noWinner = document.createElement('div');
            noWinner.style.cssText = 'text-align:center;padding:24px';
            noWinner.innerHTML = `
                <div style="font-size:48px">&#x1F6CC;</div>
                <h1 style="margin-top:12px;font-size:24px">Nobody Survived!</h1>
                <p style="color:var(--hint);margin-top:8px">Everyone rides the bus!</p>
            `;
            this.container.appendChild(noWinner);
        }

        // Final standings
        const standingsSection = document.createElement('div');
        standingsSection.style.marginTop = '24px';
        standingsSection.innerHTML = '<div class="section-title">Final Standings</div>';

        const standingsList = document.createElement('div');
        standingsList.className = 'player-list';

        // Sort: winners first, then by drinks (ascending)
        const sorted = [...standings].sort((a, b) => {
            if (a.is_winner && !b.is_winner) return -1;
            if (!a.is_winner && b.is_winner) return 1;
            return (a.drinks || 0) - (b.drinks || 0);
        });

        sorted.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = `player-item ${!player.is_winner ? 'eliminated' : ''}`;

            let badge = '';
            if (player.is_winner) {
                badge = '<span style="font-size:16px">&#x1F451;</span>';
            } else {
                badge = '<span style="font-size:12px;color:var(--danger)">&#x274C;</span>';
            }

            let drinksHtml = '';
            if (drinksMode && player.drinks > 0) {
                drinksHtml = `<span class="drinks-badge on">${player.drinks} sip${player.drinks !== 1 ? 's' : ''}</span>`;
            }

            item.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px">
                    ${badge}
                    <span class="player-name">${player.player_name}</span>
                </div>
                ${drinksHtml}
            `;
            standingsList.appendChild(item);
        });

        standingsSection.appendChild(standingsList);
        this.container.appendChild(standingsSection);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'margin-top:auto;padding-top:16px;display:flex;flex-direction:column;gap:8px';

        // Play Again button - available to everyone
        if (this.ws) {
            const playAgainBtn = document.createElement('button');
            playAgainBtn.className = 'btn btn-primary';
            playAgainBtn.id = 'play-again-btn';

            if (this.isHost) {
                playAgainBtn.textContent = 'Play Again';
                playAgainBtn.addEventListener('click', () => {
                    TG.hapticImpact('medium');
                    playAgainBtn.textContent = 'Starting...';
                    playAgainBtn.disabled = true;
                    this.ws.send({ type: 'reset_game' });
                });
            } else {
                playAgainBtn.textContent = 'Ready to Play Again';
                playAgainBtn.addEventListener('click', () => {
                    TG.hapticImpact('light');
                    playAgainBtn.textContent = 'Waiting for host...';
                    playAgainBtn.disabled = true;
                    playAgainBtn.classList.remove('btn-primary');
                    playAgainBtn.classList.add('btn-outline');
                });
            }
            btnContainer.appendChild(playAgainBtn);
        }

        // New Game button - goes to landing page
        const newGameBtn = document.createElement('button');
        newGameBtn.className = 'btn btn-outline';
        newGameBtn.textContent = 'Leave Room';
        newGameBtn.addEventListener('click', () => {
            // Navigate to landing page to select a new game
            let url = window.location.origin;
            const params = new URLSearchParams(window.location.search);
            const devId = params.get('dev_user_id');
            const devName = params.get('dev_user_name');

            if (devId) {
                url += `?dev_user_id=${devId}`;
                if (devName) {
                    url += `&dev_user_name=${encodeURIComponent(devName)}`;
                }
            }

            window.location.href = url;
        });
        btnContainer.appendChild(newGameBtn);

        this.container.appendChild(btnContainer);

        TG.hapticNotification(winners.length > 0 ? 'success' : 'warning');
    },

    _spawnConfetti() {
        const colors = ['#e94560', '#4ecca3', '#3390ec', '#f0a500', '#9b59b6', '#ffffff'];
        const container = this.container;

        for (let i = 0; i < 40; i++) {
            setTimeout(() => {
                const piece = document.createElement('div');
                piece.className = 'confetti-piece';
                piece.style.left = Math.random() * 100 + '%';
                piece.style.background = colors[Math.floor(Math.random() * colors.length)];
                piece.style.animationDelay = Math.random() * 0.5 + 's';
                piece.style.animationDuration = (1.5 + Math.random()) + 's';
                container.appendChild(piece);

                setTimeout(() => piece.remove(), 3000);
            }, i * 50);
        }
    }
};
