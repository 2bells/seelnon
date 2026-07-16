/**
 * GLOBAL CONFIGURATION
 * Centralized settings for game systems, viewport, grid spacing, and constants.
 */

export const CONFIG = {
  // Grid and Viewport Settings
  grid: {
    spacing: 45,             // Base spacing between coordinate grid lines
    paddingCols: 4,          // Offscreen column padding
    paddingRows: 4,          // Offscreen row padding
  },
  
  // Endless Procedural Map Parameters
  map: {
    chunkWidth: 1500,        // Procedural chunk dimensions
    chunkHeight: 1500,
  },
  
  // Player Starting State and Limits
  player: {
    startingQm: 250,         // Initial Quantum Matter
    maxQm: 999999999,        // Capacity cap of Quantum Matter
    passiveQmTickRate: 25,   // Frame ticks (approx 1s) to regenerate resources
    passiveQmAmount: 1,      // Quantum Matter gained per interval
  },
  
  // Physical and Camera constraints
  physics: {
    minDistortionDistance: 1, // Safe math distance divisor
  }
};
