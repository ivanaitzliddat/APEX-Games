/**
 * Player game view - card display, choice buttons, phase progress
 */
const GameView = {
    container: null,
    state: null,
    currentChoice: null,
    choiceGrid: null,
    currentCard: null,

    render(state) {
        this.state = state;
        this.currentChoice = null;
        this.container = document.getElementById('game-view');
        this.container.innerHTML = '';

        if (state.is_finished) {
            return; // Results view handles this
        }

        // Phase indicator with progress dots
        const phaseIndicator = document.createElement('div');
        phaseIndicator.className = 'phase-indicator';
        const config = RideTheBusUI.getPhaseConfig(state.phase);
        phaseIndicator.innerHTML = `
            <div class="phase-number">Phase ${state.phase} of 4</div>
            <h2>${config ? config.name : ''}</h2>
            <p style="font-size:13px;color:var(--hint);margin-top:4px">${config ? config.description : ''}</p>
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

        // Alive players count
        const aliveInfo = document.createElement('div');
        aliveInfo.style.cssText = 'text-align:center;font-size:13px;color:var(--hint);margin-bottom:12px';
        aliveInfo.textContent = `${state.alive_count} of ${state.total_players} players remaining`;
        this.container.appendChild(aliveInfo);

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

        // Current card area (face down)
        const currentCardArea = document.createElement('div');
        currentCardArea.className = 'cards-area';
        currentCardArea.id = 'current-card-area';
        this.currentCard = CardComponent.createBack();
        currentCardArea.appendChild(this.currentCard);
        this.container.appendChild(currentCardArea);

        // Choice buttons or spectator notice
        if (!state.is_alive) {
            const notice = document.createElement('div');
            notice.className = 'spectator-notice';
            notice.textContent = 'You have been eliminated. Watching as spectator.';
            this.container.appendChild(notice);
        } else if (state.has_chosen) {
            this._showWaiting();
        } else {
            this._showChoices(state.phase);
        }
    },

    _showChoices(phase) {
        const choicesContainer = document.createElement('div');
        choicesContainer.id = 'choices-container';

        this.choiceGrid = RideTheBusUI.buildChoiceButtons(phase, (value, btn, grid) => {
            if (this.currentChoice) return; // already chosen
            this.currentChoice = value;

            RideTheBusUI.markSelected(btn, grid);
            TG.hapticImpact('light');

            // Disable all buttons
            grid.querySelectorAll('.choice-btn').forEach(b => {
                b.style.pointerEvents = 'none';
            });

            // Send choice to server
            if (window.gameWs) {
                window.gameWs.send({ type: 'action', choice: value });
            }

            // Show waiting after a moment
            setTimeout(() => {
                this._showWaiting();
            }, 500);
        });

        if (this.choiceGrid) {
            choicesContainer.appendChild(this.choiceGrid);
        }
        this.container.appendChild(choicesContainer);
    },

    _showWaiting() {
        const existing = document.getElementById('choices-container');
        if (existing) {
            existing.innerHTML = `
                <div class="waiting-state">
                    <div class="lock-icon">&#x1F512;</div>
                    <p>Choice locked in! Waiting for other players...</p>
                </div>
            `;
        }
    },

    /**
     * Handle card reveal event
     */
    showCardReveal(data) {
        const card = data.card;

        // Flip the current card
        if (this.currentCard) {
            CardComponent.flip(this.currentCard, card);
            TG.hapticImpact('heavy');
        }

        // Find this player's result
        const myResult = data.results.find(r => r.player_id === TG.userId);

        // Show result banner after card flip animation
        setTimeout(() => {
            if (myResult) {
                this._showResultBanner(myResult, data.drinks_mode);
            }
        }, 800);
    },

    _showResultBanner(result, drinksMode) {
        // Remove existing banner
        const existingBanner = this.container.querySelector('.result-banner');
        if (existingBanner) existingBanner.remove();

        const banner = document.createElement('div');
        banner.className = `result-banner ${result.correct ? 'win' : 'lose'}`;

        if (result.correct) {
            banner.innerHTML = 'Correct! You advance!';
            TG.hapticNotification('success');
        } else {
            let html = 'Wrong! You\'re eliminated!';
            if (drinksMode && result.drink_penalty) {
                html += `<div class="drink-penalty">${result.drink_penalty}</div>`;
            }
            banner.innerHTML = html;
            TG.hapticNotification('error');
        }

        this.container.appendChild(banner);
    },

    /**
     * Transition to next phase
     */
    nextPhase(state) {
        setTimeout(() => {
            this.render(state);
        }, 2000);
    }
};
