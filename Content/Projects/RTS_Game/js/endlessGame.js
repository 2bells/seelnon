import { Game } from './game.js';
import { EndlessController } from './endlessController.js';
import { Grid } from './grid.js';
import { Vector2 } from './vector2.js';
import { Building } from './building.js';
import { Unit } from './unit.js';
//import { UpgradeManager } from './upgrades.js';
import { ExpUpgradeManager } from './exp-upgrades.js';

export class EndlessGame extends Game {
  constructor(canvas, offlineMode = false) {
    // Use the global asset loader and pass it explicitly to super
    super('endless', 100, 100, 'endless', window.globalAssetLoader, offlineMode);
    
    // Store reference to asset loader
    this.assetLoader = window.globalAssetLoader;
    
    // Use provided canvas or fallback
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Initialize basic properties
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.resources = [];
    this.woodResources = [];
    this.playerGold = 500;
    this.enemyGold = 500;
    this.playerWood = 0;
    this.enemyWood = 0;
    
    // Endless mode specific properties
    this.endlessController = null;
    this.gameOver = false;
    
    // Initialize grid and pass the asset loader
    this.grid = new Grid(this);
    
    // Initialize when DOM is ready
    this.initializeWhenReady();
    
    this.frameCount = 0;
    this.lastRender = performance.now();
    this.fps = 60;
    this.fpsInterval = 1000 / this.fps;
    this.running = true;

    //this.upgradeManager = new UpgradeManager(this); // Initialize UpgradeManager
    this.expUpgradeManager = new ExpUpgradeManager(this); // Initialize ExpUpgradeManager
  }

  async initialize() {
    // Setup canvas
    this.resize();
    
    // Make sure assets are loaded before continuing
    if (!this.assetLoader.loadedCount) {
      await this.assetLoader.preloadAssets();
    }
    
    // Initialize endless controller with asset loader reference
    this.endlessController = new EndlessController(this);
    
    // Hide standard game UI
    this.hideGameUI();
    
    // Override checkWinCondition to do nothing in endless mode
    this.checkWinCondition = () => {};
  }

  addBackToMenuButton() {
    const button = document.createElement('button');
    button.textContent = 'Back to Menu';
    button.style.position = 'fixed';
    button.style.top = '20px';
    button.style.left = '20px';
    button.style.zIndex = '1000';
    button.style.padding = '10px 20px';
    button.style.fontSize = '16px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    
    button.addEventListener('click', () => {
      window.location.reload();
    });
    
    document.body.appendChild(button);
  }

  hideGameUI() {
    const ui = document.getElementById('ui');
    if (ui) ui.style.display = 'none';
  }

  update() {
    this.frameCount++;
    if (this.endlessController) {
      this.endlessController.update();
    }

    // Update all game objects
    this.units.forEach(unit => unit.update());
    this.buildings.forEach(building => building.update());
    this.projectiles.forEach(projectile => projectile.update());
    this.resources.forEach(resource => resource.update());
    this.woodResources.forEach(resource => resource.update());

    // Filter out dead/depleted objects
    this.units = this.units.filter(unit => unit.health > 0);
    this.buildings = this.buildings.filter(building => building.health > 0);
    this.projectiles = this.projectiles.filter(projectile => !projectile.dead);
    this.resources = this.resources.filter(resource => !resource.depleted);
    this.woodResources = this.woodResources.filter(resource => !resource.depleted);

    // Update grid
    if (this.grid) {
      this.grid.update();
    }

    // Update projectiles
    this.projectiles.forEach(projectile => {
      if (projectile.target) {
        let distance = projectile.position.subtract(projectile.target.position).length();
        if (distance < projectile.target.size / 2) {
          projectile.hit();
        }
      }
    });

    /*
    if (this.upgradeManager) {
      this.upgradeManager.update();
    }
    */
    if (this.expUpgradeManager) {
      //this.expUpgradeManager.update();
    }
  }

  draw() {
    // Implement frame limiting
    const now = performance.now();
    const elapsed = now - this.lastRender;

    if (elapsed < this.fpsInterval) {
      return; // Skip this frame
    }

    this.lastRender = now - (elapsed % this.fpsInterval);

    if (!this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = '#1a4d1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    if (this.grid) {
      this.grid.draw(this.ctx);
    }

    // Combine all renderable objects into one array and sort them by Y position
    const renderables = [
      ...this.buildings,
      ...this.resources,
      ...this.woodResources,
      ...this.units,
      ...this.projectiles
    ].sort((a, b) => a.position.y - b.position.y);

    // Draw the sorted objects
    renderables.forEach(renderable => {
      renderable.draw(this.ctx);
    });
  }

  start() {
    this.gameLoop();
  }

  stop() {
    this.running = false;
    
    // Clear all game objects
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.resources = [];
    this.woodResources = [];
    
    // Clear the canvas
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  gameLoop() {
    if (!this.running) return; // Stop the game loop if not running
    
    this.update();
    window.requestAnimationFrame(() => {
      this.draw();
      this.gameLoop();
    });
  }
}