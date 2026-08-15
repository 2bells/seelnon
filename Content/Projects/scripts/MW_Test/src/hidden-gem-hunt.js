const gemImages = {
  for1: 'https://images.pexels.com/photos/2422915/pexels-photo-2422915.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  for2: 'https://images.pexels.com/photos/1047495/pexels-photo-1047495.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  lost1: 'https://images.pexels.com/photos/6249474/pexels-photo-6249474.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  lost2: 'https://images.pexels.com/photos/933054/pexels-photo-933054.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  sec1: 'https://images.pexels.com/photos/932262/pexels-photo-932262.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  bad1: 'https://images.pexels.com/photos/1174732/pexels-photo-1174732.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  extra: 'https://images.pexels.com/photos/65061/pexels-photo-65061.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
};

const POOLS = {
  forgotten: { label: 'Forgotten Ones', icon: '⏳', color: '#8B7355' },
  lost: { label: 'Lost in the Sea', icon: '🌊', color: '#3A7BD5' },
  second: { label: 'Second Chance', icon: '🔄', color: '#D4A017' },
  bad: { label: 'Am I That Bad?', icon: '😢', color: '#C0392B' }
};

const stages = [
  { id: 'd1', pool: 'forgotten', title: 'Abandoned Mine', author: 'DustyPick', plays: '43', rating: '81%', image: gemImages.for1 },
  { id: 'd2', pool: 'lost', title: 'Pixel Dreams', author: 'NewDev', plays: '3', rating: '—', image: gemImages.lost1 },
  { id: 'd3', pool: 'second', title: 'Racing Rivals', author: 'SpeedDemon', plays: '14.2K', rating: '84%', image: gemImages.sec1 },
  { id: 'd4', pool: 'bad', title: 'Underwater Maze', author: 'DeepDiver', plays: '234', rating: '38%', image: gemImages.bad1 },
  { id: 'd5', pool: 'forgotten', title: 'Frozen Throne', author: 'IceQueen', plays: '34', rating: '88%', image: gemImages.for2 },
  { id: 'd6', pool: 'lost', title: 'Gravity Shift', author: 'FreshMind', plays: '0', rating: '—', image: gemImages.lost2 },
  { id: 'd7', pool: 'second', title: 'Zombie Outbreak', author: 'Survivor99', plays: '21.3K', rating: '82%', image: gemImages.extra }
];

let playedCount = 0;
function votesForCount(n) { return n >= 7 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0; }
let selectedGems = [];

function votesEarned() { return votesForCount(playedCount); }

function poolLabel(pool) {
  const p = POOLS[pool];
  return `<span class="gem-tag" style="--pool:${p.color}">${p.icon} ${p.label}</span>`;
}

function renderGroupHeader() {
  const votes = votesEarned();
  return `<div class="gem-hero">
    <div class="gem-title-row">
      <h1>Today's Hidden Gems</h1>
      <span class="gem-info" tabindex="0" data-action="reviewer-info">
        <span class="gem-info-pop">🕵️ <b>Be a Reviewer</b> — the wonderlands below are undiscovered. Play + review them to earn votes. Review 3 → 1 vote, 5 → 2 votes, 7 → 3 votes. Spend your votes on the gems you believe in and become their <b>OG</b>, unlocking cosmetics as they climb.</span>
      </span>
    </div>
  </div>`;
}

function renderConfirmBar() {
  const votes = votesEarned();
  const selected = selectedGems.length;
  return `<div class="gem-confirm-bar">
    <div class="gem-stats">
      <span>✅ Reviewed: <strong>${playedCount}</strong>/7</span>
      <span>🗳 Votes earned: <strong>${votes}</strong></span>
      <span>⭐ Voted: <strong>${selected}</strong></span>
    </div>
    <button class="gem-vote-btn" data-gem-action="confirm" ${selected === 0 ? 'disabled' : ''}>Cast ${selected} vote${selected === 1 ? '' : 's'}</button>
  </div>`;
}

function renderStageCard(s) {
  const done = s.reviewed;
  const selected = selectedGems.includes(s.id);
  const pool = POOLS[s.pool];
  const canVote = votesEarned() > 0 && done && !selected;
  return `<div class="world-card gem-stage ${done ? 'done' : ''} ${selected ? 'selected' : ''}">
    <div class="card-image"><img src="${s.image}" alt="${s.title}"><span class="gem-pool-tag" style="--pool:${pool.color}">${pool.label}</span><span class="views-badge">◉ ${s.plays} plays</span></div>
    <div class="card-copy"><h3>${s.title}</h3><p>by ${s.author}</p><div class="card-footer"><span class="gem-rating">${s.rating === '—' ? 'No reviews yet' : s.rating + ' like'}</span><div class="gem-stage-actions">
      <button class="gem-review-btn ${done ? 'played' : ''}" data-gem-review="${s.id}" ${done ? 'disabled' : ''}>${done ? '✓ Reviewed' : '▶ Review'}</button>
      <button class="gem-pick-btn ${selected ? 'spent' : ''}" data-gem-vote="${s.id}" ${!canVote && !selected ? 'disabled' : ''} title="${selected ? 'Voted' : 'Vote'}">${selected ? '★' : '✩'}</button>
    </div></div></div>
  </div>`;
}

export function renderHiddenGemHunt() {
  playedCount = 0;
  selectedGems = [];
  stages.forEach((s) => { s.reviewed = false; });
  const row1 = stages.slice(0, 3).map(renderStageCard).join('');
  const row2 = stages.slice(3).map(renderStageCard).join('');
  return `<section class="hidden-gem-page">${renderGroupHeader()}${renderConfirmBar()}
    <div class="gem-stage-row">${row1}</div>
    <div class="gem-stage-row row2">${row2}</div>
    <div id="gem-content"></div>
  </section>`;
}

function renderGemResult() {
  const selected = stages.filter(s => selectedGems.includes(s.id));
  return `<div class="gem-result-view">
    <div class="gem-result-header">🎉 You are now an <strong>OG</strong> of these stages!</div>
    <p class="gem-result-sub">If any of your picks hit 10K+ plays, you earn exclusive cosmetic <strong>Reviewer Rewards</strong>.</p>
    <div class="gem-result-grid">${selected.map(s => `<div class="gem-result-card"><img src="${s.image}" alt=""><div><h4>${s.title}</h4><p>by ${s.author}</p><span class="gem-og-badge">👑 OG</span></div></div>`).join('')}</div>
    <div class="gem-rewards"><h4>Potential Rewards</h4><div class="gem-reward-list">
      <div class="gem-reward"><span>🥇</span><span>Hit 10K plays → <strong>Golden Nameplate</strong></span></div>
      <div class="gem-reward"><span>🥈</span><span>Hit 50K plays → <strong>Dragon Wings</strong></span></div>
      <div class="gem-reward"><span>🥉</span><span>Hit 100K plays → <strong>Mythic Crown</strong></span></div>
    </div></div>
    <button class="gem-back-btn" data-gem-action="back-pool">← Back to pool</button>
  </div>`;
}

function reRender() {
  const hero = document.querySelector('.gem-hero');
  if (hero) hero.outerHTML = renderGroupHeader();
  const bar = document.querySelector('.gem-confirm-bar');
  if (bar) bar.outerHTML = renderConfirmBar();
  const rows = document.querySelectorAll('.gem-stage-row');
  if (rows.length >= 2) {
    rows[0].innerHTML = stages.slice(0, 3).map(renderStageCard).join('');
    rows[1].innerHTML = stages.slice(3).map(renderStageCard).join('');
  }
  const content = document.querySelector('#gem-content');
  if (content) content.innerHTML = '';
}

export function handleGemClick(target) {
  const reviewId = target.dataset.gemReview;
  if (reviewId) {
    const s = stages.find(st => st.id === reviewId);
    if (!s || s.reviewed) return;
    s.reviewed = true;
    playedCount = stages.filter(st => st.reviewed).length;
    reRender();
    return;
  }

  const voteId = target.dataset.gemVote;
  if (voteId) {
    const s = stages.find(st => st.id === voteId);
    const idx = selectedGems.indexOf(voteId);
    if (idx >= 0) {
      selectedGems.splice(idx, 1);
    } else if (s && votesEarned() > 0 && s.reviewed && selectedGems.length < votesEarned()) {
      selectedGems.push(voteId);
    }
    reRender();
    return;
  }

  if (target.dataset.gemAction === 'confirm') {
    const content = document.querySelector('#gem-content');
    if (content && selectedGems.length > 0) content.innerHTML = renderGemResult();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (target.dataset.gemAction === 'back-pool') {
    selectedGems = [];
    playedCount = 0;
    stages.forEach((s) => { s.reviewed = false; });
    document.querySelector('.hidden-gem-page').outerHTML = renderHiddenGemHunt();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
}