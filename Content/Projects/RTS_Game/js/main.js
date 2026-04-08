import { Game } from './game.js';
import { AIChat } from './aichats.js';
import { Leaderboard } from './leaderboard.js';
import { LeaderboardUI } from './leaderboardUI.js';
import { EndlessGame } from './endlessGame.js';

const assetLoader = {
  images: new Map(),
  loadedCount: 0,
  totalCount: 0,
  loadingCallbacks: [],

  async preloadAssets() {
    const assets = [
      "ground_tile_4.png",
      "small_dirt_patch_2.png", 
      "base_red_2.png",
      "small_dirt_patch.png",
      "small_stones.png",
      "small_bush.png",
      "circle_player_selected.png",
      "circle_enemy.png",
      "square_player_picked.png",
      "square_enemy.png",
      "game_gold_4.png",
      "circle_player.png",
      "triangle_player_selected.png",
      "game_tree_2.png",
      "triangle_player.png",
      "triangle_enemy.png",
      "base_blue_2.png",
      "small_stones_2.png",
      "square_player.png"
    ];

    this.totalCount = assets.length;
    this.loadedCount = 0;

    const loadPromises = assets.map(src => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.loadedCount++;
          this.updateLoadingProgress(src, true);
          this.triggerLoadingCallbacks();
          resolve();
        };
        img.onerror = () => {
          this.loadedCount++;
          this.updateLoadingProgress(src, false);
          this.triggerLoadingCallbacks();
          resolve(); // Resolve even on error to continue loading
        };
        img.src = src;
        this.images.set(src, img);
      });
    });

    await Promise.all(loadPromises);

    // Hide loading screen after all assets are loaded
    document.getElementById('loading-screen').style.display = 'none';

    return this.images;
  },

  updateLoadingProgress(currentAsset, success) {
    const progressBar = document.getElementById('loading-progress-bar');
    const progressText = document.getElementById('loading-progress-text');
    const currentAssetText = document.getElementById('loading-current-asset');

    const progress = (this.loadedCount / this.totalCount) * 100;
    
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
    
    if (progressText) {
      progressText.textContent = `Loading assets: ${Math.round(progress)}%`;
    }
    
    if (currentAssetText) {
      const status = success ? ' Loaded' : ' Failed';
      currentAssetText.textContent = `${currentAsset}: ${status}`;
    }
  },

  // Allow other parts of the code to register callbacks for loading progress
  onLoadingProgress(callback) {
    this.loadingCallbacks.push(callback);
  },

  triggerLoadingCallbacks() {
    const progress = (this.loadedCount / this.totalCount) * 100;
    this.loadingCallbacks.forEach(cb => cb(progress, this.loadedCount, this.totalCount));
  },

  getImage(src) {
    return this.images.get(src);
  }
};

window.globalAssetLoader = assetLoader;

// Determine if we are in offline mode (e.g., running on localhost or file protocol)
window.isOfflineMode = true; // Offline mode is off by default
if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
  window.isOfflineMode = true; // Enable offline mode if running locally or from file system
}
console.log(`Offline Mode: ${window.isOfflineMode}`);

let game = null;
let backgroundGame = null;
let leaderboard = null;
let leaderboardUI = null;

// Initialize background endless game
async function initializeBackgroundGame() {
  // Wait for assets to be fully loaded before starting background game
  await assetLoader.preloadAssets();

  const backgroundCanvas = document.getElementById('backgroundCanvas');
  backgroundCanvas.width = window.innerWidth;
  backgroundCanvas.height = window.innerHeight;
  
  // Pass offlineMode to EndlessGame
  backgroundGame = new EndlessGame(backgroundCanvas, window.isOfflineMode);
  backgroundGame.start();
}

// Handle window resize for background game
window.addEventListener('resize', () => {
  if (backgroundGame) {
    const canvas = document.getElementById('backgroundCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    backgroundGame.resize();
  }
});

// Stop background game
function stopBackgroundGame() {
  if (backgroundGame) {
    backgroundGame.stop(); 
    backgroundGame = null;
  }
}

// Conditionally initialize leaderboard and leaderboard UI
if (!window.isOfflineMode) {
  leaderboard = new Leaderboard();
  leaderboardUI = new LeaderboardUI(leaderboard);
} else {
  console.log("Leaderboard and LeaderboardUI disabled in offline mode.");
  // Still need a dummy leaderboard for subscription even if UI is hidden to avoid errors
  leaderboard = new Leaderboard(true); 
  leaderboardUI = new LeaderboardUI(leaderboard); // Create a dummy UI to prevent errors if methods are called
  document.getElementById('show-leaderboard').style.display = 'none'; // Hide the button
}

// Add leaderboard button handler
document.getElementById('show-leaderboard').addEventListener('click', () => {
  if (leaderboardUI) { // Only show if UI exists and is not a dummy (or if the dummy has a show method)
    leaderboardUI.show();
  }
});

// Main menu controls
const paceSlider = document.getElementById('game-pace');
const paceValue = document.getElementById('pace-value');
const modeButtons = document.querySelectorAll('.mode-btn');
const aiPercentageSlider = document.getElementById('ai-percentage');
const aiPercentageValue = document.getElementById('ai-percentage-value');
const aiPlaysWithYouCheckbox = document.getElementById('ai-plays-with-you');

// Update pace value display
paceSlider.addEventListener('input', (e) => {
  paceValue.textContent = e.target.value;
});

// Update AI percentage value display
aiPercentageSlider.addEventListener('input', (e) => {
  aiPercentageValue.textContent = e.target.value;
});

document.querySelectorAll('.multiplier-container input').forEach(input => {
  input.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    e.target.closest('.multiplier-container').querySelector('.multiplier-value').textContent = `${value}x`;
  });
});

// Handle game mode selection
modeButtons.forEach(button => {
  button.addEventListener('click', async () => {
    const mode = button.dataset.mode;
    const spawnInterval = parseInt(paceSlider.value);
    const aiPercentage = parseInt(aiPercentageSlider.value);
    const aiPlaysWithYou = aiPlaysWithYouCheckbox.checked;
    await startGame(mode, spawnInterval, aiPercentage, aiPlaysWithYou); 
  });
});

// Handle map selection
const mapOptions = document.querySelectorAll('.map-option');
let selectedMap = 'balanced'; // Default map

mapOptions.forEach(option => {
  option.addEventListener('click', () => {
    mapOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedMap = option.dataset.map;
  });
});

const difficultyPresets = {
  easy: {
    spawnTime: 1.5,
    damage: 0.8,
    unitCost: 0.8,
    goldRate: 1.2,
    captureTime: 0.8,
    resourceHP: 0.8,
    buildingCost: 0.8,
    buildingHP: 1.2
  },
  normal: {
    spawnTime: 1,
    damage: 1,
    unitCost: 1,
    goldRate: 1,
    captureTime: 1,
    resourceHP: 1,
    buildingCost: 1,
    buildingHP: 1
  },
  hard: {
    spawnTime: 0.8,
    damage: 1.2,
    unitCost: 1.2,
    goldRate: 0.8,
    captureTime: 1.2,
    resourceHP: 1.2,
    buildingCost: 1.2,
    buildingHP: 0.8
  },
  insane: {
    spawnTime: 0.6,
    damage: 1.5,
    unitCost: 1.5,
    goldRate: 0.6,
    captureTime: 1.5,
    resourceHP: 1.5,
    buildingCost: 1.5,
    buildingHP: 0.6
  }
};

function applyDifficultyPreset(difficulty) {
  const preset = difficultyPresets[difficulty];
  if (!preset) return;

  Object.entries(preset).forEach(([key, value]) => {
    const input = document.getElementById(`${key}-multiplier`);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  });
}

async function startGame(mode, spawnInterval, aiPercentage, aiPlaysWithYou) {
  // Show loading screen
  document.getElementById('loading-screen').style.display = 'flex';
  
  try {
    // Preload assets before starting game
    await assetLoader.preloadAssets();

    // Stop background game before starting new game
    stopBackgroundGame();
    
    // Hide main menu and background game canvas
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('backgroundCanvas').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';

    // Reset game-over display
    document.getElementById('game-over').style.display = 'none';

    // Create game instance with asset loader and offlineMode
    game = new Game(mode, spawnInterval, aiPercentage, selectedMap, assetLoader, window.isOfflineMode);
    game.leaderboard = leaderboard; // Pass the (potentially dummy) leaderboard instance
    game.useAIYou = aiPlaysWithYou;
    game.aiControllerYou.setAIPercentage(aiPercentage);
    game.start();
  } catch (error) {
    console.error('Error loading game assets:', error);
    // Show error message to user
    document.getElementById('loading-progress-text').textContent = 'Error loading game assets. Please refresh the page.';
  }
}

function backToMenu() {
  // Stop current game
  if (game) {
    game.stop(); // Implement stop method in Game class to clean up
    
    // Reset scoring
    if (game.scoring) {
      game.scoring.reset();
    }
    
    game = null;
  }

  // Remove any existing AI chat container
  let aiChatInstance = document.querySelector('#ai-chat-container');
  if (aiChatInstance) {
    aiChatInstance.remove();
  }

  // Reset UI
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
  document.getElementById('main-menu').style.display = 'flex';
  document.getElementById('backgroundCanvas').style.display = 'block';

  // Clear game over messages
  const gameOverMessage = document.getElementById('game-over-message');
  const aiTrashTalk = document.getElementById('ai-trash-talk');
  const gameScore = document.getElementById('game-score');
  const respondButton = document.getElementById('respond-button');
  
  if (gameOverMessage) gameOverMessage.textContent = '';
  if (aiTrashTalk) aiTrashTalk.textContent = '';
  if (gameScore) gameScore.innerHTML = '';
  if (respondButton) respondButton.innerHTML = ''; // Clear the respond button content

  // Reinitialize background game if not running
  if (!backgroundGame) {
    initializeBackgroundGame();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeBackgroundGame();
  document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);
});