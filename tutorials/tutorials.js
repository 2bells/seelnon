import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

const TUTORIALS_INDEX = [
    { name: "Fri-ren/From Notes", path: "Content/Projects/Fri-ren_Notes/server/tutorial.md" },
    { name: "Tests/PrismJS test", path: "tutorials/test/guide.md" },
    { name: "Tests/Background Check", path: "tutorials/test/html.md" },
];

export async function preloadTutorials() {
    // Optional: add preloading logic if needed
}

export async function openTutorialsWindow(title, openWindowFn) {
    const wrap = document.createElement('div');
    wrap.className = 'tutorials-window-wrap';
    wrap.id = 'tutorials-root';
    wrap.style.height = '100%';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.background = '#241f1a';
    wrap.style.color = '#a18a5e';

    // Extend Prism markdown grammar for custom tags like [img 2]
    if (typeof Prism !== 'undefined' && Prism.languages.markdown) {
        Prism.languages.markdown['caveman-tag'] = {
            pattern: /\[(?:img|vid|obj|link|file|scroll)\s+\d+\]/i,
            alias: 'important'
        };
        // Also extend for code blocks if they are markdown-ish
        if (Prism.languages.javascript) {
           Prism.languages.javascript['caveman-tag'] = {
                pattern: /\[(?:img|vid|obj|link|file|scroll)\s+\d+\]/i,
                alias: 'important'
           };
        }
    }

    wrap.innerHTML = `
        <style>
            .tutorials-layout { display: flex; height: 100%; overflow: hidden; border: 1px solid #4a3e34; font-family: 'Inter', sans-serif; }
            .tutorials-sidebar { width: 250px; border-right: 2px solid #4a3e34; display: flex; flex-direction: column; background: #241f1a; user-select: none; }
            .tutorials-sidebar-header { padding: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #4a3e34; color: #7d6b4a; letter-spacing: 2px; background: #000; height: 90px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 15px rgba(212, 175, 55, 0.1); margin: 6px; border: 2px solid #3d342b; border-radius: 2px; }
            .tutorials-sidebar-header::after {
                content: "";
                position: absolute;
                inset: 0;
                background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
                background-size: 100% 2px, 3px 100%;
                pointer-events: none;
                z-index: 2;
            }
            #scroll-ascii-container { font-family: 'Courier New', monospace; font-size: 4px; line-height: 4px; color: #d4af37; white-space: pre; pointer-events: none; transform: scale(1.4); opacity: 0.7; }
            .sidebar-title-overlay { position: absolute; bottom: 0; width: 100%; text-align: center; font-size: 8px; color: #d4af37; background: rgba(0,0,0,0.85); padding: 3px 0; border-top: 1px solid #4a3e34; z-index: 3; font-weight: 800; text-shadow: 0 0 5px rgba(212, 175, 55, 0.5); }
            .tutorials-list { flex: 1; overflow-y: auto; padding: 10px 0; background: #241f1a; }
            
            .tutorial-folder { border-bottom: 1px solid rgba(161, 138, 94, 0.05); }
            .folder-header { 
                padding: 12px 16px; 
                font-size: 10px; 
                cursor: pointer; 
                text-transform: uppercase; 
                letter-spacing: 1.5px; 
                font-weight: 800; 
                color: #5c4e3a; 
                display: flex;
                align-items: center;
                background: rgba(0,0,0,0.1);
                transition: background 0.2s;
            }
            .folder-header:hover { background: rgba(0,0,0,0.2); color: #d4af37; }
            .folder-header::before {
                content: '▶';
                font-size: 8px;
                margin-right: 8px;
                transition: transform 0.2s;
                display: inline-block;
            }
            .tutorial-folder.open .folder-header::before { transform: rotate(90deg); color: #d4af37; }
            .tutorial-folder .folder-content { display: none; background: rgba(0,0,0,0.15); }
            .tutorial-folder.open .folder-content { display: block; }

            .tutorial-item { padding: 10px 20px; font-size: 11px; cursor: pointer; border-bottom: 1px solid rgba(161, 138, 94, 0.02); transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #8a785d; }
            .tutorial-item:hover { background: #2e2821; color: #d4af37; padding-left: 25px; }
            .tutorial-item.active { background: #a18a5e; color: #1c1814; border-bottom: 1px solid #d4af37; }
            .folder-content .tutorial-item { padding-left: 30px; border-left: 2px solid #3d342b; }
            .folder-content .tutorial-item:hover { padding-left: 35px; border-left-color: #d4af37; }

            .tutorials-main { flex: 1; overflow-y: auto; padding: 50px 60px; background: #1c1814; line-height: 1.8; position: relative; scroll-behavior: smooth; user-select: text; }
            .tutorials-content { max-width: 800px; margin: 0 auto; color: #bdab84; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
            
            .tutorials-content h1 { color: #d4af37; font-size: 2.4em; margin-bottom: 30px; font-weight: 800; text-transform: uppercase; letter-spacing: -1px; border-bottom: 3px double #4a3e34; padding-bottom: 15px; font-family: 'Inter', sans-serif; }
            .tutorials-content h2 { color: #d4af37; font-size: 1.6em; margin-top: 45px; margin-bottom: 20px; border-bottom: 1px solid #4a3e34; padding-bottom: 8px; font-weight: 700; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 1px; }
            .tutorials-content h3 { color: #a18a5e; font-size: 1.25em; margin-top: 30px; margin-bottom: 12px; font-weight: 700; font-family: 'Inter', sans-serif; }
            
            .tutorials-content p { margin-bottom: 22px; }
            .tutorials-content pre { background: #0c0a09 !important; border: 1px solid #3d342b; padding: 24px; border-radius: 2px; overflow-x: auto; margin: 30px 0; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); }
            .tutorials-content code { font-family: 'JetBrains Mono', monospace !important; border-radius: 2px; font-size: 13px; }
            .tutorials-content :not(pre) > code { background: #2e2821; padding: 3px 7px; color: #d4af37; border: 1px solid #4a3e34; font-size: 12px; }
            
            .tutorials-content img { max-width: 100%; border: 2px solid #4a3e34; padding: 5px; background: #241f1a; margin: 30px auto; display: block; filter: sepia(0.2) contrast(1.1); }
            
            /* Link Styling - The Path */
            .tutorials-content a { 
                color: #d4af37; 
                text-decoration: none; 
                border: 1px solid #4a3e34;
                padding: 4px 10px;
                background: #1c1814;
                display: inline-block;
                transition: all 0.2s;
                position: relative;
                margin: 2px 0;
                font-family: 'Inter', sans-serif;
                font-weight: 700;
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 1px;
            }
            .tutorials-content a::after {
                content: " _";
                opacity: 0.5;
                animation: underscore-blink 1s step-end infinite;
            }
            @keyframes underscore-blink {
                from, to { opacity: 0.5; }
                50% { opacity: 0; }
            }
            .tutorials-content a:hover::after {
                animation: none;
                opacity: 1;
            }
            .tutorials-content a:hover { 
                background: #241f1a; 
                border-color: #d4af37;
                color: #d4af37;
                box-shadow: 2px 2px 0 #000;
            }
            .tutorials-content hr { border: 0; border-top: 2px solid #3d342b; margin: 50px 0; position: relative; }
            .tutorials-content hr::after { content: "◆"; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #1c1814; padding: 0 15px; color: #4a3e34; font-size: 12px; }
            
            .tutorials-content blockquote { border-left: 4px solid #d4af37; background: rgba(212, 175, 55, 0.03); padding: 20px 30px; margin: 35px 0; font-style: italic; color: #8a785d; border-radius: 0 4px 4px 0; }
            
            .tutorials-content ul, .tutorials-content ol { margin-bottom: 25px; padding-left: 25px; }
            .tutorials-content li { margin-bottom: 12px; }
            .tutorials-content ul ul, .tutorials-content ul ol, .tutorials-content ol ul, .tutorials-content ol ol {
                margin-top: 12px;
                margin-bottom: 15px;
            }
            
            /* Checklist styling - Stoic X */
            .tutorials-content input[type="checkbox"] { 
                appearance: none; width: 14px; height: 14px; border: 1px solid #4a3e34; background: #000; cursor: pointer; 
                display: inline-block; vertical-align: middle; margin-right: 12px; position: relative; margin-top: -2px;
                transition: all 0.2s;
            }
            .tutorials-content input[type="checkbox"]:checked {
                border-color: #d4af37;
                background: #1c1814;
            }
            .tutorials-content input[type="checkbox"]:checked::after {
                content: "✕"; position: absolute; color: #d4af37; font-size: 10px; left: 2px; top: -1px; font-weight: bold;
            }
            
            /* Table Styling */
            .tutorials-content table { width: 100%; border-collapse: collapse; margin: 30px 0; font-size: 12px; background: rgba(0,0,0,0.2); border: 1px solid #4a3e34; }
            .tutorials-content th { background: #241f1a; color: #d4af37; text-align: left; padding: 14px; border: 1px solid #4a3e34; font-family: 'Inter', sans-serif; font-weight: 800; text-transform: uppercase; }
            .tutorials-content td { padding: 12px; border: 1px solid #4a3e34; color: #bdab84; }
            .tutorials-content tr:nth-child(even) { background: rgba(255,255,255,0.02); }

            /* Prism Overrides */
            .token.important, .token.caveman-tag { color: #ffca28 !important; font-weight: bold; text-shadow: 0 0 5px rgba(255, 202, 40, 0.3); }
            .token.comment { color: #5f5d5a !important; font-style: italic; }
            .token.keyword { color: #d4af37 !important; }
            .token.string { color: #a1b58d !important; }
            .token.function { color: #ecb1a0 !important; }
            
            /* Scrollbar */
            .tutorials-main::-webkit-scrollbar { width: 10px; }
            .tutorials-main::-webkit-scrollbar-track { background: #1c1814; }
            .tutorials-main::-webkit-scrollbar-thumb { background: #3d342b; border: 2px solid #1c1814; }
            .tutorials-main::-webkit-scrollbar-thumb:hover { background: #d4af37; }
        </style>
        <div class="tutorials-layout">
            <aside class="tutorials-sidebar">
                <div class="tutorials-sidebar-header">
                    <pre id="scroll-ascii-container"></pre>
                    <div class="sidebar-title-overlay">SCROLL_ARCHIVE</div>
                </div>
                <div class="tutorials-list" id="tutorial-list"></div>
            </aside>
            <main class="tutorials-main" id="tutorials-main">
                <article class="tutorials-content" id="tutorial-content">
                    <div style="text-align: center; margin-top: 100px; opacity: 0.3; filter: grayscale(1);">
                        <img src="icons/talent_icon_debug.png" style="width: 64px; border:none; background:none; margin:0;" />
                        <div style="margin-top: 20px; font-size: 12px; letter-spacing: 2px; font-weight:800;">SELECT_SCROLL_TO_DESCIPHER</div>
                    </div>
                </article>
            </main>
        </div>
    `;

    const listEl = wrap.querySelector('#tutorial-list');
    const contentEl = wrap.querySelector('#tutorial-content');
    const mainEl = wrap.querySelector('#tutorials-main');

    async function loadTutorial(item) {
        contentEl.innerHTML = '<div style="opacity: 0.5; text-align:center; margin-top: 100px; font-weight: 800; letter-spacing: 2px;">DESCIPHERING...</div>';
        try {
            const response = await fetch(item.path);
            if (!response.ok) throw new Error("Failed to fetch: " + item.path);
            const text = await response.text();
            renderMarkdown(text, item.path);
        } catch (err) {
            contentEl.innerHTML = `<div style="color: #ff4444; text-align: center; margin-top: 50px;">
                <h3 style="margin-bottom: 10px;">FAILED TO READ SCROLL</h3>
                <p style="font-size: 11px; opacity: 0.7;">${err.message}</p>
            </div>`;
        }
    }

    function renderMarkdown(md, currentPath) {
        if (typeof marked === 'undefined') {
            contentEl.innerText = md;
            return;
        }

        const html = marked.parse(md);
        contentEl.innerHTML = html;

        // Resolve images relative to the markdown file
        const baseDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        contentEl.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('/')) {
                img.src = baseDir + src;
            }
        });

        // Ensure links open in new tab
        contentEl.querySelectorAll('a').forEach(a => {
            if (!a.target) a.target = "_blank";
        });

        // Trigger PrismJS highlighting
        if (typeof Prism !== 'undefined') {
            Prism.highlightAllUnder(contentEl);
        }

        // Scroll to top
        mainEl.scrollTop = 0;
    }

    function renderList() {
        listEl.innerHTML = '';
        
        // Group items
        const structure = {};
        TUTORIALS_INDEX.forEach(item => {
            if (item.name.includes('/')) {
                const [folder, ...rest] = item.name.split('/');
                const subName = rest.join('/');
                if (!structure[folder]) structure[folder] = [];
                structure[folder].push({ ...item, displayName: subName });
            } else {
                if (!structure['ROOT']) structure['ROOT'] = [];
                structure['ROOT'].push({ ...item, displayName: item.name });
            }
        });

        // Render Folders
        Object.keys(structure).forEach(key => {
            if (key === 'ROOT') return;
            
            const folderWrap = document.createElement('div');
            folderWrap.className = 'tutorial-folder open';
            
            const header = document.createElement('div');
            header.className = 'folder-header';
            header.textContent = key;
            header.onclick = () => folderWrap.classList.toggle('open');
            
            const content = document.createElement('div');
            content.className = 'folder-content';
            
            structure[key].forEach(item => {
                const div = createItemEl(item);
                content.appendChild(div);
            });
            
            folderWrap.appendChild(header);
            folderWrap.appendChild(content);
            listEl.appendChild(folderWrap);
        });

        // Render Root items
        if (structure['ROOT']) {
            structure['ROOT'].forEach(item => {
                listEl.appendChild(createItemEl(item));
            });
        }
    }

    function createItemEl(item) {
        const div = document.createElement('div');
        div.className = 'tutorial-item';
        div.textContent = item.displayName;
        div.onclick = () => {
            if (div.classList.contains('active')) return;
            wrap.querySelectorAll('.tutorial-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            loadTutorial(item);
        };
        return div;
    }

    renderList();
    
    // Start 3D Scroll Animation
    const asciiContainer = wrap.querySelector('#scroll-ascii-container');
    let A = 0, B = 0;
    const width = 80;
    const height = 22;
    
    function animate() {
        if (!wrap.isConnected && animate.failedChecks > 100) return;
        if (!wrap.isConnected) {
            animate.failedChecks = (animate.failedChecks || 0) + 1;
            requestAnimationFrame(animate);
            return;
        }
        animate.failedChecks = 0;
        
        const z = new Array(width * height).fill(0);
        const b = new Array(width * height).fill(" ");
        
        // Render a rotating cylinder/scroll-like object
        // We use a simplified projection to keep it centered
        for (let j = 0; j < 6.28; j += 0.07) { // vertical rings
            for (let i = 0; i < 6.28; i += 0.02) { // points on ring
                const sin_i = Math.sin(i);
                const cos_i = Math.cos(i);
                const sin_j = Math.sin(j);
                const cos_j = Math.cos(j);
                const sin_A = Math.sin(A);
                const cos_A = Math.cos(A);
                const sin_B = Math.sin(B);
                const cos_B = Math.cos(B);

                // Cylinder coordinates (x, y, z)
                // r = 1, h = j (from -pi to pi)
                const nx = cos_i;
                const ny = sin_i;
                const nz = j - 3.14; // Scroll length

                // Rotation
                // Rotate around X (A)
                const y1 = ny * cos_A - nz * sin_A;
                const z1 = ny * sin_A + nz * cos_A;
                // Rotate around Y (B)
                const x2 = nx * cos_B + z1 * sin_B;
                const z2 = -nx * sin_B + z1 * cos_B;
                
                const ooz = 1 / (z2 + 10); // One over Z
                
                const xp = Math.floor(width / 2 + 35 * ooz * x2);
                const yp = Math.floor(height / 2 + 18 * ooz * y1);
                
                const idx = xp + width * yp;
                
                // Simple luminance based on normal (nx, ny, nz)
                const L = 8 * (nx * cos_B * sin_B - ny * cos_A - nz * sin_A);
                const luminanceIdx = Math.floor(L > 0 ? L : 0);
                const char = ".,-~:;=!*#$@"[luminanceIdx % 12];

                if (yp >= 0 && yp < height && xp >= 0 && xp < width && ooz > z[idx]) {
                    z[idx] = ooz;
                    b[idx] = char;
                }
            }
        }
        
        let output = "";
        for (let k = 0; k < width * height; k++) {
            output += (k % width === 0 && k !== 0) ? "\n" + b[k] : b[k];
        }
        asciiContainer.textContent = output;
        
        A += 0.010;
        B += 0.012;
        requestAnimationFrame(animate);
    }
    animate();
    
    // Select first item
    const firstItem = listEl.querySelector('.tutorial-item');
    if (firstItem) firstItem.click();

    openWindowFn({
        title: title,
        content: wrap,
        width: 900,
        height: 650,
        x: 60,
        y: 40
    });
}
