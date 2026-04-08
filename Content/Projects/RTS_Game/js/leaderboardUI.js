export class LeaderboardUI {
  constructor(leaderboard) {
    this.leaderboard = leaderboard;
    this.container = null;
    this.setupUI();
  }

  setupUI() {
    this.container = document.createElement('div');
    this.container.classList.add('menu-section', 'sub-menu');
    this.container.id = 'leaderboard-section';
    
    this.container.innerHTML = `
      <div class="leaderboard-content">
        <div class="leaderboard-section">
          <h3>Top Players</h3>
          <div class="top-players-list"></div>
        </div>

        <div class="leaderboard-section">
          <h3>Recent Games</h3>
          <div class="recent-games-list"></div>
        </div>
      </div>
    `;

    // Add to the menu container
    document.querySelector('.menu-container').appendChild(this.container);

    // Subscribe to leaderboard updates
    this.leaderboard.subscribeToLeaderboard(data => this.updateUI(data));
  }

  show() {
    // Hide all other sub-menus
    document.querySelectorAll('.sub-menu').forEach(menu => {
      menu.classList.remove('active');
    });
    
    // Show leaderboard
    this.container.classList.add('active');
  }

  hide() {
    this.container.classList.remove('active');
  }

  updateUI(data) {
    this.updateTopPlayers(data.topPlayers);
    this.updateRecentGames(data.recentGames);
  }

  updateTopPlayers(topPlayers) {
    const list = this.container.querySelector('.top-players-list');
    list.innerHTML = topPlayers.map((player, index) => `
      <div class="leaderboard-row">
        <div class="rank">#${index + 1}</div>
        <div class="player-info">
          <div class="username">${player.username}</div>
          <div class="details">
            <span class="score">${player.score} pts</span>
            <span class="skill">${player.skillRating}</span>
            <span class="playstyle">${player.playstyle}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  updateRecentGames(games) {
    const list = this.container.querySelector('.recent-games-list');
    list.innerHTML = games.map(game => {
      const date = new Date(game.timestamp).toLocaleDateString();
      return `
        <div class="leaderboard-row">
          <div class="game-info">
            <div class="primary-info">
              <span class="username">${game.username}</span>
              <span class="score">${game.aiScore} pts</span>
            </div>
            <div class="secondary-info">
              <span class="date">${date}</span>
              <span class="skill">${game.skillRating}</span>
              <span class="playstyle">${game.playstyle}</span>
            </div>
            <div class="ai-comment">"${game.aiComment}"</div>
          </div>
        </div>
      `;
    }).join('');
  }
}