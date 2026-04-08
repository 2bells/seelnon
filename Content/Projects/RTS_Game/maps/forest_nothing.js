import { Vector2 } from '../js/vector2.js';

export const forestNothingMap = {
  name: "Forest Nothing",
  description: "A dense forest where wood resources slow units to a crawl",
  
  // Extensive wood resource configuration with more intelligent placement
  resources: {
    wood: {
      count: 300,
      gridPattern: {
        rows: 12,  // Reduced rows slightly
        cols: 20, // Maintained column count for density
        spacing: 0.21, // Percentage of canvas width/height between resources
        randomVariation: 0.03 // Add some randomness to grid placement
      }
    },
    gold: {
      count: 0,
      distribution: []
    }
  },

  getResourcePositions(canvas) {
    const woodPositions = [];
    const rows = this.resources.wood.gridPattern.rows;
    const cols = this.resources.wood.gridPattern.cols;
    const variation = this.resources.wood.gridPattern.randomVariation;

    // Smart wood resource generation
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Base position calculation with grid-like distribution
        const baseX = (col / (cols - 1)) * canvas.width;
        const baseY = (row / (rows - 1)) * canvas.height;

        // Add random variation to break perfect grid
        const randomOffsetX = (Math.random() * 2 - 1) * variation * canvas.width;
        const randomOffsetY = (Math.random() * 2 - 1) * variation * canvas.height;

        const x = Math.max(0, Math.min(canvas.width, baseX + randomOffsetX));
        const y = Math.max(0, Math.min(canvas.height, baseY + randomOffsetY));

        woodPositions.push(new Vector2(x, y));
      }
    }

    // Ensure total wood resources match the count
    if (woodPositions.length > this.resources.wood.count) {
      woodPositions.splice(this.resources.wood.count);
    }

    const goldPositions = this.resources.gold.distribution.map(pos => 
      new Vector2(pos.x * canvas.width, pos.y * canvas.height)
    );

    return {
      woodPositions,
      goldPositions
    };
  },

  getTerrainData(canvas) {
    // No initial terrain data, will be dynamically generated with wood resources
    return { woodSlowdownZones: [] };
  },

  getSide(position, canvas) {
    return position.x < canvas.width / 2 ? 'player' : 'enemy';
  }
};