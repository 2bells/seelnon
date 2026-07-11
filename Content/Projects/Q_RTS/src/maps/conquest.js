/**
 * Conquest.js (Rewrite)
 * High-performance, massive-scale RTS Conquest Battle Simulation.
 * Optimized to comfortably handle 2,000+ active units utilizing spatial bucket hashing,
 * fast line-of-sight raycasting to bypass A* pathfinding bottlenecks, and Level of Detail (LOD)
 * rendering techniques. Implements 3-stage Fog of War (undiscovered, unseen, seen).
 */

import { ProceduralMap } from './generator.js';
import { Pathfinder } from './pathfinder.js';

export class ConquestBattle {
  constructor(canvas, themeId = 'scifi', isSmallGrind = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.isSmallGrind = isSmallGrind;
    this.themeId = themeId;
    this.time = 0;

    // Load Procedural Map - randomized width & height aspect ratio (e.g. 9:16 to 16:9)
    const cellSize = 64;
    const colsCount = isSmallGrind ? (20 + Math.floor(Math.random() * 12)) : (38 + Math.floor(Math.random() * 26)); // small: 1280 to 1984, standard: 2432 to 4032
    const rowsCount = isSmallGrind ? (20 + Math.floor(Math.random() * 12)) : (38 + Math.floor(Math.random() * 26)); // small: 1280 to 1984, standard: 2432 to 4032
    const mapWidth = colsCount * cellSize;
    const mapHeight = rowsCount * cellSize;
    
    this.map = new ProceduralMap(themeId, mapWidth, mapHeight, cellSize);
    
    // Set up Pathfinder
    this.pathfinder = new Pathfinder(mapWidth, mapHeight, cellSize);
    this.syncPathfinderGrid();

    // Camera settings
    const halfX = mapWidth / 2;
    const halfY = mapHeight / 2;
    this.camera = {
      x: halfX - canvas.width / 2,
      y: halfY - canvas.height / 2,
      targetX: halfX - canvas.width / 2,
      targetY: halfY - canvas.height / 2,
      zoom: isSmallGrind ? 0.95 : 0.65
    };

    // RTS Resources
    this.battleOre = 400;
    this.gatheredElements = {
      earth: 0,
      air: 0,
      water: 0,
      metal: 0,
      soil: 0,
      symmetry: 0
    };
    
    // Entity structures
    this.playerUnits = [];
    this.enemyUnits = [];
    this.projectiles = [];
    this.explosions = [];

    // Objective & Status
    this.totalCamps = 0;
    this.clearedCamps = 0;
    this.conquestWon = false;
    this.conquestLost = false;

    // Selection marquee
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isDragging = false;

    // 3-Stage Fog of War offscreen canvas initialization with 1-cell border padding on all sides (+2 width and height)
    this.fowCanvas = document.createElement('canvas');
    this.fowCanvas.width = this.map.cols + 2;
    this.fowCanvas.height = this.map.rows + 2;
    this.fowContext = this.fowCanvas.getContext('2d');
    this.fowGrid = new Uint8Array(this.map.cols * this.map.rows);

    // High-performance Spatial Hashing Bucket Grid Setup
    this.gridCellSize = 120;
    this.spatialCols = Math.ceil(mapWidth / this.gridCellSize);
    this.spatialRows = Math.ceil(mapHeight / this.gridCellSize);
    this.spatialBuckets = new Array(this.spatialCols * this.spatialRows);
    for (let i = 0; i < this.spatialBuckets.length; i++) {
      this.spatialBuckets[i] = [];
    }

    // Populate Entities
    this.spawnLandedMothership();
    this.spawnStartingUnits();
    this.spawnCampsAndGuards();

    // Sync Fog of War structure
    this.syncFogOfWarExplored();
  }

  // Update pathfinder based on map layout
  syncPathfinderGrid() {
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        const blocked = this.map.isBlocked(c, r);
        this.pathfinder.setBlocked(c, r, blocked);
      }
    }
  }

  // Populate starting explored states
  syncFogOfWarExplored() {
    for (let i = 0; i < this.map.tiles.length; i++) {
      if (this.map.tiles[i].explored) {
        this.fowGrid[i] = 1; // Unseen/Explored Fog
      }
    }
  }

  // Land massive flagship Carrier in the center of the map
  spawnLandedMothership() {
    const halfX = this.map.width / 2;
    const halfY = this.map.height / 2;
    this.mothership = {
      x: halfX,
      y: halfY,
      radius: this.isSmallGrind ? 70 : 110,
      health: this.isSmallGrind ? 4000 : 8000,
      maxHealth: this.isSmallGrind ? 4000 : 8000,
      shield: this.isSmallGrind ? 1500 : 3000,
      maxShield: this.isSmallGrind ? 1500 : 3000,
      weaponCooldown: 0,
      weaponRange: this.isSmallGrind ? 260 : 360,
      damage: 40,
      type: 'mothership'
    };
  }

  spawnStartingUnits() {
    this.playerUnits = [];
    const halfX = this.map.width / 2;
    const halfY = this.map.height / 2;

    // Spawn miners/gatherers
    const numGatherers = this.isSmallGrind ? 4 : 6;
    for (let i = 0; i < numGatherers; i++) {
      const angle = (i * Math.PI * 2) / numGatherers;
      this.playerUnits.push({
        id: `gatherer-${i}`,
        type: 'gatherer',
        name: `AM-Scarab ${i + 1}`,
        x: halfX + Math.cos(angle) * (this.isSmallGrind ? 110 : 160),
        y: halfY + Math.sin(angle) * (this.isSmallGrind ? 110 : 160),
        radius: 10,
        speed: 2.8,
        health: 250,
        maxHealth: 250,
        miningState: 'idle',
        targetOre: null,
        cargo: 0,
        cargoMax: 40,
        angle: angle,
        path: []
      });
    }

    // Spawn Vanguard Raiders (Assault units)
    const numRaiders = this.isSmallGrind ? 5 : 12;
    for (let i = 0; i < numRaiders; i++) {
      this.playerUnits.push({
        id: `raider-${i}`,
        type: 'raider',
        name: `FT-Raider ${i + 1}`,
        x: halfX - 100 + (i % 4) * 40,
        y: halfY + 120 + Math.floor(i / 4) * 40,
        radius: 9,
        speed: 3.5,
        health: 120,
        maxHealth: 120,
        weaponRange: 160,
        weaponCooldown: 0,
        damage: 12,
        angle: -Math.PI / 2,
        path: [],
        target: null
      });
    }

    // Spawn Heavy Tanks
    const numTanks = this.isSmallGrind ? 1 : 4;
    for (let i = 0; i < numTanks; i++) {
      this.playerUnits.push({
        id: `tank-${i}`,
        type: 'tank',
        name: `DN-Goliath ${i + 1}`,
        x: halfX + 50 + (i % 2) * 60,
        y: halfY + 150 + Math.floor(i / 2) * 50,
        radius: 15,
        speed: 2.0,
        health: 450,
        maxHealth: 450,
        weaponRange: 240,
        weaponCooldown: 0,
        damage: 45,
        angle: -Math.PI / 2,
        path: [],
        target: null
      });
    }
  }

  // Set up camps and structures
  spawnCampsAndGuards() {
    this.enemyUnits = [];
    const camps = this.map.resources.filter(r => r.type === 'camp');
    this.totalCamps = camps.length;
    this.clearedCamps = 0;

    camps.forEach((camp, index) => {
      if (!camp || typeof camp.x !== 'number' || typeof camp.y !== 'number' || isNaN(camp.x) || isNaN(camp.y)) {
        return;
      }

      // Spawn static Command Citadel structure
      this.enemyUnits.push({
        id: `camp-citadel-${index}`,
        type: 'citadel',
        name: `Hostile Citadel ${index + 1}`,
        x: camp.x,
        y: camp.y,
        radius: 35,
        health: 2200,
        maxHealth: 2200,
        campRef: camp,
        weaponRange: 220,
        weaponCooldown: 0,
        damage: 30,
        angle: 0,
        speed: 0
      });

      // Spawn 2 flanking defensive turrets
      for (let t = 0; t < 2; t++) {
        const angle = t * Math.PI + (index * 0.5);
        this.enemyUnits.push({
          id: `camp-turret-${index}-${t}`,
          type: 'turret',
          name: `Defensive Turret`,
          x: camp.x + Math.cos(angle) * 75,
          y: camp.y + Math.sin(angle) * 75,
          radius: 16,
          health: 800,
          maxHealth: 800,
          weaponRange: 250,
          weaponCooldown: 0,
          damage: 22,
          angle: angle,
          speed: 0
        });
      }

      // Spawn 5 patrolling guards around the camp
      for (let g = 0; g < 5; g++) {
        const offsetAngle = (g * Math.PI * 2) / 5;
        this.enemyUnits.push({
          id: `camp-guard-${index}-${g}`,
          type: 'crawler',
          name: 'Void Crawler',
          x: camp.x + Math.cos(offsetAngle) * 110,
          y: camp.y + Math.sin(offsetAngle) * 110,
          radius: 10,
          speed: 2.2,
          health: 150,
          maxHealth: 150,
          weaponRange: 130,
          weaponCooldown: 0,
          damage: 15,
          angle: offsetAngle,
          campX: camp.x,
          campY: camp.y,
          path: [],
          target: null
        });
      }
    });
  }

  // Spatial Hashing Grid Managers
  clearSpatialGrid() {
    for (let i = 0; i < this.spatialBuckets.length; i++) {
      this.spatialBuckets[i].length = 0;
    }
  }

  populateSpatialGrid() {
    this.clearSpatialGrid();
    const list = this.playerUnits.concat(this.enemyUnits);
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (isNaN(u.x) || isNaN(u.y)) continue;
      const col = Math.max(0, Math.min(this.spatialCols - 1, Math.floor(u.x / this.gridCellSize)));
      const row = Math.max(0, Math.min(this.spatialRows - 1, Math.floor(u.y / this.gridCellSize)));
      const idx = row * this.spatialCols + col;
      this.spatialBuckets[idx].push(u);
    }
  }

  getNearbyUnits(x, y, radius) {
    const col = Math.floor(x / this.gridCellSize);
    const row = Math.floor(y / this.gridCellSize);
    const nearby = [];
    const r2 = radius * radius;
    
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nc < this.spatialCols && nr >= 0 && nr < this.spatialRows) {
          const bucket = this.spatialBuckets[nr * this.spatialCols + nc];
          for (let i = 0; i < bucket.length; i++) {
            const u = bucket[i];
            const dx = u.x - x;
            const dy = u.y - y;
            if (dx * dx + dy * dy < r2) {
              nearby.push(u);
            }
          }
        }
      }
    }
    return nearby;
  }

  // Fast Line of Sight raycast (Bresenham)
  hasLineOfSight(x1, y1, x2, y2) {
    const c1 = Math.floor(x1 / this.map.cellSize);
    const r1 = Math.floor(y1 / this.map.cellSize);
    const c2 = Math.floor(x2 / this.map.cellSize);
    const r2 = Math.floor(y2 / this.map.cellSize);
    
    const dc = Math.abs(c2 - c1);
    const dr = Math.abs(r2 - r1);
    const sc = (c1 < c2) ? 1 : -1;
    const sr = (r1 < r2) ? 1 : -1;
    let err = dc - dr;
    
    let c = c1;
    let r = r1;
    
    const maxSteps = 40; // limit safety
    let steps = 0;
    while (steps < maxSteps) {
      if (this.map.isBlocked(c, r)) return false;
      if (c === c2 && r === r2) break;
      const e2 = 2 * err;
      if (e2 > -dr) {
        err -= dr;
        c += sc;
      }
      if (e2 < dc) {
        err += dc;
        r += sr;
      }
      steps++;
    }
    return true;
  }

  // Ship fabrication yard queue
  queueUnit(type) {
    const costs = { raider: 35, tank: 90, gunship: 140 };
    const cost = costs[type];

    // Check if we can deploy from our base's standing army first!
    if (window.mothershipBase && window.mothershipBase.standingArmy) {
      const reserves = window.mothershipBase.standingArmy[type] || 0;
      if (reserves <= 0) {
        window.appendLog(`❌ STANDING_ARMY_DEPLOY: No [${type.toUpperCase()}] units remaining in base reserves! Route assembled chassis to the Central Portal inside Mothership first.`);
        return;
      }

      // Deduct from reserves
      window.mothershipBase.standingArmy[type]--;
      window.appendLog(`🛸 STANDING_ARMY_DEPLOY: Warping in 1 [${type.toUpperCase()}] instantly from Mothership standing reserves! (0 Alloy cost)`);

      // Spawn instantly
      const halfX = this.map.width / 2;
      const halfY = this.map.height / 2;
      const angle = Math.random() * Math.PI * 2;
      const dist = this.mothership ? this.mothership.radius + 30 : 120;
      const rx = halfX + Math.cos(angle) * dist;
      const ry = halfY + Math.sin(angle) * dist;

      const uData = {
        id: `${type}-${Date.now()}-${Math.random()}`,
        type: type,
        name: type === 'raider' ? 'FT-Raider' : type === 'tank' ? 'DN-Goliath' : 'RV-Reaver',
        x: rx,
        y: ry,
        radius: type === 'raider' ? 9 : type === 'tank' ? 15 : 12,
        speed: type === 'raider' ? 3.5 : type === 'tank' ? 2.0 : 4.0,
        health: type === 'raider' ? 120 : type === 'tank' ? 450 : 220,
        maxHealth: type === 'raider' ? 120 : type === 'tank' ? 450 : 220,
        weaponRange: type === 'raider' ? 160 : type === 'tank' ? 240 : 180,
        weaponCooldown: 0,
        damage: type === 'raider' ? 12 : type === 'tank' ? 45 : 20,
        angle: angle,
        path: [],
        target: null
      };

      this.playerUnits.push(uData);

      // Trigger visual warp splash in the conquest battle
      if (this.explosions) {
        for (let i = 0; i < 15; i++) {
          const pAngle = Math.random() * Math.PI * 2;
          const pSpeed = 1 + Math.random() * 3;
          this.explosions.push({
            x: rx,
            y: ry,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            color: type === 'raider' ? '#00ff66' : type === 'tank' ? '#ffb300' : '#ff33ff',
            radius: 2 + Math.random() * 3,
            alpha: 1.0,
            age: 0,
            maxAge: 20 + Math.random() * 20
          });
        }
      }

      // Sync and save
      window.mothershipBase.updateUiDisplay();
      if (window.saveGame) window.saveGame();
      return;
    }

    if (this.battleOre < cost) {
      window.appendLog(`❌ SHIPYARD_QUEUE: Insufficient battle ore. Need ${cost} Alloy.`);
      return;
    }

    this.battleOre -= cost;
    window.appendLog(`🏭 FABRICATING: Manufacturing [${type.toUpperCase()}] unit at landed Mothership bays.`);

    setTimeout(() => {
      const halfSize = this.isSmallGrind ? 800 : 1600;
      const angle = Math.random() * Math.PI * 2;
      const rx = halfSize + Math.cos(angle) * (this.isSmallGrind ? 100 : 170);
      const ry = halfSize + Math.sin(angle) * (this.isSmallGrind ? 100 : 170);

      const uData = {
        id: `${type}-${Date.now()}-${Math.random()}`,
        type: type,
        name: type === 'raider' ? 'FT-Raider' : type === 'tank' ? 'DN-Goliath' : 'RV-Reaver',
        x: rx,
        y: ry,
        radius: type === 'raider' ? 9 : type === 'tank' ? 15 : 12,
        speed: type === 'raider' ? 3.5 : type === 'tank' ? 2.0 : 4.0,
        health: type === 'raider' ? 120 : type === 'tank' ? 450 : 220,
        maxHealth: type === 'raider' ? 120 : type === 'tank' ? 450 : 220,
        weaponRange: type === 'raider' ? 160 : type === 'tank' ? 240 : 180,
        weaponCooldown: 0,
        damage: type === 'raider' ? 12 : type === 'tank' ? 45 : 20,
        angle: angle,
        path: [],
        target: null
      };

      this.playerUnits.push(uData);
      window.appendLog(`🟢 DEPLOYED: New [${uData.name.toUpperCase()}] squad auxiliary unit joined battle field!`);
    }, 1200);
  }

  orderMovement(worldX, worldY) {
    const selected = this.playerUnits.filter(u => u.selected);
    if (selected.length === 0) return;

    let clickedOre = null;
    this.map.resources.forEach(res => {
      if (res.type === 'deposit') {
        const dx = res.x - worldX;
        const dy = res.y - worldY;
        if (Math.sqrt(dx * dx + dy * dy) < 40) clickedOre = res;
      }
    });

    selected.forEach((u, index) => {
      if (u.type === 'gatherer' && clickedOre) {
        u.targetOre = clickedOre;
        u.miningState = 'moving_to_ore';
        
        // Raycast first to avoid A* pathfinding processing when clear!
        if (this.hasLineOfSight(u.x, u.y, clickedOre.x, clickedOre.y)) {
          u.path = [{ x: clickedOre.x, y: clickedOre.y }];
        } else {
          u.path = this.pathfinder.findPath(u.x, u.y, clickedOre.x, clickedOre.y);
        }
        window.appendLog(`⛏️ HARVESTER: Ordered ${u.name} to mine resource deposit [${clickedOre.name}].`);
      } else {
        const offsetX = (index % 5 - 2) * 20;
        const offsetY = (Math.floor(index / 5) - 1.5) * 20;
        const tx = worldX + offsetX;
        const ty = worldY + offsetY;
        u.target = null;

        if (this.hasLineOfSight(u.x, u.y, tx, ty)) {
          u.path = [{ x: tx, y: ty }];
        } else {
          u.path = this.pathfinder.findPath(u.x, u.y, tx, ty);
        }
      }
    });

    // Waypoint visual indicator
    window.sim?.waypoints.push({
      id: `conquest-wp-${Date.now()}`,
      x: worldX,
      y: worldY,
      radius: 8,
      alpha: 1.0,
      color: '#00ff66'
    });
  }

  handleDragSelection(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    let count = 0;
    this.playerUnits.forEach(u => {
      if (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
        u.selected = true;
        count++;
      } else {
        u.selected = false;
      }
    });

    if (count > 0) {
      window.appendLog(`Selected ${count} squad units for battle formation.`);
    }
  }

  // Three-stage Fog of War manager
  updateFogOfWar() {
    const cols = this.map.cols;
    const rows = this.map.rows;
    
    // Set all Seen (2) back to Unseen/Explored (1)
    for (let i = 0; i < this.fowGrid.length; i++) {
      if (this.fowGrid[i] === 2) {
        this.fowGrid[i] = 1;
      }
    }

    // Mothership massive active radar scanning field
    const mCellC = Math.floor(this.mothership.x / this.map.cellSize);
    const mCellR = Math.floor(this.mothership.y / this.map.cellSize);
    const mRad = this.isSmallGrind ? 6 : 9;
    this.markFowCircle(mCellC, mCellR, mRad);

    // Player Units active field
    for (let i = 0; i < this.playerUnits.length; i++) {
      const u = this.playerUnits[i];
      const uc = Math.floor(u.x / this.map.cellSize);
      const ur = Math.floor(u.y / this.map.cellSize);
      const uRad = u.type === 'tank' ? 4 : u.type === 'raider' ? 3 : 2;
      this.markFowCircle(uc, ur, uRad);
    }

    // Refresh the interpolation offscreen texture
    this.updateFowCanvas();
  }

  markFowCircle(centerCol, centerRow, radius) {
    const cols = this.map.cols;
    const rows = this.map.rows;
    const r2 = radius * radius;

    const minC = Math.max(0, centerCol - radius);
    const maxC = Math.min(cols - 1, centerCol + radius);
    const minR = Math.max(0, centerRow - radius);
    const maxR = Math.min(rows - 1, centerRow + radius);

    for (let r = minR; r <= maxR; r++) {
      const dr = r - centerRow;
      for (let c = minC; c <= maxC; c++) {
        const dc = c - centerCol;
        if (dc * dc + dr * dr <= r2) {
          const idx = r * cols + c;
          this.fowGrid[idx] = 2; // Active seen!
          this.map.tiles[idx].explored = true;
        }
      }
    }
  }

  updateFowCanvas() {
    const cols = this.map.cols;
    const rows = this.map.rows;
    const fctx = this.fowContext;
    
    const imgData = fctx.createImageData(cols + 2, rows + 2);
    const data = imgData.data;

    // Fill entirely with pitch black undiscovered state by default (Stage 0)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 1;     // Red
      data[i + 1] = 2; // Green
      data[i + 2] = 4; // Blue
      data[i + 3] = 255; // Alpha
    }

    // Overlay inside cells matching fowGrid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gridIdx = r * cols + c;
        const state = this.fowGrid[gridIdx];
        const destIdx = ((r + 1) * (cols + 2) + (c + 1)) * 4;

        if (state === 0) {
          // Stage 0: Undiscovered - pitch black
          data[destIdx] = 1;
          data[destIdx + 1] = 2;
          data[destIdx + 2] = 4;
          data[destIdx + 3] = 255;
        } else if (state === 1) {
          // Stage 1: Explored but Unseen (Shadowed Fog of War)
          data[destIdx] = 1;
          data[destIdx + 1] = 2;
          data[destIdx + 2] = 4;
          data[destIdx + 3] = 195; // 76% Alpha
        } else {
          // Stage 2: Currently Seen - crystal transparent
          data[destIdx] = 0;
          data[destIdx + 1] = 0;
          data[destIdx + 2] = 0;
          data[destIdx + 3] = 0;
        }
      }
    }

    fctx.putImageData(imgData, 0, 0);
  }

  isPositionInVision(x, y) {
    const col = Math.floor(x / this.map.cellSize);
    const row = Math.floor(y / this.map.cellSize);
    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) return false;
    return this.fowGrid[row * this.map.cols + col] === 2;
  }

  // Update Core loop
  tick() {
    this.time += 0.016;

    // Smooth Camera interpolation
    const ease = 0.08;
    this.camera.x += (this.camera.targetX - this.camera.x) * ease;
    this.camera.y += (this.camera.targetY - this.camera.y) * ease;

    // Rebuild Spatial Grid every frame (super fast O(N) execution)
    this.populateSpatialGrid();

    // Refresh Fog of War statuses
    this.updateFogOfWar();

    // 1. Process Player units
    const halfX = this.map.width / 2;
    const halfY = this.map.height / 2;
    const mapW = this.map.width;
    const mapH = this.map.height;
    const margin = 40;

    this.playerUnits.forEach(u => {
      // Regenerate near Mothership
      if (u.health < u.maxHealth) {
        const dx = u.x - halfX;
        const dy = u.y - halfY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < (this.isSmallGrind ? 180 : 300)) {
          u.health = Math.min(u.maxHealth, u.health + 0.12);
        }
      }

      // Gatherer harvesting loop
      if (u.type === 'gatherer') {
        this.updateGathererAI(u);
      } else {
        this.updateCombatAI(u, this.enemyUnits);
      }

      // Physics, movement and collision separation
      this.moveAlongPath(u);
      this.applySeparation(u);

      // Block boundary sliding constraints
      if (u.x < margin || u.x > mapW - margin || u.y < margin || u.y > mapH - margin) {
        u.x = Math.max(margin, Math.min(mapW - margin, u.x));
        u.y = Math.max(margin, Math.min(mapH - margin, u.y));
        u.path = [];
      }
    });

    // 2. Process Enemy units
    this.enemyUnits.forEach(e => {
      // Static structures (Citadels & Turrets) do not move
      if (e.speed > 0) {
        this.moveAlongPath(e);
        this.applySeparation(e);
      }

      this.updateCombatAI(e, this.playerUnits.concat([this.mothership]));

      // Keep inside bounds
      if (e.x < margin || e.x > mapW - margin || e.y < margin || e.y > mapH - margin) {
        e.x = Math.max(margin, Math.min(mapW - margin, e.x));
        e.y = Math.max(margin, Math.min(mapH - margin, e.y));
        e.path = [];
      }

      // Periodic spawn of defense void crawlers from Active Citadels
      if (e.type === 'citadel') {
        e.weaponCooldown = (e.weaponCooldown || 0) + 1;
        if (e.weaponCooldown > 360) {
          e.weaponCooldown = 0;
          
          // count crawlers belonging to this citadel
          const guardCount = this.enemyUnits.filter(u => u.type === 'crawler' && u.campX === e.campRef.x).length;
          if (guardCount < 8) {
            const angle = Math.random() * Math.PI * 2;
            this.enemyUnits.push({
              id: `guard-spawn-${Date.now()}-${Math.random()}`,
              type: 'crawler',
              name: 'Void Interceptor',
              x: e.x + Math.cos(angle) * 75,
              y: e.y + Math.sin(angle) * 75,
              radius: 10,
              speed: 2.5,
              health: 150,
              maxHealth: 150,
              weaponRange: 130,
              weaponCooldown: 0,
              damage: 15,
              angle: angle,
              campX: e.campRef.x,
              campY: e.campRef.y,
              path: [],
              target: null
            });
          }
        }
      }
    });

    // 3. Process Projectiles
    this.projectiles.forEach(p => {
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life--;

      // Precise collision checks
      if (p.isPlayer) {
        // Query nearby enemy targets spatial bucket instantly!
        const targets = this.getNearbyUnits(p.x, p.y, 24);
        for (let i = 0; i < targets.length; i++) {
          const e = targets[i];
          if (this.enemyUnits.includes(e) && e.health > 0) {
            const dx = e.x - p.x;
            const dy = e.y - p.y;
            if (dx * dx + dy * dy < (e.radius + 4) * (e.radius + 4)) {
              e.health -= p.damage;
              p.active = false;
              this.spawnParticleExplosion(p.x, p.y, p.color, 6);
              break;
            }
          }
        }
      } else {
        // Target player units or Landed flagship
        const targets = this.getNearbyUnits(p.x, p.y, 24).filter(u => this.playerUnits.includes(u));
        
        // Check central mothership always
        const mdx = this.mothership.x - p.x;
        const mdy = this.mothership.y - p.y;
        if (mdx * mdx + mdy * mdy < (this.mothership.radius + 4) * (this.mothership.radius + 4)) {
          if (this.mothership.shield > 0) {
            this.mothership.shield = Math.max(0, this.mothership.shield - p.damage);
          } else {
            this.mothership.health = Math.max(0, this.mothership.health - p.damage);
          }
          p.active = false;
          this.spawnParticleExplosion(p.x, p.y, '#ff3344', 6);
        }

        if (p.active) {
          for (let i = 0; i < targets.length; i++) {
            const u = targets[i];
            const dx = u.x - p.x;
            const dy = u.y - p.y;
            if (dx * dx + dy * dy < (u.radius + 4) * (u.radius + 4)) {
              u.health -= p.damage;
              p.active = false;
              this.spawnParticleExplosion(p.x, p.y, '#ff3344', 6);
              break;
            }
          }
        }
      }
    });

    this.projectiles = this.projectiles.filter(p => p.active && p.life > 0);

    // Filtering dead player elements
    this.playerUnits = this.playerUnits.filter(u => {
      if (isNaN(u.health) || u.health <= 0) {
        this.spawnParticleExplosion(u.x, u.y, '#00ffff', 18);
        return false;
      }
      return true;
    });

    // Filtering dead hostile units (Citadel structures destruction secure)
    this.enemyUnits = this.enemyUnits.filter(e => {
      if (isNaN(e.health) || e.health <= 0) {
        this.spawnParticleExplosion(e.x, e.y, '#ff3344', 35);

        if (e.type === 'citadel' && e.campRef) {
          e.campRef.cleared = true;
          this.clearedCamps++;
          window.appendLog(`🏆 CAMP_SECURED: Successfully destroyed hostile Citadel at sector coordinates [${Math.round(e.x)}, ${Math.round(e.y)}]. Progress: ${this.clearedCamps}/${this.totalCamps}`);

          if (this.clearedCamps >= this.totalCamps) {
            this.conquestWon = true;
            window.appendLog("⚜️ VICTORY: All planetary core camps secured! High frequency resource drop unlocked! Collect Relics from mothership panel.");
          }
        }
        return false;
      }
      return true;
    });

    // Shields regen
    if (this.mothership.shield < this.mothership.maxShield) {
      this.mothership.shield += 0.4;
    }

    // Flagship lost condition
    if (this.mothership.health <= 0 && !this.conquestLost) {
      this.conquestLost = true;
      this.spawnParticleExplosion(this.mothership.x, this.mothership.y, '#00ffff', 100);
      window.appendLog("💀 DEFEAT: Player Landed Mothership has been completely destroyed! Sector Conquest has failed.");
    }

    // Tick Explosions
    this.explosions.forEach(exp => {
      exp.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.035;
      });
      exp.particles = exp.particles.filter(p => p.alpha > 0);
    });
    this.explosions = this.explosions.filter(exp => exp.particles.length > 0);
  }

  // Local physical separation and block-tile avoidance
  applySeparation(u) {
    const radius = u.radius;
    const neighbors = this.getNearbyUnits(u.x, u.y, radius * 2.5);
    
    let forceX = 0;
    let forceY = 0;
    let count = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const other = neighbors[i];
      if (other === u) continue;

      const dx = u.x - other.x;
      const dy = u.y - other.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const minDist = radius + other.radius + 1.5;

      if (d < minDist) {
        const overlap = minDist - d;
        const angle = d > 0.1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
        forceX += Math.cos(angle) * overlap * 0.35;
        forceY += Math.sin(angle) * overlap * 0.35;
        count++;
      }
    }

    if (count > 0) {
      const targetX = u.x + (forceX / count);
      const targetY = u.y + (forceY / count);

      // Slide organically along obstacles
      const targetC = Math.floor(targetX / this.map.cellSize);
      const targetR = Math.floor(targetY / this.map.cellSize);

      if (!this.map.isBlocked(targetC, targetR)) {
        u.x = targetX;
        u.y = targetY;
      } else {
        const slideColX = Math.floor(targetX / this.map.cellSize);
        const slideRowY = Math.floor(u.y / this.map.cellSize);
        if (!this.map.isBlocked(slideColX, slideRowY)) {
          u.x = targetX;
        } else {
          const slideColY = Math.floor(u.x / this.map.cellSize);
          const slideRowX = Math.floor(targetY / this.map.cellSize);
          if (!this.map.isBlocked(slideColY, slideRowX)) {
            u.y = targetY;
          }
        }
      }
    }
  }

  // Move directly or step-wise along path nodes
  moveAlongPath(u) {
    if (!u.path || u.path.length === 0) return;

    const targetNode = u.path[0];
    const dx = targetNode.x - u.x;
    const dy = targetNode.y - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 14) {
      u.path.shift();
    } else {
      u.angle = Math.atan2(dy, dx);
      const nextX = u.x + Math.cos(u.angle) * u.speed;
      const nextY = u.y + Math.sin(u.angle) * u.speed;

      // Obstacle boundary collision checks
      const nextC = Math.floor(nextX / this.map.cellSize);
      const nextR = Math.floor(nextY / this.map.cellSize);

      if (!this.map.isBlocked(nextC, nextR)) {
        u.x = nextX;
        u.y = nextY;
      } else {
        // Clear path and trigger slide/avoidance instead of getting stuck
        u.path = [];
      }
    }
  }

  // Mineral collector routines
  updateGathererAI(u) {
    const halfX = this.map.width / 2;
    const halfY = this.map.height / 2;

    if (u.miningState === 'idle') {
      let nearest = null;
      let minDist = Infinity;
      this.map.resources.forEach(res => {
        if (res.type === 'deposit' && res.amount > 0) {
          const dx = res.x - u.x;
          const dy = res.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearest = res;
          }
        }
      });

      if (nearest) {
        u.targetOre = nearest;
        u.miningState = 'moving_to_ore';
        if (this.hasLineOfSight(u.x, u.y, nearest.x, nearest.y)) {
          u.path = [{ x: nearest.x, y: nearest.y }];
        } else {
          u.path = this.pathfinder.findPath(u.x, u.y, nearest.x, nearest.y);
        }
      }
    } 
    else if (u.miningState === 'moving_to_ore') {
      if (!u.targetOre || u.targetOre.amount <= 0) {
        u.miningState = 'idle';
        u.targetOre = null;
        return;
      }

      const dx = u.targetOre.x - u.x;
      const dy = u.targetOre.y - u.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d < u.targetOre.radius + 18 || !u.path || u.path.length === 0) {
        u.miningState = 'mining';
        u.miningTimer = 80;
      }
    } 
    else if (u.miningState === 'mining') {
      if (!u.targetOre || u.targetOre.amount <= 0) {
        u.miningState = 'returning';
        u.path = this.pathfinder.findPath(u.x, u.y, halfX, halfY);
        return;
      }

      u.miningTimer--;
      if (Math.random() < 0.28) {
        this.spawnParticleExplosion(u.x + (Math.random() - 0.5) * 10, u.y + (Math.random() - 0.5) * 10, u.targetOre.color, 3);
      }

      if (u.miningTimer <= 0) {
        u.cargo = u.cargoMax;
        u.targetOre.amount = Math.max(0, u.targetOre.amount - u.cargoMax);
        u.miningState = 'returning';
        
        if (this.hasLineOfSight(u.x, u.y, halfX, halfY)) {
          u.path = [{ x: halfX, y: halfY }];
        } else {
          u.path = this.pathfinder.findPath(u.x, u.y, halfX, halfY);
        }
      }
    } 
    else if (u.miningState === 'returning') {
      const dx = halfX - u.x;
      const dy = halfY - u.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d < 125 || !u.path || u.path.length === 0) {
        this.battleOre += u.cargo;

        if (u.cargo > 0 && Math.random() < 0.38) {
          const els = ['earth', 'air', 'water', 'metal', 'soil'];
          const choice = els[Math.floor(Math.random() * els.length)];
          this.gatheredElements[choice] += 1;

          let gotSymmetry = false;
          if (Math.random() < 0.16) {
            this.gatheredElements.symmetry += 1;
            gotSymmetry = true;
          }

          const msg = gotSymmetry
            ? `✨ SECURED CRYSTAL: Harvester refined rare [SYMMETRY CRYSTAL] (+1 ${choice.toUpperCase()}).`
            : `⛏️ SECURED ELEMENT: Harvester refined surface element: (+1 ${choice.toUpperCase()}).`;
          window.appendLog(msg);
        }

        u.cargo = 0;
        u.miningState = 'idle';
      }
    }
  }

  // Active units targeting and combat routines
  updateCombatAI(u, list) {
    u.weaponCooldown = Math.max(0, u.weaponCooldown - 1);

    if (u.target) {
      if (u.target.health <= 0) {
        u.target = null;
      } else {
        const dx = u.target.x - u.x;
        const dy = u.target.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const inVision = this.isTargetScanned(u, u.target);

        if (dist > u.weaponRange * 1.55 || !inVision) {
          u.target = null;
        } else {
          u.angle = Math.atan2(dy, dx);

          if (dist <= u.weaponRange) {
            u.path = [];
            if (u.weaponCooldown === 0) {
              u.weaponCooldown = u.type === 'tank' ? 75 : 32;
              this.fireWeapon(u, u.target);
            }
          } else if (!u.path || u.path.length === 0) {
            if (this.hasLineOfSight(u.x, u.y, u.target.x, u.target.y)) {
              u.path = [{ x: u.target.x, y: u.target.y }];
            } else {
              u.path = this.pathfinder.findPath(u.x, u.y, u.target.x, u.target.y);
            }
          }
        }
      }
    }

    if (!u.target) {
      const searchRange = u.weaponRange * 1.25;
      const localTargets = this.getNearbyUnits(u.x, u.y, searchRange);
      let nearest = null;
      let minDist = searchRange;

      const isPlayerUnit = this.playerUnits.includes(u) || u === this.mothership;

      for (let i = 0; i < localTargets.length; i++) {
        const other = localTargets[i];
        if (other.health <= 0) continue;

        const isEnemy = isPlayerUnit 
          ? this.enemyUnits.includes(other) 
          : (this.playerUnits.includes(other) || other === this.mothership);

        if (isEnemy && this.isTargetScanned(u, other)) {
          const dx = other.x - u.x;
          const dy = other.y - u.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist) {
            minDist = d;
            nearest = other;
          }
        }
      }

      if (nearest) {
        u.target = nearest;
      } else if (u.type === 'crawler' && u.campX) {
        // Return to patrol around home camp coordinates
        const cdx = u.campX - u.x;
        const cdy = u.campY - u.y;
        if (cdx * cdx + cdy * cdy > 130 * 130 && (!u.path || u.path.length === 0)) {
          u.path = [{ x: u.campX + (Math.random() - 0.5) * 50, y: u.campY + (Math.random() - 0.5) * 50 }];
        }
      }
    }
  }

  isTargetScanned(scannerUnit, targetUnit) {
    const isPlayer = this.playerUnits.includes(scannerUnit) || scannerUnit === this.mothership;
    if (isPlayer) {
      // Player units can only lock-on if target is in seen/active visual stage
      const cc = Math.floor(targetUnit.x / this.map.cellSize);
      const cr = Math.floor(targetUnit.y / this.map.cellSize);
      const idx = cr * this.map.cols + cc;
      return this.fowGrid[idx] === 2;
    }
    // Hostiles can target players entering scanner range
    return true;
  }

  fireWeapon(u, target) {
    const angle = Math.atan2(target.y - u.y, target.x - u.x);
    const isPlayer = this.playerUnits.includes(u) || u === this.mothership;
    const color = isPlayer ? '#00e5ff' : '#ff3344';

    this.projectiles.push({
      x: u.x + Math.cos(angle) * (u.radius + 4),
      y: u.y + Math.sin(angle) * (u.radius + 4),
      angle: angle,
      speed: u.type === 'tank' ? 7.5 : 10.5,
      damage: u.damage || 15,
      life: 75,
      active: true,
      color: color,
      isPlayer: isPlayer
    });
  }

  spawnParticleExplosion(x, y, color, count = 10) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 3.5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        size: 1.5 + Math.random() * 2.5
      });
    }
    this.explosions.push({ particles, color });
  }

  render() {
    this.ctx.fillStyle = '#010204';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const w = this.canvas.width;
    const h = this.canvas.height;
    const zoom = this.camera.zoom;

    this.ctx.save();
    this.ctx.translate(w / 2, h / 2);
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-this.camera.x - w/2, -this.camera.y - h/2);

    // Render subtle decorative stars under map grid
    this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.015)';
    this.ctx.lineWidth = 1;
    const gStep = 100;
    const sX = Math.floor((this.camera.x - w) / gStep) * gStep;
    const eX = Math.ceil((this.camera.x + w * 2) / gStep) * gStep;
    const sY = Math.floor((this.camera.y - h) / gStep) * gStep;
    const eY = Math.ceil((this.camera.y + h * 2) / gStep) * gStep;
    for (let x = sX; x <= eX; x += gStep) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, sY);
      this.ctx.lineTo(x, eY);
      this.ctx.stroke();
    }
    for (let y = sY; y <= eY; y += gStep) {
      this.ctx.beginPath();
      this.ctx.moveTo(sX, y);
      this.ctx.lineTo(eX, y);
      this.ctx.stroke();
    }

    // 1. Draw cached map background instantly in 1 draw call! (No performance overhead)
    this.ctx.imageSmoothingEnabled = false; // keeps map pixel art beautifully sharp
    this.ctx.drawImage(this.map.mapCanvas, 0, 0);

    const isLowLOD = zoom < 0.45; // Level of Detail Optimization Threshold

    // 2. Draw active mineral veins (Only if inside active vision stage)
    this.map.resources.forEach(res => {
      if (res.type === 'deposit') {
        if (res.amount <= 0) return;
        if (!this.isPositionInVision(res.x, res.y)) return;

        this.ctx.fillStyle = res.color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(res.x, res.y, isLowLOD ? 5 : 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
    });

    // 3. Draw flagship mothership
    const ms = this.mothership;
    this.ctx.save();
    this.ctx.translate(ms.x, ms.y);
    this.ctx.rotate(this.time * 0.04);

    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.lineWidth = isLowLOD ? 2 : 4;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, ms.radius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    this.ctx.lineWidth = isLowLOD ? 8 : 18;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, ms.radius - 12, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.fillStyle = '#0d1821';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, ms.radius - 22, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();

    // Health / Shield indicators
    if (ms.shield > 0) {
      this.ctx.strokeStyle = `rgba(0, 229, 255, ${0.12 + 0.08 * Math.sin(this.time * 4)})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(ms.x, ms.y, ms.radius + 15, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    if (!isLowLOD) {
      const barW = 160;
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(ms.x - barW/2, ms.y - ms.radius - 20, barW, 4);
      this.ctx.fillStyle = '#00ff66';
      this.ctx.fillRect(ms.x - barW/2, ms.y - ms.radius - 20, barW * (ms.health / ms.maxHealth), 4);
    }

    // 4. Draw Player Units
    this.playerUnits.forEach(u => {
      // Viewport culling to completely skip offscreen units
      const screenX = w/2 + (u.x - this.camera.x - w/2) * zoom;
      const screenY = h/2 + (u.y - this.camera.y - h/2) * zoom;
      const marginBuff = 40;
      if (screenX < -marginBuff || screenX > w + marginBuff || screenY < -marginBuff || screenY > h + marginBuff) return;

      this.ctx.save();
      this.ctx.translate(u.x, u.y);
      this.ctx.rotate(u.angle);

      // Selection ring
      if (u.selected) {
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, u.radius * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Render LOD: Low zoom = draw fast minimal dots
      if (isLowLOD) {
        this.ctx.fillStyle = u.type === 'gatherer' ? '#ffaa00' : '#00ff66';
        this.ctx.fillRect(-3, -3, 6, 6);
      } else {
        // Detailed vector shape
        if (u.type === 'gatherer') {
          this.ctx.fillStyle = u.cargo > 0 ? '#ffaa00' : '#00ffff';
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(u.radius, 0);
          this.ctx.lineTo(-u.radius, -u.radius * 0.8);
          this.ctx.lineTo(-u.radius * 0.5, 0);
          this.ctx.lineTo(-u.radius, u.radius * 0.8);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        } else if (u.type === 'raider') {
          this.ctx.fillStyle = '#0d324d';
          this.ctx.strokeStyle = '#00ff66';
          this.ctx.lineWidth = 1.2;
          this.ctx.beginPath();
          this.ctx.moveTo(u.radius, 0);
          this.ctx.lineTo(-u.radius, -u.radius * 0.75);
          this.ctx.lineTo(-u.radius, u.radius * 0.75);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        } else if (u.type === 'tank') {
          this.ctx.fillStyle = '#223843';
          this.ctx.strokeStyle = '#00ff66';
          this.ctx.lineWidth = 1.8;
          this.ctx.fillRect(-u.radius, -u.radius * 0.75, u.radius * 2, u.radius * 1.5);
          this.ctx.strokeRect(-u.radius, -u.radius * 0.75, u.radius * 2, u.radius * 1.5);

          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(0, 0);
          this.ctx.lineTo(u.radius * 1.4, 0);
          this.ctx.stroke();
        }
      }

      this.ctx.restore();

      // Health bar above units
      if (!isLowLOD) {
        const hpW = u.radius * 2;
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(u.x - u.radius, u.y - u.radius - 6, hpW, 2);
        this.ctx.fillStyle = '#00ff66';
        this.ctx.fillRect(u.x - u.radius, u.y - u.radius - 6, hpW * (u.health / u.maxHealth), 2);
      }
    });

    // 5. Draw Enemies & Outposts (Always scanned via radar as holograms)
    this.enemyUnits.forEach(e => {
      // Viewport culling
      const screenX = w/2 + (e.x - this.camera.x - w/2) * zoom;
      const screenY = h/2 + (e.y - this.camera.y - h/2) * zoom;
      const marginBuff = 50;
      if (screenX < -marginBuff || screenX > w + marginBuff || screenY < -marginBuff || screenY > h + marginBuff) return;

      const inVision = this.isPositionInVision(e.x, e.y);
      const isBase = e.type === 'citadel' || e.type === 'turret';

      if (!inVision) {
        if (isBase) {
          // Unexplored/unseen bases drawn as static red holographic markers
          this.ctx.save();
          this.ctx.translate(e.x, e.y);
          this.ctx.rotate(e.angle);

          this.ctx.strokeStyle = 'rgba(255, 51, 68, 0.28)';
          this.ctx.lineWidth = 1.5;
          this.ctx.fillStyle = 'rgba(255, 51, 68, 0.04)';

          if (e.type === 'citadel') {
            this.ctx.beginPath();
            this.ctx.moveTo(e.radius, 0);
            this.ctx.lineTo(e.radius * 0.3, -e.radius);
            this.ctx.lineTo(-e.radius * 0.8, -e.radius * 0.5);
            this.ctx.lineTo(-e.radius * 0.8, e.radius * 0.5);
            this.ctx.lineTo(e.radius * 0.3, e.radius);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillStyle = 'rgba(255, 51, 68, 0.45)';
            this.ctx.font = '10px var(--font-mono)';
            this.ctx.fillText("⚠️ COGNITIVE NODE", -38, -e.radius - 8);
          } else if (e.type === 'turret') {
            this.ctx.strokeRect(-e.radius, -e.radius, e.radius*2, e.radius*2);
            this.ctx.fillRect(-e.radius, -e.radius, e.radius*2, e.radius*2);
          }
          this.ctx.restore();
        }
        return; // Active hidden enemies are culled
      }

      this.ctx.save();
      this.ctx.translate(e.x, e.y);
      this.ctx.rotate(e.angle);

      if (isLowLOD) {
        this.ctx.fillStyle = '#ff3344';
        if (e.type === 'citadel') {
          this.ctx.fillRect(-15, -15, 30, 30);
        } else if (e.type === 'turret') {
          this.ctx.fillRect(-8, -8, 16, 16);
        } else {
          this.ctx.fillRect(-3, -3, 6, 6);
        }
      } else {
        if (e.type === 'citadel') {
          this.ctx.fillStyle = '#1a0006';
          this.ctx.strokeStyle = '#ff3344';
          this.ctx.lineWidth = 2.5;

          this.ctx.beginPath();
          this.ctx.moveTo(e.radius, 0);
          this.ctx.lineTo(e.radius * 0.3, -e.radius);
          this.ctx.lineTo(-e.radius * 0.8, -e.radius * 0.5);
          this.ctx.lineTo(-e.radius * 0.8, e.radius * 0.5);
          this.ctx.lineTo(e.radius * 0.3, e.radius);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          // High visibility red glowing cores
          this.ctx.fillStyle = '#ff3344';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius * 0.35, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = '#ff3344';
          this.ctx.font = 'bold 11px var(--font-mono)';
          this.ctx.fillText("⚠️ COGNITIVE NODE", -44, -e.radius - 12);
        } 
        else if (e.type === 'turret') {
          this.ctx.fillStyle = '#2b050d';
          this.ctx.strokeStyle = '#ff3344';
          this.ctx.lineWidth = 1.8;
          this.ctx.fillRect(-e.radius, -e.radius, e.radius*2, e.radius*2);
          this.ctx.strokeRect(-e.radius, -e.radius, e.radius*2, e.radius*2);

          this.ctx.fillStyle = '#ff3344';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
          this.ctx.fill();
        } 
        else if (e.type === 'crawler') {
          this.ctx.fillStyle = '#1c0113';
          this.ctx.strokeStyle = '#ff3344';
          this.ctx.lineWidth = 1.0;
          this.ctx.beginPath();
          this.ctx.moveTo(e.radius, 0);
          this.ctx.lineTo(-e.radius, -e.radius * 0.6);
          this.ctx.lineTo(-e.radius * 0.5, 0);
          this.ctx.lineTo(-e.radius, e.radius * 0.6);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }
      }

      this.ctx.restore();

      // Enemy HP Bar
      if (!isLowLOD) {
        const ehpW = e.radius * 1.8;
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(e.x - ehpW/2, e.y - e.radius - 6, ehpW, 2);
        this.ctx.fillStyle = '#ff3344';
        this.ctx.fillRect(e.x - ehpW/2, e.y - e.radius - 6, ehpW * (e.health / e.maxHealth), 2);
      }
    });

    // 6. Draw active projectiles
    this.projectiles.forEach(p => {
      if (!this.isPositionInVision(p.x, p.y)) return;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.isPlayer ? 2.5 : 3.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // 7. Draw explosions
    this.explosions.forEach(exp => {
      this.ctx.fillStyle = exp.color;
      exp.particles.forEach(p => {
        if (!this.isPositionInVision(p.x, p.y)) return;
        this.ctx.globalAlpha = p.alpha;
        this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
      });
      this.ctx.globalAlpha = 1.0;
    });

    // 8. Draw Fog of War Overlay scaled up (Sharp pixelated alpha gradient interpolation planted on the map with border padding)
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false; // Makes Fog of War pixelated and sharp!
    this.ctx.drawImage(
      this.fowCanvas, 
      -this.map.cellSize, 
      -this.map.cellSize, 
      this.map.width + this.map.cellSize * 2, 
      this.map.height + this.map.cellSize * 2
    );
    this.ctx.restore();

    this.ctx.restore();

    // 9. Draw selection Marquee Rect
    if (this.isDragging && this.selectionStart && this.selectionEnd) {
      const p1 = this.screenToWorld(this.selectionStart.x, this.selectionStart.y);
      const p2 = this.screenToWorld(this.selectionEnd.x, this.selectionEnd.y);
      
      this.ctx.save();
      this.ctx.translate(w / 2, h / 2);
      this.ctx.scale(zoom, zoom);
      this.ctx.translate(-this.camera.x - w/2, -this.camera.y - h/2);

      this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.55)';
      this.ctx.lineWidth = 1.2 / zoom;
      this.ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      
      this.ctx.fillStyle = 'rgba(0, 255, 102, 0.15)';
      this.ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

      this.ctx.restore();
    }
  }

  screenToWorld(screenX, screenY) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const zoom = this.camera.zoom;
    return {
      x: this.camera.x + w/2 + (screenX - w/2) / zoom,
      y: this.camera.y + h/2 + (screenY - h/2) / zoom
    };
  }
}
