/**
 * Solar System Simulation & Planetary Farming Engine
 * Generates and simulates a procedural solar system with:
 * 1. A massive, zoomable, scrollable cosmic workspace.
 * 2. A pilotable landing shuttle (WASD/Arrow keys or click-to-move).
 * 3. Atmospheric tuning matching resonance peaks.
 * 4. Landable planets with gravity wells.
 * 5. Grid-based Stardew-Valley style farming and clearing operations.
 */

import { BIOMES } from '../generation.js';

// Elements catalog mapping HSL to mothership inventory keys
export const PLANET_ELEMENTS_CATALOG = [
  {
    id: 'metalElement',
    name: 'Flamium Redium',
    description: 'Radioactive Heavy Red. Boosts structural attack & damage yield.',
    hueMin: 340, hueMax: 20,
    stat: 'Attack / Heavy',
    color: '#ff3344',
    seedName: 'Flamium Seed'
  },
  {
    id: 'soilElement',
    name: 'Solarium Gold',
    description: 'Highly dense Solar Core. Boosts critical strike rate & core energy.',
    hueMin: 20, hueMax: 70,
    stat: 'Crit / Core',
    color: '#ffb300',
    seedName: 'Solarium Seed'
  },
  {
    id: 'earthElement',
    name: 'Vitalium Green',
    description: 'Organic resonant crystal. Energizes thrusters & movement speed.',
    hueMin: 80, hueMax: 150,
    stat: 'Engine / Speed',
    color: '#00ff66',
    seedName: 'Vitalium Seed'
  },
  {
    id: 'airElement',
    name: 'Aerium Cyan',
    description: 'Ethereal gaseous suspension. Enhances spatial evasion & agility.',
    hueMin: 150, hueMax: 190,
    stat: 'Evade / Agility',
    color: '#00e5ff',
    seedName: 'Aerium Seed'
  },
  {
    id: 'waterElement',
    name: 'Aquatium Blue',
    description: 'Fluid cooling crystalline node. Charges deflector shield matrices.',
    hueMin: 190, hueMax: 250,
    stat: 'Shields / Defense',
    color: '#3366ff',
    seedName: 'Aquatium Seed'
  },
  {
    id: 'symmetryCrystal',
    name: 'Symmetry Purple',
    description: 'Balanced harmonic mirror. Reflects incoming damage (Thorns).',
    hueMin: 250, hueMax: 320,
    stat: 'Thorns / Balance',
    color: '#bb00ff',
    seedName: 'Symmetry Seed'
  }
];

export class SolarSystem {
  constructor(canvas, seedX, seedY, struct, region) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seedX = seedX;
    this.seedY = seedY;
    this.struct = struct;
    this.region = region || { name: 'Void Reach', color: '#ffb300', zodiac: 'Aries', title: 'The Lust for Dominance' };

    this.time = 0;
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Solar System world dimensions
    this.worldWidth = 4000;
    this.worldHeight = 4000;

    // Camera state centered on the star initially
    this.camera = { x: 2000, y: 2000, zoom: 0.5 };
    this.targetZoom = 0.55;

    // Pilotable Lander Shuttle
    this.shuttle = {
      x: 2000,
      y: 1700,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      rotationSpeed: 0.06,
      maxSpeed: 7,
      thrust: 0.18,
      drag: 0.985,
      radius: 12,
      fuel: 100,
      shield: 100,
      autopilot: false,
      targetX: null,
      targetY: null,
      thrustActive: false
    };

    // Sub-state: 'orbiting' (flying in solar system) or 'landed' (farming grid)
    this.shuttleState = 'orbiting';
    this.activeLandedPlanet = null;
    this.farmingGridOffset = { x: 0, y: 0 };
    this.hoveredCell = null;
    this.selectedSeedType = PLANET_ELEMENTS_CATALOG[2]; // Default to Vitalium Green
    this.canvasMenuOpen = false;
    this.canvasMenuCell = null;
    this.shuttleLandingProgress = 0;
    this.lastLandedPlanetName = "";

    // Particles for thrust and harvest
    this.particles = [];
    this.systemParticles = []; // general space particles

    // Star and planet configuration
    this.star = null;
    this.planets = [];
    this.selectedPlanetIndex = -1;
    this.hoveredPlanetIndex = -1;

    // Localized spacetime grid nodes
    this.gridNodes = [];
    this.initGrid();

    // Generate solar system properties
    this.generateSystem();

    // Set up local listeners for keypress and clicks (scoped safely)
    this.setupListeners();
  }

  // Linear feedback generator for procedural seeding
  seededRandom(s) {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  initGrid() {
    this.gridNodes = [];
    const spacing = 150; // Larger spacing for world bounds
    const cols = Math.ceil(this.worldWidth / spacing) + 2;
    const rows = Math.ceil(this.worldHeight / spacing) + 2;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const ox = (c - 1) * spacing;
        const oy = (r - 1) * spacing;
        this.gridNodes.push({ ox, oy, x: ox, y: oy });
      }
    }
  }

  generateSystem() {
    const seed = Math.abs(Math.sin(this.seedX * 17.3 + this.seedY * 92.7));
    
    // Star Properties derived from local Zodiac triplicity (Aesthetic rules)
    const zodiac = this.region.zodiac.toLowerCase();
    let baseHue = 40; // Default Gold/Sol
    let saturation = 85;
    let lightness = 55;
    let classification = 'Yellow Dwarf';
    let subtext = 'Sustains warm solar lifespans';

    if (['aries', 'leo', 'sagittarius'].includes(zodiac)) {
      baseHue = seed * 30; // 0 to 30: Red/Orange/Yellow
      saturation = 95;
      lightness = 60;
      classification = 'Radiant Supergiant';
      subtext = 'Violent Expression of Will and Blood';
    } else if (['taurus', 'virgo', 'capricorn'].includes(zodiac)) {
      baseHue = 80 + seed * 60; // Green/Emerald/Yellow-Green
      saturation = 75;
      lightness = 50;
      classification = 'Crystalline Core';
      subtext = 'Dense static structural anchor';
    } else if (['gemini', 'libra', 'aquarius'].includes(zodiac)) {
      baseHue = 150 + seed * 100; // Cyan/Magenta/Blue-white
      saturation = 80;
      lightness = 65;
      classification = 'Symmetrical Pulsar';
      subtext = 'Connective spatial beacon';
    } else {
      baseHue = 240 + seed * 60; // Purple/Violet/Deep Blue
      saturation = 90;
      lightness = 45;
      classification = 'Abyssal Flare';
      subtext = 'Subterranean sub-space gateway';
    }

    // Star initialization centered in 4000x4000 space
    this.star = {
      name: this.struct.name.replace("Inn", "").replace("Hearth", "").replace("Tavern", "") + " Sol",
      x: 2000,
      y: 2000,
      radius: 90 + seed * 25, // Much larger star for the large map
      hue: baseHue,
      saturation,
      lightness,
      classification,
      subtext,
      pulse: 0
    };

    // Generate Orbiting Planets: 2 to 4 planets (larger orbit radii!)
    const planetCount = 2 + Math.floor(seed * 3);
    const planetNames = ['Aurelia', 'Zephyr', 'Chronos', 'Siphon Prime', 'Melmet Cradle', 'Nox-9', 'Goddess Tear'];

    for (let i = 0; i < planetCount; i++) {
      const pSeed = this.seededRandom(seed * 11.2 + i * 4.9);
      // Planets are spaced between 500 and 1800 units from central star
      const orbitRadius = 600 + i * 420 + pSeed * 150;
      const orbitSpeed = (0.003 - i * 0.0005) * (0.8 + pSeed * 0.4);
      
      const pHue = (baseHue + (pSeed * 80 - 40) + 360) % 360;
      const pLightness = 40 + pSeed * 25;
      const pSaturation = 60 + pSeed * 30;

      // Select matching element from catalog
      const preferredElement = PLANET_ELEMENTS_CATALOG.find(el => {
        if (el.hueMin < el.hueMax) {
          return pHue >= el.hueMin && pHue <= el.hueMax;
        } else {
          return pHue >= el.hueMin || pHue <= el.hueMax;
        }
      }) || PLANET_ELEMENTS_CATALOG[1];

      const pRadius = 25 + pSeed * 15; // Larger planet radii (25px - 40px)
      const startAngle = pSeed * Math.PI * 2;

      // Procedurally generate climate statistics based on star classification, orbit, and elements
      let temp = 0;
      let tempLabel = "";
      let rainLabel = "";
      let floraLabel = "";
      let faunaLabel = "";
      
      const closeness = 1.0 - (orbitRadius - 600) / 1400; // 0 to 1
      if (this.star.classification.includes("Supergiant")) {
        temp = Math.round(80 + closeness * 220);
        tempLabel = `${temp}°C (Ultra-Radiation Flare)`;
      } else if (this.star.classification.includes("Pulsar")) {
        temp = Math.round(20 + closeness * 120);
        tempLabel = `${temp}°C (Magnetic Thermal Dust)`;
      } else {
        temp = Math.round(-150 + closeness * 280);
        tempLabel = `${temp}°C (${temp > 100 ? "Superheated" : (temp > 0 ? "Temperate Gas" : "Liquid Cryo")})`;
      }

      // Rain type based on element
      const elementId = preferredElement.id;
      if (elementId === 'metalElement') {
        rainLabel = "Molten Iron Showers";
        floraLabel = "Symmetric Magma Spires";
        faunaLabel = "Bilateral Iron Crawlers";
      } else if (elementId === 'soilElement') {
        rainLabel = "Amber Plasma Dust";
        floraLabel = "Symmetric Golden Pods";
        faunaLabel = "Bilateral Core Beetles";
      } else if (elementId === 'earthElement') {
        rainLabel = "Charged Ozone Mist";
        floraLabel = "Symmetric Moss-Strands";
        faunaLabel = "Bilateral Spore pods";
      } else if (elementId === 'airElement') {
        rainLabel = "Liquid Helium Storms";
        floraLabel = "Symmetric Aero-Roots";
        faunaLabel = "Bilateral Gaseous Whales";
      } else if (elementId === 'waterElement') {
        rainLabel = "Ammonia Coolant Deluges";
        floraLabel = "Symmetric Hydroid Kelp";
        faunaLabel = "Bilateral Shell-Drifters";
      } else {
        // Symmetry
        rainLabel = "Purple Crystal Showers";
        floraLabel = "Symmetric Neon Ferns";
        faunaLabel = "Bilateral Plasma Spores";
      }

      const gravityVal = (0.35 + pSeed * 1.8).toFixed(2);

      const planet = {
        name: `${planetNames[(i + Math.floor(seed * 7)) % planetNames.length]} ${String.fromCharCode(65 + i)}`,
        orbitRadius,
        orbitSpeed,
        angle: startAngle,
        radius: pRadius,
        hue: pHue,
        saturation: pSaturation,
        lightness: pLightness,
        preferredElement,
        gravityRadius: pRadius * 6, // Gravity well extends up to 240px
        
        vibrationFrequency: 5.0,
        targetFrequency: 5.0,
        resonancePeak: 3.5 + pSeed * 4.0,
        wavePhase: 0,
        
        plantedSeeds: [],
        climate: {
          temperature: tempLabel,
          rain: rainLabel,
          gravity: `${gravityVal}g`,
          flora: floraLabel,
          fauna: faunaLabel
        },
        grid: null // Initialized dynamically upon landing
      };

      this.generatePlanetGrid(planet);
      this.planets.push(planet);
    }
  }

  generatePlanetGrid(planet) {
    if (planet.grid) return;
    planet.grid = [];
    const rows = 16;
    const cols = 16;
    const seed = planet.hue;

    // Initialize blank grid
    for (let r = 0; r < rows; r++) {
      planet.grid[r] = [];
      for (let c = 0; c < cols; c++) {
        planet.grid[r][c] = {
          r,
          c,
          type: 'soil',
          crop: null,
          watered: false
        };
      }
    }

    // Populate symmetric terrain elements
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 8; c++) {
        const cellSeed = Math.sin(r * 4.3 + c * 8.7 + seed * 1.5) * 1000;
        const val = cellSeed - Math.floor(cellSeed);
        let type = 'soil';
        if (val < 0.15) {
          type = 'rubble'; // mineable space debris
        } else if (val < 0.28) {
          type = 'flora'; // symmetric alien plants
        } else if (val < 0.35) {
          type = 'fauna'; // symmetric creatures/nests
        }

        planet.grid[r][c].type = type;
        planet.grid[r][15 - c].type = type;
      }
    }
  }

  findEmptyCell(planet) {
    const rows = planet.grid.length;
    const cols = planet.grid[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = planet.grid[r][c];
        if (cell.type === 'soil' && !cell.crop) {
          return { r, c, cell };
        }
      }
    }
    return null;
  }

  // Sows a seed from sidebar
  plantProbe(planetIndex) {
    const planet = this.planets[planetIndex];
    if (!planet) return false;

    // Max 10 seeds per planet
    if (planet.plantedSeeds.length >= 10) return false;

    const emptyCell = this.findEmptyCell(planet);
    if (!emptyCell) return false;

    const seedObj = {
      id: 'seed-' + Math.random().toString(36).substr(2, 5),
      progress: 0,
      harvestReady: false,
      value: 15 + Math.floor(Math.random() * 20),
      element: planet.preferredElement,
      gridX: emptyCell.c,
      gridY: emptyCell.r,
      growRate: 0.35
    };

    planet.plantedSeeds.push(seedObj);
    emptyCell.cell.type = 'seed';
    emptyCell.cell.crop = seedObj;
    return true;
  }

  harvestProbe(planetIndex, seedId, mothershipBase) {
    const planet = this.planets[planetIndex];
    if (!planet) return null;

    const seedIndex = planet.plantedSeeds.findIndex(s => s.id === seedId);
    if (seedIndex === -1) return null;

    const seed = planet.plantedSeeds[seedIndex];
    if (seed.harvestReady) {
      // Add directly to mothership base inventory
      const key = seed.element.id;
      if (mothershipBase && mothershipBase.inventory) {
        if (mothershipBase.inventory[key] !== undefined) {
          mothershipBase.inventory[key] += seed.value;
        } else {
          mothershipBase.inventory[key] = seed.value;
        }
      }

      // Free grid cell
      if (planet.grid && planet.grid[seed.gridY] && planet.grid[seed.gridY][seed.gridX]) {
        planet.grid[seed.gridY][seed.gridX].type = 'soil';
        planet.grid[seed.gridY][seed.gridX].crop = null;
      }

      planet.plantedSeeds.splice(seedIndex, 1);
      return seed;
    }
    return null;
  }

  setupListeners() {
    // Canvas interaction routing
    this.canvas.addEventListener('mousedown', (e) => {
      if (window.activeMode !== 'solarsystem' || window.currentSolarSystem !== this) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.shuttleState === 'orbiting') {
        // Orbit click routing
        const clickedPlanetIdx = this.checkPlanetClick(mx, my);
        if (clickedPlanetIdx !== -1) {
          this.selectedPlanetIndex = clickedPlanetIdx;
          if (window.selectPlanet) {
            window.selectPlanet(clickedPlanetIdx);
          }
        } else {
          // Check landing button click if inside gravity well
          if (this.landingButtonArea) {
            const area = this.landingButtonArea;
            if (mx >= area.x1 && mx <= area.x2 && my >= area.y1 && my <= area.y2) {
              const nearbyPlanet = this.getPlanetNearShuttle();
              if (nearbyPlanet) {
                this.landOnPlanet(nearbyPlanet);
                return;
              }
            }
          }

          // Otherwise, set pilot target coordinate in world space
          const worldPos = this.screenToWorld(mx, my);
          this.shuttle.targetX = worldPos.x;
          this.shuttle.targetY = worldPos.y;
          this.shuttle.autopilot = true;

          // Spark particle on autopilot coordinate set
          this.createClickSpark(mx, my);
        }
      } 
      else if (this.shuttleState === 'landed') {
        // Landed click routing
        // Check "LIFT OFF" button click
        const liftOffBtn = { x: 30, y: this.height - 55, w: 180, h: 32 };
        if (mx >= liftOffBtn.x && mx <= liftOffBtn.x + liftOffBtn.w && my >= liftOffBtn.y && my <= liftOffBtn.y + liftOffBtn.h) {
          this.liftOff();
          return;
        }

        // Check Seed synthesis selector buttons at the bottom of the landing deck
        const seedSelY = this.height - 110;
        const itemWidth = 105;
        const totalW = itemWidth * 6;
        const startX = (this.width - totalW) / 2;
        if (my >= seedSelY && my <= seedSelY + 28) {
          const index = Math.floor((mx - startX) / itemWidth);
          if (index >= 0 && index < 6) {
            this.selectedSeedType = PLANET_ELEMENTS_CATALOG[index];
            this.createClickSpark(mx, my);
            return;
          }
        }

        // Check Grid selection and farming actions
        if (this.hoveredCell && this.activeLandedPlanet) {
          const col = this.hoveredCell.c;
          const row = this.hoveredCell.r;
          const cell = this.activeLandedPlanet.grid[row][col];
          let taskType = null;

          if (cell.type === 'rubble') {
            if (window.sim && window.sim.qm >= 5) {
              taskType = 'clear_rubble';
            } else {
              if (window.appendLog) window.appendLog(`<span class='text-red'>⚠️ COMMAND_REJECTED: Insufficient Quantum Matter to clear space rubble (Requires 5 QM).</span>`);
            }
          } 
          else if (cell.type === 'flora') {
            if (window.sim && window.sim.qm >= 5) {
              taskType = 'harvest_flora';
            } else {
              if (window.appendLog) window.appendLog(`<span class='text-red'>⚠️ COMMAND_REJECTED: Insufficient Quantum Matter to harvest flora (Requires 5 QM).</span>`);
            }
          }
          else if (cell.type === 'fauna') {
            if (window.sim && window.sim.qm >= 8) {
              taskType = 'extract_fauna';
            } else {
              if (window.appendLog) window.appendLog(`<span class='text-red'>⚠️ COMMAND_REJECTED: Insufficient Quantum Matter to extract fauna (Requires 8 QM).</span>`);
            }
          }
          else if (cell.type === 'soil' && !cell.crop) {
            if (window.sim && window.sim.qm >= 15) {
              taskType = 'sow_seed';
            } else {
              if (window.appendLog) window.appendLog(`<span class='text-red'>⚠️ COMMAND_REJECTED: Insufficient Quantum Matter to synthesize seed (Requires 15 QM).</span>`);
            }
          } 
          else if (cell.type === 'seed' && cell.crop) {
            if (cell.crop.harvestReady) {
              taskType = 'harvest_crop';
            } else if (!cell.watered) {
              if (window.sim && window.sim.qm >= 2) {
                taskType = 'water_crop';
              } else {
                if (window.appendLog) window.appendLog(`<span class='text-red'>⚠️ COMMAND_REJECTED: Insufficient Quantum Matter to irrigate crop (Requires 2 QM).</span>`);
              }
            }
          }

          // Direct colonist avatar to target cell
          this.avatar.targetX = col + 0.5;
          this.avatar.targetY = row + 0.5;
          if (taskType) {
            this.pendingTask = {
              r: row,
              c: col,
              type: taskType,
              seedType: this.selectedSeedType
            };
          } else {
            this.pendingTask = null;
          }
          this.createClickSpark(mx, my);
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (window.activeMode !== 'solarsystem' || window.currentSolarSystem !== this) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.shuttleState === 'landed' && this.activeLandedPlanet) {
        // Track grid cells hovered inside the 3D spherical planet projection!
        const planet = this.activeLandedPlanet;
        const px = 2000 + Math.cos(planet.angle) * planet.orbitRadius;
        const py = 2000 + Math.sin(planet.angle) * planet.orbitRadius;

        const worldPos = this.screenToWorld(mx, my);
        const dx = worldPos.x - px;
        const dy = worldPos.y - py;

        // Normalized relative position from center of the planet [-1, 1]
        const nx = dx / planet.radius;
        const ny = dy / planet.radius;
        const dist = Math.hypot(nx, ny);

        if (dist <= 1.0) {
          // De-spherize to map screen-space back to linear grid coordinates!
          // Since we warped using Math.sin(dist * Math.PI / 2), the inverse is Math.asin(dist) * 2 / Math.PI!
          let unwarpFactor = 1.0;
          if (dist > 0.001) {
            unwarpFactor = (Math.asin(dist) / (Math.PI / 2)) / dist;
          }
          const gx = nx * unwarpFactor;
          const gy = ny * unwarpFactor;

          if (this.avatar) {
            const col = (Math.floor(this.avatar.x + gx * 8) + 16) % 16;
            const row = (Math.floor(this.avatar.y + gy * 8) + 16) % 16;

            this.hoveredCell = { r: row, c: col };
          }
        } else {
          this.hoveredCell = null;
        }
      }
    });

    // Keyboard 'L' key for planetary landing / liftoff
    window.addEventListener('keydown', (e) => {
      if (window.activeMode !== 'solarsystem' || window.currentSolarSystem !== this) return;
      if (e.key.toLowerCase() === 'l') {
        if (this.shuttleState === 'orbiting') {
          const nearby = this.getPlanetNearShuttle();
          if (nearby) this.landOnPlanet(nearby);
        } else if (this.shuttleState === 'landed') {
          this.liftOff();
        }
      }
    });

    // Continuous scroll wheel zoom support for both space orbit and planetary surface!
    this.canvas.addEventListener('wheel', (e) => {
      if (window.activeMode !== 'solarsystem' || window.currentSolarSystem !== this) return;
      e.preventDefault();
      
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      
      if (this.shuttleState === 'landed') {
        // Zoom on the surface of the planet
        this.camera.zoom = Math.max(1.5, Math.min(10.0, this.camera.zoom * zoomFactor));
      } else if (this.shuttleState === 'orbiting') {
        // Zoom in space orbits
        this.targetZoom = Math.max(0.12, Math.min(3.0, this.targetZoom * zoomFactor));
      }
    }, { passive: false });
  }

  getPlanetNearShuttle() {
    for (let p of this.planets) {
      const px = 2000 + Math.cos(p.angle) * p.orbitRadius;
      const py = 2000 + Math.sin(p.angle) * p.orbitRadius;
      const dist = Math.hypot(this.shuttle.x - px, this.shuttle.y - py);
      if (dist < p.gravityRadius) {
        return p;
      }
    }
    return null;
  }

  landOnPlanet(planet) {
    this.shuttleState = 'landing';
    this.activeLandedPlanet = planet;
    this.shuttleLandingProgress = 0;
    this.selectedPlanetIndex = this.planets.indexOf(planet);
    this.lastLandedPlanetName = planet.name.toUpperCase();
    
    // Track transition start coordinates for smooth interpolation
    this.landingCameraStartX = this.camera.x;
    this.landingCameraStartY = this.camera.y;
    this.landingCameraStartZoom = this.camera.zoom;
    this.landingShuttleStartX = this.shuttle.x;
    this.landingShuttleStartY = this.shuttle.y;

    // Stop shuttle motion
    this.shuttle.vx = 0;
    this.shuttle.vy = 0;
    this.shuttle.autopilot = false;

    if (window.selectPlanet) {
      window.selectPlanet(this.selectedPlanetIndex);
    }
    if (window.appendLog) {
      window.appendLog(`⚓ LANDING VECTOR: Engaging descent thrusters. Entering atmosphere of ${planet.name.toUpperCase()}...`);
    }
  }

  liftOff() {
    if (!this.activeLandedPlanet) return;
    this.shuttleState = 'lifting';
    this.shuttleLandingProgress = 1.0;
    if (this.targetZoom > 1.5) {
      this.targetZoom = 0.5; // Reset zoom to a reasonable orbit view if zoomed in
    }

    if (window.appendLog) {
      window.appendLog(`🚀 LIFTOFF VECTOR: Igniting thermal-fusion engines. Launching from surface of ${this.activeLandedPlanet.name.toUpperCase()}...`);
    }
  }

  createClickSpark(mx, my) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      this.particles.push({
        x: mx,
        y: my,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#00e5ff',
        size: 1 + Math.random() * 2,
        alpha: 1.0,
        age: 0,
        maxAge: 30 + Math.random() * 20
      });
    }
  }

  createHarvestExplosion(mx, my, color) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x: mx,
        y: my,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color || '#00ff66',
        size: 1.5 + Math.random() * 3,
        alpha: 1.0,
        age: 0,
        maxAge: 40 + Math.random() * 30
      });
    }
  }

  screenToWorld(sx, sy) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const wx = this.camera.x + (sx - cx) / this.camera.zoom;
    const wy = this.camera.y + (sy - cy) / this.camera.zoom;
    return { x: wx, y: wy };
  }

  worldToScreen(wx, wy) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const sx = cx + (wx - this.camera.x) * this.camera.zoom;
    const sy = cy + (wy - this.camera.y) * this.camera.zoom;
    return { x: sx, y: sy };
  }

  executePendingTask() {
    if (!this.pendingTask || !this.activeLandedPlanet) return;
    const { r, c, type, seedType } = this.pendingTask;
    this.pendingTask = null;

    const cell = this.activeLandedPlanet.grid[r][c];
    const planet = this.activeLandedPlanet;

    const px = 2000 + Math.cos(planet.angle) * planet.orbitRadius;
    const py = 2000 + Math.sin(planet.angle) * planet.orbitRadius;
    const sp = this.worldToScreen(px, py);
    const pr = planet.radius * this.camera.zoom;
    const screenPos = this.projectToScreen(c + 0.5, r + 0.5, planet, sp, pr);

    if (type === 'clear_rubble' && cell.type === 'rubble') {
      if (window.sim && window.sim.qm >= 5) {
        window.sim.qm -= 5;
        cell.type = 'soil';
        const harvestedValue = 2 + Math.floor(Math.random() * 4);
        const material = planet.preferredElement;
        
        if (window.mothershipBase && window.mothershipBase.inventory) {
          window.mothershipBase.inventory.quantumMatter = Math.round(window.sim.qm);
          if (window.mothershipBase.inventory[material.id] !== undefined) {
            window.mothershipBase.inventory[material.id] += harvestedValue;
          } else {
            window.mothershipBase.inventory[material.id] = harvestedValue;
          }
          window.mothershipBase.updateUiDisplay();
          window.mothershipBase.saveToStorage();
        }

        this.createHarvestExplosion(screenPos.x, screenPos.y, material.color);
        if (window.appendLog) {
          window.appendLog(`⛏️ CLEAR: Cleared stellar rubble. Transmuted +${harvestedValue} units of raw ${material.name}! (-5 QM)`);
        }
      }
    }
    else if (type === 'harvest_flora' && cell.type === 'flora') {
      if (window.sim && window.sim.qm >= 5) {
        window.sim.qm -= 5;
        cell.type = 'soil';
        const harvestedValue = 2 + Math.floor(Math.random() * 3);
        const material = planet.preferredElement;
        
        if (window.mothershipBase && window.mothershipBase.inventory) {
          window.mothershipBase.inventory.quantumMatter = Math.round(window.sim.qm);
          if (window.mothershipBase.inventory[material.id] !== undefined) {
            window.mothershipBase.inventory[material.id] += harvestedValue;
          } else {
            window.mothershipBase.inventory[material.id] = harvestedValue;
          }
          if (Math.random() < 0.1) {
            window.mothershipBase.inventory.exoticCores = (window.mothershipBase.inventory.exoticCores || 0) + 1;
          }
          window.mothershipBase.updateUiDisplay();
          window.mothershipBase.saveToStorage();
        }

        this.createHarvestExplosion(screenPos.x, screenPos.y, '#00ff66');
        if (window.appendLog) {
          window.appendLog(`🌿 HARVEST FLORA: Harvested symmetric ${planet.climate.flora}. Collected +${harvestedValue} ${material.name}! (-5 QM)`);
        }
      }
    }
    else if (type === 'extract_fauna' && cell.type === 'fauna') {
      if (window.sim && window.sim.qm >= 8) {
        window.sim.qm -= 8;
        cell.type = 'soil';
        const harvestedValue = 3 + Math.floor(Math.random() * 4);
        const material = planet.preferredElement;
        
        if (window.mothershipBase && window.mothershipBase.inventory) {
          window.mothershipBase.inventory.quantumMatter = Math.round(window.sim.qm);
          if (window.mothershipBase.inventory[material.id] !== undefined) {
            window.mothershipBase.inventory[material.id] += harvestedValue;
          } else {
            window.mothershipBase.inventory[material.id] = harvestedValue;
          }
          if (Math.random() < 0.2) {
            window.mothershipBase.inventory.symmetryCrystal = (window.mothershipBase.inventory.symmetryCrystal || 0) + 1;
            if (window.appendLog) {
              window.appendLog(`✨ BONUS: Discovered rare symmetry crystal!`);
            }
          }
          window.mothershipBase.updateUiDisplay();
          window.mothershipBase.saveToStorage();
        }

        this.createHarvestExplosion(screenPos.x, screenPos.y, '#ff00ff');
        if (window.appendLog) {
          window.appendLog(`⚡ EXTRACT FAUNA: Transmuted bilateral ${planet.climate.fauna}. Transferred +${harvestedValue} items and biome essence! (-8 QM)`);
        }
      }
    }
    else if (type === 'sow_seed' && cell.type === 'soil' && !cell.crop) {
      if (window.sim && window.sim.qm >= 15) {
        window.sim.qm -= 15;
        if (window.mothershipBase) {
          window.mothershipBase.inventory.quantumMatter = Math.round(window.sim.qm);
          window.mothershipBase.updateUiDisplay();
          window.mothershipBase.saveToStorage();
        }

        const seedObj = {
          id: 'seed-' + Math.random().toString(36).substr(2, 5),
          progress: 0,
          harvestReady: false,
          value: 20 + Math.floor(Math.random() * 25),
          element: seedType,
          gridX: c,
          gridY: r,
          growRate: 0.45
        };

        planet.plantedSeeds.push(seedObj);
        cell.type = 'seed';
        cell.crop = seedObj;

        this.createHarvestExplosion(screenPos.x, screenPos.y, seedType.color);
        if (window.appendLog) {
          window.appendLog(`🌱 SOW: Sown ${seedType.seedName} crystal on coordinate [${c}, ${r}]. (-15 QM)`);
        }
      }
    }
    else if (type === 'harvest_crop' && cell.type === 'seed' && cell.crop && cell.crop.harvestReady) {
      const harvested = this.harvestProbe(this.planets.indexOf(planet), cell.crop.id, window.mothershipBase);
      if (harvested) {
        if (window.mothershipBase) {
          window.sim.qm = window.mothershipBase.inventory.quantumMatter;
          window.mothershipBase.updateUiDisplay();
          window.mothershipBase.saveToStorage();
        }
        this.createHarvestExplosion(screenPos.x, screenPos.y, harvested.element.color);
        if (window.appendLog) {
          window.appendLog(`✨ HARVESTED: Transmuted matured ${harvested.element.name} crystal. Gained +${harvested.value} elements into mothership cargo!`);
        }
      }
    }
    else if (type === 'water_crop' && cell.type === 'seed' && cell.crop && !cell.watered) {
      if (window.sim && window.sim.qm >= 2) {
        window.sim.qm -= 2;
        cell.watered = true;
        cell.crop.progress = Math.min(100, cell.crop.progress + 15);
        this.createHarvestExplosion(screenPos.x, screenPos.y, '#00ffff');
        if (window.appendLog) {
          window.appendLog(`💧 IRRIGATION: Irrigated crystal with charged solar plasma! Immediate +15% grow progress. (-2 QM)`);
        }
      }
    }
  }

  tick() {
    this.time++;
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Star pulsing math
    this.star.pulse = Math.sin(this.time * 0.03) * 3;

    // Orbiting stars and particles continuous updates
    this.planets.forEach((planet, index) => {
      planet.angle += planet.orbitSpeed;
      planet.wavePhase += planet.vibrationFrequency * 0.08;

      // Glide frequency tuner smoothly
      planet.vibrationFrequency += (planet.targetFrequency - planet.vibrationFrequency) * 0.15;

      // Accelerate crops growth matching resonance frequency
      planet.plantedSeeds.forEach(seed => {
        if (seed.progress < 100) {
          const freqDiff = Math.abs(planet.vibrationFrequency - planet.resonancePeak);
          let multiplier = 0.25; // baseline slow grow
          if (freqDiff < 1.5) {
            multiplier += ((1.5 - freqDiff) / 1.5) * 3.0; // up to 3x growth acceleration
          }

          // Native species / Biome affinity matching speed boost
          if (seed.element.id === planet.preferredElement.id) {
            multiplier *= 2.0; // Double speed for native biome matching!
          }

          seed.progress = Math.min(100, seed.progress + seed.growRate * multiplier);
          if (seed.progress >= 100) {
            seed.harvestReady = true;
          }
        }
      });
    });

    // Handle space dust generation in Orbit view
    if (this.shuttleState === 'orbiting' && Math.random() < 0.25) {
      const angle = Math.random() * Math.PI * 2;
      this.systemParticles.push({
        x: this.star.x + Math.cos(angle) * this.star.radius,
        y: this.star.y + Math.sin(angle) * this.star.radius,
        vx: Math.cos(angle) * (1.2 + Math.random() * 1.5),
        vy: Math.sin(angle) * (1.2 + Math.random() * 1.5),
        hue: this.star.hue,
        size: 1 + Math.random() * 2,
        alpha: 0.8,
        age: 0,
        maxAge: 120 + Math.random() * 100
      });
    }

    this.systemParticles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      p.alpha = 0.8 * (1.0 - (p.age / p.maxAge));
      if (p.age >= p.maxAge) {
        this.systemParticles.splice(idx, 1);
      }
    });

    // Tick local canvas effects particles
    this.particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.age++;
      p.alpha = 1.0 - (p.age / p.maxAge);
      if (p.age >= p.maxAge) {
        this.particles.splice(idx, 1);
      }
    });

    // -------------------------------------------------------------
    // SHUTTLE PILOTING TICK & TRANSITIONS
    // -------------------------------------------------------------
    if (this.shuttleState === 'landing') {
      this.shuttleLandingProgress += 0.015; // smooth progress increment

      // Center the camera and shuttle on the active landed planet
      const planet = this.activeLandedPlanet;
      if (planet) {
        const px = 2000 + Math.cos(planet.angle) * planet.orbitRadius;
        const py = 2000 + Math.sin(planet.angle) * planet.orbitRadius;

        const t = this.shuttleLandingProgress;
        const easeT = t * t * (3 - 2 * t); // smoothstep

        // Interpolate shuttle smoothly from start position to planet center
        this.shuttle.x = this.landingShuttleStartX * (1 - easeT) + px * easeT;
        this.shuttle.y = this.landingShuttleStartY * (1 - easeT) + py * easeT;

        // Interpolate camera smoothly from start position to planet center
        this.camera.x = this.landingCameraStartX * (1 - easeT) + px * easeT;
        this.camera.y = this.landingCameraStartY * (1 - easeT) + py * easeT;

        // Interpolate zoom smoothly from start zoom to 4.0
        this.camera.zoom = this.landingCameraStartZoom * (1 - easeT) + 4.0 * easeT;
      }

      // Add dynamic atmospheric entry shaking
      this.screenShake = (1.0 - this.shuttleLandingProgress) * 7.0;

      // Spawn atmospheric sparks
      if (this.time % 2 === 0) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 4 + Math.random() * 4;
        this.particles.push({
          x: this.width / 2 + (Math.random() * 60 - 30),
          y: this.height / 2 + (Math.random() * 60 - 30),
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: `hsl(${15 + Math.random() * 30}, 100%, 55%)`,
          size: 2.0 + Math.random() * 3,
          alpha: 1.0,
          age: 0,
          maxAge: 15 + Math.random() * 15
        });
      }

      if (this.shuttleLandingProgress >= 1.0) {
        this.shuttleState = 'landed';
        this.screenShake = 0;
        this.camera.zoom = 4.0; // Perfect zoomed-in scale for farming surface grid!
        this.avatar = {
          x: 8.0,
          y: 8.0,
          targetX: null,
          targetY: null,
          bob: 0,
          name: "Pioneer " + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + "-" + Math.floor(10 + Math.random() * 90)
        };
        this.pendingTask = null;
        if (window.appendLog) {
          window.appendLog(`⚓ TOUCHDOWN: Landed on surface of ${planet.name.toUpperCase()}! Bio-resonant farming grid online.`);
        }
      }
    }
    else if (this.shuttleState === 'lifting') {
      this.shuttleLandingProgress -= 0.015; // descending progress back to 0

      const planet = this.activeLandedPlanet;
      if (planet) {
        const px = 2000 + Math.cos(planet.angle) * planet.orbitRadius;
        const py = 2000 + Math.sin(planet.angle) * planet.orbitRadius;

        // Progress of liftoff (0.0 to 1.0)
        const t = 1.0 - this.shuttleLandingProgress;
        const easeT = t * t * (3 - 2 * t); // smoothstep

        // Calculate current and target distance from the planet's center
        const targetDist = planet.gravityRadius + 40;
        const currentDist = targetDist * easeT;

        // Move shuttle along its angle away from the planet
        this.shuttle.x = px + Math.cos(this.shuttle.angle) * currentDist;
        this.shuttle.y = py + Math.sin(this.shuttle.angle) * currentDist;

        // Smoothly interpolate camera position: starts at center (px, py) and ends centered on shuttle at targetDist
        this.camera.x = px + Math.cos(this.shuttle.angle) * currentDist * 0.85;
        this.camera.y = py + Math.sin(this.shuttle.angle) * currentDist * 0.85;

        // Smoothly zoom back out to orbiting zoom target
        this.camera.zoom = 4.0 * (1 - easeT) + this.targetZoom * easeT;
      }

      this.screenShake = (1.0 - this.shuttleLandingProgress) * 5.0;

      // Spawn flame trail
      const screenPos = this.worldToScreen(this.shuttle.x, this.shuttle.y);
      for (let i = 0; i < 3; i++) {
        const devAngle = this.shuttle.angle + Math.PI + (Math.random() * 0.4 - 0.2);
        const spd = 3 + Math.random() * 5;
        this.particles.push({
          x: screenPos.x,
          y: screenPos.y,
          vx: Math.cos(devAngle) * spd,
          vy: Math.sin(devAngle) * spd,
          color: '#ff6600',
          size: 2 + Math.random() * 3,
          alpha: 1.0,
          age: 0,
          maxAge: 20 + Math.random() * 15
        });
      }

      if (this.shuttleLandingProgress <= 0.0) {
        this.shuttleState = 'orbiting';
        this.activeLandedPlanet = null;
        this.screenShake = 0;

        // Position shuttle safely outside of immediate gravity radius
        if (planet) {
          const px = 2000 + Math.cos(planet.angle) * planet.orbitRadius;
          const py = 2000 + Math.sin(planet.angle) * planet.orbitRadius;
          const targetDist = planet.gravityRadius + 40;
          this.shuttle.x = px + Math.cos(this.shuttle.angle) * targetDist;
          this.shuttle.y = py + Math.sin(this.shuttle.angle) * targetDist;
          this.shuttle.vx = Math.cos(this.shuttle.angle) * 3;
          this.shuttle.vy = Math.sin(this.shuttle.angle) * 3;
        }

        if (window.appendLog) {
          window.appendLog(`🚀 ORBIT ESTABLISHED: Entered stable planetary orbital corridors.`);
        }
      }
    }
    else if (this.shuttleState === 'orbiting') {
      const keys = window.keysPressed || {};

      this.shuttle.thrustActive = false;

      // 1. Keyboard Navigation Controls
      if (keys['w'] || keys['arrowup']) {
        this.shuttle.vx += Math.cos(this.shuttle.angle) * this.shuttle.thrust;
        this.shuttle.vy += Math.sin(this.shuttle.angle) * this.shuttle.thrust;
        this.shuttle.thrustActive = true;
        this.shuttle.autopilot = false;
      }
      if (keys['s'] || keys['arrowdown']) {
        this.shuttle.vx *= 0.85; // Sharp air brake
        this.shuttle.vy *= 0.85;
        this.shuttle.autopilot = false;
      }
      if (keys['a'] || keys['arrowleft']) {
        this.shuttle.angle -= this.shuttle.rotationSpeed;
        this.shuttle.autopilot = false;
      }
      if (keys['d'] || keys['arrowright']) {
        this.shuttle.angle += this.shuttle.rotationSpeed;
        this.shuttle.autopilot = false;
      }

      // 2. Autopilot navigation
      if (this.shuttle.autopilot && this.shuttle.targetX !== null) {
        const dx = this.shuttle.targetX - this.shuttle.x;
        const dy = this.shuttle.targetY - this.shuttle.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 15) {
          const targetAngle = Math.atan2(dy, dx);
          
          // Smooth rotation to target angle
          let angleDiff = targetAngle - this.shuttle.angle;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

          this.shuttle.angle += Math.max(-this.shuttle.rotationSpeed, Math.min(this.shuttle.rotationSpeed, angleDiff));
          
          // Apply automatic thrust if lined up
          if (Math.abs(angleDiff) < 0.5) {
            this.shuttle.vx += Math.cos(this.shuttle.angle) * this.shuttle.thrust * 0.9;
            this.shuttle.vy += Math.sin(this.shuttle.angle) * this.shuttle.thrust * 0.9;
            this.shuttle.thrustActive = true;
          }
        } else {
          this.shuttle.autopilot = false;
          this.shuttle.vx *= 0.5;
          this.shuttle.vy *= 0.5;
        }
      }

      // Apply drag friction
      this.shuttle.vx *= this.shuttle.drag;
      this.shuttle.vy *= this.shuttle.drag;

      // Clamp max velocity
      const currentSpeed = Math.hypot(this.shuttle.vx, this.shuttle.vy);
      if (currentSpeed > this.shuttle.maxSpeed) {
        const factor = this.shuttle.maxSpeed / currentSpeed;
        this.shuttle.vx *= factor;
        this.shuttle.vy *= factor;
      }

      // Update positions
      this.shuttle.x += this.shuttle.vx;
      this.shuttle.y += this.shuttle.vy;

      // 3. Apply Planet Gravity Wells Pulls
      this.planets.forEach(p => {
        const px = 2000 + Math.cos(p.angle) * p.orbitRadius;
        const py = 2000 + Math.sin(p.angle) * p.orbitRadius;
        const dx = px - this.shuttle.x;
        const dy = py - this.shuttle.y;
        const dist = Math.hypot(dx, dy);

        if (dist < p.gravityRadius) {
          // Pull strength scaling inversely with distance
          const gravityIntensity = (1.0 - dist / p.gravityRadius) * 0.08;
          this.shuttle.vx += (dx / dist) * gravityIntensity;
          this.shuttle.vy += (dy / dist) * gravityIntensity;
        }
      });

      // Clamp shuttle inside massive solar system boundaries
      this.shuttle.x = Math.max(100, Math.min(this.worldWidth - 100, this.shuttle.x));
      this.shuttle.y = Math.max(100, Math.min(this.worldHeight - 100, this.shuttle.y));

      // Spawn thruster flame particles
      if (this.shuttle.thrustActive && this.time % 2 === 0) {
        const screenPos = this.worldToScreen(this.shuttle.x, this.shuttle.y);
        const tailX = screenPos.x - Math.cos(this.shuttle.angle) * 14;
        const tailY = screenPos.y - Math.sin(this.shuttle.angle) * 14;
        
        for (let i = 0; i < 2; i++) {
          const devAngle = this.shuttle.angle + Math.PI + (Math.random() * 0.4 - 0.2);
          const spd = 2 + Math.random() * 3;
          this.particles.push({
            x: tailX,
            y: tailY,
            vx: Math.cos(devAngle) * spd,
            vy: Math.sin(devAngle) * spd,
            color: 'hsl(' + (200 + Math.random() * 30) + ', 100%, 65%)',
            size: 1.5 + Math.random() * 2,
            alpha: 1.0,
            age: 0,
            maxAge: 20 + Math.random() * 15
          });
        }
      }

      // Star Solar Fuel charging: slow fuel charge near star!
      const starDist = Math.hypot(this.shuttle.x - 2000, this.shuttle.y - 2000);
      if (starDist < 400) {
        this.shuttle.fuel = Math.min(100, this.shuttle.fuel + 0.15);
      }

      // Camera smoothly tracking pilotable shuttle!
      const zoomTarget = this.targetZoom;
      this.camera.zoom += (zoomTarget - this.camera.zoom) * 0.05;
      this.camera.x += (this.shuttle.x - this.camera.x) * 0.08;
      this.camera.y += (this.shuttle.y - this.camera.y) * 0.08;
    }
    else if (this.shuttleState === 'landed') {
      const keys = window.keysPressed || {};
      let kdx = 0;
      let kdy = 0;
      if (keys['w'] || keys['arrowup']) kdy -= 1;
      if (keys['s'] || keys['arrowdown']) kdy += 1;
      if (keys['a'] || keys['arrowleft']) kdx -= 1;
      if (keys['d'] || keys['arrowright']) kdx += 1;

      if (kdx !== 0 || kdy !== 0) {
        // Manual override: cancel automated pathing target
        this.avatar.targetX = null;
        this.avatar.targetY = null;
        this.pendingTask = null;

        const len = Math.hypot(kdx, kdy);
        const moveSpeed = 0.12; // cell units per frame
        this.avatar.x += (kdx / len) * moveSpeed;
        this.avatar.y += (kdy / len) * moveSpeed;

        // Wrap around the 16x16 sphere grid
        this.avatar.x = (this.avatar.x + 16) % 16;
        this.avatar.y = (this.avatar.y + 16) % 16;
        this.avatar.bob += 0.25;
      } else if (this.avatar.targetX !== null && this.avatar.targetY !== null) {
        // Pathfind/walk towards clicked coordinate taking wrapped shortest path
        let adx = this.avatar.targetX - this.avatar.x;
        let ady = this.avatar.targetY - this.avatar.y;

        // Wrap distance for shortest route on sphere torus
        if (adx < -8) adx += 16;
        if (adx > 8) adx -= 16;
        if (ady < -8) ady += 16;
        if (ady > 8) ady -= 16;

        const dist = Math.hypot(adx, ady);

        if (dist > 0.12) {
          const moveSpeed = 0.12;
          this.avatar.x += (adx / dist) * moveSpeed;
          this.avatar.y += (ady / dist) * moveSpeed;
          this.avatar.x = (this.avatar.x + 16) % 16;
          this.avatar.y = (this.avatar.y + 16) % 16;
          this.avatar.bob += 0.25;
        } else {
          this.avatar.x = (this.avatar.targetX + 16) % 16;
          this.avatar.y = (this.avatar.targetY + 16) % 16;
          this.avatar.targetX = null;
          this.avatar.targetY = null;
          this.avatar.bob *= 0.85;

          if (this.pendingTask) {
            this.executePendingTask();
          }
        }
      } else {
        this.avatar.bob *= 0.85;
      }

      // Charge shuttle fuel on planetary battery grid
      this.shuttle.fuel = Math.min(100, this.shuttle.fuel + 0.25);

      // Keep shuttle attached to the active landed planet
      const planet = this.activeLandedPlanet;
      if (planet) {
        const px = 2000 + Math.cos(planet.angle) * planet.orbitRadius;
        const py = 2000 + Math.sin(planet.angle) * planet.orbitRadius;
        this.shuttle.x = px;
        this.shuttle.y = py;
        this.shuttle.vx = 0;
        this.shuttle.vy = 0;

        // Lock camera exactly to the planet center to completely eliminate orbital lag/wobble!
        this.camera.x = px;
        this.camera.y = py;
      }
    }

    // Spacetime warping deformation pull computations
    const starG = 650;
    const starX = 2000;
    const starY = 2000;

    this.gridNodes.forEach(node => {
      let dx = node.ox - starX;
      let dy = node.oy - starY;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;

      let pull = (starG / (dist * 0.015 + 3.0));
      let currentX = node.ox - (dx / dist) * pull;
      let currentY = node.oy - (dy / dist) * pull;

      this.planets.forEach(p => {
        const px = starX + Math.cos(p.angle) * p.orbitRadius;
        const py = starY + Math.sin(p.angle) * p.orbitRadius;
        const pdx = node.ox - px;
        const pdy = node.oy - py;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
        const ppull = (p.radius * 32) / (pdist * 0.03 + 4.0);
        
        currentX -= (pdx / pdist) * ppull;
        currentY -= (pdy / pdist) * ppull;
      });

      node.x += (currentX - node.x) * 0.25;
      node.y += (currentY - node.y) * 0.25;
    });
  }

  render() {
    this.ctx.save();
    if (this.screenShake && this.screenShake > 0) {
      const dx = (Math.random() * 2 - 1) * this.screenShake;
      const dy = (Math.random() * 2 - 1) * this.screenShake;
      this.ctx.translate(dx, dy);
    }

    if (this.shuttleState === 'orbiting' || this.shuttleState === 'landing' || this.shuttleState === 'lifting') {
      this.renderOrbitingView();
    } else {
      this.renderLandedFarmingView();
    }
    this.ctx.restore();
  }

  renderOrbitingView() {
    // 1. Clean background canvas
    this.ctx.fillStyle = '#010103';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 2. Draw warped spacetime grid lines
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 179, 0, 0.04)';
    this.ctx.lineWidth = 1;

    // Center coordinates for spacing
    const spacing = 150;
    const cols = Math.ceil(this.worldWidth / spacing) + 2;
    const rows = Math.ceil(this.worldHeight / spacing) + 2;

    for (let c = 0; c < cols; c++) {
      this.ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        const idx = c * rows + r;
        if (this.gridNodes[idx]) {
          const n = this.gridNodes[idx];
          const screenPos = this.worldToScreen(n.x, n.y);
          if (r === 0) this.ctx.moveTo(screenPos.x, screenPos.y);
          else this.ctx.lineTo(screenPos.x, screenPos.y);
        }
      }
      this.ctx.stroke();
    }

    for (let r = 0; r < rows; r++) {
      this.ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        const idx = c * rows + r;
        if (this.gridNodes[idx]) {
          const n = this.gridNodes[idx];
          const screenPos = this.worldToScreen(n.x, n.y);
          if (c === 0) this.ctx.moveTo(screenPos.x, screenPos.y);
          else this.ctx.lineTo(screenPos.x, screenPos.y);
        }
      }
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Draw world boundaries
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([10, 5]);
    const boundaryTL = this.worldToScreen(0, 0);
    const boundaryBR = this.worldToScreen(this.worldWidth, this.worldHeight);
    this.ctx.strokeRect(boundaryTL.x, boundaryTL.y, boundaryBR.x - boundaryTL.x, boundaryBR.y - boundaryTL.y);
    this.ctx.restore();

    // 3. Render orbit tracks
    this.ctx.save();
    this.planets.forEach((planet, idx) => {
      const isSelected = idx === this.selectedPlanetIndex;
      this.ctx.strokeStyle = isSelected ? 'rgba(0, 229, 255, 0.25)' : 'rgba(255, 255, 255, 0.04)';
      this.ctx.lineWidth = isSelected ? 2.0 : 1.0;
      this.ctx.beginPath();
      const screenStar = this.worldToScreen(2000, 2000);
      this.ctx.arc(screenStar.x, screenStar.y, planet.orbitRadius * this.camera.zoom, 0, Math.PI * 2);
      this.ctx.stroke();
    });
    this.ctx.restore();

    // 4. Render Solar Star
    this.ctx.save();
    const screenStar = this.worldToScreen(2000, 2000);
    const szRad = this.star.radius * this.camera.zoom;
    
    const starGlow = this.ctx.createRadialGradient(
      screenStar.x, screenStar.y, 5,
      screenStar.x, screenStar.y, szRad * 2.5
    );
    const h = this.star.hue;
    const s = this.star.saturation;
    const l = this.star.lightness;

    starGlow.addColorStop(0, `hsla(${h}, ${s}%, 95%, 1.0)`);
    starGlow.addColorStop(0.2, `hsla(${h}, ${s}%, ${l}%, 0.8)`);
    starGlow.addColorStop(0.5, `hsla(${h}, ${s}%, ${l - 12}%, 0.3)`);
    starGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

    this.ctx.fillStyle = starGlow;
    this.ctx.beginPath();
    this.ctx.arc(screenStar.x, screenStar.y, szRad * 2.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Core vector outline
    this.ctx.strokeStyle = `hsla(${h}, 100%, 75%, 0.95)`;
    this.ctx.lineWidth = 2.5 * this.camera.zoom;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = `hsla(${h}, 100%, 50%, 0.45)`;
    this.ctx.beginPath();
    this.ctx.arc(screenStar.x, screenStar.y, szRad + this.star.pulse * this.camera.zoom, 0, Math.PI * 2);
    this.ctx.stroke();

    // Label of Star
    if (this.camera.zoom > 0.2) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 9.5px "Space Grotesk", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.star.name.toUpperCase(), screenStar.x, screenStar.y + 4);
    }
    this.ctx.restore();

    // 5. Draw space particles
    this.ctx.save();
    this.systemParticles.forEach(p => {
      const sp = this.worldToScreen(p.x, p.y);
      this.ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, ${p.alpha * 0.5})`;
      this.ctx.beginPath();
      this.ctx.arc(sp.x, sp.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.restore();

    // 6. Draw local effects particles
    this.ctx.save();
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.restore();

    // 7. Render Planets and gravity well effects
    this.planets.forEach((planet, idx) => {
      const px = 2000 + Math.cos(planet.angle) * planet.orbitRadius;
      const py = 2000 + Math.sin(planet.angle) * planet.orbitRadius;
      const sp = this.worldToScreen(px, py);
      const pr = planet.radius * this.camera.zoom;

      const isFocused = idx === this.selectedPlanetIndex || idx === this.hoveredPlanetIndex;
      const distToShuttle = Math.hypot(this.shuttle.x - px, this.shuttle.y - py);
      const insideGravity = distToShuttle < planet.gravityRadius;

      // Draw gravity well circular grid ripple
      this.ctx.save();
      this.ctx.strokeStyle = insideGravity ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255,255,255,0.02)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(sp.x, sp.y, planet.gravityRadius * this.camera.zoom, 0, Math.PI * 2);
      this.ctx.stroke();

      // Pulsing gravitational pull ring if near
      if (insideGravity) {
        this.ctx.strokeStyle = `hsla(${planet.hue}, 90%, 65%, ${0.1 + Math.sin(this.time * 0.1) * 0.05})`;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(sp.x, sp.y, (planet.gravityRadius * 0.6 + Math.sin(this.time * 0.08) * 20) * this.camera.zoom, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();

      // Draw planet body glow gradient
      this.ctx.save();
      const pGlow = this.ctx.createRadialGradient(
        sp.x, sp.y, 2,
        sp.x, sp.y, pr * 1.5
      );
      pGlow.addColorStop(0, '#ffffff');
      pGlow.addColorStop(0.3, `hsl(${planet.hue}, ${planet.saturation}%, ${planet.lightness}%)`);
      pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = pGlow;
      this.ctx.beginPath();
      this.ctx.arc(sp.x, sp.y, pr * 1.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Outline stroke
      this.ctx.strokeStyle = isFocused ? '#00e5ff' : `hsl(${planet.hue}, ${planet.saturation}%, 70%)`;
      this.ctx.lineWidth = isFocused ? 2 : 1;
      this.ctx.beginPath();
      this.ctx.arc(sp.x, sp.y, pr, 0, Math.PI * 2);
      this.ctx.stroke();

      // Atmospheric ripple waves ("dress")
      if (isFocused) {
        const waveCount = 3;
        const maxWaveRad = pr * (2.8 + Math.sin(this.time * 0.06) * 0.3);
        this.ctx.lineWidth = 1;
        for (let w = 1; w <= waveCount; w++) {
          const waveRadius = pr + (w / waveCount) * (maxWaveRad - pr);
          const intensity = Math.sin(waveRadius * 0.2 - planet.wavePhase) * 0.5 + 0.5;
          this.ctx.strokeStyle = `hsla(${planet.hue}, ${planet.saturation}%, ${planet.lightness}%, ${intensity * 0.18})`;
          this.ctx.beginPath();
          this.ctx.arc(sp.x, sp.y, waveRadius, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }

      // Title & stats display
      if (this.camera.zoom > 0.15) {
        this.ctx.fillStyle = isFocused ? '#00e5ff' : '#cccccc';
        this.ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(planet.name.toUpperCase(), sp.x, sp.y - pr - 12);
        
        // Show gravity indicator
        if (insideGravity) {
          this.ctx.fillStyle = 'var(--color-cyan)';
          this.ctx.font = '7px "JetBrains Mono", monospace';
          this.ctx.fillText("GRAVITY LOCK", sp.x, sp.y + pr + 12);
        }
      }

      if (planet === this.activeLandedPlanet) {
        this.renderWorldSpaceGrid(planet, sp, pr);
      } else {
        // Draw active seed indicators orbiting on the planet surface
        planet.plantedSeeds.forEach(seed => {
          const angle = planet.angle + (seed.gridY * 8 + seed.gridX) * 0.45;
          const sx = sp.x + Math.cos(angle) * (pr + 8 * this.camera.zoom);
          const sy = sp.y + Math.sin(angle) * (pr + 8 * this.camera.zoom);

          this.ctx.fillStyle = seed.element.color;
          this.ctx.beginPath();
          this.ctx.arc(sx, sy, seed.harvestReady ? 3.5 : 2.0, 0, Math.PI * 2);
          this.ctx.fill();
        });
      }
      this.ctx.restore();
    });

    // 8. Render Pilotable Landing Shuttle
    this.ctx.save();
    const sshScreen = this.worldToScreen(this.shuttle.x, this.shuttle.y);
    this.ctx.translate(sshScreen.x, sshScreen.y);
    this.ctx.rotate(this.shuttle.angle);

    // Shuttle vector shape (Brutalist military wedge design)
    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.fillStyle = '#020205';
    this.ctx.lineWidth = 1.8;
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = '#00e5ff';

    this.ctx.beginPath();
    this.ctx.moveTo(13, 0);       // nose
    this.ctx.lineTo(-8, -8);     // left wing
    this.ctx.lineTo(-4, 0);      // tail recess
    this.ctx.lineTo(-8, 8);      // right wing
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Internal detail wing lines
    this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(-4, 0);
    this.ctx.lineTo(8, 0);
    this.ctx.stroke();
    this.ctx.restore();

    // Draw autopilot waypoint marker if active
    if (this.shuttle.autopilot && this.shuttle.targetX !== null) {
      this.ctx.save();
      const wpScreen = this.worldToScreen(this.shuttle.targetX, this.shuttle.targetY);
      this.ctx.strokeStyle = '#00e5ff';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([2, 2]);
      
      // Line from ship to waypoint
      this.ctx.beginPath();
      this.ctx.moveTo(sshScreen.x, sshScreen.y);
      this.ctx.lineTo(wpScreen.x, wpScreen.y);
      this.ctx.stroke();

      // Waypoint spinning crosshair
      this.ctx.strokeStyle = 'var(--color-cyan)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      const size = 6;
      const rot = this.time * 0.05;
      for (let i = 0; i < 4; i++) {
        const ang = rot + (i * Math.PI) / 2;
        this.ctx.moveTo(wpScreen.x, wpScreen.y);
        this.ctx.lineTo(wpScreen.x + Math.cos(ang) * size, wpScreen.y + Math.sin(ang) * size);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 9. On-Screen Pilot Dashboard Telemetry Overlays
    if (this.shuttleState !== 'landed') {
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      this.ctx.fillText(`SOLAR SYSTEM: ${this.star.name.toUpperCase()}`, 15, 25);
      
      this.ctx.fillStyle = 'var(--color-text-dim)';
      this.ctx.font = '8.5px "JetBrains Mono", monospace';
      this.ctx.fillText(`ZODIAC REGION: ${this.region.zodiac.toUpperCase()} Domain (${this.region.title})`, 15, 37);
      this.ctx.fillText(`SYSTEM COORDINATES: [${Math.round(this.seedX)}, ${Math.round(this.seedY)}]`, 15, 47);

      // Pilot controls instruction guide bottom left
      this.ctx.fillStyle = '#888';
      this.ctx.fillText("Controls: [W,A,S,D] or [ARROWS] to pilot shuttle  |  [CLICK] space to autopilot", 15, this.height - 42);
      this.ctx.fillText("Scroll Mousewheel to Zoom view  |  Drift close to planets to enter Gravity Lock & Land", 15, this.height - 28);

      // Shuttle Telemetry Dashboard bottom right
      const dashX = this.width - 240;
      const dashY = this.height - 105;
      
      // Wireframe panel container
      this.ctx.fillStyle = 'rgba(3, 3, 6, 0.85)';
      this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
      this.ctx.lineWidth = 1;
      this.ctx.fillRect(dashX, dashY, 225, 90);
      this.ctx.strokeRect(dashX, dashY, 225, 90);

      // Panel title line
      this.ctx.fillStyle = 'var(--color-cyan)';
      this.ctx.font = 'bold 9px "Space Grotesk", sans-serif';
      this.ctx.fillText("SHUTTLE_O2 PILOT TELEMETRY", dashX + 10, dashY + 16);

      this.ctx.fillStyle = 'var(--color-text-dim)';
      this.ctx.font = '8px "JetBrains Mono", monospace';
      this.ctx.fillText(`VELOCITY: ${Math.hypot(this.shuttle.vx, this.shuttle.vy).toFixed(2)} mach`, dashX + 10, dashY + 34);
      this.ctx.fillText(`POSITION: ${Math.round(this.shuttle.x)}, ${Math.round(this.shuttle.y)}`, dashX + 10, dashY + 46);
      
      // Star thermal generator close proximity charging stat
      const proximityCharge = Math.hypot(this.shuttle.x - 2000, this.shuttle.y - 2000) < 400;
      this.ctx.fillStyle = proximityCharge ? 'var(--color-green)' : 'var(--color-text-dim)';
      this.ctx.fillText(`STATIONARY CHARGING: ${proximityCharge ? 'ACTIVE (SOLAR CHARGE)' : 'OFFLINE'}`, dashX + 10, dashY + 58);

      // Autopilot state
      this.ctx.fillStyle = this.shuttle.autopilot ? 'var(--color-cyan)' : 'var(--color-text-dim)';
      this.ctx.fillText(`AUTOPILOT FLIGHT DECK: ${this.shuttle.autopilot ? 'LOCKED ON' : 'MANUAL'}`, dashX + 10, dashY + 70);

      // Solar fuel solar cells charge progress bar
      this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      this.ctx.fillText("CELLS", dashX + 10, dashY + 81);
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(dashX + 45, dashY + 76, 110, 6);
      this.ctx.fillStyle = proximityCharge ? '#00ff66' : '#00e5ff';
      this.ctx.fillRect(dashX + 45, dashY + 76, this.shuttle.fuel * 1.1, 6);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '7.5px "JetBrains Mono", monospace';
      this.ctx.fillText(`${Math.round(this.shuttle.fuel)}%`, dashX + 160, dashY + 81);

      // 10. Upper-Left Gravity Well Alert notification
      const nearbyPlanet = this.getPlanetNearShuttle();
      if (nearbyPlanet) {
        // Render a clean notification widget in the upper left under system coordinates
        const widgetX = 15;
        const widgetY = 60;
        const widgetW = 225;
        const widgetH = 40;

        // Draw a minimalist box on the left, matching the look of the shuttle pilot panel but compact
        this.ctx.fillStyle = 'rgba(3, 3, 6, 0.85)';
        this.ctx.strokeStyle = `hsl(${nearbyPlanet.hue}, ${nearbyPlanet.saturation}%, 55%)`;
        this.ctx.lineWidth = 1;
        this.ctx.fillRect(widgetX, widgetY, widgetW, widgetH);
        this.ctx.strokeRect(widgetX, widgetY, widgetW, widgetH);

        // Pulsing active marker
        const isAmber = (this.time % 30 < 15);
        this.ctx.fillStyle = isAmber ? 'var(--color-amber)' : `hsl(${nearbyPlanet.hue}, ${nearbyPlanet.saturation}%, 65%)`;
        this.ctx.beginPath();
        this.ctx.arc(widgetX + 12, widgetY + 14, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Warning title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 8.5px "Space Grotesk", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`GRAVITY LOCK WELL ATTACHED`, widgetX + 22, widgetY + 17);

        // Landing instruction
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        this.ctx.font = '7.5px "JetBrains Mono", monospace';
        this.ctx.fillText(`[L] OR CLICK TO LAND ON ${nearbyPlanet.name.toUpperCase()}`, widgetX + 22, widgetY + 29);

        // Store click boundaries for this widget
        this.landingButtonArea = {
          x1: widgetX,
          y1: widgetY,
          x2: widgetX + widgetW,
          y2: widgetY + widgetH
        };
      } else {
        this.landingButtonArea = null;
      }
      this.ctx.restore();
    }
  }

  projectToScreen(gridC, gridR, planet, sp, pr) {
    if (!this.avatar) {
      return { x: 0, y: 0, dist: Infinity, visible: false };
    }
    let dc = gridC - this.avatar.x;
    let dr = gridR - this.avatar.y;

    // Wrap distance around 16x16 grid torus
    if (dc < -8) dc += 16;
    if (dc > 8) dc -= 16;
    if (dr < -8) dr += 16;
    if (dr > 8) dr -= 16;

    const nx = dc / 8;
    const ny = dr / 8;
    const dist = Math.hypot(nx, ny);

    let sx_norm = nx;
    let sy_norm = ny;
    if (dist > 0.001) {
      // Spherical warp projection
      const factor = Math.sin(dist * Math.PI / 2) / dist;
      sx_norm = nx * factor;
      sy_norm = ny * factor;
    }

    return {
      x: sp.x + sx_norm * pr,
      y: sp.y + sy_norm * pr,
      dist: dist,
      visible: dist <= 1.0
    };
  }

  renderWorldSpaceGrid(planet, sp, pr) {
    this.ctx.save();
    
    // 1. Establish clipping path so nothing ever overflows outside the planet's circular boundary
    this.ctx.beginPath();
    this.ctx.arc(sp.x, sp.y, pr, 0, Math.PI * 2);
    this.ctx.clip();

    // 2. Render background surface shading for the planet inside the circle
    this.ctx.fillStyle = '#05050d';
    this.ctx.fillRect(sp.x - pr, sp.y - pr, pr * 2, pr * 2);

    // Subtle topographical noise representation (grids of circles)
    // REMOVED: topographical noise that causes visual flashing

    const projectCorner = (gridC, gridR) => {
      return this.projectToScreen(gridC, gridR, planet, sp, pr);
    };

    // 3. Draw individual cells of 16x16 symmetric grid as spherized 3D curved tiles
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        const cell = planet.grid[r][c];

        // Project the 4 corners of the grid tile
        const p0 = projectCorner(c, r);
        const p1 = projectCorner(c + 1, r);
        const p2 = projectCorner(c + 1, r + 1);
        const p3 = projectCorner(c, r + 1);

        // If all corners are off the visible hemisphere face, skip drawing
        if (p0.dist > 1.05 && p1.dist > 1.05 && p2.dist > 1.05 && p3.dist > 1.05) {
          continue;
        }

        const mid = projectCorner(c + 0.5, r + 0.5);
        if (!mid.visible) continue;

        // Spherical scale factor based on edge proximity
        const scaleFactor = Math.max(0.2, 1.0 - Math.min(0.85, mid.dist * 0.75));
        const cellSize = ((pr * 2.2) / 16) * scaleFactor;

        // Base ground coloration
        let cellBgColor = 'rgba(255, 255, 255, 0.02)';
        let cellStrokeColor = `hsla(${planet.hue}, 40%, 30%, 0.18)`;

        const isHovered = this.hoveredCell && this.hoveredCell.r === r && this.hoveredCell.c === c;
        if (isHovered) {
          cellBgColor = `hsla(${planet.hue}, 50%, 50%, 0.15)`;
          cellStrokeColor = '#00e5ff';
        }

        // Draw spherized 4-sided tile polygon
        this.ctx.fillStyle = cellBgColor;
        this.ctx.strokeStyle = cellStrokeColor;
        this.ctx.lineWidth = isHovered ? 1.5 : 0.8;
        
        this.ctx.beginPath();
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.lineTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.lineTo(p3.x, p3.y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Coordinates in 3D projection
        const cx = mid.x;
        const cy = mid.y;

        // Render contents based on type
        if (cell.type === 'rubble') {
          this.ctx.strokeStyle = '#8a8a93';
          this.ctx.fillStyle = '#18181b';
          this.ctx.lineWidth = Math.max(0.5, 1 * scaleFactor);
          this.ctx.beginPath();
          this.ctx.moveTo(cx - cellSize * 0.2, cy + cellSize * 0.2);
          this.ctx.lineTo(cx - cellSize * 0.25, cy - cellSize * 0.05);
          this.ctx.lineTo(cx, cy - cellSize * 0.25);
          this.ctx.lineTo(cx + cellSize * 0.25, cy - cellSize * 0.15);
          this.ctx.lineTo(cx + cellSize * 0.2, cy + cellSize * 0.2);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          if (isHovered && this.camera.zoom > 1.5) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `bold ${Math.max(5, cellSize * 0.32)}px "JetBrains Mono", monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText("CLEAR", cx, cy - 1);
            this.ctx.fillStyle = 'var(--color-amber)';
            this.ctx.fillText("(-5 QM)", cx, cy + cellSize * 0.3);
          }
        }
        else if (cell.type === 'flora') {
          this.ctx.strokeStyle = `hsl(${planet.hue}, 80%, 65%)`;
          this.ctx.fillStyle = `hsla(${planet.hue}, 80%, 65%, 0.45)`;
          this.ctx.lineWidth = Math.max(0.5, 1 * scaleFactor);

          this.ctx.beginPath();
          this.ctx.ellipse(cx - cellSize * 0.2, cy, cellSize * 0.15, cellSize * 0.25, -Math.PI / 6, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.beginPath();
          this.ctx.ellipse(cx + cellSize * 0.2, cy, cellSize * 0.15, cellSize * 0.25, Math.PI / 6, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = '#ffffff';
          this.ctx.beginPath();
          this.ctx.arc(cx, cy - cellSize * 0.1, cellSize * 0.1, 0, Math.PI * 2);
          this.ctx.fill();

          if (isHovered && this.camera.zoom > 1.5) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `bold ${Math.max(5, cellSize * 0.3)}px "JetBrains Mono", monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText("HARVEST", cx, cy - 1);
            this.ctx.fillStyle = '#22c55e';
            this.ctx.fillText("(-5 QM)", cx, cy + cellSize * 0.3);
          }
        }
        else if (cell.type === 'fauna') {
          this.ctx.strokeStyle = `hsl(${planet.hue + 120}, 90%, 60%)`;
          this.ctx.fillStyle = `hsla(${planet.hue + 120}, 90%, 60%, 0.3)`;
          this.ctx.lineWidth = Math.max(0.5, 1 * scaleFactor);

          this.ctx.beginPath();
          this.ctx.arc(cx - cellSize * 0.2, cy, cellSize * 0.15, 0, Math.PI * 2);
          this.ctx.arc(cx + cellSize * 0.2, cy, cellSize * 0.15, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = '#ffffff';
          this.ctx.fillRect(cx - cellSize * 0.05, cy - cellSize * 0.2, cellSize * 0.1, cellSize * 0.4);

          if (isHovered && this.camera.zoom > 1.5) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `bold ${Math.max(5, cellSize * 0.3)}px "JetBrains Mono", monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText("EXTRACT", cx, cy - 1);
            this.ctx.fillStyle = '#d946ef';
            this.ctx.fillText("(-8 QM)", cx, cy + cellSize * 0.3);
          }
        }
        else if (cell.type === 'soil' && !cell.crop) {
          if (isHovered && this.camera.zoom > 1.5) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `bold ${Math.max(4.5, cellSize * 0.26)}px "JetBrains Mono", monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText("SOW SEED", cx, cy - 1);
            this.ctx.fillStyle = this.selectedSeedType.color;
            this.ctx.fillText("(-15 QM)", cx, cy + cellSize * 0.3);
          }
        }
        else if (cell.type === 'seed' && cell.crop) {
          const seed = cell.crop;
          const isNative = seed.element.id === planet.preferredElement.id;

          if (cell.watered) {
            this.ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
            this.ctx.fillRect(cx - cellSize / 2, cy - cellSize / 2, cellSize, cellSize);
          }

          const height = (seed.progress / 100) * (cellSize * 0.5) + cellSize * 0.1;
          const midX = cx;
          const botY = cy + cellSize * 0.3;

          this.ctx.strokeStyle = seed.harvestReady ? '#00ff66' : seed.element.color;
          this.ctx.fillStyle = seed.harvestReady ? 'rgba(0, 255, 102, 0.22)' : 'rgba(3, 3, 6, 0.6)';
          this.ctx.lineWidth = seed.harvestReady ? 1.5 : 1.0;

          if (seed.progress < 45) {
            this.ctx.beginPath();
            this.ctx.moveTo(midX, botY);
            this.ctx.lineTo(midX, botY - height);
            this.ctx.stroke();
          } else {
            this.ctx.beginPath();
            this.ctx.moveTo(midX - cellSize * 0.2, botY);
            this.ctx.lineTo(midX, botY - height);
            this.ctx.lineTo(midX + cellSize * 0.2, botY);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            if (Math.random() < 0.05) {
              this.particles.push({
                x: midX + (Math.random() * cellSize * 0.3 - cellSize * 0.15),
                y: botY - height,
                vx: (Math.random() * 0.4 - 0.2),
                vy: -(0.3 + Math.random() * 0.5),
                color: seed.element.color,
                size: (0.8 + Math.random()) * scaleFactor,
                alpha: 1.0,
                age: 0,
                maxAge: 20 + Math.random() * 15
              });
            }
          }

          if (isNative) {
            this.ctx.fillStyle = seed.element.color;
            this.ctx.font = `bold ${Math.max(4, cellSize * 0.25)}px "JetBrains Mono", monospace`;
            this.ctx.textAlign = 'right';
            this.ctx.fillText("⚡", cx + cellSize * 0.4, cy - cellSize * 0.2);
          }

          if (isHovered && this.camera.zoom > 1.5) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `bold ${Math.max(4.5, cellSize * 0.24)}px "JetBrains Mono", monospace`;
            this.ctx.textAlign = 'center';
            if (seed.harvestReady) {
              this.ctx.fillStyle = 'var(--color-green)';
              this.ctx.fillText("HARVEST", midX, cy - cellSize * 0.1);
              this.ctx.fillStyle = '#fff';
              this.ctx.fillText(`+${seed.value}`, midX, cy + cellSize * 0.2);
            } else {
              this.ctx.fillText(`${Math.round(seed.progress)}%`, midX, cy - cellSize * 0.1);
              if (!cell.watered) {
                this.ctx.fillStyle = 'var(--color-cyan)';
                this.ctx.fillText("WATER", midX, cy + cellSize * 0.2);
              }
            }
          } else if (seed.harvestReady) {
            if (this.time % 20 < 10) {
              this.ctx.fillStyle = 'var(--color-green)';
              this.ctx.font = `bold ${Math.max(4.5, cellSize * 0.24)}px "JetBrains Mono", monospace`;
              this.ctx.textAlign = 'center';
              this.ctx.fillText("READY", midX, cy - cellSize * 0.15);
            }
          }
        }
      }
    }

    // 4. Render RimWorld-style pawn colonist avatar (always visually centered at sp.x, sp.y because projection is relative to it!)
    if (this.avatar) {
      const ax = sp.x;
      const ay = sp.y;
      const cellSize = (pr * 2.2) / 16;
      const bobOffset = Math.sin(this.avatar.bob) * (cellSize * 0.1);

      this.ctx.save();

      // Draw walking path line to clicked cell in curved projection
      if (this.avatar.targetX !== null && this.avatar.targetY !== null) {
        const dest = this.projectToScreen(this.avatar.targetX, this.avatar.targetY, planet, sp, pr);
        if (dest.visible) {
          this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
          this.ctx.lineWidth = 1.5;
          this.ctx.setLineDash([3, 2]);
          this.ctx.beginPath();
          this.ctx.moveTo(ax, ay);
          this.ctx.lineTo(dest.x, dest.y);
          this.ctx.stroke();
        }
      }

      this.ctx.translate(ax, ay + bobOffset);

      // Body pill/capsule
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = `hsl(${planet.hue}, ${planet.saturation}%, 60%)`;
      this.ctx.lineWidth = 1.8;
      this.ctx.beginPath();
      const avRadX = cellSize * 0.25;
      const avRadY = cellSize * 0.35;
      this.ctx.ellipse(0, 0, avRadX, avRadY, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Helmet visor
      this.ctx.fillStyle = '#0a0a0f';
      this.ctx.strokeStyle = '#00e5ff';
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.ellipse(0, -cellSize * 0.12, avRadX * 0.8, avRadY * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Visor light reflection dot
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(avRadX * 0.3, -cellSize * 0.16, 1.2, 0, Math.PI * 2);
      this.ctx.fill();

      // Name label tag
      if (this.camera.zoom > 1.8) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${Math.max(6, cellSize * 0.28)}px "Space Grotesk", sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.avatar.name, 0, -avRadY - 4);
      }

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  renderLandedFarmingView() {
    if (!this.activeLandedPlanet) return;
    const planet = this.activeLandedPlanet;

    // 1. Call standard continuous-zoom renderOrbitingView to draw cosmic background + star + high-res active grid centered on planet!
    this.renderOrbitingView();

    // 2. Render Landing Surface Header Banner in screenspace
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 229, 255, 0.02)';
    this.ctx.strokeStyle = `hsl(${planet.hue}, ${planet.saturation}%, 30%)`;
    this.ctx.lineWidth = 1.5;
    this.ctx.fillRect(30, 15, this.width - 60, 52);
    this.ctx.strokeRect(30, 15, this.width - 60, 52);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 15px "Space Grotesk", sans-serif';
    this.ctx.fillText(`${planet.name.toUpperCase()} SURFACE COLONY DECK`, 45, 36);

    const matchDiff = Math.abs(planet.vibrationFrequency - planet.resonancePeak);
    const perfectTuned = matchDiff < 0.2;
    const resonanceMultiplier = perfectTuned ? '300% (PERFECTLY TUNED!)' : (matchDiff < 1.5 ? `${Math.round((1.5 - matchDiff)/1.5 * 200 + 100)}%` : '25% (CRITICAL DRESS FRICTION)');

    this.ctx.fillStyle = 'var(--color-text-dim)';
    this.ctx.font = '8.5px "JetBrains Mono", monospace';
    this.ctx.fillText(`SOIL BIO-AFFINITY: ${planet.preferredElement.name.toUpperCase()}  |  ATMOSPHERIC SYNERGY GROWTH FACTOR: `, 45, 53);
    
    // Highlight multiplier
    this.ctx.fillStyle = perfectTuned ? '#00ff66' : (matchDiff < 1.5 ? 'var(--color-cyan)' : 'var(--color-red)');
    this.ctx.fillText(resonanceMultiplier, 445, 53);
    this.ctx.restore();

    // 6. Draw "SEED SYNTHESIS LAB" deck at the bottom
    const seedSelY = this.height - 110;
    const itemWidth = 105;
    const totalW = itemWidth * 6;
    const startX = (this.width - totalW) / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(3, 3, 6, 0.85)';
    this.ctx.strokeStyle = `hsl(${planet.hue}, ${planet.saturation}%, 25%)`;
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(startX - 10, seedSelY - 18, totalW + 20, 52);
    this.ctx.strokeRect(startX - 10, seedSelY - 18, totalW + 20, 52);

    this.ctx.fillStyle = 'var(--color-text-dim)';
    this.ctx.font = 'bold 7.5px "Space Grotesk", sans-serif';
    this.ctx.fillText("SEED GENERATOR LAB - SELECT CORES TO SYNTHESIZE ON EMPTY FIELD SOIL", startX - 4, seedSelY - 6);

    PLANET_ELEMENTS_CATALOG.forEach((el, index) => {
      const sx = startX + index * itemWidth;
      const isSelected = this.selectedSeedType.id === el.id;

      this.ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0, 0, 0, 0.3)';
      this.ctx.strokeStyle = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.1)';
      this.ctx.lineWidth = isSelected ? 1.5 : 1;
      this.ctx.fillRect(sx, seedSelY, itemWidth - 5, 28);
      this.ctx.strokeRect(sx, seedSelY, itemWidth - 5, 28);

      // Color dot
      this.ctx.fillStyle = el.color;
      this.ctx.beginPath();
      this.ctx.arc(sx + 10, seedSelY + 14, 4, 0, Math.PI * 2);
      this.ctx.fill();

      // Seed label
      this.ctx.fillStyle = isSelected ? '#ffffff' : '#888888';
      this.ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(el.seedName.toUpperCase(), sx + 20, seedSelY + 12);
      
      this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      this.ctx.font = '6.5px "JetBrains Mono", monospace';
      this.ctx.fillText(el.stat.toUpperCase(), sx + 20, seedSelY + 22);
    });
    this.ctx.restore();

    // 7. Draw side dashboard panel for Planet stats
    this.ctx.save();
    const lX = 30;
    const lY = 85;
    const lW = 200;
    const lH = 260;

    this.ctx.fillStyle = 'rgba(3, 3, 6, 0.8)';
    this.ctx.strokeStyle = `hsla(${planet.hue}, ${planet.saturation}%, 30%, 0.3)`;
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(lX, lY, lW, lH);
    this.ctx.strokeRect(lX, lY, lW, lH);

    // Planet profile Title
    this.ctx.fillStyle = `hsl(${planet.hue}, ${planet.saturation}%, 70%)`;
    this.ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    this.ctx.fillText(planet.name.toUpperCase(), lX + 12, lY + 22);

    this.ctx.fillStyle = 'var(--color-text-dim)';
    this.ctx.font = '7.5px "JetBrains Mono", monospace';
    this.ctx.fillText(`BIOME: ${planet.preferredElement.id.toUpperCase()}`, lX + 12, lY + 34);
    this.ctx.fillText(`RESONANCE: ${planet.resonancePeak.toFixed(1)} Hz`, lX + 12, lY + 44);
    this.ctx.fillText(`GROWTH YIELD: +15-40 ${planet.preferredElement.name.replace("Seed", "")}`, lX + 12, lY + 54);

    // Dynamic climate stats derived from star/zodiac properties
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 8px "Space Grotesk", sans-serif';
    this.ctx.fillText(`CLIMATE RECONNAISSANCE:`, lX + 12, lY + 70);
    this.ctx.fillStyle = 'var(--color-text-dim)';
    this.ctx.font = '7.5px "JetBrains Mono", monospace';
    this.ctx.fillText(`TEMPERATURE: ${planet.climate.temperature}°C`, lX + 12, lY + 82);
    this.ctx.fillText(`RAIN CYCLE: ${planet.climate.humidity}`, lX + 12, lY + 92);
    this.ctx.fillText(`GRAVITATION: ${planet.climate.weight} G`, lX + 12, lY + 102);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 8px "Space Grotesk", sans-serif';
    this.ctx.fillText(`BIOSPHERE SYMMETRIES:`, lX + 12, lY + 118);
    this.ctx.fillStyle = 'var(--color-text-dim)';
    this.ctx.font = '7.5px "JetBrains Mono", monospace';
    this.ctx.fillText(`FLORA: ${planet.climate.flora}`, lX + 12, lY + 130);
    this.ctx.fillText(`FAUNA: ${planet.climate.fauna}`, lX + 12, lY + 140);

    // Decorative wireframe planet profile vector circle
    this.ctx.strokeStyle = `hsla(${planet.hue}, ${planet.saturation}%, 55%, 0.25)`;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(lX + lW / 2, lY + 185, 25, 0, Math.PI * 2);
    this.ctx.stroke();

    // Stats counter
    let activeCropsCount = 0;
    let matureCropsCount = 0;
    planet.plantedSeeds.forEach(s => {
      activeCropsCount++;
      if (s.harvestReady) matureCropsCount++;
    });

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '8px "JetBrains Mono", monospace';
    this.ctx.fillText(`ACTIVE CROPS: ${activeCropsCount}`, lX + 12, lY + 225);
    this.ctx.fillText(`MATURE CORES: `, lX + 12, lY + 237);
    this.ctx.fillStyle = matureCropsCount > 0 ? '#00ff66' : '#888';
    this.ctx.fillText(`${matureCropsCount} Spires`, lX + 110, lY + 237);

    // Dynamic warning matching
    this.ctx.fillStyle = perfectTuned ? '#00ff66' : 'var(--color-text-dim)';
    this.ctx.font = '7.5px "JetBrains Mono", monospace';
    const alignStatus = perfectTuned ? "ATMOSPHERE LOCKED" : "ATMOSPHERE OUT OF TUNE";
    this.ctx.fillText(`TUNING: `, lX + 12, lY + 249);
    this.ctx.fillText(alignStatus, lX + 65, lY + 249);
    this.ctx.restore();

    // 8. Draw "LIFT OFF" button at bottom left
    this.ctx.save();
    const liftOffBtn = { x: 30, y: this.height - 55, w: 180, h: 32 };
    this.ctx.fillStyle = 'rgba(255, 51, 68, 0.08)';
    this.ctx.strokeStyle = 'var(--color-red)';
    this.ctx.lineWidth = 1.5;
    this.ctx.fillRect(liftOffBtn.x, liftOffBtn.y, liftOffBtn.w, liftOffBtn.h);
    this.ctx.strokeRect(liftOffBtn.x, liftOffBtn.y, liftOffBtn.w, liftOffBtn.h);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 9.5px "Space Grotesk", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText("🚀 LIFT OFF TO ORBIT [L]", liftOffBtn.x + liftOffBtn.w / 2, liftOffBtn.y + 20);
    this.ctx.restore();
  }

  checkPlanetClick(mx, my) {
    for (let i = 0; i < this.planets.length; i++) {
      const p = this.planets[i];
      const px = 2000 + Math.cos(p.angle) * p.orbitRadius;
      const py = 2000 + Math.sin(p.angle) * p.orbitRadius;
      const sp = this.worldToScreen(px, py);
      
      const dx = mx - sp.x;
      const dy = my - sp.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < p.radius * this.camera.zoom + 22) {
        return i;
      }
    }
    return -1;
  }
}
