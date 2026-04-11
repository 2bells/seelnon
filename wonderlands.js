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
                if (value && /^\d+$/.test(value)) {
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
            .replace(/EU:.*\n?|ASIA:.*\n?|America:.*\n?|TW HK KO:.*\n?/g, '')
            .replace(/#\w+/g, '')
            .replace(/_{5,}/g, '')
            .trim()
        : entry.description || 'A new wonderland is being forged...';

    const isHtmlExperience = entry.url.toLowerCase().endsWith('.html');

    container.innerHTML = `
        <main class="wonderland-main">
            <header class="wonderland-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="wonderland-rank-avatar"></div>
                    <div>
                        <h1 class="wonderland-title">${entry.name}</h1>
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.5; margin-top: 4px;">
                            <span>DEV_JOURNAL</span>
                            <span id="wonderland-version-badge" style="background: #e91e63; color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">v1.0.0</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    ${isHtmlExperience ? `<button class="wonderland-btn" id="wonderland-refresh-experience" title="Reload Experience">⟳</button>` : ''}
                    <button class="wonderland-btn" id="wonderland-log-toggle">DEV_LOGS</button>
                </div>
            </header>

            <div class="wonderland-content-grid">
                <div class="wonderland-left-col">
                    <div class="wonderland-carousel" id="wonderland-stage-container">
                        ${isHtmlExperience 
                            ? `<iframe id="wonderland-experience-iframe" src="${entry.url}" style="width:100%; height:100%; border:none; background:#000;"></iframe>`
                            : `<!-- Carousel injected here -->`
                        }
                    </div>

                    ${Object.keys(guids).length > 0 ? `
                        <div class="wonderland-section-title" style="margin-top: 20px;">Stage GUID (Click to Copy)</div>
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
                        <h2 class="wonderland-section-title">Wonderland Description</h2>
                        <div class="wonderland-description-text" id="wonderland-desc-text">${description}</div>
                    </div>

                    <div class="wonderland-hashtags">
                        ${hashtags.map(h => `<span class="wonderland-hashtag">${h}</span>`).join('')}
                    </div>
                </div>
            </div>

            <!-- Sliding Log Panel -->
            <div class="wonderland-log-panel" id="wonderland-log-panel">
                <div class="wonderland-log-header">
                    <span>[ TERMINAL_LOGS ]</span>
                    <button style="background:none; border:none; color:#fff; cursor:pointer;" id="wonderland-log-close">X</button>
                </div>
                <div class="wonderland-log-timeline" id="wonderland-log-timeline">
                    <!-- Nodes generated here -->
                </div>
                <div class="wonderland-log-content markdown-body-terminal-bw" id="wonderland-log-display">
                    <!-- Content typed here -->
                </div>
            </div>
        </main>
    `;

    // State
    let currentLogIndex = -1;
    let isTyping = false;

    // Elements
    const logPanel = container.querySelector('#wonderland-log-panel');
    const logToggle = container.querySelector('#wonderland-log-toggle');
    const logClose = container.querySelector('#wonderland-log-close');
    const logTimeline = container.querySelector('#wonderland-log-timeline');
    const logDisplay = container.querySelector('#wonderland-log-display');
    const descText = container.querySelector('#wonderland-desc-text');
    const versionBadge = container.querySelector('#wonderland-version-badge');
    const stageContainer = container.querySelector('#wonderland-stage-container');
    const refreshBtn = container.querySelector('#wonderland-refresh-experience');

    if (refreshBtn) {
        refreshBtn.onclick = () => {
            const iframe = container.querySelector('#wonderland-experience-iframe');
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
            if (src === 'TRAILER') {
                return `<div class="wonderland-video-slide ${i === 0 ? 'active' : ''}">
                    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/YERFXEsvH_k" frameborder="0" allowfullscreen></iframe>
                </div>`;
            }
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
        isTyping = false;
    }

    async function selectLog(index) {
        if (index === currentLogIndex || isTyping) return;
        currentLogIndex = index;

        Array.from(logTimeline.children).forEach((node, i) => node.classList.toggle('active', i === index));

        const log = logs[index];
        
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
        descText.textContent = log.meta.description || description;
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
