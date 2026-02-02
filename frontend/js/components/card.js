/**
 * Card component - renders a playing card with flip animation
 */
const CardComponent = {
    SUIT_SYMBOLS: {
        hearts: '\u2665',
        diamonds: '\u2666',
        clubs: '\u2663',
        spades: '\u2660',
    },

    /**
     * Create a face-down card element
     */
    createBack(size = 'normal') {
        const card = document.createElement('div');
        card.className = `card ${size === 'small' ? 'small' : ''} dealing`;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-back"></div>
                <div class="card-front"></div>
            </div>
        `;
        return card;
    },

    /**
     * Create a face-up card element
     */
    createFace(cardData, size = 'normal') {
        const card = document.createElement('div');
        const colorClass = cardData.color === 'red' ? 'red' : 'black';
        const suitSymbol = this.SUIT_SYMBOLS[cardData.suit] || '';

        card.className = `card flipped ${size === 'small' ? 'small' : ''}`;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-back"></div>
                <div class="card-front ${colorClass}">
                    <span class="card-rank">${cardData.rank}</span>
                    <span class="card-suit-icon">${suitSymbol}</span>
                    <span class="card-rank-bottom">${cardData.rank}</span>
                </div>
            </div>
        `;
        return card;
    },

    /**
     * Flip a card from back to front with animation
     */
    flip(cardElement, cardData) {
        const front = cardElement.querySelector('.card-front');
        const colorClass = cardData.color === 'red' ? 'red' : 'black';
        const suitSymbol = this.SUIT_SYMBOLS[cardData.suit] || '';

        front.className = `card-front ${colorClass}`;
        front.innerHTML = `
            <span class="card-rank">${cardData.rank}</span>
            <span class="card-suit-icon">${suitSymbol}</span>
            <span class="card-rank-bottom">${cardData.rank}</span>
        `;

        cardElement.classList.add('revealing');
        setTimeout(() => {
            cardElement.classList.add('flipped');
        }, 100);
    }
};
