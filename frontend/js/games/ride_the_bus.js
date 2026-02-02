/**
 * Ride the Bus - game-specific UI configuration
 */
const RideTheBusUI = {
    PHASE_CONFIGS: {
        1: {
            name: 'Red or Black',
            description: 'Will the next card be red or black?',
            options: [
                { value: 'red', label: 'Red', icon: '\u2665', className: 'red' },
                { value: 'black', label: 'Black', icon: '\u2660', className: 'black' },
            ],
            gridClass: 'cols-2',
        },
        2: {
            name: 'Higher or Lower',
            description: 'Will the next card be higher or lower?',
            options: [
                { value: 'higher', label: 'Higher', icon: '\u2191', className: '' },
                { value: 'lower', label: 'Lower', icon: '\u2193', className: '' },
            ],
            gridClass: 'cols-2',
        },
        3: {
            name: 'In Between or Outside',
            description: 'Will the next card be between, outside, or the same?',
            options: [
                { value: 'between', label: 'Between', icon: '\u2194', className: '' },
                { value: 'outside', label: 'Outside', icon: '\u21D4', className: '' },
                { value: 'same', label: 'Same', icon: '=', className: '' },
            ],
            gridClass: 'cols-3',
        },
        4: {
            name: 'Guess the Suit',
            description: 'Guess the suit of the next card!',
            options: [
                { value: 'hearts', label: 'Hearts', icon: '\u2665', className: 'red' },
                { value: 'diamonds', label: 'Diamonds', icon: '\u2666', className: 'red' },
                { value: 'clubs', label: 'Clubs', icon: '\u2663', className: 'black' },
                { value: 'spades', label: 'Spades', icon: '\u2660', className: 'black' },
            ],
            gridClass: 'cols-4',
        },
    },

    getPhaseConfig(phase) {
        return this.PHASE_CONFIGS[phase] || null;
    },

    /**
     * Build choice buttons for a phase
     */
    buildChoiceButtons(phase, onSelect) {
        const config = this.getPhaseConfig(phase);
        if (!config) return null;

        const grid = document.createElement('div');
        grid.className = `choices-grid ${config.gridClass}`;

        config.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = `choice-btn ${opt.className}`;
            btn.dataset.value = opt.value;
            btn.innerHTML = `
                <span class="suit-icon">${opt.icon}</span>
                <span>${opt.label}</span>
            `;
            btn.addEventListener('click', () => onSelect(opt.value, btn, grid));
            grid.appendChild(btn);
        });

        return grid;
    },

    /**
     * Mark the selected button
     */
    markSelected(btn, grid) {
        grid.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    },

    /**
     * Show results on choice buttons
     */
    showResults(grid, correctValue) {
        grid.querySelectorAll('.choice-btn').forEach(btn => {
            btn.style.pointerEvents = 'none';
            if (btn.dataset.value === correctValue) {
                btn.classList.add('correct');
            } else if (btn.classList.contains('selected')) {
                btn.classList.add('wrong');
            }
        });
    }
};
