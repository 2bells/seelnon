import { renderDetailPage } from './detail.js';
import { renderHiddenGemHunt, handleGemClick } from './hidden-gem-hunt.js';
import { renderEvents } from './events.js';

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
  river: 'https://images.pexels.com/photos/65061/pexels-photo-65061.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  coOp: 'https://images.pexels.com/photos/35835479/pexels-photo-35835479.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  castle: 'https://images.pexels.com/photos/1047495/pexels-photo-1047495.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  space: 'https://images.pexels.com/photos/6249474/pexels-photo-6249474.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  city: 'https://images.pexels.com/photos/932262/pexels-photo-932262.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  jungle: 'https://images.pexels.com/photos/1174732/pexels-photo-1174732.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  desert: 'https://images.pexels.com/photos/933054/pexels-photo-933054.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  dungeon: 'https://images.pexels.com/photos/2422915/pexels-photo-2422915.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  race: 'https://images.pexels.com/photos/1591362/pexels-photo-1591362.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
};

const worlds = [
  { id: 'hallway', title: 'Hallway Psychosis', author: 'Backrooms Dev', category: 'Atmospheric', image: images.hallway, views: '4,772', reviews: '95.4%', reviewCount: '3.2K', players: '1', description: 'Wander endless liminal hallways where the lights flicker and every corner hides a new unease.', tags: ['Atmospheric', 'Horror', 'Exploration'], time: '18m 40s', guid: '20584771092', type: 'Exploration', featured: true, updated: '4d' },
  { id: 'portals', title: 'Puzzling Portals', author: 'Roostype', category: 'Puzzle', image: images.portals, views: '1,171', reviews: '86.9%', reviewCount: '814', players: '1', description: 'Bend space itself with a portal gun and solve mind-melting chambers.', tags: ['Puzzle', 'Sci-Fi'], time: '24m 05s', guid: '20581230441', type: 'Puzzle', updated: '1w' },
  { id: 'laser', title: 'Laser Dungeon', author: 'NeonForge', category: 'Action', image: images.laser, views: '2,573', reviews: '89.8%', reviewCount: '1.1K', players: '1', description: 'Dodge, weave, and time your dashes through rooms crisscrossed with deadly laser grids.', tags: ['Action', 'Reflex', 'Sci-Fi'], time: '13m 27s', guid: '20583009812', type: 'Action', updated: '2h' },
  { id: 'tornado', title: 'Tornado Simulator', author: 'StormChasers', category: 'Party', image: images.tornado, views: '10,400', reviews: '90.1%', reviewCount: '4.6K', players: '4', description: 'Steer a roaring twister across a tiny town and send the whole place flying.', tags: ['Party', 'Physics', 'Chaos'], time: '09m 50s', guid: '20580447120', type: 'Party', updated: '5m' },
  { id: 'pets', title: 'Pet Me!', author: 'CozyStudio', category: 'Idle', image: images.pets, views: '5,033', reviews: '92.7%', reviewCount: '2.8K', players: '1', description: 'Adopt a meadow full of adorable critters and keep them happy with treats and toys.', tags: ['Idle', 'Relaxing', 'Collect'], time: '30m+', guid: '20579110034', type: 'Idle', updated: '3d' },
  { id: 'bedwars', title: 'Bed Wars', author: 'SkyRaiders', category: 'PvP', image: images.bedwars, views: '3,899', reviews: '78.3%', reviewCount: '1.9K', players: '8', description: 'Defend your bed on a floating island while raiding rivals across sky bridges.', tags: ['PvP', 'Strategy', 'Team'], time: '15m 12s', guid: '20577884521', type: 'PvP', updated: '6d' },
  { id: 'tiles', title: 'Number Tiles', author: 'MindGrid', category: 'Casual', image: images.tiles, views: '5,720', reviews: '90.4%', reviewCount: '3.6K', players: '1', description: 'Slide and merge numbered tiles across a floating grid to reach the top score.', tags: ['Casual', 'Logic', 'Relaxing'], time: '12m 30s', guid: '20576330190', type: 'Puzzle', updated: '2w' },
  { id: 'dual', title: 'Dual Escape', author: '小问号Official', category: 'Collaboration', image: images.coOp, views: '7,717', plays: 7717, reviews: '90.9%', reviewCount: '5.4K', players: '2', description: 'Team up in pairs, divide tasks, overcome obstacles, and escape to safety together.', tags: ['Collaboration', 'Third-Person', 'Casual'], time: '11m 12s', guid: '20584332918', type: 'Collaboration', updated: '1d' },
  { id: 'oasis', title: 'Interactive Oasis', author: 'BloomWorks', category: 'Exploration', image: images.blossom, views: '1,683', reviews: '87.0%', reviewCount: '990', players: '1', description: 'Roam a blossoming oasis full of gentle puzzles, hidden groves, and secrets.', tags: ['Exploration', 'Relaxing'], time: '20m 00s', guid: '20585002114', type: 'Exploration', updated: '8d' },
  { id: 'river', title: 'Monster River', author: 'FrostByte', category: 'Survival', image: images.river, views: '577', plays: 577, reviews: '87.0%', reviewCount: '312', players: '1', description: 'Brave a frozen river teeming with monstrous predators and survive the winter.', tags: ['Survival', 'Action'], time: '22m 40s', guid: '20585330871', type: 'Survival', updated: '12h' },
  { id: 'kingdom', title: 'Kingdom Reborn', author: 'MedievalWorks', category: 'City & Settlement', image: images.castle, views: '1.4M', plays: 1400000, reviews: '93.1%', reviewCount: '8.7K', players: '1', description: 'Build and defend a medieval kingdom from scratch. Every citizen has a story.', tags: ['City & Settlement', 'Strategy', 'Simulation'], time: '45m+', guid: '20587000123', type: 'Simulation', updated: '5d', featured: true },
  { id: 'nova', title: 'Nova Drift', author: 'CosmicPilot', category: 'Sci-fi', image: images.space, views: '8.5M', plays: 8500000, reviews: '97.2%', reviewCount: '12.4K', players: '1-4', description: 'Pilot a customizable starship through nebula battles and ancient space ruins.', tags: ['Sci-fi', 'Action', 'Co-operative'], time: '22m 10s', guid: '20588000456', type: 'Action', updated: '2h', featured: true },
  { id: 'midnight', title: 'Midnight Market', author: 'NeonWanderer', category: 'City & Settlement', image: images.city, views: '2.1M', plays: 2100000, reviews: '89.5%', reviewCount: '6.3K', players: '1', description: 'Stroll a neon-drenched night market where every stall sells a mystery.', tags: ['City & Settlement', 'Story-rich', 'Explore'], time: '28m 00s', guid: '20589000111', type: 'Exploration', updated: '1d' },
  { id: 'verdant', title: 'Verdant Atoll', author: 'JungleCall', category: 'Adventure', image: images.jungle, views: '68,412', plays: 68412, reviews: '88.3%', reviewCount: '3.1K', players: '1', description: 'Island-hop through teeming jungles and sunken temples teeming with life.', tags: ['Adventure', 'Exploration'], time: '35m 20s', guid: '20590000222', type: 'Adventure', updated: '3d' },
  { id: 'sands', title: 'Sands of Echo', author: 'DuneRider', category: 'RPG', image: images.desert, views: '1.9M', plays: 1900000, reviews: '91.8%', reviewCount: '9.5K', players: '1', description: 'An epic open desert ruled by ancient echoes. Forge alliances, uncover lost lore.', tags: ['Role-playing', 'Open World', 'Story-rich'], time: '60m+', guid: '20589000333', type: 'RPG', updated: '6d' },
  { id: 'catacombs', title: 'Sunken Catacombs', author: 'BoneKeeper', category: 'Horror', image: images.dungeon, views: '912,004', plays: 912004, reviews: '84.7%', reviewCount: '4.2K', players: '1', description: 'Descend into flooded tombs where the water carries whispers.', tags: ['Horror', 'Exploration'], time: '28m 15s', guid: '20589000444', type: 'Exploration', updated: '3d' },
  { id: 'apex', title: 'Apex Circuit', author: 'StormLine', category: 'Racing', image: images.race, views: '5.6M', plays: 5600000, reviews: '92.8%', reviewCount: '11.2K', players: '4', description: 'Drift through futuristic circuits and leave rival racers in the dust.', tags: ['Racing', 'Action', 'Competitive'], time: '7m 30s', guid: '20589000555', type: 'Racing', updated: '4h' }
];

const categories = [
  ['ROGUE-LIKE', images.portals], ['SURVIVAL', images.river], ['PUZZLE', images.tiles], ['RACING', images.tornado], ['ACTION', images.laser]
];
const categoriesRow2 = [
  ['CO-OP', images.coOp], ['FIGHTING', images.laser], ['HORROR', images.hallway], ['STORY-RICH', images.dungeon], ['SPORTS', images.tornado], ['ADVENTURE', images.jungle]
];

const paidPromotions = [
  { id: 'promo1', title: 'Dragon\'s Hoard', author: 'Sponsored Builds', category: 'RPG', image: images.hallway, worldId: 'hallway', views: '342', reviews: '76.2%', reviewCount: '89', players: '1-4', description: 'A massive dragon treasure dungeon built by our sponsor.', tags: ['RPG', 'Adventure'], time: '30m+', guid: '99900000111', type: 'RPG', sponsored: true },
  { id: 'promo2', title: 'Speed Run Plaza', author: 'Sponsored Builds', category: 'Platformer', image: images.portals, worldId: 'portals', views: '521', reviews: '71.8%', reviewCount: '156', players: '1', description: 'The ultimate speedrun course — promoted by our partners.', tags: ['Platformer', 'Action'], time: '5m 00s', guid: '99900000222', type: 'Platformer', sponsored: true },
  { id: 'promo3', title: 'Battle Arena X', author: 'Sponsored Builds', category: 'PvP', image: images.laser, worldId: 'laser', views: '278', reviews: '68.5%', reviewCount: '67', players: '4-8', description: 'Sponsored PvP arena with power-ups and ranked matchmaking.', tags: ['PvP', 'Action', 'Competitive'], time: '8m 30s', guid: '99900000333', type: 'PvP', sponsored: true },
  { id: 'promo4', title: 'Pet Paradise VIP', author: 'Sponsored Builds', category: 'Idle', image: images.pets, worldId: 'pets', views: '195', reviews: '65.0%', reviewCount: '42', players: '1', description: 'Exclusive VIP pet club zone — sponsored content with premium features.', tags: ['Idle', 'Relaxing'], time: '15m+', guid: '99900000444', type: 'Idle', sponsored: true },
  { id: 'promo5', title: 'Neon Drift GP', author: 'Sponsored Builds', category: 'Racing', image: images.tornado, worldId: 'tornado', views: '423', reviews: '73.1%', reviewCount: '118', players: '2-6', description: 'High-speed neon racing sponsored by DriftEnergy. Feel the speed at full.', tags: ['Racing', 'Action'], time: '6m 15s', guid: '99900000555', type: 'Racing', sponsored: true }
];

const playlists = [
  { title: 'Late Night Worlds', creator: 'Mira Makes Lists', rating: '94%', count: '12 worlds', image: images.hallway },
  { title: 'Play With Friends', creator: 'The Co-op Club', rating: '91%', count: '8 worlds', image: images.coOp },
  { title: 'Best Short Sessions', creator: 'Quickplay Weekly', rating: '89%', count: '16 worlds', image: images.laser }
];

let activeWorld = null;
let featuredIndex = 0;
let currentPage = 'for-you';

const app = document.querySelector('#app');
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const worldById = (id) => worlds.find((world) => world.id === id) || worlds[0];

function icon(symbol, label) { return `<span class="icon" aria-hidden="true">${symbol}</span><span class="sr-only">${label}</span>`; }

function header() {
  return `<header class="topbar">
    <a class="brand" href="#top" aria-label="Wonderlands home"><span class="brand-mark">✦</span><span>Miliastra Wonderlands</span></a>
    <nav class="primary-nav" aria-label="Primary navigation">
      <button class="nav-link ${currentPage === 'for-you' ? 'active' : ''}" data-page="for-you">For you</button>
      <button class="nav-link ${currentPage === 'notice-me' ? 'active' : ''}" data-page="notice-me">Notice me</button>
      <button class="nav-link ${currentPage === 'hidden' ? 'active' : ''}" data-page="hidden">Hidden Gems</button>
    </nav>
    <div class="header-actions"><button class="ghost-button" data-action="open-search">Search</button><button class="ghost-button" data-action="open-library">Library</button><button class="profile-button">M</button></div>
  </header>`;
}

function categoryBrowser() {
  return `<section class="category-browser" id="categories"><div class="section-heading"><div><p class="eyebrow">Explore the library</p><h2>Browse by Category</h2></div></div><div class="category-grid">${categories.map(([name, image]) => `<button class="category-tile" data-category="${name}"><img src="${image}" alt=""><span>${name}</span></button>`).join('')}</div><div class="category-grid row2">${categoriesRow2.map(([name, image]) => `<button class="category-tile" data-category="${name}"><img src="${image}" alt=""><span>${name}</span></button>`).join('')}</div></section>`;
}

function featured() {
  const featuredWorlds = [worlds[0], worlds[7], worlds[3]];
  const world = featuredWorlds[featuredIndex];
  return `<section class="featured-layout" id="top"><div class="featured-art"><img src="${world.image}" alt="${escapeHtml(world.title)}"><button class="slide-arrow left" data-action="featured-prev">‹</button><button class="slide-arrow right" data-action="featured-next">›</button><div class="feature-bottom"><button class="primary-button" data-world="${world.id}">View Wonderland</button><div class="feature-dots">${featuredWorlds.map((_, index) => `<i class="${index === featuredIndex ? 'selected' : ''}"></i>`).join('')}</div></div></div><button class="featured-info" data-world="${world.id}"><h1>${escapeHtml(world.title)}</h1><div class="chip-row"><span class="chip">${world.category}</span><span class="chip pale">${world.players === '1' ? 'Single Player' : `${world.players} Players`}</span></div><div class="metric-line"><span class="views">◉ ${formatPlayCount(world)}</span><span class="good">✓ ${world.reviews}</span></div><div class="video-preview"><img src="${world.image}" alt=""><span class="play">▶</span><b>Guide Video</b></div><div class="featured-desc"><div class="featured-desc-box">${escapeHtml(world.description)}</div></div></button></section>`;
}

function questRail() {
  return `<section class="quick-links"><button class="quick-card"><span class="quick-icon orange">▤</span><span><b>Weekly Quests</b><small>0/12 completed</small></span><strong>›</strong></button><button class="quick-card"><span class="quick-icon blue">▥</span><span><b>Wonderland Collection</b><small>18 discovered</small></span><strong>›</strong></button></section>`;
}

function compactNumber(raw) {
  const n = parseFloat(String(raw).replace(/[,\s]/g, ''));
  if (isNaN(n)) return String(raw);
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function formatPlayCount(world) {
  const num = typeof world.plays === 'number' ? world.plays : parseFloat(String(world.views || '').replace(/[,\s]/g, ''));
  return `${compactNumber(num || 0)} plays`;
}

function worldCard(world, compact = false) {
  return `<button class="world-card ${compact ? 'compact' : ''}" data-world="${world.id}"><div class="card-image"><img src="${world.image}" alt="${escapeHtml(world.title)}"><span class="category-chip">${world.category}</span><span class="views-badge">◉ ${formatPlayCount(world)}</span></div><div class="card-copy"><h3>${escapeHtml(world.title)}</h3><p>by ${escapeHtml(world.author)}</p><div class="card-footer"><div class="card-meta"><span class="good">✓ ${world.reviews}</span><span>${world.players} ${world.players === '1' ? 'player' : 'players'}</span></div><span class="date-text">${world.updated}</span></div></div></button>`;
}

const hallOfFame = worlds.filter((w) => w.plays >= 1000000).sort((a, b) => b.plays - a.plays);
const questingWorlds = worlds.filter((w) => ['Survival', 'Action', 'Racing', 'PvP', 'Party'].includes(w.type));

function hofCard(world, index) {
  return `<button class="world-card hof-card" data-world="${world.id}"><div class="card-image"><img src="${world.image}" alt="${escapeHtml(world.title)}"><span class="category-chip">${world.category}</span><span class="hof-rank">#${index + 1}</span></div><div class="card-copy"><h3>${escapeHtml(world.title)}</h3><p>by ${escapeHtml(world.author)}</p><div class="card-footer"><div class="card-meta"><span class="good">✓ ${world.reviews} rating</span><span>${world.players} ${world.players === '1' ? 'player' : 'players'}</span></div><span class="date-text">${world.updated}</span></div></div></button>`;
}

function playlistCard(playlist) {
  return `<button class="playlist-card"><img src="${playlist.image}" alt=""><div class="playlist-copy"><span class="playlist-mark">▤</span><div><h3>${playlist.title}</h3><p>by ${playlist.creator}</p><small>${playlist.count} · <b>${playlist.rating} rated</b></small></div></div></button>`;
}

function section(title, id, worldsToShow) {
  return `<section class="content-section" id="${id}"><div class="section-heading"><div><p class="eyebrow">Curated for you</p><h2>${title}</h2></div><button class="text-button">See all ›</button></div><div class="world-grid">${worldsToShow.map((world) => worldCard(world)).join('')}</div></section>`;
}

function noticeMePage() {
  const promoCards = paidPromotions.map((p) => `<button class="world-card" data-world="${p.worldId}"><div class="card-image"><img src="${p.image}" alt=""><span class="promo-badge">⭐ Sponsored</span><span class="views-badge">◉ ${formatPlayCount({ views: p.views, plays: p.views })}</span></div><div class="card-copy"><h3>${escapeHtml(p.title)}</h3><p>by ${escapeHtml(p.author)}</p><p class="promo-desc">${escapeHtml(p.description)}</p><div class="card-footer"><div class="card-meta"><span class="good">✓ ${p.reviews}</span><span>${p.players} players</span></div><span class="promo-footer-link">Review ›</span></div></div></button>`).join('');
  return `<section class="reviewer-page">
    <p class="reviewer-tagline">These creators <strong>strongly believe</strong> their wonderlands have potential. Review the ones you play.</p>
    <div class="promo-grid">${promoCards}</div>
  </section>`;
}

function browsePage() {
  let body;
  if (currentPage === 'notice-me') body = `<main class="page-shell">${noticeMePage()}</main>`;
  else if (currentPage === 'hidden') body = `<main class="page-shell">${renderHiddenGemHunt()}</main>`;
  else body = `<main class="page-shell">${categoryBrowser()}${featured()}${questRail()}<section class="tabs-section" id="for-you">    <div class="content-tabs"><button class="tab events-tab" data-tab="events">Events</button><button class="tab active" data-tab="for-you">For you</button><button class="tab" data-tab="recent-updated">Recently Updated</button><button class="tab" data-tab="monthly">Monthly Popular</button><button class="tab" data-tab="hall-of-fame">Hall of fame</button><button class="tab" data-tab="official">Official Picks</button><button class="tab" data-tab="playlists">Playlists</button><button class="tab" data-tab="questing">Questing</button></div><div id="tab-content">${tabContent('for-you')}</div></section></main>`;
  return `${header()}${body}`;
}

function tabContent(tab) {
  if (tab === 'events') return renderEvents();
  if (tab === 'recent-updated') return section('Recently Updated', 'recent-updated', [worlds[3], worlds[2], worlds[9], worlds[7], worlds[0], worlds[4]]);
  if (tab === 'monthly') return section('Monthly Popular', 'monthly', [worlds[3], worlds[7], worlds[4]]);
  if (tab === 'hall-of-fame') {
    const cards = hallOfFame.length ? hallOfFame.map(hofCard).join('') : '<p style="color:#8fa8d6;padding:20px;">No wonderlands have reached 1M plays yet.</p>';
    return `<section class="content-section"><div class="section-heading"><div><p class="eyebrow">The elite</p><h2>Hall of Fame</h2></div><span class="hof-badge">🏆 1M+ plays</span></div><div class="world-grid">${cards}</div><p class="hof-note">Only wonderlands with over <strong>1,000,000 plays</strong> earn a permanent spot. Play count is retired on entry — ranked by community rating.</p></section>`;
  }
  if (tab === 'questing') return `<section class="content-section"><div class="section-heading"><div><p class="eyebrow">Best for your goals</p><h2>Questing</h2></div></div><p class="questing-note">Stages best suited to clearing your current quests — daily tasks, weekly goals, and exp grinds.</p><div class="quest-grid">${questingWorlds.map((world) => worldCard(world)).join('')}</div></section>`;
  if (tab === 'official') return section('Official Picks', 'official', [worlds[7], worlds[3], worlds[5]]);  if (tab === 'hidden') return section('Hidden Gem Hunt', 'hidden', [worlds[9], worlds[8], worlds[2]]);
  if (tab === 'playlists') return `<section class="content-section"><div class="section-heading"><div><p class="eyebrow">Rated collections by people</p><h2>Playlists</h2></div></div><div class="playlist-grid">${playlists.map(playlistCard).join('')}</div></section>`;
  return `<div>${section('Recommended for you', 'recommended', [worlds[1], worlds[2], worlds[3]])}<br>${section('Rising stars', 'rising', [worlds[8], worlds[9], worlds[4]])}</div>`;
}

function render() { app.innerHTML = activeWorld ? renderDetailPage(activeWorld) : browsePage(); }

function setTab(tab) { document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); const target = document.querySelector('#tab-content'); if (target) target.innerHTML = tabContent(tab); }

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-world], [data-action], [data-tab], [data-review], [data-category], [data-page], [data-promo-vote], [data-gem-cat], [data-gem-action], [data-gem-vote], [data-gem-review]');
  if (!target) return;
  if (target.dataset.page) { currentPage = target.dataset.page; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (target.dataset.world) { activeWorld = worldById(target.dataset.world); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (target.dataset.tab) { setTab(target.dataset.tab); return; }
  if (target.dataset.category) { const category = target.dataset.category.toLowerCase(); setTab(category.includes('puzzle') ? 'hall-of-fame' : category.includes('survival') ? 'hidden' : 'monthly'); document.querySelector('#for-you')?.scrollIntoView({ behavior: 'smooth' }); return; }
  if (target.dataset.gemCat || target.dataset.gemAction || target.dataset.gemVote || target.dataset.gemReview) { handleGemClick(target); return; }
  if (target.dataset.promoVote) {
    const vote = target.dataset.vote;
    target.closest('.promo-card')?.querySelector('.promo-actions')?.replaceChildren(`<span class="promo-voted">${vote === 'yes' ? '✓ Noted as worth a look' : '✗ Registered as not my thing'}</span>`);
    return;
  }
  if (target.dataset.action === 'close-detail') { activeWorld = null; render(); return; }
  if (target.dataset.action === 'featured-prev') { featuredIndex = (featuredIndex + 2) % 3; render(); return; }
  if (target.dataset.action === 'featured-next') { featuredIndex = (featuredIndex + 1) % 3; render(); return; }
  if (target.dataset.action === 'copy-guid') { navigator.clipboard?.writeText(activeWorld.guid); target.textContent = 'Copied'; setTimeout(() => { target.textContent = 'Copy'; }, 1200); return; }
  if (target.dataset.action === 'check-reviews') { document.querySelector('#reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && activeWorld) { activeWorld = null; render(); } });
render();
