import { Vector2 } from './vector2.js';
import { Unit } from './unit.js';
import { Building } from './building.js';
import { Resource } from './game.js';
import { WoodResource } from './game.js';

export class EndlessController {
  constructor(game) {
    this.game = game;
    this.waveCount = 0;
    this.waveTimer = 0;
    this.waveDuration = null; // 10 seconds at 60 FPS
    this.buildingLifespan = 20000; // 30 seconds at 60 FPS
    this.resourceRespawnTimer = 0;
    this.resourceRespawnInterval = 300; // 5 seconds at 60 FPS
    this.enemyUpdateTimer = 0;
    this.enemyUpdateInterval = 60; // 1 second at 60 FPS
    this.waveInProgress = false;
    this.resourcesActive = true;
    
    // Track building spawn times
    this.buildingTimers = new Map();
    
    // Initial setup
    this.setupInitialState();
  }

  setupInitialState() {
    // Spawn initial enemy buildings
    this.spawnEnemyBuildings();

    // Give enemy initial resources
    this.game.enemyGold = 100;
    this.game.enemyWood = 100;

    // Spawn initial resources
    this.respawnResources();
  }

  spawnEnemyBuildings() {
    const positions = [
      new Vector2(this.game.canvas.width * 0.8, this.game.canvas.height * 0.3),
      new Vector2(this.game.canvas.width * 0.8, this.game.canvas.height * 0.7),
      new Vector2(this.game.canvas.width * 0.6, this.game.canvas.height * 0.5)
    ];

    positions.forEach(pos => {
      const building = new Building(pos, this.game, true);
      this.game.buildings.push(building);
      this.buildingTimers.set(building, 0);
    });
  }

  spawnWave() {
    this.waveInProgress = true;
    this.waveCount++;
    const waveSize = 12 + Math.floor(this.waveCount * 12); // Gradually increase wave size
    console.log(`Spawning wave ${this.waveCount} with ${waveSize} units`);
    
    const spawnPoints = Array(waveSize).fill().map(() => 
      new Vector2(
        50, // X position near left edge
        Math.random() * this.game.canvas.height
      )
    );

    spawnPoints.forEach(pos => {
      const unitType = Math.random() < 0.1 ? 'triangle' : 
                      Math.random() < 0.3 ? 'circle' : 'square';
      
      const unit = new Unit(pos, this.game, false, unitType);
      
      // Initialize the unit's target right away
      this.assignInitialPlayerUnitTarget(unit);
      
      this.game.units.push(unit);
    });
  }

  assignInitialPlayerUnitTarget(unit) {
    const enemyUnits = this.game.units.filter(u => u.isEnemy);
    const enemyBuildings = this.game.buildings.filter(b => b.isEnemy);
    
    if (enemyUnits.length > 0) {
      // 80% chance to target enemy units if available
      if (Math.random() < 1) {
        const randomUnit = enemyUnits[Math.floor(Math.random() * enemyUnits.length)];
        unit.setTarget(randomUnit);
        return;
      }
    }
    
    // Fallback to targeting buildings if no units or 20% chance
    if (enemyBuildings.length > 0) {
      const randomBuilding = enemyBuildings[Math.floor(Math.random() * enemyBuildings.length)];
      unit.setTarget(randomBuilding);
    }
  }

  respawnResources() {
    this.resourcesActive = true;
    console.log("Respawning resources");
    // Respawn gold if needed
    while (this.game.resources.length < 2) {
      const x = this.game.canvas.width * (0.6 + Math.random() * 0.3); // 60-90% of width
      const y = Math.random() * this.game.canvas.height;
      this.game.resources.push(new Resource(new Vector2(x, y), this.game));
    }
    
    // Respawn wood if needed
    while (this.game.woodResources.length < 6) {
      const x = this.game.canvas.width * (0.7 + Math.random() * 0.2); // 70-90% of width
      const y = Math.random() * this.game.canvas.height;
      this.game.woodResources.push(new WoodResource(new Vector2(x, y), this.game));
    }
  }

  updatePlayerUnits() {
    const playerUnits = this.game.units.filter(u => !u.isEnemy);
    const enemyUnits = this.game.units.filter(u => u.isEnemy);
    const enemyBuildings = this.game.buildings.filter(b => b.isEnemy);
    
    playerUnits.forEach(unit => {
      // If unit has no target or current target is dead
      if (!unit.target || 
          (unit.targetUnit && unit.targetUnit.health <= 0) ||
          (unit.targetBuilding && unit.targetBuilding.health <= 0)) {
        
        if (enemyUnits.length > 0 && Math.random() < 0.8) {
          // Find closest enemy unit
          let closestEnemy = enemyUnits.reduce((closest, enemy) => {
            const distance = unit.position.subtract(enemy.position).length();
            if (!closest || distance < closest.distance) {
              return { unit: enemy, distance: distance };
            }
            return closest;
          }, null);
          
          if (closestEnemy) {
            unit.setTarget(closestEnemy.unit);
            return;
          }
        }
        
        // Fallback to targeting buildings
        if (enemyBuildings.length > 0) {
          const randomBuilding = enemyBuildings[Math.floor(Math.random() * enemyBuildings.length)];
          unit.setTarget(randomBuilding);
        }
      }
    });
  }

  checkResourcesState() {
    // Check if all resources are depleted
    if (this.resourcesActive && 
        this.game.resources.length === 0 && 
        this.game.woodResources.length === 0) {
      this.resourcesActive = false;
      if (!this.waveInProgress) {
        console.log("All resources depleted, spawning wave");
        this.spawnWave();
      }
    }
  }

  checkWaveState() {
    // Check if wave is complete (all player units dead)
    if (this.waveInProgress && 
        this.game.units.filter(u => !u.isEnemy).length === 0) {
      console.log("Wave complete, preparing to respawn resources");
      this.waveInProgress = false;
      this.respawnResources();
    }
  }

  update() {
    // Update building timers and remove old buildings
    for (const [building, timer] of this.buildingTimers.entries()) {
      this.buildingTimers.set(building, timer + 1);
      if (timer >= this.buildingLifespan) {
        building.health = 0; // This will trigger building removal
        this.buildingTimers.delete(building);
      }
    }

    // If all enemy buildings are destroyed, reset the scenario
    if (this.game.buildings.length === 0) {
      this.resetScenario();
      return;
    }

    // Check resource and wave states
    this.checkResourcesState();
    this.checkWaveState();

    // Update player unit targets
    this.updatePlayerUnits();

    // Update enemy unit targets
    this.enemyUpdateTimer++;
    if (this.enemyUpdateTimer >= this.enemyUpdateInterval) {
      this.updateEnemyUnits();
      this.enemyUpdateTimer = 0;
    }
  }

  updateEnemyUnits() {
    const enemyUnits = this.game.units.filter(u => u.isEnemy);
    const playerUnits = this.game.units.filter(u => !u.isEnemy);
    
    enemyUnits.forEach(unit => {
      if (!unit.target && !unit.targetResource && !unit.targetBuilding) {
        // If player units are nearby, prioritize attacking them
        if (playerUnits.length > 0 && Math.random() < 0.8) {
          const closestPlayer = playerUnits.reduce((closest, player) => {
            const distance = unit.position.subtract(player.position).length();
            if (!closest || distance < closest.distance) {
              return { unit: player, distance: distance };
            }
            return closest;
          }, null);
          
          if (closestPlayer && closestPlayer.distance < 300) { // Only chase if relatively close
            unit.setTarget(closestPlayer.unit);
            return;
          }
        }
        
        // Otherwise gather resources
        const resources = [...this.game.resources, ...this.game.woodResources]
          .filter(r => !r.depleted);
        
        if (resources.length > 0) {
          const randomResource = resources[Math.floor(Math.random() * resources.length)];
          unit.setTarget(randomResource);
        }
      }
    });
  }

  resetScenario() {
    // Clear all units
    this.game.units = [];
    this.buildingTimers.clear();
    
    // Reset enemy resources
    this.game.enemyGold = 500;
    this.game.enemyWood = 100;
    
    // Respawn enemy buildings
    this.spawnEnemyBuildings();
    
    // Respawn resources
    this.respawnResources();

    // Reset wave state
    this.waveInProgress = false;
    this.waveCount = 0;
  }
}