import { Vector2 } from './vector2.js';
import { Unit } from './unit.js';
import { Building } from './building.js';
import { Resource } from './game.js';
import { WoodResource } from './game.js';

export class AIControllerYou {
  constructor(game) {
    this.game = game;
    this.currentStrategy = null;
    this.strategyUpdateTimer = 0;
    this.aiMessageQueue = [];
    this.aiPercentage = 100;
    this.buildingStrategy = false; // Track if we're currently executing a building strategy
  }

  async updateStrategy() {
    if (!this.game.useAIYou) return;
    if (this.game.offlineMode) { // Check for offline mode
      this.currentStrategy = Math.floor(Math.random() * 7) + 1; // Random strategy for offline
      this.queueMessage("Offline AI (You): Executing a random strategy for you!");
      return;
    }

    const goldRemaining = this.game.resources.filter(r => !r.depleted).length > 0;
    const woodRemaining = this.game.woodResources.filter(r => !r.depleted).length > 0;
    const isForestNothing = this.game.selectedMap === 'forest_nothing';

    // Forced building strategy if no buildings remain
    if (this.game.buildings.filter(b => !b.isEnemy).length === 0) {
      if (woodRemaining) {
        this.currentStrategy = 7;
        this.buildingStrategy = true;
        this.queueMessage("No buildings left! Must construct additional pylons!");
        return;
      }
    }

    const gameState = {
      playerUnits: {
        total: this.game.units.filter(u => !u.isEnemy).length,
        circles: this.game.unitComposition.player.circle,
        squares: this.game.unitComposition.player.square,
        triangles: this.game.unitComposition.player.triangle
      },
      enemyUnits: {
        total: this.game.units.filter(u => u.isEnemy).length,
        circles: this.game.unitComposition.enemy.circle,
        squares: this.game.unitComposition.enemy.square,
        triangles: this.game.unitComposition.enemy.triangle
      },
      resources: {
        playerGold: this.game.playerGold,
        playerWood: this.game.playerWood,
        enemyGold: this.game.enemyGold,
        enemyWood: this.game.enemyWood,
        goldRemaining: goldRemaining,
        woodRemaining: woodRemaining
      },
      territory: {
        playerTiles: this.game.grid.tiles.filter(t => t.owner === 'player').length,
        enemyTiles: this.game.grid.tiles.filter(t => t.owner === 'enemy').length,
        emptyTiles: this.game.grid.tiles.filter(t => !t.owner).length
      },
      buildings: {
        enemyCount: this.game.buildings.filter(b => b.isEnemy).length,
        playerCount: this.game.buildings.filter(b => !b.isEnemy).length
      }
    };

    const aiResponse = await this.getAIStrategy(gameState, isForestNothing); // Pass isForestNothing
    if (aiResponse) {
      // If we're in building strategy and successfully built a building, clear the flag
      if (this.buildingStrategy && this.game.buildings.filter(b => !b.isEnemy).length > 0) {
        this.buildingStrategy = false;
      }

      // If we were in building strategy but no more wood, clear the flag
      if (this.buildingStrategy && !woodRemaining) {
        this.buildingStrategy = false;
      }

      // Only update strategy if we're not in building strategy or if building is no longer possible
      if (!this.buildingStrategy) {
        this.currentStrategy = aiResponse.strategy;
        console.log("AI Strategy:", aiResponse.explanation);
        this.queueMessage(aiResponse.explanation);

        // Modify the strategy if resources are depleted
        if (!goldRemaining && this.currentStrategy === 2) {
          this.currentStrategy = 5;
        }

        if (!woodRemaining && this.currentStrategy === 3) {
          this.currentStrategy = 1;
        }
      }
    }
  }

  async getAIStrategy(gameState, isForestNothing) {
    if (this.game.offlineMode) { // Check for offline mode
      // Return a dummy strategy in offline mode
      const strategies = [1, 2, 3, 4, 5, 6, 7];
      const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
      return {
        strategy: randomStrategy,
        explanation: `Offline AI (You): Strategy ${randomStrategy} - My offline brain suggests this move for you.`
      };
    }
    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Based on the current game state, determine the most effective strategy for player units.
          Consider the following strategies:
          1. attack enemy buildings
          2. gather more gold
          3. gather more wood
          4. attack enemy units
          5. capture empty tiles
          6. capture enemy tiles
          7. boom (gather wood to build new building)
          Choose based on:
          - Unit counts and types
          - Resource levels
          - Territory control
          - Current objectives
          - Available resources on the map
          - Number of buildings

          When the map is forest_nothing prioritize gathering wood:
          - If the map is "forest_nothing", heavily prioritize strategy 3 (gather more wood), 
          unless no wood resources are available. Always chose 3 to have a chance to move around the map. 

          Exclude strategies based on the availability of resources.
          
          interface Response {
            strategy: number;
            explanation: string;
          }
          
          {
            "strategy": 2,
            "explanation": "Imma low on gold need more! Enemy can't keep up with my clicking speed, ENEMY = BAD."
          }
          `,
          data: {
            ...gameState,
            isForestNothing: isForestNothing // Pass the map flag to the prompt
          }
        }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting AI strategy:', error);
      return null;
    }
  }

  async getAfterGameMessage(scores, playerWins) {
    if (this.game.offlineMode) { // Check for offline mode
      return playerWins ? 
             "Offline AI (You): Good game! We make a great team even without the cloud computing." :
             "Offline AI (You): We can do better! My offline calculations were a bit... off this time.";
    }
    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `
          Consider if player has won or lost the game. Use that to create a different type of message:
          Based on the game scores for both player and enemy, create a cheeky and fun trash talk message from the AI to the player. Compare the performance of both sides.
          Make it short and entertaining.

          interface Score {
            unitsLost: number;
            unitsLostByType: {
              circle: number;
              square: number;
              triangle: number;
            };
            shotsFired: number;
            buildingsConstructed: number;
            woodCollected: number;
            goldCollected: number;
            tilesCaptured: number;
            unitsProduced: number;
            unitsProducedByType: {
              circle: number;
              square: number;
              triangle: number;
            };
          }

          interface Scores {
            player: Score;
            enemy: Score;
            gameMode: string;
          }
          
          interface Response {
            message: string;
          }
          
          {
            "message": "You may have won, but my mouse was unplugged, monitor turned off, hands were cold and my AI mom was calling me, so... it wasn't a loss... 😅"
          }
          
          {
            "message": "I crushed you in RPS mode, my superior strategy was too much for you! Better luck next time, human. 😂"
          }
          `,
          data: {
            playerWins: playerWins,
            scores: scores
          }
        }),
      });
      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error('Error getting AI after game message:', error);
      return "gg wp";
    }
  }

  executeStrategy() {
    if (!this.currentStrategy || !this.game.useAIYou) return;

    const playerUnits = this.game.units.filter(u => !u.isEnemy && u.aiCooldown === 0);
    if (playerUnits.length === 0) return;

    const aiControlledCount = Math.ceil((this.aiPercentage / 100) * playerUnits.length);
    const shuffledUnits = [...playerUnits].sort(() => Math.random() - 0.5);
    const aiControlledUnits = shuffledUnits.slice(0, aiControlledCount);
    const aiCooldownMax = 60; //  1 second (60 frames per second) - Reduced cooldown here
  
    switch (this.currentStrategy) {
      case 1: // Attack buildings
        this.executeAttackBuildingsStrategy(aiControlledUnits, aiCooldownMax);
        break;
      case 2: // Gather gold
        this.executeGatherGoldStrategy(aiControlledUnits, aiCooldownMax);
        break;
      case 3: // Gather wood
        this.executeGatherWoodStrategy(aiControlledUnits, aiCooldownMax);
        break;
      case 4: // Attack units
        this.executeAttackUnitsStrategy(aiControlledUnits, aiCooldownMax);
        break;
      case 5: // Capture empty tiles
      case 6: // Capture player tiles
        this.executeCaptureStrategy(aiControlledUnits, aiCooldownMax, this.currentStrategy);
        break;
      case 7: // Boom - focus on gathering wood
        this.executeGatherWoodStrategy(aiControlledUnits, aiCooldownMax);
        // Also try to capture tiles while gathering wood
        this.executeCaptureStrategy(aiControlledUnits, aiCooldownMax, 5);
        break;
    }
  }

  executeAttackBuildingsStrategy(units, cooldown) {
    units.forEach(unit => {
      const enemyBuildings = this.game.buildings.filter(b => b.isEnemy);
      if (enemyBuildings.length > 0) {
        const closestBuilding = enemyBuildings.reduce((closest, building) => {
          const dist = unit.position.subtract(building.position).length();
          if (!closest || dist < closest.dist) {
            return { building, dist };
          }
          return closest;
        }, null);
        if (closestBuilding) {
          unit.setTarget(closestBuilding.building);
          unit.aiCooldown = cooldown;
        }
      }
    });
  }

  executeGatherGoldStrategy(units, cooldown) {
    units.forEach(unit => {
      const goldResources = this.game.resources.filter(r => !r.depleted);
      if (goldResources.length > 0) {
        const closestResource = goldResources.reduce((closest, resource) => {
          const dist = unit.position.subtract(resource.position).length();
          if (!closest || dist < closest.dist) {
            return { resource, dist };
          }
          return closest;
        }, null);
        if (closestResource) {
          unit.setTarget(closestResource.resource);
          unit.aiCooldown = cooldown;
        } else {
            this.executeGatherWoodStrategy([unit], cooldown);
        }
      } else {
        // If no gold available, switch to wood gathering or other action
        this.executeGatherWoodStrategy([unit], cooldown);
      }
    });
  }

  executeGatherWoodStrategy(units, cooldown) {
    units.forEach(unit => {
      const woodResources = this.game.woodResources.filter(r => !r.depleted);
      if (woodResources.length > 0) {
        const closestResource = woodResources.reduce((closest, resource) => {
          const dist = unit.position.subtract(resource.position).length();
          if (!closest || dist < closest.dist) {
            return { resource, dist };
          }
          return closest;
        }, null);
        if (closestResource) {
          unit.setTarget(closestResource.resource);
          unit.aiCooldown = cooldown;
        } else {
            this.executeAttackUnitsStrategy([unit], cooldown);
        }
      } else {
        // If no wood available, switch to gold gathering or other action
        this.executeAttackUnitsStrategy([unit], cooldown);
      }
    });
  }

  executeAttackUnitsStrategy(units, cooldown) {
    units.forEach(unit => {
      const enemyUnits = this.game.units.filter(u => u.isEnemy);
      if (enemyUnits.length > 0) {
        const closestUnit = enemyUnits.reduce((closest, target) => {
          const dist = unit.position.subtract(target.position).length();
          if (!closest || dist < closest.dist) {
            return { target, dist };
          }
          return closest;
        }, null);
        if (closestUnit) {
          unit.setTarget(closestUnit.target);
          unit.aiCooldown = cooldown;
        } else {
            this.executeAttackBuildingsStrategy([unit], cooldown);
        }
      } else {
        this.executeAttackBuildingsStrategy([unit], cooldown);
      }
    });
  }

  executeCaptureStrategy(units, cooldown, strategy) {
    units.forEach(unit => {
      if (unit.captureCommandCooldown > 0) return;

      const targetTiles = this.game.grid.tiles.filter(t => 
        strategy === 5 ? !t.owner : t.owner === 'enemy'
      ).sort((a, b) => {
        const distanceA = unit.position.subtract(a.position).length();
        const distanceB = unit.position.subtract(b.position).length();
        return distanceA - distanceB;
      });

      if (targetTiles.length > 0) {
        const closestTile = targetTiles[0];
        unit.moveTo(closestTile.position);
        unit.aiCooldown = cooldown;
        unit.captureCommandCooldown = 300;
      }
    });
  }

  update() {
    if (this.game.useAIYou) {
      this.strategyUpdateTimer++;
      if (this.strategyUpdateTimer >= 60) { // 1 seconds (60 frames per second)
        this.updateStrategy();
        this.strategyUpdateTimer = 0;
      }
    }
    this.executeStrategy();
  }

  setAIPercentage(percentage) {
    this.aiPercentage = percentage;
  }

  queueMessage(message) {
    this.aiMessageQueue.push(message);
    if (this.aiMessageQueue.length > 3) {
      this.aiMessageQueue.shift();
    }
  }

  getMessageQueue() {
    return this.aiMessageQueue;
  }
}