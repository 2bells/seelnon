/**
 * QUANTUM_RTS Biome Generation and Fantasy Setting Engine
 * Strictly client-side JavaScript. No dependencies.
 * Implements procedural trigonometric noise layers for elevation, moisture, and temperature.
 */

import { getWeatherWarp, getWeatherPerturbation } from './weather.js';

// Biome Definitions with customized colors, speed modifiers, and descriptions
let biomeOffsetX = 0;
let biomeOffsetY = 0;

export function setBiomeOffsets(ox, oy) {
  biomeOffsetX = ox;
  biomeOffsetY = oy;
}

export const BIOMES = {
  void: {
    id: 'void',
    name: 'Cosmic Void Medium',
    color: '#030308',
    gridColor: 'rgba(24, 24, 45, 0.16)',
    nodeColor: '#101026',
    speedFactor: 1.0,
    dragFactor: 0.94,
    isLand: false,
    resource: null,
    description: 'The cold, silent medium of the cosmos.'
  },
  terraformed: {
    id: 'terraformed',
    name: 'Stabilized Space Sector',
    color: '#030308',
    gridColor: 'rgba(24, 24, 45, 0.16)',
    nodeColor: '#101026',
    speedFactor: 1.5,
    dragFactor: 0.96,
    isLand: false,
    resource: null,
    description: 'A beautifully terraformed region of stable and highly energized space elements.'
  },
  river: {
    id: 'river',
    name: 'High-Velocity Aqua Canal',
    color: '#004f7a',
    gridColor: 'rgba(0, 190, 255, 0.6)',
    nodeColor: '#00e5ff',
    speedFactor: 1.7, // Fast flowing currents push ships forwards!
    dragFactor: 0.98, // Ultra smooth sliding
    isLand: false,
    resource: 'Water',
    description: 'High-velocity flow stream carrying concentrated star-matter.'
  },
  lake: {
    id: 'lake',
    name: 'Primordial Hydrosphere Pool',
    color: '#002f4a',
    gridColor: 'rgba(0, 120, 200, 0.55)',
    nodeColor: '#3df5ff',
    speedFactor: 1.4,
    dragFactor: 0.97,
    isLand: false,
    resource: 'Water',
    description: 'Glowing celestial pools rich in heavy quantum elements.'
  },
  beach: {
    id: 'beach',
    name: 'Cosmo-Dust Interstices',
    color: '#7a6a40',
    gridColor: 'rgba(190, 160, 90, 0.5)',
    nodeColor: '#ffd56b',
    speedFactor: 1.25,
    dragFactor: 0.95,
    isLand: true,
    resource: 'Earth',
    description: 'Sandy coastlines where land meets the deep liquid flow.'
  },
  desert: {
    id: 'desert',
    name: 'Primordial Lithosphere',
    color: '#5c2c16',
    gridColor: 'rgba(180, 80, 30, 0.45)',
    nodeColor: '#ff8a50',
    speedFactor: 1.3,
    dragFactor: 0.95,
    isLand: true,
    resource: 'Earth',
    description: 'The dry, heated stretches of God\'s dry exterior skin.'
  },
  savannah: {
    id: 'savannah',
    name: 'Gaseous Aeolian Stratum',
    color: '#5e4e1a',
    gridColor: 'rgba(175, 145, 45, 0.45)',
    nodeColor: '#ffb300',
    speedFactor: 1.4, // Fast land travel!
    dragFactor: 0.96,
    isLand: true,
    resource: 'Wind',
    description: 'Warm golden plains perfect for high-speed fleet maneuvers.'
  },
  forest: {
    id: 'forest',
    name: 'Bio-Organic Canopy',
    color: '#1a4e2c',
    gridColor: 'rgba(40, 160, 80, 0.45)',
    nodeColor: '#4caf50',
    speedFactor: 1.15,
    dragFactor: 0.93,
    isLand: true,
    resource: 'Air',
    description: 'Dense luminescent organic trees feeding on geothermal plasma.'
  },
  mountain_forest: {
    id: 'mountain_forest',
    name: 'Xeno-Vegetative Ridge',
    color: '#113a27',
    gridColor: 'rgba(30, 120, 70, 0.5)',
    nodeColor: '#2e7d32',
    speedFactor: 1.1,
    dragFactor: 0.92,
    isLand: true,
    resource: 'Air',
    description: 'Thick, shadowy alpine branches climbing steep stone slopes.'
  },
  mountain: {
    id: 'mountain',
    name: 'Tectonic Iron Suture',
    color: '#3e3e4f',
    gridColor: 'rgba(160, 160, 190, 0.55)',
    nodeColor: '#eceff1',
    speedFactor: 0.9,
    dragFactor: 0.90,
    isLand: true,
    resource: 'Metal',
    description: 'Towering mineral pillars made of solid core rock.'
  },
  snowy_peak: {
    id: 'snowy_peak',
    name: 'Cryo-Crystalline Summit',
    color: '#758d99',
    gridColor: 'rgba(220, 240, 255, 0.65)',
    nodeColor: '#ffffff',
    speedFactor: 0.8,
    dragFactor: 0.88,
    isLand: true,
    resource: 'Metal',
    description: 'Permafrost elevations touching the frozen clouds of the sky.'
  }
};

/**
 * Deterministic pseudo-random number generator using coordinates
 */
export function seedRandom(x, y) {
  const sinVal = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return sinVal - Math.floor(sinVal);
}

/**
 * Multi-scale trigonometric noise generator mapping (x, y) to [-1.0, 1.0]
 */
export function getNoise2D(x, y, scale = 1.0) {
  const sx = (x + biomeOffsetX) * scale;
  const sy = (y + biomeOffsetY) * scale;
  
  const n1 = Math.sin(sx * 0.00045) * Math.cos(sy * 0.00045);
  const n2 = Math.cos(sx * 0.00115) * Math.sin(sy * 0.0012) * 0.35;
  const n3 = Math.sin(sx * 0.0031 + sy * 0.0025) * 0.15;
  const n4 = Math.cos(sx * 0.0078 - sy * 0.0062) * 0.06;
  
  const total = (n1 + n2 + n3 + n4) / (1.0 + 0.35 + 0.15 + 0.06);
  return Math.max(-1.0, Math.min(1.0, total * 1.5));
}

/**
 * Biome evaluator based on multi-dimensional noise
 * @returns {Object} Biome structure from BIOMES
 */
/**
 * Raw static biome evaluator based on multi-dimensional noise.
 * Used internally before applying dynamic weather-warps.
 * @returns {Object} Biome structure from BIOMES
 */
export function getBaseBiomeAt(worldX, worldY, elevOffset = 0, moistOffset = 0, riverOffset = 0) {
  // 1. Calculate Elevation (Heightmap)
  let elev = getNoise2D(worldX, worldY, 1.0); // [-1, 1]
  elev += elevOffset;
  elev = Math.max(-1.0, Math.min(1.0, elev));
  
  // 2. Calculate Moisture (Wetness)
  // Shifted coordinates to offset moisture maps from elevation maps
  let moist = getNoise2D(worldX + 5371, worldY - 8492, 0.8); // [-1, 1]
  moist += moistOffset;
  moist = Math.max(-1.0, Math.min(1.0, moist));
  
  // 3. Calculate Temperature
  const temp = getNoise2D(worldX - 2911, worldY + 1113, 0.5); // [-1, 1]

  // 4. Rivers & Lakes Detection (Trigonometric River Channels)
  // River occurs where a high-frequency sine combination is close to zero (canyons/creeks)
  const rx = worldX + biomeOffsetX;
  const ry = worldY + biomeOffsetY;
  const rval1 = Math.sin(rx * 0.0018 + Math.cos(ry * 0.0012) * 2.0);
  const rval2 = Math.cos(ry * 0.0018 + Math.sin(rx * 0.001) * 2.0);
  let riverScore = Math.abs(rval1 * rval2); // Near 0 = Potential River channel
  riverScore += riverOffset;

  // If elevation is relatively low and river score is extremely low, it's a River!
  if (elev > -0.2 && elev < 0.4 && riverScore < 0.035) {
    return BIOMES.river;
  }

  // Large Lakes in negative elevations with high moisture
  if (elev > -0.25 && elev <= 0.0) {
    if (moist > 0.15) {
      return BIOMES.lake;
    }
    return BIOMES.beach;
  }

  // Deep Space / Void Sky
  if (elev <= -0.25) {
    return BIOMES.void;
  }

  // At this point elev > 0.0, so we are on Land!
  // Higher elevations result in mountain peaks
  if (elev > 0.65) {
    if (elev > 0.84) {
      return BIOMES.snowy_peak;
    }
    return BIOMES.mountain;
  }

  if (elev > 0.4) {
    // High mountain forest or dry highlands
    if (moist > 0.0) {
      return BIOMES.mountain_forest;
    }
    return BIOMES.desert; // dry highlands
  }

  // Lower lands (0.0 to 0.4 elevation)
  // Temperature & moisture decide the biome
  if (moist > 0.1) {
    return BIOMES.forest;
  } else if (moist > -0.3) {
    if (temp > 0.1) {
      return BIOMES.savannah;
    }
    return BIOMES.forest;
  } else {
    return BIOMES.desert;
  }
}

/**
 * Biome evaluator with dynamic weather coordinate warping based on biome weather-susceptibility.
 * @returns {Object} Biome structure from BIOMES
 */
export function getBiomeAt(worldX, worldY) {
  // First evaluate the raw base biome at this static location
  const baseBiome = getBaseBiomeAt(worldX, worldY);
  
  // Get coordinate warp displacement based on the base biome's susceptibility to weather
  const warp = getWeatherWarp(worldX, worldY, baseBiome.id);
  const warpedX = worldX + warp.dx;
  const warpedY = worldY + warp.dy;
  
  // Calculate weather active elevation/moisture/river reshuffle offsets
  const perturb = getWeatherPerturbation(warpedX, warpedY, baseBiome.id);
  
  // Re-evaluate biome with both coordinate warp and parameter shift offsets
  return getBaseBiomeAt(warpedX, warpedY, perturb.elevOffset, perturb.moistOffset, perturb.riverOffset);
}

/**
 * Returns deterministic landmarks/structures spawned inside chunks.
 * Spawns cities and taverns with medieval/fantasy names.
 */
const TAVERN_NAMES = [
  "Warpfarer's Hearth", "The Drunken Comet", "Event Horizon Inn", 
  "The Prancing Void-Beast", "The Golden Singularity", "Starlight Flagon",
  "Nebula Rest", "Goddess Flow Grog", "Father's Breath Tavern"
];

const CITY_NAMES = [
  "Aurelia Prime", "Chronos Citadel", "Shattered Haven", "Aethelgard",
  "Voidspire Spires", "Solaria Keeps", "Krell Siphon Keep", "New Camelot",
  "Iron-Vein Bastion", "Silverstream Citadel"
];

export function getStructureInChunk(cx, cy) {
  const seed = seedRandom(cx, cy);
  let lx, ly;
  
  if (cx === 0 && cy === 0) {
    lx = 250;
    ly = -300;
    return {
      x: lx,
      y: ly,
      type: 'tavern',
      name: "First Hearth Inn",
      description: "A cozy local tavern offering strong grog and gossip for fleet pilots.",
      color: '#ffb300'
    };
  }

  // Deterministic location inside chunk (cx, cy)
  lx = cx * 1500 + 200 + (seed * 1100);
  ly = cy * 1500 + 200 + (seedRandom(cy, cx) * 1100);

  const biome = getBiomeAt(lx, ly);
  
  // We only spawn structures on reasonable dry land
  if (biome.isLand && biome.id !== 'snowy_peak' && biome.id !== 'mountain') {
    const typeRoll = seedRandom(cx + 17, cy - 31);
    if (typeRoll < 0.4) {
      const nameIdx = Math.floor(seedRandom(cx, cy + 5) * TAVERN_NAMES.length);
      return {
        x: lx,
        y: ly,
        type: 'tavern',
        name: TAVERN_NAMES[nameIdx],
        description: "A rustic refuge frequented by astral mercenaries and gravity miners.",
        color: '#ff9100'
      };
    } else {
      const nameIdx = Math.floor(seedRandom(cx - 3, cy) * CITY_NAMES.length);
      return {
        x: lx,
        y: ly,
        type: 'city',
        name: CITY_NAMES[nameIdx],
        description: "A fortified settlement constructed from skin-rock blocks and glowing runic pylons.",
        color: '#00e5ff'
      };
    }
  }

  return null;
}

export function getStructureAt(worldX, worldY) {
  // Chunks are 1500 x 1500.
  const cx = Math.floor(worldX / 1500);
  const cy = Math.floor(worldY / 1500);
  
  const struct = getStructureInChunk(cx, cy);
  if (struct) {
    const dist = Math.hypot(worldX - struct.x, worldY - struct.y);
    if (dist < 50) {
      return struct;
    }
  }
  return null;
}
