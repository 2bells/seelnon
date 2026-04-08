import { Vector2 } from '../js/vector2.js';

export const endlessMap = {
  name: "Endless",
  description: "An endless autoplay map with waves of attackers",
  
  // Resource configuration for enemy
  resources: {
    gold: {
      count: 4,
      distribution: [
        { x: 0.7, y: 0.3 },
        { x: 0.8, y: 0.5 },
        { x: 0.7, y: 0.7 },
        { x: 0.9, y: 0.5 }
      ]
    },
    wood: {
      count: 6,
      distribution: [
        { x: 0.75, y: 0.2 },
        { x: 0.85, y: 0.3 },
        { x: 0.95, y: 0.4 },
        { x: 0.75, y: 0.5 },
        { x: 0.85, y: 0.7 },
        { x: 0.95, y: 0.8 }
      ]
    }
  },

  getResourcePositions(canvas) {
    const goldPositions = this.resources.gold.distribution.map(pos => 
      new Vector2(pos.x * canvas.width, pos.y * canvas.height)
    );
    
    const woodPositions = this.resources.wood.distribution.map(pos => 
      new Vector2(pos.x * canvas.width, pos.y * canvas.height)
    );

    return {
      goldPositions,
      woodPositions
    };
  }
};