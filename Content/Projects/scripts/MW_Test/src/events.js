const eventImages = {
  jamA: 'https://images.pexels.com/photos/205421/pexels-photo-205421.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  jamB: 'https://images.pexels.com/photos/1591373/pexels-photo-1591373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  jamC: 'https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  speedA: 'https://images.pexels.com/photos/1591362/pexels-photo-1591362.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  speedB: 'https://images.pexels.com/photos/1446076/pexels-photo-1446076.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  batonA: 'https://images.pexels.com/photos/10474995/pexels-photo-10474995.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  batonB: 'https://images.pexels.com/photos/12354672/pexels-photo-12354672.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  batonC: 'https://images.pexels.com/photos/11917810/pexels-photo-11917810.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
};

const events = {
  gameJams: [
    { title: 'Groove Garden', author: 'BoomBox', type: 'Musical Platformer', difficulty: 'Medium', plays: '4.2K', rating: '91%', image: eventImages.jamA, note: 'Build a stage around the beat. 3-day jam.' },
    { title: 'Gravity Sketch', author: 'Noodle', type: 'Puzzle', difficulty: 'Hard', plays: '2.8K', rating: '86%', image: eventImages.jamB, note: 'Two hours, one theme, zero rules. Anything goes.' },
    { title: 'Neon Botany', author: 'Ivy', type: 'Idle / Grow', difficulty: 'Easy', plays: '6.1K', rating: '89%', image: eventImages.jamC, note: 'Community theme: Nature Reborn.' }
  ],
  speedruns: [
    { title: 'Cinder Circuit', author: 'BlazeLine', type: 'Racing', goal: 'Sub 2:00', best: '1:47.32', plays: '9.4K', rating: '93%', image: eventImages.speedA, note: 'Current weekly route — beat 1:47.32 for the title.' },
    { title: 'The Long Descent', author: 'CaveGuild', type: 'Platformer', goal: 'Sub 1:30', best: '1:22.09', plays: '5.6K', rating: '88%', image: eventImages.speedB, note: 'Speedrun Challenge finale. Gold currently held by yemi.' }
  ],
  baton: [
    { title: 'Halcyon Harbor', author: 'Kai (Week 1 · base)', tag: 'Base Stage', plays: '12K', rating: '91%', image: eventImages.batonA, note: 'The paid base design — this week anyone can branch it.' },
    { title: 'Halcyon Harbor · Frost', author: 'Lumen', tag: '5 Week Challenge', type: 'Winter Spike', plays: '7.3K', rating: '89%', image: eventImages.batonB, note: 'Picked up Week 2, turned the harbor into a frost maze.' },
    { title: 'Halcyon Harbor · Botanica', author: 'Sage', tag: '5 Week Challenge', type: 'Living Overgrowth', plays: '6.8K', rating: '90%', image: eventImages.batonC, note: 'Week 3 branch — the harbor is now overgrown and alive.' }
  ]
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function jamCard(e) {
  return `<button class="event-card"><div class="card-image"><img src="${e.image}" alt=""><span class="event-tag">Game Jam</span></div><div class="card-copy"><h3>${escapeHtml(e.title)}</h3><p>by ${escapeHtml(e.author)} · ${escapeHtml(e.type)}</p><div class="card-footer"><div class="event-meta"><span>◉ ${e.plays}</span><span class="good">✓ ${e.rating}</span></div><span class="event-difficulty">${e.difficulty}</span></div></div></button>`;
}

function speedCard({ title, author, type, goal, best, plays, rating, image, note }) {
  return `
  <button class="card-event wide"><div class="card-image"><img src="${image}" alt=""><span class="event-tag chalk">Speedrun</span></div><div class="card-copy"><h3>${escapeHtml(title)}</h3><p>by ${escapeHtml(author)} · ${escapeHtml(type)}</p><p class="card-event-note">Goal: <b>${goal}</b> · Current best <b>${best}</b></p><div class="card-footer"><div class="event-meta"><span>◉ ${plays}</span><span class="good">✓ ${rating}</span></div><span class="event-goal">🏆 ${best}</span></div></div></button>`;
}

function batonCard({ title, author, tag, type, plays, rating, image, note }) {
  return `
  <button class="card-baton"><div class="card-image"><img src="${image}" alt=""><span class="event-tag batonTag">${escapeHtml(tag)}</span></div><div class="card-copy"><h3>${escapeHtml(title)}</h3><p>by ${escapeHtml(author)}${type ? ` · ${escapeHtml(type)}` : ''}</p><div class="card-footer"><div class="event-meta"><span>◉ ${plays}</span><span class="good">✓ ${rating}</span></div><span class="event-difficulty">🌳 Open to edit</span></div></div></button>`;
}

function batonExplain() {
  return `
  <div class="baton-explain">
    <div class="baton-explain-head">
      <span class="event-tag batonTag large">Baton Carry</span>
      <h3>Pass the stage, week by week</h3>
    </div>
    <p>Once a patch, a fully themed stage comes out. Anyone can fork it and work on it strictly on the <b>game-server</b> — you can't export locally, so your work lives on the server, where others can pick it up next week.</p>
    <div class="baton-timeline">
      <div class="baton-step"><b>1</b><span>Initial stage drops.<br>Everyone can take it and edit.</span></div>
      <div class="baton-step"><b>2</b><span>Week one passes.<br>Your version is live for others.</span></div>
      <div class="baton-step"><b>3</b><span>Next person takes it, makes it theirs.<br>It branches into new ideas.</span></div>
      <div class="baton-step"><b>4</b><span>Ideas should be stable.<br>Carry the vision.</span></div>
      <div class="baton-step"><b>5</b><span>The final week.<br> It is deadline my dudes.</span></div>
    </div>
    <p class="baton-outro">Week 6 is the play week. Stages that stay popular graduate into full stages. The base design is a <b>paid freelance</b> — the continued reward goes to the people who spent their week improving it. Stages that go the full distance earn the <b>5 Week Challenge</b> tag.</p>
  </div>`;
}

function eventSection(eyebrow, title, gridClass) {
  return `<section class="content-section events-section"><div class="section-heading"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div></div><div class="${gridClass}">`;
}

export function renderEvents() {
  return `
  <div class="events-page">
    <section class="events-hero">
      <p class="events-eyebrow">Ongoing seasons</p>
      <h2>Events</h2>
      <p>Limited-time stages for the whole community. Build, race, or carry a stage forward.</p>
    </section>

    ${batonExplain()}

    ${eventSection('Community build', 'Current Game Jams', 'jam-grid')}${events.gameJams.map(jamCard).join('')}</div></section>

    ${eventSection('Against the clock', 'Speedrun Challenges', 'speed-grid')}${events.speedruns.map(speedCard).join('')}</div></section>

    ${eventSection('Carried by the community', 'Baton Carry Stages', 'baton-grid')}${events.baton.map(batonCard).join('')}</div></section>
  </div>`;
}