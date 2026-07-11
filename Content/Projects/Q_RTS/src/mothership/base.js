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

    // Selected building for placement
    this.selectedTool = null; // 'extractor', 'belt', 'synthesizer', 'storage', 'assembler', 'deployer', 'demolish'
    this.placementDirection = 'right';

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
      unlockedTech: this.unlockedTech
    };
    if (window.GameStorage) {
      window.GameStorage.save('mothership_base_state', data)
        .catch(err => console.error("Failed to save state to IndexedDB:", err));
    }
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
            
            // Clear transient states
            this.conveyorItems = [];
            this.particles = [];
            
            this.updateUiDisplay();
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
      col: 4, row: 3,
      name: 'Transmuter Core',
      inputBuffer: 0,
      requiredInput: 5,
      cooldown: 0,
      maxCooldown: 90,
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
    // Assembler 1
    this.buildings.push({
      id: 'assembler-1',
      type: 'assembler',
      col: 8, row: 4,
      recipe: 'raider',
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
      col: 16, row: 4,
      name: 'Aux Transmuter',
      inputBuffer: 0,
      requiredInput: 5,
      cooldown: 0,
      maxCooldown: 90,
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
      
      const b = this.buildings.find(b => b.col === col && b.row === row);
      if (b) {
        if (this.isCentralPortalCell(col, row)) return;
        const idx = dirs.indexOf(b.direction || 'right');
        b.direction = dirs[(idx + 1) % 4];
        window.appendLog(`🔄 FACILITY_ROTATION: Rotated ${b.type.toUpperCase()} at [${col}, ${row}] to face [${b.direction.toUpperCase()}].`);
        if (window.saveGame) window.saveGame();
      }
    }
  }

  // Map screen mouse position back to world factory coordinates, taking camera panning offsets into account
  screenToWorld(screenX, screenY) {
    const originX = this.canvas.width / 2 + this.cameraX;
    const originY = this.canvas.height / 2 + this.cameraY;
    return {
      x: screenX - originX,
      y: screenY - originY
    };
  }

  // Double click handling for quick recipe/gate toggle
  handleDoubleClick(screenX, screenY) {
    const worldPos = this.screenToWorld(screenX, screenY);
    const col = Math.floor(worldPos.x / this.cellSize);
    const row = Math.floor(worldPos.y / this.cellSize);
    
    if (!this.isCellUnlocked(col, row)) return;

    const b = this.buildings.find(b => b.col === col && b.row === row);
    if (b) {
      if (b.type === 'assembler') {
        const recipes = ['raider', 'tank', 'gunship'];
        const currentIdx = recipes.indexOf(b.recipe || 'raider');
        b.recipe = recipes[(currentIdx + 1) % 3];
        b.cooldown = 0;
        window.appendLog(`🛠️ ASSEMBLER: Changed recipe at [${col}, ${row}] to build [${b.recipe.toUpperCase()}].`);
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
      const existingIdx = this.buildings.findIndex(b => b.col === col && b.row === row);
      
      if (this.selectedTool === 'demolish') {
        if (existingIdx !== -1) {
          const removed = this.buildings.splice(existingIdx, 1)[0];
          
          // Libra tech: Symmetry Matrix refunds full cost, otherwise 15 QM refund
          const hasLibra = this.unlockedTech.includes('libra');
          const refund = hasLibra ? (removed.type === 'extractor' ? 60 : removed.type === 'belt' ? 15 : removed.type === 'synthesizer' ? 120 : removed.type === 'storage' ? 80 : removed.type === 'assembler' ? 150 : 100) : 15;
          
          this.inventory.quantumMatter += refund;
          window.appendLog(`🚜 FACTORY: Demolished ${removed.type.toUpperCase()} at [${col}, ${row}]. Refunded ${refund} QM.`);
          if (window.saveGame) window.saveGame();
        }
        return;
      }

      if (existingIdx !== -1) {
        window.appendLog("⚠️ GRID_BLOCKED: Cell already occupied by another facility.");
        return;
      }

      // Spend QM to build
      const costs = { extractor: 60, belt: 15, synthesizer: 120, storage: 80, assembler: 150, deployer: 100 };
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
        // Leo tech: Extractor Drills operate +50% faster (shorter cooldown)
        const hasLeo = this.unlockedTech.includes('leo');
        bData.maxCooldown = hasLeo ? 26 : 40;
      } else if (this.selectedTool === 'synthesizer') {
        bData.inputBuffer = 0;
        bData.requiredInput = 5;
        bData.cooldown = 0;
        bData.maxCooldown = 90;
      } else if (this.selectedTool === 'assembler') {
        bData.recipe = 'raider';
        bData.inputBuffer = 0;
        bData.cooldown = 0;
        // Aquarius tech: Decreases assembler cooldowns by 40%
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
      const b = this.buildings.find(b => b.col === col && b.row === row);
      if (b) {
        if (isShiftKey) {
          if (b.type === 'assembler') {
            const recipes = ['raider', 'tank', 'gunship'];
            const currentIdx = recipes.indexOf(b.recipe || 'raider');
            b.recipe = recipes[(currentIdx + 1) % 3];
            b.cooldown = 0;
            window.appendLog(`🛠️ ASSEMBLER: Changed recipe at [${col}, ${row}] to build [${b.recipe.toUpperCase()}].`);
          } else if (b.type === 'deployer') {
            b.active = !b.active;
            window.appendLog(`🚚 DEPLOY_GATE: Gate at [${col}, ${row}] toggled [${b.active ? 'OPEN (DEPLOY)' : 'CLOSED (HOLD)'}].`);
          } else {
            const dirs = ['right', 'down', 'left', 'up'];
            const nextDirIdx = (dirs.indexOf(b.direction || 'right') + 1) % 4;
            b.direction = dirs[nextDirIdx];
            window.appendLog(`🔄 ROTATED: ${b.type.toUpperCase()} at [${col}, ${row}] facing [${b.direction.toUpperCase()}].`);
          }
        } else {
          // Normal click cycles orientation
          const dirs = ['right', 'down', 'left', 'up'];
          const nextDirIdx = (dirs.indexOf(b.direction || 'right') + 1) % 4;
          b.direction = dirs[nextDirIdx];
          window.appendLog(`🔄 ROTATED: ${b.type.toUpperCase()} at [${col}, ${row}] facing [${b.direction.toUpperCase()}].`);
        }
        if (window.saveGame) window.saveGame();
      }
    }
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

    // Camera scrolling via WASD
    if (window.keysPressed) {
      const scrollSpeed = 8;
      if (window.keysPressed['w'] || window.keysPressed['arrowup']) this.cameraY += scrollSpeed;
      if (window.keysPressed['s'] || window.keysPressed['arrowdown']) this.cameraY -= scrollSpeed;
      if (window.keysPressed['a'] || window.keysPressed['arrowleft']) this.cameraX += scrollSpeed;
      if (window.keysPressed['d'] || window.keysPressed['arrowright']) this.cameraX -= scrollSpeed;
    }

    // Capricorn tech: Passively generates 10 QM/sec inside base
    if (this.unlockedTech.includes('capricorn') && this.tickCount % 60 === 0) {
      this.inventory.quantumMatter += 10;
    }

    // 1. Process Extractor Drills
    this.buildings.forEach(b => {
      if (b.type === 'extractor') {
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

          if (isBlocked || this.conveyorItems.length >= 300) {
            b.cooldown = b.maxCooldown; // Pause / wait until the spot is clear
          } else {
            b.cooldown = 0;
            this.conveyorItems.push({
              id: `item-${Date.now()}-${Math.random()}`,
              x: spawnX,
              y: spawnY,
              spawnX: spawnX,
              spawnY: spawnY,
              spawnDir: b.direction || 'right',
              targetCol: b.col,
              targetRow: b.row,
              itemType: 'raw_matter',
              progress: 0,
              color: '#00ffff',
              age: 0
            });
          }
        }
      }
    });

    // 2. Process Transmuters & Vehicle Assemblers
    this.buildings.forEach(b => {
      if (b.type === 'synthesizer') {
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
              
              // Gemini tech: 25% chance to output a double core!
              const doubleChance = this.unlockedTech.includes('gemini') && Math.random() < 0.25;
              const outputCount = doubleChance ? 2 : 1;

              for (let c = 0; c < outputCount; c++) {
                this.conveyorItems.push({
                  id: `core-${Date.now()}-${Math.random()}`,
                  x: spawnX,
                  y: spawnY,
                  spawnX: spawnX,
                  spawnY: spawnY,
                  spawnDir: b.direction || 'right',
                  targetCol: b.col,
                  targetRow: b.row,
                  itemType: 'exotic_core',
                  progress: 0,
                  color: '#ff33ff',
                  age: 0
                });
              }
              this.inventory.exoticCores += outputCount;
              window.appendLog(`⚛️ PROCESSOR: Synthesized ${outputCount} [EXOTIC_CORE] from raw matter matrices.`);
            }
          }
        }
      } else if (b.type === 'assembler') {
        const required = b.recipe === 'raider' ? 1 : b.recipe === 'tank' ? 2 : 3;
        if (b.inputBuffer >= required) {
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
              b.inputBuffer -= required;

              const itemType = `assembled_${b.recipe}`;
              this.conveyorItems.push({
                id: `assembled-${Date.now()}-${Math.random()}`,
                x: spawnX,
                y: spawnY,
                spawnX: spawnX,
                spawnY: spawnY,
                spawnDir: b.direction || 'right',
                targetCol: b.col,
                targetRow: b.row,
                itemType: itemType,
                progress: 0,
                color: '#00ff66',
                age: 0
              });
              window.appendLog(`📦 ASSEMBLER: Completed assembly of vehicle chassis: [${itemType.toUpperCase()}]. Routing to belt.`);
            }
          }
        }
      }
    });

    if (this.conveyorItems) {
      this.conveyorItems.forEach(item => {
        const col = Math.floor(item.x / this.cellSize);
        const row = Math.floor(item.y / this.cellSize);
        const b = this.buildings.find(bg => bg.col === col && bg.row === row);
        
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
      const bA = this.buildings.find(b => b.col === colA && b.row === rowA);
      
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
      const b = this.buildings.find(bg => bg.col === col && bg.row === row);
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

      if (item.age > 300) {
        this.spawnExplosion(item.x, item.y, '#ff3344', 5);
        window.appendLog("🧹 MAINTENANCE: Cleared stray production material.");
        return false;
      }

      // Check if item hit the permanent central Spacetime Gate (cols 5-6, rows 5-6)
      if (this.isCentralPortalCell(col, row)) {
        this.spawnExplosion(item.x, item.y, item.color, 15);
        if (item.itemType === 'assembled_raider') {
          this.standingArmy.raider++;
          window.appendLog("🛸 STANDING_ARMY: Vanguard Raider warped into Standing reserves!");
        } else if (item.itemType === 'assembled_tank') {
          this.standingArmy.tank++;
          window.appendLog("🛸 STANDING_ARMY: Goliath Heavy Tank warped into Standing reserves!");
        } else if (item.itemType === 'assembled_gunship') {
          this.standingArmy.gunship++;
          window.appendLog("🛸 STANDING_ARMY: Reaver Gunship warped into Standing reserves!");
        } else if (item.itemType === 'exotic_core') {
          this.inventory.exoticCores++;
          window.appendLog("⚜️ INVENTORY: Transferred raw Exotic Core to storage mainframe vaults.");
        } else {
          this.inventory.quantumMatter += 15; // minor credits
        }
        
        this.updateUiDisplay();
        if (window.saveGame) window.saveGame();
        return false;
      }

      const target = this.buildings.find(b => b.col === col && b.row === row);
      if (target) {
        if (target.type === 'storage') {
          if (item.itemType === 'raw_matter') {
            this.inventory.quantumMatter += 10;
          } else if (item.itemType === 'exotic_core') {
            this.inventory.quantumMatter += 40;
          } else if (item.itemType.startsWith('assembled_')) {
            this.inventory.quantumMatter += 100;
          }
          return false; // delete item
        } else if (target.type === 'synthesizer' && item.itemType === 'raw_matter') {
          target.inputBuffer++;
          return false; 
        } else if (target.type === 'assembler' && item.itemType === 'exotic_core') {
          const required = target.recipe === 'raider' ? 1 : target.recipe === 'tank' ? 2 : 3;
          if (target.inputBuffer < required) {
            target.inputBuffer++;
            return false; 
          }
        } else if (target.type === 'deployer' && item.itemType.startsWith('assembled_')) {
          if (target.active) {
            // Also warps directly into our standing army now!
            const vehicleType = item.itemType.replace('assembled_', '');
            this.spawnExplosion(item.x, item.y, '#00ff66', 15);
            this.standingArmy[vehicleType]++;
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
    if (this.tickCount % 600 === 0 && this.inventory.exoticCores >= costTethers) {
      this.inventory.exoticCores -= costTethers;
      this.inventory.zodiacTethers++;
      window.appendLog("⚜️ TETHER_MATRIX: High frequency tethers assembled inside main assembly launcher bay.");
      this.updateUiDisplay();
      if (window.saveGame) window.saveGame();
    }
  }

  // Draw homebase interior grid map
  render() {
    this.ctx.fillStyle = '#030306';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    // Center of screen panning
    this.ctx.translate(this.canvas.width / 2 + this.cameraX, this.canvas.height / 2 + this.cameraY);

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
      const size = this.cellSize;

      this.ctx.save();
      
      if (b.type === 'extractor') {
        this.ctx.fillStyle = '#112233';
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1.5;
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
        this.ctx.fillStyle = '#221133';
        this.ctx.strokeStyle = '#ff33ff';
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
        this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

        // Pulsing plasma chamber
        this.ctx.fillStyle = `rgba(255, 51, 255, ${0.15 + 0.1 * Math.sin(this.tickCount * 0.08)})`;
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, 9, 0, Math.PI * 2);
        this.ctx.fill();
        
        if (b.inputBuffer > 0) {
          this.ctx.fillStyle = '#ff33ff';
          this.ctx.font = '6px var(--font-mono)';
          this.ctx.fillText(`${b.inputBuffer}/${b.requiredInput}`, bx + 6, by + size - 5);
        }
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
        this.ctx.fillStyle = '#1e2430';
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
        this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

        // Robotic laser arms
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.0;
        this.ctx.beginPath();
        this.ctx.moveTo(bx + 6, by + 6);
        this.ctx.lineTo(bx + 14, by + 14);
        this.ctx.moveTo(bx + size - 6, by + 6);
        this.ctx.lineTo(bx + size - 14, by + 14);
        this.ctx.stroke();

        // Holographic unit projection bouncing slightly
        const hoverOffset = Math.sin(this.tickCount * 0.12) * 2;
        this.ctx.fillStyle = 'rgba(0, 255, 102, 0.45)';
        this.ctx.font = 'bold 8px var(--font-mono)';
        this.ctx.textAlign = 'center';
        
        let holoSymbol = '▲';
        if (b.recipe === 'tank') holoSymbol = '⬢';
        if (b.recipe === 'gunship') holoSymbol = '❖';

        this.ctx.fillText(holoSymbol, bx + size/2, by + size/2 + 3 + hoverOffset);

        // Progress build cooldown indicator ring
        if (b.inputBuffer > 0) {
          this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.2)';
          this.ctx.lineWidth = 2.0;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, 11, 0, Math.PI * 2);
          this.ctx.stroke();

          const angleEnd = (b.cooldown / b.maxCooldown) * Math.PI * 2;
          this.ctx.strokeStyle = '#00ff66';
          this.ctx.lineWidth = 2.0;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, 11, -Math.PI / 2, -Math.PI / 2 + angleEnd);
          this.ctx.stroke();
        }

        this.ctx.fillStyle = '#00ff66';
        this.ctx.font = '5.5px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(b.recipe.toUpperCase(), bx + size/2, by + size - 5);

        const required = b.recipe === 'raider' ? 1 : b.recipe === 'tank' ? 2 : 3;
        this.ctx.fillStyle = '#ff33ff';
        this.ctx.font = '5px var(--font-mono)';
        this.ctx.fillText(`Cores:${b.inputBuffer}/${required}`, bx + size/2, by + 11);
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

      if (['synthesizer', 'assembler', 'deployer'].includes(b.type)) {
        this.drawDirectionArrow(bx, by, b.direction || 'right', 'rgba(255, 255, 255, 0.45)');
      }

      this.ctx.restore();
    });

    // 4. Draw flowing Conveyed vehicle and resource particles
    this.conveyorItems.forEach(item => {
      this.ctx.save();
      
      if (item.itemType.startsWith('assembled_')) {
        this.ctx.fillStyle = '#00ff66';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#00ff66';
        this.ctx.translate(item.x, item.y);
        
        if (item.itemType === 'assembled_raider') {
          this.ctx.beginPath();
          this.ctx.moveTo(4, 0);
          this.ctx.lineTo(-4, -3);
          this.ctx.lineTo(-2, 0);
          this.ctx.lineTo(-4, 3);
          this.ctx.closePath();
          this.ctx.fill();
        } else if (item.itemType === 'assembled_tank') {
          this.ctx.fillRect(-4, -4, 8, 8);
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fillRect(0, -1, 5, 2); // mini gun barrel
        } else {
          // Quad-wing gunship star shape
          this.ctx.beginPath();
          this.ctx.moveTo(0, -5);
          this.ctx.lineTo(2, -2);
          this.ctx.lineTo(5, 0);
          this.ctx.lineTo(2, 2);
          this.ctx.lineTo(0, 5);
          this.ctx.lineTo(-2, 2);
          this.ctx.lineTo(-5, 0);
          this.ctx.lineTo(-2, -2);
          this.ctx.closePath();
          this.ctx.fill();
        }
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
      const size = this.cellSize;
      const pDir = this.placementDirection || 'right';

      if (this.isCellUnlocked(mouseCol, mouseRow)) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.55;

        if (this.isCentralPortalCell(mouseCol, mouseRow)) {
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
          else if (this.selectedTool === 'synthesizer') {
            this.ctx.fillStyle = '#221133';
            this.ctx.strokeStyle = '#ff33ff';
            this.ctx.lineWidth = 1.8;
            this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
            this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);
            this.drawDirectionArrow(bx, by, pDir, '#ff33ff');
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
            this.ctx.strokeStyle = '#00ff66';
            this.ctx.lineWidth = 1.8;
            this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
            this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);
            this.drawDirectionArrow(bx, by, pDir, '#00ff66');
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

          // Green highlight frame indicating valid build location
          this.ctx.strokeStyle = this.selectedTool === 'demolish' ? '#ff3344' : '#00ffff';
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

  // Draw small arrows indicating oriented building outputs
  drawDirectionArrow(bx, by, dir, color) {
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 1.5;
    
    this.ctx.translate(bx + this.cellSize / 2, by + this.cellSize / 2);
    
    if (dir === 'right') this.ctx.rotate(0);
    else if (dir === 'down') this.ctx.rotate(Math.PI / 2);
    else if (dir === 'left') this.ctx.rotate(Math.PI);
    else if (dir === 'up') this.ctx.rotate(-Math.PI / 2);
    
    this.ctx.beginPath();
    this.ctx.moveTo(-10, 0);
    this.ctx.lineTo(10, 0);
    this.ctx.moveTo(5, -3);
    this.ctx.lineTo(10, 0);
    this.ctx.lineTo(5, 3);
    this.ctx.stroke();
    
    this.ctx.restore();
  }
}
