// Feed — in-game screenshot showcase.

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

const STARS_KEY = 'wonderlands_feed_stars';
const likedPosts = new Set();

function savedStars() {
  try {
    const value = JSON.parse(localStorage.getItem(STARS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const starred = (key) => savedStars().includes(key);

export function togglePostLike(key) {
  if (likedPosts.has(key)) { likedPosts.delete(key); return false; }
  likedPosts.add(key); return true;
}

export function togglePostStar(key) {
  const list = savedStars();
  const index = list.indexOf(key);
  if (index >= 0) list.splice(index, 1);
  else list.push(key);
  localStorage.setItem(STARS_KEY, JSON.stringify(list));
  return index < 0;
}

const posts = [
  { user: 'Backrooms Dev', world: 'Hallway Psychosis', img: 'https://images.pexels.com/photos/30299504/pexels-photo-30299504.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '2h ago', caption: 'Beware of dark' },
  { user: 'NeonForge', world: 'Laser Dungeon', img: 'https://images.pexels.com/photos/36488270/pexels-photo-36488270.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '3h ago', caption: 'Trap ahead' },
  { user: '小问号Official', world: 'Dual Escape', img: 'https://images.pexels.com/photos/35835479/pexels-photo-35835479.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '4h ago', caption: 'Good times ahead' },
  { user: 'CozyStudio', world: 'Pet Me!', img: 'https://images.pexels.com/photos/37891869/pexels-photo-37891869.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '5h ago', caption: 'Take the plunge' },
  { user: 'CosmicPilot', world: 'Nova Drift', img: 'https://images.pexels.com/photos/6249474/pexels-photo-6249474.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '7h ago', caption: 'Visions of galaxy' },
  { user: 'NeonWanderer', world: 'Midnight Market', img: 'https://images.pexels.com/photos/932262/pexels-photo-932262.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '9h ago', caption: 'Mimic ahead' },
  { user: 'DuneRider', world: 'Sands of Echo', img: 'https://images.pexels.com/photos/2422915/pexels-photo-2422915.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '11h ago', caption: 'Still no maidens' },
  { user: 'FrostByte', world: 'Monster River', img: 'https://images.pexels.com/photos/65061/pexels-photo-65061.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '13h ago', caption: 'Ice ahead, friend?' },
  { user: 'BoneKeeper', world: 'Sunken Catacombs', img: 'https://images.pexels.com/photos/10474995/pexels-photo-10474995.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '15h ago', caption: 'Darkness beyond' },
  { user: 'MedievalWorks', world: 'Kingdom Reborn', img: 'https://images.pexels.com/photos/1047495/pexels-photo-1047495.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '17h ago', caption: 'Praise the sun!' },
  { user: 'SkyRaiders', world: 'Bed Wars', img: 'https://images.pexels.com/photos/12354672/pexels-photo-12354672.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '19h ago', caption: 'Try jumping' },
  { user: 'JungleCall', world: 'Verdant Atoll', img: 'https://images.pexels.com/photos/1174732/pexels-photo-1174732.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '21h ago', caption: 'Liar ahead' },
  { user: 'StormLine', world: 'Apex Circuit', img: 'https://images.pexels.com/photos/1591362/pexels-photo-1591362.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '22h ago', caption: 'No stopping' },
  { user: 'Mira Makes Lists', world: 'Nova Drift', img: 'https://images.pexels.com/photos/12187128/pexels-photo-12187128.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', time: '23h ago', caption: 'Chest ahead' },
];

function postCard(post, key) {
  const liked = likedPosts.has(key);
  const kept = starred(key);
  return `
  <article class="feed-post">
    <div class="post-img"><img src="${post.img}" alt="In-game screenshot by ${escapeHtml(post.user)}" loading="lazy"></div>
    <div class="post-info">
      <div class="post-head">
        <div class="post-user"><b>${escapeHtml(post.user)}</b><span>${escapeHtml(post.world)}</span></div>
        <span class="post-time">${post.time}</span>
      </div>
      <p class="post-caption">${escapeHtml(post.caption)}</p>
      <div class="post-actions">
        <button class="post-btn ${liked ? 'active' : ''}" data-post-like="${key}" aria-pressed="${liked}"><span class="glyph">${liked ? '♥' : '♡'}</span><span class="label">Like</span></button>
        <button class="post-btn ${kept ? 'active' : ''}" data-post-star="${key}" aria-pressed="${kept}"><span class="glyph">${kept ? '★' : '☆'}</span><span class="label">Starred</span></button>
      </div>
    </div>
  </article>`;
}

export function renderFeedPage() {
  return `
  <section class="feed-page">
    <div class="feed-hero">
      <p class="eyebrow">Shot inside the worlds</p>
      <h1>The Feed</h1>
      <p class="feed-sub">In-game screenshots from the wonderlands. Deleted after 24h, so everything is fresh.</p>
    </div>
    <div class="feed-list">
      ${posts.map((post, index) => postCard(post, String(index))).join('')}
    </div>
  </section>`;
}