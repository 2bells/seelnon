import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

export async function openWonderlandWindow(entry, openWindowFn) {
    const container = document.createElement('div');
    container.className = 'wonderland-window';

    // Load CSS
    if (!document.getElementById('wonderland-css')) {
        const link = document.createElement('link');
        link.id = 'wonderland-css';
        link.rel = 'stylesheet';
        link.href = './wonderlands.css';
        document.head.appendChild(link);
    }

    // Derive base path from URL
    const basePath = entry.url.substring(0, entry.url.lastIndexOf('/') + 1);
    
    // Default config
    let config = {
        trailerId: "",
        videos: {},
        images: {},
        avatar: "",
        version: "v1.0.0",
        themeColor: "#e91e63",
        avatarColor: "#673ab7",
        wipStatuses: ["wip", "forging"],
        labels: {
            journal: "DEV_JOURNAL",
            logs: "DEV_LOGS",
            terminal: "[ TERMINAL_LOGS ]",
            description: "Wonderland Description",
            wip: "WORK IN PROGRESS",
            guid: "Stage GUID (Click to Copy)"
        }
    };

    // Initial Render (Shell)
    const isHtmlExperience = entry.url.toLowerCase().endsWith('.html');
    container.innerHTML = `
        <main class="wonderland-main">
            <header class="wonderland-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="wonderland-rank-avatar" style="background-color: ${config.avatarColor};"></div>
                    <div>
                        <h1 class="wonderland-title">${entry.name}</h1>
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.5; margin-top: 4px;">
                            <span class="journal-label">${config.labels.journal}</span>
                            <span class="wonderland-version-badge" style="background: ${config.themeColor}; color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${config.version}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    ${isHtmlExperience ? `<button class="wonderland-btn wonderland-refresh-experience" title="Reload Experience">⟳</button>` : ''}
                    <button class="wonderland-btn wonderland-log-toggle">${config.labels.logs} <span class="blinking-cursor">_</span></button>
                </div>
            </header>
            <div class="wonderland-wip-banner" style="display: none;"></div>
            <div class="wonderland-content-grid">
                <div class="wonderland-left-col">
                    <div class="wonderland-carousel wonderland-stage-container">
                        ${isHtmlExperience 
                            ? `<iframe class="wonderland-experience-iframe" src="${entry.url}" style="width:100%; height:100%; border:none; background:#000;"></iframe>`
                            : `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-family:monospace; opacity:0.3;">INITIALIZING_MEDIA...</div>`
                        }
                    </div>
                    <div class="wonderland-guid-container"></div>
                </div>

                <div class="wonderland-right-col">
                    <div class="wonderland-description-box">
                        <h2 class="wonderland-section-title description-label">${config.labels.description}</h2>
                        <div class="wonderland-description-text wonderland-desc-text">Syncing data streams...</div>
                    </div>
                    <div class="wonderland-hashtags"></div>
                </div>
            </div>

            <!-- Sliding Log Panel -->
            <div class="wonderland-log-panel">
                <div class="wonderland-log-header">
                    <span class="terminal-label">${config.labels.terminal}</span>
                    <button style="background:none; border:none; color:#fff; cursor:pointer;" class="wonderland-log-close">X</button>
                </div>
                <div class="wonderland-log-timeline"></div>
                <div class="wonderland-log-content markdown-body-terminal-bw wonderland-log-display">
                    <div style="padding:20px; opacity:0.5; font-family:monospace;">STREAMS_IDLE...</div>
                </div>
            </div>
        </main>
    `;

    // Open Window Immediately
    openWindowFn({
        title: `${entry.name} - Dev Journal`,
        content: container,
        width: 1100,
        height: 750,
        x: 50,
        y: 50
    });

    // Lazy load everything else
    async function loadResources() {
        let tagContent = '';
        let logs = [];

        // Task 1: Load Config (sources.js)
        try {
            const configModule = await import(`./${basePath}sources.js`);
            if (configModule && configModule.default) {
                const newLabels = { ...config.labels, ...(configModule.default.labels || {}) };
                config = { ...config, ...configModule.default, labels: newLabels };
            }
        } catch (e) {}

        // Task 2: Fetch TAG.txt
        try {
            const res = await fetch(`${basePath}TAG.txt`);
            if (res.ok) tagContent = await res.text();
        } catch (e) {}

        // Task 3: Fetch updates.md
        try {
            const res = await fetch(entry.updatesUrl || `${basePath}updates.md`);
            if (res.ok) {
                const md = await res.text();
                const sections = md.split(/\n---\n/).map(s => s.trim()).filter(s => s.length > 0);
                for (let i = 0; i < sections.length; i += 2) {
                    const metaRaw = sections[i];
                    const contentRaw = sections[i + 1] || '';
                    const meta = {};
                    metaRaw.split('\n').forEach(line => {
                        const [key, ...valParts] = line.split(':');
                        if (key && valParts.length > 0) meta[key.trim().toLowerCase()] = valParts.join(':').trim();
                    });
                    logs.push({ meta, content: contentRaw });
                }
            }
        } catch (e) {}

        // Now Update DOM
        const avatarEl = container.querySelector('.wonderland-rank-avatar');
        const journalLabel = container.querySelector('.journal-label');
        const terminalLabel = container.querySelector('.terminal-label');
        const descriptionLabel = container.querySelector('.description-label');
        const logToggleLabel = container.querySelector('.wonderland-log-toggle');
        const versionBadge = container.querySelector('.wonderland-version-badge');
        const guidContainer = container.querySelector('.wonderland-guid-container');
        const descText = container.querySelector('.wonderland-desc-text');
        const hashtagsEl = container.querySelector('.wonderland-hashtags');
        const wipBanner = container.querySelector('.wonderland-wip-banner');
        const stageContainer = container.querySelector('.wonderland-stage-container');
        const logTimeline = container.querySelector('.wonderland-log-timeline');
        const logDisplay = container.querySelector('.wonderland-log-display');

        // Apply config
        avatarEl.style.backgroundColor = config.avatarColor;
        if (config.avatar) avatarEl.style.backgroundImage = `url(${config.avatar.startsWith('http') ? config.avatar : basePath + config.avatar})`;
        journalLabel.textContent = config.labels.journal;
        terminalLabel.textContent = config.labels.terminal;
        descriptionLabel.textContent = config.labels.description;
        logToggleLabel.firstChild.textContent = `${config.labels.logs} `; // Keep the span
        versionBadge.style.backgroundColor = config.themeColor;
        versionBadge.textContent = config.version;

        // Parse TAG.txt
        const guids = {};
        const hashtags = [];
        if (tagContent) {
            tagContent.split('\n').forEach(line => {
                if (line.includes(':')) {
                    const [key, value] = line.split(':').map(s => s.trim());
                    if (value) guids[key] = value;
                }
                const m = line.match(/#\w+/g);
                if (m) m.forEach(h => { if (!hashtags.includes(h)) hashtags.push(h); });
            });
        }

        // Render GUIDs
        if (Object.keys(guids).length > 0) {
            guidContainer.innerHTML = `
                <div class="wonderland-section-title" style="margin-top: 20px;">${config.labels.guid}</div>
                <div class="wonderland-tag-section">
                    ${Object.entries(guids).map(([key, val]) => `
                        <div class="wonderland-tag-item" style="cursor: pointer;" onclick="navigator.clipboard.writeText('${val}'); alert('Copied ${key} TAG: ${val}')">
                            <span style="opacity: 0.5;">${key}</span>
                            <span style="color: #4ecca3;">${val}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Description
        let description = tagContent
            ? tagContent.replace(/EU:.*\n?|ASIA:.*\n?|America:.*\n?|TW HK KO:.*\n?|CN:.*\n?/g, '').replace(/#\w+/g, '').replace(/_{5,}/g, '').trim()
            : entry.description || 'A new wonderland is being forged...';
        descText.innerHTML = marked.parse(description);

        // Hashtags
        hashtagsEl.innerHTML = hashtags.map(h => `<span class="wonderland-hashtag">${h}</span>`).join('');

        // Helper to render video slide
        function renderVideoSlide(vId, isActive) {
            let finalId = vId;
            if (vId.includes('youtube.com') || vId.includes('youtu.be')) {
                const shortsMatch = vId.match(/youtube\.com\/shorts\/([^/?#&]+)/);
                const watchMatch = vId.match(/[?&]v=([^/?#&]+)/);
                const embedMatch = vId.match(/youtube\.com\/embed\/([^/?#&]+)/);
                const shortUrlMatch = vId.match(/youtu\.be\/([^/?#&]+)/);
                finalId = shortsMatch?.[1] || watchMatch?.[1] || embedMatch?.[1] || shortUrlMatch?.[1] || vId;
            }
            return `<div class="wonderland-video-slide ${isActive ? 'active' : ''}"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${finalId}" frameborder="0" allowfullscreen></iframe></div>`;
        }

        // Carousel State & Logic
        let carouselTimer = null;
        let currentSlideIndex = 0;
        function updateCarousel(index) {
            if (isHtmlExperience) return;
            const log = logs[index];
            if (!log || !log.meta.media) {
                stageContainer.innerHTML = `<img src="${entry.icon || 'icons/endless_canvas_icon.png'}" class="active" alt="Wonderland Cover">`;
                return;
            }
            const media = log.meta.media.split(',').map(s => s.trim());
            let html = media.map((src, i) => {
                if (config.videos && config.videos[src]) return renderVideoSlide(config.videos[src], i === 0);
                if (config.images && config.images[src]) {
                    const imgUrl = config.images[src];
                    return `<img src="${imgUrl.startsWith('http') ? imgUrl : `${basePath}${imgUrl.split('/').pop()}`}" class="${i === 0 ? 'active' : ''}" alt="Version Media">`;
                }
                if (src === 'TRAILER') return renderVideoSlide(config.trailerId || "YERFXEsvH_k", i === 0);
                if (src.includes('youtube.com') || src.includes('youtu.be') || (src.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(src))) return renderVideoSlide(src, i === 0);
                return `<img src="${src.startsWith('http') ? src : `${basePath}${src.split('/').pop()}`}" class="${i === 0 ? 'active' : ''}" alt="Version Media">`;
            }).join('');
            html += `<button class="wonderland-carousel-arrow wonderland-carousel-arrow-left" id="wonderland-prev">❮</button><button class="wonderland-carousel-arrow wonderland-carousel-arrow-right" id="wonderland-next">❯</button><div class="wonderland-carousel-nav">${media.map((_, i) => `<div class="wonderland-carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('')}</div>`;
            stageContainer.innerHTML = html;
            const slides = stageContainer.querySelectorAll('img, .wonderland-video-slide');
            const dots = stageContainer.querySelectorAll('.wonderland-carousel-dot');
            function showSlide(idx) {
                currentSlideIndex = (idx + slides.length) % slides.length;
                slides.forEach((s, i) => s.classList.toggle('active', i === currentSlideIndex));
                dots.forEach((d, i) => d.classList.toggle('active', i === currentSlideIndex));
                resetTimer();
            }
            function resetTimer() {
                if (carouselTimer) clearInterval(carouselTimer);
                const cur = slides[currentSlideIndex];
                if (cur && cur.classList.contains('wonderland-video-slide')) return;
                carouselTimer = setInterval(() => showSlide(currentSlideIndex + 1), 5000);
            }
            dots.forEach(dot => dot.onclick = (e) => { e.stopPropagation(); showSlide(parseInt(dot.dataset.index)); });
            stageContainer.querySelector('#wonderland-prev').onclick = (e) => { e.stopPropagation(); showSlide(currentSlideIndex - 1); };
            stageContainer.querySelector('#wonderland-next').onclick = (e) => { e.stopPropagation(); showSlide(currentSlideIndex + 1); };
            resetTimer();
        }

        // Typing State & Logic
        let currentLogIndex = -1;
        let isTyping = false;
        async function typeLog(html) {
            isTyping = true;
            logDisplay.innerHTML = '';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const nodes = Array.from(tempDiv.childNodes);
            for (const node of nodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    const span = document.createElement('span');
                    logDisplay.appendChild(span);
                    for (let i = 0; i < text.length; i++) {
                        span.textContent += text[i];
                        logDisplay.scrollTop = logDisplay.scrollHeight;
                        await new Promise(r => setTimeout(r, 5));
                    }
                } else {
                    logDisplay.appendChild(node.cloneNode(true));
                    logDisplay.scrollTop = logDisplay.scrollHeight;
                    await new Promise(r => setTimeout(r, 30));
                }
            }
            const isLast = currentLogIndex === logs.length - 1;
            const p = document.createElement('div');
            p.className = 'terminal-prompt';
            p.textContent = isLast ? '--- END OF LOG ---' : '--- PRESS ANY KEY TO CONTINUE ---';
            logDisplay.appendChild(p);
            logDisplay.scrollTop = logDisplay.scrollHeight;
            isTyping = false;
        }

        async function selectLog(index) {
            if (index === currentLogIndex || isTyping) return;
            currentLogIndex = index;
            Array.from(logTimeline.children).forEach((node, i) => node.classList.toggle('active', i === index));
            const log = logs[index];
            container.style.backgroundColor = log.meta.bg_color || '';
            const status = (log.meta.status || "").toLowerCase();
            const showWip = log.meta.show_wip !== undefined ? log.meta.show_wip === 'true' : config.wipStatuses.includes(status);
            if (showWip) {
                const wipText = log.meta.wip_text || config.labels.wip || "WORK IN PROGRESS";
                wipBanner.setAttribute('data-content', `---------------- ${wipText} `.repeat(10));
                wipBanner.style.display = 'block';
            } else wipBanner.style.display = 'none';

            let mdContent = log.content;
            const videoMatch = mdContent.match(/\[video: (.*)\]/);
            let youtubeId = null;
            let isShort = false;
            if (videoMatch) {
                const vi = videoMatch[1].trim();
                const v_shorts = vi.match(/youtube\.com\/shorts\/([^/?#&]+)/);
                const v_watch = vi.match(/[?&]v=([^/?#&]+)/);
                const v_embed = vi.match(/youtube\.com\/embed\/([^/?#&]+)/);
                const v_link = vi.match(/youtu\.be\/([^/?#&]+)/);
                if (v_shorts) { isShort = true; youtubeId = v_shorts[1]; }
                else if (v_watch) youtubeId = v_watch[1];
                else if (v_embed) youtubeId = v_embed[1];
                else if (v_link) youtubeId = v_link[1];
                else youtubeId = vi;
                mdContent = mdContent.replace(/\[video: .*\]/g, '').trim();
            }
            let logHtml = marked.parse(mdContent);
            if (youtubeId) {
                const containerStyle = isShort ? "margin: 20px auto; border: 1px solid #fff; max-width: 280px; aspect-ratio: 9/16;" : "margin: 20px 0; border: 1px solid #fff; aspect-ratio: 16/9;";
                logHtml += `<div class="video-container" style="${containerStyle}"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${youtubeId}" frameborder="0" allowfullscreen></iframe></div>`;
            }
            versionBadge.textContent = log.meta.version || `v1.0.${index + 1}`;
            descText.innerHTML = marked.parse(log.meta.description || description);
            updateCarousel(index);
            typeLog(logHtml);
        }

        // Populate Logs Sidebar
        logs.forEach((_, i) => {
            const node = document.createElement('div');
            node.className = 'wonderland-timeline-node';
            node.textContent = i + 1;
            node.onclick = () => selectLog(i);
            logTimeline.appendChild(node);
        });

        // Toggle logic
        const toggleBtn = container.querySelector('.wonderland-log-toggle');
        const closeBtn = container.querySelector('.wonderland-log-close');
        const panel = container.querySelector('.wonderland-log-panel');
        toggleBtn.onclick = () => panel.classList.toggle('open');
        closeBtn.onclick = () => panel.classList.remove('open');

        // Key Progression
        const handleKeys = (e) => {
            if (!document.contains(container)) { window.removeEventListener('keydown', handleKeys); return; }
            const winEl = container.closest('.window');
            if (winEl) {
                const windows = Array.from(document.querySelectorAll('.window'));
                const topWin = windows.sort((a, b) => parseInt(b.style.zIndex || 0) - parseInt(a.style.zIndex || 0))[0];
                if (winEl !== topWin) return;
            }
            if (panel.classList.contains('open') && !isTyping && currentLogIndex < logs.length - 1) selectLog(currentLogIndex + 1);
        };
        window.addEventListener('keydown', handleKeys);

        if (logs.length > 0) selectLog(logs.length - 1);
        else updateCarousel(-1);
    }

    // Begin background load
    loadResources();
}
