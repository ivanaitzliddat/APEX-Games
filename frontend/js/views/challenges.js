/**
 * Challenges view - placeholder (Phase 5)
 */
const ChallengesView = {
    container: null,

    render() {
        this.container = document.getElementById('challenges-view');
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = '<h2>Sports Challenges</h2>';
        this.container.appendChild(header);

        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-message';
        placeholder.innerHTML = `
            <div class="placeholder-icon">&#x1F3C6;</div>
            <p>Challenges coming soon</p>
            <p class="placeholder-sub">Track activities and compete on leaderboards</p>
        `;
        this.container.appendChild(placeholder);
    }
};
