import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

const archiveData = [
    {
        id: "impact_lib_gbr",
        title: "Guns Brooms Rockets (GBR)",
        version: "v2.02",
        date: "2026-04-21",
        size: "2.52 MB",
        image: "wonderlands/gbr/1.jpg",
        description: "In full glory, fully free, fully available, everthing included, nothing is hidden. Enjoy.",
        downloadUrl: "wonderlands/gbr/GBR_v.2.02.gil",
        tags: ["#shooter", "#arena", "#fast", "#optimized"],
        banner: "ALMOST DONE --- OPTIMIZING SECTOR --- READY FOR EXTRACTION"
    },
    {
        id: "impact_lib_orszaghaz",
        title: "Orszaghaz Reimagined",
        version: "v1.0.0",
        date: "2026-03-12",
        size: "4.3 MB",
        image: "wonderlands/orszaghaz/shw_1.jpg",
        description: "The Hungarian Parliament Building (Országház) reimagined. A gothic revival architectural wonder, now available for your library as a high-fidelity environment asset.",
        downloadUrl: "wonderlands/orszaghaz/Orszaghaz_.gil",
        tags: ["#architecture", "#gothic", "#environment", "#asset"],
        banner: "STABLE RELEASE --- LEGACY ARCHIVE --- VERIFIED"
    },
    {
        id: "impact_lib_log",
        title: "League of Gun (LOG)",
        version: "v1.00",
        date: "2026-04-21",
        size: "1.03 MB",
        image: "wonderlands/league_of_gun/cover.jpg",
        description: "League of legends map, but first person.",
        downloadUrl: "wonderlands/league_of_gun/league_of_gun_v1.gil",
        tags: ["#shooter", "#moba", "#concept"],
        banner: "TOWERS --- MOBS --- GUN --- READY FOR USE"
    },
    {
        id: "impact_lib_procedural",
        title: "Terrain Generation",
        version: "v0.32",
        date: "2026-04-21",
        size: "366 KB",
        image: "wonderlands/terrain_generator/terrain_thmb.jpg",
        description: "Generates terrain like MAGIC.",
        downloadUrl: "wonderlands/terrain_generator/procedural_terrain_generator.gil",
        tags: ["#terrain", "#generation", "#fast", "#can_break"],
        banner: "GENERATION --- TERRAIN --- READY FOR IMPLEMENTATION"
    },    
    {
        id: "impact_lib_ss",
        title: "Scroll Shot ++",
        version: "v0.72",
        date: "2026-04-21",
        size: "476 KB",
        image: "wonderlands/scroll_shot/scroll_shot_thmb.jpg",
        description: "Guitar Hero, but GUN.",
        downloadUrl: "wonderlands/scroll_shot/scroll_shot++.gil",
        tags: ["#shooter", "#scroll", "#fast", "#fun"],
        banner: "MOVING --- PROGRESSING --- READY FOR VIBES"
    },      
    {
        id: "impact_lib_fg",
        title: "2D fighter concept",
        version: "v0.41",
        date: "2026-04-21",
        size: "525 KB",
        image: "wonderlands/figthing_game/fighting_thmb.jpg",
        description: "Press buttons, animation happen, very fun, trust.",
        downloadUrl: "wonderlands/figthing_game/2d_fighting_game.gil",
        tags: ["#fighting", "#arena", "#2d", "#optimized"],
        banner: "BUTTONS --- FUN COMBOS --- READY FOR STREETS"
    },     
    {
        id: "impact_lib_c208",
        title: "Cessna 208B Grand Caravan EX",
        version: "v0.87",
        date: "2026-04-21",
        size: "721 KB",
        image: "wonderlands/cessna_208/plane_thmb.jpg",
        description: "I love you. I love that plane, take care for it, anyone who downloads it.",
        downloadUrl: "wonderlands/cessna_208/cessna_208_caravan_EX.gil",
        tags: ["#plane", "#cessna", "#208caravan", "#detailed"],
        banner: "SHE WILL FLY --- OPTIMIZING WINGS --- READY FOR FLIGHT"
    }         
];

const archiveList = document.getElementById('archive-list');
const searchInput = document.getElementById('archive-search');
const fileCountEl = document.getElementById('file-count');
const clockEl = document.getElementById('clock');

async function renderArchive(filter = "", isInitialLoad = false) {
    const filtered = archiveData.filter(item => 
        item.title.toLowerCase().includes(filter.toLowerCase()) || 
        item.id.toLowerCase().includes(filter.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))
    );

    fileCountEl.textContent = filtered.length;

    if (!isInitialLoad) {
        // Instant render for searches
        archiveList.innerHTML = filtered.map(item => createItemHtml(item)).join('');
        return;
    }

    // Sequential load for initial page load
    archiveList.innerHTML = '';
    for (const item of filtered) {
        const itemHtml = createItemHtml(item);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = itemHtml;
        const itemElement = tempDiv.firstElementChild;
        itemElement.style.opacity = '0';
        itemElement.style.transform = 'translateY(20px)';
        itemElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        archiveList.appendChild(itemElement);
        
        // Trigger reflow
        itemElement.offsetHeight;
        
        itemElement.style.opacity = '1';
        itemElement.style.transform = 'translateY(0)';
        
        await new Promise(resolve => setTimeout(resolve, 150)); // Delay between items
    }
}

function createItemHtml(item) {
    return `
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
    `;
}

searchInput.addEventListener('input', (e) => {
    renderArchive(e.target.value, false);
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
// Wait for fonts/css if possible, but the onload in HTML handles visibility
document.addEventListener('DOMContentLoaded', () => {
    renderArchive("", true);
    setInterval(updateClock, 1000);
    updateClock();
});