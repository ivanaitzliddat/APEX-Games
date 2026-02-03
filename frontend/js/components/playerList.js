/**
 * Player list component for rendering player status
 */
const PlayerListComponent = {
    /**
     * Render a player list inside a container
     */
    render(container, players, options = {}) {
        const { showDrinks = false, showStatus = true, showPlayingStatus = false } = options;
        container.innerHTML = '';

        players.forEach(player => {
            const item = document.createElement('div');
            item.className = `player-item ${player.is_alive === false ? 'eliminated' : ''} status-transition`;

            let statusHtml = '';
            if (showStatus) {
                if (player.is_alive === false) {
                    statusHtml = '<span class="player-status status-eliminated">Eliminated</span>';
                } else if (player.has_chosen) {
                    statusHtml = '<span class="player-status status-locked">Locked In</span>';
                } else {
                    statusHtml = '<span class="player-status status-waiting">Choosing...</span>';
                }
            }

            // Show observer badge in lobby
            console.log('PlayerListComponent - player:', player.name, 'showPlayingStatus:', showPlayingStatus, 'is_playing:', player.is_playing);
            if (showPlayingStatus) {
                if (player.is_playing === false) {
                    statusHtml = '<span class="player-status status-observer">Observer</span>';
                } else {
                    statusHtml = '<span class="player-status status-playing">Playing</span>';
                }
            }

            let drinksHtml = '';
            if (showDrinks && player.drinks > 0) {
                drinksHtml = `<span class="drinks-badge on">${player.drinks} sip${player.drinks !== 1 ? 's' : ''}</span>`;
            }

            const hostBadge = player.is_host ? ' (Host)' : '';

            item.innerHTML = `
                <span class="player-name">${player.name || player.player_name}${hostBadge}</span>
                <div style="display:flex;gap:8px;align-items:center">
                    ${drinksHtml}
                    ${statusHtml}
                </div>
            `;
            container.appendChild(item);
        });
    },

    /**
     * Render observer-style player grid
     */
    renderGrid(container, players, options = {}) {
        const { showDrinks = false } = options;
        container.innerHTML = '';

        players.forEach(player => {
            const card = document.createElement('div');
            let stateClass = '';
            if (player.is_alive === false) stateClass = 'eliminated';
            else if (player.has_chosen) stateClass = 'locked';

            card.className = `observer-player-card ${stateClass}`;

            const initial = (player.name || player.player_name || '?')[0].toUpperCase();
            const drinksHtml = showDrinks && player.drinks > 0
                ? `<div class="drinks-count">${player.drinks} sip${player.drinks !== 1 ? 's' : ''}</div>`
                : '';

            let statusText = 'Waiting';
            if (player.is_alive === false) statusText = 'Eliminated';
            else if (player.has_chosen) statusText = 'Locked In';

            card.innerHTML = `
                <div class="player-avatar">${initial}</div>
                <div class="player-name" style="font-size:13px;font-weight:500">${player.name || player.player_name}</div>
                <div style="font-size:11px;color:var(--hint);margin-top:2px">${statusText}</div>
                ${drinksHtml}
            `;
            container.appendChild(card);
        });
    }
};
