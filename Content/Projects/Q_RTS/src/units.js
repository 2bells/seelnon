/**
 * UNITS AND PHYSICAL STATS CONFIGURATION
 * Decouples unit presets, starting health, speed, cost, and custom explosion physics.
 */

export const SHIPS_PRESETS = {
  carrier: {
    name: 'Flagship Carrier',
    radius: 28,
    mass: 1400,
    gravityRange: 420,
    health: 3000,
    maxHealth: 3000,
    shield: 1000,
    maxShield: 1000,
    maxCooldown: 80,
    speed: 0.8,
    cost: 0, // Flagship cannot be rebuilt
    buildIncrement: 0,
    dampingFactor: 0.94,
    naturalMaxSpeed: 0.8
  },
  fighter: {
    name: 'FT-Fighter',
    radius: 7,
    mass: 40,
    gravityRange: 50,
    health: 90,
    maxHealth: 90,
    shield: 30,
    maxShield: 30,
    maxCooldown: 18,
    damage: 15,
    weaponRange: 170,
    speed: 4.2,
    cost: 50,
    buildIncrement: 0.8, // Build time ~5s (125 ticks at 25Hz)
    dampingFactor: 0.94,
    naturalMaxSpeed: 2.5
  },
  cruiser: {
    name: 'CR-Cruiser',
    radius: 12,
    mass: 160,
    gravityRange: 150,
    health: 380,
    maxHealth: 380,
    shield: 180,
    maxShield: 180,
    maxCooldown: 38,
    damage: 45,
    weaponRange: 250,
    speed: 2.4,
    cost: 150,
    buildIncrement: 0.33, // Build time ~12s (300 ticks)
    dampingFactor: 0.94,
    naturalMaxSpeed: 1.5
  },
  dreadnought: {
    name: 'DN-Dreadnought',
    radius: 19,
    mass: 550,
    gravityRange: 280,
    health: 1300,
    maxHealth: 1300,
    shield: 600,
    maxShield: 600,
    maxCooldown: 85,
    damage: 180,
    weaponRange: 320,
    speed: 1.2,
    cost: 450,
    buildIncrement: 0.16, // Build time ~25s (625 ticks)
    dampingFactor: 0.94,
    naturalMaxSpeed: 0.8,
    spinSpeed: 3.5 // Custom spacetime frame drag signature
  }
};

export const ENEMIES_PRESETS = {
  interceptor: {
    name: 'Void Raider',
    radius: 7,
    mass: 30,
    gravityRange: 40,
    health: 100,
    maxHealth: 100,
    maxCooldown: 50,
    damage: 12,
    weaponRange: 180,
    baseSpeed: 2.4,
    dampingFactor: 0.95,
    naturalMaxSpeed: 2.4
  },
  citadel: {
    name: 'Krell Siphon Citadel',
    radius: 36,
    mass: 1200,
    gravityRange: 380,
    health: 1500,
    maxHealth: 1500,
    shield: 500,
    maxShield: 500,
    maxCooldown: 120, // rate of fire
    damage: 75,
    weaponRange: 380,
    spawnCooldown: 380, // guard spawn rate
    maxGuards: 7
  }
};

export const EXPLOSION_PRESETS = {
  // Shockwave parameters on unit destruction
  ships: {
    maxRadiusFactor: 6.5,
    energyFactor: 0.1,
    speed: 4.5,
    maxAge: 45
  },
  enemies: {
    maxRadiusFactor: 7.0,
    energyFactor: 0.12,
    speed: 6.0,
    maxAge: 55
  },
  vortexCollapse: {
    radius: 30,
    maxRadius: 750,
    energy: 40,
    speed: 10.0,
    maxAge: 70
  },
  hyperjumpStart: {
    maxRadius: 600,
    energy: 80,
    speed: 12.0,
    maxAge: 60
  },
  hyperjumpEnd: {
    maxRadius: 500,
    energy: 50,
    speed: 10.0,
    maxAge: 50
  },
  // Spawning residual quantum matter debris fragments on unit death
  residualScrapOnDeath: {
    countMin: 3,
    countMax: 6,
    baseMass: 15,
    gravityRange: 25,
    baseValue: 8
  },
  // Shockwave kinetic force damping inside simulation
  kineticForceLimit: 2.2,
  kineticForceFactor: 0.04
};
