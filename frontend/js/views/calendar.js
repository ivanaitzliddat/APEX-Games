/**
 * Calendar view - placeholder (Phase 2)
 */
const CalendarView = {
    container: null,

    render() {
        this.container = document.getElementById('calendar-view');
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = '<h2>Calendar</h2>';
        this.container.appendChild(header);

        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-message';
        placeholder.innerHTML = `
            <div class="placeholder-icon">&#x1F4C5;</div>
            <p>Calendar coming soon</p>
            <p class="placeholder-sub">Events and schedules will appear here</p>
        `;
        this.container.appendChild(placeholder);
    }
};
