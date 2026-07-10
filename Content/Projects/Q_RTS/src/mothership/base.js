/**
 * Mothership/base.js
 * Homebase production factory inside the colossal Carrier hull.
 * Features grid-based building placement (Factorio style) and pre-configured
 * automation assembly lines processing Quantum Matter into high-tier Exotic Assets.
 */

export class MothershipBase {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Grid settings
    this.cellSize = 40;
    this.cols = 24;
    this.rows = 15;
    
    this.width = this.cols * this.cellSize;
    this.height = this.rows * this.cellSize;
    
    // Zoom & pan
    this.offsetX = (canvas.width - this.width) / 2;
    this.offsetY = (canvas.height - this.height) / 2;
    
    // Factory State
    this.buildings = [];
    this.conveyorItems = []; // Particles moving along belts
    
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

    // Selected building for placement
    this.selectedTool = null; // 'extractor', 'belt', 'synthesizer', 'storage'
    this.placementDirection = 'right';

    // Tick counter
    this.tickCount = 0;

    this.initPrebuiltFactory();
  }

  // Set up a beautifully arranged automation pipeline so player has a ready-to-use factory!
  initPrebuiltFactory() {
    this.buildings = [];
    this.conveyorItems = [];

    // 1. Quantum Core Extractor (row 4, col 4)
    this.buildings.push({
      id: 'ext-1',
      type: 'extractor',
      col: 4, row: 4,
      name: 'Reactor Extractor',
      efficiency: 1.0,
      cooldown: 0,
      maxCooldown: 40,
      direction: 'right' // feeds right
    });

    // 2. Conveyor belts moving items from left to right (col 5 to 11, row 4)
    for (let c = 5; c <= 11; c++) {
      this.buildings.push({
        id: `belt-r4-c${c}`,
        type: 'belt',
        col: c, row: 4,
        direction: 'right'
      });
    }

    // 3. Quantum Synthesizer (col 12, row 4) - consumes raw matter, outputs exotic cores
    this.buildings.push({
      id: 'synth-1',
      type: 'synthesizer',
      col: 12, row: 4,
      name: 'Transmuter Core',
      inputBuffer: 0,
      requiredInput: 5,
      cooldown: 0,
      maxCooldown: 90,
      direction: 'right'
    });

    // 4. Belts moving from synthesizer to storage (col 13 to 18, row 4)
    for (let c = 13; c <= 18; c++) {
      this.buildings.push({
        id: `belt-r4-c${c}`,
        type: 'belt',
        col: c, row: 4,
        direction: 'right'
      });
    }

    // 5. Exotic Storage Vault (col 19, row 4)
    this.buildings.push({
      id: 'store-1',
      type: 'storage',
      col: 19, row: 4,
      name: 'Silo-A Prime',
      capacity: 500,
      direction: 'right'
    });

    // Let's add a second secondary mining drill (col 4, row 7) feeding into a belt loop
    this.buildings.push({
      id: 'ext-2',
      type: 'extractor',
      col: 4, row: 7,
      name: 'Debris Drill',
      efficiency: 0.8,
      cooldown: 10,
      maxCooldown: 50,
      direction: 'right'
    });

    for (let c = 5; c <= 8; c++) {
      this.buildings.push({
        id: `belt-r7-c${c}`,
        type: 'belt',
        col: c, row: 7,
        direction: 'right'
      });
    }

    // Belt turns up to join main pipeline
    this.buildings.push({
      id: 'belt-turn-1',
      type: 'belt',
      col: 9, row: 7,
      direction: 'up'
    });
    this.buildings.push({
      id: 'belt-turn-2',
      type: 'belt',
      col: 9, row: 6,
      direction: 'up'
    });
    this.buildings.push({
      id: 'belt-turn-3',
      type: 'belt',
      col: 9, row: 5,
      direction: 'up'
    });
  }

  resize(w, h) {
    this.offsetX = (w - this.width) / 2;
    this.offsetY = (h - this.height) / 2;
  }

  // Handle keyboard rotation key 'R'
  handleRotateKey() {
    const dirs = ['right', 'down', 'left', 'up'];
    if (this.selectedTool) {
      const idx = dirs.indexOf(this.placementDirection || 'right');
      this.placementDirection = dirs[(idx + 1) % 4];
      window.appendLog(`🔄 PLACEMENT_ROTATION: Next placement rotated to face [${this.placementDirection.toUpperCase()}].`);
    } else {
      // Rotate the block currently hovered by the mouse!
      const mouseCol = Math.floor((window.mousePos?.x - this.offsetX) / this.cellSize);
      const mouseRow = Math.floor((window.mousePos?.y - this.offsetY) / this.cellSize);
      
      const b = this.buildings.find(b => b.col === mouseCol && b.row === mouseRow);
      if (b) {
        const idx = dirs.indexOf(b.direction || 'right');
        b.direction = dirs[(idx + 1) % 4];
        window.appendLog(`🔄 FACILITY_ROTATION: Rotated ${b.type.toUpperCase()} at [${mouseCol}, ${mouseRow}] to face [${b.direction.toUpperCase()}].`);
      }
    }
  }

  // Double click handling for quick recipe/gate toggle
  handleDoubleClick(screenX, screenY) {
    const gridX = screenX - this.offsetX;
    const gridY = screenY - this.offsetY;
    if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) return;
    
    const col = Math.floor(gridX / this.cellSize);
    const row = Math.floor(gridY / this.cellSize);
    
    const b = this.buildings.find(b => b.col === col && b.row === row);
    if (b) {
      if (b.type === 'assembler') {
        const recipes = ['raider', 'tank', 'gunship'];
        const currentIdx = recipes.indexOf(b.recipe || 'raider');
        b.recipe = recipes[(currentIdx + 1) % 3];
        b.cooldown = 0;
        window.appendLog(`🛠️ ASSEMBLER: Changed recipe at [${col}, ${row}] to build [${b.recipe.toUpperCase()}].`);
      } else if (b.type === 'deployer') {
        b.active = !b.active;
        window.appendLog(`🚚 DEPLOY_GATE: Gate at [${col}, ${row}] toggled [${b.active ? 'OPEN (DEPLOY)' : 'CLOSED (HOLD)'}].`);
      }
    }
  }

  // Handle clicking on the factory grid
  handleClick(screenX, screenY, isShiftKey = false) {
    const gridX = screenX - this.offsetX;
    const gridY = screenY - this.offsetY;

    if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) {
      return; // Out of bounds
    }

    const col = Math.floor(gridX / this.cellSize);
    const row = Math.floor(gridY / this.cellSize);

    // If a tool is selected, try to place/remove it
    if (this.selectedTool) {
      const existingIdx = this.buildings.findIndex(b => b.col === col && b.row === row);
      
      if (this.selectedTool === 'demolish') {
        if (existingIdx !== -1) {
          const removed = this.buildings.splice(existingIdx, 1)[0];
          // Refund half cost
          this.inventory.quantumMatter += 15;
          window.appendLog(`🚜 FACTORY: Demolished ${removed.type.toUpperCase()} at [${col}, ${row}]. Refunded 15 QM.`);
        }
        return;
      }

      if (existingIdx !== -1) {
        window.appendLog("⚠️ GRID_BLOCKED: Cell already occupied by another facility.");
        return;
      }

      // Spend QM to build
      const costs = { extractor: 60, belt: 15, synthesizer: 120, storage: 80, assembler: 150, deployer: 100 };
      const cost = costs[this.selectedTool] || 0;

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
        bData.maxCooldown = 40;
      } else if (this.selectedTool === 'synthesizer') {
        bData.inputBuffer = 0;
        bData.requiredInput = 5;
        bData.cooldown = 0;
        bData.maxCooldown = 90;
      } else if (this.selectedTool === 'assembler') {
        bData.recipe = 'raider';
        bData.inputBuffer = 0;
        bData.cooldown = 0;
        bData.maxCooldown = 120; // assembly time
      } else if (this.selectedTool === 'deployer') {
        bData.active = true; // gate open by default
      }

      this.buildings.push(bData);
      window.appendLog(`🛠️ CONSTRUCTED: Placed ${this.selectedTool.toUpperCase()} facility at grid index [${col}, ${row}]. Cost: ${cost} QM.`);
    } else {
      // Handle interactive facility clicks when no tool is equipped
      const b = this.buildings.find(b => b.col === col && b.row === row);
      if (!this.selectedTool && b) {
        if (isShiftKey) {
          if (b.type === 'assembler') {
            const recipes = ['raider', 'tank', 'gunship'];
            const currentIdx = recipes.indexOf(b.recipe || 'raider');
            b.recipe = recipes[(currentIdx + 1) % 3];
            b.cooldown = 0; // reset progress on cycle
            window.appendLog(`🛠️ ASSEMBLER: Changed recipe at [${col}, ${row}] to build [${b.recipe.toUpperCase()}].`);
          } else if (b.type === 'deployer') {
            b.active = !b.active;
            window.appendLog(`🚚 DEPLOY_GATE: Gate at [${col}, ${row}] toggled [${b.active ? 'OPEN (DEPLOY)' : 'CLOSED (HOLD)'}].`);
          } else {
            // Shift-click fallback for other blocks: simple rotation
            const dirs = ['right', 'down', 'left', 'up'];
            const nextDirIdx = (dirs.indexOf(b.direction || 'right') + 1) % 4;
            b.direction = dirs[nextDirIdx];
            window.appendLog(`🔄 ROTATED: ${b.type.toUpperCase()} at [${col}, ${row}] facing [${b.direction.toUpperCase()}].`);
          }
        } else {
          // Normal Click: Rotate ANY facility's orientation!
          const dirs = ['right', 'down', 'left', 'up'];
          const nextDirIdx = (dirs.indexOf(b.direction || 'right') + 1) % 4;
          b.direction = dirs[nextDirIdx];
          window.appendLog(`🔄 ROTATED: ${b.type.toUpperCase()} at [${col}, ${row}] facing [${b.direction.toUpperCase()}].`);
        }
      }
    }
  }

  // Factory step simulation ticks
  tick() {
    this.tickCount++;

    // 1. Process Extractor Drills: Produce Quantum raw cores and push to belts
    this.buildings.forEach(b => {
      if (b.type === 'extractor') {
        b.cooldown++;
        if (b.cooldown >= b.maxCooldown) {
          b.cooldown = 0;
          // Spawn raw crystal item at extractor cell
          this.conveyorItems.push({
            id: `item-${Date.now()}-${Math.random()}`,
            x: b.col * this.cellSize + this.cellSize / 2,
            y: b.row * this.cellSize + this.cellSize / 2,
            spawnX: b.col * this.cellSize + this.cellSize / 2,
            spawnY: b.row * this.cellSize + this.cellSize / 2,
            spawnDir: b.direction || 'right',
            targetCol: b.col,
            targetRow: b.row,
            itemType: 'raw_matter',
            progress: 0,
            color: '#00ffff'
          });
        }
      }
    });

    // 2. Process Transmuter Synthesizers: Consume raw items, produce high-tier cores
    this.buildings.forEach(b => {
      if (b.type === 'synthesizer') {
        if (b.inputBuffer >= b.requiredInput) {
          b.cooldown++;
          if (b.cooldown >= b.maxCooldown) {
            b.cooldown = 0;
            b.inputBuffer -= b.requiredInput;
            
            // Output high-tier core
            this.conveyorItems.push({
              id: `core-${Date.now()}-${Math.random()}`,
              x: b.col * this.cellSize + this.cellSize / 2,
              y: b.row * this.cellSize + this.cellSize / 2,
              spawnX: b.col * this.cellSize + this.cellSize / 2,
              spawnY: b.row * this.cellSize + this.cellSize / 2,
              spawnDir: b.direction || 'right',
              targetCol: b.col,
              targetRow: b.row,
              itemType: 'exotic_core',
              progress: 0,
              color: '#ff33ff'
            });
            this.inventory.exoticCores++;
            window.appendLog(`⚛️ PROCESSOR: Synthesized 1 [EXOTIC_CORE] from raw matter matrices.`);
          }
        }
      } else if (b.type === 'assembler') {
        // Process Vehicle Assemblers: Consume exotic cores, produce assembled military units
        const required = b.recipe === 'raider' ? 1 : b.recipe === 'tank' ? 2 : 3;
        if (b.inputBuffer >= required) {
          b.cooldown++;
          if (b.cooldown >= b.maxCooldown) {
            b.cooldown = 0;
            b.inputBuffer -= required;

            // Output physical vehicle item onto the conveyor belt
            const itemType = `assembled_${b.recipe}`;
            this.conveyorItems.push({
              id: `assembled-${Date.now()}-${Math.random()}`,
              x: b.col * this.cellSize + this.cellSize / 2,
              y: b.row * this.cellSize + this.cellSize / 2,
              spawnX: b.col * this.cellSize + this.cellSize / 2,
              spawnY: b.row * this.cellSize + this.cellSize / 2,
              spawnDir: b.direction || 'right',
              targetCol: b.col,
              targetRow: b.row,
              itemType: itemType,
              progress: 0,
              color: '#00ff66'
            });
            window.appendLog(`📦 ASSEMBLER: Completed assembly of vehicle chassis: [${itemType.toUpperCase()}]. Routing to belt.`);
          }
        }
      }
    });

    // 3. Conveyor movement physics: move item particles along belt paths with backing up cascade
    this.conveyorItems.forEach(item => {
      const col = Math.floor(item.x / this.cellSize);
      const row = Math.floor(item.y / this.cellSize);
      const b = this.buildings.find(bg => bg.col === col && bg.row === row);
      
      if (b && b.type === 'belt') {
        item.speed = 2.0;
        // If it touches a belt, we reset its spawn point to this belt tile center so it doesn't decay anymore!
        item.spawnX = col * this.cellSize + this.cellSize / 2;
        item.spawnY = row * this.cellSize + this.cellSize / 2;
        item.spawnDir = b.direction || 'right';
      } else {
        // Drifting outside a belt (e.g. ejected from extractor, or pushed)
        // Calculate distance from spawn point
        const dx = item.x - (item.spawnX || item.x);
        const dy = item.y - (item.spawnY || item.y);
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 5 blocks = 200 pixels. Slow down starts after 3 blocks (120 pixels)
        let speedMultiplier = 1.0;
        if (dist > 120) {
          speedMultiplier = Math.max(0, 1 - (dist - 120) / 80);
        }
        item.speed = 1.5 * speedMultiplier;
      }
    });

    for (let i = 0; i < this.conveyorItems.length; i++) {
      const itemA = this.conveyorItems[i];
      const colA = Math.floor(itemA.x / this.cellSize);
      const rowA = Math.floor(itemA.y / this.cellSize);
      const bA = this.buildings.find(b => b.col === colA && b.row === rowA);
      
      const currentDir = (bA && bA.type === 'belt') ? bA.direction : (itemA.spawnDir || 'right');

      // Check if there is a closed deploy gate directly on this belt tile
      const currentGate = this.buildings.find(b => b.col === colA && b.row === rowA && b.type === 'deployer');
      if (currentGate && !currentGate.active && itemA.itemType.startsWith('assembled_')) {
        itemA.speed = 0;
        continue;
      }

      // Check item-item collisions to back up the line
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

          // If item B is slow/stopped, back up item A!
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
        if (dir === 'right') {
          item.x += speed;
        } else if (dir === 'down') {
          item.y += speed;
        } else if (dir === 'left') {
          item.x -= speed;
        } else if (dir === 'up') {
          item.y -= speed;
        }
      }
    });

    // 4. Collision checking: items entering silos/vaults, transmuters, assemblers or deployers
    this.conveyorItems = this.conveyorItems.filter(item => {
      const col = Math.floor(item.x / this.cellSize);
      const row = Math.floor(item.y / this.cellSize);

      const target = this.buildings.find(b => b.col === col && b.row === row);

      if (target) {
        if (target.type === 'storage') {
          // Vault absorbs items for credit/recycling
          if (item.itemType === 'raw_matter') {
            this.inventory.quantumMatter += 10;
          } else if (item.itemType === 'exotic_core') {
            this.inventory.quantumMatter += 40; // refund/credit
          } else if (item.itemType.startsWith('assembled_')) {
            this.inventory.quantumMatter += 100; // heavy refund
          }
          return false; // delete item
        } else if (target.type === 'synthesizer' && item.itemType === 'raw_matter') {
          target.inputBuffer++;
          return false; // absorbed by synthesizer
        } else if (target.type === 'assembler' && item.itemType === 'exotic_core') {
          const required = target.recipe === 'raider' ? 1 : target.recipe === 'tank' ? 2 : 3;
          if (target.inputBuffer < required) {
            target.inputBuffer++;
            return false; // absorbed by assembler
          }
        } else if (target.type === 'deployer' && item.itemType.startsWith('assembled_')) {
          if (target.active) {
            const vehicleType = item.itemType.replace('assembled_', '');
            this.deployUnitToBattlefield(vehicleType);
            return false; // absorbed/deployed!
          }
        }
      }

      // Check out of bounds
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
        return false;
      }
      return true;
    });

    // Passively generate tethers if we have enough exotic cores
    if (this.tickCount % 600 === 0 && this.inventory.exoticCores >= 4) {
      this.inventory.exoticCores -= 4;
      this.inventory.zodiacTethers++;
      window.appendLog("⚜️ TETHER_MATRIX: High frequency tethers assembled inside main assembly launcher bay.");
    }
  }

  // Draw homebase interior grid map
  render() {
    this.ctx.fillStyle = '#05050a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);

    // 1. Draw metal floor panel backgrounds
    this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
    this.ctx.lineWidth = 1;
    for (let c = 0; c <= this.cols; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * this.cellSize, 0);
      this.ctx.lineTo(c * this.cellSize, this.height);
      this.ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * this.cellSize);
      this.ctx.lineTo(this.width, r * this.cellSize);
      this.ctx.stroke();
    }

    // Outer metal bracket boundary
    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.lineWidth = 2.0;
    this.ctx.strokeRect(0, 0, this.width, this.height);

    // Draw central reactor glowing core in background
    this.ctx.fillStyle = 'rgba(0, 255, 102, 0.05)';
    this.ctx.beginPath();
    this.ctx.arc(180, 200, 110, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
    this.ctx.stroke();

    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = '7px var(--font-mono)';
    this.ctx.fillText('⚡ QUANTUM_REACTOR_CORE', 100, 200);

    // 2. Draw Facility Buildings
    this.buildings.forEach(b => {
      const bx = b.col * this.cellSize;
      const by = b.row * this.cellSize;
      const size = this.cellSize;

      this.ctx.save();
      
      if (b.type === 'extractor') {
        // Core Quantum Drill
        this.ctx.fillStyle = '#112233';
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.fillRect(bx + 4, by + 4, size - 8, size - 8);
        this.ctx.strokeRect(bx + 4, by + 4, size - 8, size - 8);

        // Rotating extractor drill bit
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
        // Conveyor belt pathways
        this.ctx.fillStyle = '#15151c';
        this.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        this.ctx.lineWidth = 1.0;
        this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
        this.ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);

        // Draw chevron lines indicating belt speed routing flow
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
        // Smelter / Transmuter Core
        this.ctx.fillStyle = '#221133';
        this.ctx.strokeStyle = '#ff33ff';
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
        this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

        // Center plasma chamber pulsing
        this.ctx.fillStyle = `rgba(255, 51, 255, ${0.15 + 0.1 * Math.sin(this.tickCount * 0.08)})`;
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, 9, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Show progress ratio
        if (b.inputBuffer > 0) {
          this.ctx.fillStyle = '#ff33ff';
          this.ctx.font = '6px var(--font-mono)';
          this.ctx.fillText(`${b.inputBuffer}/${b.requiredInput}`, bx + 6, by + size - 5);
        }
      } 
      else if (b.type === 'storage') {
        // Vault / Silo
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
        // Industrial factory box
        this.ctx.fillStyle = '#1e2430';
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.lineWidth = 1.8;
        this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
        this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

        // Robotic assembly arms / holographic projector
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.0;
        this.ctx.beginPath();
        this.ctx.moveTo(bx + 6, by + 6);
        this.ctx.lineTo(bx + 14, by + 14);
        this.ctx.moveTo(bx + size - 6, by + 6);
        this.ctx.lineTo(bx + size - 14, by + 14);
        this.ctx.stroke();

        // Holographic unit blueprint bouncing slightly in the center
        const hoverOffset = Math.sin(this.tickCount * 0.12) * 2;
        this.ctx.fillStyle = 'rgba(0, 255, 102, 0.45)';
        this.ctx.font = 'bold 8px var(--font-mono)';
        this.ctx.textAlign = 'center';
        
        let holoSymbol = '▲';
        if (b.recipe === 'tank') holoSymbol = '⬢';
        if (b.recipe === 'gunship') holoSymbol = '❖';

        this.ctx.fillText(holoSymbol, bx + size/2, by + size/2 + 3 + hoverOffset);

        // Cooldown progress wheel
        if (b.inputBuffer > 0) {
          this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.2)';
          this.ctx.lineWidth = 2.0;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, 11, 0, Math.PI * 2);
          this.ctx.stroke();

          const required = b.recipe === 'raider' ? 1 : b.recipe === 'tank' ? 2 : 3;
          const angleEnd = (b.cooldown / b.maxCooldown) * Math.PI * 2;
          this.ctx.strokeStyle = '#00ff66';
          this.ctx.lineWidth = 2.0;
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, 11, -Math.PI / 2, -Math.PI / 2 + angleEnd);
          this.ctx.stroke();
        }

        // Text recipe label
        this.ctx.fillStyle = '#00ff66';
        this.ctx.font = '5.5px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(b.recipe.toUpperCase(), bx + size/2, by + size - 5);

        // Input cores count
        const required = b.recipe === 'raider' ? 1 : b.recipe === 'tank' ? 2 : 3;
        this.ctx.fillStyle = '#ff33ff';
        this.ctx.font = '5px var(--font-mono)';
        this.ctx.fillText(`Cores:${b.inputBuffer}/${required}`, bx + size/2, by + 11);
      }
      else if (b.type === 'deployer') {
        // Deep gray housing with bright yellow hazard stripes
        this.ctx.fillStyle = '#22252a';
        this.ctx.strokeStyle = b.active ? '#00e5ff' : '#ff3344';
        this.ctx.lineWidth = 2.0;
        this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
        this.ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);

        // Spawning status circle
        this.ctx.fillStyle = b.active ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 51, 68, 0.2)';
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, 10, 0, Math.PI * 2);
        this.ctx.fill();

        // Pulsing center indicator
        const alphaPulse = 0.5 + 0.3 * Math.sin(this.tickCount * 0.1);
        this.ctx.fillStyle = b.active ? `rgba(0, 229, 255, ${alphaPulse})` : `rgba(255, 51, 68, ${alphaPulse})`;
        this.ctx.beginPath();
        this.ctx.arc(bx + size/2, by + size/2, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Status label
        this.ctx.fillStyle = b.active ? '#00e5ff' : '#ff3344';
        this.ctx.font = '6px var(--font-mono)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(b.active ? 'DEPLOYING' : 'HOLDING', bx + size/2, by + size - 6);
      }

      // Draw oriented direction arrow for active buildings
      if (['synthesizer', 'assembler', 'deployer'].includes(b.type)) {
        this.drawDirectionArrow(bx, by, b.direction || 'right', 'rgba(255, 255, 255, 0.45)');
      }

      this.ctx.restore();
    });

    // 3. Draw flowing Conveyed item particles
    this.conveyorItems.forEach(item => {
      this.ctx.save();
      
      if (item.itemType.startsWith('assembled_')) {
        // Draw beautifully detailed little mini-vehicles!
        this.ctx.fillStyle = '#00ff66';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#00ff66';
        
        this.ctx.translate(item.x, item.y);
        
        if (item.itemType === 'assembled_raider') {
          // Tiny triangle fighter
          this.ctx.beginPath();
          this.ctx.moveTo(4, 0);
          this.ctx.lineTo(-4, -3);
          this.ctx.lineTo(-2, 0);
          this.ctx.lineTo(-4, 3);
          this.ctx.closePath();
          this.ctx.fill();
        } else if (item.itemType === 'assembled_tank') {
          // Rounded heavy square chassis
          this.ctx.fillRect(-4, -4, 8, 8);
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fillRect(0, -1, 5, 2); // tiny gun barrel!
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
        // Standard resources
        this.ctx.fillStyle = item.color;
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = item.color;
        
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    });

    // Draw active cursor tool indicator
    if (this.selectedTool) {
      const mouseCol = Math.floor((window.mousePos?.x - this.offsetX) / this.cellSize);
      const mouseRow = Math.floor((window.mousePos?.y - this.offsetY) / this.cellSize);
      
      if (mouseCol >= 0 && mouseCol < this.cols && mouseRow >= 0 && mouseRow < this.rows) {
        // Render a semi-transparent preview of the actual building being placed!
        this.ctx.save();
        this.ctx.globalAlpha = 0.55;
        
        const bx = mouseCol * this.cellSize;
        const by = mouseRow * this.cellSize;
        const size = this.cellSize;
        
        // Use this.placementDirection || 'right' for the preview's rotation
        const pDir = this.placementDirection || 'right';
        
        if (this.selectedTool === 'extractor') {
          this.ctx.fillStyle = '#112233';
          this.ctx.strokeStyle = '#00ffff';
          this.ctx.lineWidth = 1.5;
          this.ctx.fillRect(bx + 4, by + 4, size - 8, size - 8);
          this.ctx.strokeRect(bx + 4, by + 4, size - 8, size - 8);

          this.ctx.save();
          this.ctx.translate(bx + size/2, by + size/2);
          this.ctx.rotate(this.tickCount * 0.15);
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.beginPath();
          this.ctx.moveTo(-6, -6); this.ctx.lineTo(6, 6);
          this.ctx.moveTo(6, -6); this.ctx.lineTo(-6, 6);
          this.ctx.stroke();
          this.ctx.restore();
          
          this.drawDirectionArrow(bx, by, pDir, '#00ffff');
        } 
        else if (this.selectedTool === 'belt') {
          this.ctx.fillStyle = '#15151c';
          this.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          this.ctx.lineWidth = 1.0;
          this.ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
          this.ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);

          this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
          this.ctx.beginPath();
          const animOffset = (this.tickCount * 1.5) % 8;
          
          if (pDir === 'right') {
            for (let l = 4; l < size; l += 8) {
              const lx = bx + ((l + animOffset) % size);
              this.ctx.moveTo(lx, by + 10);
              this.ctx.lineTo(lx + 4, by + size/2);
              this.ctx.lineTo(lx, by + size - 10);
            }
          } else if (pDir === 'down') {
            for (let l = 4; l < size; l += 8) {
              const ly = by + ((l + animOffset) % size);
              this.ctx.moveTo(bx + 10, ly);
              this.ctx.lineTo(bx + size/2, ly + 4);
              this.ctx.lineTo(bx + size - 10, ly);
            }
          } else if (pDir === 'left') {
            for (let l = 4; l < size; l += 8) {
              const lx = bx + size - ((l + animOffset) % size);
              this.ctx.moveTo(lx, by + 10);
              this.ctx.lineTo(lx - 4, by + size/2);
              this.ctx.lineTo(lx, by + size - 10);
            }
          } else if (pDir === 'up') {
            for (let l = 4; l < size; l += 8) {
              const ly = by + size - ((l + animOffset) % size);
              this.ctx.moveTo(bx + 10, ly);
              this.ctx.lineTo(bx + size/2, ly - 4);
              this.ctx.lineTo(bx + size - 10, ly);
            }
          }
          this.ctx.stroke();
        } 
        else if (this.selectedTool === 'synthesizer') {
          this.ctx.fillStyle = '#221133';
          this.ctx.strokeStyle = '#ff33ff';
          this.ctx.lineWidth = 1.8;
          this.ctx.fillRect(bx + 3, by + 3, size - 6, size - 6);
          this.ctx.strokeRect(bx + 3, by + 3, size - 6, size - 6);

          this.ctx.fillStyle = 'rgba(255, 51, 255, 0.3)';
          this.ctx.beginPath();
          this.ctx.arc(bx + size/2, by + size/2, 9, 0, Math.PI * 2);
          this.ctx.fill();
          
          this.drawDirectionArrow(bx, by, pDir, '#ff33ff');
        } 
        else if (this.selectedTool === 'storage') {
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

        // Draw standard hover highlight outline
        this.ctx.strokeStyle = this.selectedTool === 'demolish' ? '#ff3344' : '#00ffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(bx, by, size, size);

        // Also draw instruction tooltip floating text near the mouse!
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(3, 3, 6, 0.9)';
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
        this.ctx.lineWidth = 1.0;
        
        const tooltipText = '[R] Rotate | [Right-Click] Cancel';
        this.ctx.font = 'bold 9px var(--font-mono)';
        const textWidth = this.ctx.measureText(tooltipText).width;
        
        // Draw tooltip background box
        const tx = Math.max(10, Math.min(this.width - textWidth - 10, bx + size/2 - textWidth/2));
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

  // Draw an elegant small arrow pointing right/down/left/up
  drawDirectionArrow(bx, by, dir, color) {
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 1.5;
    
    this.ctx.translate(bx + this.cellSize / 2, by + this.cellSize / 2);
    
    if (dir === 'right') {
      this.ctx.rotate(0);
    } else if (dir === 'down') {
      this.ctx.rotate(Math.PI / 2);
    } else if (dir === 'left') {
      this.ctx.rotate(Math.PI);
    } else if (dir === 'up') {
      this.ctx.rotate(-Math.PI / 2);
    }
    
    // Draw an elegant small arrow pointing right
    this.ctx.beginPath();
    this.ctx.moveTo(-10, 0);
    this.ctx.lineTo(10, 0);
    this.ctx.moveTo(5, -3);
    this.ctx.lineTo(10, 0);
    this.ctx.lineTo(5, 3);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  // Deploys a newly built combat vehicle onto the active conquest RTS battlefield
  deployUnitToBattlefield(type) {
    const battle = window.conquestBattle;
    if (!battle) {
      window.appendLog(`⚠️ DEPLOY_WARNING: Active Conquest battlefield not detected. Hold or redirect chassis assembly.`);
      return;
    }

    // Spawns unit near the mothership landing zone
    const ms = battle.mothership;
    if (!ms) return;

    const angle = Math.random() * Math.PI * 2;
    const rx = ms.x + Math.cos(angle) * (battle.isSmallGrind ? 100 : 170);
    const ry = ms.y + Math.sin(angle) * (battle.isSmallGrind ? 100 : 170);

    const uData = {
      id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

    battle.playerUnits.push(uData);
    battle.spawnParticleExplosion(rx, ry, '#00ff66', 15);
    window.appendLog(`🟢 FACTORY_DEPLOY: Assembled [${uData.name.toUpperCase()}] squad unit deployed onto Conquest battlefield!`);
  }
}
