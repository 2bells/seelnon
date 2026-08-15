import { worlds, worldCard, escapeHtml } from './main.js';

const worldById = (id) => worlds.find((w) => w.id === id);

const GENRES = {
  'ROGUE-LIKE': {
    tagline: 'Procedural depths, permanent death, and the pull of one more run.',
    pool: ['catacombs', 'portals', 'laser', 'hallway', 'sands', 'verdant']
  },
  'SURVIVAL': {
    tagline: 'Gather, endure, and make it through to the next dawn.',
    pool: ['river', 'catacombs', 'sands', 'oasis', 'verdant', 'hallway']
  },
  'PUZZLE': {
    tagline: 'Quiet logic, clever rooms, and solutions that click into place.',
    pool: ['portals', 'tiles', 'catacombs', 'oasis', 'hallway']
  },
  'RACING': {
    tagline: 'High-speed circuits where every corner eats the hesitant.',
    pool: ['apex', 'tornado', 'nova', 'laser', 'bedwars']
  },
  'ACTION': {
    tagline: 'Fast hands, sharp timing, and no room for second guesses.',
    pool: ['laser', 'bedwars', 'apex', 'river', 'nova', 'catacombs']
  },
  'CO-OP': {
    tagline: 'Built for partners — divide, conquer, and escape together.',
    pool: ['dual', 'bedwars', 'nova', 'tornado', 'apex']
  },
  'FIGHTING': {
    tagline: 'One versus one, bracket, or brawl — prove you belong.',
    pool: ['bedwars', 'laser', 'apex', 'nova', 'dual']
  },
  'HORROR': {
    tagline: 'Dark corners, moving lights, and things best left unseen.',
    pool: ['hallway', 'catacombs', 'midnight', 'river', 'sands']
  },
  'STORY-RICH': {
    tagline: 'Worlds with weight, where every choice leaves a mark.',
    pool: ['sands', 'midnight', 'kingdom', 'verdant', 'nova', 'oasis']
  },
  'SPORTS': {
    tagline: 'Bring the chaos. Somewhere between a scrim and a festival.',
    pool: ['tornado', 'bedwars', 'pets', 'dual', 'apex']
  },
  'ADVENTURE': {
    tagline: 'Wide horizons, hidden groves, and a world that rewards wandering.',
    pool: ['verdant', 'oasis', 'kingdom', 'midnight', 'sands', 'river']
  }
};

const setLenses = [
  { eyebrow: 'Community favourites', title: 'Most Recommended', sort: 'rating' },
  { eyebrow: 'Fresh off the server', title: 'Most Recent', sort: 'recency' },
  { eyebrow: 'Criminally underrated', title: 'Possible Hidden Gems', sort: 'gem' },
  { eyebrow: 'Timeless classics', title: 'Strong Entries of the Past', sort: 'classic' },
  { eyebrow: 'Saved by the community', title: 'Most Bookmarked', sort: 'plays' },
  { eyebrow: 'The rare finds', title: 'Rarities', sort: 'rarity' }
];

function pct(value) { return parseFloat(String(value).replace(/[^\d.]/g, '')) || 0; }
function playsOf(world) {
  if (typeof world.plays === 'number') return world.plays;
  return parseFloat(String(world.views || '').replace(/[^\d]/g, '')) || 0;
}
function recencyIndex(updated) {
  const m = String(updated).match(/(\d+)\s*([hdwm])/);
  if (!m) return 999;
  const unit = { h: 0, d: 1, w: 2, m: 3 }[m[2]] ?? 4;
  return unit * 100 + parseInt(m[1], 10);
}

function order(items, sort) {
  switch (sort) {
    case 'rating': return [...items].sort((a, b) => pct(b.reviews) - pct(a.reviews));
    case 'recency': return [...items].sort((a, b) => recencyIndex(a.updated) - recencyIndex(b.updated));
    case 'gem': return [...items].sort((a, b) => (pct(b.reviews) - playsOf(b)) - (pct(a.reviews) - playsOf(a)));
    case 'classic': return [...items].sort((a, b) => recencyIndex(b.updated) - recencyIndex(a.updated) || playsOf(b) - playsOf(a));
    case 'plays': return [...items].sort((a, b) => playsOf(b) - playsOf(a));
    case 'rarity': return [...items].sort((a, b) => playsOf(a) - playsOf(b) || pct(b.reviews) - pct(a.reviews));
    default: return [...items];
  }
}

function buildSets(category) {
  const genre = GENRES[category] || GENRES['ADVENTURE'];
  const pool = genre.pool.map(worldById).filter(Boolean);
  return setLenses.map((lens) => ({ eyebrow: lens.eyebrow, title: lens.title, items: order(pool, lens.sort).slice(0, 3) }));
}

export function renderLibraryPage(category) {
  const genre = GENRES[category] || GENRES['ADVENTURE'];
  const name = GENRES[category] ? category : 'ADVENTURE';
  const heroImage = (genre.pool.map(worldById).filter(Boolean)[0] || worlds[0]).image;
  const sets = buildSets(name);
  return `
  <div class="library-page">
    <section class="library-hero">
      <img src="${heroImage}" alt="" class="library-hero-bg">
      <div class="library-hero-copy">
        <p class="events-eyebrow">Genre library</p>
        <h1>${escapeHtml(name)}</h1>
        <p>${escapeHtml(genre.tagline)}</p>
        <span class="library-pill">${sets.reduce((n, s) => n + s.items.length, 0)} stages</span>
      </div>
    </section>
    <nav class="library-genres">${Object.keys(GENRES).map((g) => `<button class="library-genre ${g === name ? 'active' : ''}" data-library="${g}">${escapeHtml(g)}</button>`).join('')}</nav>
    ${sets.map((set) => `<section class="content-section library-set"><div class="section-heading"><div><p class="eyebrow">${set.eyebrow}</p><h2>${set.title}</h2></div></div><div class="world-grid">${set.items.map(worldCard).join('')}</div></section>`).join('')}
  </div>`;
}