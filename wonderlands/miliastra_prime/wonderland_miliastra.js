export async function openMiliastraPrimeWindow(entry, openWindowFn) {
    const container = document.createElement('div');
    container.className = 'miliastra-window';

    // Load CSS
    if (!document.getElementById('miliastra-css')) {
        const link = document.createElement('link');
        link.id = 'miliastra-css';
        link.rel = 'stylesheet';
        link.href = './wonderlands/miliastra_prime/wonderland_miliastra.css';
        document.head.appendChild(link);
    }

    // Fetch TAG.txt
    let tagContent = '';
    try {
        const res = await fetch('./wonderlands/miliastra_prime/TAG.txt');
        if (res.ok) {
            tagContent = await res.text();
        }
    } catch (e) {
        console.error("Failed to fetch TAG.txt", e);
    }

    // Fetch updates.md (Logs)
    let logs = [];
    try {
        const res = await fetch(entry.updatesUrl);
        if (res.ok) {
            const md = await res.text();
            // Split by --- but only if it's on its own line and followed by metadata or content
            const sections = md.split(/\n---\n/).map(s => s.trim()).filter(s => s.length > 0);
            
            // Each section is [Metadata, Content]
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

    // Clean description
    let description = tagContent
        .replace(/EU:.*\n?|ASIA:.*\n?|America:.*\n?|TW HK KO:.*\n?/g, '')
        .replace(/#\w+/g, '')
        .replace(/_{5,}/g, '')
        .trim();

    container.innerHTML = `
        <div style="display: flex; height: 100%; overflow: hidden;">
            <main class="miliastra-main">
                <header class="miliastra-header">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="miliastra-rank-avatar" style="width: 48px; height: 48px; background: #673ab7;"></div>
                        <div>
                            <h1 class="miliastra-title">Guns Brooms Rockets</h1>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.5; margin-top: 4px;">
                                <span>QDG_jamal3</span>
                                <span>•</span>
                                <span id="miliastra-version-label">DEV_JOURNAL</span>
                                <span id="miliastra-version-badge" style="background: #e91e63; color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">v1.0.4</span>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="miliastra-btn miliastra-btn-create" id="miliastra-log-toggle">DEV_LOGS</button>
                    </div>
                </header>

                <div class="miliastra-content-grid">
                    <div class="miliastra-left-col">
                        <div class="miliastra-carousel" id="miliastra-carousel-container">
                            <!-- Images/Video AND Dots injected here -->
                        </div>

                        <div class="miliastra-section-title" style="margin-top: 20px;">Stage GUID (Click to Copy)</div>
                        <div class="miliastra-tag-section">
                            ${Object.entries(guids).map(([key, val]) => `
                                <div class="miliastra-tag-item" style="cursor: pointer;" onclick="navigator.clipboard.writeText('${val}'); alert('Copied ${key} TAG: ${val}')">
                                    <span class="miliastra-tag-label">${key}</span>
                                    <span class="miliastra-tag-value">${val}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="miliastra-right-col">
                        <div class="miliastra-description-box">
                            <h2 class="miliastra-section-title">Wonderland Description</h2>
                            <div class="miliastra-description-text" id="miliastra-desc-text">${description}</div>
                        </div>

                        <div class="miliastra-hashtags">
                            ${hashtags.map(h => `<span class="miliastra-hashtag">${h}</span>`).join('')}
                        </div>
                    </div>
                </div>

                <!-- Sliding Log Panel -->
                <div class="miliastra-log-panel" id="miliastra-log-panel">
                    <div class="miliastra-log-header">
                        <span>[ TERMINAL_LOGS ]</span>
                        <button style="background:none; border:none; color:#fff; cursor:pointer;" id="miliastra-log-close">X</button>
                    </div>
                    <div class="miliastra-log-timeline" id="miliastra-log-timeline">
                        <!-- Nodes generated here -->
                    </div>
                    <div class="miliastra-log-content markdown-body-terminal-bw" id="miliastra-log-display">
                        <!-- Content typed here -->
                    </div>
                </div>
            </main>
        </div>
    `;

    // State
    let currentLogIndex = -1;
    let isTyping = false;

    // Elements
    const logPanel = container.querySelector('#miliastra-log-panel');
    const logToggle = container.querySelector('#miliastra-log-toggle');
    const logClose = container.querySelector('#miliastra-log-close');
    const logTimeline = container.querySelector('#miliastra-log-timeline');
    const logDisplay = container.querySelector('#miliastra-log-display');
    const descText = container.querySelector('#miliastra-desc-text');
    const versionLabel = container.querySelector('#miliastra-version-label');
    const versionBadge = container.querySelector('#miliastra-version-badge');
    const carouselContainer = container.querySelector('#miliastra-carousel-container');

    // Carousel state
    let carouselTimer = null;
    let currentSlideIndex = 0;

    function updateCarousel(index) {
        const log = logs[index];
        if (!log || !log.meta.media) return;

        const media = log.meta.media.split(',').map(s => s.trim());
        let html = media.map((src, i) => {
            if (src === 'TRAILER') {
                return `<div class="miliastra-video-slide ${i === 0 ? 'active' : ''}">
                    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/YERFXEsvH_k" frameborder="0" allowfullscreen></iframe>
                </div>`;
            }
            return `<img src="${src}" class="${i === 0 ? 'active' : ''}" alt="Version Media">`;
        }).join('');

        // Add arrows
        html += `
            <button class="miliastra-carousel-arrow miliastra-carousel-arrow-left" id="miliastra-prev">❮</button>
            <button class="miliastra-carousel-arrow miliastra-carousel-arrow-right" id="miliastra-next">❯</button>
        `;

        // Add dots inside carousel
        html += `<div class="miliastra-carousel-nav">
            ${media.map((_, i) => `<div class="miliastra-carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('')}
        </div>`;

        carouselContainer.innerHTML = html;

        const slides = carouselContainer.querySelectorAll('img, .miliastra-video-slide');
        const dots = carouselContainer.querySelectorAll('.miliastra-carousel-dot');
        const prevBtn = carouselContainer.querySelector('#miliastra-prev');
        const nextBtn = carouselContainer.querySelector('#miliastra-next');
        
        currentSlideIndex = 0;

        function showSlide(idx) {
            currentSlideIndex = (idx + slides.length) % slides.length;
            slides.forEach((s, i) => s.classList.toggle('active', i === currentSlideIndex));
            dots.forEach((d, i) => d.classList.toggle('active', i === currentSlideIndex));
            resetTimer();
        }

        function resetTimer() {
            if (carouselTimer) clearInterval(carouselTimer);
            carouselTimer = setInterval(() => {
                showSlide(currentSlideIndex + 1);
            }, 5000);
        }

        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                showSlide(parseInt(dot.dataset.index));
            });
        });

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSlide(currentSlideIndex - 1);
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSlide(currentSlideIndex + 1);
        });

        resetTimer();
    }

    // Log Logic
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

        // Update timeline nodes
        Array.from(logTimeline.children).forEach((node, i) => {
            node.classList.toggle('active', i === index);
        });

        const { marked } = await import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js');
        const log = logs[index];
        const logHtml = marked.parse(log.content);
        
        // Update main page content based on version metadata
        versionLabel.textContent = log.meta.status || 'UNKNOWN';
        versionBadge.textContent = log.meta.version || `v1.0.${index + 1}`;
        
        // Apply WIP/Released state
        container.classList.remove('state-wip', 'state-released');
        if (index < logs.length - 1) {
            container.classList.add('state-wip');
        } else {
            container.classList.add('state-released');
        }

        // Description from metadata
        descText.textContent = log.meta.description || '';

        // Update carousel media
        updateCarousel(index);

        typeLog(logHtml);
    }

    // Generate timeline nodes
    logs.forEach((_, i) => {
        const node = document.createElement('div');
        node.className = 'miliastra-timeline-node';
        node.textContent = i + 1;
        node.onclick = () => selectLog(i);
        logTimeline.appendChild(node);
    });

    logToggle.onclick = () => logPanel.classList.toggle('open');
    logClose.onclick = () => logPanel.classList.remove('open');

    // Initial log selection
    if (logs.length > 0) selectLog(logs.length - 1);

    const windowId = openWindowFn({
        title: `Guns Brooms Rockets - Dev Journal`,
        content: container,
        width: 1100,
        height: 750,
        x: 50,
        y: 50
    });

    return windowId;
}
