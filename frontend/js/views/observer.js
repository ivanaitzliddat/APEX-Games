/**
 * Host observer view - live dashboard showing all player statuses
 */
const ObserverView = {
    container: null,
    state: null,
    currentCard: null,

    render(state) {
        this.state = state;
        this.container = document.getElementById('observer-view');
        this.container.innerHTML = '';

        if (state.is_finished) {
            return; // Results view handles this
        }

        // Phase indicator
        const config = RideTheBusUI.getPhaseConfig(state.phase);
        const phaseIndicator = document.createElement('div');
        phaseIndicator.className = 'phase-indicator';
        phaseIndicator.innerHTML = `
            <div class="phase-number">Phase ${state.phase} of 4</div>
            <h2>${config ? config.name : ''}</h2>
            <div class="phase-progress">
                ${[1,2,3,4].map(p => {
                    let cls = 'phase-dot';
                    if (p < state.phase) cls += ' completed';
                    else if (p === state.phase) cls += ' current';
                    return `<div class="${cls}"></div>`;
                }).join('')}
            </div>
        `;
        this.container.appendChild(phaseIndicator);

        // Lock-in progress
        const lockProgress = document.createElement('div');
        lockProgress.className = 'lock-progress';
        lockProgress.id = 'lock-progress';
        const aliveCount = state.alive_count || 0;
        const lockedCount = state.locked_count || 0;
        lockProgress.innerHTML = `
            <div class="count">${lockedCount} / ${aliveCount}</div>
            <div class="label">Players Locked In</div>
        `;
        this.container.appendChild(lockProgress);

        // Previously revealed cards
        if (state.revealed_cards && state.revealed_cards.length > 0) {
            const prevSection = document.createElement('div');
            prevSection.innerHTML = '<div class="section-title" style="text-align:center">Previous Cards</div>';
            const cardsArea = document.createElement('div');
            cardsArea.className = 'cards-area';
            state.revealed_cards.forEach(c => {
                cardsArea.appendChild(CardComponent.createFace(c, 'small'));
            });
            prevSection.appendChild(cardsArea);
            this.container.appendChild(prevSection);
        }

        // Current card area
        const currentCardArea = document.createElement('div');
        currentCardArea.className = 'cards-area';
        currentCardArea.id = 'observer-card-area';
        this.currentCard = CardComponent.createBack();
        currentCardArea.appendChild(this.currentCard);
        this.container.appendChild(currentCardArea);

        // Player grid
        const gridSection = document.createElement('div');
        gridSection.innerHTML = '<div class="section-title">Players</div>';
        const grid = document.createElement('div');
        grid.className = 'observer-grid';
        grid.id = 'observer-player-grid';
        PlayerListComponent.renderGrid(grid, state.players || [], {
            showDrinks: state.drinks_mode,
        });
        gridSection.appendChild(grid);
        this.container.appendChild(gridSection);
    },

    /**
     * Update when a player locks in
     */
    onPlayerLocked(data) {
        // Update lock progress
        const lockProgress = document.getElementById('lock-progress');
        if (lockProgress) {
            lockProgress.innerHTML = `
                <div class="count">${data.locked_count} / ${data.total_alive}</div>
                <div class="label">Players Locked In</div>
            `;
        }

        // Update the specific player in the grid
        const grid = document.getElementById('observer-player-grid');
        if (grid && this.state && this.state.players) {
            const player = this.state.players.find(p => p.player_id === data.player_id);
            if (player) {
                player.has_chosen = true;
                PlayerListComponent.renderGrid(grid, this.state.players, {
                    showDrinks: this.state.drinks_mode,
                });
            }
        }

        TG.hapticImpact('light');
    },

    /**
     * Handle card reveal
     */
    showCardReveal(data) {
        if (this.currentCard) {
            CardComponent.flip(this.currentCard, data.card);
            TG.hapticImpact('heavy');
        }
    },

    /**
     * Update after elimination
     */
    onElimination(data) {
        if (this.state && this.state.players) {
            const eliminatedIds = new Set(data.eliminated.map(e => e.player_id));
            this.state.players.forEach(p => {
                if (eliminatedIds.has(p.player_id)) {
                    p.is_alive = false;
                }
            });

            const grid = document.getElementById('observer-player-grid');
            if (grid) {
                PlayerListComponent.renderGrid(grid, this.state.players, {
                    showDrinks: this.state.drinks_mode,
                });
            }
        }
    },

    /**
     * Transition to next phase
     */
    nextPhase(state) {
        setTimeout(() => {
            this.state = state;
            this.render(state);
        }, 2000);
    }
};
