import { Vector2 } from './vector2.js';
import { Unit } from './unit.js';

export class Building {
  constructor(position, game, isEnemy = false) {
    this.position = position;
    this.game = game;
    this.isEnemy = isEnemy;
    this.size = 40; 
    this.health = 200 * game.multipliers.buildingHP;
    this.maxHealth = 200 * game.multipliers.buildingHP;
    this.spawnTimer = 0;
    this.spawnInterval = game.spawnInterval; 
    this.isSpawning = false; 

    // Ensure we have access to the assetLoader
    this.images = {
      red: game.assetLoader?.getImage("base_red_2.png") || null,
      blue: game.assetLoader?.getImage("base_blue_2.png") || null
    };
  }

  update() {
    if (this.health <= 0) {
      this.game.removeBuilding(this);
      return;
    }

    this.spawnTimer++;

    if (this.spawnTimer >= this.spawnInterval && !this.isSpawning) {
      this.attemptSpawnUnit();
      this.spawnTimer = 0;
    }
  }

  determineEnemyUnitType() {
    if (this.game.gameMode !== 'rps') {
      switch(this.game.gameMode) {
        case 'circle': return 'circle';
        case 'square': return 'square';
        case 'triangle': return 'triangle';
      }
    }
    
    const playerUnits = this.game.units.filter(unit => !unit.isEnemy);
    const circleCount = playerUnits.filter(unit => unit.unitType === 'circle').length;
    const squareCount = playerUnits.filter(unit => unit.unitType === 'square').length;
    const triangleCount = playerUnits.filter(unit => unit.unitType === 'triangle').length;

    if (circleCount > 12) return 'square';
    if (squareCount > 12) return 'triangle';
    if (triangleCount > 12) return 'circle';
    return 'circle';
  }

  attemptSpawnUnit() {
    const unitType = this.isEnemy ? this.determineEnemyUnitType() : this.game.selectedUnitType;
    const cost = this.game.unitCosts[unitType];
    let gold = this.isEnemy ? this.game.enemyGold : this.game.playerGold;

    if (gold >= cost && !this.isSpawning) {
      this.isSpawning = true;

      // Ensure units spawn *below* the building
      const spawnPosition = new Vector2(
        this.position.x + (Math.random() - 0.5) * 50,
        this.position.y + this.size + (Math.random() - 0.5) * 20 // Spawn below the building
      );

      let newUnit = new Unit(
        spawnPosition,
        this.game,
        this.isEnemy,
        unitType
      );
      this.game.units.push(newUnit);

      console.log(`Unit produced - Type: ${unitType}, IsEnemy: ${this.isEnemy}`);

      this.game.scoring.unitProduced(unitType, this.isEnemy);

      if (this.isEnemy) {
        this.game.enemyGold -= cost;
      } else {
        this.game.playerGold -= cost;
      }

      this.isSpawning = false;
    }
  }

  draw(ctx) {
    // Fallback drawing if images aren't loaded
    if (!this.images.red || !this.images.blue) {
      // Draw a simple rectangle as fallback
      ctx.fillStyle = this.isEnemy ? 'red' : 'blue';
      ctx.fillRect(
        this.position.x - this.size, 
        this.position.y - this.size, 
        this.size * 2, 
        this.size * 2
      );
    } else {
      // Draw with image if available
      const image = this.isEnemy ? this.images.red : this.images.blue;
      ctx.drawImage(image, 
        this.position.x - this.size * 1.5, 
        this.position.y - this.size * 1.5, 
        this.size * 3, 
        this.size * 3
      );
    }

    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    const barWidth = this.size;
    const barHeight = 5;
    const healthPercentage = this.health / this.maxHealth;

    ctx.fillStyle = 'red';
    ctx.fillRect(this.position.x - barWidth / 2, this.position.y - this.size, barWidth, barHeight);

    ctx.fillStyle = 'green';
    ctx.fillRect(this.position.x - barWidth / 2, this.position.y - this.size, barWidth * healthPercentage, barHeight);
  }
}