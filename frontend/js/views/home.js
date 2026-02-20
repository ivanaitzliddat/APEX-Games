/**
 * Home view - hub/dashboard for the APEX Games platform
 */
const HomeView = {
    container: null,

    async render() {
        this.container = document.getElementById('home-view');
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'landing-header';
        const name = TG.playerName || 'Guest';
        const roleBadge = TG.isAdmin()
            ? `<span class="role-badge role-${TG.userRole}">${TG.userRole}</span>`
            : '';
        header.innerHTML = `
            <h1 class="app-title">APEX Games</h1>
            <p class="app-subtitle">Welcome, ${name} ${roleBadge}</p>
        `;
        this.container.appendChild(header);

        // Quick access grid
        const grid = document.createElement('div');
        grid.className = 'home-grid';

        const sections = [
            { icon: '&#x1F3AE;', label: 'Games', route: 'games', desc: 'Play card games' },
            { icon: '&#x1F4C5;', label: 'Calendar', route: 'calendar', desc: 'Upcoming events' },
            { icon: '&#x1F3C6;', label: 'Challenges', route: 'challenges', desc: 'Sports tracker' },
            { icon: '&#x1F4F0;', label: 'Newsletter', route: 'newsletter', desc: 'Announcements' },
            { icon: '&#x1F4DD;', label: 'Feedback', route: 'feedback', desc: 'Share your thoughts' },
            { icon: '&#x1F389;', label: 'About Us', route: 'about', desc: 'Meet the team' },
        ];

        // Add admin section if user is admin/owner
        if (TG.isAdmin()) {
            sections.push({ icon: '&#x2699;', label: 'Admin', route: 'admin', desc: 'Manage platform' });
        }

        sections.forEach(s => {
            const card = document.createElement('a');
            card.className = 'home-card';
            card.href = `#${s.route}`;
            card.innerHTML = `
                <div class="home-card-icon">${s.icon}</div>
                <div class="home-card-label">${s.label}</div>
                <div class="home-card-desc">${s.desc}</div>
            `;
            grid.appendChild(card);
        });

        this.container.appendChild(grid);

        // Load summary data
        await this._loadSummaries();
    },

    async _loadSummaries() {
        // Upcoming events
        try {
            const data = await API.get('/api/calendar/events?limit=3');
            if (data.events && data.events.length > 0) {
                const section = document.createElement('div');
                section.className = 'home-section';
                section.innerHTML = '<div class="section-title">Upcoming Events</div>';

                data.events.forEach(evt => {
                    const card = document.createElement('div');
                    card.className = 'home-summary-card';
                    card.innerHTML = `
                        <div class="summary-title">${evt.title}</div>
                        <div class="summary-meta">${evt.event_date}${evt.event_time ? ' at ' + evt.event_time : ''}${evt.location ? ' - ' + evt.location : ''}</div>
                    `;
                    section.appendChild(card);
                });

                this.container.appendChild(section);
            }
        } catch (e) {
            // Calendar not yet implemented, skip
        }

        // Pinned newsletter posts
        try {
            const data = await API.get('/api/newsletter/posts?pinned=true&limit=2');
            if (data.posts && data.posts.length > 0) {
                const section = document.createElement('div');
                section.className = 'home-section';
                section.innerHTML = '<div class="section-title">Announcements</div>';

                data.posts.forEach(post => {
                    const card = document.createElement('div');
                    card.className = 'home-summary-card';
                    card.innerHTML = `
                        <div class="summary-title">${post.title}</div>
                        <div class="summary-meta">${post.created_at ? post.created_at.split('T')[0] : ''}</div>
                    `;
                    section.appendChild(card);
                });

                this.container.appendChild(section);
            }
        } catch (e) {
            // Newsletter not yet implemented, skip
        }
    }
};
