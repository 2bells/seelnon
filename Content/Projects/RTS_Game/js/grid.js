import { Vector2 } from './vector2.js';

export class GridTile {
  constructor(x, y, size, game) {
    this.position = new Vector2(x, y);
    this.size = size;
    this.owner = null; // null = neutral, 'player' or 'enemy'
    this.captureProgress = 0;
    this.captureThreshold = 80 * game.multipliers.captureTime; // Adjust base capture time
    this.currentUnit = null;
    this.captureTimer = 0;
    this.game = game;
    this.type = 'normal'; // default type
  }

  update() {
    if (this.currentUnit && !this.currentUnit.health <= 0) {
      const owner = this.currentUnit.isEnemy ? 'enemy' : 'player';
      
      if (this.owner !== owner) {
        this.captureTimer++;
        
        if (this.captureTimer >= this.captureThreshold) {
          this.owner = owner;
          this.captureTimer = 0;
          if (!this.currentUnit.isEnemy) {
            this.game.scoring.tileCaptured(false); // Track player tile captures
          } else {
            this.game.scoring.tileCaptured(true);  // Track enemy tile captures
          }
        }
      }
    } else {
      this.captureTimer = Math.max(0, this.captureTimer - 1);
      this.currentUnit = null;
    }
  }

  getSpeedMultiplier(unit) {
    if (this.currentUnit && !this.currentUnit.health <= 0) {
      if (this.type === 'wall') {
        if (!this.owner) {
          return 0; // Neutral wall stops all units
        } else if (this.owner === 'player' && unit.isEnemy) {
          return 0; // Player wall stops enemy units
        } else if (this.owner === 'enemy' && !unit.isEnemy) {
          return 0; // Enemy wall stops player units
        }
      } else if (this.type === 'water') {
        return 0.5; // Water slows all units
      }
    }
    return 1; // Normal speed for all other cases
  }

  containsPoint(point) {
    if (!point) return false;
    // Use direct comparison instead of creating new objects
    const minX = this.position.x;
    const maxX = this.position.x + this.size;
    const minY = this.position.y;
    const maxY = this.position.y + this.size;
    
    return point.x >= minX && point.x < maxX && 
           point.y >= minY && point.y < maxY;
  }
}

export class Grid {
  constructor(game) {
    this.game = game;
    this.tileSize = 50; 
    this.tiles = [];
    this.decals = [];
    this.cachedGroundPattern = null; 
    this.walls = [];
    this.decalImages = {
      bush: game.assetLoader.getImage("small_bush.png"),
      dirtPatch: game.assetLoader.getImage("small_dirt_patch.png"),
      stones2: game.assetLoader.getImage("small_stones_2.png"),
      stones: game.assetLoader.getImage("small_stones.png"),
      dirtPatch2: game.assetLoader.getImage("small_dirt_patch_2.png")
    };
    this.decalTypes = [
      { type: 'bush', asset: "small_bush.png", count: 2 },
      { type: 'dirtPatch', asset: "small_dirt_patch.png", count: 5 },
      { type: 'stones2', asset: "small_stones_2.png", count: 4 },
      { type: 'stones', asset: "small_stones.png", count: 4 },
      { type: 'dirtPatch2', asset: "small_dirt_patch_2.png", count: 5 }
    ];
    this.deathDecalTypes = [
      { type: 'dirtPatch', asset: "small_dirt_patch.png" },
      { type: 'stones2', asset: "small_stones_2.png" },
      { type: 'stones', asset: "small_stones.png" },
      { type: 'dirtPatch2', asset: "small_dirt_patch_2.png" }
    ];
    this.maxDecals = 10; // Limit the total number of decals
    this.initialDecalCount = 0; // Track number of initial decals
    this.nextDecalIndex = 0;
    this.initialize();
  }

  initialize() {
    if (!this.game || !this.game.canvas) return;
    
    const cols = Math.ceil(this.game.canvas.width / this.tileSize);
    const rows = Math.ceil(this.game.canvas.height / this.tileSize);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        this.tiles.push(new GridTile(x * this.tileSize, y * this.tileSize, this.tileSize, this.game));
      }
    }

    // Reduce number of decals
    this.initialDecalCount = Math.min(cols * rows * 0.1, 20); // set the amount of initial decals
    this.generateDecals(this.initialDecalCount); // initial decals

    // Initialize walls if map provides them
    if (this.game.mapData?.walls) {
      this.walls = this.game.mapData.walls;
    }

    // Initialize decal pool
    this.initializeDecalPool();
  }

  initializeDecalPool() {
    this.decals = [];
    for (let i = 0; i < this.maxDecals; i++) {
        const isInitial = i < this.initialDecalCount;
        const decalType = this.decalTypes[Math.floor(Math.random() * this.decalTypes.length)];
        this.decals.push({
            x: isInitial ? Math.random() * this.game.canvas.width : 0,
            y: isInitial ? Math.random() * this.game.canvas.height : 0,
            size: 100 + Math.random() * 60,
            type: decalType.type,
            rotation: Math.random() * 20,
            active: isInitial,
            isInitial: isInitial,
        });
    }
    this.nextDecalIndex = this.initialDecalCount;
  }

  addDeathDecal(position) {
    // Check if the decal pool is available.
    if (!this.decals || this.decals.length === 0) {
      console.warn("Decal pool is not initialized or is empty.");
      return;
    }

    // Ensure nextDecalIndex is within the bounds of the decal array.
    if (this.nextDecalIndex < 0 || this.nextDecalIndex >= this.decals.length) {
      // Reset to a safe value if out of bounds. This indicates a logic error elsewhere,
      // but prevents a crash.
      this.nextDecalIndex = this.initialDecalCount; 
      if (this.nextDecalIndex >= this.decals.length) {
          // If even the initial count is out of bounds, start from 0.
          this.nextDecalIndex = 0;
      }
    }

    const decal = this.decals[this.nextDecalIndex];

    // Added safety check for the decal object itself.
    if (!decal) {
        console.error(`Decal at index ${this.nextDecalIndex} is undefined.`);
        // Attempt to recover by resetting the index.
        this.nextDecalIndex = this.initialDecalCount;
        return;
    }
    
    decal.x = position.x;
    decal.y = position.y;
    decal.active = true;

    const decalType = this.deathDecalTypes[Math.floor(Math.random() * this.deathDecalTypes.length)];
    decal.type = decalType.type;
    decal.size = 80 + Math.random() * 40;
    decal.rotation = Math.random() * 360;
    
    this.nextDecalIndex++;
    // Corrected logic: Use maxDecals for the upper bound of the pool.
    if (this.nextDecalIndex >= this.maxDecals) {
        this.nextDecalIndex = this.initialDecalCount; 
    }
  }

  update() {
    if (!this.game) return;

    // Clear current units from tiles using a Map for faster lookups
    const tileUnitMap = new Map();
    
    // Update tile occupancy
    this.game.units.forEach(unit => {
      if (unit && unit.position) {
        const tileIndex = this.getTileIndexAtPosition(unit.position);
        if (tileIndex !== -1) {
          tileUnitMap.set(tileIndex, unit);
        }

        // Check if unit is near any wall
        this.walls.forEach(wall => {
          // Check if unit is near wall using wall's precise collision
          if (this.isUnitNearWall(unit, wall)) {
            wall.currentUnit = unit;
          }
        });
      }
    });

    // Update tiles with new unit data
    this.tiles.forEach((tile, index) => {
      tile.currentUnit = tileUnitMap.get(index) || null;
      tile.update();
    });

    // Update wall captures
    this.walls.forEach(wall => {
      if (wall.currentUnit && wall.currentUnit.health > 0) {
        const owner = wall.currentUnit.isEnemy ? 'enemy' : 'player';
        
        if (wall.owner !== owner) {
          wall.captureProgress++;
          
          if (wall.captureProgress >= wall.captureThreshold) {
            wall.owner = owner;
            wall.captureProgress = 0;
            console.log(`Wall captured by ${owner}`);
          }
        }
      } else {
        wall.captureProgress = Math.max(0, wall.captureProgress - 1);
        wall.currentUnit = null;
      }
    });
  }

  draw(ctx) {
    if (!ctx || !this.game.canvas) return;

    // Create and cache ground pattern using asset loader
    if (!this.cachedGroundPattern) {
      const groundImage = this.game.assetLoader?.getImage("ground_tile_4.png");
      if (groundImage) {
        this.cachedGroundPattern = ctx.createPattern(groundImage, 'repeat');
      }
    }

    // Draw ground pattern
    if (this.cachedGroundPattern) {
      ctx.fillStyle = this.cachedGroundPattern;
      ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
    }

    // Draw water terrain BEFORE decals and grid
    if (this.game.terrain) {
      this.game.terrain.forEach(feature => {
        if (feature.type === 'water') {
          ctx.beginPath();
          ctx.arc(feature.position.x, feature.position.y, feature.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 50, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    // Draw decals using cached images
    ctx.save();
    this.decals.forEach(decal => {
      if (!decal.active) return; // Skip inactive decals

      const image = this.decalImages[decal.type];
      if (image) {
        ctx.translate(decal.x, decal.y);
        ctx.rotate(decal.rotation * Math.PI / 180);
        ctx.drawImage(
          image,
          -decal.size / 2,
          -decal.size / 2,
          decal.size,
          decal.size
        );
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    });
    ctx.restore();

    // Draw grid lines and owner colors
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.2;
    
    // Draw owner colors and grid lines in single pass
    this.tiles.forEach(tile => {
      if (tile.owner) {
        ctx.fillStyle = tile.owner === 'player' ? 'rgba(0, 0, 255, 0.1)' : 'rgba(255, 0, 0, 0.1)';
        ctx.fillRect(tile.position.x, tile.position.y, tile.size, tile.size);
      }
      if (tile.owner || tile.captureTimer > 0) {
        ctx.strokeRect(tile.position.x, tile.position.y, tile.size, tile.size);
      }
    });

    // Draw capture progress
    ctx.save();
    this.tiles.forEach(tile => {
      if (tile.captureTimer > 0 && tile.currentUnit) {
        const progress = tile.captureTimer / tile.captureThreshold;
        ctx.fillStyle = tile.currentUnit.isEnemy ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 0, 255, 0.1)';
        ctx.fillRect(
          tile.position.x,
          tile.position.y + tile.size * (1 - progress),
          tile.size,
          tile.size * progress
        );
      }
    });
    ctx.restore();

    // Draw walls last so they're on top of everything
    this.drawWalls(ctx);
  }

  drawWalls(ctx) {
    this.walls.forEach(wall => {
      ctx.save();
      
      // Translate to wall position and rotate
      ctx.translate(wall.position.x, wall.position.y);
      ctx.rotate(wall.angle * Math.PI / 180);
      
      // Draw wall base
      ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
      ctx.fillRect(-wall.width/2, -wall.height/2, wall.width, wall.height);
      
      // Draw ownership overlay
      if (wall.owner) {
        ctx.fillStyle = wall.owner === 'player' ? 
          'rgba(0, 0, 255, 0.3)' : 
          'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(-wall.width/2, -wall.height/2, wall.width, wall.height);
      }
      
      // Draw capture progress if being captured
      if (wall.captureProgress > 0) {
        const progress = wall.captureProgress / wall.captureThreshold;
        ctx.fillStyle = wall.currentUnit && wall.currentUnit.isEnemy ? 
          'rgba(255, 0, 0, 0.3)' : 
          'rgba(0, 0, 255, 0.3)';
        ctx.fillRect(
          -wall.width/2,
          -wall.height/2 + wall.height * (1 - progress),
          wall.width,
          wall.height * progress
        );
      }
      
      ctx.restore();
    });
  }

  getTileIndexAtPosition(position) {
    if (!position) return -1;
    const col = Math.floor(position.x / this.tileSize);
    const row = Math.floor(position.y / this.tileSize);
    const index = row * Math.ceil(this.game.canvas.width / this.tileSize) + col;
    return index < this.tiles.length ? index : -1;
  }

  isUnitNearWall(unit, wall) {
    const dx = unit.position.x - wall.position.x;
    const dy = unit.position.y - wall.position.y;
    
    // Convert to wall's local space considering rotation
    const angle = wall.angle * Math.PI / 180;
    const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
    const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
    
    // Add a small buffer for capture range
    const captureBuffer = 20;
    
    return Math.abs(localX) < (wall.width/2 + captureBuffer) && 
           Math.abs(localY) < (wall.height/2 + captureBuffer);
  }

  getTerrainSpeedMultiplier(unit) {
    if (!unit || !unit.position) return 1;

    // Check walls first - they take precedence
    const nearbyWall = this.walls.find(wall => this.isUnitNearWall(unit, wall));
  
    if (nearbyWall) {
        // Unit can't pass through neutral walls
        if (!nearbyWall.owner) {
            return 0;
        }
        // Enemy units can't pass through player walls and vice versa
        if (nearbyWall.owner === 'player' && unit.isEnemy) {
            return 0;
        }
        if (nearbyWall.owner === 'enemy' && !unit.isEnemy) {
            return 0;
        }
    }

    // First check wood resources in Forest Nothing map's special implementation
    if (this.game.woodResources) {
      const slowingWoodResource = this.game.woodResources.find(resource => {
        const distance = unit.position.subtract(resource.position).length();
        return distance <= resource.size; // Capture zone around wood resource
      });

      if (slowingWoodResource) {
        return 0.2; // Extremely slow movement
      }
    }

    // Check for water terrain if no wall or wood effect
    if (this.game.terrain) {
      for (const feature of this.game.terrain) {
        if (feature.type === 'water') {
          const distance = unit.position.subtract(feature.position).length();
          if (distance <= feature.radius) {
            return feature.speedMultiplier;
          }
        }
      }
    }

    return 1.0; // Default speed multiplier for normal terrain
  }

  getTileAtPosition(position) {
    if (!position) return null;
    const index = this.getTileIndexAtPosition(position);
    return index !== -1 ? this.tiles[index] : null;
  }

  updateBuildingBonuses() {
    if (!this.game || !this.game.buildings) return;

    let playerTileCount = this.tiles.filter(t => t.owner === 'player').length;
    let enemyTileCount = this.tiles.filter(t => t.owner === 'enemy').length;

    // Apply bonus to buildings
    this.game.buildings.forEach(building => {
      if (building) {
        if (!building.isEnemy) {
          building.maxHealth = 200 * (1 + (playerTileCount * 0.1));
          building.health = Math.min(building.health, building.maxHealth);
        } else {
          building.maxHealth = 200 * (1 + (enemyTileCount * 0.1));
          building.health = Math.min(building.health, building.maxHealth);
        }
      }
    });
  }

  generateDecals(totalDecals) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;

    this.decals = [];
    
    while (this.decals.length < totalDecals) {
      const decalType = this.decalTypes[Math.floor(Math.random() * this.decalTypes.length)];
      this.decals.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        size: 100 + Math.random() * 60,
        type: decalType.type,
        rotation: Math.random() * 20,
        active: false // set to false for now, they will be actived with initializeDecalPool
      });
    }
  }
}