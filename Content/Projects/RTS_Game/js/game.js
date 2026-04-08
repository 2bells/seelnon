import { Unit } from './unit.js';
import { SelectionManager } from './selectionManager.js';
import { Vector2 } from './vector2.js';
import { Building } from './building.js';
import { Grid } from './grid.js';
import { Scoring } from './scoring.js';
import { AIController } from './aiplays.js';
import { MapLoader } from '../maps/mapLoader.js';
import { AIChat } from './aichats.js';
import { UpgradeManager } from './upgrades.js';
import { ExpUpgradeManager } from './exp-upgrades.js';
import { AIControllerYou } from './aiplays_you.js';

export class Game {
  constructor(gameMode = 'rps', spawnInterval = 100, aiPercentage = 100, selectedMap = 'balanced', assetLoader, offlineMode = false) {
    this.assetLoader = assetLoader; 
    this.gameMode = gameMode;
    this.selectedMap = selectedMap;
    this.gameDuration = 0; 
    this.offlineMode = offlineMode;
    
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.resources = [];
    this.woodResources = [];
    this.playerGold = 500; 
    this.playerWood = 0;
    this.enemyWood = 0;
    this.unitTypes = {
      CIRCLE: 'circle',
      SQUARE: 'square',
      TRIANGLE: 'triangle'
    };
    
    switch(gameMode) {
      case 'circle':
        this.selectedUnitType = this.unitTypes.CIRCLE;
        break;
      case 'square':
        this.selectedUnitType = this.unitTypes.SQUARE;
        break;
      case 'triangle':
        this.selectedUnitType = this.unitTypes.TRIANGLE;
        break;
      default:
        this.selectedUnitType = this.unitTypes.CIRCLE;
    }
    
    this.multipliers = {
      spawnTime: parseFloat(document.getElementById('spawn-time-multiplier').value) || 1,
      damage: parseFloat(document.getElementById('damage-multiplier').value) || 1,
      unitCost: parseFloat(document.getElementById('cost-multiplier').value) || 1,
      goldRate: parseFloat(document.getElementById('gold-rate-multiplier').value) || 1,
      captureTime: parseFloat(document.getElementById('capture-time-multiplier').value) || 1,
      resourceHP: parseFloat(document.getElementById('resource-hp-multiplier').value) || 1,
      buildingCost: parseFloat(document.getElementById('building-cost-multiplier').value) || 1,
      buildingHP: parseFloat(document.getElementById('building-hp-multiplier').value) || 1,
      rpsDamage: parseFloat(document.getElementById('rps-damage-multiplier').value) || 3
    };

    this.spawnInterval = spawnInterval * this.multipliers.spawnTime;
    this.unitCosts = {
      [this.unitTypes.CIRCLE]: 50 * this.multipliers.unitCost,
      [this.unitTypes.SQUARE]: 50 * this.multipliers.unitCost,
      [this.unitTypes.TRIANGLE]: 50 * this.multipliers.unitCost
    };
    this.buildingCost = {
      wood: 100 * this.multipliers.buildingCost,
      gold: 1 * this.multipliers.buildingCost
    };

    this.enemyGold = 500;
    this.enemyUnitCost = 50;
    this.playerBaseDestroyed = false;
    this.enemyBaseDestroyed = false;
    this.gameOver = false;

    this.unitComposition = {
      player: {
        circle: 0,
        square: 0,
        triangle: 0
      },
      enemy: {
        circle: 0,
        square: 0,
        triangle: 0
      }
    };

    this.useAI = document.getElementById('use-ai').checked;
    this.aiController = new AIController(this);
    this.aiController.setAIPercentage(aiPercentage);
    this.useAIYou = document.getElementById('ai-plays-with-you').checked;

    this.aiControllerYou = new AIControllerYou(this);
    this.aiControllerYou.setAIPercentage(aiPercentage);
    
    this.scoring = new Scoring();
    this.scoring.setGameMode(gameMode);

    this.mapLoader = new MapLoader();
    
    this.terrain = [];
    this.mapData = null;
    
    this.initializeWhenReady();

    this.leaderboard = null; 

    if (selectedMap === 'ages') {
      this.upgradeManager = new UpgradeManager(this);
    }

    this.expUpgradeManager = new ExpUpgradeManager(this); 
  }

  determineEnemyUnitType() {
    if (this.gameMode !== 'rps') {
      switch(this.gameMode) {
        case 'circle': return 'circle';
        case 'square': return 'square';
        case 'triangle': return 'triangle';
      }
    }
    
    const playerUnits = this.units.filter(unit => !unit.isEnemy);
    const circleCount = playerUnits.filter(unit => unit.unitType === 'circle').length;
    const squareCount = playerUnits.filter(unit => unit.unitType === 'square').length;
    const triangleCount = playerUnits.filter(unit => unit.unitType === 'triangle').length;

    if (circleCount > 12) return 'square';
    if (squareCount > 12) return 'triangle';
    if (triangleCount > 12) return 'circle';
    return 'circle';
  }

  initializeWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  initialize() {
    this.produceUnitButton = document.getElementById('produce-unit');
    
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.selectionManager = new SelectionManager(this);
    
    this.mapData = this.mapLoader.loadMap(this.selectedMap, this.canvas);
    if (this.mapData?.terrain) {
      this.terrain = this.mapData.terrain.lakes || [];
    }
    
    let initialBuildingPositions = this.mapData?.getInitialBuildingPositions ? 
                                    this.mapData.getInitialBuildingPositions(this.canvas) : 
                                    null;
    
    if (initialBuildingPositions && initialBuildingPositions.length === 2) {
      this.playerBuilding = new Building(initialBuildingPositions[0], this, false);
      this.enemyBuilding = new Building(initialBuildingPositions[1], this, true);
    } else {
      this.playerBuilding = new Building(new Vector2(this.canvas.width * 0.25, this.canvas.height * 0.5), this, false);
      this.enemyBuilding = new Building(new Vector2(this.canvas.width * 0.75, this.canvas.height * 0.5), this, true);
    }
    this.buildings.push(this.playerBuilding);
    this.buildings.push(this.enemyBuilding);

    this.spawnInitialUnits();
    
    this.spawnResources();
    this.buildingSpawnTimer = 0;
    this.setupControls();

    const aiPercentageSlider = document.getElementById('ai-percentage');
    const aiPercentageValue = document.getElementById('ai-percentage-value');
    if (aiPercentageSlider && aiPercentageValue) {
      aiPercentageSlider.addEventListener('input', (e) => {
        aiPercentageValue.textContent = e.target.value;
        this.aiController.setAIPercentage(parseInt(e.target.value));
      });
    }

    this.grid = new Grid(this);
    
    this.updateUI();
  }

  update() {
    if (this.gameOver) return;

    this.gameDuration += 1 / 60;  

    this.updateUnitComposition();

    this.grid.update();

    this.units.forEach(unit => {
        const speedMultiplier = this.grid.getTerrainSpeedMultiplier(unit);
        unit.currentSpeedMultiplier = speedMultiplier;
    });

    this.playerGold += (this.grid.tiles.filter(t => t.owner === 'player').length / 60) * this.multipliers.goldRate;
    this.enemyGold += (this.grid.tiles.filter(t => t.owner === 'enemy').length / 60) * this.multipliers.goldRate;

    this.units.forEach(unit => unit.update());
    this.buildings.forEach(building => building.update());
    this.projectiles.forEach(projectile => projectile.update());
    this.resources.forEach(resource => resource.update());
    this.woodResources.forEach(resource => resource.update());

    this.units = this.units.filter(unit => unit.health > 0);
    this.buildings = this.buildings.filter(building => building.health > 0);
    this.projectiles = this.projectiles.filter(projectile => !projectile.dead);
    this.resources = this.resources.filter(resource => !resource.depleted);
    this.woodResources = this.woodResources.filter(resource => !resource.depleted);

    this.projectiles.forEach(projectile => {
      if (projectile.target) {
        let distance = projectile.position.subtract(projectile.target.position).length();
        if (distance < projectile.target.size / 2) {
          projectile.hit();
        }
      }
    });

    this.buildingSpawnTimer += 1;

    if (this.playerWood >= this.buildingCost.wood && 
        this.playerGold >= this.buildingCost.gold && 
        this.buildingSpawnTimer >= 30) {
      this.attemptAutoSpawnBuilding(false);
      this.buildingSpawnTimer = 0;
    }

    if (this.enemyWood >= this.buildingCost.wood && 
        this.enemyGold >= this.buildingCost.gold && 
        this.buildingSpawnTimer >= 30) {
      this.attemptAutoSpawnBuilding(true);
      this.buildingSpawnTimer = 0;
    }

    if (!this.playerBuilding || this.playerBuilding.health <= 0) {
      this.playerBaseDestroyed = true;
    }
    if (!this.enemyBuilding || this.enemyBuilding.health <= 0) {
      this.enemyBaseDestroyed = true;
    }

    this.aiController.update();

    if (this.useAIYou) {
      this.aiControllerYou.update();
    }

    if (this.upgradeManager) {
      this.upgradeManager.update();
    }

    this.checkWinCondition();
  }

  updateUnitComposition() {
    Object.keys(this.unitComposition.player).forEach(type => {
      this.unitComposition.player[type] = 0;
      this.unitComposition.enemy[type] = 0;
    });

    this.units.forEach(unit => {
      if (unit.isEnemy) {
        this.unitComposition.enemy[unit.unitType]++;
      } else {
        this.unitComposition.player[unit.unitType]++;
      }
    });
  }

  draw() {
    this.ctx.fillStyle = '#1a4d1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawTerrain(this.ctx);

    this.grid.draw(this.ctx);
    
    const renderables = [
      ...this.buildings,
      ...this.resources,
      ...this.woodResources,
      ...this.units,
      ...this.projectiles
    ].sort((a, b) => a.position.y - b.position.y);

    renderables.forEach(renderable => {
      renderable.draw(this.ctx);
    });

    this.selectionManager.draw(this.ctx);

    this.drawUI(this.ctx);
  }

  drawTerrain(ctx) {
    this.terrain.forEach(feature => {
      if (feature.type === 'water') {
        ctx.beginPath();
        ctx.arc(feature.position.x, feature.position.y, feature.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 50, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  getTerrainSpeedMultiplier(position) {
    for (const feature of this.terrain) {
      if (feature.type === 'water') {
        const distance = position.subtract(feature.position).length();
        if (distance <= feature.radius) {
          return feature.speedMultiplier;
        }
      }
    }
    return 1.0; 
  }

  drawUI(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvas.width, 40);  

    const totalTiles = this.grid.tiles.length;
    const playerTiles = this.grid.tiles.filter(t => t.owner === 'player').length;
    const enemyTiles = this.grid.tiles.filter(t => t.owner === 'enemy').length;
    const playerTilePercentage = (playerTiles / totalTiles) * 100;
    const enemyTilePercentage = (enemyTiles / totalTiles) * 100;

    ctx.fillStyle = 'gold';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';

    ctx.fillText(`Units C:${this.unitComposition.player.circle} S:${this.unitComposition.player.square} T:${this.unitComposition.player.triangle}`, 10, 25);

    ctx.fillText(`Wood: ${this.playerWood}`, 200, 25);

    ctx.fillText(`Gold: ${Math.floor(this.playerGold)}`, 300, 25);

    const barWidth = 200;
    const barHeight = 20;
    const playerBarX = this.canvas.width / 2 - barWidth - 50; 
    const playerBarY = 19 - barHeight / 2; 

    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.fillRect(playerBarX, playerBarY, barWidth, barHeight);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.fillRect(playerBarX, playerBarY, barWidth * (playerTilePercentage / 100), barHeight);

    ctx.textAlign = 'center';
    const minutes = Math.floor(this.gameDuration / 60);
    const seconds = Math.floor(this.gameDuration % 60);
    const milliseconds = Math.floor((this.gameDuration % 1) * 100);
    const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(timerText, this.canvas.width / 2, 25);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'gold';
    ctx.font = '16px Arial';

    ctx.fillText(`Units C:${this.unitComposition.enemy.circle} S:${this.unitComposition.enemy.square} T:${this.unitComposition.enemy.triangle}`, this.canvas.width - 10, 25);

    ctx.fillText(`Wood: ${this.enemyWood}`, this.canvas.width - 200, 25);

    ctx.fillText(`Gold: ${Math.floor(this.enemyGold)}`, this.canvas.width - 300, 25);

    const enemyBarX = this.canvas.width / 2 + 50; 
    const enemyBarY = 19 - barHeight / 2; 

    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(enemyBarX, enemyBarY, barWidth, barHeight);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fillRect(enemyBarX + barWidth * (1 - enemyTilePercentage / 100), enemyBarY, barWidth * (enemyTilePercentage / 100), barHeight);
  }

  drawAiMessageWindow(ctx) {
      // This function is intentionally left empty to hide the AI message window.
      // The original code has been commented out to fulfill the user's request.
  }

  wrapText(ctx, text, maxWidth) {
    let words = text.split(' ');
    let line = '';
    let wrappedText = '';
    for(let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        wrappedText += line + '\n';
        line = words[n] + ' ';
      }
      else {
        line = testLine;
      }
    }
    wrappedText += line;
    return wrappedText;
  }

  updateUI() {
    const elements = {
      'player-gold': Math.floor(this.playerGold),
      'player-wood': this.playerWood,
      'enemy-gold': Math.floor(this.enemyGold),
      'enemy-wood': this.enemyWood,
      'unit-cost': this.unitCosts[this.selectedUnitType],
      'unit-type': this.selectedUnitType.charAt(0).toUpperCase() + this.selectedUnitType.slice(1),
      'building-cost-wood': this.buildingCost.wood,
      'building-cost-gold': this.buildingCost.gold,
      'can-build-production': this.playerWood >= this.buildingCost.wood && 
                            this.playerGold >= this.buildingCost.gold ? 'Yes' : 'No'
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    if (this.produceUnitButton) {
      if (this.playerBaseDestroyed) {
        this.produceUnitButton.disabled = true;
        this.produceUnitButton.textContent = "Base Destroyed";
      }
    }
  }

  handleRightClick(position) {
    const selectedUnits = this.units.filter(unit => unit.selected && !unit.isEnemy);

    let clickedEnemy = this.units.find(unit => unit.isEnemy && unit.contains(position));
    let clickedBuilding = this.buildings.find(building => building.isEnemy && this.isPointInsideBuilding(position, building));
    let clickedResource = this.resources.find(resource => resource.contains(position));
    let clickedWoodResource = this.woodResources.find(resource => resource.contains(position));

    if (this.playerWood >= this.buildingCost.wood && this.playerGold >= this.buildingCost.gold) {
      const nearbyBuildings = this.buildings.filter(building => {
        const distance = building.position.subtract(position).length();
        return distance < 100; 
      });

      if (nearbyBuildings.length === 0) {
        this.buildings.push(new Building(position, this, false));
        this.scoring.buildingConstructed(false);
        this.playerWood -= this.buildingCost.wood;
        this.playerGold -= this.buildingCost.gold;
        this.updateUI();
        return;
      }
    }

    if (clickedEnemy) {
      selectedUnits.forEach(unit => unit.setTarget(clickedEnemy));
    } else if (clickedBuilding) {
      selectedUnits.forEach(unit => unit.setTarget(clickedBuilding));
    } else if (clickedResource) {
      selectedUnits.forEach(unit => unit.setTarget(clickedResource));
    } else if (clickedWoodResource) {
      selectedUnits.forEach(unit => unit.setTarget(clickedWoodResource));
    } else {
      selectedUnits.forEach(unit => unit.moveTo(position));
    }
  }

  removeUnit(unitToRemove) {
    this.scoring.unitLost(unitToRemove.unitType, unitToRemove.isEnemy);
    this.grid.addDeathDecal(unitToRemove.position);
    this.units = this.units.filter(unit => unit !== unitToRemove);
  }

  removeBuilding(buildingToRemove) {
    this.buildings = this.buildings.filter(building => building !== buildingToRemove);
    if (buildingToRemove === this.playerBuilding) {
      this.playerBuilding = null;
      this.playerBaseDestroyed = true;
    } else if (buildingToRemove === this.enemyBuilding) {
      this.enemyBuilding = null;
      this.enemyBaseDestroyed = true;
    }
  }

  createProjectile(source, target) {
    this.projectiles.push(new Projectile(source, target, this));
    this.scoring.shotFired(source.isEnemy);
  }

  createUnit(position, isEnemy, unitType) {
    let unit = new Unit(position, this, isEnemy, unitType);
    if (this.upgradeManager) {
      unit = this.upgradeManager.getNewUnit(unit);
    }
    return unit;
  }

  isPointInsideBuilding(point, building) {
    const halfSize = building.size / 2;
    return (
      point.x >= building.position.x - halfSize &&
      point.x <= building.position.x + halfSize &&
      point.y >= building.position.y - halfSize &&
      point.y <= building.position.y + halfSize
    );
  }

  spawnResources(count) {
    const mapPositions = this.mapLoader.loadMap(this.selectedMap, this.canvas);
    
    if (!mapPositions) return;

    mapPositions.goldPositions.forEach(position => {
      this.resources.push(new Resource(position, this));
    });

    mapPositions.woodPositions.forEach(position => {
      this.woodResources.push(new WoodResource(position, this));
    });
  }

  checkWinCondition() {
    const playerUnits = this.units.filter(unit => !unit.isEnemy).length;
    const enemyUnits = this.units.filter(unit => unit.isEnemy).length;
    const playerBuildings = this.buildings.filter(building => !building.isEnemy).length;
    const enemyBuildings = this.buildings.filter(building => building.isEnemy).length;

    if (playerBuildings === 0 && playerUnits === 0) {
      this.endGame(false); 
    } else if (enemyBuildings === 0 && enemyUnits === 0) {
      this.endGame(true); 
    }
  }

  async endGame(playerWins) {
    this.gameOver = true;
    
    this.finalGameTime = this.gameDuration;
    
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) {
      gameOverElement.style.display = 'block';
      // Hide the "Game Over!" title
      const gameOverTitle = gameOverElement.querySelector('h2');
      if (gameOverTitle) {
        gameOverTitle.style.display = 'none';
      }
    }
    
    const messageElement = document.getElementById('game-over-message');
    if (messageElement) {
      messageElement.textContent = playerWins ? "You Win!" : "You Lose!";
    }

    const aiTrashTalkElement = document.getElementById('ai-trash-talk');
    if (this.offlineMode) {
      // If in offline mode, ensure no trash talk message is displayed
      if (aiTrashTalkElement) {
        aiTrashTalkElement.textContent = "";
      }
    } else if (this.useAI) {
      // Only get AI message if online and AI is enabled
      const scores = this.scoring.getScores();
      const aiMessage = await this.aiController.getAfterGameMessage(scores, playerWins);
      if (aiTrashTalkElement) {
        aiTrashTalkElement.textContent = aiMessage;      
      }
    } else if (aiTrashTalkElement) {
      // If AI is not used (and not in offline mode), clear trash talk
      aiTrashTalkElement.textContent = "";
    }

    this.displayGameScore();

    // Hide the respond button
    const respondButton = document.getElementById('respond-button');
    if (respondButton) {
      respondButton.style.display = 'none';
      respondButton.innerHTML = ''; // Clear its content in case a button was already appended
    }

    if (this.leaderboard && !this.offlineMode) {
      await this.leaderboard.submitScore(this.scoring.getScores(), playerWins);
    }
  }

  displayGameScore() {
    const scores = this.scoring.getScores();
    const scoreElement = document.getElementById('game-score');
    scoreElement.innerHTML = `
      <button class="collapsible-header">Detailed Statistics</button>
      <div class="collapsible-content">
        <h3>Game Score</h3>
        <p>Game Mode: ${scores.gameMode}</p>
        <div style="display: flex; justify-content: space-between;">
          <div style="text-align: left; width: 48%;">
            <h4>Player Scores:</h4>
            <p>Units Lost: ${scores.player.unitsLost}</p>
            <p>Units Lost By Type: C:${scores.player.unitsLostByType.circle} S:${scores.player.unitsLostByType.square} T:${scores.player.unitsLostByType.triangle}</p>
            <p>Shots Fired: ${scores.player.shotsFired}</p>
            <p>Buildings Constructed: ${scores.player.buildingsConstructed}</p>
            <p>Wood Collected: ${scores.player.woodCollected}</p>
            <p>Gold Collected: ${scores.player.goldCollected}</p>
            <p>Tiles Captured: ${scores.player.tilesCaptured}</p>
            <p>Units Produced: ${scores.player.unitsProduced}</p>
            <p>Units Produced By Type: C:${scores.player.unitsProducedByType.circle} S:${scores.player.unitsProducedByType.square} T:${scores.player.unitsProducedByType.triangle}</p>
          </div>
          <div style="text-align: right; width: 48%;">
            <h4>Enemy Scores:</h4>
            <p>Units Lost: ${scores.enemy.unitsLost}</p>
            <p>Units Lost By Type: C:${scores.enemy.unitsLostByType.circle} S:${scores.enemy.unitsLostByType.square} T:${scores.enemy.unitsLostByType.triangle}</p>
            <p>Shots Fired: ${scores.enemy.shotsFired}</p>
            <p>Buildings Constructed: ${scores.enemy.buildingsConstructed}</p>
            <p>Wood Collected: ${scores.enemy.woodCollected}</p>
            <p>Gold Collected: ${scores.enemy.goldCollected}</p>
            <p>Tiles Captured: ${scores.enemy.tilesCaptured}</p>
            <p>Units Produced: ${scores.enemy.unitsProduced}</p>
            <p>Units Produced By Type: C:${scores.enemy.unitsProducedByType.circle} S:${scores.enemy.unitsProducedByType.square} T:${scores.enemy.unitsProducedByType.triangle}</p>
          </div>
        </div>
        <p>Final Time: ${this.formatStopwatchTime(this.finalGameTime)}</p>
      </div>
    `;
    // Add default styling for collapsible content
    const collapsibleContent = scoreElement.querySelector('.collapsible-content');
    if (collapsibleContent) {
      collapsibleContent.style.maxHeight = null; // Ensure it starts closed
      collapsibleContent.style.overflow = 'hidden';
      collapsibleContent.style.transition = 'max-height 0.2s ease-out';
      collapsibleContent.style.padding = '0 18px';
      collapsibleContent.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      collapsibleContent.style.borderRadius = '0 0 5px 5px';
    }
  }

  formatStopwatchTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100); 
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }

  attemptAutoSpawnBuilding(isEnemy) {
    const buildingPosition = this.getRandomBuildingSpawnPosition(isEnemy);

    if (isEnemy) {
      this.enemyWood -= this.buildingCost.wood;
      this.enemyGold -= this.buildingCost.gold;
    } else {
      this.playerWood -= this.buildingCost.wood;
      this.playerGold -= this.buildingCost.gold;
    }

    let position;
    if (buildingPosition) {
      position = new Vector2(
        Math.max(100, Math.min(buildingPosition.x, this.canvas.width - 100)),
        Math.max(100, Math.min(buildingPosition.y, this.canvas.height - 100))
      );
    } else {
      position = new Vector2(
        isEnemy ? this.canvas.width * 0.75 : this.canvas.width * 0.25,
        Math.max(100, Math.min(this.canvas.height * 0.5, this.canvas.height - 100))
      );
    }

    this.buildings.push(new Building(position, this, isEnemy));
  
    if (!isEnemy) {
      this.scoring.buildingConstructed(false);
    } else {
      this.scoring.buildingConstructed(true);
    }

    this.updateUI();
  }

  getRandomBuildingSpawnPosition(isEnemy) {
    const referenceBuilding = this.buildings.find(b => b.isEnemy === isEnemy);
  
    if (!referenceBuilding) {
      return null; 
    }

    let spawnPosition = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!spawnPosition && attempts < maxAttempts) {
      attempts++;
      const offsetX = (Math.random() - 0.5) * 400; 
      const offsetY = (Math.random() - 0.5) * 200; 
      const potentialPosition = new Vector2(
        referenceBuilding.position.x + offsetX,
        referenceBuilding.position.y + offsetY
      );

      const isWithinBounds = 
        potentialPosition.x > 100 && 
        potentialPosition.x < this.canvas.width - 100 &&
        potentialPosition.y > 100 && 
        potentialPosition.y < this.canvas.height - 100;

      const nearbyBuildings = this.buildings.filter(existingBuilding => {
        const distance = existingBuilding.position.subtract(potentialPosition).length();
        return distance < 100; 
      });

      if (nearbyBuildings.length === 0 && isWithinBounds) {
        spawnPosition = potentialPosition;
      }
    }

    return spawnPosition;
  }

  spawnInitialUnits() {
    let playerUnits = [];
    let enemyUnits = [];

    switch (this.gameMode) {
      case 'rps':
        playerUnits = ['circle', 'square', 'triangle'];
        enemyUnits = ['circle', 'square', 'triangle'];
        break;
      case 'circle':
        playerUnits = ['circle', 'circle', 'circle'];
        enemyUnits = ['circle', 'circle', 'circle'];
        break;
      case 'square':
        playerUnits = ['square', 'square', 'square'];
        enemyUnits = ['square', 'square', 'square'];
        break;
      case 'triangle':
        playerUnits = ['triangle', 'triangle', 'triangle'];
        enemyUnits = ['triangle', 'triangle', 'triangle'];
        break;
    }

    const playerBuildingPos = this.playerBuilding.position;
    const enemyBuildingPos = this.enemyBuilding.position;

    playerUnits.forEach((unitType, index) => {
      const spawnPosition = new Vector2(
        playerBuildingPos.x + (Math.random() - 0.5) * 50,
        playerBuildingPos.y + this.playerBuilding.size + (Math.random() - 0.5) * 20 
      );
      const newUnit = this.createUnit(spawnPosition, false, unitType);
      this.units.push(newUnit);
      this.scoring.unitProduced(unitType, false);
    });

    enemyUnits.forEach((unitType, index) => {
      const spawnPosition = new Vector2(
        enemyBuildingPos.x + (Math.random() - 0.5) * 50,
        enemyBuildingPos.y + this.enemyBuilding.size + (Math.random() - 0.5) * 20 
      );
      const newUnit = this.createUnit(spawnPosition, true, unitType);
      this.units.push(newUnit);
      this.scoring.unitProduced(unitType, true);
    });
  }

  setupControls() {
    document.addEventListener('keydown', (e) => {
      if (this.gameMode === 'rps') {
        switch(e.key) {
          case '1':
            this.selectedUnitType = this.unitTypes.CIRCLE;
            this.updateUI();
            break;
          case '2':
            this.selectedUnitType = this.unitTypes.SQUARE;
            this.updateUI();
            break;
          case '3':
            this.selectedUnitType = this.unitTypes.TRIANGLE;
            this.updateUI();
            break;
        }
      }
    });
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this.gameLoop();
  }

  gameLoop() {
    this.update();
    this.draw();
    if (!this.gameOver) {
      requestAnimationFrame(() => this.gameLoop());
    }
  }

  stop() {
    this.gameOver = true;
    
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.resources = [];
    this.woodResources = [];
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

export class Projectile {
  constructor(source, target, game) {
    this.position = source.position;
    this.target = target;
    this.speed = 5;
    this.size = 5;
    this.game = game;
    this.dead = false;
    this.source = source; 
    this.damage = source.attackDamage; 
  }

  update() {
    if (this.dead) return;

    if (this.target && this.target.health > 0) {
      const direction = this.target.position.subtract(this.position);
      const distance = direction.length();

      if (distance > 1) {
        const normalized = direction.normalize();
        const moveVector = normalized.multiply(this.speed);
        this.position = this.position.add(moveVector);
      } else {
        this.hit();
      }
    } else {
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.source.unitType === 'square' ? 'blue' : (this.source.unitType === 'triangle' ? 'green' : '#fff'); 
    ctx.fill();
  }

  hit() {
    if (!this.dead && this.target) {
      let damageMultiplier = 1;
        
      if (this.target instanceof Unit) {
        if (this.source.unitType === 'square' && this.target.unitType === 'circle') {
          damageMultiplier = this.game.multipliers.rpsDamage;
        } else if (this.source.unitType === 'triangle' && this.target.unitType === 'square') {
          damageMultiplier = this.game.multipliers.rpsDamage;
        } else if (this.source.unitType === 'circle' && this.target.unitType === 'triangle') {
          damageMultiplier = this.game.multipliers.rpsDamage;
        }
      }

      this.target.health -= this.damage * damageMultiplier;
      this.dead = true;
    }
  }
}

export class Resource {
  constructor(position, game) {
    this.position = position;
    this.game = game;
    this.size = 45;
    this.health = 500 * game.multipliers.resourceHP; 
    this.maxHealth = 500 * game.multipliers.resourceHP; 
    this.depleted = false;
    
    this.goldImage = this.game.assetLoader?.getImage("game_gold_4.png");
  }

  update() {
    if (this.health <= 0) {
      this.depleted = true;
    }
  }

  draw(ctx) {
    if (this.goldImage) {
      ctx.drawImage(this.goldImage, this.position.x - this.size, this.position.y - this.size * 1.2, this.size * 2, this.size * 2);
    } else {
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = 'gold';
      ctx.fill();
    }

    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    const barWidth = this.size * 1.5;
    const barHeight = 5;
    const healthPercentage = this.health / this.maxHealth;

    ctx.fillStyle = 'red';
    ctx.fillRect(this.position.x - barWidth / 2, this.position.y - this.size * 1.5, barWidth, barHeight);

    ctx.fillStyle = 'green';
    ctx.fillRect(this.position.x - barWidth / 2, this.position.y - this.size * 1.5, barWidth * healthPercentage, barHeight);
  }

  contains(point) {
    return this.position.subtract(point).length() < this.size;
  }

  takeDamage(damage, isEnemy) {
    const initialHealth = this.health; 
    this.health -= damage;
    this.health = Math.max(0, this.health); 
    
    const healthLost = initialHealth - this.health; 
    
    let goldReward = 0;
    
    if (this.maxHealth > 0) {
        goldReward = (healthLost / this.maxHealth) * 500; 
    }
    goldReward = Math.max(0, goldReward); 

    if (!this.depleted) {
      if (isEnemy) {
        this.game.enemyGold += goldReward;
        this.game.scoring.goldCollectedAmount(goldReward, true);
      } else {
        this.game.playerGold += goldReward;
        this.game.scoring.goldCollectedAmount(goldReward, false);
      }
    }
    if (this.health <= 0) {
      this.depleted = true;
    }
  }
}

export class WoodResource extends Resource {
  constructor(position, game) {
    super(position, game);
    this.health = 50 * game.multipliers.resourceHP; 
    this.maxHealth = 50 * game.multipliers.resourceHP; 
    
    this.woodImage = this.game.assetLoader?.getImage("game_tree_2.png");
  }

  draw(ctx) {
    if (this.woodImage) {
      ctx.drawImage(this.woodImage, this.position.x - this.size * 1.5, this.position.y - this.size * 2, this.size * 3, this.size * 3);
    } else {
      ctx.beginPath();
      ctx.rect(this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
      ctx.fillStyle = 'green';
      ctx.fill();
    }

    this.drawHealthBar(ctx);
  }

  takeDamage(damage, isEnemy) {
    const initialHealth = this.health;
    this.health -= damage;
    this.health = Math.max(0, this.health); 

    const healthLost = initialHealth - this.health; 

    let woodReward = 0;
    if (this.maxHealth > 0) {
        woodReward = (healthLost / this.maxHealth) * 25; 
    }

    woodReward = Math.max(0, woodReward); 

    if (!this.depleted) {
      if (isEnemy) {
        this.game.enemyWood += woodReward;
        this.game.scoring.woodCollectedAmount(woodReward, true);
      } else {
        this.game.playerWood += woodReward;
        this.game.scoring.woodCollectedAmount(woodReward, false);
      }

      if (this.game.selectedMap === 'forest_nothing') {
        let unit = null;
        this.game.units.forEach(tempUnit => {
          if (tempUnit.target === this.position) {
            unit = tempUnit;
          }
        });
        if (unit != null) {
          unit.addExperience(woodReward * 2);
        }
      }
    }
    
    if (this.health <= 0) {
      this.depleted = true;
    }
  }
}