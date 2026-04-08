import { Vector2 } from '../js/vector2.js';

export const agesMap = {
  name: "Ages",
  description: "Units evolve through ages, gaining power over time",
  
  // Resource configuration with more flexible distribution
  resources: {
    gold: {
      count: 6,
      zones: {
        player: { 
          x: [0.1, 0.3],  // Player's back gold zone
          y: [0.2, 0.8]   // Vertical spread
        },
        enemy: { 
          x: [0.7, 0.9],  // Enemy's back gold zone
          y: [0.2, 0.8]   // Vertical spread
        }
      }
    },
    wood: {
      count: 20,
      zones: {
        player: {
          x: [0.05, 0.4],  // More spread out wood zone for player
          y: [0.1, 0.9]    // Full vertical spread
        },
        enemy: {
          x: [0.6, 0.95],  // More spread out wood zone for enemy
          y: [0.1, 0.9]    // Full vertical spread
        }
      }
    }
  },

  // Upgrade configuration
  upgrades: {
    upgradeInterval: 1800,  // 30 seconds at 60 FPS
    maxTier: 4,
    tierMultipliers: {
      1: 1.0,    // Base tier
      2: 1.2,    // 20% increase
      3: 1.44,   // 20% increase from tier 2
      4: 1.728   // 20% increase from tier 3
    }
  },

  randomizeResourcePositions(canvas, resourceType, isPlayerSide) {
    const zone = this.resources[resourceType].zones[isPlayerSide ? 'player' : 'enemy'];
    const count = this.resources[resourceType].count / 2;  // Half for each side
    const positions = [];

    for (let i = 0; i < count; i++) {
      const x = zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]);
      const y = zone.y[0] + Math.random() * (zone.y[1] - zone.y[0]);
      
      positions.push(new Vector2(
        x * canvas.width, 
        y * canvas.height
      ));
    }

    return positions;
  },

  getResourcePositions(canvas) {
    const goldPositions = [
      ...this.randomizeResourcePositions(canvas, 'gold', true),   // Player side gold
      ...this.randomizeResourcePositions(canvas, 'gold', false)   // Enemy side gold
    ];
    
    const woodPositions = [
      ...this.randomizeResourcePositions(canvas, 'wood', true),   // Player side wood
      ...this.randomizeResourcePositions(canvas, 'wood', false)   // Enemy side wood
    ];

    return {
      goldPositions,
      woodPositions
    };
  },

  getInitialBuildingPositions(canvas) {
    const playerZone = { 
      x: [0.1, 0.3],
      y: [0.3, 0.7]
    };

    const enemyZone = { 
      x: [0.7, 0.9],
      y: [0.3, 0.7]
    };

    const positions = [
      new Vector2(
        (playerZone.x[0] + Math.random() * (playerZone.x[1] - playerZone.x[0])) * canvas.width,
        (playerZone.y[0] + Math.random() * (playerZone.y[1] - playerZone.y[0])) * canvas.height
      ),
      new Vector2(
        (enemyZone.x[0] + Math.random() * (enemyZone.x[1] - enemyZone.x[0])) * canvas.width,
        (enemyZone.y[0] + Math.random() * (enemyZone.y[1] - enemyZone.y[0])) * canvas.height
      )
    ];

    return positions;
  },

  // Function to determine which side of the map a position is on
  getSide(position, canvas) {
    return position.x < canvas.width / 2 ? 'player' : 'enemy';
  }
};