import { getBiomeAt, getStructureAt, getStructureInChunk, BIOMES, setBiomeOffsets } from './generation.js';
import { CONFIG } from './config.js';
import { SHIPS_PRESETS, ENEMIES_PRESETS, EXPLOSION_PRESETS } from './units.js';
import { WEATHER_SETTINGS, weatherState } from './weather.js';

// The 12 Astrological Lusts of Will (Cosmic Regions of Infinite Space)
export const REGIONS = [
  {
    index: 0,
    zodiac: "♈ Aries",
    name: "Aries Domain of Friction",
    title: "The Lust for Dominance (The Apex)",
    color: "#ff1133",
    gridColor: "rgba(255, 17, 51, 0.28)",
    ambientTint: "rgba(255, 17, 51, 0.08)",
    description: "The absolute obsession with proving absolute superiority through friction. It views harmony as death and requires rivals."
  },
  {
    index: 1,
    zodiac: "♌ Leo",
    name: "Leo Solar Colosseum",
    title: "The Lust for Validation (The Mirror)",
    color: "#ffaa00",
    gridColor: "rgba(255, 170, 0, 0.28)",
    ambientTint: "rgba(255, 170, 0, 0.08)",
    description: "Solar energy collapsed inward. A ravenous dependency on the external gaze, unable to exist without an audience."
  },
  {
    index: 2,
    zodiac: "♐ Sagittarius",
    name: "Sagittarius Sovereign Zenith",
    title: "The Lust for Exception (The Sovereign)",
    color: "#bb00ff",
    gridColor: "rgba(187, 0, 255, 0.28)",
    ambientTint: "rgba(187, 0, 255, 0.08)",
    description: "The ultimate God-Complex. The belief that one stands completely above the rules of reality, ethics, and ordinary life."
  },
  {
    index: 3,
    zodiac: "♉ Taurus",
    name: "Taurus Devouring Vault",
    title: "The Lust for Sensation (The Devourer)",
    color: "#ff5500",
    gridColor: "rgba(255, 85, 0, 0.28)",
    ambientTint: "rgba(255, 85, 0, 0.08)",
    description: "The nervous system self-devours. Hyper-escalation of physical consumption, hoarding raw wealth and burning out receptors."
  },
  {
    index: 4,
    zodiac: "♍ Virgo",
    name: "Virgo Purifying Inquisition",
    title: "The Lust for Suffering (The Inquisitor)",
    color: "#ccff00",
    gridColor: "rgba(204, 255, 0, 0.28)",
    ambientTint: "rgba(204, 255, 0, 0.08)",
    description: "Obsession with the 'brokenness' of reality. Inflicting micromanaged trauma under the guise of purification."
  },
  {
    index: 5,
    zodiac: "♑ Capricorn",
    name: "Capricorn Calcified Monoliths",
    title: "The Lust for Continuity (The Immortal)",
    color: "#bfb09f",
    gridColor: "rgba(191, 176, 159, 0.28)",
    ambientTint: "rgba(191, 176, 159, 0.08)",
    description: "The absolute terror of decay and replacement. Stagnant taxidermy of old systems, refusing to let new life emerge."
  },
  {
    index: 6,
    zodiac: "♊ Gemini",
    name: "Gemini Whispering Crypt",
    title: "The Lust for Secrets (The Crypt)",
    color: "#2b00ff",
    gridColor: "rgba(43, 0, 255, 0.28)",
    ambientTint: "rgba(43, 0, 255, 0.08)",
    description: "Cognitive paranoia. Peeling back the skin of reality, collecting leverage, hunting secrets until trust is completely lost."
  },
  {
    index: 7,
    zodiac: "♎ Libra",
    name: "Libra Algorithmic Symmetry",
    title: "The Lust for Symmetry (The Architect)",
    color: "#00e5ff",
    gridColor: "rgba(0, 229, 255, 0.28)",
    ambientTint: "rgba(0, 229, 255, 0.08)",
    description: "Forcing messy organic chaos into rigid mathematical lines. Sterile laboratory chambers erasing spontaneous anomalies."
  },
  {
    index: 8,
    zodiac: "♒ Aquarius",
    name: "Aquarius Entropic Cascade",
    title: "The Lust for Ruin (The Iconoclast)",
    color: "#39ff14",
    gridColor: "rgba(57, 255, 20, 0.28)",
    ambientTint: "rgba(57, 255, 20, 0.08)",
    description: "Nihilistic, intoxicating joy of watching complex structures smash into pieces. Weaponized entropic deconstruction."
  },
  {
    index: 9,
    zodiac: "♋ Cancer",
    name: "Cancer Spawning Matrix",
    title: "The Lust for Genesis (The Swarm)",
    color: "#ff66cc",
    gridColor: "rgba(255, 102, 204, 0.28)",
    ambientTint: "rgba(255, 102, 204, 0.08)",
    description: "Unchecked, mutating multiplication. Suffocating cosmic tumor matrix breeding dependent, monstrous swarms to rule."
  },
  {
    index: 10,
    zodiac: "♏ Scorpio",
    name: "Scorpio Overlord Citadel",
    title: "The Lust for Control (The Overlord)",
    color: "#590059",
    gridColor: "rgba(89, 0, 89, 0.28)",
    ambientTint: "rgba(89, 0, 89, 0.08)",
    description: "Absolute containment of the other. Deep psychological contracts, unseen leverage, trapping targets in invisible webs."
  },
  {
    index: 11,
    zodiac: "♓ Pisces",
    name: "Pisces Astral Oblivion",
    title: "The Lust for Transcendence (The Oblivion)",
    color: "#00ffcc",
    gridColor: "rgba(0, 255, 204, 0.28)",
    ambientTint: "rgba(0, 255, 204, 0.08)",
    description: "Escapism. Quiet urge to turn off sensory inputs entirely, floating in a numbing, blissful multi-dimensional void."
  }
];

// Quantum Space RTS Game Simulation Engine
// Bends laser rays, curves trajectories, sags coordinate grids around starships.

export class Simulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Endless Map Camera System
    this.camera = { x: -canvas.width / 2, y: -canvas.height / 2, targetX: -canvas.width / 2, targetY: -canvas.height / 2, zoom: 1.0 };
    
    // Screen size tracking
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Grid settings
    this.gridNodes = [];
    this.gridCols = 0;
    this.gridRows = 0;
    this.time = 0;
    this.isPaused = false;
    this.renderMode = 'tactical'; // 'tactical' (draws ships, alerts, warp lines) or 'grid' (renders only fabric)
    
    // Player resources and fleets
    this.qm = CONFIG.player.startingQm; // Starting Quantum Matter
    this.maxQm = CONFIG.player.maxQm;
    
    // Lists of game entities
    this.ships = [];      // Player fleet
    this.enemies = [];    // Hostile forces
    this.blackHoles = [];  // Gravitational anomalies
    this.debris = [];     // Quantum Scrap shards
    this.lasers = [];     // Beam weapon effects
    this.shockwaves = []; // Detonation visual ripple rings
    this.waypoints = [];  // Target flashing navigation markers
    this.vortices = [];   // Spacetime Fold vortices (Enemy portal tears)
    this.floatingTexts = []; // Pop-up floating indicators above entities
    this.spaceTears = []; // Spacetime grid rip fractures (Clickable Conquest Drops)
    
    // Endless Map procedural generation tracking
    this.generatedChunks = new Set();
    this.overriddenBiomes = new Map(); // Key: "tx,ty", Value: Biome object
    
    // Drag select state
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isDragging = false;
    
    // WebGL / Fallback state labels
    this.isWebGPUActive = false;
    
    // Periodic Spacetime Fold Wind Weather Event
    this.foldTimer = 0;               // Counts ticks
    this.foldActive = false;          // Whether the great fold wind is blowing
    this.foldProgress = 0;            // 0 to 1
    this.foldWindX = 0;               // Current wind shift x
    this.foldWindY = 0;               // Current wind shift y
    this.foldDuration = WEATHER_SETTINGS.duration;          // Ticks of wind (approx 16s)
    this.foldCooldown = WEATHER_SETTINGS.cooldown;         // Ticks between winds (approx 60s)
    this.biomeShiftX = 0;             // Cumulative permanent biome offset
    this.biomeShiftY = 0;             // Cumulative permanent biome offset
    this.weatherClouds = [];          // Localized weather system clouds
    this.weatherIntensity = 0.0;      // Continuous smooth storm/ambient intensity
    this.gridPhase = 0.0;             // Phase integration for grid movement

    this.lastRegionIndex = null;
    this.init();
  }

  getRegionAt(worldX, worldY) {
    // Dynamic organic coordinate warping to create slow-moving, propagating cosmic creep boundaries
    const t = (this.tickCount || 0) * 0.0012;
    // Massive, multi-layered slow-flowing warp fields to distort borders into blobs/creep
    const warpX = worldX + Math.sin(worldY * 0.0001 + t) * 4000 + Math.cos(worldX * 0.00005 - t * 0.4) * 2500;
    const warpY = worldY + Math.cos(worldX * 0.0001 - t) * 4000 + Math.sin(worldY * 0.00005 + t * 0.4) * 2500;

    // Very large cell scale (e.g. 24,000 units per region) to ensure they are massive and spread out
    const scale = 24000;
    
    // Find nearest cell in warped space
    const cx = Math.floor(warpX / scale);
    const cy = Math.floor(warpY / scale);
    
    let closestRegion = null;
    let minD = Infinity;
    
    // Check 3x3 neighboring cells to find closest distorted seed point (Voronoi)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cx + dx;
        const ny = cy + dy;
        
        // Deterministic offsets for this cell's seed point to break regular grid lines
        const h1 = Math.sin(nx * 17.29 + ny * 43.73) * 43758.5453;
        const seedX = nx * scale + (h1 - Math.floor(h1)) * scale;
        const h2 = Math.cos(nx * 31.12 + ny * 89.17) * 31415.9265;
        const seedY = ny * scale + (h2 - Math.floor(h2)) * scale;
        
        const dx_dist = warpX - seedX;
        const dy_dist = warpY - seedY;
        const distSq = dx_dist * dx_dist + dy_dist * dy_dist;
        
        if (distSq < minD) {
          minD = distSq;
          const index = Math.abs(Math.floor(Math.sin(nx * 43.12 + ny * 93.73) * 11119)) % 12;
          closestRegion = REGIONS[index];
        }
      }
    }
    
    return closestRegion || REGIONS[0];
  }

  blendBiomeAndRegion(biomeGridColor, regionColor, isRevealed) {
    if (!isRevealed) {
      return 'rgba(25, 25, 35, 0.15)';
    }

    let r = 24, g = 24, b = 45, a = 0.16;
    if (biomeGridColor && biomeGridColor.startsWith('rgba')) {
      const parts = biomeGridColor.substring(5, biomeGridColor.length - 1).split(',');
      if (parts.length >= 3) {
        r = parseInt(parts[0]);
        g = parseInt(parts[1]);
        b = parseInt(parts[2]);
        a = parts[3] ? parseFloat(parts[3]) : 1.0;
      }
    } else if (biomeGridColor && biomeGridColor.startsWith('#')) {
      const hex = biomeGridColor.substring(1);
      if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      }
    }

    let rr = 255, rg = 17, rb = 51;
    if (regionColor && regionColor.startsWith('#')) {
      const rhex = regionColor.substring(1);
      rr = parseInt(rhex.substring(0, 2), 16);
      rg = parseInt(rhex.substring(2, 4), 16);
      rb = parseInt(rhex.substring(4, 6), 16);
    }

    // Blend: 65% Biome identity + 35% Astrological sign overlay color
    const blendR = Math.round(r * 0.65 + rr * 0.35);
    const blendG = Math.round(g * 0.65 + rg * 0.35);
    const blendB = Math.round(b * 0.65 + rb * 0.35);
    const blendA = Math.max(a, 0.48);

    return `rgba(${blendR}, ${blendG}, ${blendB}, ${blendA})`;
  }

  isInViewport(screenX, screenY, margin = 50) {
    const zoom = this.camera.zoom || 1.0;
    const minX = this.width / 2 - (this.width / 2 + margin) / zoom;
    const maxX = this.width / 2 + (this.width / 2 + margin) / zoom;
    const minY = this.height / 2 - (this.height / 2 + margin) / zoom;
    const maxY = this.height / 2 + (this.height / 2 + margin) / zoom;
    return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
  }

  getBiomeAt(worldX, worldY) {
    if (this.overriddenBiomes) {
      const spacing = CONFIG.grid.spacing || 45;
      const tx = Math.round(worldX / spacing);
      const ty = Math.round(worldY / spacing);
      const key = `${tx},${ty}`;
      if (this.overriddenBiomes.has(key)) {
        return this.overriddenBiomes.get(key);
      }
    }
    return getBiomeAt(worldX, worldY);
  }

  screenToWorld(x, y) {
    const zoom = this.camera.zoom || 1.0;
    const worldX = (x - this.width / 2) / zoom + this.camera.x + this.width / 2;
    const worldY = (y - this.height / 2) / zoom + this.camera.y + this.height / 2;
    return { x: worldX, y: worldY };
  }

  worldToScreen(x, y) {
    const zoom = this.camera.zoom || 1.0;
    const screenX = (x - this.camera.x - this.width / 2) * zoom + this.width / 2;
    const screenY = (y - this.camera.y - this.height / 2) * zoom + this.height / 2;
    return { x: screenX, y: screenY };
  }

  generateChunk(cx, cy) {
    // Generate entities inside this 1500 x 1500 chunk
    const chunkWidth = 1500;
    const chunkHeight = 1500;
    const startX = cx * chunkWidth;
    const startY = cy * chunkHeight;
    
    // Deterministic chaotic seed for this chunk coordinates
    const chunkSeed = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
    const random = () => {
      const x = Math.sin(chunkSeed + Math.random()) * 9999;
      return x - Math.floor(x);
    };

    // Spawn 2 to 5 Quantum Matter debris shards
    const debrisCount = 2 + Math.floor(random() * 4);
    for (let i = 0; i < debrisCount; i++) {
      const rx = startX + random() * chunkWidth;
      const ry = startY + random() * chunkHeight;
      const biome = this.getBiomeAt(rx, ry);
      
      // Crystals gather primarily in space and sea flows
      if (!biome.isLand) {
        this.debris.push({
          id: `scrap-${cx}-${cy}-${i}`,
          x: rx,
          y: ry,
          radius: 4,
          mass: 15,
          gravityRange: 25,
          value: 20 + Math.floor(random() * 25)
        });
      }
    }

    // Spawn hostiles on islands or loose space patrols
    if (Math.abs(cx) > 0 || Math.abs(cy) > 0) { // Keep sector [0,0] calm & cozy
      const roll = random();
      if (roll < 0.28) {
        // Try to place Krell Siphon Citadel on Land (Island)
        for (let attempt = 0; attempt < 5; attempt++) {
          const rx = startX + random() * chunkWidth;
          const ry = startY + random() * chunkHeight;
          const bAt = this.getBiomeAt(rx, ry);
          if (bAt.isLand) {
            const citadelId = `citadel-${cx}-${cy}`;
            this.enemies.push({
              id: citadelId,
              type: 'citadel',
              name: 'Krell Siphon Citadel',
              x: rx,
              y: ry,
              vx: 0,
              vy: 0,
              radius: 36,
              mass: 1200,
              gravityRange: 380,
              health: 1200,
              maxHealth: 1200,
              shield: 400,
              maxShield: 400,
              cooldown: 0,
              maxCooldown: 120,
              spawnTimer: 0,
              angle: random() * Math.PI * 2
            });
            
            // Spawn 2 guard interceptors orbiting the outpost
            for (let j = 0; j < 2; j++) {
              const offsetAngle = random() * Math.PI * 2;
              const dist = 90 + random() * 70;
              this.enemies.push({
                id: `hostile-guard-${cx}-${cy}-${j}`,
                type: 'interceptor',
                name: 'Void Raider',
                x: rx + Math.cos(offsetAngle) * dist,
                y: ry + Math.sin(offsetAngle) * dist,
                vx: 0,
                vy: 0,
                radius: 7,
                mass: 30,
                gravityRange: 40,
                health: 100,
                maxHealth: 100,
                cooldown: 0,
                maxCooldown: 50,
                targetX: null,
                targetY: null,
                angle: offsetAngle
              });
            }
            
            this.appendFeed(`SECTOR_ALERT: COGNITIVE SIGILS DETECTED ON LAND AT SECTOR [${cx}, ${cy}].`);
            break;
          }
        }
      } else if (roll < 0.45) {
        // Spawn a loose interceptor scout patrol
        const rx = startX + random() * chunkWidth;
        const ry = startY + random() * chunkHeight;
        const bAt = this.getBiomeAt(rx, ry);
        if (bAt.id === 'void') {
          this.enemies.push({
            id: `hostile-patrol-${cx}-${cy}`,
            type: 'interceptor',
            name: 'Void Raider',
            x: rx,
            y: ry,
            vx: 0,
            vy: 0,
            radius: 7,
            mass: 30,
            gravityRange: 40,
            health: 100,
            maxHealth: 100,
            cooldown: 0,
            maxCooldown: 50,
            targetX: null,
            targetY: null,
            angle: random() * Math.PI * 2
          });
        }
      } else if (roll < 0.52) {
        // Spawn a gravitational black hole/white hole anomaly
        const rx = startX + random() * chunkWidth;
        const ry = startY + random() * chunkHeight;
        const type = random() > 0.5 ? 'black_hole' : 'white_hole';
        this.blackHoles.push({
          id: `anomaly-${cx}-${cy}`,
          type: type,
          x: rx,
          y: ry,
          radius: 28 + Math.floor(random() * 14),
          mass: 1400 + Math.floor(random() * 800),
          gravityRange: 380 + Math.floor(random() * 160),
          spinSpeed: (random() > 0.5 ? 1 : -1) * (4 + random() * 4),
          stability: 0
        });
        const label = type === 'black_hole' ? 'BLACK HOLE' : 'WHITE HOLE';
        this.appendFeed(`COSMIC_ANOMALY: DETECTED ${label} FLUX AT SECTOR [${cx}, ${cy}].`);
      }
    }
  }

  init() {
    // Randomize biome offsets to make every world unique
    const ox = (Math.random() - 0.5) * 200000;
    const oy = (Math.random() - 0.5) * 200000;
    setBiomeOffsets(ox, oy);

    // 1. Allocate coordinate grid
    this.setupGrid();
    
    // Pre-seed chunk (0,0) as already generated to keep initialization neat
    this.generatedChunks.add('0,0');

    // 2. Spawn Player's mobile capital starbase - the Carrier
    const cp = SHIPS_PRESETS.carrier;
    const carrier = {
      id: 'carrier-' + Math.random().toString(36).substr(2, 5),
      type: 'carrier',
      name: cp.name,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      targetX: null,
      targetY: null,
      selected: true,
      radius: cp.radius,
      mass: cp.mass, // Large gravity sag
      gravityRange: cp.gravityRange,
      health: cp.health,
      maxHealth: cp.maxHealth,
      cooldown: 0,
      maxCooldown: cp.maxCooldown,
      shield: cp.shield,
      maxShield: cp.maxShield,
      angle: 0,
      speed: cp.speed, // Mobile flag carrier capital ship
      productionQueue: [],
      productionProgress: 0
    };
    this.ships.push(carrier);

    // Spawn 3 starting escorts (Fighters) around the Carrier
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      this.spawnShip('fighter', Math.cos(angle) * 80, Math.sin(angle) * 80);
    }

    // 3. Populate stable galaxy features
    this.spawnUniversalMapFeatures();
    
    // Center camera target initially on the Carrier
    this.camera.x = carrier.x - this.width / 2;
    this.camera.y = carrier.y - this.height / 2;
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;
  }

  // Pre-allocates grid nodes across screen coverage
  setupGrid() {
    this.gridNodes = [];
    const spacing = CONFIG.grid.spacing; // Grid density resolution
    
    // Calculate precise grid dimension to fill viewport plus padding borders
    this.gridCols = Math.ceil(this.width / spacing) + CONFIG.grid.paddingCols;
    this.gridRows = Math.ceil(this.height / spacing) + CONFIG.grid.paddingRows;
    
    const count = this.gridCols * this.gridRows;
    for (let i = 0; i < count; i++) {
      this.gridNodes.push({ ox: 0, oy: 0, x: 0, y: 0 });
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Re-setup coordinate grid nodes on resize
    this.setupGrid();
  }

  // Populate map elements (enemies, resource debris, black holes) around coordinate space
  spawnUniversalMapFeatures() {
    this.enemies = [];
    this.blackHoles = [];
    this.debris = [];
    this.shockwaves = [];
    this.lasers = [];
    this.waypoints = [];

    // Permanent Cosmic Black & White Holes (Super-heavy warp wells)
    this.blackHoles.push({
      id: 'anomaly-alpha',
      type: 'black_hole',
      x: -700,
      y: 600,
      radius: 40,
      mass: 2500,
      gravityRange: 550,
      spinSpeed: -6.5, // Frame drag swirl
      stability: 0
    });

    this.blackHoles.push({
      id: 'anomaly-beta',
      type: 'white_hole',
      x: 1000,
      y: -1100,
      radius: 35,
      mass: 2200,
      gravityRange: 450,
      spinSpeed: 5.0,
      stability: 0
    });

    this.blackHoles.push({
      id: 'anomaly-gamma',
      type: 'black_hole',
      x: -1200,
      y: -800,
      radius: 32,
      mass: 1800,
      gravityRange: 400,
      spinSpeed: 4.5,
      stability: 0
    });

    this.blackHoles.push({
      id: 'anomaly-delta',
      type: 'white_hole',
      x: 1500,
      y: 1200,
      radius: 38,
      mass: 2400,
      gravityRange: 500,
      spinSpeed: -5.5,
      stability: 0
    });

    // Spawn Hostile Void Citadels (Fortresses that siphon space and attack player)
    this.enemies.push({
      id: 'citadel-east',
      type: 'citadel',
      name: 'Krell Siphon Citadel',
      x: 1400,
      y: 200,
      vx: 0,
      vy: 0,
      radius: 36,
      mass: 1200,
      gravityRange: 380,
      health: 1500,
      maxHealth: 1500,
      shield: 500,
      maxShield: 500,
      cooldown: 0,
      maxCooldown: 120, // rate of fire
      spawnTimer: 0,
      angle: Math.PI / 4
    });

    this.enemies.push({
      id: 'citadel-north',
      type: 'citadel',
      name: 'Xylar Gravity Gate',
      x: -300,
      y: -1200,
      vx: 0,
      vy: 0,
      radius: 36,
      mass: 1200,
      gravityRange: 380,
      health: 1500,
      maxHealth: 1500,
      shield: 500,
      maxShield: 500,
      cooldown: 0,
      maxCooldown: 120,
      spawnTimer: 0,
      angle: -Math.PI / 2
    });

    // Spawn defender interceptors guarding the outposts
    this.enemies.forEach(citadel => {
      for (let i = 0; i < 2; i++) {
        const offsetAngle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 80;
        this.enemies.push({
          id: 'hostile-guard-' + Math.random().toString(36).substr(2, 5),
          type: 'interceptor',
          name: 'Void Raider',
          x: citadel.x + Math.cos(offsetAngle) * dist,
          y: citadel.y + Math.sin(offsetAngle) * dist,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          radius: 7,
          mass: 30,
          gravityRange: 40,
          health: 100,
          maxHealth: 100,
          cooldown: 0,
          maxCooldown: 50,
          targetX: null,
          targetY: null,
          angle: offsetAngle
        });
      }
    });

    // Scatter initial resource crystals (Quantum Matter scrap)
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 250 + Math.random() * 1200;
      this.debris.push({
        id: 'scrap-' + i,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        radius: 4,
        mass: 15,
        gravityRange: 25,
        value: 25
      });
    }
  }

  // Spawns player ships relative to the main Fleet Carrier
  spawnShip(type, offsetX = 0, offsetY = 0) {
    const carrier = this.ships.find(s => s.type === 'carrier');
    const startX = carrier ? carrier.x + offsetX : offsetX;
    const startY = carrier ? carrier.y + offsetY : offsetY;
    
    let ship = {
      id: 'ship-' + Math.random().toString(36).substr(2, 5),
      type: type,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      targetX: null,
      targetY: null,
      selected: false,
      angle: Math.random() * Math.PI * 2,
      cooldown: 0
    };

    const preset = SHIPS_PRESETS[type];
    if (preset) {
      ship.name = preset.name;
      ship.radius = preset.radius;
      ship.mass = preset.mass;
      ship.gravityRange = preset.gravityRange;
      ship.health = preset.health;
      ship.maxHealth = preset.maxHealth;
      ship.shield = preset.shield;
      ship.maxShield = preset.maxShield;
      ship.maxCooldown = preset.maxCooldown;
      ship.damage = preset.damage;
      ship.weaponRange = preset.weaponRange;
      ship.speed = preset.speed;
      if (preset.spinSpeed) {
        ship.spinSpeed = preset.spinSpeed;
      }
    }

    this.ships.push(ship);
    this.appendFeed(`WARPING_IN_UNIT: ${ship.name.toUpperCase()} COMMISSIONED.`);
  }

  // Left click and drag marquee box selection trigger
  handleDragSelection(worldX1, worldY1, worldX2, worldY2) {
    const left = Math.min(worldX1, worldX2);
    const right = Math.max(worldX1, worldX2);
    const top = Math.min(worldY1, worldY2);
    const bottom = Math.max(worldY1, worldY2);

    let selectCount = 0;
    this.ships.forEach(ship => {
      // Fleet carrier is selectable but we prefer drag selecting mobile escorts
      const inside = ship.x >= left && ship.x <= right && ship.y >= top && ship.y <= bottom;
      ship.selected = inside;
      if (inside) selectCount++;
    });

    if (selectCount > 0) {
      this.appendFeed(`SELECTION_UPDATED: ${selectCount} STARSHIPS_ENGAGED.`);
    }
  }

  // Right click orders target movement coordinate to selected units
  orderMovement(worldX, worldY) {
    const selectedShips = this.ships.filter(s => s.selected);
    if (selectedShips.length === 0) return;

    // Set targets for selected ships
    this.addWaypoint(worldX, worldY, '#00ff66');
    this.appendFeed(`COORDINATES_TRANSMITTED: PILOTING_FLEET [${Math.round(worldX)}, ${Math.round(worldY)}].`);

    // Spacing separation offset to avoid overlap bundle when landing
    const count = selectedShips.length;
    selectedShips.forEach((ship, idx) => {
      if (ship.type === 'carrier' && ship.deployState && ship.deployState !== 'none') {
        // Ignore movement order while deployed/docked/deploying
        return;
      }
      if (count === 1) {
        ship.targetX = worldX;
        ship.targetY = worldY;
      } else {
        const angle = (idx * Math.PI * 2) / count;
        const spreadRadius = 18 + Math.sqrt(count) * 8;
        ship.targetX = worldX + Math.cos(angle) * spreadRadius;
        ship.targetY = worldY + Math.sin(angle) * spreadRadius;
      }
    });
  }

  // Flashing waypoint locator visual
  addWaypoint(x, y, color) {
    this.waypoints.push({
      x: x,
      y: y,
      color: color,
      radius: 1,
      maxRadius: 25,
      alpha: 1.0
    });
  }

  // Append logs stream in main screen box
  appendFeed(msg) {
    if (window.appendLog) {
      window.appendLog(msg);
    }
  }

  // Spawns dynamic enemy patrol challenge via Spacetime Fold Vortices
  summonEnemies() {
    const carrier = this.ships.find(s => s.type === 'carrier');
    const startX = carrier ? carrier.x : 0;
    const startY = carrier ? carrier.y : 0;

    // Pick coordinates near the carrier
    const angle = Math.random() * Math.PI * 2;
    const r = 450 + Math.random() * 150;
    const vx = startX + Math.cos(angle) * r;
    const vy = startY + Math.sin(angle) * r;

    this.appendFeed(`⚠️ THE_VOID_WARNING: INTENSE_GRAVITATIONAL_FLUX! VOID VORTEX OPENING.`);
    this.createVortex(vx, vy, 'raid', 3);
  }

  // Helper to open a custom spacetime tear
  createVortex(x, y, spawnType = 'raid', spawnCount = 3) {
    this.vortices.push({
      id: 'vortex-' + Math.random().toString(36).substr(2, 5),
      x: x,
      y: y,
      active: true,
      foldingProgress: 0,
      radius: 110,
      mass: 150,
      gravityRange: 450,
      spinSpeed: 10.0,
      spawnType: spawnType,
      spawnCount: spawnCount
    });

    // Create immediate localized shockwave ripple
    this.shockwaves.push({
      x: x,
      y: y,
      radius: 10,
      maxRadius: 250,
      energy: 15,
      speed: 6.0,
      age: 0,
      maxAge: 45
    });
  }

  // Master physics update tick
  tick() {
    if (this.isPaused) return;

    if (this.carrierSymmetricGunsUpgrade) {
      const carrier = this.ships.find(s => s.type === 'carrier');
      if (carrier) {
        carrier.weaponRange = 550;
        carrier.maxCooldown = 40;
        carrier.damage = 150;
      }
    }

    this.time += 0.04;

    // Calculate dynamic ambient fluctuation
    const ambientIntensity = 0.06 + 0.04 * Math.sin(this.time * 1.5);
    
    // Smooth continuous tracking of overall weather intensity
    let targetIntensity = ambientIntensity;
    if (this.foldActive) {
      const progressClamped = Math.min(1.0, Math.max(0, this.foldProgress));
      const stormPeak = Math.sin(progressClamped * Math.PI);
      targetIntensity = ambientIntensity + (1.0 - ambientIntensity) * stormPeak;
    }
    
    // Smoothly interpolate to avoid any sudden state-change jumps
    this.weatherIntensity += (targetIntensity - this.weatherIntensity) * 0.08;
    
    // Continuous integration of grid phase speed to prevent frame skipping/teleporting on speed transitions
    const ws = WEATHER_SETTINGS.waves;
    const waveSpeed = ws.ambientSpeed + (ws.stormSpeed - ws.ambientSpeed) * this.weatherIntensity;
    this.gridPhase += waveSpeed * 0.04;

    // Synchronize with weatherState for procedural coordinate-shifting in generation.js
    weatherState.active = this.foldActive;
    weatherState.intensity = this.weatherIntensity;
    weatherState.gridPhase = this.gridPhase;
    weatherState.clouds = this.weatherClouds;

    // 1. Accumulate continuous mining resource tick (passively gather +5 QM every second)
    const pc = CONFIG.player;
    if (Math.round(this.time * pc.passiveQmTickRate) % pc.passiveQmTickRate === 0) {
      this.qm = Math.min(this.maxQm, this.qm + pc.passiveQmAmount);
    }

    // Update floating texts
    if (this.floatingTexts) {
      this.floatingTexts.forEach(ft => ft.age++);
      this.floatingTexts = this.floatingTexts.filter(ft => ft.age < ft.maxAge);
    }

    // Region Transition Tracking
    const carrier = this.ships.find(s => s.type === 'carrier');
    const trackingX = carrier ? carrier.x : (this.camera.x + this.width / 2);
    const trackingY = carrier ? carrier.y : (this.camera.y + this.height / 2);
    const activeRegion = this.getRegionAt(trackingX, trackingY);
    if (activeRegion && this.lastRegionIndex !== activeRegion.index) {
      this.appendFeed(`🪐 ENTERING_COSMIC_ZONE: Entering ${activeRegion.zodiac} - ${activeRegion.name}`);
      this.appendFeed(`  Frequency: ${activeRegion.title}`);
      this.appendFeed(`  "${activeRegion.description}"`);
      this.lastRegionIndex = activeRegion.index;
    }

    // Continuous spacetime harvesting is now managed smoothly via the grid node distortion inversion checks below.

    // 2. Smoothly slide camera view towards coordinates target
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.12;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.12;

    // Endless Map Chunk Generation:
    const viewCenterX = this.camera.x + this.width / 2;
    const viewCenterY = this.camera.y + this.height / 2;
    const chunkCol = Math.floor(viewCenterX / 1500);
    const chunkRow = Math.floor(viewCenterY / 1500);
    
    // Check a 3x3 window of chunks around the current camera center
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const cx = chunkCol + dx;
        const cy = chunkRow + dy;
        const key = `${cx},${cy}`;
        if (!this.generatedChunks.has(key)) {
          this.generatedChunks.add(key);
          this.generateChunk(cx, cy);
        }
      }
    }

    // 3. Update active shockwaves
    this.shockwaves.forEach(sw => {
      sw.radius += sw.speed;
      sw.age += 1.0;

      // Spacetime Reconstruction Pulse propagation
      if (sw.isHealPulse) {
        const spacing = 45;
        const toDelete = [];
        for (const [key, bObj] of this.overriddenBiomes.entries()) {
          const [tx, ty] = key.split(',').map(Number);
          const wx = tx * spacing;
          const wy = ty * spacing;
          
          const dx = wx - sw.x;
          const dy = wy - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Heal the tile if within the expanding wavefront radius
          if (dist <= sw.radius && bObj.id === 'void') {
            toDelete.push(key);
          }
        }
        
        toDelete.forEach(key => {
          this.overriddenBiomes.delete(key);
          
          // Trigger a beautiful visual heal sparkle
          const [tx, ty] = key.split(',').map(Number);
          const wx = tx * spacing;
          const wy = ty * spacing;
          
          if (!this.floatingTexts) this.floatingTexts = [];
          this.floatingTexts.push({
            x: wx,
            y: wy,
            text: `✨`,
            color: '#39ff14',
            age: 0,
            maxAge: 35
          });
        });
      }
    });
    this.shockwaves = this.shockwaves.filter(sw => sw.age < sw.maxAge);

    // Natural Self-Healing of 1-tile small spacetime holes
    if (this.time % 30 === 0) {
      const spacing = 45;
      const toDelete = [];
      for (const [key, bObj] of this.overriddenBiomes.entries()) {
        if (bObj && bObj.id === 'void') {
          const [tx, ty] = key.split(',').map(Number);
          
          let nonVoidCount = 0;
          const neighbors = [
            [tx + 1, ty],
            [tx - 1, ty],
            [tx, ty + 1],
            [tx, ty - 1]
          ];
          
          for (const [nx, ny] of neighbors) {
            const nBiome = this.getBiomeAt(nx * spacing, ny * spacing);
            if (nBiome && nBiome.id !== 'void') {
              nonVoidCount++;
            }
          }
          
          // If mostly surrounded by stable space (>= 3 neighbors are non-void), it is a small hole - heal it!
          if (nonVoidCount >= 3) {
            toDelete.push(key);
          }
        }
      }
      
      toDelete.forEach(key => {
        this.overriddenBiomes.delete(key);
        
        const [tx, ty] = key.split(',').map(Number);
        const wx = tx * spacing;
        const wy = ty * spacing;
        
        if (!this.floatingTexts) this.floatingTexts = [];
        this.floatingTexts.push({
          x: wx,
          y: wy,
          text: `✧`,
          color: '#39ff14',
          age: 0,
          maxAge: 40
        });
      });
    }

    // 4. Update flashing target waypoints
    this.waypoints.forEach(wp => {
      wp.radius += 0.6;
      wp.alpha -= 0.025;
    });
    this.waypoints = this.waypoints.filter(wp => wp.alpha > 0);

    // 5. Update weapon beams
    this.lasers.forEach(l => {
      l.alpha -= 0.12;
    });
    this.lasers = this.lasers.filter(l => l.alpha > 0);

    // 6. Update Player Fleet Movement, Cooldowns, Combat selection
    this.ships.forEach(ship => {
      if (ship.cooldown > 0) ship.cooldown--;
      if (ship.teleportCooldown > 0) ship.teleportCooldown--;

      if (ship.type === 'carrier') {
        if (ship.deployCooldown > 0) {
          ship.deployCooldown--;
        }

        if (!ship.deployState) {
          ship.deployState = 'none';
          ship.deployProgress = 0;
        }

        if (ship.deployState === 'deploying') {
          ship.deployProgress = Math.min(1.0, ship.deployProgress + 0.00833); // approx 2 seconds at 60 FPS
          ship.vx = 0;
          ship.vy = 0;
          ship.targetX = null;
          ship.targetY = null;
          if (ship.deployProgress >= 1.0) {
            ship.deployState = 'deployed';
            this.appendFeed("⚓ DEPLOYED: Flagship deployed tentacles into spacetime tear. Click anywhere on the tear or use launch drop to drop!");
          }
        } else if (ship.deployState === 'deployed') {
          ship.vx = 0;
          ship.vy = 0;
          ship.targetX = null;
          ship.targetY = null;
        } else if (ship.deployState === 'undeploying') {
          ship.deployProgress = Math.max(0.0, ship.deployProgress - 0.0125); // retract slightly quicker, ~1.3 seconds
          ship.vx = 0;
          ship.vy = 0;
          ship.targetX = null;
          ship.targetY = null;
          if (ship.deployProgress <= 0.0) {
            ship.deployState = 'none';
            ship.dockedTearId = null;
            ship.deployCooldown = 180; // 3 seconds re-docking safety cooldown
            this.appendFeed("⚓ UN-DEPLOYED: Flagship retracted tentacles. Engines active.");
          }
        }

        // Process production queue
        if (ship.productionQueue && ship.productionQueue.length > 0) {
          const currentItem = ship.productionQueue[0];
          let inc = 0.8; // Fighter build time 5s (125 ticks)
          if (currentItem === 'cruiser') inc = 0.33; // Cruiser build time 12s (300 ticks)
          if (currentItem === 'dreadnought') inc = 0.16; // Dreadnought build time 25s (625 ticks)
          
          ship.productionProgress += inc;
          if (ship.productionProgress >= 100) {
            ship.productionQueue.shift();
            ship.productionProgress = 0;
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 30;
            this.spawnShip(currentItem, Math.cos(angle) * dist, Math.sin(angle) * dist);
            this.appendFeed(`❇️ PRODUCTION_COMPLETE: New ${currentItem.toUpperCase()} built and commissioned near Flagship.`);
          }
        } else {
          ship.productionProgress = 0;
        }
      }

      // Evaluate ship current biome to adjust speed and drag physics directly from the biome profile
      const shipBiome = this.getBiomeAt(ship.x, ship.y);
      ship.selectedBiome = shipBiome;
      const biomeSpeedFactor = shipBiome.speedFactor || 1.0;
      const biomeDragFactor = shipBiome.dragFactor || 0.94;

      // If ship has target, steer towards it
      if (ship.targetX !== null && ship.targetY !== null) {
        const dx = ship.targetX - ship.x;
        const dy = ship.targetY - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 8) {
          const desiredVx = (dx / dist) * ship.speed * biomeSpeedFactor;
          const desiredVy = (dy / dist) * ship.speed * biomeSpeedFactor;

          // Gentle acceleration
          ship.vx += (desiredVx - ship.vx) * 0.08;
          ship.vy += (desiredVy - ship.vy) * 0.08;

          // Rotate facing angle smoothly towards moving velocity
          const moveAngle = Math.atan2(ship.vy, ship.vx);
          let diff = moveAngle - ship.angle;
          // Normalize angle gap
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          ship.angle += diff * 0.12;
        } else {
          // Arrived! Clear target coordinates
          ship.targetX = null;
          ship.targetY = null;
        }
      }

      // Friendly fleet ships separation pushback to avoid clumping
      this.ships.forEach(other => {
        if (other.id === ship.id) return;
        const sDx = other.x - ship.x;
        const sDy = other.y - ship.y;
        const sDist = Math.sqrt(sDx*sDx + sDy*sDy) || 1;
        const minDist = ship.radius + other.radius + 6;
        if (sDist < minDist) {
          const push = (minDist - sDist) * 0.12;
          ship.vx -= (sDx / sDist) * push;
          ship.vy -= (sDy / sDist) * push;
        }
      });

      // Drag/push forces and teleportation from cosmic anomalies (black holes / white holes)
      this.blackHoles.forEach(bh => {
        const dx = bh.x - ship.x;
        const dy = bh.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < bh.gravityRange) {
          if (bh.type === 'white_hole') {
            // WHITE HOLE: Gravitational repulsion pushing ships out
            const push = (bh.mass * 0.04) / (dist * 0.05 + 1.0);
            ship.vx -= (dx / dist) * push;
            ship.vy -= (dy / dist) * push;

            // Transverse spin frame-drag (outward swirling spray)
            const twist = bh.spinSpeed * 0.02 * ((bh.gravityRange - dist) / bh.gravityRange);
            const tx = -dy / dist;
            const ty = dx / dist;
            ship.vx += tx * twist * 1.5;
            ship.vy += ty * twist * 1.5;
          } else {
            // BLACK HOLE: Gravitational attraction pulling ships in
            const pull = (bh.mass * 0.02) / (dist * 0.05 + 1.5);
            ship.vx += (dx / dist) * pull;
            ship.vy += (dy / dist) * pull;

            // Twist ship coordinates in gravitational whirlpool frame-drag
            const twist = bh.spinSpeed * 0.02 * ((bh.gravityRange - dist) / bh.gravityRange);
            const tx = -dy / dist;
            const ty = dx / dist;
            ship.vx += tx * twist * 1.5;
            ship.vy += ty * twist * 1.5;

            // TRANS-DIMENSIONAL TELEPORT: if sucked too deep into singularity!
            if (dist < bh.radius + 15 && (!ship.teleportCooldown || ship.teleportCooldown <= 0)) {
              // Prioritize white holes as exits, fallback to other black holes
              const whiteHoles = this.blackHoles.filter(other => other.id !== bh.id && other.type === 'white_hole');
              const exits = whiteHoles.length > 0 ? whiteHoles : this.blackHoles.filter(other => other.id !== bh.id);
              
              if (exits.length > 0) {
                const targetBH = exits[Math.floor(Math.random() * exits.length)];
                const exitAngle = Math.random() * Math.PI * 2;
                const exitDist = targetBH.radius + 75; // Safe distance outside core to prevent feedback loops
                
                // Move coordinates
                ship.x = targetBH.x + Math.cos(exitAngle) * exitDist;
                ship.y = targetBH.y + Math.sin(exitAngle) * exitDist;

                // Teleport entry shockwave
                this.shockwaves.push({
                  x: bh.x,
                  y: bh.y,
                  radius: 10,
                  maxRadius: bh.radius * 2.8,
                  energy: 2.0,
                  speed: 7.0,
                  age: 0,
                  maxAge: 30
                });

                // Teleport exit shockwave
                this.shockwaves.push({
                  x: ship.x,
                  y: ship.y,
                  radius: 10,
                  maxRadius: targetBH.radius * 2.8,
                  energy: 2.0,
                  speed: 7.0,
                  age: 0,
                  maxAge: 30
                });

                ship.teleportCooldown = 180; // 3 seconds safety cooldown
                const targetLabel = targetBH.type === 'white_hole' ? 'white hole' : 'singularity';
                this.appendFeed(`🌌 TELEPORT: ${ship.name.toUpperCase()} crossed singularity ${bh.id.toUpperCase()} and spewed out from ${targetLabel} ${targetBH.id.toUpperCase()}!`);
              }
            }
          }
        }
      });

      // Push forces from expanding spacetime energy shockwaves (giving physical inertia!)
      this.shockwaves.forEach(sw => {
        const dx = ship.x - sw.x;
        const dy = ship.y - sw.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const swWidth = 70;
        
        if (Math.abs(dist - sw.radius) < swWidth) {
          const ageRatio = sw.age / sw.maxAge;
          const factor = (1.0 - Math.abs(dist - sw.radius) / swWidth) * (1.0 - ageRatio);
          // Moderate push force - satisfying but not insane
          let pushForce = Math.min(EXPLOSION_PRESETS.kineticForceLimit, sw.energy * EXPLOSION_PRESETS.kineticForceFactor) * factor;
          if (ship.type === 'carrier') {
            pushForce *= 0.15; // Heavy enough to withstand weather and shockwaves!
          }
          
          ship.vx += (dx / dist) * pushForce;
          ship.vy += (dy / dist) * pushForce;
        }
      });

      if (ship.type === 'carrier' && ship.deployState && ship.deployState !== 'none') {
        ship.vx = 0;
        ship.vy = 0;
      }

      // Apply coordinates shift
      ship.x += ship.vx;
      ship.y += ship.vy;

      // Friction damping with dynamic high-velocity anchoring (if pushed too hard)
      const currentSpeed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      let damping = biomeDragFactor;
      
      const preset = SHIPS_PRESETS[ship.type];
      const naturalMaxSpeed = preset ? preset.naturalMaxSpeed : (ship.type === 'carrier' ? 0.8 : (ship.type === 'cruiser' ? 1.5 : 2.5));
      if (currentSpeed > naturalMaxSpeed) {
        // High-velocity anchoring retro-brakes
        const excess = (currentSpeed - naturalMaxSpeed) / naturalMaxSpeed;
        const anchoringFactor = Math.min(0.18, excess * 0.12);
        damping -= anchoringFactor;
      }

      // Subtle physical wave-bobbing/drift force
      const waveT = this.gridPhase * 1.5;
      const waveScale = 0.015;
      const waveForceX = Math.sin(ship.x * waveScale + waveT) * 0.012;
      const waveForceY = Math.cos(ship.y * waveScale + waveT * 0.8) * 0.012;
      ship.vx += waveForceX;
      ship.vy += waveForceY;

      ship.vx *= damping;
      ship.vy *= damping;

      // Slowly regenerate shields
      if (ship.shield < ship.maxShield) {
        ship.shield = Math.min(ship.maxShield, ship.shield + 0.15);
      }

      // Auto Attack closest enemy citadel or interceptor in range!
      if (ship.weaponRange && ship.cooldown === 0) {
        let closestEnemy = null;
        let closestDist = ship.weaponRange;

        this.enemies.forEach(enemy => {
          const dx = enemy.x - ship.x;
          const dy = enemy.y - ship.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < closestDist) {
            closestEnemy = enemy;
            closestDist = d;
          }
        });

        if (closestEnemy) {
          // Shoot laser weapon!
          ship.cooldown = ship.maxCooldown;
          
          // Warp fire laser beam visually sags around gravity (simulate curve offset)
          this.lasers.push({
            fromX: ship.x,
            fromY: ship.y,
            toX: closestEnemy.x,
            toY: closestEnemy.y,
            color: ship.type === 'carrier' ? '#ff00e5' : (ship.type === 'dreadnought' ? '#ffaa00' : (ship.type === 'cruiser' ? '#00e5ff' : '#00ff66')),
            alpha: 1.0,
            width: ship.type === 'carrier' ? 5.5 : (ship.type === 'dreadnought' ? 4 : (ship.type === 'cruiser' ? 2.5 : 1.5))
          });

          // Apply damage (shield absorbed first)
          const dmg = ship.damage || 15;
          if (closestEnemy.shield && closestEnemy.shield > 0) {
            closestEnemy.shield -= dmg;
            if (closestEnemy.shield < 0) {
              closestEnemy.health += closestEnemy.shield;
              closestEnemy.shield = 0;
            }
          } else {
            closestEnemy.health -= dmg;
          }
        }
      }
    });

    // 7. Update Hostile Forces (AI patrol, attack fleet, citadel spawns)
    this.enemies.forEach(enemy => {
      if (enemy.cooldown > 0) enemy.cooldown--;
      if (enemy.teleportCooldown > 0) enemy.teleportCooldown--;

      if (enemy.type === 'interceptor') {
        // AI: Target closest player ship, fly to it and shoot
        let closestShip = null;
        let closestDist = 450; // agro range

        this.ships.forEach(ship => {
          const dx = ship.x - enemy.x;
          const dy = ship.y - enemy.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < closestDist) {
            closestShip = ship;
            closestDist = d;
          }
        });

        // Determine biome speed/drag multiplier for interceptor directly from biome profile
        const enemyBiome = this.getBiomeAt(enemy.x, enemy.y);
        const enemySpeedFactor = enemyBiome.speedFactor || 1.0;
        const enemyDragFactor = enemyBiome.dragFactor || 0.95;

        if (closestShip) {
          enemy.targetX = closestShip.x;
          enemy.targetY = closestShip.y;

          // Steer towards player ship
          const dx = closestShip.x - enemy.x;
          const dy = closestShip.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (dist > 100) {
            const speedScale = 2.4 * enemySpeedFactor;
            enemy.vx += (dx / dist) * 0.15 * speedScale;
            enemy.vy += (dy / dist) * 0.15 * speedScale;
          }

          // Shoot at player
          if (dist < 180 && enemy.cooldown === 0) {
            enemy.cooldown = enemy.maxCooldown;
            this.lasers.push({
              fromX: enemy.x,
              fromY: enemy.y,
              toX: closestShip.x,
              toY: closestShip.y,
              color: '#ff3344', // Red hostile laser
              alpha: 1.0,
              width: 1.5
            });

            // Siphon friendly health
            if (closestShip.shield > 0) {
              closestShip.shield -= 12;
            } else {
              closestShip.health -= 12;
            }
          }
        } else {
          // Idle drift orbit
          enemy.vx += Math.sin(this.time * 2 + enemy.x) * 0.05 * enemySpeedFactor;
          enemy.vy += Math.cos(this.time * 2 + enemy.y) * 0.05 * enemySpeedFactor;
        }

        // Push forces from expanding spacetime energy shockwaves (giving physical inertia!)
        this.shockwaves.forEach(sw => {
          const dx = enemy.x - sw.x;
          const dy = enemy.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const swWidth = 70;
          
          if (Math.abs(dist - sw.radius) < swWidth) {
            const ageRatio = sw.age / sw.maxAge;
            const factor = (1.0 - Math.abs(dist - sw.radius) / swWidth) * (1.0 - ageRatio);
            // Moderate push force - satisfying but not insane
            const pushForce = Math.min(EXPLOSION_PRESETS.kineticForceLimit, sw.energy * EXPLOSION_PRESETS.kineticForceFactor) * factor;
            
            enemy.vx += (dx / dist) * pushForce;
            enemy.vy += (dy / dist) * pushForce;
          }
        });

        // Black/white hole gravity pull and teleportation
        this.blackHoles.forEach(bh => {
          const dx = bh.x - enemy.x;
          const dy = bh.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < bh.gravityRange) {
            if (bh.type === 'white_hole') {
              // WHITE HOLE: repels hostiles
              const push = (bh.mass * 0.035) / (dist * 0.05 + 1.0);
              enemy.vx -= (dx / dist) * push;
              enemy.vy -= (dy / dist) * push;
            } else {
              // BLACK HOLE: pulls hostiles
              const pull = (bh.mass * 0.015) / (dist * 0.05 + 1.5);
              enemy.vx += (dx / dist) * pull;
              enemy.vy += (dy / dist) * pull;

              // Teleport on singularity contact
              if (dist < bh.radius + 15 && (!enemy.teleportCooldown || enemy.teleportCooldown <= 0)) {
                // Prioritize white holes as exits, fallback to black holes
                const whiteHoles = this.blackHoles.filter(other => other.id !== bh.id && other.type === 'white_hole');
                const exits = whiteHoles.length > 0 ? whiteHoles : this.blackHoles.filter(other => other.id !== bh.id);
                
                if (exits.length > 0) {
                  const targetBH = exits[Math.floor(Math.random() * exits.length)];
                  const exitAngle = Math.random() * Math.PI * 2;
                  const exitDist = targetBH.radius + 75;

                  enemy.x = targetBH.x + Math.cos(exitAngle) * exitDist;
                  enemy.y = targetBH.y + Math.sin(exitAngle) * exitDist;

                  // entry / exit FX shockwaves
                  this.shockwaves.push({
                    x: bh.x,
                    y: bh.y,
                    radius: 8,
                    maxRadius: bh.radius * 2.2,
                    energy: 1.0,
                    speed: 6.0,
                    age: 0,
                    maxAge: 25
                  });

                  this.shockwaves.push({
                    x: enemy.x,
                    y: enemy.y,
                    radius: 8,
                    maxRadius: targetBH.radius * 2.2,
                    energy: 1.0,
                    speed: 6.0,
                    age: 0,
                    maxAge: 25
                  });

                  enemy.teleportCooldown = 180;
                  const targetLabel = targetBH.type === 'white_hole' ? 'white hole' : 'singularity';
                  this.appendFeed(`🌌 TELEPORT: Hostile Interceptor drawn into ${bh.id.toUpperCase()} and spewed out at ${targetLabel} ${targetBH.id.toUpperCase()}!`);
                }
              }
            }
          }
        });

        // Apply velocities
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // Friction damping with dynamic high-velocity anchoring (if pushed too hard)
        const currentSpeed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
        let damping = enemyDragFactor;
        
        const ep = ENEMIES_PRESETS[enemy.type] || ENEMIES_PRESETS.interceptor;
        const naturalMaxSpeed = ep.naturalMaxSpeed * enemySpeedFactor;
        if (currentSpeed > naturalMaxSpeed) {
          // High-velocity anchoring retro-brakes for enemies
          const excess = (currentSpeed - naturalMaxSpeed) / naturalMaxSpeed;
          const anchoringFactor = Math.min(0.18, excess * 0.12);
          damping -= anchoringFactor;
        }

        enemy.vx *= damping;
        enemy.vy *= damping;

        // Face movement direction
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);

      } else if (enemy.type === 'citadel') {
        // Citadels are stationary. Slowly spin visual shield pylons.
        enemy.angle += 0.01;

        // Auto siphon / shoot plasma bolts at nearby player fleet
        let target = null;
        let targetDist = 350;

        this.ships.forEach(ship => {
          const dx = ship.x - enemy.x;
          const dy = ship.y - enemy.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < targetDist) {
            target = ship;
            targetDist = d;
          }
        });

        if (target && enemy.cooldown === 0) {
          enemy.cooldown = enemy.maxCooldown;
          this.lasers.push({
            fromX: enemy.x,
            fromY: enemy.y,
            toX: target.x,
            toY: target.y,
            color: '#ff3344',
            alpha: 1.0,
            width: 3.5
          });

          if (target.shield > 0) {
            target.shield -= 45;
          } else {
            target.health -= 45;
          }
          this.appendFeed(`TACTICAL_ALERT: CITADEL_SIEGING_UNIT: ${target.name.toUpperCase()} HIT.`);
        }

        // Citadels spawn defenders if they are under capacity limit
        enemy.spawnTimer += 1;
        if (enemy.spawnTimer >= 380) { // Spawns guard interceptor
          enemy.spawnTimer = 0;
          const guardCount = this.enemies.filter(e => e.type === 'interceptor').length;
          if (guardCount < 7) {
            const angle = Math.random() * Math.PI * 2;
            this.enemies.push({
              id: 'hostile-citadel-guard-' + Math.random().toString(36).substr(2, 5),
              type: 'interceptor',
              name: 'Void Raider',
              x: enemy.x + Math.cos(angle) * 90,
              y: enemy.y + Math.sin(angle) * 90,
              vx: 0,
              vy: 0,
              radius: 7,
              mass: 30,
              gravityRange: 40,
              health: 100,
              maxHealth: 100,
              cooldown: 0,
              maxCooldown: 55,
              targetX: null,
              targetY: null,
              angle: angle
            });
            this.appendFeed(`SECTOR_INTEL: CITADEL_OUTPOST_WARPED_NEW_DEFENDER.`);
          }
        }
      }
    });

    // 8. Clean up dead entities and trigger shockwave explosions
    this.ships = this.ships.filter(ship => {
      if (ship.health <= 0) {
        // Expired! Trigger explosion
        const ep = EXPLOSION_PRESETS.ships;
        this.shockwaves.push({
          x: ship.x,
          y: ship.y,
          radius: ship.radius,
          maxRadius: ship.radius * ep.maxRadiusFactor,
          energy: ship.mass * ep.energyFactor,
          speed: ep.speed,
          age: 0,
          maxAge: ep.maxAge
        });

        // Drop residual quantum scrap
        const scrap = EXPLOSION_PRESETS.residualScrapOnDeath;
        this.debris.push({
          id: 'scrap-remnant-' + Math.random(),
          x: ship.x,
          y: ship.y,
          radius: 4,
          mass: scrap.baseMass,
          gravityRange: scrap.gravityRange,
          value: scrap.baseValue
        });

        this.appendFeed(`FLEET_LOSS_CRITICAL: ${ship.name.toUpperCase()} DESTROYED IN BATTLE.`);
        return false;
      }
      return true;
    });

    this.enemies = this.enemies.filter(enemy => {
      if (enemy.health <= 0) {
        const ep = EXPLOSION_PRESETS.enemies;
        this.shockwaves.push({
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius,
          maxRadius: enemy.radius * ep.maxRadiusFactor,
          energy: enemy.mass * ep.energyFactor,
          speed: ep.speed,
          age: 0,
          maxAge: ep.maxAge
        });

        if (enemy.type === 'citadel') {
          // Large citadel drop rewards massive resources
          for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 50;
            this.debris.push({
              id: 'scrap-citadel-' + i + Math.random(),
              x: enemy.x + Math.cos(angle) * dist,
              y: enemy.y + Math.sin(angle) * dist,
              radius: 4,
              mass: 15,
              gravityRange: 25,
              value: 75
            });
          }
          if (!this.spaceTears) this.spaceTears = [];
          const themes = ['scifi', 'fantasy', 'realistic'];
          const chosenTheme = themes[Math.floor(Math.random() * themes.length)];
          const isSmall = Math.random() < 0.6;
          this.spaceTears.push({
            id: `tear-${Date.now()}`,
            x: enemy.x,
            y: enemy.y,
            radius: 300,
            themeId: chosenTheme,
            completed: false,
            isSmallGrind: isSmall
          });
          this.appendFeed(`VICTORY_INTEL: VOID CITADEL DESTROYED! HARVEST REMNANTS CORES (+450 QM).`);
          this.appendFeed(`🌌 SPACE_TEAR: Spacetime has ripped completely open at Sector coordinates [${Math.round(enemy.x)}, ${Math.round(enemy.y)}]. Visual grid dissolved.`);
        } else {
          // Regular interceptor drop
          this.debris.push({
            id: 'scrap-raider-' + Math.random(),
            x: enemy.x,
            y: enemy.y,
            radius: 4,
            mass: 15,
            gravityRange: 25,
            value: 40
          });
          this.appendFeed(`HOSTILE_NEUTRALIZED: ELIMINATED VOID RAIDER.`);
        }
        return false;
      }
      return true;
    });

    // 9. Harvest nearby quantum matter crystals automatically
    this.debris = this.debris.filter(scrap => {
      if (scrap.age === undefined) scrap.age = 0;
      scrap.age++;
      if (scrap.age > 10800) return false; // 3 minutes decay time
      
      let collected = false;
      
      this.ships.forEach(ship => {
        if (collected) return;
        const dx = ship.x - scrap.x;
        const dy = ship.y - scrap.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ship.radius + 20) {
          collected = true;
          this.qm = Math.min(this.maxQm, this.qm + scrap.value);
          this.appendFeed(`RESOURCES_SECURED: HARVESTED QUANTUM CRYSTALS (+${scrap.value} QM).`);
        }
      });

      return !collected;
    });

    // Cap maximum amount of uncollected debris to avoid performance/memory leaks
    if (this.debris.length > 100) {
      this.debris = this.debris.slice(-100);
    }

    // 10. Compute continuous infinite grid fabric distortion based on active world locations
    this.updateGridDistortion();

    // 11. Process Spacetime Fold Weather Event
    this.foldTimer++;
    if (!this.foldActive) {
      if (this.foldTimer >= this.foldCooldown) {
        // Trigger a new localized weather storm event!
        this.foldActive = true;
        this.foldTimer = 0;
        this.foldProgress = 0;
        this.weatherClouds = [];

        const carrier = this.ships.find(s => s.type === 'carrier');
        const cx = carrier ? carrier.x : 0;
        const cy = carrier ? carrier.y : 0;

        // Spawn 2 to 3 storm clouds around the Flagship Carrier's current position
        const cloudCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < cloudCount; i++) {
          this.weatherClouds.push(this.createWeatherCloud(cx, cy, i));
        }

        this.appendFeed("⚠️ SPACETIME_STORM_ALERT: LOCAL ENERGY CLOUDS DETECTED CONDENSING IN THIS SECTOR!");
        this.appendFeed("> WARNING: DENSE CLOUDS WILL GENERATE DRIFT RIPPLES AND OPEN LOCAL CHASM VORTICES.");

        if (carrier) {
          this.shockwaves.push({
            x: carrier.x,
            y: carrier.y,
            radius: 50,
            maxRadius: 1000,
            energy: 4.5,
            speed: 10.0,
            age: 0,
            maxAge: 90
          });
        }
      }
    } else {
      // Storm is active! Update localized cloud positions and their effects
      this.foldProgress += 1 / this.foldDuration;
      const progressClamped = Math.min(1.0, Math.max(0, this.foldProgress));
      
      // High-fidelity sloped sinusoidal storm envelope (starts at 0.0, peaks at 1.0, decays smoothly to 0.0)
      const intensity = Math.sin(progressClamped * Math.PI);

      this.weatherClouds.forEach(cloud => {
        // Drift the clouds
        cloud.x += cloud.vx;
        cloud.y += cloud.vy;
        cloud.intensity = intensity;

        // Dynamic ecosystem: displacement (erode & discharge) and deletion
        if (Math.random() < 0.25) {
          const spacing = CONFIG.grid.spacing || 45;
          const radiusTiles = Math.floor(cloud.radius / spacing);
          const cx = Math.round(cloud.x / spacing);
          const cy = Math.round(cloud.y / spacing);

          // Ensure cloud cargo list is initialized
          if (!cloud.cargo) cloud.cargo = [];

          for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
            for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
              if (dx * dx + dy * dy <= radiusTiles * radiusTiles) {
                const distRatio = Math.sqrt(dx * dx + dy * dy) / radiusTiles;
                const tx = cx + dx;
                const ty = cy + dy;
                const key = `${tx},${ty}`;

                if (Math.random() > distRatio * 0.8) {
                  if (cloud.type === 'VOID_GRAVITY_SQUALL') {
                    // VOID_GRAVITY_SQUALL mostly erodes/removes tiles, returning them to void space
                    if (Math.random() < 0.15) {
                      const currentBiome = this.getBiomeAt(tx * spacing, ty * spacing);
                      if (currentBiome && currentBiome.id !== 'void') {
                        this.overriddenBiomes.set(key, BIOMES.void);
                      }
                    }
                  } else {
                    // COSMIC_STORM_CELL and QUANTUM_PLASMA_NEBULA clouds displacement engine
                    // 1. ERODE: Grab material from active terrain (only if it's real land/water and not already void)
                    const currentBiome = this.getBiomeAt(tx * spacing, ty * spacing);
                    if (currentBiome && currentBiome.id !== 'void' && currentBiome.id !== 'terraformed' && Math.random() < 0.08) {
                      cloud.cargo.push(currentBiome.id);
                      this.overriddenBiomes.set(key, BIOMES.void); // dissolve original to void
                    } 
                    // 2. DEPOSIT: If we have cargo material, deposit/discharge it onto void space!
                    else if (cloud.cargo.length > 0 && currentBiome && currentBiome.id === 'void' && Math.random() < 0.1) {
                      const poppedBiomeId = cloud.cargo.pop();
                      const bObj = BIOMES[poppedBiomeId];
                      if (bObj) {
                        this.overriddenBiomes.set(key, bObj);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Apply local drift winds on player ships
        this.ships.forEach(ship => {
          const dx = ship.x - cloud.x;
          const dy = ship.y - cloud.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < cloud.radius) {
            const factor = (cloud.radius - dist) / cloud.radius;
            
            // Swirling gravitational current inside the cloud
            const force = 0.5 * factor * intensity;
            ship.vx += (-dy / dist) * force;
            ship.vy += (dx / dist) * force;

            // Soft atmospheric drag inside cloud coordinates (acts as a thick gravitational anchor)
            const maxSpeed = ship.type === 'carrier' ? 0.6 : 1.8;
            const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
            if (speed > maxSpeed) {
              // Smoothly blend towards the max speed, preserving excess kinetic inertia
              ship.vx = ship.vx * 0.9 + (ship.vx / speed) * maxSpeed * 0.1;
              ship.vy = ship.vy * 0.9 + (ship.vy / speed) * maxSpeed * 0.1;
            }
          }
        });

        // Drift local enemies
        this.enemies.forEach(enemy => {
          if (enemy.type === 'citadel') return;
          const dx = enemy.x - cloud.x;
          const dy = enemy.y - cloud.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < cloud.radius) {
            const factor = (cloud.radius - dist) / cloud.radius;
            const force = 0.4 * factor * intensity;
            enemy.vx += (-dy / dist) * force;
            enemy.vy += (dx / dist) * force;
          }
        });

        // Drift local quantum scrap crystals
        this.debris.forEach(scrap => {
          const dx = scrap.x - cloud.x;
          const dy = scrap.y - cloud.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < cloud.radius) {
            const factor = (cloud.radius - dist) / cloud.radius;
            const force = 0.7 * factor * intensity;
            scrap.x += (-dy / dist) * force * 1.5;
            scrap.y += (dx / dist) * force * 1.5;
          }
        });

        // Spawn localized Spacetime Vortices (portals) under active storm cells!
        cloud.vortexSpawnTimer--;
        if (cloud.vortexSpawnTimer <= 0 && intensity > 0.45) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * cloud.radius * 0.5;
          const vx = cloud.x + Math.cos(angle) * r;
          const vy = cloud.y + Math.sin(angle) * r;

          this.createVortex(vx, vy, 'raid', 2);
          this.appendFeed(`⚡ STORM_EVENT: Local gravitational flux spawned a Void Vortex under cloud [${cloud.type}].`);

          cloud.vortexSpawnTimer = 130 + Math.random() * 80;
        }
      });

      // Visual shaking effect on camera viewport based on intensity
      const shakeAmp = Math.sin(this.time * 5.0) * (progressClamped < 0.5 ? progressClamped * 5 : (1 - progressClamped) * 5) * intensity;
      if (Number.isFinite(shakeAmp)) {
        this.camera.targetX += shakeAmp;
        this.camera.targetY += shakeAmp;
      }

      if (this.foldProgress >= 1.0) {
        // Storm dissipated and area stabilizes!
        this.foldActive = false;
        this.foldTimer = 0;
        this.weatherClouds = [];

        this.appendFeed("❇️ METEOROLOGICAL_ALERT: SPACETIME CLOUDS DISSIPATED. QUANTUM COHERENCE RE-ESTABLISHED.");

        const carrier = this.ships.find(s => s.type === 'carrier');
        const cx = carrier ? carrier.x : 0;
        const cy = carrier ? carrier.y : 0;

        // 1. Spawn fresh Quantum Matter debris near player as residual drops
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = 180 + Math.random() * 400;
          this.debris.push({
            id: 'burst-scrap-' + Math.random().toString(36).substr(2, 5),
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r,
            radius: 4,
            mass: 15,
            gravityRange: 25,
            value: 30 + Math.floor(Math.random() * 20)
          });
        }

        // 2. Spawn occasional patrol
        if (Math.random() > 0.45) {
          const angle = Math.random() * Math.PI * 2;
          const r = 400 + Math.random() * 200;
          this.createVortex(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 'raid', 2);
        } else {
          this.appendFeed("> HARVEST_ALERT: STABILIZATION GENERATED RICH NEW QUANTUM DEBRIS IN THIS AREA.");
        }
      }
    }

    // 12. Update Spacetime Vortices / Portal entries
    if (this.vortices && this.vortices.length > 0) {
      this.vortices.forEach(v => {
        if (!v.active) return;
        
        v.foldingProgress += 0.007; // Folds/seals over approx 140 frames
        
        // Swirl pull nearby debris and ships slightly towards the vortex!
        const gravitySources = [
          ...this.debris,
          ...this.ships.filter(s => s.type !== 'carrier')
        ];
        
        gravitySources.forEach(entity => {
          const dx = v.x - entity.x;
          const dy = v.y - entity.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < v.gravityRange) {
            const rangeFactor = (v.gravityRange - dist) / v.gravityRange;
            const pull = v.foldingProgress * 2.5 * rangeFactor;
            const twist = v.foldingProgress * 3.0 * rangeFactor;
            
            if (entity.vx !== undefined && entity.vy !== undefined) {
              // Apply physical acceleration vectors to ship velocity (yielding beautiful drift inertia!)
              entity.vx += (dx / dist) * pull * 0.12;
              entity.vy += (dy / dist) * pull * 0.12;
              
              entity.vx += (-dy / dist) * twist * 0.12;
              entity.vy += (dx / dist) * twist * 0.12;
            } else {
              // Lightweight scrap/debris coordinate adjustments
              entity.x += (dx / dist) * pull;
              entity.y += (dy / dist) * pull;
              entity.x += (-dy / dist) * twist;
              entity.y += (dx / dist) * twist;
            }
          }
        });

        if (v.foldingProgress >= 1.0) {
          v.active = false;
          
          // Flash a massive eruption shockwave
          this.shockwaves.push({
            x: v.x,
            y: v.y,
            radius: 30,
            maxRadius: 750,
            energy: 40,
            speed: 10.0,
            age: 0,
            maxAge: 70
          });

          this.appendFeed(`❇️ SPACETIME_TEAR_SEALED: Void Raiders spawned from the collapsed vortex.`);

          if (v.spawnType === 'citadel') {
            this.enemies.push({
              id: 'hostile-citadel-' + Math.random().toString(36).substr(2, 5),
              type: 'citadel',
              name: 'Void Citadel',
              x: v.x,
              y: v.y,
              vx: 0,
              vy: 0,
              radius: 22,
              mass: 650,
              gravityRange: 180,
              health: 1200,
              maxHealth: 1200,
              cooldown: 0,
              maxCooldown: 120,
              spawnTimer: 0,
              angle: 0
            });
          } else {
            for (let i = 0; i < v.spawnCount; i++) {
              const angle = (i * Math.PI * 2) / v.spawnCount + Math.random() * 0.4;
              const rDist = 50 + Math.random() * 30;
              const rx = v.x + Math.cos(angle) * rDist;
              const ry = v.y + Math.sin(angle) * rDist;
              this.enemies.push({
                id: 'hostile-swarm-' + Math.random().toString(36).substr(2, 5),
                type: 'interceptor',
                name: 'Void Raider',
                x: rx,
                y: ry,
                vx: 0,
                vy: 0,
                radius: 7,
                mass: 35,
                gravityRange: 40,
                health: 100,
                maxHealth: 100,
                cooldown: 0,
                maxCooldown: 50,
                targetX: rx + Math.cos(angle) * 150,
                targetY: ry + Math.sin(angle) * 150,
                angle: angle
              });
            }
          }
        }
      });
      
      this.vortices = this.vortices.filter(v => v.active);
    }
  }

  // Smooth continuous modulo wrapping for the "endless" grid nodes relative to screen viewports
  updateGridDistortion() {
    const zoom = this.camera.zoom || 1.0;
    
    // LEVEL OF DETAIL (LOD) SPACETIME GRID RESOLUTION COARSE-GRAINING
    let spacing = 45; // Grid spacing multiplier
    if (zoom < 0.3) {
      spacing = 180; // Ultra coarse-grain for full 12% zoom out (16x fewer nodes processed/drawn)
    } else if (zoom < 0.7) {
      spacing = 90; // Coarse-grain for medium zoom out (4x fewer nodes processed/drawn)
    }

    this.activeSiphons = [];
    const carrier = this.ships.find(s => s.type === 'carrier');
    
    // Smooth camera panning wrap-offsets
    const fractionalCamX = this.camera.x % spacing;
    const fractionalCamY = this.camera.y % spacing;

    const padding = 3; // safety padding rows/cols
    const minScreenX = this.width / 2 - (this.width / 2) / zoom - padding * spacing;
    const maxScreenX = this.width / 2 + (this.width / 2) / zoom + padding * spacing;
    const minScreenY = this.height / 2 - (this.height / 2) / zoom - padding * spacing;
    const maxScreenY = this.height / 2 + (this.height / 2) / zoom + padding * spacing;

    const startC = Math.floor((minScreenX + fractionalCamX) / spacing);
    const endC = Math.ceil((maxScreenX + fractionalCamX) / spacing);
    const startR = Math.floor((minScreenY + fractionalCamY) / spacing);
    const endR = Math.ceil((maxScreenY + fractionalCamY) / spacing);

    this.gridCols = endC - startC + 1;
    this.gridRows = endR - startR + 1;

    const totalNodesNeeded = this.gridCols * this.gridRows;
    while (this.gridNodes.length < totalNodesNeeded) {
      this.gridNodes.push({ ox: 0, oy: 0, x: 0, y: 0 });
    }

    const viewportLeft = this.camera.x + this.width / 2 - (this.width / 2) / zoom;
    const viewportRight = this.camera.x + this.width / 2 + (this.width / 2) / zoom;
    const viewportTop = this.camera.y + this.height / 2 - (this.height / 2) / zoom;
    const viewportBottom = this.camera.y + this.height / 2 + (this.height / 2) / zoom;

    // PRE-COMPUTE AND PRE-FILTER GRAVITY SOURCES ONCE PER FRAME OUTSIDE NESTED LOOPS
    const vortexSources = this.vortices.map(v => ({
      x: v.x,
      y: v.y,
      gravityRange: v.gravityRange,
      mass: 160 * v.foldingProgress,
      spinSpeed: 15 * v.foldingProgress
    }));

    const rawGravitySources = [
      ...this.ships,
      ...this.enemies,
      ...this.blackHoles,
      ...vortexSources
    ].filter(source => source.gravityRange && source.gravityRange >= 100);

    const activeGravitySources = rawGravitySources.filter(source => {
      const range = source.gravityRange || 50;
      const pad = range + 80;
      return (
        source.x >= viewportLeft - pad &&
        source.x <= viewportRight + pad &&
        source.y >= viewportTop - pad &&
        source.y <= viewportBottom + pad
      );
    });

    // PRE-FILTER SHOCKWAVES ONCE PER FRAME OUTSIDE NESTED LOOPS
    const activeShockwaves = this.shockwaves.filter(sw => {
      const pad = sw.radius + 150;
      return (
        sw.x >= viewportLeft - pad &&
        sw.x <= viewportRight + pad &&
        sw.y >= viewportTop - pad &&
        sw.y <= viewportBottom + pad
      );
    });

    // PRE-FILTER WEATHER CLOUDS ONCE PER FRAME OUTSIDE NESTED LOOPS
    const activeWeatherClouds = (this.weatherClouds || []).filter(cloud => {
      const pad = cloud.radius + 150;
      return (
        cloud.x >= viewportLeft - pad &&
        cloud.x <= viewportRight + pad &&
        cloud.y >= viewportTop - pad &&
        cloud.y <= viewportBottom + pad
      );
    });

    let nodeIdx = 0;
    for (let c = startC; c <= endC; c++) {
      const screenRestX = c * spacing - fractionalCamX;
      for (let r = startR; r <= endR; r++) {
        const screenRestY = r * spacing - fractionalCamY;
        
        // Pick allocated node in fast array list
        const node = this.gridNodes[nodeIdx];
        if (!node) continue;
        nodeIdx++;
        
        // Save Screen resting coordinate
        node.ox = screenRestX;
        node.oy = screenRestY;
        
        // Calculate corresponding World coordinate position
        const worldRestX = screenRestX + this.camera.x;
        const worldRestY = screenRestY + this.camera.y;

        let dxTotal = 0;
        let dyTotal = 0;

        // Ambient microscopic space ripple wave
        const scale = 0.007;
        const t = this.gridPhase;
        const ampFactor = 1.0 + (4.2 - 1.0) * this.weatherIntensity;
        const phase1 = (worldRestX * 0.65 + worldRestY * 0.45) * scale - t;
        const phase2 = (-worldRestX * 0.4 + worldRestY * 0.75) * scale + t * 0.8;
        dxTotal += Math.sin(phase1) * 2.5 * ampFactor;
        dyTotal += Math.cos(phase2) * 2.5 * ampFactor;

        // Localized weather clouds wave ripples
        if (activeWeatherClouds.length > 0) {
          activeWeatherClouds.forEach(cloud => {
            const dx = worldRestX - cloud.x;
            const dy = worldRestY - cloud.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cloud.radius) {
              const factor = (cloud.radius - dist) / cloud.radius;
              const wavePhase = (dist * 0.045 - this.time * 3.5);
              const waveAmp = 18.0 * factor * cloud.intensity;
              dxTotal += Math.sin(wavePhase) * waveAmp;
              dyTotal += Math.cos(wavePhase) * waveAmp;
            }
          });
        }

        // Accumulate grid sags towards nearby active pre-culled gravitational objects
        activeGravitySources.forEach(source => {
          const dx = source.x - worldRestX;
          const dy = source.y - worldRestY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (dist < source.gravityRange) {
            // Quadratic smoothstep decay at gravity range borders
            const rangeFactor = (source.gravityRange - dist) / source.gravityRange;
            let pull = (source.mass * 1.25 * rangeFactor) / (dist * 0.05 + 8.0);

            // If the gravity source possesses a frame-drag whirl signature (Dreadnought / Black Holes)
            if (source.spinSpeed) {
              const twist = source.spinSpeed * rangeFactor * 0.12;
              const cosT = Math.cos(twist);
              const sinT = Math.sin(twist);
              const px = (dx / dist) * pull;
              const py = (dy / dist) * pull;
              dxTotal += px * cosT - py * sinT;
              dyTotal += px * sinT + py * cosT;
            } else {
              // Regular radial gravity well sag
              dxTotal += (dx / dist) * pull;
              dyTotal += (dy / dist) * pull;
            }
          }
        });

        // Accumulate pre-culled shockwave outward wave ripples
        activeShockwaves.forEach(sw => {
          const dx = sw.x - worldRestX;
          const dy = sw.y - worldRestY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const swWidth = 65; // Wave boundary width
          
          if (Math.abs(dist - sw.radius) < swWidth) {
            const ageRatio = sw.age / sw.maxAge;
            const factor = (1.0 - Math.abs(dist - sw.radius) / swWidth) * (1.0 - ageRatio);
            // Oscillatory sine displacement pulse
            const ripple = Math.sin((dist - sw.radius) * 0.08) * sw.energy * factor * 6.5;
            dxTotal += (dx / dist) * ripple;
            dyTotal += (dy / dist) * ripple;
          }
        });

        // Set distorted absolute screen coordinate
        node.x = screenRestX + dxTotal;
        node.y = screenRestY + dyTotal;
        
        // Cache node world position and corresponding biome to fully eliminate redundant rendering evaluations
        node.worldX = worldRestX + dxTotal;
        node.worldY = worldRestY + dyTotal;
        node.biome = this.getBiomeAt(node.worldX, node.worldY);
        node.region = this.getRegionAt(node.worldX, node.worldY);

        let isRevealed = false;
        const revealRadius = 2000; // matching minimap distance
        for (let i = 0; i < this.ships.length; i++) {
          const ship = this.ships[i];
          const dx = node.worldX - ship.x;
          const dy = node.worldY - ship.y;
          if (dx * dx + dy * dy < revealRadius * revealRadius) {
            isRevealed = true;
            break;
          }
        }
        node.isRevealed = isRevealed;

        if (carrier && node.biome && node.biome.id !== 'void' && node.biome.id !== 'terraformed' && node.biome.resource) {
          const distToCarrier = Math.sqrt((worldRestX - carrier.x) * (worldRestX - carrier.x) + (worldRestY - carrier.y) * (worldRestY - carrier.y)) || 1;
          if (distToCarrier < 420) {
            const rangeFactor = (420 - distToCarrier) / 420;
            const pull = (1400 * 1.25 * rangeFactor) / (distToCarrier * 0.05 + 8.0);
            const inversionRatio = pull / distToCarrier;

            if (inversionRatio >= 0.85) {
              const tx = Math.round(worldRestX / 45); // use base map spacing of 45!
              const ty = Math.round(worldRestY / 45); // use base map spacing of 45!
              const key = `${tx},${ty}`;
              
              if (!this.overriddenBiomes.has(key) || this.overriddenBiomes.get(key).id !== 'terraformed') {
                const resName = node.biome.resource;
                const qmGained = 4;
                this.qm = Math.min(this.maxQm, this.qm + qmGained);
                
                this.overriddenBiomes.set(key, BIOMES.terraformed);
                node.biome = BIOMES.terraformed;

                this.appendFeed(`⚡ KNOT_INVERSION_GATHER: Space-time inverted at Sector [${tx}, ${ty}] -> Transmuted +4 QM!`);
                
                if (!this.floatingTexts) this.floatingTexts = [];
                this.floatingTexts.push({
                  x: node.worldX,
                  y: node.worldY,
                  text: `+4 QM (${resName})`,
                  color: '#00ff66',
                  age: 0,
                  maxAge: 45
                });

                this.shockwaves.push({
                  x: worldRestX,
                  y: worldRestY,
                  radius: 4,
                  maxRadius: 32,
                  energy: 1.5,
                  speed: 3.0,
                  age: 0,
                  maxAge: 16
                });
              }
            } else if (inversionRatio >= 0.15) {
              this.activeSiphons.push({
                fromX: node.x,
                fromY: node.y,
                toX: carrier.x - this.camera.x,
                toY: carrier.y - this.camera.y,
                ratio: inversionRatio,
                resource: node.biome.resource
              });

              if (Math.random() < 0.0006) {
                this.qm = Math.min(this.maxQm, this.qm + 1);
                if (!this.floatingTexts) this.floatingTexts = [];
                this.floatingTexts.push({
                  x: node.worldX,
                  y: node.worldY,
                  text: `+1 QM`,
                  color: 'rgba(0, 229, 255, 0.85)',
                  age: 0,
                  maxAge: 35
                });
              }
            }
          }
        }
      }
    }
  }

  // Recall all escorts to Flagship Carrier coordinates
  recallFleet() {
    const carrier = this.ships.find(s => s.type === 'carrier');
    if (!carrier) return;

    this.appendFeed(`RECALL_ORDER_TRANSMITTED: ALL FLEET COMMANDS REVERTING TO FLAGSHIP ESCORT.`);
    const escorts = this.ships.filter(s => s.type !== 'carrier');
    
    escorts.forEach((ship, idx) => {
      const angle = (idx * Math.PI * 2) / Math.max(1, escorts.length);
      ship.targetX = carrier.x + Math.cos(angle) * 75;
      ship.targetY = carrier.y + Math.sin(angle) * 75;
    });

    // Flash a waypoint circle at the Carrier location
    this.addWaypoint(carrier.x, carrier.y, '#ffb300');
  }

  // Hyperjump Flagship Carrier to random space coordinates (escaping danger or exploring further)
  hyperjumpCarrier() {
    const carrier = this.ships.find(s => s.type === 'carrier');
    if (!carrier) return;

    if (carrier.deployState && carrier.deployState !== 'none') {
      this.appendFeed(`JUMP_ABORT: FLAGSHIP IS DEPLOYED AND ANCHORED IN A SPACETIME TEAR. RETRACT TENTACLES FIRST.`);
      return;
    }

    // Hyperjump costs 100 QM
    if (this.qm < 100) {
      this.appendFeed(`JUMP_ABORT: INSUFFICIENT ENERGY MATTERS. REQUIRE 100 QM TO STABILIZE SPATIAL TEAR.`);
      return;
    }

    this.qm -= 100;
    this.appendFeed(`WARP_CORE_CHARGING: FLAGSHIP CARRIER JUMPING TO UNKNOWN SECTOR...`);

    // Spawn massive shockwave at current location
    this.shockwaves.push({
      x: carrier.x,
      y: carrier.y,
      radius: carrier.radius,
      maxRadius: 600,
      energy: 80,
      speed: 12.0,
      age: 0,
      maxAge: 60
    });

    // Random jump coordinates relative to current positions
    const angle = Math.random() * Math.PI * 2;
    const jumpDist = 1200 + Math.random() * 800;
    const newX = carrier.x + Math.cos(angle) * jumpDist;
    const newY = carrier.y + Math.sin(angle) * jumpDist;

    // Shift Carrier position
    carrier.x = newX;
    carrier.y = newY;
    carrier.targetX = null;
    carrier.targetY = null;

    // Drag all friendly selected ships with it!
    this.ships.forEach((ship, idx) => {
      if (ship.type === 'carrier') return;
      const rAngle = (idx * Math.PI * 2) / Math.max(1, this.ships.length - 1);
      ship.x = newX + Math.cos(rAngle) * 80;
      ship.y = newY + Math.sin(rAngle) * 80;
      ship.vx = 0;
      ship.vy = 0;
      ship.targetX = null;
      ship.targetY = null;
    });

    // Spawn a matching hyperjump ripple at landing destination
    this.shockwaves.push({
      x: newX,
      y: newY,
      radius: carrier.radius,
      maxRadius: 500,
      energy: 50,
      speed: 10.0,
      age: 0,
      maxAge: 50
    });

    // Pan camera to carrier
    this.camera.targetX = newX - this.width / 2;
    this.camera.targetY = newY - this.height / 2;
    this.camera.x = this.camera.targetX;
    this.camera.y = this.camera.targetY;

    this.appendFeed(`CARRIER_JUMP_SUCCESS: DEPLOYED AT COORDS [${Math.round(newX)}, ${Math.round(newY)}].`);
  }

  createWeatherCloud(cx, cy, i) {
    const angle = Math.random() * Math.PI * 2;
    // Spawn across the entire visible/minimap space
    const spawnDist = 100 + Math.random() * 1800;
    const cloudX = cx + Math.cos(angle) * spawnDist;
    const cloudY = cy + Math.sin(angle) * spawnDist;

    // Drift angle back towards or past the carrier
    const driftAngle = angle + Math.PI + (Math.random() - 0.5) * 1.2;
    const driftSpeed = 1.6 + Math.random() * 1.8;

    // Weather Type
    const types = ['COSMIC_STORM_CELL', 'VOID_GRAVITY_SQUALL', 'QUANTUM_PLASMA_NEBULA'];
    const type = types[i % types.length];
    const colors = ['#ff3366', '#ffaa00', '#00e5ff'];
    const color = colors[i % colors.length];

    // Scientific spacey biomes carried by this cloud system
    const biomeMap = {
      'COSMIC_STORM_CELL': ['mountain', 'desert'],
      'VOID_GRAVITY_SQUALL': ['savannah', 'snowy_peak'],
      'QUANTUM_PLASMA_NEBULA': ['river', 'forest']
    };
    const possibleBiomes = biomeMap[type] || ['desert'];
    const paintBiome = possibleBiomes[Math.floor(Math.random() * possibleBiomes.length)];

    return {
      id: `cloud-${this.time}-${i}-${Math.floor(Math.random() * 1000)}`,
      x: cloudX,
      y: cloudY,
      vx: Math.cos(driftAngle) * driftSpeed,
      vy: Math.sin(driftAngle) * driftSpeed,
      radius: 340 + Math.random() * 120,
      intensity: 1.0,
      color: color,
      type: type,
      paintBiome: paintBiome,
      cargo: [],
      vortexSpawnTimer: 60 + Math.random() * 60
    };
  }

  // Force-trigger a spacetime storm on demand
  triggerSpacetimeStorm() {
    this.foldActive = true;
    this.foldTimer = 0;
    this.foldProgress = 0;
    this.weatherClouds = [];

    const carrier = this.ships.find(s => s.type === 'carrier');
    const cx = carrier ? carrier.x : 0;
    const cy = carrier ? carrier.y : 0;

    // Spawn 2 to 3 storm clouds around the Flagship Carrier's current position
    const cloudCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < cloudCount; i++) {
      this.weatherClouds.push(this.createWeatherCloud(cx, cy, i));
    }

    this.appendFeed("🚨 MANUAL_STORM_TRIGGERED: FORCED SPACETIME STIMULUS ACTIVATED!");
    this.appendFeed("> COMMAND: EMITTING HARMONIC PERTURBATIONS TO RESHUFFLE PROCEDURAL FABRIC MATRIX.");

    if (carrier) {
      this.shockwaves.push({
        x: carrier.x,
        y: carrier.y,
        radius: 50,
        maxRadius: 1000,
        energy: 6.0,
        speed: 12.0,
        age: 0,
        maxAge: 90
      });
    }
  }

  // Mothership Spacetime Reconstruction active ability
  triggerSpacetimeHealPulse() {
    const carrier = this.ships.find(s => s.type === 'carrier');
    if (!carrier) {
      this.appendFeed(`⚠️ INTEGRITY_ERROR: Flagship Carrier not found in local sector coordinates.`);
      return;
    }

    // Ability costs 100 QM so it is a tactical choice!
    const cost = 100;
    if (this.qm < cost) {
      this.appendFeed(`❌ RECONSTRUCTION_FAILED: Insufficient Quantum Matter. Needs ${cost} QM.`);
      return;
    }

    // Deduct cost
    this.qm -= cost;

    this.appendFeed(`❇️ SPACETIME_RECONSTRUCTION_PULSE: Flagship Carrier emitting high-frequency spatial harmonics wave.`);

    // Spawn a beautiful, localized Space Tear (portal doorway)
    if (!this.spaceTears) this.spaceTears = [];
    const themes = ['scifi', 'fantasy', 'realistic'];
    const chosenTheme = themes[Math.floor(Math.random() * themes.length)];
    const isSmall = Math.random() < 0.6; // 60% chance for grind maps
    this.spaceTears.push({
      id: `tear-${Date.now()}`,
      x: carrier.x,
      y: carrier.y,
      radius: 300,
      themeId: chosenTheme,
      completed: false,
      isSmallGrind: isSmall
    });
    this.appendFeed(`🌌 SPACE_TEAR: Spacetime has ripped completely open at Sector coordinates [${Math.round(carrier.x)}, ${Math.round(carrier.y)}]. Mode: [${isSmall ? "SMALL_GRIND" : "STANDARD_CONQUEST"}].`);

    // Trigger visual and physical shockwave
    this.shockwaves.push({
      x: carrier.x,
      y: carrier.y,
      radius: 10,
      maxRadius: 1400, // Large AOE
      energy: 9.5,     // Strong distortion
      speed: 18.0,     // Expands fast
      age: 0,
      maxAge: 85,
      isHealPulse: true
    });

    // Push back all enemies in range!
    this.enemies.forEach(enemy => {
      const dx = enemy.x - carrier.x;
      const dy = enemy.y - carrier.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1400) {
        const force = (1400 - dist) / 1400 * 45; // heavy knockback force
        const angle = Math.atan2(dy, dx);
        enemy.vx += Math.cos(angle) * force;
        enemy.vy += Math.sin(angle) * force;
        enemy.health = Math.max(1, enemy.health - 20); // soft damage to enemies too!
      }
    });

    // Soft visual screen shake
    this.camera.targetX += (Math.random() - 0.5) * 50;
    this.camera.targetY += (Math.random() - 0.5) * 50;
  }

  // Main Render Loop
  render() {
    // Fill deep cosmos vacuum color background
    this.ctx.fillStyle = '#020204';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Save and apply camera zoom transform for all world content
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.camera.zoom || 1.0, this.camera.zoom || 1.0);
    this.ctx.translate(-this.width / 2, -this.height / 2);

    // If weather is active, draw a dynamic ambient environmental glow!
    if (this.foldActive && this.weatherClouds && this.weatherClouds.length > 0) {
      this.weatherClouds.forEach(cloud => {
        if (cloud.intensity > 0.01) {
          const screenX = cloud.x - this.camera.x;
          const screenY = cloud.y - this.camera.y;
          
          // Only draw gradient if close enough to screen viewport padding
          const pad = cloud.radius * 2.5;
          if (this.isInViewport(screenX, screenY, pad)) {
            const r = cloud.radius * 2.0;
            const grad = this.ctx.createRadialGradient(
              screenX, screenY, 5,
              screenX, screenY, r
            );
            
            // Extract opacity based on storm intensity
            const opacity = 0.06 * cloud.intensity;
            const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
            
            grad.addColorStop(0, `${cloud.color}${opacityHex}`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, this.width, this.height);
          }
        }
      });

      // Occasional atmospheric electromagnetic grid discharge/lightning flash!
      const peakCloud = this.weatherClouds.find(c => c.intensity > 0.6);
      if (peakCloud && Math.random() < 0.006) {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Bypass camera zoom/translate to fill entire viewport perfectly!
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
        
        // Occasional audio-visual text logs on the tactical screen
        if (Math.random() < 0.1) {
          this.appendFeed(`❇️ ATMOSPHERIC_DISCHARGE: High energy electromagnetic arc detected inside ${peakCloud.type}.`);
        }
      }
    }

    // 1. Draw solid biome tiles and stylized decals
    this.drawBiomeTiles();

    // 2. Draw distortion grid lines
    this.drawDistortionGrid();

    // 2.5 Draw active spacetime siphons
    this.drawSiphons();

    // 2.6 Draw spacetime shockwaves wavefronts
    this.drawShockwaves();

    // 2.7 Draw pure black Space Tears
    this.drawSpaceTears();

    // 2. Render gameplay entities if Tactical View is enabled
    if (this.renderMode === 'tactical') {
      // Draw quantum scrap crystals
      this.drawDebris();
      
      // Draw weapon beams
      this.drawLasers();

      // Draw flashing target waypoints
      this.drawWaypoints();

      // Draw permanent cosmic anomalies (Black Holes)
      this.drawBlackHoles();

      // Draw procedural landmarks, taverns, and cities
      this.drawStructures();

      // Draw Spacetime vortices (Enemy portals)
      this.drawVortices();

      // Draw localized weather clouds
      this.drawWeatherClouds();

      // Draw Hostile units
      this.drawEnemies();

      // Draw Player Fleet starships
      this.drawShips();

      // Draw carrier terraforming scanning circle
      const carrier = this.ships.find(s => s.type === 'carrier');
      if (carrier) {
        const screenX = carrier.x - this.camera.x;
        const screenY = carrier.y - this.camera.y;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 180, 0, Math.PI * 2);
        this.ctx.stroke();

        // Sweeper arm
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.28)';
        this.ctx.lineWidth = 1.2;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        const sweepAngle = this.time * 0.8;
        this.ctx.moveTo(screenX, screenY);
        this.ctx.lineTo(screenX + Math.cos(sweepAngle) * 180, screenY + Math.sin(sweepAngle) * 180);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // Draw floating texts
      if (this.floatingTexts) {
        this.floatingTexts.forEach(ft => {
          const screenX = ft.x - this.camera.x;
          const screenY = ft.y - this.camera.y - ft.age * 0.6; // Floats upwards!
          const alpha = 1.0 - ft.age / ft.maxAge;
          this.ctx.save();
          this.ctx.globalAlpha = alpha;
          this.ctx.fillStyle = ft.color || '#00e5ff';
          this.ctx.font = 'bold 9px "Space Grotesk", "Inter", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.shadowBlur = 4;
          this.ctx.shadowColor = ft.color || '#00e5ff';
          this.ctx.fillText(ft.text, screenX, screenY);
          this.ctx.restore();
        });
      }

      this.ctx.restore(); // Exit camera zoom context
      // Draw select drag marquee frame if dragging marquee
      this.drawMarqueeFrame();

      // Draw Spatial Deploy laser target reticle
      if (window.deployToolActive && this.mousePos) {
        this.ctx.save();
        this.ctx.strokeStyle = '#00e5ff';
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#00e5ff';
        
        const mx = this.mousePos.x;
        const my = this.mousePos.y;
        
        // Draw outer target circle
        this.ctx.beginPath();
        this.ctx.arc(mx, my, 22, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw inner dot
        this.ctx.fillStyle = '#00e5ff';
        this.ctx.beginPath();
        this.ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw crosshair lines
        this.ctx.beginPath();
        this.ctx.moveTo(mx - 32, my);
        this.ctx.lineTo(mx - 10, my);
        this.ctx.moveTo(mx + 10, my);
        this.ctx.lineTo(mx + 32, my);
        this.ctx.moveTo(mx, my - 32);
        this.ctx.lineTo(mx, my - 10);
        this.ctx.moveTo(mx, my + 10);
        this.ctx.lineTo(mx, my + 32);
        this.ctx.stroke();

        // Target HUD coordinates
        const worldPos = this.screenToWorld(mx, my);
        this.ctx.fillStyle = '#00e5ff';
        this.ctx.font = '8px var(--font-mono)';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`DEPLOY_TARGET_COORDS: [${Math.round(worldPos.x)}, ${Math.round(worldPos.y)}]`, mx + 12, my - 12);
        
        this.ctx.restore();
      }
    } else {
      this.ctx.restore(); // Exit camera zoom context
      // Grid-only diagnostic readout style
      this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#00e5ff';
      this.ctx.font = '10px monospace';
      this.ctx.fillText(`SPACE_GRID_FABRIC_DIAGNOSTIC_MODE`, 16, 22);
    }
  }

  // Fills the biome quad cells with gorgeous colors and procedural details (Fills disabled for pure abstract space look)
  drawBiomeTiles() {
    return;
  }

  // Renders the delicate spacetime-siphoning filaments/beams flowing from grid nodes into the flagship carrier
  drawSiphons() {
    if (!this.activeSiphons || this.activeSiphons.length === 0) return;
    
    this.ctx.save();
    this.ctx.lineWidth = 1.0;
    
    this.activeSiphons.forEach(s => {
      // Pulse opacity based on the inversion ratio and current simulation frame time
      const pulse = 0.08 + 0.35 * Math.sin(this.time * 0.18 + s.fromX * 0.04) * s.ratio;
      if (pulse <= 0.01) return;

      this.ctx.strokeStyle = s.resource === 'Water' ? `rgba(0, 190, 255, ${pulse})` :
                            s.resource === 'Earth' ? `rgba(190, 160, 90, ${pulse})` :
                            s.resource === 'Wind' ? `rgba(255, 179, 0, ${pulse})` :
                            s.resource === 'Air' ? `rgba(40, 160, 80, ${pulse})` :
                            `rgba(0, 229, 255, ${pulse})`;
                            
      // Set moving dash pattern to represent resources flowing along space-time warping paths
      this.ctx.setLineDash([4, 8]);
      this.ctx.lineDashOffset = this.time * 2.0;
      
      this.ctx.beginPath();
      this.ctx.moveTo(s.fromX, s.fromY);
      this.ctx.lineTo(s.toX, s.toY);
      this.ctx.stroke();
    });
    
    this.ctx.restore();
  }

  // Renders beautiful glowing visual rings for active expanding shockwave wavefronts
  drawShockwaves() {
    if (!this.shockwaves || this.shockwaves.length === 0) return;

    this.ctx.save();
    this.shockwaves.forEach(sw => {
      const sX = sw.x - this.camera.x;
      const sY = sw.y - this.camera.y;

      const ageRatio = sw.age / sw.maxAge;
      const alpha = 1.0 - ageRatio;
      if (alpha <= 0.01) return;

      this.ctx.beginPath();
      this.ctx.arc(sX, sY, sw.radius, 0, Math.PI * 2);

      if (sw.isHealPulse) {
        // Spacetime Reconstruction Pulse: cybernetic lime green/neon teal
        this.ctx.strokeStyle = `rgba(57, 255, 20, ${alpha * 0.85})`;
        this.ctx.lineWidth = 4.0 * (1.0 - ageRatio * 0.5);
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#39ff14';
      } else {
        // Standard kinetic shockwave: hot cyan/white
        this.ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.6})`;
        this.ctx.lineWidth = 2.0 * (1.0 - ageRatio * 0.5);
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#00e5ff';
      }

      this.ctx.stroke();
      this.ctx.shadowBlur = 0; // Reset shadow for next iterations
    });
    this.ctx.restore();
  }

  // Connects the nodes of the distorted coordinate grid with premium biome-sensitive coloring
  drawDistortionGrid() {
    const cols = this.gridCols;
    const rows = this.gridRows;

    // Draw vertical columns lines segment-by-segment for beautiful biome coloring
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows - 1; r++) {
        const idx1 = c * rows + r;
        const idx2 = c * rows + (r + 1);
        const n1 = this.gridNodes[idx1];
        const n2 = this.gridNodes[idx2];
        if (n1 && n2) {
          // Space Tear grid line culling
          let insideTear = false;
          if (this.spaceTears && this.spaceTears.length > 0) {
            for (let i = 0; i < this.spaceTears.length; i++) {
              const tear = this.spaceTears[i];
              const dx1 = n1.worldX - tear.x;
              const dy1 = n1.worldY - tear.y;
              const dx2 = n2.worldX - tear.x;
              const dy2 = n2.worldY - tear.y;
              if (Math.sqrt(dx1*dx1 + dy1*dy1) < tear.radius || Math.sqrt(dx2*dx2 + dy2*dy2) < tear.radius) {
                insideTear = true;
                break;
              }
            }
          }
          if (insideTear) continue;

          const biome = n1.biome;
          if (!biome) continue;
          
          const isRevealed = n1.isRevealed;

          const region1 = n1.region || REGIONS[0];
          const region2 = n2.region || REGIONS[0];
          const isBorder = (region1.index !== region2.index);

          let strokeColor = this.blendBiomeAndRegion(biome.gridColor, region1.color, isRevealed);
          let lineWidth = isRevealed ? (biome.isLand ? 2.4 : (biome.id === 'river' || biome.id === 'lake' ? 1.8 : 1.0)) : 1.0;
          
          if (isRevealed && isBorder) {
            lineWidth += 1.2;
            strokeColor = region1.color; // pure vibrant celestial color at country boundaries
          }

          let stormColor = null;
          let stormWeight = 0;
          
          // Environment color shift: warp grid lines color & thickness inside storm clouds!
          if (this.foldActive && this.weatherClouds && this.weatherClouds.length > 0) {
            this.weatherClouds.forEach(cloud => {
              if (cloud.intensity > 0.05) {
                const dx = n1.worldX - cloud.x;
                const dy = n1.worldY - cloud.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < cloud.radius) {
                  const factor = (cloud.radius - dist) / cloud.radius * cloud.intensity;
                  if (factor > 0.05) {
                    stormColor = cloud.color;
                    stormWeight = factor;
                    lineWidth += factor * 1.5;
                  }
                }
              }
            });
          }

          this.ctx.beginPath();
          this.ctx.moveTo(n1.x, n1.y);
          this.ctx.lineTo(n2.x, n2.y);
          
          this.ctx.strokeStyle = strokeColor;
          this.ctx.lineWidth = lineWidth;
          this.ctx.stroke();

          // Overlay transparent storm highlight so the biome remains fully visible beneath
          if (stormColor && stormWeight > 0.05) {
            this.ctx.beginPath();
            this.ctx.moveTo(n1.x, n1.y);
            this.ctx.lineTo(n2.x, n2.y);
            this.ctx.strokeStyle = stormColor;
            this.ctx.lineWidth = lineWidth * 0.8;
            this.ctx.save();
            this.ctx.globalAlpha = stormWeight * 0.45;
            this.ctx.stroke();
            this.ctx.restore();
          }
        }
      }
    }

    // Draw horizontal rows lines segment-by-segment for beautiful biome coloring
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const idx1 = c * rows + r;
        const idx2 = (c + 1) * rows + r;
        const n1 = this.gridNodes[idx1];
        const n2 = this.gridNodes[idx2];
        if (n1 && n2) {
          // Space Tear grid line culling
          let insideTear = false;
          if (this.spaceTears && this.spaceTears.length > 0) {
            for (let i = 0; i < this.spaceTears.length; i++) {
              const tear = this.spaceTears[i];
              const dx1 = n1.worldX - tear.x;
              const dy1 = n1.worldY - tear.y;
              const dx2 = n2.worldX - tear.x;
              const dy2 = n2.worldY - tear.y;
              if (Math.sqrt(dx1*dx1 + dy1*dy1) < tear.radius || Math.sqrt(dx2*dx2 + dy2*dy2) < tear.radius) {
                insideTear = true;
                break;
              }
            }
          }
          if (insideTear) continue;

          const biome = n1.biome;
          if (!biome) continue;
          
          const isRevealed = n1.isRevealed;

          const region1 = n1.region || REGIONS[0];
          const region2 = n2.region || REGIONS[0];
          const isBorder = (region1.index !== region2.index);

          let strokeColor = this.blendBiomeAndRegion(biome.gridColor, region1.color, isRevealed);
          let lineWidth = isRevealed ? (biome.isLand ? 2.4 : (biome.id === 'river' || biome.id === 'lake' ? 1.8 : 1.0)) : 1.0;
          
          if (isRevealed && isBorder) {
            lineWidth += 1.2;
            strokeColor = region1.color; // pure vibrant celestial color at country boundaries
          }

          let stormColor = null;
          let stormWeight = 0;
          
          // Environment color shift: warp grid lines color & thickness inside storm clouds!
          if (this.foldActive && this.weatherClouds && this.weatherClouds.length > 0) {
            this.weatherClouds.forEach(cloud => {
              if (cloud.intensity > 0.05) {
                const dx = n1.worldX - cloud.x;
                const dy = n1.worldY - cloud.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < cloud.radius) {
                  const factor = (cloud.radius - dist) / cloud.radius * cloud.intensity;
                  if (factor > 0.05) {
                    stormColor = cloud.color;
                    stormWeight = factor;
                    lineWidth += factor * 1.5;
                  }
                }
              }
            });
          }

          this.ctx.beginPath();
          this.ctx.moveTo(n1.x, n1.y);
          this.ctx.lineTo(n2.x, n2.y);
          
          this.ctx.strokeStyle = strokeColor;
          this.ctx.lineWidth = lineWidth;
          this.ctx.stroke();

          // Overlay transparent storm highlight so the biome remains fully visible beneath
          if (stormColor && stormWeight > 0.05) {
            this.ctx.beginPath();
            this.ctx.moveTo(n1.x, n1.y);
            this.ctx.lineTo(n2.x, n2.y);
            this.ctx.strokeStyle = stormColor;
            this.ctx.lineWidth = lineWidth * 0.8;
            this.ctx.save();
            this.ctx.globalAlpha = stormWeight * 0.45;
            this.ctx.stroke();
            this.ctx.restore();
          }
        }
      }
    }

    // Land identification textures/symbols are removed to preserve a clean abstract space grid look


    // Connect highlighted grid joints matching black holes range for futuristic HUD feel
    this.blackHoles.forEach(bh => {
      const screenX = bh.x - this.camera.x;
      const screenY = bh.y - this.camera.y;

      // Draw boundary horizon line
      this.ctx.strokeStyle = 'rgba(255, 51, 68, 0.12)';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, bh.gravityRange, 0, Math.PI * 2);
      this.ctx.stroke();
    });
  }

  // Draw resource scrap shards
  drawDebris() {
    const zoom = this.camera.zoom || 1.0;
    this.ctx.save();
    
    // Only apply blur/glow on higher zooms to maximize FPS
    if (zoom >= 0.4) {
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = '#00e5ff';
    }
    this.ctx.fillStyle = '#00e5ff';

    this.debris.forEach(scrap => {
      // Cull if inside any Space Tear
      let insideTear = false;
      if (this.spaceTears && this.spaceTears.length > 0) {
        for (let i = 0; i < this.spaceTears.length; i++) {
          const tear = this.spaceTears[i];
          const dx = scrap.x - tear.x;
          const dy = scrap.y - tear.y;
          if (Math.sqrt(dx*dx + dy*dy) < tear.radius) {
            insideTear = true;
            break;
          }
        }
      }
      if (insideTear) return;

      const screenX = scrap.x - this.camera.x;
      const screenY = scrap.y - this.camera.y;

      // Only draw on-screen
      if (this.isInViewport(screenX, screenY, 20)) {
        if (zoom >= 0.4) {
          // Draw small rotating crystal square
          this.ctx.save();
          this.ctx.translate(screenX, screenY);
          this.ctx.rotate(this.time * 2 + scrap.x);
          this.ctx.fillRect(-2.5, -2.5, 5, 5);
          this.ctx.restore();
        } else {
          // LOD: draw static pixel dot, extremely fast
          this.ctx.fillRect(screenX - 1.5, screenY - 1.5, 3, 3);
        }
      }
    });

    this.ctx.restore();
  }

  // Draw pure black Space Tears (portal voids)
  drawSpaceTears() {
    if (!this.spaceTears || this.spaceTears.length === 0) return;

    this.ctx.save();
    this.spaceTears.forEach(tear => {
      const sX = tear.x - this.camera.x;
      const sY = tear.y - this.camera.y;

      // Only draw if within screen boundaries
      if (this.isInViewport(sX, sY, tear.radius)) {
        // Draw physical pure black circular mask (nothingness inside)
        this.ctx.fillStyle = '#030306';
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, tear.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw an accretion boundary ring
        this.ctx.strokeStyle = `rgba(0, 229, 255, ${0.45 + 0.15 * Math.sin(this.time * 4)})`;
        this.ctx.lineWidth = 3.5;
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, tear.radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw multiple nested event horizon rings with neon colors
        this.ctx.strokeStyle = `rgba(255, 51, 255, ${0.3 + 0.1 * Math.cos(this.time * 3)})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, tear.radius - 20, 0, Math.PI * 2);
        this.ctx.stroke();

        // Write warning text inside void center
        this.ctx.fillStyle = '#ff3344';
        this.ctx.font = 'bold 9px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('⚡ WARNING: SPACETIME_TEAR', sX, sY - 12);
        const carrier = this.ships.find(s => s.type === 'carrier');
        if (carrier && carrier.dockedTearId === tear.id) {
          if (carrier.deployState === 'deploying') {
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.fillText(`DOCKING SEQUENCE: ${Math.round((carrier.deployProgress || 0) * 100)}%`, sX, sY + 8);
          } else if (carrier.deployState === 'deployed') {
            this.ctx.fillStyle = '#00ff66';
            this.ctx.fillText('⚓ DEPLOYED - CLICK TO DROP!', sX, sY + 8);
          } else if (carrier.deployState === 'undeploying') {
            this.ctx.fillStyle = '#ff3344';
            this.ctx.fillText(`RETRACTING TENTACLES: ${Math.round((carrier.deployProgress || 0) * 100)}%`, sX, sY + 8);
          }
        } else {
          this.ctx.fillStyle = '#00ffff';
          this.ctx.fillText(`SWIM FLAGSHIP HERE TO DOCK`, sX, sY + 8);
        }
      }
    });
    this.ctx.restore();
  }

  // Draw procedural landmarks, taverns, and cities
  drawStructures() {
    this.ctx.save();
    
    // Calculate visible chunks based on camera and zoom factor
    const zoom = this.camera.zoom || 1.0;
    const viewHalfW = (this.width / 2) / zoom;
    const viewHalfH = (this.height / 2) / zoom;
    const viewCenterX = this.camera.x + this.width / 2;
    const viewCenterY = this.camera.y + this.height / 2;

    const startChunkCol = Math.floor((viewCenterX - viewHalfW) / 1500) - 1;
    const endChunkCol = Math.ceil((viewCenterX + viewHalfW) / 1500) + 1;
    const startChunkRow = Math.floor((viewCenterY - viewHalfH) / 1500) - 1;
    const endChunkRow = Math.ceil((viewCenterY + viewHalfH) / 1500) + 1;

    for (let cx = startChunkCol; cx <= endChunkCol; cx++) {
      for (let cy = startChunkRow; cy <= endChunkRow; cy++) {
        const struct = getStructureInChunk(cx, cy);
        if (struct) {
          const screenX = struct.x - this.camera.x;
          const screenY = struct.y - this.camera.y;

          // Only draw if on screen (with some margin)
          if (this.isInViewport(screenX, screenY, 180)) {
            this.ctx.save();
            this.ctx.translate(screenX, screenY);

            // Draw glowing halo around structure
            const glowGrad = this.ctx.createRadialGradient(0, 0, 5, 0, 0, 45);
            glowGrad.addColorStop(0, struct.color + '25');
            glowGrad.addColorStop(1, 'transparent');
            this.ctx.fillStyle = glowGrad;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 45, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw Brutalist/Vector structure outline
            this.ctx.strokeStyle = struct.color;
            this.ctx.lineWidth = 2.0;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = struct.color;

            if (struct.type === 'tavern') {
              // Draw a cozy, layered hexagonal hearth shape
              this.ctx.beginPath();
              for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3 + this.time * 0.05;
                const rx = 16 + Math.sin(this.time * 2 + i) * 1.2;
                const tx = Math.cos(angle) * rx;
                const ty = Math.sin(angle) * rx;
                if (i === 0) this.ctx.moveTo(tx, ty);
                else this.ctx.lineTo(tx, ty);
              }
              this.ctx.closePath();
              this.ctx.stroke();

              // Draw a warm center core
              this.ctx.fillStyle = '#ff7300';
              this.ctx.beginPath();
              this.ctx.arc(0, 0, 5 + Math.sin(this.time * 5) * 1.5, 0, Math.PI * 2);
              this.ctx.fill();

            } else {
              // Draw fortified city spire (squares and crosshairs)
              this.ctx.strokeRect(-16, -16, 32, 32);
              this.ctx.beginPath();
              // Inner spires rotating
              this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
              this.ctx.stroke();

              // Spire corner accents
              this.ctx.beginPath();
              this.ctx.moveTo(-24, 0); this.ctx.lineTo(24, 0);
              this.ctx.moveTo(0, -24); this.ctx.lineTo(0, 24);
              this.ctx.stroke();
            }

            // Draw Structure Info Tags/Labels
            this.ctx.shadowBlur = 0; // Disable shadow for text readability
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 11px "Space Grotesk", "Inter", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(struct.name.toUpperCase(), 0, -32);

            this.ctx.fillStyle = struct.color;
            this.ctx.font = '8px "JetBrains Mono", monospace';
            this.ctx.fillText(`[${struct.type.toUpperCase()}] SECTOR [${cx}, ${cy}]`, 0, -22);

            // If selected unit or camera is very close, draw descriptive subtext
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            this.ctx.font = '7.5px "JetBrains Mono", monospace';
            this.ctx.fillText(struct.description, 0, 28);

            this.ctx.restore();
          }
        }
      }
    }

    this.ctx.restore();
  }

  // Draw weapon lasers
  drawLasers() {
    this.lasers.forEach(laser => {
      const sX = laser.fromX - this.camera.x;
      const sY = laser.fromY - this.camera.y;
      const eX = laser.toX - this.camera.x;
      const eY = laser.toY - this.camera.y;

      this.ctx.save();
      this.ctx.strokeStyle = laser.color;
      this.ctx.lineWidth = laser.width || 1.5;
      this.ctx.globalAlpha = laser.alpha;
      
      // Draw laser glow line
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = laser.color;

      this.ctx.beginPath();
      this.ctx.moveTo(sX, sY);
      this.ctx.lineTo(eX, eY);
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  // Draw waypoints
  drawWaypoints() {
    this.waypoints.forEach(wp => {
      const sX = wp.x - this.camera.x;
      const sY = wp.y - this.camera.y;

      this.ctx.save();
      this.ctx.globalAlpha = wp.alpha;
      this.ctx.strokeStyle = wp.color;
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([2, 2]);

      this.ctx.beginPath();
      this.ctx.arc(sX, sY, wp.radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Tiny center dot
      this.ctx.fillStyle = wp.color;
      this.ctx.beginPath();
      this.ctx.arc(sX, sY, 2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  // Draw cosmic anomalies (Black & White Holes)
  drawBlackHoles() {
    const zoom = this.camera.zoom || 1.0;
    this.blackHoles.forEach(bh => {
      const sX = bh.x - this.camera.x;
      const sY = bh.y - this.camera.y;

      if (!this.isInViewport(sX, sY, bh.radius * 3.0)) return;

      if (bh.type === 'white_hole') {
        // --- DRAW WHITE HOLE (Ejection & Repulsion portal) ---
        this.ctx.save();
        
        // Radiant outward-glowing field
        const grad = this.ctx.createRadialGradient(sX, sY, 3, sX, sY, bh.radius * 2.8);
        grad.addColorStop(0, '#ffffff'); // Glowing hot white center
        grad.addColorStop(0.2, '#e0f7fc'); // Subtle soft cyan-white
        grad.addColorStop(0.55, 'rgba(0, 229, 255, 0.16)'); // Cyan dispersion glow
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, bh.radius * 2.8, 0, Math.PI * 2);
        this.ctx.fill();

        // Brilliant pure white central core
        if (zoom >= 0.4) {
          this.ctx.shadowBlur = 18;
          this.ctx.shadowColor = '#00e5ff';
        }
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#00e5ff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, bh.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // reset

        // Expanding repelling pulse wave rings (conveys ejection vector!)
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        const pulseCycle = (this.time * 0.04) % 1.0;
        const pulseRad = bh.radius * (1.0 + 1.2 * pulseCycle);
        this.ctx.arc(sX, sY, pulseRad, 0, Math.PI * 2);
        this.ctx.globalAlpha = 1.0 - pulseCycle;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        // Outward radiant light ejector rays (only if zoomed in)
        if (zoom >= 0.35) {
          this.ctx.save();
          this.ctx.translate(sX, sY);
          // Slowly rotate opposite to spin
          this.ctx.rotate(this.time * (bh.spinSpeed > 0 ? 0.012 : -0.012));
          this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
          this.ctx.lineWidth = 1.5;
          for (let j = 0; j < 8; j++) {
            const angle = (j * Math.PI * 2) / 8;
            this.ctx.beginPath();
            // Ray starts from the core edge and radiates out
            this.ctx.moveTo(Math.cos(angle) * bh.radius, Math.sin(angle) * bh.radius);
            this.ctx.lineTo(Math.cos(angle) * bh.radius * 2.0, Math.sin(angle) * bh.radius * 2.0);
            this.ctx.stroke();
          }
          this.ctx.restore();
        }

        this.ctx.restore();
      } else {
        // --- DRAW BLACK HOLE (Singularity attraction portal) ---
        // Draw glowing boundary vortex
        const grad = this.ctx.createRadialGradient(sX, sY, 5, sX, sY, bh.radius * 2.5);
        grad.addColorStop(0, '#000000'); // Dead black singularity center
        grad.addColorStop(0.3, '#100010');
        grad.addColorStop(0.65, 'rgba(255, 51, 68, 0.12)'); // Magenta accretion glow
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, bh.radius * 2.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Sharp central black hole sphere
        this.ctx.fillStyle = '#000000';
        this.ctx.strokeStyle = '#ff3344';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, bh.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw accretion orbiting particle lines
        this.ctx.strokeStyle = 'rgba(255, 51, 68, 0.45)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(sX, sY, bh.radius * (1.2 + 0.15 * Math.sin(this.time * 2)), 0, Math.PI * 2);
        this.ctx.stroke();
      }
    });
  }

  // Draw player fleet units
  drawShips() {
    const zoom = this.camera.zoom || 1.0;
    this.ships.forEach(ship => {
      const sX = ship.x - this.camera.x;
      const sY = ship.y - this.camera.y;

      // Only draw if within viewport range
      if (!this.isInViewport(sX, sY, 50)) return;

      this.ctx.save();
      this.ctx.translate(sX, sY);
      const angleOffset = Math.sin(this.time * 1.5 + ship.x * 0.005) * 0.05;
      this.ctx.rotate(ship.angle + angleOffset);

      // 1. Draw Selection neon ring
      if (ship.selected) {
        this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.65)';
        this.ctx.lineWidth = 1.0;
        if (zoom >= 0.35) {
          this.ctx.setLineDash([3, 3]);
          this.ctx.beginPath();
          this.ctx.arc(0, 0, ship.radius * 1.5, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        } else {
          // LOD: Draw a simple solid thin circle, no dashed calculations
          this.ctx.beginPath();
          this.ctx.arc(0, 0, ship.radius * 1.3, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }

      // 2. Draw Ship Vector Geometry
      if (zoom >= 0.4) {
        this.ctx.shadowBlur = 6;
      }
      
      if (ship.type === 'carrier') {
        // Flagship Carrier Capital Ship
        this.ctx.shadowColor = '#00e5ff';
        this.ctx.fillStyle = '#051825';
        this.ctx.strokeStyle = '#00e5ff';
        this.ctx.lineWidth = 2.0;

        // Giant blocky double-hull prow starship
        this.ctx.beginPath();
        this.ctx.moveTo(35, 0);       // prow front tip
        this.ctx.lineTo(15, -18);     // left shoulder
        this.ctx.lineTo(-20, -18);    // left main wing base
        this.ctx.lineTo(-32, -8);     // left thruster engine
        this.ctx.lineTo(-32, 8);      // right thruster engine
        this.ctx.lineTo(-20, 18);     // right wing base
        this.ctx.lineTo(15, 18);      // right shoulder
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Glowing center energy deck line
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(-15, 0);
        this.ctx.lineTo(20, 0);
        this.ctx.stroke();

        if (zoom >= 0.35) {
          // Majestic biomorphic/mechanical tentacles acting like "dynamic bones" type system in world space
          const tentacleStarts = [
            { x: -28, y: -15, angleOffset: -Math.PI * 0.9 },   // Upper wing trailing
            { x: -32, y: -6,  angleOffset: -Math.PI * 0.98 },  // Left engine trail
            { x: -32, y: 6,   angleOffset: Math.PI * 0.98 },   // Right engine trail
            { x: -28, y: 15,  angleOffset: Math.PI * 0.9 }     // Lower wing trailing
          ];

          const cosA = Math.cos(ship.angle);
          const sinA = Math.sin(ship.angle);

          // Initialize world-space tentacles if not present
          if (!ship.tentacles) {
            ship.tentacles = tentacleStarts.map((start, tIndex) => {
              const baseAngle = ship.angle + start.angleOffset;
              const joints = [];
              
              // Start at attachment point
              let currentX = ship.x + (start.x * cosA - start.y * sinA);
              let currentY = ship.y + (start.x * sinA + start.y * cosA);
              
              const segmentCount = 9;
              const segmentLength = 7 + (tIndex % 2) * 2;
              
              for (let i = 0; i < segmentCount; i++) {
                joints.push({ x: currentX, y: currentY });
                currentX += Math.cos(baseAngle) * segmentLength;
                currentY += Math.sin(baseAngle) * segmentLength;
              }
              return { joints };
            });
          }

          // Calculate weather and anomaly fluctuation intensity
          let fluctuation = 1.0;
          if (this.foldActive) {
            fluctuation += this.weatherIntensity * 2.8;
          }
          this.blackHoles.forEach(bh => {
            const dx = bh.x - ship.x;
            const dy = bh.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bh.gravityRange) {
              const factor = (bh.gravityRange - dist) / bh.gravityRange;
              fluctuation += factor * 3.5;
            }
          });

          // Update joint physics in world space
          const progress = ship.deployProgress || 0;
          ship.tentacles.forEach((tentacle, tIndex) => {
            const start = tentacleStarts[tIndex];
            
            let currentAngleOffset = start.angleOffset;
            if (progress > 0) {
              let spreadOffset = 0;
              if (tIndex === 0) spreadOffset = -Math.PI * 0.25;
              if (tIndex === 1) spreadOffset = -Math.PI * 0.75;
              if (tIndex === 2) spreadOffset = Math.PI * 0.75;
              if (tIndex === 3) spreadOffset = Math.PI * 0.25;
              // Lerp angle offset
              currentAngleOffset = start.angleOffset * (1 - progress) + spreadOffset * progress;
            }

            // Base joint is locked to the ship's attachment point
            tentacle.joints[0].x = ship.x + (start.x * cosA - start.y * sinA);
            tentacle.joints[0].y = ship.y + (start.x * sinA + start.y * cosA);

            let segmentLength = 8 + (tIndex % 2) * 2;
            if (progress > 0) {
              segmentLength += 8 * progress; // lengthen tentacles as they spread!
            }
            const lag = 0.32; // Organic trailing delay multiplier (dynamic bones stiffness)

            for (let i = 1; i < tentacle.joints.length; i++) {
              const prev = tentacle.joints[i - 1];
              const curr = tentacle.joints[i];

              // Distance vector
              const dx = curr.x - prev.x;
              const dy = curr.y - prev.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;

              // Constrain distance to segmentLength
              const targetX = prev.x + (dx / dist) * segmentLength;
              const targetY = prev.y + (dy / dist) * segmentLength;

              // Pull towards fully extended radial position when deploying/deployed
              const angleForTentacle = ship.angle + currentAngleOffset;
              const radialTargetX = prev.x + Math.cos(angleForTentacle) * segmentLength;
              const radialTargetY = prev.y + Math.sin(angleForTentacle) * segmentLength;

              // Lerp the target based on deployProgress
              const finalTargetX = targetX * (1 - progress) + radialTargetX * progress;
              const finalTargetY = targetY * (1 - progress) + radialTargetY * progress;

              // Lag/inertia interpolation
              curr.x += (finalTargetX - curr.x) * lag;
              curr.y += (finalTargetY - curr.y) * lag;

              // Perpendicular wave wiggle in response to turbulence
              const wiggleSpeed = 0.08 + fluctuation * 0.04;
              const wiggleAmp = (0.14 + fluctuation * 0.16) * (1 + progress * 2.5); // more wiggle when deployed!
              const wiggleOffset = Math.sin(this.time * wiggleSpeed - i * 0.8 + tIndex * 1.5) * wiggleAmp;

              const px = -dy / dist;
              const py = dx / dist;

              curr.x += px * wiggleOffset;
              curr.y += py * wiggleOffset;
            }
          });

          // Draw tentacles by saving and restoring the context to screen coordinates (bypassing ship local rotation/translation)
          this.ctx.save();
          this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space matrix

          this.ctx.lineWidth = 1.8;
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = '#00e5ff';

          ship.tentacles.forEach((tentacle, tIndex) => {
            const s0 = this.worldToScreen(tentacle.joints[0].x, tentacle.joints[0].y);
            const sN = this.worldToScreen(tentacle.joints[tentacle.joints.length - 1].x, tentacle.joints[tentacle.joints.length - 1].y);

            const grad = this.ctx.createLinearGradient(s0.x, s0.y, sN.x, sN.y);
            grad.addColorStop(0, '#00e5ff');
            grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.55)');
            grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
            this.ctx.strokeStyle = grad;

            this.ctx.beginPath();
            this.ctx.moveTo(s0.x, s0.y);

            for (let i = 1; i < tentacle.joints.length; i++) {
              const sPt = this.worldToScreen(tentacle.joints[i].x, tentacle.joints[i].y);
              this.ctx.lineTo(sPt.x, sPt.y);
            }
            this.ctx.lineWidth = 1.8 * zoom;
            this.ctx.stroke();
          });
          
          this.ctx.restore(); // restore back to translated/rotated ship space for any subsequent ship elements
        }

      } else if (ship.type === 'dreadnought') {
        // Titanic Dreadnought
        this.ctx.shadowColor = '#ffb300';
        this.ctx.fillStyle = '#221500';
        this.ctx.strokeStyle = '#ffb300';
        this.ctx.lineWidth = 1.8;

        // Wide arrowhead battle plate hull
        this.ctx.beginPath();
        this.ctx.moveTo(25, 0);
        this.ctx.lineTo(10, -15);
        this.ctx.lineTo(-12, -15);
        this.ctx.lineTo(-18, -6);
        this.ctx.lineTo(-18, 6);
        this.ctx.lineTo(-12, 15);
        this.ctx.lineTo(10, 15);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Bridge deck indicator
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(-5, -3, 6, 6);

      } else if (ship.type === 'cruiser') {
        // Medium Cruiser
        this.ctx.shadowColor = '#00e5ff';
        this.ctx.fillStyle = '#02121c';
        this.ctx.strokeStyle = '#00e5ff';
        this.ctx.lineWidth = 1.5;

        // Split prow wedge design
        this.ctx.beginPath();
        this.ctx.moveTo(18, 0);
        this.ctx.lineTo(4, -8);
        this.ctx.lineTo(-12, -9);
        this.ctx.lineTo(-8, 0);
        this.ctx.lineTo(-12, 9);
        this.ctx.lineTo(4, 8);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

      } else {
        // FT-Fighter Small delta wing
        this.ctx.shadowColor = '#00ff66';
        this.ctx.fillStyle = '#011508';
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.lineWidth = 1.2;

        this.ctx.beginPath();
        this.ctx.moveTo(10, 0);
        this.ctx.lineTo(-6, -6);
        this.ctx.lineTo(-3, 0);
        this.ctx.lineTo(-6, 6);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }

      // 3. Draw energy shields circle if active
      if (ship.shield > 0 && zoom >= 0.35) {
        if (zoom >= 0.4) {
          this.ctx.shadowBlur = 4;
          this.ctx.shadowColor = ship.type === 'carrier' ? '#00e5ff' : '#00ff66';
        } else {
          this.ctx.shadowBlur = 0;
        }
        this.ctx.strokeStyle = `rgba(0, 229, 255, ${0.15 + 0.1 * Math.sin(this.time * 4)})`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, ship.radius * 1.3, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();

      // 4. Draw tiny absolute vector HP bar above ship (only if zoomed in enough)
      if (zoom >= 0.35) {
        const barWidth = ship.radius * 2;
        const barHeight = 2.5;
        const barX = sX - ship.radius;
        const barY = sY - ship.radius - 8;

        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpRatio = Math.max(0, ship.health / ship.maxHealth);
        this.ctx.fillStyle = ship.selected ? '#00ff66' : '#9999aa';
        this.ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
      }
    });
  }

  // Draw hostile units & outposts
  drawEnemies() {
    const zoom = this.camera.zoom || 1.0;
    this.enemies.forEach(enemy => {
      const sX = enemy.x - this.camera.x;
      const sY = enemy.y - this.camera.y;

      if (!this.isInViewport(sX, sY, 60)) return;

      this.ctx.save();
      this.ctx.translate(sX, sY);
      this.ctx.rotate(enemy.angle);

      if (zoom >= 0.4) {
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#ff3344'; // Red hostile glow
      }

      if (enemy.type === 'citadel') {
        // Red siphoning Citadel
        this.ctx.fillStyle = '#1c0406';
        this.ctx.strokeStyle = '#ff3344';
        this.ctx.lineWidth = 2.0;

        // Heavy star shape outline
        this.ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const r = i % 2 === 0 ? enemy.radius : enemy.radius * 0.6;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Inner glowing core
        this.ctx.fillStyle = '#ff3344';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 10 + 2 * Math.sin(this.time * 5), 0, Math.PI * 2);
        this.ctx.fill();

      } else {
        // Interceptor Void Raider Fighter
        this.ctx.fillStyle = '#150304';
        this.ctx.strokeStyle = '#ff3344';
        this.ctx.lineWidth = 1.3;

        // Sharp double-prow crescent geometry
        this.ctx.beginPath();
        this.ctx.moveTo(10, 0);
        this.ctx.lineTo(-5, -6);
        this.ctx.lineTo(-2, -2);
        this.ctx.lineTo(-5, 0);
        this.ctx.lineTo(-2, 2);
        this.ctx.lineTo(-5, 6);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }

      this.ctx.restore();

      // HP bar for enemies (only if zoomed in enough)
      if (zoom >= 0.35) {
        const barWidth = enemy.radius * 1.8;
        const barHeight = 2.5;
        const barX = sX - barWidth / 2;
        const barY = sY - enemy.radius - 8;

        this.ctx.fillStyle = '#111111';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpRatio = Math.max(0, enemy.health / enemy.maxHealth);
        this.ctx.fillStyle = '#ff3344';
        this.ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
      }
    });
  }

  // Draw swirling spacetime vortices
  drawVortices() {
    if (!this.vortices) return;
    this.vortices.forEach(v => {
      if (!v.active) return;
      const screenX = v.x - this.camera.x;
      const screenY = v.y - this.camera.y;
      
      // Only draw if on screen
      if (!this.isInViewport(screenX, screenY, 200)) return;
      
      const progress = v.foldingProgress;
      const r = v.radius * progress;
      
      this.ctx.save();
      this.ctx.translate(screenX, screenY);
      
      // Draw spinning outer gravitational lines
      const segments = 4;
      const angleOffset = this.time * 2.5;
      
      for (let i = 0; i < segments; i++) {
        const startAng = (i * Math.PI * 2) / segments + angleOffset;
        const endAng = startAng + Math.PI * 1.15 * progress;
        
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r * (1.0 - i * 0.15), startAng, endAng);
        
        this.ctx.strokeStyle = `rgba(255, 51, 102, ${0.4 - i * 0.08})`;
        this.ctx.lineWidth = 2.5 - i * 0.4;
        this.ctx.stroke();
      }
      
      // Draw central glowing singularity core
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 12 * progress, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ff3366';
      this.ctx.shadowColor = '#ff3366';
      this.ctx.shadowBlur = 15;
      this.ctx.fill();
      
      this.ctx.restore();
    });
  }

  // Draw localized weather system clouds
  drawWeatherClouds() {
    if (!this.weatherClouds) return;
    this.weatherClouds.forEach(cloud => {
      const screenX = cloud.x - this.camera.x;
      const screenY = cloud.y - this.camera.y;
      
      // Only draw if on screen (with padding)
      const pad = cloud.radius + 100;
      if (!this.isInViewport(screenX, screenY, pad)) return;
      
      const r = cloud.radius * cloud.intensity;
      this.ctx.save();
      this.ctx.translate(screenX, screenY);
      
      // Draw swirling glowing clouds using multi-layered vector arcs
      const layers = 3;
      for (let j = 0; j < layers; j++) {
        const layerR = r * (1.0 - j * 0.25);
        this.ctx.beginPath();
        
        // Organic multi-segmented wavy path
        const segments = 12;
        const angleStep = (Math.PI * 2) / segments;
        const timeOffset = this.time * (1.0 - j * 0.2) * (j % 2 === 0 ? 1 : -1) * 0.04;
        
        for (let i = 0; i <= segments; i++) {
          const angle = i * angleStep;
          const wobble = Math.sin(angle * 3 + this.time * 0.08 + j) * 12 * cloud.intensity;
          const px = Math.cos(angle + timeOffset) * (layerR + wobble);
          const py = Math.sin(angle + timeOffset) * (layerR + wobble);
          
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        
        this.ctx.closePath();
        this.ctx.strokeStyle = cloud.color;
        this.ctx.globalAlpha = (j === 0 ? 0.12 : (j === 1 ? 0.08 : 0.04)) * cloud.intensity;
        this.ctx.lineWidth = 3 - j * 0.5;
        this.ctx.setLineDash([6 + j * 4, 8 + j * 3]);
        this.ctx.stroke();
      }
      
      // Draw small swirling wind sparks inside the cloud
      this.ctx.globalAlpha = 0.6 * cloud.intensity;
      this.ctx.fillStyle = cloud.color;
      const sparkCount = 6;
      for (let i = 0; i < sparkCount; i++) {
        const sparkAng = (i * Math.PI * 2) / sparkCount + this.time * 0.02;
        const sparkDist = (cloud.radius * 0.35) + Math.sin(this.time * 0.05 + i) * (cloud.radius * 0.15);
        const sx = Math.cos(sparkAng) * sparkDist;
        const sy = Math.sin(sparkAng) * sparkDist;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Draw cloud type and label in display typography
      this.ctx.globalAlpha = 0.7 * cloud.intensity;
      this.ctx.fillStyle = cloud.color;
      this.ctx.font = '8px "JetBrains Mono", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`⚡ ${cloud.type} [LOC: ${Math.round(cloud.x)}, ${Math.round(cloud.y)}]`, 0, -12);
      
      // Draw "GRAVITATIONAL CLAMP ACTIVE" if player ships are clamped inside
      const hasClampedShips = this.ships.some(ship => {
        const dx = ship.x - cloud.x;
        const dy = ship.y - cloud.y;
        return Math.sqrt(dx * dx + dy * dy) < cloud.radius;
      });
      if (hasClampedShips) {
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.fillText(`◰ GRAVITY_CLAMP_ACTIVE`, 0, 12);
        
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(-12, -12, 24, 24);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      
      this.ctx.restore();
    });
  }

  // Draw transparent marquee selector
  drawMarqueeFrame() {
    if (!this.isDragging || !this.selectionStart || !this.selectionEnd) return;

    const x = this.selectionStart.x;
    const y = this.selectionStart.y;
    const w = this.selectionEnd.x - x;
    const h = this.selectionEnd.y - y;

    this.ctx.save();
    this.ctx.strokeStyle = '#00ff66';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.fillStyle = 'rgba(0, 255, 102, 0.08)';

    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }
}
