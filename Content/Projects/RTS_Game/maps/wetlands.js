import { Vector2 } from '../js/vector2.js';

export const wetlandsMap = {
  name: "Wetlands",
  description: "A map with small lakes that slow down unit movement",
  
  // Resource configuration
  resources: {
    gold: {
      count: 6,
      distribution: [
        // Player side (left)
        { x: 0.15, y: 0.3 },
        { x: 0.15, y: 0.7 },
        { x: 0.25, y: 0.5 },
        
        // Enemy side (right)
        { x: 0.85, y: 0.3 },
        { x: 0.85, y: 0.7 },
        { x: 0.75, y: 0.5 }
      ]
    },
    wood: {
      count: 20,
      distribution: [
        // Player side (left)
        { x: 0.1, y: 0.2 },
        { x: 0.2, y: 0.3 },
        { x: 0.15, y: 0.4 },
        { x: 0.1, y: 0.5 },
        { x: 0.15, y: 0.6 },
        { x: 0.2, y: 0.7 },
        { x: 0.1, y: 0.8 },
        { x: 0.25, y: 0.25 },
        { x: 0.25, y: 0.75 },
        { x: 0.2, y: 0.5 },
        
        // Enemy side (right)
        { x: 0.9, y: 0.2 },
        { x: 0.8, y: 0.3 },
        { x: 0.85, y: 0.4 },
        { x: 0.9, y: 0.5 },
        { x: 0.85, y: 0.6 },
        { x: 0.8, y: 0.7 },
        { x: 0.9, y: 0.8 },
        { x: 0.75, y: 0.25 },
        { x: 0.75, y: 0.75 },
        { x: 0.8, y: 0.5 }
      ]
    }
  },

  // Terrain configuration
  terrain: {
    lakes: [
      { x: 0.4, y: 0.3, radius: 0.05 },
      { x: 0.6, y: 0.3, radius: 0.05 },
      { x: 0.5, y: 0.5, radius: 0.07 },
      { x: 0.4, y: 0.7, radius: 0.05 },
      { x: 0.6, y: 0.7, radius: 0.05 }
    ]
  },

  getTerrainData(canvas) {
    return {
      lakes: this.terrain.lakes.map(lake => ({
        position: new Vector2(lake.x * canvas.width, lake.y * canvas.height),
        radius: lake.radius * Math.min(canvas.width, canvas.height),
        type: 'water',
        speedMultiplier: 0.5 // Units move at half speed in water
      }))
    };
  },

  // Helper functions
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
  },

  // Function to determine which side of the map a position is on
  getSide(position, canvas) {
    return position.x < canvas.width / 2 ? 'player' : 'enemy';
  }
};