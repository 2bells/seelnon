/**
 * WEATHER AND SPACETIME STORM CONFIGURATION
 * Configures storm presets, waves, timings, and dynamic biome-shifting susceptibility matrices.
 */

export const WEATHER_SETTINGS = {
  cooldown: 1500,        // Ticks between storm events (~60 seconds at 25Hz)
  duration: 400,         // Ticks that a storm remains active (~16 seconds)
  cloudSpawnCountMin: 2,
  cloudSpawnCountMax: 3,
  cloudRadiusMin: 340,
  cloudRadiusMax: 460,
  
  // Wave configurations for atmospheric rendering
  waves: {
    baseAmplitude: 2.5,
    maxAmplitude: 4.2,
    baseFreq: 0.007,
    ambientSpeed: 1.5,
    stormSpeed: 4.5
  },

  // Storm preset specifications
  presets: [
    {
      type: 'COSMIC_STORM_CELL',
      color: '#ff3366',
      driftSpeedMin: 1.6,
      driftSpeedMax: 3.4,
      windForceFactor: 0.5
    },
    {
      type: 'VOID_GRAVITY_SQUALL',
      color: '#ffaa00',
      driftSpeedMin: 1.6,
      driftSpeedMax: 3.4,
      windForceFactor: 0.7
    },
    {
      type: 'QUANTUM_PLASMA_NEBULA',
      color: '#00e5ff',
      driftSpeedMin: 1.6,
      driftSpeedMax: 3.4,
      windForceFactor: 0.4
    }
  ],
  
  // BIOME REPOSITIONING AND SHIFTING SUSCEPTIBILITY
  // Fluid biomes like rivers and lakes warp significantly under active atmospheric pressure,
  // creating migrating margins. Solid land types resist warping, while mountains remain locked.
  biomeShiftSusceptibility: {
    river: 1.2,          // Water currents flow and migrate dramatically
    lake: 0.9,           // Pools expand and slosh under high storm winds
    beach: 0.5,          // Coastlines shift dynamically
    void: 0.0,           // Vacuum does not distort physically
    desert: 0.35,        // Sand dunes drift
    savannah: 0.2,       // Fields sway slightly
    forest: 0.12,        // Roots lock the land in place
    mountain_forest: 0.06,// High roots resist shifting
    mountain: 0.01,      // Bedrock is extremely rigid
    snowy_peak: 0.005    // Solid glacial rock is unyielding
  }
};

// Global Runtime Weather State (synchronized and queried in real-time)
export const weatherState = {
  active: false,
  intensity: 0.0,
  gridPhase: 0.0,
  clouds: []
};

/**
 * Computes deterministic coordinate warp/displacement for any coordinate.
 * Used in procedural biome evaluations to make specific terrains morph or migrate.
 */
export function getWeatherWarp(worldX, worldY, baseBiomeId) {
  if (!weatherState.active || weatherState.clouds.length === 0) {
    return { dx: 0, dy: 0 };
  }
  
  const susceptibility = WEATHER_SETTINGS.biomeShiftSusceptibility[baseBiomeId] || 0.1;
  if (susceptibility <= 0.01) {
    return { dx: 0, dy: 0 };
  }
  
  let totalDx = 0;
  let totalDy = 0;
  
  for (let i = 0; i < weatherState.clouds.length; i++) {
    const cloud = weatherState.clouds[i];
    const dx = worldX - cloud.x;
    const dy = worldY - cloud.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    
    if (dist < cloud.radius) {
      // Linear falloff factor from the cloud center
      const factor = (cloud.radius - dist) / cloud.radius * weatherState.intensity;
      
      // Calculate wave amplitude with sinusoidal fluctuation based on gridPhase
      const waveAmplitude = 160 * susceptibility * factor;
      
      // Combine radial thrust with swirling winds inside the cloud
      const angle = Math.atan2(dy, dx) + Math.sin(weatherState.gridPhase * 0.8 + worldX * 0.003) * 0.5;
      
      totalDx += Math.cos(angle) * waveAmplitude;
      totalDy += Math.sin(angle) * waveAmplitude;
    }
  }
  
  return { dx: totalDx, dy: totalDy };
}

/**
 * Computes wave collapse reshuffle parameters for elevation and moisture.
 * Shifts terrains by +/- 1 up or down in the geographical hierarchy under weather storms.
 */
export function getWeatherPerturbation(worldX, worldY, baseBiomeId) {
  if (!weatherState.active || weatherState.clouds.length === 0) {
    return { elevOffset: 0, moistOffset: 0, riverOffset: 0 };
  }

  // Hard bedrock peaks and void space resist molecular reshuffling
  if (baseBiomeId === 'void' || baseBiomeId === 'snowy_peak' || baseBiomeId === 'mountain') {
    return { elevOffset: 0, moistOffset: 0, riverOffset: 0 };
  }

  let elevOffset = 0;
  let moistOffset = 0;
  let riverOffset = 0;

  for (let i = 0; i < weatherState.clouds.length; i++) {
    const cloud = weatherState.clouds[i];
    const dx = worldX - cloud.x;
    const dy = worldY - cloud.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < cloud.radius) {
      // Linear falloff from cloud center
      const factor = (cloud.radius - dist) / cloud.radius * weatherState.intensity;

      // Dynamic wavy fluctuation over space and time (gridPhase)
      // High-frequency ripple wave to trigger the "wave collapse reshuffle"
      const wave = Math.sin(worldX * 0.006 + weatherState.gridPhase * 1.6) * Math.cos(worldY * 0.006 - weatherState.gridPhase * 1.3);

      // Adjust offsets dynamically for high-contrast terrain transitions
      // +/- 0.45 elevation allows forests and savannahs to shift into lakes/rivers and vice-versa
      elevOffset += wave * 0.45 * factor;
      moistOffset += wave * 0.5 * factor;

      // Lowering riverScore allows flowing river channels to carve and flow through land
      if (wave < -0.2) {
        riverOffset -= Math.abs(wave) * 0.4 * factor;
      }
    }
  }

  return { elevOffset, moistOffset, riverOffset };
}
