import { renderDetailPage } from './detail.js';

const images = {
  hallway: 'https://images.pexels.com/photos/30299504/pexels-photo-30299504.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  portals: 'https://images.pexels.com/photos/12187128/pexels-photo-12187128.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  laser: 'https://images.pexels.com/photos/36488270/pexels-photo-36488270.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  tornado: 'https://images.pexels.com/photos/1446076/pexels-photo-1446076.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  pets: 'https://images.pexels.com/photos/37891869/pexels-photo-37891869.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  bedwars: 'https://images.pexels.com/photos/12354672/pexels-photo-12354672.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  tiles: 'https://images.pexels.com/photos/11917810/pexels-photo-11917810.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  prison: 'https://images.pexels.com/photos/10474995/pexels-photo-10474995.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  blossom: 'https://images.pexels.com/photos/33594709/pexels-photo-33594709.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  river: 'https://images.pexels.com/photos/65061/pexels-photo-65061.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
};

const worlds = [
  { id: 'hallway', title: 'Hallway Psychosis', author: 'Backrooms Dev', category: 'Atmospheric', image: images.hallway, views: '4,772', reviews: '95.4%', reviewCount: '3.2K', players: '1', description: 'Wander endless liminal hallways where the lights flicker and every corner hides a new unease.', tags: ['Atmospheric', 'Horror', 'Exploration'], time: '18m 40s', guid: '20584771092', type: 'Exploration', featured: true },
  { id: 'portals', title: 'Puzzling Portals', author: 'Roostype', category: 'Puzzle', image: images.portals, views: '1,171', reviews: '86.9%', reviewCount: '814', players: '1', description: 'Bend space itself with a portal gun and solve mind-melting chambers.', tags: ['Puzzle', 'Sci-Fi'], time: '24m 05s', guid: '20581230441', type: 'Puzzle' },
  { id: 'laser', title: 'Laser Dungeon', author: 'NeonForge', category: 'Action', image: images.laser, views: '2,573', reviews: '89.8%', reviewCount: '1.1K', players: '1', description: 'Dodge, weave, and time your dashes through rooms crisscrossed with deadly laser grids.', tags: ['Action', 'Reflex', 'Sci-Fi'], time: '13m 27s', guid: '20583009812', type: 'Action' },
  { id: 'tornado', title: 'Tornado Simulator', author: 'StormChasers', category: 'Party', image: images.tornado, views: '10,400', reviews: '90.1%', reviewCount: '4.6K', players: '4', description: 'Steer a roaring twister across a tiny town and send the whole place flying.', tags: ['Party', 'Physics', 'Chaos'], time: '09m 50s', guid: '20580447120', type: 'Party' },
  { id: 'pets', title: 'Pet Me!', author: 'CozyStudio', category: 'Idle', image: images.pets, views: '5,033', reviews: '92.7%', reviewCount: '2.8K', players: '1', description: 'Adopt a meadow full of adorable critters and keep them happy with treats and toys.', tags: ['Idle', 'Relaxing', 'Collect'], time: '30m+', guid: '20579110034', type: 'Idle' },
  { id: 'bedwars', title: 'Bed Wars', author: 'SkyRaiders', category: 'PvP', image: images.bedwars, views: '3,899', reviews: '78.3%', reviewCount: '1.9K', players: '8', description: 'Defend your bed on a floating island while raiding rivals across sky bridges.', tags: ['PvP', 'Strategy', 'Team'], time: '15m 12s', guid: '20577884521', type: 'PvP' },
  { id: 'tiles', title: 'Number Tiles', author: 'MindGrid', category: 'Casual', image: images.tiles, views: '5,720', reviews: '90.4%', reviewCount: '3.6K', players: '1', description: 'Slide and merge numbered tiles across a floating grid to reach the top score.', tags: ['Casual', 'Logic', 'Relaxing'], time: '12m 30s', guid: '20576330190', type: 'Puzzle' },
  { id: 'dual', title: 'Dual Escape', author: '小问号Official', category: 'Collaboration', image: images.prison, views: '7,717', reviews: '90.9%', reviewCount: '5.4K', players: '2', description: 'Team up in pairs, divide tasks, overcome obstacles, and escape to safety together.', tags: ['Collaboration', 'Third-Person', 'Casual'], time: '11m 12s', guid: '20584332918', type: 'Collaboration' },
  { id: 'oasis', title: 'Interactive Oasis', author: 'BloomWorks', category: 'Exploration', image: images.blossom, views: '1,683', reviews: '87.0%', reviewCount: '990', players: '1', description: 'Roam a blossoming oasis full of gentle puzzles, hidden groves, and secrets.', tags: ['Exploration', 'Relaxing'], time: '20m 00s', guid: '20585002114', type: 'Exploration' },
  { id: 'river', title: 'Monster River', author: 'FrostByte', category: 'Survival', image: images.river, views: '577', reviews: '87.0%', reviewCount: '312', players: '1', description: 'Brave a frozen river teeming with monstrous predators and survive the winter.', tags: ['Survival', 'Action'], time: '22m 40s', guid: '20585330871', type: 'Survival' }
];

const categories = [
  ['ROGUE-LIKE', images.portals], ['SURVIVAL', images.river], ['PUZZLE', images.tiles], ['RACING', images.tornado], ['ACTION', images.laser]
];

const playlists = [
  { title: 'Late Night Worlds', creator: 'Mira Makes Lists', rating: '94%', count: '12 worlds', image: images.hallway },
  { title: 'Play With Friends', creator: 'The Co-op Club', rating: '91%', count: '8 worlds', image: images.dual },
  { title: 'Best Short Sessions', creator: 'Quickplay Weekly', rating: '89%', count: '16 worlds', image: images.laser }
];

let activeWorld = null;
let featuredIndex = 0;

const app = document.querySelector('#app');
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const worldById = (id) => worlds.find((world) => world.id === id) || worlds[0];

function icon(symbol, label) { return `<span class="icon" aria-hidden="true">${symbol}</span><span class="sr-only">${label}</span>`; }

function header() {
  return `<header class="topbar">
    <a class="brand" href="#top" aria-label="Wonderlands home"><span class="brand-mark">✦</span><span>Popular Miliastra Wonderlands</span></a>
    <nav class="primary-nav" aria-label="Primary navigation">
      <a class="nav-link active" href="#for-you">For you</a><a class="nav-link" href="#monthly">Monthly Popular</a><a class="nav-link" href="#hall-of-fame">Hall of fame</a>
    </nav>
    <div class="header-actions"><button class="ghost-button" data-action="open-search">Search</button><button class="ghost-button" data-action="open-library">Library</button><button class="profile-button">M</button></div>
  </header>`;
}

function categoryBrowser() {
  return `<section class="category-browser" id="categories"><div class="section-heading"><div><p class="eyebrow">Explore the library</p><h2>Browse by Category</h2></div><div class="carousel-controls"><button data-action="category-prev" aria-label="Previous categories">‹</button><button data-action="category-next" aria-label="Next categories">›</button></div></div><div class="category-grid">${categories.map(([name, image]) => `<button class="category-tile" data-category="${name}"><img src="${image}" alt=""><span>${name}</span></button>`).join('')}</div><div class="carousel-dots"><i></i><i class="selected"></i><i></i><i></i></div></section>`;
}

function featured() {
  const featuredWorlds = [worlds[0], worlds[7], worlds[3]];
  const world = featuredWorlds[featuredIndex];
  return `<section class="featured-layout" id="top"><div class="featured-art"><img src="${world.image}" alt="${escapeHtml(world.title)}"><button class="slide-arrow left" data-action="featured-prev">‹</button><button class="slide-arrow right" data-action="featured-next">›</button><div class="feature-bottom"><button class="primary-button" data-world="${world.id}">View Wonderland</button><div class="feature-dots">${featuredWorlds.map((_, index) => `<i class="${index === featuredIndex ? 'selected' : ''}"></i>`).join('')}</div></div></div><button class="featured-info" data-world="${world.id}"><h1>${escapeHtml(world.title)}</h1><div class="chip-row"><span class="chip">${world.category}</span><span class="chip pale">${world.players === '1' ? 'Single Player' : `${world.players} Players`}</span></div><div class="metric-line"><span class="views">◉ ${world.views} views</span><span class="good">✓ ${world.reviews}</span></div><div class="video-preview"><img src="${world.image}" alt=""><span class="play">▶</span><b>Guide Video</b></div></button></section>`;
}

function questRail() {
  return `<section class="quick-links"><button class="quick-card"><span class="quick-icon orange">▤</span><span><b>Weekly Quests</b><small>0/12 completed</small></span><strong>›</strong></button><button class="quick-card"><span class="quick-icon blue">▥</span><span><b>Wonderland Collection</b><small>18 discovered</small></span><strong>›</strong></button></section>`;
}

function worldCard(world, compact = false) {
  return `<button class="world-card ${compact ? 'compact' : ''}" data-world="${world.id}"><div class="card-image"><img src="${world.image}" alt="${escapeHtml(world.title)}"><span class="category-chip">${world.category}</span><span class="views-badge">◉ ${world.views}</span></div><div class="card-copy"><h3>${escapeHtml(world.title)}</h3><p>by ${escapeHtml(world.author)}</p><div class="card-meta"><span class="good">✓ ${world.reviews}</span><span>${world.players} ${world.players === '1' ? 'player' : 'players'}</span></div></div></button>`;
}

function playlistCard(playlist) {
  return `<button class="playlist-card"><img src="${playlist.image}" alt=""><div class="playlist-copy"><span class="playlist-mark">▤</span><div><h3>${playlist.title}</h3><p>by ${playlist.creator}</p><small>${playlist.count} · <b>${playlist.rating} rated</b></small></div></div></button>`;
}

function section(title, id, worldsToShow) {
  return `<section class="content-section" id="${id}"><div class="section-heading"><div><p class="eyebrow">Curated for you</p><h2>${title}</h2></div><button class="text-button">See all ›</button></div><div class="world-grid">${worldsToShow.map((world) => worldCard(world)).join('')}</div></section>`;
}

function browsePage() {
  return `${header()}<main class="page-shell">${categoryBrowser()}${featured()}${questRail()}<section class="tabs-section" id="for-you"><div class="content-tabs"><button class="tab active" data-tab="for-you">For you</button><button class="tab" data-tab="monthly">Monthly Popular</button><button class="tab" data-tab="hall-of-fame">Hall of fame</button><button class="tab" data-tab="official">Official Picks</button><button class="tab" data-tab="playlists">Playlists</button><button class="tab" data-tab="hidden">Hidden Gem Hunt</button></div><div id="tab-content">${tabContent('for-you')}</div></section></main>`;
}

function tabContent(tab) {
  if (tab === 'monthly') return section('Monthly Popular', 'monthly', [worlds[3], worlds[7], worlds[4]]);
  if (tab === 'hall-of-fame') return section('Hall of fame', 'hall-of-fame', [worlds[0], worlds[1], worlds[2]]);
  if (tab === 'official') return section('Official Picks', 'official', [worlds[7], worlds[3], worlds[5]]);
  if (tab === 'hidden') return section('Hidden Gem Hunt', 'hidden', [worlds[9], worlds[8], worlds[2]]);
  if (tab === 'playlists') return `<section class="content-section"><div class="section-heading"><div><p class="eyebrow">Rated collections by people</p><h2>Playlists</h2></div></div><div class="playlist-grid">${playlists.map(playlistCard).join('')}</div></section>`;
  return `<div>${section('Recommended for you', 'recommended', [worlds[1], worlds[2], worlds[3]])}${section('Rising stars', 'rising', [worlds[8], worlds[9], worlds[4]])}</div>`;
}

function render() { app.innerHTML = activeWorld ? renderDetailPage(activeWorld) : browsePage(); }

function setTab(tab) { document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); const target = document.querySelector('#tab-content'); if (target) target.innerHTML = tabContent(tab); }

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-world], [data-action], [data-tab], [data-review], [data-category]');
  if (!target) return;
  if (target.dataset.world) { activeWorld = worldById(target.dataset.world); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (target.dataset.tab) { setTab(target.dataset.tab); return; }
  if (target.dataset.category) { const category = target.dataset.category.toLowerCase(); setTab(category.includes('puzzle') ? 'hall-of-fame' : category.includes('survival') ? 'hidden' : 'monthly'); document.querySelector('#for-you')?.scrollIntoView({ behavior: 'smooth' }); return; }
  if (target.dataset.action === 'close-detail') { activeWorld = null; render(); return; }
  if (target.dataset.action === 'featured-prev') { featuredIndex = (featuredIndex + 2) % 3; render(); return; }
  if (target.dataset.action === 'featured-next') { featuredIndex = (featuredIndex + 1) % 3; render(); return; }
  if (target.dataset.action === 'copy-guid') { navigator.clipboard?.writeText(activeWorld.guid); target.textContent = 'Copied'; setTimeout(() => { target.textContent = 'Copy'; }, 1200); return; }
  if (target.dataset.action === 'check-reviews') { document.querySelector('#reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && activeWorld) { activeWorld = null; render(); } });
render();
