import { Vector2 } from '../js/vector2.js';

export const mountainPassMap = {
  name: "Mountain Pass",
  description: "A narrow passage through mountains with capturable walls",
  
  // Resource configuration
  resources: {
    gold: {
      count: 6,
      distribution: [
        // Player side (left)
        { x: 0.15, y: 0.2 },
        { x: 0.15, y: 0.8 },
        { x: 0.25, y: 0.5 },
        
        // Enemy side (right)
        { x: 0.85, y: 0.2 },
        { x: 0.85, y: 0.8 },
        { x: 0.75, y: 0.5 }
      ]
    },
    wood: {
      count: 16,
      distribution: [
        // Player side (left)
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
        { x: 0.1, y: 0.3 },
        { x: 0.2, y: 0.4 },
        { x: 0.1, y: 0.6 },
        { x: 0.2, y: 0.7 },
        { x: 0.1, y: 0.8 },
        { x: 0.2, y: 0.9 },
        
        // Enemy side (right)
        { x: 0.9, y: 0.1 },
        { x: 0.8, y: 0.2 },
        { x: 0.9, y: 0.3 },
        { x: 0.8, y: 0.4 },
        { x: 0.9, y: 0.6 },
        { x: 0.8, y: 0.7 },
        { x: 0.9, y: 0.8 },
        { x: 0.8, y: 0.9 }
      ]
    }
  },

  // Wall configuration
  walls: [
    // Central vertical wall segments
    { x: 0.5, y: 0.2, width: 0.05, height: 0.2 },
    { x: 0.5, y: 0.8, width: 0.05, height: 0.2 },
    // Diagonal wall segments
    { x: 0.45, y: 0.4, width: 0.05, height: 0.1, angle: 45 },
    { x: 0.55, y: 0.4, width: 0.05, height: 0.1, angle: -45 },
    { x: 0.45, y: 0.6, width: 0.05, height: 0.1, angle: -45 },
    { x: 0.55, y: 0.6, width: 0.05, height: 0.1, angle: 45 }
  ],

  getWallData(canvas) {
    return this.walls.map(wall => ({
      position: new Vector2(wall.x * canvas.width, wall.y * canvas.height),
      width: wall.width * canvas.width,
      height: wall.height * canvas.height,
      angle: wall.angle || 0,
      type: 'wall',
      owner: null, // null = neutral, 'player' or 'enemy'
      captureProgress: 0,
      captureThreshold: 300, // 5 seconds at 60 FPS
      currentUnit: null
    }));
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