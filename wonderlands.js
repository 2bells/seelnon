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
    const uniqueId = Math.random().toString(36).substring(2, 9);    

    // Load per-wonderland config (sources.js)
    let config = {
        trailerId: "",
        videos: {}, // NEW: Support for multiple named videos
        images: {}, // NEW: Support for multiple named images
        avatar: "", // NEW: Support for avatar image
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

    try {
        // Use a relative path prefix for Vite and deep merge labels
        const configModule = await import(`./${basePath}sources.js`);
        if (configModule && configModule.default) {
            const newLabels = { ...config.labels, ...(configModule.default.labels || {}) };
            config = { ...config, ...configModule.default, labels: newLabels };
        }
    } catch (e) {
        console.warn(`[Wonderlands] No sources.js found for ${entry.name} at ./${basePath}sources.js, using defaults.`, e);
    }

    // Helper to render video slide
    function renderVideoSlide(vId, isActive) {
        // Extract ID if full URL is provided
        let finalId = vId;
        if (vId.includes('youtube.com') || vId.includes('youtu.be')) {
            const shortsMatch = vId.match(/youtube\.com\/shorts\/([^/?#&]+)/);
            const watchMatch = vId.match(/[?&]v=([^/?#&]+)/);
            const embedMatch = vId.match(/youtube\.com\/embed\/([^/?#&]+)/);
            const shortUrlMatch = vId.match(/youtu\.be\/([^/?#&]+)/);
            finalId = shortsMatch?.[1] || watchMatch?.[1] || embedMatch?.[1] || shortUrlMatch?.[1] || vId;
        }

        return `<div class="wonderland-video-slide ${isActive ? 'active' : ''}">
            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${finalId}" frameborder="0" allowfullscreen></iframe>
        </div>`;
    }

    // Fetch TAG.txt
    let tagContent = '';
    try {
        const res = await fetch(`${basePath}TAG.txt`);
        if (res.ok) {
            tagContent = await res.text();
        }
    } catch (e) {
        console.warn("No TAG.txt found for this wonderland", e);
    }

    // Fetch updates.md (Logs)
    let logs = [];
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
                    if (key && valParts.length > 0) {
                        meta[key.trim().toLowerCase()] = valParts.join(':').trim();
                    }
                });
                
                logs.push({
                    meta,
                    content: contentRaw
                });
            }
        }
    } catch (e) {
        console.error("Failed to fetch logs", e);
    }

    // Parse TAG.txt for GUIDs and Hashtags
    const guids = {};
    const hashtags = [];
    if (tagContent) {
        const tagLines = tagContent.split('\n');
        tagLines.forEach(line => {
            if (line.includes(':')) {
                const [key, value] = line.split(':').map(s => s.trim());
                if (value) {
                    guids[key] = value;
                }
            }
            const hashMatches = line.match(/#\w+/g);
            if (hashMatches) {
                hashMatches.forEach(h => {
                    if (!hashtags.includes(h)) hashtags.push(h);
                });
            }
        });
    }

    // Clean description
    let description = tagContent
        ? tagContent
            .replace(/EU:.*\n?|ASIA:.*\n?|America:.*\n?|TW HK KO:.*\n?|CN:.*\n?/g, '')
            .replace(/#\w+/g, '')
            .replace(/_{5,}/g, '')
            .trim()
        : entry.description || 'A new wonderland is being forged...';

    const isHtmlExperience = entry.url.toLowerCase().endsWith('.html');

    container.innerHTML = `
        <main class="wonderland-main">
            <header class="wonderland-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="wonderland-rank-avatar" style="background-color: ${config.avatarColor}; ${config.avatar ? `background-image: url(${config.avatar.startsWith('http') ? config.avatar : basePath + config.avatar});` : ''}"></div>
                    <div>
                        <h1 class="wonderland-title">${entry.name}</h1>
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.5; margin-top: 4px;">
                            <span>${config.labels.journal}</span>
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
                            : `<!-- Carousel injected here -->`
                        }
                    </div>

                    ${Object.keys(guids).length > 0 ? `
                        <div class="wonderland-section-title" style="margin-top: 20px;">${config.labels.guid}</div>
                        <div class="wonderland-tag-section">
                            ${Object.entries(guids).map(([key, val]) => `
                                <div class="wonderland-tag-item" style="cursor: pointer;" onclick="navigator.clipboard.writeText('${val}'); alert('Copied ${key} TAG: ${val}')">
                                    <span style="opacity: 0.5;">${key}</span>
                                    <span style="color: #4ecca3;">${val}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="wonderland-right-col">
                    <div class="wonderland-description-box">
                        <h2 class="wonderland-section-title">${config.labels.description}</h2>
                        <div class="wonderland-description-text wonderland-desc-text">${marked.parse(description)}</div>
                    </div>

                    <div class="wonderland-hashtags">
                        ${hashtags.map(h => `<span class="wonderland-hashtag">${h}</span>`).join('')}
                    </div>
                </div>
            </div>

            <!-- Sliding Log Panel -->
            <div class="wonderland-log-panel">
                <div class="wonderland-log-header">
                    <span>${config.labels.terminal}</span>
                    <button style="background:none; border:none; color:#fff; cursor:pointer;" class="wonderland-log-close">X</button>
                </div>
                <div class="wonderland-log-timeline">
                    <!-- Nodes generated here -->
                </div>
                <div class="wonderland-log-content markdown-body-terminal-bw wonderland-log-display">
                    <!-- Content typed here -->
                </div>
            </div>
        </main>
    `;

    // State
    let currentLogIndex = -1;
    let isTyping = false;

   // Elements
    const logPanel = container.querySelector('.wonderland-log-panel');
    const logToggle = container.querySelector('.wonderland-log-toggle');
    const logClose = container.querySelector('.wonderland-log-close');
    const logTimeline = container.querySelector('.wonderland-log-timeline');
    const logDisplay = container.querySelector('.wonderland-log-display');
    const descText = container.querySelector('.wonderland-desc-text');
    const versionBadge = container.querySelector('.wonderland-version-badge');
    const stageContainer = container.querySelector('.wonderland-stage-container');
    const refreshBtn = container.querySelector('.wonderland-refresh-experience');

    if (refreshBtn) {
        refreshBtn.onclick = () => {
            const iframe = container.querySelector('.wonderland-experience-iframe');
            if (iframe) iframe.src = iframe.src;
        };
    }

    // Carousel state
    let carouselTimer = null;
    let currentSlideIndex = 0;

    function updateCarousel(index) {
        if (isHtmlExperience) return; // Don't update carousel if in HTML mode

        const log = logs[index];
        if (!log || !log.meta.media) {
            stageContainer.innerHTML = `<img src="${entry.icon || 'icons/endless_canvas_icon.png'}" class="active" alt="Wonderland Cover">`;
            return;
        }

        const media = log.meta.media.split(',').map(s => s.trim());
        let html = media.map((src, i) => {
            // 1. Check if it's a named video in config.videos
            if (config.videos && config.videos[src]) {
                return renderVideoSlide(config.videos[src], i === 0);
            }

            // 2. Check if it's a named image in config.images
            if (config.images && config.images[src]) {
                const imgUrl = config.images[src];
                const fullImgSrc = imgUrl.startsWith('http') ? imgUrl : `${basePath}${imgUrl.split('/').pop()}`;
                return `<img src="${fullImgSrc}" class="${i === 0 ? 'active' : ''}" alt="Version Media">`;
            }

            // 3. Legacy support for 'TRAILER' keyword
            if (src === 'TRAILER') {
                const tId = config.trailerId || "YERFXEsvH_k";
                return renderVideoSlide(tId, i === 0);
            }

            // 4. Check if it's a direct YouTube link or ID
            const isYouTube = src.includes('youtube.com') || src.includes('youtu.be') || (src.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(src));
            if (isYouTube) {
                return renderVideoSlide(src, i === 0);
            }

            // 5. Otherwise assume it's an image
            const fullSrc = src.startsWith('http') ? src : `${basePath}${src.split('/').pop()}`;
            return `<img src="${fullSrc}" class="${i === 0 ? 'active' : ''}" alt="Version Media">`;
        }).join('');

        html += `
            <button class="wonderland-carousel-arrow wonderland-carousel-arrow-left" id="wonderland-prev">❮</button>
            <button class="wonderland-carousel-arrow wonderland-carousel-arrow-right" id="wonderland-next">❯</button>
            <div class="wonderland-carousel-nav">
                ${media.map((_, i) => `<div class="wonderland-carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('')}
            </div>
        `;

        stageContainer.innerHTML = html;

        const slides = stageContainer.querySelectorAll('img, .wonderland-video-slide');
        const dots = stageContainer.querySelectorAll('.wonderland-carousel-dot');
        const prevBtn = stageContainer.querySelector('#wonderland-prev');
        const nextBtn = stageContainer.querySelector('#wonderland-next');
        
        currentSlideIndex = 0;

        function showSlide(idx) {
            currentSlideIndex = (idx + slides.length) % slides.length;
            slides.forEach((s, i) => s.classList.toggle('active', i === currentSlideIndex));
            dots.forEach((d, i) => d.classList.toggle('active', i === currentSlideIndex));
            resetTimer();
        }

        function resetTimer() {
            if (carouselTimer) clearInterval(carouselTimer);
            
            // NEW: Prevent autoscroll if current slide is a video
            const currentSlide = slides[currentSlideIndex];
            if (currentSlide && currentSlide.classList.contains('wonderland-video-slide')) {
                return; 
            }

            carouselTimer = setInterval(() => showSlide(currentSlideIndex + 1), 5000);
        }

        dots.forEach(dot => dot.onclick = (e) => { e.stopPropagation(); showSlide(parseInt(dot.dataset.index)); });
        prevBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentSlideIndex - 1); };
        nextBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentSlideIndex + 1); };

        resetTimer();
    }

    async function typeLog(html) {
        isTyping = true;
        logDisplay.innerHTML = '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const nodes = Array.from(tempDiv.childNodes);
        
        for (const node of nodes) {
            const clone = node.cloneNode(true);
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
                logDisplay.appendChild(clone);
                logDisplay.scrollTop = logDisplay.scrollHeight;
                await new Promise(r => setTimeout(r, 30));
            }
        }
        
        // NEW: Add terminal prompt
        const isLast = currentLogIndex === logs.length - 1;
        const prompt = document.createElement('div');
        prompt.className = 'terminal-prompt';
        prompt.textContent = isLast ? '--- END OF LOG ---' : '--- PRESS ANY KEY TO CONTINUE ---';
        logDisplay.appendChild(prompt);
        logDisplay.scrollTop = logDisplay.scrollHeight;
        
        isTyping = false;
    }

    async function selectLog(index) {
        if (index === currentLogIndex || isTyping) return;
        currentLogIndex = index;

        Array.from(logTimeline.children).forEach((node, i) => node.classList.toggle('active', i === index));

        const log = logs[index];
        
        // NEW: Dynamic Background Color
        if (log.meta.bg_color) {
            container.style.backgroundColor = log.meta.bg_color;
        } else {
            container.style.backgroundColor = ''; // Reset to default
        }

        // NEW: WIP Banner visibility and text control
        const wipBanner = container.querySelector('.wonderland-wip-banner');
        const status = (log.meta.status || "").toLowerCase();
        const wipOverride = log.meta.wip_text;
        const showWip = log.meta.show_wip !== undefined ? log.meta.show_wip === 'true' : config.wipStatuses.includes(status);

        if (showWip) {
            const wipText = wipOverride || config.labels.wip || "WORK IN PROGRESS";
            const pattern = `---------------- ${wipText} `;
            wipBanner.setAttribute('data-content', pattern.repeat(10));
            wipBanner.style.display = 'block';
        } else {
            wipBanner.style.display = 'none';
        }
        
        // Handle video tags in logs
        let mdContent = log.content;
        const videoMatch = mdContent.match(/\[video: (.*)\]/);
        let youtubeId = null;
        let isShort = false;
        
        if (videoMatch) {
            const videoInput = videoMatch[1].trim();
            const shortsMatch = videoInput.match(/youtube\.com\/shorts\/([^/?#&]+)/);
            const watchMatch = videoInput.match(/[?&]v=([^/?#&]+)/);
            const embedMatch = videoInput.match(/youtube\.com\/embed\/([^/?#&]+)/);
            const shortUrlMatch = videoInput.match(/youtu\.be\/([^/?#&]+)/);

            if (shortsMatch) { isShort = true; youtubeId = shortsMatch[1]; }
            else if (watchMatch) { youtubeId = watchMatch[1]; }
            else if (embedMatch) { youtubeId = embedMatch[1]; }
            else if (shortUrlMatch) { youtubeId = shortUrlMatch[1]; }
            else { youtubeId = videoInput; }
            mdContent = mdContent.replace(/\[video: .*\]/g, '').trim();
        }

        let logHtml = marked.parse(mdContent);
        if (youtubeId) {
            const containerStyle = isShort 
                ? "margin: 20px auto; border: 1px solid #fff; max-width: 280px; aspect-ratio: 9/16;"
                : "margin: 20px 0; border: 1px solid #fff; aspect-ratio: 16/9;";
            logHtml += `<div class="video-container" style="${containerStyle}"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${youtubeId}" frameborder="0" allowfullscreen></iframe></div>`;
        }

        versionBadge.textContent = log.meta.version || `v1.0.${index + 1}`;
        descText.innerHTML = marked.parse(log.meta.description || description);
        updateCarousel(index);
        typeLog(logHtml);
    }

    logs.forEach((_, i) => {
        const node = document.createElement('div');
        node.className = 'wonderland-timeline-node';
        node.textContent = i + 1;
        node.onclick = () => selectLog(i);
        logTimeline.appendChild(node);
    });

    logToggle.onclick = () => logPanel.classList.toggle('open');
    logClose.onclick = () => logPanel.classList.remove('open');

    // NEW: Key progression for logs
    const handleKeyProgression = (e) => {
        if (!document.contains(container)) {
            window.removeEventListener('keydown', handleKeyProgression);
            return;
        }
        // Only progress if this window is the top-most (focused) one
        const winEl = container.closest('.window');
        if (winEl && winEl.style.zIndex !== document.body.dataset.topZ) {
            // We need a way to track top Z, but for now let's just check if it's the last child of desktop
            const desktop = document.getElementById('desktop');
            const windows = Array.from(desktop.querySelectorAll('.window'));
            const topWin = windows.sort((a, b) => parseInt(b.style.zIndex || 0) - parseInt(a.style.zIndex || 0))[0];
            if (winEl !== topWin) return;
        }

        if (logPanel.classList.contains('open') && !isTyping && currentLogIndex < logs.length - 1) {
            selectLog(currentLogIndex + 1);
        }
    };
    window.addEventListener('keydown', handleKeyProgression);

    if (logs.length > 0) selectLog(logs.length - 1);
    else updateCarousel(-1);

    const windowId = openWindowFn({
        title: `${entry.name} - Dev Journal`,
        content: container,
        width: 1100,
        height: 750,
        x: 50,
        y: 50
    });

    return windowId;
}
