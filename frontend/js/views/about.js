/**
 * About Us view - APEX team members (Netflix leadership-inspired)
 */
const AboutView = {
    container: null,

    render() {
        this.container = document.getElementById('about-view');
        this.container.innerHTML = '';

        // Header — same as Feedback section
        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = '<h2>Our APEX Team</h2>';
        this.container.appendChild(header);

        // Description
        const desc = document.createElement('div');
        desc.className = 'section-title about-desc';
        desc.textContent = 'Meet the APEX team working tirelessly behind the scenes for WY26/27.';
        this.container.appendChild(desc);

        // Team grid
        const grid = document.createElement('div');
        grid.className = 'team-grid';

        const accentColors = [
            'var(--button)',
            'var(--accent)',
            'var(--success)',
            '#f0a500',
            '#a78bfa',
            '#34d399',
            '#fb923c',
            '#38bdf8',
            '#f472b6',
        ];

        const members = [
            { role: 'APEX Lead', names: ['Kairos Koh'], handles: ['@twobucks2'] },
            { role: 'Dy APEX Lead', names: ['Lum Jun Jie'], handles: ['@xx'] },
            { role: 'Maximise Potential Team', names: ['Lua Jun Jie'], handles: ['@xx'] },
            { role: 'Future Ready Culture', names: ['Teo Shi Jie'], handles: ['@xx'] },
            { role: 'Sports O', names: ['Ong Jun Bin', 'Swarmi'], handles: ['@xx', '@xx'] },
            { role: 'Bats Cave Manager', names: ['Heng Siang Yew'], handles: ['@xx'] },
            { role: 'Social Media Manager', names: ['Javier Loh'], handles: ['@xx'] },
            { role: 'Sports IC', names: ['Arvind'], handles: ['@xx'] },
            { role: 'Celebrating Success', names: ['Joel'], handles: ['@xx'] },
        ];

        members.forEach((member, idx) => {
            const color = accentColors[idx % accentColors.length];

            const card = document.createElement('div');
            card.className = 'team-member';

            // Avatar(s) — replaces headshot
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'team-avatar-wrap';

            member.names.forEach((name, i) => {
                const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const avatar = document.createElement('div');
                avatar.className = 'team-avatar';
                avatar.textContent = initials;
                avatar.style.background = color;
                if (member.names.length > 1 && i > 0) avatar.style.marginLeft = '-16px';
                avatarWrap.appendChild(avatar);
            });
            card.appendChild(avatarWrap);

            // Names in accent color (like Netflix red names)
            member.names.forEach((name, i) => {
                const nameEl = document.createElement('div');
                nameEl.className = 'team-member-name';
                nameEl.textContent = name;
                nameEl.style.color = color;
                card.appendChild(nameEl);
            });

            // Role title in muted color
            const roleEl = document.createElement('div');
            roleEl.className = 'team-member-role';
            roleEl.textContent = member.role;
            card.appendChild(roleEl);

            // Handle(s)
            const handleRow = document.createElement('div');
            handleRow.className = 'team-member-handles';

            member.handles.forEach((handle, i) => {
                const username = handle.replace('@', '');
                if (i > 0) {
                    handleRow.appendChild(Object.assign(document.createElement('span'), {
                        className: 'team-handle-sep',
                        textContent: ' / ',
                    }));
                }
                if (username && username !== 'xx') {
                    handleRow.appendChild(Object.assign(document.createElement('a'), {
                        className: 'team-handle-link',
                        href: `https://t.me/${username}`,
                        target: '_blank',
                        textContent: handle,
                    }));
                } else {
                    handleRow.appendChild(Object.assign(document.createElement('span'), {
                        className: 'team-handle-dim',
                        textContent: handle,
                    }));
                }
            });

            card.appendChild(handleRow);
            grid.appendChild(card);
        });

        this.container.appendChild(grid);
    }
};
