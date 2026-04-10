import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

export async function openWonderlandWindow(entry, openWindowFn) {
    const container = document.createElement('div');
    container.className = 'wonderland-container';
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #000;
        color: #fff;
        font-family: 'VT323', 'Courier New', monospace;
        position: relative;
        overflow: hidden;
    `;

    // Main Iframe area
    const iframe = document.createElement('iframe');
    iframe.src = entry.url;
    iframe.style.cssText = `
        flex-grow: 1;
        border: none;
        background: #fff;
        width: 100%;
        height: 100%;
    `;

    // Updates Panel (Terminal style)
    const updatesPanel = document.createElement('div');
    updatesPanel.className = 'wonderland-updates-panel';
    updatesPanel.style.cssText = `
        position: absolute;
        top: 0;
        right: -400px;
        width: 400px;
        height: 100%;
        background: rgba(0, 0, 0, 0.98);
        border-left: 1px solid #fff;
        transition: right 0.4s cubic-bezier(0.19, 1, 0.22, 1);
        display: flex;
        flex-direction: column;
        z-index: 10;
        padding: 0;
        box-sizing: border-box;
        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    `;

    const updatesHeader = document.createElement('div');
    updatesHeader.style.cssText = `
        font-size: 18px;
        padding: 15px 20px;
        border-bottom: 1px solid #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #000;
    `;
    updatesHeader.innerHTML = `<span>[ LOG_VIEWER ]</span><span style="font-size: 12px; opacity: 0.5;">SECURE_LINK_ACTIVE</span>`;
    updatesPanel.appendChild(updatesHeader);

    // Timeline Area
    const timelineContainer = document.createElement('div');
    timelineContainer.style.cssText = `
        padding: 10px 20px;
        display: flex;
        gap: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        background: #000;
        overflow-x: auto;
    `;
    updatesPanel.appendChild(timelineContainer);

    const updatesContent = document.createElement('div');
    updatesContent.className = 'wonderland-updates-content markdown-body-terminal-bw';
    updatesContent.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        font-size: 16px;
        line-height: 1.4;
        padding: 20px;
        scrollbar-width: thin;
        scrollbar-color: #fff #000;
        position: relative;
    `;
    updatesPanel.appendChild(updatesContent);

    const footerPrompt = document.createElement('div');
    footerPrompt.style.cssText = `
        padding: 10px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 14px;
        color: #fff;
        opacity: 0.7;
        background: #000;
        height: 40px;
        display: flex;
        align-items: center;
    `;
    footerPrompt.innerHTML = '<span class="blinking-cursor">_</span>';
    updatesPanel.appendChild(footerPrompt);

    // Toggle Button
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = 'LOGS';
    toggleBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 11;
        background: #000;
        color: #fff;
        border: 1px solid #fff;
        padding: 5px 15px;
        cursor: pointer;
        font-family: 'VT323', monospace;
        font-size: 16px;
        transition: all 0.3s;
    `;
    
    toggleBtn.onmouseover = () => {
        toggleBtn.style.background = '#fff';
        toggleBtn.style.color = '#000';
    };
    toggleBtn.onmouseout = () => {
        toggleBtn.style.background = '#000';
        toggleBtn.style.color = '#fff';
    };

    let panelOpen = false;
    toggleBtn.onclick = () => {
        panelOpen = !panelOpen;
        updatesPanel.style.right = panelOpen ? '0' : '-400px';
        toggleBtn.innerHTML = panelOpen ? 'CLOSE' : 'LOGS';
        if (panelOpen) {
            toggleBtn.style.right = '420px';
        } else {
            toggleBtn.style.right = '20px';
        }
    };

    container.appendChild(iframe);
    container.appendChild(updatesPanel);
    container.appendChild(toggleBtn);

    let logs = [];
    let currentLogIndex = -1;
    let isTyping = false;
    let typingInterval = null;

    async function typeText(html) {
        isTyping = true;
        updatesContent.innerHTML = '';
        footerPrompt.innerHTML = 'TYPING... <span class="blinking-cursor">_</span>';
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const nodes = Array.from(tempDiv.childNodes);
        
        for (const node of nodes) {
            const clone = node.cloneNode(true);
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const span = document.createElement('span');
                updatesContent.appendChild(span);
                for (let i = 0; i < text.length; i++) {
                    span.textContent += text[i];
                    updatesContent.scrollTop = updatesContent.scrollHeight;
                    await new Promise(r => setTimeout(r, 5));
                }
            } else {
                updatesContent.appendChild(clone);
                updatesContent.scrollTop = updatesContent.scrollHeight;
                await new Promise(r => setTimeout(r, 50));
            }
        }
        
        isTyping = false;
        footerPrompt.innerHTML = '--- PRESS ANY KEY TO CONTINUE --- <span class="blinking-cursor">_</span>';
    }

    function selectLog(index) {
        if (index === currentLogIndex || isTyping) return;
        currentLogIndex = index;
        
        // Update timeline UI
        Array.from(timelineContainer.children).forEach((child, i) => {
            child.style.background = i === index ? '#fff' : 'transparent';
            child.style.color = i === index ? '#000' : '#fff';
        });

        let mdContent = logs[index];
        const videoMatch = mdContent.match(/\[video: (.*)\]/);
        let youtubeId = null;
        let isShort = false;
        
        if (videoMatch) {
            const videoInput = videoMatch[1].trim();
            const shortsMatch = videoInput.match(/youtube\.com\/shorts\/([^/?#&]+)/);
            const watchMatch = videoInput.match(/[?&]v=([^/?#&]+)/);
            const embedMatch = videoInput.match(/youtube\.com\/embed\/([^/?#&]+)/);
            const shortUrlMatch = videoInput.match(/youtu\.be\/([^/?#&]+)/);

            if (shortsMatch) {
                isShort = true;
                youtubeId = shortsMatch[1];
            } else if (watchMatch) {
                youtubeId = watchMatch[1];
            } else if (embedMatch) {
                youtubeId = embedMatch[1];
            } else if (shortUrlMatch) {
                youtubeId = shortUrlMatch[1];
            } else {
                youtubeId = videoInput; // Assume it's just the ID
            }
            mdContent = mdContent.replace(/\[video: .*\]/g, '').trim();
        }

        let html = marked.parse(mdContent);
        
        if (youtubeId) {
            const containerStyle = isShort 
                ? "margin: 20px auto; border: 1px solid #fff; max-width: 280px; aspect-ratio: 9/16;"
                : "margin: 20px 0; border: 1px solid #fff; aspect-ratio: 16/9;";
            
            html += `
                <div class="video-container" style="${containerStyle}">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        src="https://www.youtube.com/embed/${youtubeId}" 
                        title="YouTube video player" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        referrerpolicy="strict-origin-when-cross-origin" 
                        allowfullscreen>
                    </iframe>
                </div>
            `;
        }

        typeText(html);
    }

    // Handle "Press any key"
    const handleKeyPress = (e) => {
        if (!panelOpen || isTyping) return;
        if (currentLogIndex < logs.length - 1) {
            selectLog(currentLogIndex + 1);
        } else {
            footerPrompt.innerHTML = '--- END OF LOGS --- <span class="blinking-cursor">_</span>';
        }
    };
    window.addEventListener('keydown', handleKeyPress);

    // Fetch and parse updates
    if (entry.updatesUrl) {
        try {
            const res = await fetch(entry.updatesUrl);
            if (res.ok) {
                const md = await res.text();
                // Split by --- to get individual logs
                logs = md.split(/\n---\n/).map(l => l.trim()).filter(l => l.length > 0);
                
                // Create timeline squares
                logs.forEach((_, i) => {
                    const square = document.createElement('div');
                    square.style.cssText = `
                        width: 20px;
                        height: 20px;
                        border: 1px solid #fff;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        transition: all 0.2s;
                    `;
                    square.textContent = i + 1;
                    square.onclick = () => selectLog(i);
                    timelineContainer.appendChild(square);
                });

                if (logs.length > 0) {
                    selectLog(0);
                }
            }
        } catch (e) {
            updatesContent.innerHTML = '<p style="color: #f00;">> ERROR: CONNECTION_TERMINATED</p>';
        }
    }

    const windowId = openWindowFn({
        title: `Wonderland Explorer - ${entry.name}`,
        content: container,
        width: 1000,
        height: 700,
        x: 40,
        y: 40,
        onClose: () => {
            window.removeEventListener('keydown', handleKeyPress);
        }
    });

    return windowId;
}
