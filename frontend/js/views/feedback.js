/**
 * Feedback view - submit feedback and view word cloud of all feedback
 */
const FeedbackView = {
    container: null,
    myContent: null,

    async render() {
        this.container = document.getElementById('feedback-view');
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = '<h2>Feedback</h2>';
        this.container.appendChild(header);

        // Input section
        const inputSection = document.createElement('div');
        inputSection.className = 'feedback-input-section';

        const label = document.createElement('div');
        label.className = 'section-title';
        label.textContent = 'Your Feedback';
        inputSection.appendChild(label);

        const hint = document.createElement('p');
        hint.className = 'feedback-hint';
        hint.textContent = 'Your feedback is displayed anonymously in the word cloud above.';
        inputSection.appendChild(hint);

        const textarea = document.createElement('textarea');
        textarea.id = 'feedback-textarea';
        textarea.className = 'feedback-textarea';
        textarea.placeholder = 'Share your thoughts...';
        textarea.maxLength = 2000;
        inputSection.appendChild(textarea);

        const charCount = document.createElement('div');
        charCount.className = 'feedback-char-count';
        charCount.id = 'feedback-char-count';
        charCount.textContent = '0 / 2000';
        inputSection.appendChild(charCount);

        textarea.addEventListener('input', () => {
            charCount.textContent = `${textarea.value.length} / 2000`;
        });

        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn btn-primary';
        submitBtn.id = 'feedback-submit-btn';
        submitBtn.textContent = 'Submit Feedback';
        submitBtn.addEventListener('click', () => this._submit(textarea, submitBtn));
        inputSection.appendChild(submitBtn);

        // Word cloud section (above input)
        const cloudSection = document.createElement('div');
        cloudSection.className = 'feedback-cloud-section';

        const cloudLabel = document.createElement('div');
        cloudLabel.className = 'section-title';
        cloudLabel.textContent = 'What Everyone\'s Saying';
        cloudSection.appendChild(cloudLabel);

        const cloud = document.createElement('div');
        cloud.className = 'word-cloud';
        cloud.id = 'word-cloud';
        cloud.innerHTML = '<p style="color:var(--hint);text-align:center;padding:20px">Loading...</p>';
        cloudSection.appendChild(cloud);

        this.container.appendChild(cloudSection);

        this.container.appendChild(inputSection);

        // Load data
        await Promise.all([
            this._loadMyFeedback(textarea),
            this._loadWordCloud(),
        ]);
    },

    async _loadMyFeedback(textarea) {
        try {
            const data = await API.get('/api/feedback/mine');
            if (data.content) {
                this.myContent = data.content;
                textarea.value = data.content;
                const charCount = document.getElementById('feedback-char-count');
                if (charCount) charCount.textContent = `${data.content.length} / 2000`;
                const submitBtn = document.getElementById('feedback-submit-btn');
                if (submitBtn) submitBtn.textContent = 'Update Feedback';
            }
        } catch (e) {
            // Guest or not logged in, leave blank
        }
    },

    async _loadWordCloud() {
        const cloud = document.getElementById('word-cloud');
        if (!cloud) return;

        try {
            const data = await API.get('/api/feedback');
            const allText = data.feedback.join(' ');

            if (!allText.trim()) {
                cloud.innerHTML = '<p style="color:var(--hint);text-align:center;padding:20px">No feedback yet. Be the first!</p>';
                return;
            }

            const words = this._buildWordFrequency(allText);
            this._renderWordCloud(cloud, words);
        } catch (e) {
            cloud.innerHTML = '<p style="color:var(--hint);text-align:center">Could not load feedback</p>';
        }
    },

    _buildWordFrequency(text) {
        // Common words to exclude from cloud
        const stopWords = new Set([
            'the','a','an','and','or','but','in','on','at','to','for','of','with',
            'is','it','its','was','are','were','be','been','being','have','has',
            'had','do','does','did','will','would','could','should','may','might',
            'this','that','these','those','i','you','he','she','we','they','me',
            'him','her','us','them','my','your','his','our','their','what','which',
            'who','when','where','how','why','so','as','if','not','no','yes','very',
            'just','also','more','than','then','there','here','all','any','some',
            'can','get','got','like','really','about','from','by','up','out','into',
        ]);

        const freq = {};
        text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w))
            .forEach(w => { freq[w] = (freq[w] || 0) + 1; });

        // Sort by frequency, take top 60
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 60)
            .map(([word, count]) => ({ word, count }));
    },

    _renderWordCloud(container, words) {
        if (words.length === 0) {
            container.innerHTML = '<p style="color:var(--hint);text-align:center;padding:20px">No keywords yet</p>';
            return;
        }

        const maxCount = words[0].count;
        const minCount = words[words.length - 1].count;

        const colors = [
            'var(--button)',
            'var(--accent)',
            'var(--success)',
            '#f0a500',
            '#a78bfa',
            '#34d399',
            '#fb923c',
        ];

        // Shuffle so it doesn't look sorted by size
        const shuffled = [...words].sort(() => Math.random() - 0.5);

        container.innerHTML = '';
        shuffled.forEach(({ word, count }) => {
            const range = maxCount - minCount || 1;
            const ratio = (count - minCount) / range; // 0 to 1

            const fontSize = 13 + ratio * 26; // 13px to 39px
            const opacity = 0.6 + ratio * 0.4; // 0.6 to 1
            const color = colors[Math.floor(Math.random() * colors.length)];

            const span = document.createElement('span');
            span.className = 'cloud-word';
            span.textContent = word;
            span.title = `${count} mention${count > 1 ? 's' : ''}`;
            span.style.cssText = `font-size:${fontSize}px;opacity:${opacity};color:${color};font-weight:${ratio > 0.5 ? 700 : 500};`;
            container.appendChild(span);
        });
    },

    async _submit(textarea, btn) {
        const content = textarea.value.trim();
        if (!content) {
            textarea.focus();
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            await API.post('/api/feedback', { content });
            TG.hapticNotification('success');
            btn.textContent = 'Update Feedback';
            this.myContent = content;

            // Refresh word cloud
            await this._loadWordCloud();
        } catch (e) {
            TG.hapticNotification('error');
            alert(e.message || 'Failed to submit feedback');
            btn.textContent = this.myContent ? 'Update Feedback' : 'Submit Feedback';
        } finally {
            btn.disabled = false;
        }
    }
};
