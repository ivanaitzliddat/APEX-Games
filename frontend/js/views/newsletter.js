/**
 * Newsletter view - placeholder (Phase 3)
 */
const NewsletterView = {
    container: null,

    render() {
        this.container = document.getElementById('newsletter-view');
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = '<h2>Newsletter</h2>';
        this.container.appendChild(header);

        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-message';
        placeholder.innerHTML = `
            <div class="placeholder-icon">&#x1F4F0;</div>
            <p>Newsletter coming soon</p>
            <p class="placeholder-sub">Announcements and updates will appear here</p>
        `;
        this.container.appendChild(placeholder);
    }
};
