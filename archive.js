import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

const archiveData = [
    {
        id: "impact_lib_gbr",
        title: "Guns Brooms Rockets (GBR)",
        version: "v2.02",
        date: "2026-04-21",
        size: "3.4 MB",
        image: "wonderlands/miliastra_prime/GBR_Cover.jpg",
        description: "Visual fidelity increased by 40%. Memory leak in the water pool simulation patched. Sector ready for public peeking. Final optimizations for the Guns Brooms Rockets experience are complete.",
        downloadUrl: "wonderlands/miliastra_prime/GBR_v.2.02.gil",
        tags: ["#shooter", "#arena", "#fast", "#optimized"],
        banner: "ALMOST DONE --- OPTIMIZING SECTOR --- READY FOR EXTRACTION"
    },
    {
        id: "impact_lib_orszaghaz",
        title: "Orszaghaz Reimagined",
        version: "v1.0.0",
        date: "2026-03-12",
        size: "1.2 MB",
        image: "wonderlands/Orszaghaz/shw_1.jpg",
        description: "The Hungarian Parliament Building (Országház) reimagined. A gothic revival architectural wonder, now available for your library as a high-fidelity environment asset.",
        downloadUrl: "wonderlands/Orszaghaz/Orszaghaz_.gil",
        tags: ["#architecture", "#gothic", "#environment", "#asset"],
        banner: "STABLE RELEASE --- LEGACY ARCHIVE --- VERIFIED"
    }
];

const archiveList = document.getElementById('archive-list');
const searchInput = document.getElementById('archive-search');
const fileCountEl = document.getElementById('file-count');
const clockEl = document.getElementById('clock');

function renderArchive(filter = "") {
    const filtered = archiveData.filter(item => 
        item.title.toLowerCase().includes(filter.toLowerCase()) || 
        item.id.toLowerCase().includes(filter.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))
    );

    fileCountEl.textContent = filtered.length;

    archiveList.innerHTML = filtered.map(item => `
        <article class="archive-item" id="${item.id}">
            <div class="item-banner">${item.banner}</div>
            <div class="item-content-flex">
                <div class="item-media">
                    <div class="item-img-container">
                        <img src="${item.image}" alt="${item.title}" referrerPolicy="no-referrer">
                    </div>
                </div>
                <div class="item-info">
                    <div class="item-header">
                        <div class="item-id">[ID: ${item.id}]</div>
                        <h2 class="item-title">${item.title}</h2>
                    </div>
                    
                    <div class="item-description-box">
                        <div class="item-description">${marked.parse(item.description)}</div>
                    </div>

                    <div class="item-tags">
                        ${item.tags.map(tag => `<span class="archive-hashtag">${tag}</span>`).join('')}
                    </div>

                    <div class="item-download-zone">
                        <div class="item-meta">
                            <span>VER: ${item.version}</span>
                            <span>SIZE: ${item.size}</span>
                            <span>DATE: ${item.date}</span>
                        </div>
                        <a href="${item.downloadUrl}" class="download-btn" download>DOWNLOAD<span class="blinking-cursor">_</span></a>
                    </div>
                </div>
            </div>
        </article>
    `).join('');
}

searchInput.addEventListener('input', (e) => {
    renderArchive(e.target.value);
});

function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toISOString().replace('T', ' ').substring(0, 19);
}

// Back to Portfolio Logic
const backBtn = document.getElementById('back-to-portfolio');

function goBack() {
    if (window.self !== window.top) {
        window.parent.postMessage({ type: 'close-archive' }, '*');
    } else {
        window.location.href = 'index.html';
    }
}

if (backBtn) {
    backBtn.addEventListener('click', goBack);
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        goBack();
    }
});

// Init
renderArchive();
setInterval(updateClock, 1000);
updateClock();
