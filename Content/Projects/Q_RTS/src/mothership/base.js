/**
 * Mothership/base.js
 * Homebase production factory inside the colossal Carrier hull.
 * Features modular grid expansion (Infinity squares), WASD camera panning,
 * a central Spacetime Portal for standing army routing, and Zodiac Tech node integrations.
 */

export class MothershipBase {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Grid settings
    this.cellSize = 40;
    
    // Camera Pan offsets (relative to center of screen)
    this.cameraX = -240; 
    this.cameraY = -120;
    this.zoom = 1.0;
    
    // Expandable Grid Sectors (each sector is 12x12 cells)
    // Starting with center sector (0,0) and the right side sector (1,0) unlocked for prebuilt pipeline.
    this.unlockedSectors = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];
    
    // Factory State
    this.buildings = [];
    this.conveyorItems = []; // Particles moving along belts
    this.particles = [];     // Aesthetic localized splash particle animations
    
    // Production inventory
    this.inventory = {
      quantumMatter: 350,
      exoticCores: 5,
      zodiacTethers: 2,
      earthElement: 0,
      airElement: 0,
      waterElement: 0,
      metalElement: 0,
      soilElement: 0,
      symmetryCrystal: 0
    };

    // Standing army reserves (loaded into battle from here)
    this.standingArmy = {
      raider: 3,
      tank: 1,
      gunship: 1
    };

    // Unlocked Zodiac Tech Brain Nodes
    this.unlockedTech = [];

    // Production history tracking (sliding window of last 60 seconds)
    this.productionHistory = [];

    // Selected building for placement
    this.selectedTool = null; // 'extractor', 'belt', 'synthesizer', 'storage', 'assembler', 'deployer', 'demolish'
    this.placementDirection = 'right';

    // Factory Power Toggle State
    this.factoryActive = true;

    // Tick counter
    this.tickCount = 0;

    this.initPrebuiltFactory();
  }

  saveToStorage() {
    const data = {
      unlockedSectors: this.unlockedSectors,
      buildings: this.buildings,
      inventory: this.inventory,
      standingArmy: this.standingArmy,
      unlockedTech: this.unlockedTech,
      factoryActive: this.factoryActive !== undefined ? this.factoryActive : true
    };
    if (window.GameStorage) {
      window.GameStorage.save('mothership_base_state', data)
        .catch(err => console.error("Failed to save state to IndexedDB:", err));
    }
  }

  // Adds a production event for real-time PPM tracking
  addProductionStat(type, amount) {
    if (!this.productionHistory) this.productionHistory = [];
    this.productionHistory.push({
      time: Date.now(),
      type: type,
      amount: amount
    });
  }

  // Returns total amount produced in the last 60 seconds
  getProductionPerMinute(type) {
    if (!this.productionHistory) return 0;
    const now = Date.now();
    // Keep window within last 60,000 milliseconds (60 seconds)
    this.productionHistory = this.productionHistory.filter(evt => now - evt.time < 60000);
    
    let sum = 0;
    this.productionHistory.forEach(evt => {
      if (evt.type === type) {
        sum += evt.amount;
      }
    });
    return sum;
  }

  loadFromStorage() {
    if (window.GameStorage) {
      return window.GameStorage.load('mothership_base_state')
        .then(data => {
          if (data) {
            if (data.unlockedSectors) this.unlockedSectors = data.unlockedSectors;
            if (data.buildings) this.buildings = data.buildings;
            if (data.inventory) this.inventory = data.inventory;
            if (data.standingArmy) this.standingArmy = data.standingArmy;
            if (data.unlockedTech) this.unlockedTech = data.unlockedTech;
            this.factoryActive = data.factoryActive !== undefined ? data.factoryActive : true;
            
            // Clear transient states
            this.conveyorItems = [];
            this.particles = [];
            
            this.updateUiDisplay();
            if (window.updateMothershipUiStockpile) {
              window.updateMothershipUiStockpile();
            }
            return true;
          }
          return false;
        })
        .catch(err => {
          console.error("Failed to load state from IndexedDB:", err);
          return false;
        });
    }
    return Promise.resolve(false);
  }

  // Set up a beautifully arranged automation pipeline inside the central sector
  initPrebuiltFactory() {
    this.buildings = [];
    this.conveyorItems = [];

    // --- DRILL SYSTEM A (Left-to-Right) ---
    // Extractor 1
    this.buildings.push({
      id: 'ext-1',
      type: 'extractor',
      col: 1, row: 3,
      name: 'Reactor Extractor A',
      efficiency: 1.0,
      cooldown: 0,
      maxCooldown: 40,
      direction: 'right'
    });
    // Belt A1
    this.buildings.push({
      id: 'belt-a1',
      type: 'belt',
      col: 2, row: 3,
      direction: 'right'
    });
    // Belt A2
    this.buildings.push({
      id: 'belt-a2',
      type: 'belt',
      col: 3, row: 3,
      direction: 'right'
    });

    // --- DRILL SYSTEM B (Top-to-Bottom) ---
    // Extractor 2
    this.buildings.push({
      id: 'ext-2',
      type: 'extractor',
      col: 4, row: 1,
      name: 'Reactor Extractor B',
      efficiency: 1.0,
      cooldown: 15,
      maxCooldown: 40,
      direction: 'down'
    });
    // Belt B1
    this.buildings.push({
      id: 'belt-b1',
      type: 'belt',
      col: 4, row: 2,
      direction: 'down'
    });

    // --- CENTRAL TRANSMUTER SYNTHESIZER ---
    // Synthesizer 1
    this.buildings.push({
      id: 'synth-1',
      type: 'synthesizer',
      subType: 'matter',
      col: 4, row: 3,
      name: 'Transmuter Core',
      inputBuffer: 0,
      requiredInput: 5,
      cooldown: 0,
      maxCooldown: 90,
      transmuteTarget: 'zodiac_core',
      direction: 'down'
    });

    // --- ROUTING CORES TO ASSEMBLER ---
    // Belt C1
    this.buildings.push({
      id: 'belt-c1',
      type: 'belt',
      col: 4, row: 4,
      direction: 'right'
    });
    // Belt C2
    this.buildings.push({
      id: 'belt-c2',
      type: 'belt',
      col: 5, row: 4,
      direction: 'right'
    });
    // Belt C3
    this.buildings.push({
      id: 'belt-c3',
      type: 'belt',
      col: 6, row: 4,
      direction: 'right'
    });
    // Belt C4
    this.buildings.push({
      id: 'belt-c4',
      type: 'belt',
      col: 7, row: 4,
      direction: 'right'
    });

    // --- VEHICLE ASSEMBLY FACILITY ---
    // Factory 1
    this.buildings.push({
      id: 'factory-1',
      type: 'factory',
      col: 8, row: 3,
      recipe: 'unit_raider',
      hullBuffer: 0,
      movementBuffer: 0,
      gunBuffer: 0,
      inputBuffer: 0,
      cooldown: 0,
      maxCooldown: 120,
      direction: 'down'
    });

    // --- WARPING RESISTANCE ROUTE (Into Spacetime Portal) ---
    // Belt D1
    this.buildings.push({
      id: 'belt-d1',
      type: 'belt',
      col: 8, row: 5,
      direction: 'left'
    });
    // Belt D2
    this.buildings.push({
      id: 'belt-d2',
      type: 'belt',
      col: 7, row: 5,
      direction: 'left'
    });

    // --- SECONDARY SYSTEM IN SECTOR 2 (Exotic Core Storage Reserve) ---
    // Extractor 3
    this.buildings.push({
      id: 'ext-3',
      type: 'extractor',
      col: 13, row: 2,
      name: 'Exotic Driller',
      efficiency: 1.0,
      cooldown: 20,
      maxCooldown: 45,
      direction: 'right'
    });
    // Belt E1
    this.buildings.push({
      id: 'belt-e1',
      type: 'belt',
      col: 14, row: 2,
      direction: 'right'
    });
    // Belt E2
    this.buildings.push({
      id: 'belt-e2',
      type: 'belt',
      col: 15, row: 2,
      direction: 'right'
    });
    // Belt E3
    this.buildings.push({
      id: 'belt-e3',
      type: 'belt',
      col: 16, row: 2,
      direction: 'down'
    });
    // Belt E4
    this.buildings.push({
      id: 'belt-e4',
      type: 'belt',
      col: 16, row: 3,
      direction: 'down'
    });
    // Synthesizer 2
    this.buildings.push({
      id: 'synth-2',
      type: 'synthesizer',
      subType: 'elements',
      col: 16, row: 4,
      name: 'Aux Transmuter',
      inputBuffer: 0,
      requiredInput: 3,
      cooldown: 0,
      maxCooldown: 90,
      transmuteTarget: 'terrestrial_earth',
      direction: 'right'
    });
    // Belt E5
    this.buildings.push({
      id: 'belt-e5',
      type: 'belt',
      col: 17, row: 4,
      direction: 'right'
    });
    // Belt E6
    this.buildings.push({
      id: 'belt-e6',
      type: 'belt',
      col: 18, row: 4,
      direction: 'right'
    });
    // Storage Vault E
    this.buildings.push({
      id: 'store-1',
      type: 'storage',
      col: 19, row: 4,
      name: 'Silo-A Prime',
      capacity: 500,
      direction: 'right'
    });
  }

  resize(w, h) {
    // Canvas dimensions changed
  }

  // Helper: check if sector coordinates are unlocked
  isSectorUnlocked(sx, sy) {
    return this.unlockedSectors.some(s => s.x === sx && s.y === sy);
  }

  // Helper: check if specific cell col/row falls within an unlocked sector area
  isCellUnlocked(col, row) {
    const sx = Math.floor(col / 12);
    const sy = Math.floor(row / 12);
    return this.isSectorUnlocked(sx, sy);
  }

  // Check if cell corresponds to the protected central double-ring portal in sector (0,0)
  isCentralPortalCell(col, row) {
    return (col === 5 || col === 6) && (row === 5 || row === 6);
  }

  // Find building covering cell, taking 2x2 footprint of factory into account
  getBuildingAtCell(col, row) {
    return this.buildings.find(b => {
      if (b.type === 'factory') {
        return col >= b.col && col <= b.col + 1 && row >= b.row && row <= b.row + 1;
      }
      return b.col === col && b.row === row;
    });
  }

  // Handle keyboard rotation key 'R'
  handleRotateKey() {
    const now = Date.now();
    if (this.lastRotateTime && (now - this.lastRotateTime) < 150) {
      return;
    }
    this.lastRotateTime = now;

    const dirs = ['right', 'down', 'left', 'up'];
    if (this.selectedTool) {
      const idx = dirs.indexOf(this.placementDirection || 'right');
      this.placementDirection = dirs[(idx + 1) % 4];
      window.appendLog(`🔄 PLACEMENT_ROTATION: Next placement rotated to face [${this.placementDirection.toUpperCase()}].`);
    } else {
      // Rotate the block currently hovered by the mouse
      const worldPos = this.screenToWorld(window.mousePos?.x || 0, window.mousePos?.y || 0);
      const col = Math.floor(worldPos.x / this.cellSize);
      const row = Math.floor(worldPos.y / this.cellSize);
      
      const b = this.getBuildingAtCell(col, row);
      if (b) {
        if (this.isCentralPortalCell(col, row)) return;
        const idx = dirs.indexOf(b.direction || 'right');
        b.direction = dirs[(idx + 1) % 4];
        window.appendLog(`🔄 FACILITY_ROTATION: Rotated ${b.type.toUpperCase()} at [${col}, ${row}] to face [${b.direction.toUpperCase()}].`);
        if (window.saveGame) window.saveGame();
      }
    }
  }

  // Map screen mouse position back to world factory coordinates, taking camera panning and zoom offsets into account
  screenToWorld(screenX, screenY) {
    const originX = this.canvas.width / 2;
    const originY = this.canvas.height / 2;
    return {
      x: (screenX - originX) / this.zoom - this.cameraX,
      y: (screenY - originY) / this.zoom - this.cameraY
    };
  }

  // Double click handling for quick recipe/gate toggle
  handleDoubleClick(screenX, screenY) {
    const worldPos = this.screenToWorld(screenX, screenY);
    const col = Math.floor(worldPos.x / this.cellSize);
    const row = Math.floor(worldPos.y / this.cellSize);
    
    if (!this.isCellUnlocked(col, row)) return;

    const b = this.getBuildingAtCell(col, row);
    if (b) {
      if (b.type === 'assembler') {
        const recipes = ['part_hull', 'part_movement', 'part_gun'];
        const currentIdx = recipes.indexOf(b.recipe || 'part_hull');
        b.recipe = recipes[(currentIdx + 1) % 3];
        b.cooldown = 0;
        window.appendLog(`🛠️ ASSEMBLER: Changed recipe at [${col}, ${row}] to build [${b.recipe.toUpperCase()}].`);
        if (window.saveGame) window.saveGame();
      } else if (b.type === 'factory') {
        const recipes = ['unit_raider', 'unit_tank', 'unit_gunship'];
        const currentIdx = recipes.indexOf(b.recipe || 'unit_raider');
        b.recipe = recipes[(currentIdx + 1) % 3];
        b.cooldown = 0;
        window.appendLog(`🏭 FACTORY: Changed recipe at [${col}, ${row}] to build [${b.recipe.toUpperCase()}].`);
        if (window.saveGame) window.saveGame();
      } else if (b.type === 'deployer') {
        b.active = !b.active;
        window.appendLog(`🚚 DEPLOY_GATE: Gate at [${col}, ${row}] toggled [${b.active ? 'OPEN (DEPLOY)' : 'CLOSED (HOLD)'}].`);
        if (window.saveGame) window.saveGame();
      }
    }
  }

  // Handle clicking on the factory grid (building placement, demolition, or unlocking adjacent sectors)
  handleClick(screenX, screenY, isShiftKey = false) {
    const worldPos = this.screenToWorld(screenX, screenY);
    const col = Math.floor(worldPos.x / this.cellSize);
    const row = Math.floor(worldPos.y / this.cellSize);
    
    const sx = Math.floor(col / 12);
    const sy = Math.floor(row / 12);

    // 1. Check if the player clicked a LOCKED sector on the border to unlock it
    if (!this.isSectorUnlocked(sx, sy)) {
      // Check if it is adjacent to an unlocked sector
      const isAdjacent = this.unlockedSectors.some(s => {
        return (Math.abs(s.x - sx) + Math.abs(s.y - sy)) === 1;
      });

      if (isAdjacent) {
        // Calculate unlock cost
        const costQM = 200 + this.unlockedSectors.length * 100;
        const costCores = Math.floor(this.unlockedSectors.length / 2) + 1;

        if (this.inventory.quantumMatter >= costQM && this.inventory.exoticCores >= costCores) {
          this.inventory.quantumMatter -= costQM;
          this.inventory.exoticCores -= costCores;
          this.unlockedSectors.push({ x: sx, y: sy });
          
          this.spawnExplosion(col * this.cellSize + this.cellSize/2, row * this.cellSize + this.cellSize/2, '#ff33ff', 30);
          window.appendLog(`✨ SECTOR_UNLOCKED: Successfully integrated sector [${sx}, ${sy}] into the mainframe grid! Cost: ${costQM} QM + ${costCores} Exotic Cores.`);
          
          if (window.saveGame) window.saveGame();
          this.updateUiDisplay();
        } else {
          window.appendLog(`❌ GRID_DENIED: Sector [${sx}, ${sy}] requires ${costQM} QM and ${costCores} Exotic Cores to integrate.`);
        }
      } else {
        window.appendLog("⚠️ NAVIGATION_ALERT: You can only integrate grid sectors that are immediately adjacent to unlocked space.");
      }
      return;
    }

    // Protect the central portal cells in sector (0,0) from modifications
    if (this.isCentralPortalCell(col, row)) {
      window.appendLog("🛡️ MAIN_GATE_PROTECTED: The central Spacetime Portal is a permanent fixture of the mothership hull.");
      return;
    }

    // 2. If a tool is selected, try to place/remove it
    if (this.selectedTool) {
      if (this.selectedTool === 'demolish') {
        const bToRemove = this.getBuildingAtCell(col, row);
        if (bToRemove) {
          const existingIdx = this.buildings.indexOf(bToRemove);
          if (existingIdx !== -1) {
            const removed = this.buildings.splice(existingIdx, 1)[0];
            
            // Libra tech: Symmetry Matrix refunds full cost, otherwise 15 QM refund
            const hasLibra = this.unlockedTech.includes('libra');
            const refund = hasLibra ? (removed.type === 'extractor' ? 60 : removed.type === 'extractor_element' ? 80 : removed.type === 'belt' ? 15 : removed.type === 'synthesizer' ? 120 : removed.type === 'storage' ? 80 : removed.type === 'assembler' ? 150 : 100) : 15;
            
            this.inventory.quantumMatter += refund;
            window.appendLog(`🚜 FACTORY: Demolished ${removed.type.toUpperCase()} at [${removed.col}, ${removed.row}]. Refunded ${refund} QM.`);
            if (window.saveGame) window.saveGame();
            this.updateUiDisplay();
          }
        }
        return;
      }

      // Overlap and footprint check
      if (this.selectedTool === 'assembler') {
        // 2x2 checks
        for (let dc = 0; dc <= 1; dc++) {
          for (let dr = 0; dr <= 1; dr++) {
            const tc = col + dc;
            const tr = row + dr;
            if (!this.isCellUnlocked(tc, tr)) {
              window.appendLog("⚠️ GRID_BLOCKED: All assembler footprint cells must be inside unlocked grid sectors.");
              return;
            }
            if (this.isCentralPortalCell(tc, tr)) {
              window.appendLog("🛡️ MAIN_GATE_PROTECTED: Footprint overlaps with protected central portal.");
              return;
            }
            const existing = this.getBuildingAtCell(tc, tr);
            if (existing) {
              window.appendLog("⚠️ GRID_BLOCKED: Part of assembler footprint is already occupied.");
              return;
            }
          }
        }
      } else {
        // 1x1 checks
        const existing = this.getBuildingAtCell(col, row);
        if (existing) {
          window.appendLog("⚠️ GRID_BLOCKED: Cell already occupied by another facility.");
          return;
        }
      }

      // Spend QM to build
      const costs = { extractor: 60, extractor_element: 80, belt: 15, synthesizer_matter: 120, synthesizer_elements: 120, synthesizer_zodiac: 120, storage: 80, assembler: 100, factory: 150, deployer: 100 };
      let cost = costs[this.selectedTool] || 0;

      // Taurus tech: Half cost for conveyor belts
      if (this.selectedTool === 'belt' && this.unlockedTech.includes('taurus')) {
        cost = Math.ceil(cost / 2);
      }

      if (this.inventory.quantumMatter < cost) {
        window.appendLog(`❌ BUILD_FAILED: Insufficient Quantum Matter. Need ${cost} QM to build ${this.selectedTool.toUpperCase()}.`);
        return;
      }

      this.inventory.quantumMatter -= cost;

      // Place building with currently chosen placement direction
      let bData = {
        id: `${this.selectedTool}-${Date.now()}`,
        type: this.selectedTool,
        col: col,
        row: row,
        direction: this.placementDirection || 'right'
      };

      if (this.selectedTool === 'extractor') {
        bData.cooldown = 0;
        bData.resourceType = 'quantum_matter';
        // Leo tech: Extractor Drills operate +50% faster (shorter cooldown)
        const hasLeo = this.unlockedTech.includes('leo');
        bData.maxCooldown = hasLeo ? 26 : 40;
      } else if (this.selectedTool === 'extractor_element') {
        bData.cooldown = 0;
        bData.resourceType = 'earth';
        // Leo tech: Extractor Drills operate +50% faster (shorter cooldown)
        const hasLeo = this.unlockedTech.includes('leo');
        bData.maxCooldown = hasLeo ? 26 : 40;
      } else if (this.selectedTool.startsWith('synthesizer_')) {
        const sub = this.selectedTool.replace('synthesizer_', '');
        bData.type = 'synthesizer';
        bData.subType = sub;
        bData.inputBuffer = 0;
        bData.cooldown = 0;
        bData.maxCooldown = 90;

        if (sub === 'matter') {
          bData.transmuteTarget = 'exotic_core';
          bData.requiredInput = 3;
        } else if (sub === 'elements') {
          bData.transmuteTarget = 'terrestrial_earth';
          bData.requiredInput = 3;
        } else { // zodiac
          bData.transmuteTarget = 'terrestrial_symmetry';
          bData.requiredInput = 3;
        }
      } else if (this.selectedTool === 'assembler') {
        bData.recipe = 'part_hull';
        bData.inputBuffer = 0;
        bData.cooldown = 0;
        // Aquarius tech: Decreases assembler/factory cooldowns by 40%
        const hasAquarius = this.unlockedTech.includes('aquarius');
        bData.maxCooldown = hasAquarius ? 72 : 120;
      } else if (this.selectedTool === 'factory') {
        bData.recipe = 'unit_raider';
        bData.hullBuffer = 0;
        bData.movementBuffer = 0;
        bData.gunBuffer = 0;
        bData.cooldown = 0;
        // Aquarius tech: Decreases assembler/factory cooldowns by 40%
        const hasAquarius = this.unlockedTech.includes('aquarius');
        bData.maxCooldown = hasAquarius ? 72 : 120;
      } else if (this.selectedTool === 'deployer') {
        bData.active = true; // gate open by default
      }

      this.buildings.push(bData);
      window.appendLog(`🛠️ CONSTRUCTED: Placed ${this.selectedTool.toUpperCase()} facility at grid index [${col}, ${row}]. Cost: ${cost} QM.`);
      
      if (window.saveGame) window.saveGame();
      this.updateUiDisplay();
    } else {
      // Normal click interactions
      const b = this.getBuildingAtCell(col, row);
      if (b) {
        if (isShiftKey) {
          if (b.type === 'assembler') {
            const recipes = ['part_hull', 'part_movement', 'part_gun'];
            const currentIdx = recipes.indexOf(b.recipe || 'part_hull');
            b.recipe = recipes[(currentIdx + 1) % 3];
            b.cooldown = 0;
            window.appendLog(`🛠️ ASSEMBLER: Changed recipe at [${b.col}, ${b.row}] to build [${b.recipe.toUpperCase()}].`);
          } else if (b.type === 'factory') {
            const recipes = ['unit_raider', 'unit_tank', 'unit_gunship'];
            const currentIdx = recipes.indexOf(b.recipe || 'unit_raider');
            b.recipe = recipes[(currentIdx + 1) % 3];
            b.cooldown = 0;
            window.appendLog(`🏭 FACTORY: Changed recipe at [${b.col}, ${b.row}] to build [${b.recipe.toUpperCase()}].`);
          } else if (b.type === 'deployer') {
            b.active = !b.active;
            window.appendLog(`🚚 DEPLOY_GATE: Gate at [${b.col}, ${b.row}] toggled [${b.active ? 'OPEN (DEPLOY)' : 'CLOSED (HOLD)'}].`);
          } else {
            const dirs = ['right', 'down', 'left', 'up'];
            const nextDirIdx = (dirs.indexOf(b.direction || 'right') + 1) % 4;
            b.direction = dirs[nextDirIdx];
            window.appendLog(`🔄 ROTATED: ${b.type.toUpperCase()} at [${b.col}, ${b.row}] facing [${b.direction.toUpperCase()}].`);
          }
        } else {
          // Normal click cycles orientation
          const dirs = ['right', 'down', 'left', 'up'];
          const nextDirIdx = (dirs.indexOf(b.direction || 'right') + 1) % 4;
          b.direction = dirs[nextDirIdx];
          window.appendLog(`🔄 ROTATED: ${b.type.toUpperCase()} at [${b.col}, ${b.row}] facing [${b.direction.toUpperCase()}].`);
        }
        if (window.saveGame) window.saveGame();
      }
    }
  }

  handleRightClick(x, y) {
    const worldPos = this.screenToWorld ? this.screenToWorld(x, y) : { x: x + (this.cameraX || 0), y: y + (this.cameraY || 0) };
    const col = Math.floor(worldPos.x / this.cellSize);
    const row = Math.floor(worldPos.y / this.cellSize);
    const b = this.getBuildingAtCell(col, row);
    if (!b) return false;

    // Cycle types based on building type!
    if (b.type === 'extractor') {
      const types = ['quantum_matter', 'exotic_core', 'zodiac_tether'];
      const current = b.resourceType || 'quantum_matter';
      const nextIndex = (types.indexOf(current) + 1) % types.length;
      b.resourceType = types[nextIndex];
      // Leo tech: Extractor Drills operate +50% faster (shorter cooldown)
      const hasLeo = this.unlockedTech.includes('leo');
      b.maxCooldown = hasLeo ? 26 : 40;
      b.cooldown = 0;
      window.appendLog(`🌀 EXTRACTOR [${col}, ${row}]: Reconfigured drill-head to extract [${b.resourceType.toUpperCase().replace('_', ' ')}].`);
      if (window.saveGame) window.saveGame();
      this.updateUiDisplay();
      return true;
    }
    else if (b.type === 'extractor_element') {
      const types = ['earth', 'air', 'water', 'metal', 'soil'];
      const current = b.resourceType || 'earth';
      const nextIndex = (types.indexOf(current) + 1) % types.length;
      b.resourceType = types[nextIndex];
      // Leo tech: Extractor Drills operate +50% faster (shorter cooldown)
      const hasLeo = this.unlockedTech.includes('leo');
      b.maxCooldown = hasLeo ? 26 : 40;
      b.cooldown = 0;
      window.appendLog(`🌍 E-EXTRACTOR [${col}, ${row}]: Reconfigured elemental core focus to extract [${b.resourceType.toUpperCase()}].`);
      if (window.saveGame) window.saveGame();
      this.updateUiDisplay();
      return true;
    }
    else if (b.type === 'synthesizer') {
      const sub = b.subType || 'matter';
      let targets = [];
      if (sub === 'matter') {
        targets = ['exotic_core', 'zodiac_tether', 'zodiac_core'];
      } else if (sub === 'elements') {
        targets = [
          'terrestrial_earth',
          'terrestrial_air',
          'terrestrial_water',
          'terrestrial_metal',
          'terrestrial_soil'
        ];
      } else { // sub === 'zodiac'
        targets = [
          'terrestrial_symmetry',
          'zodiac_core',
          'zodiac_tether'
        ];
      }

      const current = b.transmuteTarget || targets[0];
      const nextIndex = (targets.indexOf(current) + 1) % targets.length;
      b.transmuteTarget = targets[nextIndex];
      // Reset inputBuffer and cooldown
      b.inputBuffer = 0;
      b.cooldown = 0;
      
      // Determine required inputs for recipe
      if (b.transmuteTarget.startsWith('terrestrial_')) {
        b.requiredInput = 3;
      } else if (b.transmuteTarget === 'exotic_core') {
        b.requiredInput = 3;
      } else if (b.transmuteTarget === 'zodiac_core') {
        b.requiredInput = 5;
      } else if (b.transmuteTarget === 'zodiac_tether') {
        b.requiredInput = 10;
      }

      window.appendLog(`⚛️ TRANSMUTER [${col}, ${row}] (${sub.toUpperCase()}): Reconfigured output focus to [${b.transmuteTarget.toUpperCase().replace('TERRESTRIAL_', '').replace('ZODIAC_', '')}].`);
      if (window.saveGame) window.saveGame();
      this.updateUiDisplay();
      return true;
    }
    else if (b.type === 'assembler') {
      // Cycle assembler recipe
      const recipes = [
        'part_hull',
        'part_movement',
        'part_gun'
      ];
      const current = b.recipe || 'part_hull';
      const nextIndex = (recipes.indexOf(current) + 1) % recipes.length;
      b.recipe = recipes[nextIndex];
      // Reset assembler counters to prevent carrying over half-finished items
      b.inputBuffer = 0;
      b.cooldown = 0;
      
      // Aquarius tech: Decreases assembler cooldowns by 40%
      const hasAquarius = this.unlockedTech.includes('aquarius');
      b.maxCooldown = hasAquarius ? 72 : 120;

      window.appendLog(`🛠️ ASSEMBLER [${col}, ${row}]: Reconfigured blueprint to produce [${b.recipe.toUpperCase().replace('PART_', 'PART: ')}].`);
      if (window.saveGame) window.saveGame();
      this.updateUiDisplay();
      return true;
    }
    else if (b.type === 'factory') {
      // Cycle factory recipe
      const recipes = [
        'unit_raider',
        'unit_tank',
        'unit_gunship'
      ];
      const current = b.recipe || 'unit_raider';
      const nextIndex = (recipes.indexOf(current) + 1) % recipes.length;
      b.recipe = recipes[nextIndex];
      // Reset factory counters
      b.hullBuffer = 0;
      b.movementBuffer = 0;
      b.gunBuffer = 0;
      b.cooldown = 0;
      
      // Aquarius tech: Decreases factory cooldowns by 40%
      const hasAquarius = this.unlockedTech.includes('aquarius');
      b.maxCooldown = hasAquarius ? 72 : 120;

      window.appendLog(`🏭 FACTORY [${col}, ${row}]: Reconfigured blueprint to produce [${b.recipe.toUpperCase().replace('UNIT_', 'UNIT: ')}].`);
      if (window.saveGame) window.saveGame();
      this.updateUiDisplay();
      return true;
    }
    return false;
  }

  // Spawns neat localized splash debris particles
  spawnExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.0;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        alpha: 1.0,
        age: 0,
        maxAge: 20 + Math.random() * 20
      });
    }
  }

  // Update DOM read-out labels on change
  updateUiDisplay() {
    const rVal = document.getElementById('army-raiders-val');
    const tVal = document.getElementById('army-tanks-val');
    const gVal = document.getElementById('army-gunships-val');
    if (rVal) rVal.textContent = this.standingArmy.raider;
    if (tVal) tVal.textContent = this.standingArmy.tank;
    if (gVal) gVal.textContent = this.standingArmy.gunship;

    // Update deploy counts on conquest sidebar as well
    const decRaider = document.getElementById('deploy-count-raider');
    const decTank = document.getElementById('deploy-count-tank');
    const decGunship = document.getElementById('deploy-count-gunship');
    if (decRaider) decRaider.textContent = `[${this.standingArmy.raider} Ready]`;
    if (decTank) decTank.textContent = `[${this.standingArmy.tank} Ready]`;
    if (decGunship) decGunship.textContent = `[${this.standingArmy.gunship} Ready]`;
  }

  // Run the physics/simulation step of the factory pipeline
  tick() {
    this.tickCount++;

    const isBackground = window.activeMode && window.activeMode !== 'mothership';
    
    // Periodic background production notifications to keep player updated (every 30 seconds / 1800 ticks)
    if (isBackground && this.tickCount % 1800 === 0) {
      const qmPpm = this.getProductionPerMinute('quantumMatter');
      const corePpm = this.getProductionPerMinute('exoticCores');
      const raiderPpm = this.getProductionPerMinute('raider');
      const tankPpm = this.getProductionPerMinute('tank');
      const gunshipPpm = this.getProductionPerMinute('gunship');
      
      const parts = [];
      if (qmPpm > 0) parts.push(`+${qmPpm} QM`);
      if (corePpm > 0) parts.push(`+${corePpm} Cores`);
      if (raiderPpm > 0) parts.push(`+${raiderPpm} Raiders`);
      if (tankPpm > 0) parts.push(`+${tankPpm} Tanks`);
      if (gunshipPpm > 0) parts.push(`+${gunshipPpm} Gunships`);
      
      if (parts.length > 0) {
        window.appendLog(`🛰️ FACTORY_RECON: Mothership background processing line active: [${parts.join(', ')} / min].`);
      }
    }

    // Camera scrolling via WASD
    if (window.keysPressed && window.activeMode === 'mothership') {
      const scrollSpeed = 8;
      if (window.keysPressed['w'] || window.keysPressed['arrowup']) this.cameraY += scrollSpeed;
      if (window.keysPressed['s'] || window.keysPressed['arrowdown']) this.cameraY -= scrollSpeed;
      if (window.keysPressed['a'] || window.keysPressed['arrowleft']) this.cameraX += scrollSpeed;
      if (window.keysPressed['d'] || window.keysPressed['arrowright']) this.cameraX -= scrollSpeed;
    }

    // Capricorn tech: Passively generates 10 QM/sec inside base
    if (this.unlockedTech.includes('capricorn') && this.tickCount % 60 === 0 && this.factoryActive !== false) {
      this.inventory.quantumMatter += 10;
      this.addProductionStat('quantumMatter', 10);
    }

    // 1. Process Extractor Drills
    this.buildings.forEach(b => {
      if (b.type === 'extractor') {
        if (this.factoryActive === false) {
          b.cooldown = 0;
          return;
        }
        b.cooldown++;
        if (b.cooldown >= b.maxCooldown) {
          const spawnX = b.col * this.cellSize + this.cellSize / 2;
          const spawnY = b.row * this.cellSize + this.cellSize / 2;
          
          // Check if there is already an item very close to this extractor's output center (within 24px)
          const isBlocked = this.conveyorItems.some(item => {
            const dx = item.x - spawnX;
            const dy = item.y - spawnY;
            return (dx * dx + dy * dy) < 480; // within ~22px radius
          });

          const resType = b.resourceType || 'quantum_matter';
          let costPerItem = 10;
          let spawnItemType = 'raw_matter';
          let spawnColor = '#00ffff';

          if (resType === 'exotic_core') {
            costPerItem = 40;
            spawnItemType = 'exotic_core';
            spawnColor = '#ff33ff';
          } else if (resType === 'zodiac_tether') {
            costPerItem = 100;
            spawnItemType = 'zodiac_tether';
            spawnColor = '#ffb300';
          }

          // Gemini tech: extracts two items per cycle instead of one (each costing costPerItem QM)
          const hasGemini = this.unlockedTech.includes('gemini');
          const itemsToExtract = hasGemini ? 2 : 1;
          
          let actualExtractCount = 0;
          for (let i = 0; i < itemsToExtract; i++) {
            if (this.inventory.quantumMatter >= costPerItem && this.conveyorItems.length < 300) {
              actualExtractCount++;
            }
          }

          if (isBlocked || actualExtractCount === 0) {
            b.cooldown = b.maxCooldown; // Pause / wait until the spot is clear or we have enough QM
          } else {
            b.cooldown = 0;
            const totalCost = actualExtractCount * costPerItem;
            this.inventory.quantumMatter -= totalCost;
            this.addProductionStat('quantumMatter', -totalCost);

            for (let i = 0; i < actualExtractCount; i++) {
              const offsetAngle = (i * Math.PI) / 2;
              const spawnOffsetX = actualExtractCount > 1 ? Math.cos(offsetAngle) * 4 : 0;
              const spawnOffsetY = actualExtractCount > 1 ? Math.sin(offsetAngle) * 4 : 0;

              this.conveyorItems.push({
                id: `item-${Date.now()}-${Math.random()}`,
                x: spawnX + spawnOffsetX,
                y: spawnY + spawnOffsetY,
                spawnX: spawnX,
                spawnY: spawnY,
                spawnDir: b.direction || 'right',
                targetCol: b.col,
                targetRow: b.row,
                itemType: spawnItemType,
                progress: 0,
                color: spawnColor,
                age: 0
              });
            }

            // Sync simulation QM
            if (window.sim) {
              window.sim.qm = this.inventory.quantumMatter;
            }
          }
        }
      }
    });

    // 1b. Process Elemental Extractor Drills (E-Extractor)
    this.buildings.forEach(b => {
      if (b.type === 'extractor_element') {
        if (this.factoryActive === false) {
          b.cooldown = 0;
          return;
        }
        b.cooldown++;
        if (b.cooldown >= b.maxCooldown) {
          const spawnX = b.col * this.cellSize + this.cellSize / 2;
          const spawnY = b.row * this.cellSize + this.cellSize / 2;
          
          // Check if block center is occupied
          const isBlocked = this.conveyorItems.some(item => {
            const dx = item.x - spawnX;
            const dy = item.y - spawnY;
            return (dx * dx + dy * dy) < 480;
          });

          const resType = b.resourceType || 'earth';
          const costPerItem = 30;
          const spawnItemType = `item_${resType}`;
          const colors = {
            earth: '#c2b09e',
            air: '#b3e5fc',
            water: '#42a5f5',
            metal: '#cfd8dc',
            soil: '#8d6e63'
          };
          const spawnColor = colors[resType] || '#ffffff';

          const hasGemini = this.unlockedTech.includes('gemini');
          const itemsToExtract = hasGemini ? 2 : 1;
          
          let actualExtractCount = 0;
          for (let i = 0; i < itemsToExtract; i++) {
            if (this.inventory.quantumMatter >= costPerItem && this.conveyorItems.length < 300) {
              actualExtractCount++;
            }
          }

          if (isBlocked || actualExtractCount === 0) {
            b.cooldown = b.maxCooldown;
          } else {
            b.cooldown = 0;
            const totalCost = actualExtractCount * costPerItem;
            this.inventory.quantumMatter -= totalCost;
            this.addProductionStat('quantumMatter', -totalCost);

            for (let i = 0; i < actualExtractCount; i++) {
              const offsetAngle = (i * Math.PI) / 2;
              const spawnOffsetX = actualExtractCount > 1 ? Math.cos(offsetAngle) * 4 : 0;
              const spawnOffsetY = actualExtractCount > 1 ? Math.sin(offsetAngle) * 4 : 0;

              this.conveyorItems.push({
                id: `item-${Date.now()}-${Math.random()}`,
                x: spawnX + spawnOffsetX,
                y: spawnY + spawnOffsetY,
                spawnX: spawnX,
                spawnY: spawnY,
                spawnDir: b.direction || 'right',
                targetCol: b.col,
                targetRow: b.row,
                itemType: spawnItemType,
                progress: 0,
                color: spawnColor,
                age: 0
              });
            }

            if (window.sim) {
              window.sim.qm = this.inventory.quantumMatter;
            }
          }
        }
      }
    });

    // 2. Process Transmuters & Vehicle Assemblers
    this.buildings.forEach(b => {
      if (b.type === 'synthesizer') {
        if (this.factoryActive === false) {
          b.cooldown = 0;
          return;
        }
        
        const target = b.transmuteTarget || 'zodiac_core';
        let required = 5;
        if (target.startsWith('terrestrial_')) {
          required = 3;
        } else if (target === 'zodiac_tether') {
          required = 10;
        }
        b.requiredInput = required;

        if (b.inputBuffer >= b.requiredInput) {
          b.cooldown++;
          if (b.cooldown >= b.maxCooldown) {
            const spawnX = b.col * this.cellSize + this.cellSize / 2;
            const spawnY = b.row * this.cellSize + this.cellSize / 2;
            
            const isBlocked = this.conveyorItems.some(item => {
              const dx = item.x - spawnX;
              const dy = item.y - spawnY;
              return (dx * dx + dy * dy) < 480;
            });

            if (isBlocked || this.conveyorItems.length >= 300) {
              b.cooldown = b.maxCooldown; // wait
            } else {
              b.cooldown = 0;
              b.inputBuffer -= b.requiredInput;
              
              // Gemini tech: 25% chance to output double core/element
              const doubleChance = this.unlockedTech.includes('gemini') && Math.random() < 0.25;
              const outputCount = doubleChance ? 2 : 1;

              let outType = 'exotic_core';
              let outColor = '#ff33ff';

              if (target === 'zodiac_tether') {
                outType = 'zodiac_tether';
                outColor = '#ffb300';
              } else if (target.startsWith('terrestrial_')) {
                // Map target name to item type
                const suffix = target.replace('terrestrial_', '');
                outType = `item_${suffix}`;
                
                const colors = {
                  earth: '#c2b09e',
                  air: '#b3e5fc',
                  water: '#42a5f5',
                  metal: '#cfd8dc',
                  soil: '#8d6e63',
                  symmetry: '#00e5ff'
                };
                outColor = colors[suffix] || '#ffffff';
              }

              for (let c = 0; c < outputCount; c++) {
                this.conveyorItems.push({
                  id: `transmuted-${Date.now()}-${Math.random()}`,
                  x: spawnX,
                  y: spawnY,
                  spawnX: spawnX,
                  spawnY: spawnY,
                  spawnDir: b.direction || 'right',
                  targetCol: b.col,
                  targetRow: b.row,
                  itemType: outType,
                  progress: 0,
                  color: outColor,
                  age: 0
                });
              }

              if (outType === 'exotic_core') {
                this.inventory.exoticCores += outputCount;
                this.addProductionStat('exoticCores', outputCount);
              } else if (outType === 'zodiac_tether') {
                this.inventory.zodiacTethers += outputCount;
                this.addProductionStat('zodiacTethers', outputCount);
              } else {
                // terrestrial elements
                const nameKey = target.replace('terrestrial_', '') + 'Element';
                // (soil goes to soilElement, metal goes to metalElement, symmetry goes to symmetryCrystal)
                const realKey = nameKey === 'symmetryElement' ? 'symmetryCrystal' : nameKey;
                if (this.inventory[realKey] !== undefined) {
                  this.inventory[realKey] += outputCount;
                  this.addProductionStat(realKey, outputCount);
                }
              }

              window.appendLog(`⚛️ PROCESSOR: Transmuted ${outputCount} [${outType.toUpperCase()}] from raw matter matrices.`);
              this.updateUiDisplay();
            }
          }
        }
      } else if (b.type === 'assembler') {
        if (this.factoryActive === false) {
          b.cooldown = 0;
          return;
        }

        const recipe = b.recipe || 'part_hull';
        const canProduce = (b.inputBuffer >= 4);

        if (canProduce) {
          b.cooldown++;
          if (b.cooldown >= b.maxCooldown) {
            let spawnCol = b.col;
            let spawnRow = b.row;
            if (b.direction === 'right') {
              spawnCol = b.col + 1;
              spawnRow = b.row;
            } else if (b.direction === 'left') {
              spawnCol = b.col - 1;
              spawnRow = b.row;
            } else if (b.direction === 'down') {
              spawnRow = b.row + 1;
              spawnCol = b.col;
            } else if (b.direction === 'up') {
              spawnRow = b.row - 1;
              spawnCol = b.col;
            }
            const spawnX = spawnCol * this.cellSize + this.cellSize / 2;
            const spawnY = spawnRow * this.cellSize + this.cellSize / 2;
            
            const isBlocked = this.conveyorItems.some(item => {
              const dx = item.x - spawnX;
              const dy = item.y - spawnY;
              return (dx * dx + dy * dy) < 480;
            });

            if (isBlocked || this.conveyorItems.length >= 300) {
              b.cooldown = b.maxCooldown; // wait
            } else {
              b.cooldown = 0;
              b.inputBuffer -= 4;

              const spawnItemType = recipe; // 'part_hull', 'part_movement', 'part_gun'
              const spawnColor = recipe === 'part_hull' ? '#cfd8dc' : recipe === 'part_movement' ? '#b3e5fc' : '#ff3344';

              this.conveyorItems.push({
                id: `assembled-${Date.now()}-${Math.random()}`,
                x: spawnX,
                y: spawnY,
                spawnX: spawnX,
                spawnY: spawnY,
                spawnDir: b.direction || 'right',
                targetCol: spawnCol,
                targetRow: spawnRow,
                itemType: spawnItemType,
                progress: 0,
                color: spawnColor,
                age: 0
              });
              window.appendLog(`📦 ASSEMBLER: Completed assembly: [${spawnItemType.toUpperCase().replace('PART_', 'PART: ')}]. Routing to belt.`);
            }
          }
        }
      } else if (b.type === 'factory') {
        if (this.factoryActive === false) {
          b.cooldown = 0;
          return;
        }

        const recipe = b.recipe || 'unit_raider';
        const normRecipe = recipe.replace('unit_', '');

        let requiredPartHull = 0;
        let requiredPartMovement = 0;
        let requiredPartGun = 0;

        if (normRecipe === 'raider' || recipe === 'raider') {
          requiredPartHull = 1; requiredPartMovement = 1; requiredPartGun = 1;
        } else if (normRecipe === 'tank' || recipe === 'tank') {
          requiredPartHull = 2; requiredPartMovement = 1; requiredPartGun = 2;
        } else if (normRecipe === 'gunship' || recipe === 'gunship') {
          requiredPartHull = 2; requiredPartMovement = 2; requiredPartGun = 2;
        }

        const canProduce = (b.hullBuffer >= requiredPartHull && b.movementBuffer >= requiredPartMovement && b.gunBuffer >= requiredPartGun);

        if (canProduce) {
          b.cooldown++;
          if (b.cooldown >= b.maxCooldown) {
            let spawnCol = b.col;
            let spawnRow = b.row;
            if (b.direction === 'right') {
              spawnCol = b.col + 2;
              const beltB = this.getBuildingAtCell(b.col + 2, b.row + 1);
              if (beltB && beltB.type === 'belt') {
                spawnRow = b.row + 1;
              } else {
                spawnRow = b.row;
              }
            } else if (b.direction === 'left') {
              spawnCol = b.col - 1;
              const beltB = this.getBuildingAtCell(b.col - 1, b.row + 1);
              if (beltB && beltB.type === 'belt') {
                spawnRow = b.row + 1;
              } else {
                spawnRow = b.row;
              }
            } else if (b.direction === 'down') {
              spawnRow = b.row + 2;
              const beltB = this.getBuildingAtCell(b.col + 1, b.row + 2);
              if (beltB && beltB.type === 'belt') {
                spawnCol = b.col + 1;
              } else {
                spawnCol = b.col;
              }
            } else if (b.direction === 'up') {
              spawnRow = b.row - 1;
              const beltB = this.getBuildingAtCell(b.col + 1, b.row - 1);
              if (beltB && beltB.type === 'belt') {
                spawnCol = b.col + 1;
              } else {
                spawnCol = b.col;
              }
            }
            const spawnX = spawnCol * this.cellSize + this.cellSize / 2;
            const spawnY = spawnRow * this.cellSize + this.cellSize / 2;
            
            const isBlocked = this.conveyorItems.some(item => {
              const dx = item.x - spawnX;
              const dy = item.y - spawnY;
              return (dx * dx + dy * dy) < 480;
            });

            if (isBlocked || this.conveyorItems.length >= 300) {
              b.cooldown = b.maxCooldown; // wait
            } else {
              b.cooldown = 0;
              b.hullBuffer -= requiredPartHull;
              b.movementBuffer -= requiredPartMovement;
              b.gunBuffer -= requiredPartGun;

              const pureRecipe = recipe.replace('unit_', '');
              const spawnItemType = `assembled_${pureRecipe}`;
              const spawnColor = '#00ff66';

              this.conveyorItems.push({
                id: `assembled-${Date.now()}-${Math.random()}`,
                x: spawnX,
                y: spawnY,
                spawnX: spawnX,
                spawnY: spawnY,
                spawnDir: b.direction || 'right',
                targetCol: spawnCol,
                targetRow: spawnRow,
                itemType: spawnItemType,
                progress: 0,
                color: spawnColor,
                age: 0
              });
              window.appendLog(`🏭 FACTORY: Completed assembly: [${spawnItemType.toUpperCase()}]. Routing to belt.`);
            }
          }
        }
      }
    });

    if (this.conveyorItems) {
      this.conveyorItems.forEach(item => {
        const col = Math.floor(item.x / this.cellSize);
        const row = Math.floor(item.y / this.cellSize);
        const b = this.getBuildingAtCell(col, row);
        
        if (b && b.type === 'belt') {
          item.speed = 2.0;
          item.spawnX = col * this.cellSize + this.cellSize / 2;
          item.spawnY = row * this.cellSize + this.cellSize / 2;
          item.spawnDir = b.direction || 'right';
        } else {
          const dx = item.x - (item.spawnX || item.x);
          const dy = item.y - (item.spawnY || item.y);
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          let speedMultiplier = 1.0;
          if (dist > 120) {
            speedMultiplier = Math.max(0, 1 - (dist - 120) / 80);
          }
          item.speed = 1.5 * speedMultiplier;
        }

        // Check if item is on a belt
        const isOnBelt = (b && b.type === 'belt');

        if (isOnBelt) {
          item.age = 0;
        } else {
          item.age++;
        }
      });
    }

    for (let i = 0; i < this.conveyorItems.length; i++) {
      const itemA = this.conveyorItems[i];
      const colA = Math.floor(itemA.x / this.cellSize);
      const rowA = Math.floor(itemA.y / this.cellSize);
      const bA = this.getBuildingAtCell(colA, rowA);
      
      const currentDir = (bA && bA.type === 'belt') ? bA.direction : (itemA.spawnDir || 'right');

      const currentGate = this.buildings.find(b => b.col === colA && b.row === rowA && b.type === 'deployer');
      if (currentGate && !currentGate.active && itemA.itemType.startsWith('assembled_')) {
        itemA.speed = 0;
        continue;
      }

      for (let j = 0; j < this.conveyorItems.length; j++) {
        if (i === j) continue;
        const itemB = this.conveyorItems[j];
        const dx = itemB.x - itemA.x;
        const dy = itemB.y - itemA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 14) {
          let isAhead = false;
          if (currentDir === 'right' && dx > 0 && Math.abs(dy) < 6) isAhead = true;
          else if (currentDir === 'left' && dx < 0 && Math.abs(dy) < 6) isAhead = true;
          else if (currentDir === 'down' && dy > 0 && Math.abs(dx) < 6) isAhead = true;
          else if (currentDir === 'up' && dy < 0 && Math.abs(dx) < 6) isAhead = true;

          if (isAhead && itemB.speed <= 0.1) {
            itemA.speed = 0;
            break;
          }
        }
      }
    }

    // Actually move conveyor items
    this.conveyorItems.forEach(item => {
      const col = Math.floor(item.x / this.cellSize);
      const row = Math.floor(item.y / this.cellSize);
      const b = this.getBuildingAtCell(col, row);
      const speed = item.speed !== undefined ? item.speed : 1.5;

      if (speed > 0) {
        const dir = (b && b.type === 'belt') ? b.direction : (item.spawnDir || 'right');
        if (dir === 'right') item.x += speed;
        else if (dir === 'down') item.y += speed;
        else if (dir === 'left') item.x -= speed;
        else if (dir === 'up') item.y -= speed;
      }
    });

    // 4. Collision checking: swallow items entering silos, synthesizers, assemblers, or Spacetime Portal
    this.conveyorItems = this.conveyorItems.filter(item => {
      const col = Math.floor(item.x / this.cellSize);
      const row = Math.floor(item.y / this.cellSize);

      if (item.age > 100) {
        this.spawnExplosion(item.x, item.y, '#ff3344', 5);
        window.appendLog("🧹 MAINTENANCE: Cleared stray production material.");
        return false;
      }

      const storeItem = (type, isSilo) => {
        const typeLabel = isSilo ? "STORAGE_SILO" : "PORTAL_CORE";
        if (type === 'assembled_raider') {
          this.standingArmy.raider++;
          this.addProductionStat('raider', 1);
          window.appendLog(`🛸 ${typeLabel}: Vanguard Raider warped into Standing reserves!`);
        } else if (type === 'assembled_tank') {
          this.standingArmy.tank++;
          this.addProductionStat('tank', 1);
          window.appendLog(`🛸 ${typeLabel}: Goliath Heavy Tank warped into Standing reserves!`);
        } else if (type === 'assembled_gunship') {
          this.standingArmy.gunship++;
          this.addProductionStat('gunship', 1);
          window.appendLog(`🛸 ${typeLabel}: Reaver Gunship warped into Standing reserves!`);
        } else if (type === 'exotic_core') {
          this.inventory.exoticCores++;
          this.addProductionStat('exoticCores', 1);
          window.appendLog(`⚜️ ${typeLabel}: Transferred raw Exotic Core to storage vaults.`);
        } else if (type === 'zodiac_tether') {
          this.inventory.zodiacTethers++;
          this.addProductionStat('zodiacTethers', 1);
          window.appendLog(`⚜️ ${typeLabel}: Transferred high frequency Zodiac Tether to mainframe launcher.`);
        } else if (type.startsWith('item_')) {
          const suffix = type.replace('item_', '');
          const nameKey = suffix + 'Element';
          const realKey = nameKey === 'symmetryElement' ? 'symmetryCrystal' : nameKey;
          if (this.inventory[realKey] !== undefined) {
            this.inventory[realKey]++;
            this.addProductionStat(realKey, 1);
            window.appendLog(`💎 ${typeLabel}: Secured transmuted element [${suffix.toUpperCase()}] inside storage banks.`);
          }
        } else {
          // parts or raw matter
          const refund = type.startsWith('part_') ? 15 : 10;
          this.inventory.quantumMatter += refund;
          this.addProductionStat('quantumMatter', refund);
          window.appendLog(`🧹 ${typeLabel}: Recycled stray production material [${type.toUpperCase()}] for +${refund} QM.`);
        }
      };

      // Check if item hit the permanent central Spacetime Gate (cols 5-6, rows 5-6)
      if (this.isCentralPortalCell(col, row)) {
        this.spawnExplosion(item.x, item.y, item.color, 15);
        storeItem(item.itemType, false);
        this.updateUiDisplay();
        if (window.saveGame) window.saveGame();
        return false;
      }

      const target = this.getBuildingAtCell(col, row);
      if (target) {
        if (target.type === 'storage') {
          this.spawnExplosion(item.x, item.y, item.color, 10);
          storeItem(item.itemType, true);
          this.updateUiDisplay();
          if (window.saveGame) window.saveGame();
          return false; // delete item
        } else if (target.type === 'synthesizer' && item.itemType === 'raw_matter') {
          target.inputBuffer++;
          return false; 
        } else if (target.type === 'assembler') {
          const recipe = target.recipe || 'part_hull';

          // Part assemblers accept raw matter (+1) or corresponding terrestrial element (+4)
          if (item.itemType === 'raw_matter') {
            if (target.inputBuffer < 4) {
              target.inputBuffer++;
              return false;
            }
          } else if (item.itemType.startsWith('item_')) {
            // Check if matching element for part
            const elementSuffix = item.itemType.replace('item_', '');
            let isMatch = false;
            if (recipe === 'part_hull' && elementSuffix === 'metal') isMatch = true;
            else if (recipe === 'part_movement' && elementSuffix === 'air') isMatch = true;
            else if (recipe === 'part_gun' && elementSuffix === 'symmetry') isMatch = true;

            if (isMatch && target.inputBuffer < 4) {
              target.inputBuffer = Math.min(4, target.inputBuffer + 4);
              return false;
            }
          }
        } else if (target.type === 'factory') {
          const recipe = target.recipe || 'unit_raider';
          const normRecipe = recipe.replace('unit_', '');

          // Unit factories accept 'part_hull', 'part_movement', 'part_gun'
          if (item.itemType === 'part_hull') {
            const maxHull = (normRecipe === 'raider' || recipe === 'raider') ? 1 : 2;
            if ((target.hullBuffer || 0) < maxHull) {
              target.hullBuffer = (target.hullBuffer || 0) + 1;
              return false;
            }
          } else if (item.itemType === 'part_movement') {
            const maxMove = (normRecipe === 'gunship' || recipe === 'gunship') ? 2 : 1;
            if ((target.movementBuffer || 0) < maxMove) {
              target.movementBuffer = (target.movementBuffer || 0) + 1;
              return false;
            }
          } else if (item.itemType === 'part_gun') {
            const maxGun = (normRecipe === 'raider' || recipe === 'raider') ? 1 : 2;
            if ((target.gunBuffer || 0) < maxGun) {
              target.gunBuffer = (target.gunBuffer || 0) + 1;
              return false;
            }
          }
        } else if (target.type === 'deployer' && item.itemType.startsWith('assembled_')) {
          if (target.active) {
            // Also warps directly into our standing army now!
            const vehicleType = item.itemType.replace('assembled_', '');
            this.spawnExplosion(item.x, item.y, '#00ff66', 15);
            this.standingArmy[vehicleType]++;
            this.addProductionStat(vehicleType, 1);
            window.appendLog(`🛸 STANDING_ARMY: Assembled ${vehicleType.toUpperCase()} stored via Deploy Gate!`);
            
            this.updateUiDisplay();
            if (window.saveGame) window.saveGame();
            return false;
          }
        }
      }

      // Out of bounds check (delete items drifting too far into locked cells)
      if (!this.isCellUnlocked(col, row)) {
        return false;
      }
      return true;
    });

    // 5. Update aesthetic particles
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = Math.max(0, 1 - p.age / p.maxAge);
      p.age++;
    });
    this.particles = this.particles.filter(p => p.age < p.maxAge);

    // Passive tether fabrication logic
    // Pisces tech: Direct fabrication of Zodiac Tethers costs only 3 Exotic Cores
    const costTethers = this.unlockedTech.includes('pisces') ? 3 : 4;
    if (this.tickCount % 600 === 0 && this.inventory.exoticCores >= costTethers && this.factoryActive !== false) {
      this.inventory.exoticCores -= costTethers;
      this.inventory.zodiacTethers++;
      window.appendLog("⚜️ TETHER_MATRIX: High frequency tethers assembled inside main assembly launcher bay.");
      this.updateUiDisplay();
      if (window.saveGame) window.saveGame();
    }
  }

  // Draw homebase interior grid map
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    // Center of screen panning + zoom
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(this.canvas.width / (2 * this.zoom) + this.cameraX, this.canvas.height / (2 * this.zoom) + this.cameraY);

    // 1. Draw unlocked grid sectors & their cells
    const cameraGridX = Math.floor((-this.cameraX - this.canvas.width/2) / this.cellSize);
    const cameraGridY = Math.floor((-this.cameraY - this.canvas.height/2) / this.cellSize);
    
    // We check a range of sectors around the camera view
    for (let sx = -3; sx <= 4; sx++) {
      for (let sy = -3; sy <= 3; sy++) {
        const xOffset = sx * 12 * this.cellSize;
        const yOffset = sy * 12 * this.cellSize;
        const sectorWidth = 12 * this.cellSize;

        if (this.isSectorUnlocked(sx, sy)) {
          // Draw solid floor background for unlocked sector area
          this.ctx.fillStyle = '#07070c';
          this.ctx.fillRect(xOffset, yOffset, sectorWidth, sectorWidth);

          // Draw grid cell outlines
          this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          for (let c = 0; c <= 12; c++) {
            this.ctx.moveTo(xOffset + c * this.cellSize, yOffset);
            this.ctx.lineTo(xOffset + c * this.cellSize, yOffset + sectorWidth);
          }
          for (let r = 0; r <= 12; r++) {
            this.ctx.moveTo(xOffset, yOffset + r * this.cellSize);
            this.ctx.lineTo(xOffset + sectorWidth, yOffset + r * this.cellSize);
          }
          this.ctx.stroke();

          // Highlight boundary of unlocked sector
          this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(xOffset, yOffset, sectorWidth, sectorWidth);
        } else {
          // Locked sector: draw if adjacent to an unlocked sector
          const isAdjacent = this.unlockedSectors.some(s => {
            return (Math.abs(s.x - sx) + Math.abs(s.y - sy)) === 1;
          });

          if (isAdjacent) {
            // Draw dark crimson/yellow warning background
            this.ctx.fillStyle = 'rgba(255, 51, 68, 0.015)';
            this.ctx.fillRect(xOffset, yOffset, sectorWidth, sectorWidth);

            // Draw dotted borders
            this.ctx.strokeStyle = 'rgba(255, 51, 68, 0.15)';
            this.ctx.lineWidth = 1.0;
            this.ctx.save();
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(xOffset + 2, yOffset + 2, sectorWidth - 4, sectorWidth - 4);
            this.ctx.restore();

            // Render padlock symbol & cost
            const costQM = 200 + this.unlockedSectors.length * 100;
            const costCores = Math.floor(this.unlockedSectors.length / 2) + 1;

            this.ctx.fillStyle = 'rgba(255, 51, 68, 0.65)';
            this.ctx.font = 'bold 9px var(--font-mono)';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`🔒 INTEGRATE SECTOR [${sx}, ${sy}]`, xOffset + sectorWidth/2, yOffset + sectorWidth/2 - 10);
            
            this.ctx.fillStyle = 'rgba(255, 179, 0, 0.7)';
            this.ctx.font = '8px var(--font-mono)';
            this.ctx.fillText(`Cost: ${costQM} QM + ${costCores} Exotic Cores`, xOffset + sectorWidth/2, yOffset + sectorWidth/2 + 8);
          }
        }
      }
    }

    // 2. Draw permanent central Spacetime Gate (Vortex Portal) in Sector (0,0)
    const portalCenterX = 6 * this.cellSize; 
    const portalCenterY = 6 * this.cellSize;
    
    this.ctx.save();
    this.ctx.translate(portalCenterX, portalCenterY);
    
    // Rotating plasma vortex background rings
    const rSpin = this.tickCount * 0.03;
    this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    this.ctx.lineWidth = 3.0;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 32 + Math.sin(this.tickCount * 0.05) * 4, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(255, 51, 255, 0.25)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 20 - Math.sin(this.tickCount * 0.05) * 2, 0, Math.PI * 2);
    this.ctx.stroke();

    // Swirling lines
    this.ctx.rotate(rSpin);
    this.ctx.strokeStyle = '#00ffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    for (let j = 0; j < 4; j++) {
      this.ctx.moveTo(-12, -12);
      this.ctx.lineTo(12, 12);
      this.ctx.rotate(Math.PI / 2);
    }
    this.ctx.stroke();
    
    this.ctx.restore();

    // Portal textual label inside grid
    this.ctx.fillStyle = '#00e5ff';
    this.ctx.font = 'bold 7.5px var(--font-mono)';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🛸 SPACETIME_GATE_CORE', portalCenterX, portalCenterY - 42);

    // 3. Draw Facility Buildings
    this.buildings.forEach(b => {
      const bx = b.col * this.cellSize;
      const by = b.row * this.cellSize;
      const size = b.type === 'factory' ? this.cellSize * 2 : this.cellSize;

      this.ctx.save();
      
      if (b.type === 'extractor') {
        const resType = b.resourceType || 'quantum_matter';
        let outlineColor = '#00ffff';
        let label = 'QM';

        if (resType === 'exotic_core') {
          outlineColor = '#ff33ff';
          label = 'EXOTIC';
        } else if (resType === 'zodiac_tether') {
          outlineColor = '#ffb300';
          label = 'ZODIAC';
        }

        this.ctx.fillStyle = '#0f172a';
        this.ctx.strokeStyle = outlineColor;
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 4, by + 4, size - 8, size - 8);
        this.ctx.strokeRect(bx + 4, by + 4, size - 8, size - 8);

        // Rotating drill bits
        this.ctx.translate(bx + size/2, by + size/2);
        let rotation = 0;
        if (b.direction === 'down') rotation = Math.PI / 2;
        else if (b.direction === 'left') rotation = Math.PI;
        else if (b.direction === 'up') rotation = -Math.PI / 2;
        
        this.ctx.rotate(rotation + this.tickCount * 0.15);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.moveTo(-6, -6); this.ctx.lineTo(6, 6);
        this.ctx.moveTo(6, -6); this.ctx.lineTo(-6, 6);
        this.ctx.stroke();

        this.ctx.restore();
        this.ctx.save();

        this.ctx.fillStyle = outlineColor;
        this.ctx.font = 'bold 6.5px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, bx + size/2, by + size - 7);
      } 
      else if (b.type === 'extractor_element') {
        const resType = b.resourceType || 'earth';
        const colors = {
          earth: '#c2b09e',
          air: '#b3e5fc',
          water: '#42a5f5',
          metal: '#cfd8dc',
          soil: '#8d6e63'
        };
        const outlineColor = colors[resType] || '#ffffff';
        const label = resType.toUpperCase();

        this.ctx.fillStyle = '#0a1c1a'; // Elemental dark green/teal background
        this.ctx.strokeStyle = outlineColor;
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 4, by + 4, size - 8, size - 8);
        this.ctx.strokeRect(bx + 4, by + 4, size - 8, size - 8);

        // Draw rotating element crystalline glyph in the center
        this.ctx.translate(bx + size/2, by + size/2);
        let rotation = 0;
        if (b.direction === 'down') rotation = Math.PI / 2;
        else if (b.direction === 'left') rotation = Math.PI;
        else if (b.direction === 'up') rotation = -Math.PI / 2;

        this.ctx.rotate(rotation + this.tickCount * 0.1);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.0;
        // Draw elegant diamond glyph
        this.ctx.beginPath();
        this.ctx.moveTo(0, -6);
        this.ctx.lineTo(4, 0);
        this.ctx.lineTo(0, 6);
        this.ctx.lineTo(-4, 0);
        this.ctx.closePath();
        this.ctx.stroke();

        this.ctx.restore();
        this.ctx.save();

        this.ctx.fillStyle = outlineColor;
        this.ctx.font = 'bold 6.5px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('E-EXT', bx + size/2, by + 12);
        this.ctx.fillText(label, bx + size/2, by + size - 7);
      }
      else if (b.type === 'belt') {
        this.ctx.fillStyle = '#15151c';
        this.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        this.ctx.lineWidth = 1.0;
        this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
        this.ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);

        // Chevron directional arrows indicating flow
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
        this.ctx.beginPath();
        const animOffset = (this.tickCount * 1.5) % 8;
        
        if (b.direction === 'right') {
          for (let l = 4; l < size; l += 8) {
            const lx = bx + ((l + animOffset) % size);
            this.ctx.moveTo(lx, by + 10);
            this.ctx.lineTo(lx + 4, by + size/2);
            this.ctx.lineTo(lx, by + size - 10);
          }
        } else if (b.direction === 'down') {
          for (let l = 4; l < size; l += 8) {
            const ly = by + ((l + animOffset) % size);
            this.ctx.moveTo(bx + 10, ly);
            this.ctx.lineTo(bx + size/2, ly + 4);
            this.ctx.lineTo(bx + size - 10, ly);
          }
        } else if (b.direction === 'left') {
          for (let l = 4; l < size; l += 8) {
            const lx = bx + size - ((l + animOffset) % size);
            this.ctx.moveTo(lx, by + 10);
            this.ctx.lineTo(lx - 4, by + size/2);
            this.ctx.lineTo(lx, by + size - 10);
          }
        } else if (b.direction === 'up') {
          for (let l = 4; l < size; l += 8) {
            const ly = by + size - ((l + animOffset) % size);
            this.ctx.moveTo(bx + 10, ly);
            this.ctx.lineTo(bx + size/2, ly - 4);
            this.ctx.lineTo(bx + size - 10, ly);
          }
        }
        this.ctx.stroke();
      } 
      else if (b.type === 'synthesizer') {
        const sub = b.subType || 'matter';
        const target = b.transmuteTarget || 'zodiac_core';
        let accentColor = '#ff33ff';
        let label = 'CORE';

        if (target === 'zodiac_tether') {
          accentColor = '#ffb300';
          label = 'TETHER';
        } else if (target === 'exotic_core') {
          accentColor = '#ff33ff';
          label = 'EXOTIC';
        } else if (target === 'zodiac_core') {
          accentColor = '#e040fb';
          label = 'ZODIAC';
        } else if (target.startsWith('terrestrial_')) {
          label = target.replace('terrestrial_', '').toUpperCase();
          const colors = {
            earth: '#c2b09e',
            air: '#b3e5fc',
            water: '#42a5f5',
            metal: '#cfd8dc',
            soil: '#8d6e63',
            symmetry: '#00e5ff'
          };
          accentColor = colors[target.replace('terrestrial_', '')] || '#ffffff';
        }

        this.ctx.fillStyle = '#1e112a';
        this.ctx.strokeStyle = accentColor;
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
        this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

        // Pulsing plasma chamber
        const pulse = 0.15 + 0.1 * Math.sin(this.tickCount * 0.08);
        this.ctx.fillStyle = accentColor;
        this.ctx.globalAlpha = pulse;
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, 9, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
        
        // Output type text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 6.5px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, bx + size/2, by + 12);

        // SubType label
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        this.ctx.font = '5px var(--font-mono)';
        this.ctx.fillText(sub.toUpperCase(), bx + size/2, by + 19);

        // Buffer text
        const req = b.requiredInput || 5;
        this.ctx.fillStyle = accentColor;
        this.ctx.font = 'bold 5.5px var(--font-mono)';
        this.ctx.fillText(`Matter:${b.inputBuffer || 0}/${req}`, bx + size/2, by + size - 6);
      } 
      else if (b.type === 'storage') {
        this.ctx.fillStyle = '#1c1c1c';
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.lineWidth = 1.5;
        this.ctx.fillRect(bx + 4, by + 4, size - 8, size - 8);
        this.ctx.strokeRect(bx + 4, by + 4, size - 8, size - 8);

        this.ctx.fillStyle = '#00ff66';
        this.ctx.beginPath();
        this.ctx.rect(bx + size/2 - 5, by + size/2 - 5, 10, 10);
        this.ctx.fill();
      }
      else if (b.type === 'assembler') {
        const recipe = b.recipe || 'part_hull';

        this.ctx.fillStyle = '#0b0f19';
        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
        this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

        // Robotic laser arms in corners
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1.0;
        this.ctx.beginPath();
        this.ctx.moveTo(bx + 5, by + 5);
        this.ctx.lineTo(bx + 9, by + 9);
        this.ctx.moveTo(bx + size - 5, by + 5);
        this.ctx.lineTo(bx + size - 9, by + 9);
        this.ctx.moveTo(bx + 5, by + size - 5);
        this.ctx.lineTo(bx + 9, by + size - 9);
        this.ctx.moveTo(bx + size - 5, by + size - 5);
        this.ctx.lineTo(bx + size - 9, by + size - 9);
        this.ctx.stroke();

        this.ctx.save();
        this.ctx.translate(bx + size/2, by + size/2);

        // Drawing custom parts blueprints
        const rotAngle = this.tickCount * 0.015;
        this.ctx.rotate(rotAngle);
        if (recipe === 'part_hull') {
          // Draw hexagonal armor shield plate
          this.ctx.strokeStyle = '#cfd8dc';
          this.ctx.fillStyle = 'rgba(207, 216, 220, 0.2)';
          this.ctx.lineWidth = 1.2;
          this.ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * 6.5;
            const py = Math.sin(angle) * 6.5;
            if (i === 0) this.ctx.moveTo(px, py);
            else this.ctx.lineTo(px, py);
          }
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        } else if (recipe === 'part_movement') {
          // Draw rocket thruster jet chevron
          this.ctx.strokeStyle = '#b3e5fc';
          this.ctx.fillStyle = 'rgba(179, 229, 252, 0.2)';
          this.ctx.lineWidth = 1.2;
          this.ctx.beginPath();
          this.ctx.moveTo(-5.5, 5.5);
          this.ctx.lineTo(0, -7);
          this.ctx.lineTo(5.5, 5.5);
          this.ctx.lineTo(0, 1.5);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        } else if (recipe === 'part_gun') {
          // Draw crossed blaster lines
          this.ctx.strokeStyle = '#ff3344';
          this.ctx.lineWidth = 1.6;
          this.ctx.beginPath();
          this.ctx.moveTo(-5.5, -5.5); this.ctx.lineTo(5.5, 5.5);
          this.ctx.moveTo(5.5, -5.5); this.ctx.lineTo(-5.5, 5.5);
          this.ctx.stroke();
        }

        this.ctx.restore();

        // Progress build cooldown indicator ring
        const radius = 7;
        const cooldownActive = (b.inputBuffer >= 4);
        if (cooldownActive) {
          this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, radius + 5, 0, Math.PI * 2);
          this.ctx.stroke();

          const angleEnd = (b.cooldown / b.maxCooldown) * Math.PI * 2;
          this.ctx.strokeStyle = '#94a3b8';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, radius + 5, -Math.PI / 2, -Math.PI / 2 + angleEnd);
          this.ctx.stroke();
        }

        // Texts
        this.ctx.fillStyle = '#cfd8dc';
        this.ctx.font = 'bold 5px var(--font-mono)';
        this.ctx.textAlign = 'center';
        
        let displayRecipe = recipe.toUpperCase().replace('PART_', 'PART: ');
        this.ctx.fillText(displayRecipe, bx + size/2, by + size - 4);

        this.ctx.font = '4.5px var(--font-mono)';
        this.ctx.fillStyle = '#a1a1aa';
        this.ctx.fillText(`Matter:${b.inputBuffer || 0}/4`, bx + size/2, by + 8);
      }
      else if (b.type === 'factory') {
        const recipe = b.recipe || 'unit_raider';

        this.ctx.fillStyle = '#070a13';
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.lineWidth = 2.0;
        this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
        this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

        // Robotic laser arms in corners of 2x2
        this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(bx + 8, by + 8);
        this.ctx.lineTo(bx + 20, by + 20);
        this.ctx.moveTo(bx + size - 8, by + 8);
        this.ctx.lineTo(bx + size - 20, by + 20);
        this.ctx.moveTo(bx + 8, by + size - 8);
        this.ctx.lineTo(bx + size - 20, by + size - 20);
        this.ctx.moveTo(bx + size - 8, by + size - 8);
        this.ctx.lineTo(bx + size - 20, by + size - 20);
        this.ctx.stroke();

        // Pulsing power core circle in the middle
        const pulseCore = 6 + 1.5 * Math.sin(this.tickCount * 0.1);
        this.ctx.fillStyle = 'rgba(0, 255, 102, 0.1)';
        this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.35)';
        this.ctx.lineWidth = 1.0;
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, pulseCore, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.save();
        this.ctx.translate(bx + size/2, by + size/2);

        // Holographic vehicle projection floating and rotating slowly!
        const hoverOffset = Math.sin(this.tickCount * 0.08) * 2;
        const rotateAngle = this.tickCount * 0.02;
        const radius = recipe.includes('tank') ? 14 : recipe.includes('gunship') ? 12 : 10;
        this.drawUnitArt(recipe.replace('unit_', ''), 0, hoverOffset, radius, rotateAngle, 0.7);

        this.ctx.restore();

        // Progress build cooldown indicator ring
        const cooldownActive = (b.hullBuffer > 0 || b.movementBuffer > 0 || b.gunBuffer > 0);
        if (cooldownActive) {
          this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
          this.ctx.lineWidth = 1.8;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, radius + 8, 0, Math.PI * 2);
          this.ctx.stroke();

          const angleEnd = (b.cooldown / b.maxCooldown) * Math.PI * 2;
          this.ctx.strokeStyle = '#00ff66';
          this.ctx.lineWidth = 1.8;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, radius + 8, -Math.PI / 2, -Math.PI / 2 + angleEnd);
          this.ctx.stroke();
        }

        // Texts
        this.ctx.fillStyle = '#00ff66';
        this.ctx.font = 'bold 7.5px var(--font-mono)';
        this.ctx.textAlign = 'center';
        
        let displayRecipe = recipe.toUpperCase();
        if (displayRecipe.startsWith('UNIT_')) displayRecipe = displayRecipe.replace('UNIT_', 'UNIT: ');
        else displayRecipe = `UNIT: ${displayRecipe}`;
        this.ctx.fillText(displayRecipe, bx + size/2, by + size - 8);

        this.ctx.font = '6.5px var(--font-mono)';
        this.ctx.fillStyle = '#67e8f9';
        this.ctx.fillText(`H:${b.hullBuffer||0} E:${b.movementBuffer||0} W:${b.gunBuffer||0}`, bx + size/2, by + 14);
      }
      else if (b.type === 'deployer') {
        this.ctx.fillStyle = '#22252a';
        this.ctx.strokeStyle = b.active ? '#00e5ff' : '#ff3344';
        this.ctx.lineWidth = 2.0;
        this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
        this.ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);

        this.ctx.fillStyle = b.active ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 51, 68, 0.2)';
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, 10, 0, Math.PI * 2);
        this.ctx.fill();

        const alphaPulse = 0.5 + 0.3 * Math.sin(this.tickCount * 0.1);
        this.ctx.fillStyle = b.active ? `rgba(0, 229, 255, ${alphaPulse})` : `rgba(255, 51, 68, ${alphaPulse})`;
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, 4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = b.active ? '#00e5ff' : '#ff3344';
        this.ctx.font = '6px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(b.active ? 'DEPLOYING' : 'HOLDING', bx + size/2, by + size - 6);
      }

      if (['synthesizer', 'assembler', 'factory', 'deployer', 'extractor', 'extractor_element'].includes(b.type)) {
        this.drawDirectionArrow(bx, by, b.direction || 'right', 'rgba(255, 255, 255, 0.45)', size);
      }

      this.ctx.restore();
    });

    // 4. Draw flowing Conveyed vehicle and resource particles
    this.conveyorItems.forEach(item => {
      this.ctx.save();
      
      if (item.itemType.startsWith('assembled_')) {
        const type = item.itemType.replace('assembled_', '');
        const col = Math.floor(item.x / this.cellSize);
        const row = Math.floor(item.y / this.cellSize);
        const b = this.getBuildingAtCell(col, row);
        const dir = (b && b.type === 'belt') ? b.direction : (item.spawnDir || 'right');
        
        let angle = 0;
        if (dir === 'down') angle = Math.PI / 2;
        else if (dir === 'left') angle = Math.PI;
        else if (dir === 'up') angle = -Math.PI / 2;

        this.drawUnitArt(type, item.x, item.y, 4.5, angle, 1.0);
      } else {
        this.ctx.fillStyle = item.color;
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = item.color;
        
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    });

    // 5. Draw aesthetic particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      this.ctx.restore();
    });

    // 6. Draw active cursor placement tool preview indicator
    if (this.selectedTool) {
      const worldPos = this.screenToWorld(window.mousePos?.x || 0, window.mousePos?.y || 0);
      const mouseCol = Math.floor(worldPos.x / this.cellSize);
      const mouseRow = Math.floor(worldPos.y / this.cellSize);
      
      const bx = mouseCol * this.cellSize;
      const by = mouseRow * this.cellSize;
      const size = this.selectedTool === 'factory' ? 2 * this.cellSize : this.cellSize;
      const pDir = this.placementDirection || 'right';

      let isValid = true;
      if (this.selectedTool === 'demolish') {
        isValid = !!this.getBuildingAtCell(mouseCol, mouseRow);
      } else if (this.selectedTool === 'factory') {
        for (let dc = 0; dc < 2; dc++) {
          for (let dr = 0; dr < 2; dr++) {
            const c = mouseCol + dc;
            const r = mouseRow + dr;
            if (!this.isCellUnlocked(c, r) || this.isCentralPortalCell(c, r) || this.getBuildingAtCell(c, r)) {
              isValid = false;
            }
          }
        }
      } else {
        isValid = this.isCellUnlocked(mouseCol, mouseRow) && 
                  !this.isCentralPortalCell(mouseCol, mouseRow) && 
                  !this.getBuildingAtCell(mouseCol, mouseRow);
      }

      if (this.isCellUnlocked(mouseCol, mouseRow)) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.55;

        if (this.isCentralPortalCell(mouseCol, mouseRow) && this.selectedTool !== 'demolish') {
          // Block preview drawing inside central portal
          this.ctx.strokeStyle = '#ff3344';
          this.ctx.lineWidth = 2.0;
          this.ctx.strokeRect(bx, by, size, size);
          this.ctx.restore();
        } else {
          if (this.selectedTool === 'extractor') {
            this.ctx.fillStyle = '#112233';
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 1.5;
            this.ctx.fillRect(bx + 4, by + 4, size - 8, size - 8);
            this.ctx.strokeRect(bx + 4, by + 4, size - 8, size - 8);
            this.drawDirectionArrow(bx, by, pDir, '#00ffff');
          } 
          else if (this.selectedTool === 'belt') {
            this.ctx.fillStyle = '#15151c';
            this.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            this.ctx.lineWidth = 1.0;
            this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
            this.ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);
            this.drawDirectionArrow(bx, by, pDir, '#00ffff');
          } 
          else if (this.selectedTool && this.selectedTool.startsWith('synthesizer_')) {
            const sub = this.selectedTool.replace('synthesizer_', '');
            let previewColor = '#ff33ff';
            if (sub === 'elements') previewColor = '#42a5f5';
            else if (sub === 'zodiac') previewColor = '#ffb300';

            this.ctx.fillStyle = '#1e112a';
            this.ctx.strokeStyle = previewColor;
            this.ctx.lineWidth = 1.8;
            this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
            this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);
            this.drawDirectionArrow(bx, by, pDir, previewColor);
          } 
          else if (this.selectedTool === 'storage') {
            this.ctx.fillStyle = '#1c1c1c';
            this.ctx.strokeStyle = '#00ff66';
            this.ctx.lineWidth = 1.5;
            this.ctx.fillRect(bx + 4, by + 4, size - 8, size - 8);
            this.ctx.strokeRect(bx + 4, by + 4, size - 8, size - 8);
          }
          else if (this.selectedTool === 'assembler') {
            this.ctx.fillStyle = '#1e2430';
            this.ctx.strokeStyle = '#94a3b8';
            this.ctx.lineWidth = 1.8;
            this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
            this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);
            this.drawDirectionArrow(bx, by, pDir, '#94a3b8', size);

            // Draw a tiny rotating hex/armor plate in the preview
            this.ctx.save();
            this.ctx.translate(bx + size/2, by + size/2);
            this.ctx.rotate(this.tickCount * 0.02);
            this.ctx.strokeStyle = '#cfd8dc';
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (i * Math.PI) / 3;
              this.ctx.lineTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
            }
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.restore();
          }
          else if (this.selectedTool === 'factory') {
            this.ctx.fillStyle = '#0f172a';
            this.ctx.strokeStyle = '#00ff66';
            this.ctx.lineWidth = 1.8;
            this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
            this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);
            this.drawDirectionArrow(bx, by, pDir, '#00ff66', size);

            // Floating raider hologram in the unit factory preview
            this.drawUnitArt('raider', bx + size/2, by + size/2, 10, this.tickCount * 0.02, 0.4);
          }
          else if (this.selectedTool === 'deployer') {
            this.ctx.fillStyle = '#22252a';
            this.ctx.strokeStyle = '#00e5ff';
            this.ctx.lineWidth = 2.0;
            this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
            this.ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);
            this.drawDirectionArrow(bx, by, pDir, '#00e5ff');
          }
          else if (this.selectedTool === 'demolish') {
            this.ctx.fillStyle = 'rgba(255, 51, 68, 0.25)';
            this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
          }
          this.ctx.restore();

          // Highlight frame indicating build location validity
          this.ctx.strokeStyle = isValid ? '#00ffff' : '#ff3344';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(bx, by, size, size);
        }

        // Floating R Key rotation guide near mouse
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(3, 3, 6, 0.9)';
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
        this.ctx.lineWidth = 1.0;
        
        const tooltipText = '[R] Rotate | [Right-Click] Cancel';
        this.ctx.font = 'bold 9px var(--font-mono)';
        const textWidth = this.ctx.measureText(tooltipText).width;
        const tx = Math.max(-200, Math.min(600, bx + size/2 - textWidth/2));
        const ty = by - 16;
        
        this.ctx.fillRect(tx - 6, ty - 10, textWidth + 12, 16);
        this.ctx.strokeRect(tx - 6, ty - 10, textWidth + 12, 16);
        
        this.ctx.fillStyle = '#00ffff';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(tooltipText, tx, ty + 1.5);
        this.ctx.restore();
      }
    }

    this.ctx.restore();
  }

  // Draw small arrows indicating oriented building outputs, with support for custom sizes
  drawDirectionArrow(bx, by, dir, color, customSize) {
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 1.5;
    
    const s = customSize || this.cellSize;
    this.ctx.translate(bx + s / 2, by + s / 2);
    
    const arrowOffset = s > this.cellSize ? (s / 2 - 12) : 0;
    if (dir === 'right') {
      this.ctx.rotate(0);
      this.ctx.translate(arrowOffset, 0);
    } else if (dir === 'down') {
      this.ctx.rotate(Math.PI / 2);
      this.ctx.translate(arrowOffset, 0);
    } else if (dir === 'left') {
      this.ctx.rotate(Math.PI);
      this.ctx.translate(arrowOffset, 0);
    } else if (dir === 'up') {
      this.ctx.rotate(-Math.PI / 2);
      this.ctx.translate(arrowOffset, 0);
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(-10, 0);
    this.ctx.lineTo(10, 0);
    this.ctx.moveTo(5, -3);
    this.ctx.lineTo(10, 0);
    this.ctx.lineTo(5, 3);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  // Draw high-fidelity vector unit art that is 1-to-1 matching with the battle of Conquest field
  drawUnitArt(type, x, y, radius, angle, alpha = 1.0) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.globalAlpha = alpha;

    if (type === 'raider') {
      this.ctx.fillStyle = '#011508';
      this.ctx.strokeStyle = '#00ff66';
      this.ctx.lineWidth = 1.8;
      this.ctx.shadowColor = '#00ff66';
      this.ctx.shadowBlur = 6;

      this.ctx.beginPath();
      this.ctx.moveTo(radius * 1.2, 0);
      this.ctx.lineTo(-radius * 0.8, -radius * 0.8);
      this.ctx.lineTo(-radius * 0.4, 0);
      this.ctx.lineTo(-radius * 0.8, radius * 0.8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (type === 'tank') {
      this.ctx.fillStyle = '#221500';
      this.ctx.strokeStyle = '#ffb300';
      this.ctx.lineWidth = 2.0;
      this.ctx.shadowColor = '#ffb300';
      this.ctx.shadowBlur = 7;

      this.ctx.beginPath();
      this.ctx.moveTo(radius * 1.2, 0);
      this.ctx.lineTo(radius * 0.4, -radius);
      this.ctx.lineTo(-radius * 0.8, -radius * 0.8);
      this.ctx.lineTo(-radius, 0);
      this.ctx.lineTo(-radius * 0.8, radius * 0.8);
      this.ctx.lineTo(radius * 0.4, radius);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2.2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -radius * 0.3);
      this.ctx.lineTo(radius * 1.5, -radius * 0.3);
      this.ctx.moveTo(0, radius * 0.3);
      this.ctx.lineTo(radius * 1.5, radius * 0.3);
      this.ctx.stroke();
    } else if (type === 'gunship') {
      this.ctx.fillStyle = '#12011a';
      this.ctx.strokeStyle = '#ff33ff';
      this.ctx.lineWidth = 1.8;
      this.ctx.shadowColor = '#ff33ff';
      this.ctx.shadowBlur = 6;

      this.ctx.beginPath();
      this.ctx.moveTo(radius, 0);
      this.ctx.lineTo(0, -radius * 0.8);
      this.ctx.lineTo(-radius * 0.8, -radius * 0.4);
      this.ctx.lineTo(-radius * 0.4, 0);
      this.ctx.lineTo(-radius * 0.8, radius * 0.4);
      this.ctx.lineTo(0, radius * 0.8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}
