import { Vector2 } from '../js/vector2.js';

export const randomMap = {
  name: "Random",
  description: "A map with random resource distribution.",
  
  // Resource configuration
  resources: {
    gold: {
      count: 5,
    },
    wood: {
      count: 20,
    }
  },

  // Helper functions
  getResourcePositions(canvas) {
    const goldPositions = this.generateRandomPositions(this.resources.gold.count, canvas);
    const woodPositions = this.generateRandomPositions(this.resources.wood.count, canvas);

    return {
      goldPositions,
      woodPositions
    };
  },

  generateRandomPositions(count, canvas) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      positions.push(new Vector2(x, y));
    }
    return positions;
  },

  // Function to determine which side of the map a position is on
  getSide(position, canvas) {
    return position.x < canvas.width / 2 ? 'player' : 'enemy';
  }
};