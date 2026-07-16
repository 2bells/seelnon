/**
 * Generator.js
 * High-performance Procedural RTS Map Generator.
 * Caches terrain rendering into an off-screen canvas for zero-draw-overhead zooming,
 * maintains a binary matrix collision zone, and performs greedy polygon/rectangle
 * meshing to collapse blocked terrain into the minimum number of colliders.
 */

export const THEME_PRESETS = {
  FANTASY: {
    id: 'fantasy',
    name: 'Elven Fjord of Folds',
    terrain: {
      void: { id: 'water', name: 'Mystic Ocean', color: '#002b3d', blocked: true, speed: 0.0 },
      shallow: { id: 'river', name: 'Aether Leyline', color: '#00ffc8', blocked: false, speed: 1.5 },
      plain: { id: 'grass', name: 'Emerald Plain', color: '#133e23', blocked: false, speed: 1.0 },
      forest: { id: 'forest', name: 'Ancient Woods', color: '#092111', blocked: false, speed: 0.5 },
      mountain: { id: 'cliff', name: 'Runic Peaks', color: '#2a3b3a', blocked: false, speed: 0.25 }
    },
    resources: {
      deposit: { name: 'Exotic Mana Well', color: '#a020f0', valueType: 'mana' },
      camp: { name: 'Dragon Nest', color: '#ff3344' }
    }
  },
  SCIFI: {
    id: 'scifi',
    name: 'Metatronic Processing Grid',
    terrain: {
      void: { id: 'plasma', name: 'Abyssal Plasma', color: '#0d021a', blocked: true, speed: 0.0 },
      shallow: { id: 'conduit', name: 'Hyper Conduit', color: '#ff0099', blocked: false, speed: 1.5 },
      plain: { id: 'metal', name: 'Chassis Deck', color: '#1f242d', blocked: false, speed: 1.0 },
      forest: { id: 'silicon', name: 'Silicon Pillars', color: '#0f1115', blocked: false, speed: 0.4 },
      mountain: { id: 'machinery', name: 'Core Reactors', color: '#3d4454', blocked: false, speed: 0.25 }
    },
    resources: {
      deposit: { name: 'Zero-Point Crates', color: '#00ffff', valueType: 'crystal' },
      camp: { name: 'Krell Hive mind Core', color: '#ff1122' }
    }
  },
  REALISTIC: {
    id: 'realistic',
    name: 'Verdant Highland Foothills',
    terrain: {
      void: { id: 'sea', name: 'Deep Sea Bay', color: '#001a33', blocked: true, speed: 0.0 },
      shallow: { id: 'swamp', name: 'Assault Runway', color: '#383c4a', blocked: false, speed: 1.5 },
      plain: { id: 'dirt', name: 'Highland Field', color: '#544634', blocked: false, speed: 1.0 },
      forest: { id: 'woods', name: 'Pine Forest', color: '#1a2b18', blocked: false, speed: 0.55 },
      mountain: { id: 'rock', name: 'Granite Ridges', color: '#444444', blocked: false, speed: 0.25 }
    },
    resources: {
      deposit: { name: 'Raw Hematite Slag', color: '#ffaa00', valueType: 'ore' },
      camp: { name: 'Outpost Barricade', color: '#ff4400' }
    }
  }
};

export class ProceduralMap {
  constructor(themeId = 'scifi', width = 3000, height = 3000, cellSize = 64) {
    this.theme = THEME_PRESETS[themeId.toUpperCase()] || THEME_PRESETS.SCIFI;
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.floor(width / cellSize);
    this.rows = Math.floor(height / cellSize);
    
    this.tiles = [];
    this.resources = [];
    this.blockedMatrix = new Uint8Array(this.cols * this.rows);
    this.greedyRects = [];
    this.mapCanvas = null;

    this.generate();
  }

  generateFastTerrainPatch(centerCol, centerRow) {
    const cols = this.cols;
    const rows = this.rows;
    // Radius of the patch, e.g. 2 to 4 cells
    const radius = 2 + Math.floor(Math.random() * 3);
    
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const testC = centerCol + dc;
        const testR = centerRow + dr;
        
        if (testC >= 1 && testC < cols - 1 && testR >= 1 && testR < rows - 1) {
          const dist = Math.sqrt(dc * dc + dr * dr);
          // Add some randomness to create unique, organic shapes
          const threshold = radius * (0.6 + Math.random() * 0.55);
          
          if (dist <= threshold) {
            const idx = testR * cols + testC;
            const tile = this.tiles[idx];
            // Don't overwrite void if it is already void
            if (tile && tile.type !== 'void') {
              tile.type = 'shallow'; // 'shallow' is our high-speed fast terrain!
              tile.meta = this.theme.terrain.shallow;
              this.blockedMatrix[idx] = 0; // Ensure it is unblocked!
            }
          }
        }
      }
    }
  }

  generateBaseTerrainPatch(centerCol, centerRow) {
    const cols = this.cols;
    const rows = this.rows;
    // Radius of the plateau (e.g. 3 cells ensures flat plains for buildings and guards, radius 4 for fast speedway)
    const radius = 3;
    
    for (let dr = -radius - 1; dr <= radius + 1; dr++) {
      for (let dc = -radius - 1; dc <= radius + 1; dc++) {
        const tc = centerCol + dc;
        const tr = centerRow + dr;
        
        if (tc >= 1 && tc < cols - 1 && tr >= 1 && tr < rows - 1) {
          const dist = Math.sqrt(dc * dc + dr * dr);
          const idx = tr * cols + tc;
          const tile = this.tiles[idx];
          
          if (tile) {
            if (dist <= radius) {
              // Flat plains base terrain for structural layout
              tile.type = 'plain';
              tile.meta = this.theme.terrain.plain;
              this.blockedMatrix[idx] = 0; // unblocked
            } else if (dist <= radius + 1.2 && tile.type !== 'void') {
              // High-speed perimeter conduits/runways around the base
              tile.type = 'shallow';
              tile.meta = this.theme.terrain.shallow;
              this.blockedMatrix[idx] = 0; // unblocked
            }
          }
        }
      }
    }
  }

  generate() {
    this.tiles = [];
    this.resources = [];
    
    const cols = this.cols;
    const rows = this.rows;
    const midC = Math.floor(cols / 2);
    const midR = Math.floor(rows / 2);

    // Phase 1: Procedural Generation using Trigonometric Cellular Fields with beautiful radial island constraints
    const maxRadius = Math.min(midC, midR) * 0.95;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dc = c - midC;
        const dr = r - midR;
        const distToCenter = Math.sqrt(dc * dc + dr * dr);

        let tileType = 'plain';

        if (distToCenter < 6) {
          // Keep start zone pristine for Mothership landing
          tileType = 'plain';
        } else {
          // Beautiful continuous terrain noise
          let noise = Math.sin(c * 0.2) + Math.cos(r * 0.2) + Math.sin((c + r) * 0.08);
          
          // Normalized distance from center (0 to 1+)
          const d = distToCenter / maxRadius;

          // Strong radial bias: pushes central areas to land, and fades smoothly to water at edges
          const bias = 1.6 * (1.0 - Math.pow(Math.min(d, 1.5), 1.8)) - 0.22;
          noise += bias;

          // Biome Distributions based on biased noise
          if (noise < -0.9) {
            tileType = 'void';
          } else if (noise < -0.4) {
            tileType = 'shallow';
          } else if (noise > 1.3) {
            tileType = 'mountain';
          } else if (noise > 0.65) {
            tileType = 'forest';
          } else {
            tileType = 'plain';
          }
        }

        const tileMeta = this.theme.terrain[tileType];
        this.tiles.push({
          col: c,
          row: r,
          type: tileType,
          meta: tileMeta,
          explored: false
        });
      }
    }

    // Phase 2: Cellular Automata Smoothing Pass (Cleanup singletons)
    const tempGrid = [...this.tiles];
    for (let i = 0; i < 2; i++) {
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const idx = r * cols + c;
          const counts = { plain: 0, void: 0, shallow: 0, forest: 0, mountain: 0 };
          
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nType = tempGrid[(r + dr) * cols + (c + dc)].type;
              counts[nType]++;
            }
          }

          let maxCount = 0;
          let dominantType = this.tiles[idx].type;
          for (const [type, count] of Object.entries(counts)) {
            if (count > maxCount) {
              maxCount = count;
              dominantType = type;
            }
          }

          if (maxCount >= 5 && this.tiles[idx].type !== 'plain' && (c < midC - 6 || c > midC + 6)) {
            this.tiles[idx].type = dominantType;
            this.tiles[idx].meta = this.theme.terrain[dominantType];
          }
        }
      }
    }

    // Set fast binary collision matrix
    for (let i = 0; i < this.tiles.length; i++) {
      this.blockedMatrix[i] = this.tiles[i].meta.blocked ? 1 : 0;
    }

    // Phase 3: Resource Scatter & Outposts
    const isSmall = this.width < 2000;
    const minCampDist = isSmall ? 6 : 9;
    const maxDist = (cols / 2) * 0.92;

    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 2; c++) {
        const dc = c - midC;
        const dr = r - midR;
        const dist = Math.sqrt(dc * dc + dr * dr);

        if (dist < minCampDist) continue;
        if (dist > maxDist) continue;

        const idx = r * cols + c;
        const tile = this.tiles[idx];

        if (tile.type === 'plain' && Math.random() < 0.02) {
          this.resources.push({
            id: `res-${c}-${r}`,
            x: c * this.cellSize + this.cellSize / 2,
            y: r * this.cellSize + this.cellSize / 2,
            type: 'deposit',
            radius: 12,
            name: this.theme.resources.deposit.name,
            color: this.theme.resources.deposit.color,
            amount: 600 + Math.floor(Math.random() * 900),
            valueType: this.theme.resources.deposit.valueType
          });
        }
      }
    }

    // Place exactly 3 strategically spaced, guaranteed enemy camps with custom base terrain plateaus
    const basePositions = [];
    const angles = [
      0 + (Math.random() - 0.5) * 0.25,
      Math.PI * 0.66 + (Math.random() - 0.5) * 0.25,
      Math.PI * 1.33 + (Math.random() - 0.5) * 0.25
    ];
    
    const minCampDistFromCenter = isSmall ? 6 : 9;
    const minInterCampDist = isSmall ? 6 : 9;
    const targetDist = Math.floor(midC * 0.68); // Outer ring of the main island
    
    angles.forEach((angle, i) => {
      let tc = Math.floor(midC + Math.cos(angle) * targetDist);
      let tr = Math.floor(midR + Math.sin(angle) * targetDist);
      
      // Spiral search for the best tile
      let found = false;
      let searchRadius = 0;
      const maxSearch = Math.max(cols, rows);
      
      while (!found && searchRadius < maxSearch) {
        for (let dr = -searchRadius; dr <= searchRadius && !found; dr++) {
          for (let dc = -searchRadius; dc <= searchRadius && !found; dc++) {
            if (Math.abs(dr) !== searchRadius && Math.abs(dc) !== searchRadius && searchRadius > 0) continue;
            
            const testC = tc + dc;
            const testR = tr + dr;
            
            if (testC >= 3 && testC < cols - 3 && testR >= 3 && testR < rows - 3) {
              const dcCenter = testC - midC;
              const drCenter = testR - midR;
              const distToCenter = Math.sqrt(dcCenter * dcCenter + drCenter * drCenter);
              
              // 1. Must be far enough from center player zone
              if (distToCenter < minCampDistFromCenter) continue;
              
              // 2. Must be far enough from already placed camps
              let tooClose = false;
              for (const pos of basePositions) {
                const dcCamp = testC - pos.c;
                const drCamp = testR - pos.r;
                const distToCamp = Math.sqrt(dcCamp * dcCamp + drCamp * drCamp);
                if (distToCamp < minInterCampDist) {
                  tooClose = true;
                  break;
                }
              }
              if (tooClose) continue;
              
              // 3. Prefer land tiles (not void)
              const idx = testR * cols + testC;
              const tile = this.tiles[idx];
              if (tile && tile.type !== 'void') {
                tc = testC;
                tr = testR;
                found = true;
              }
            }
          }
        }
        searchRadius++;
      }
      
      // If we completely failed to find any non-void tile (highly unusual), boundary cap fallback
      if (!found) {
        tc = Math.max(3, Math.min(cols - 4, tc));
        tr = Math.max(3, Math.min(rows - 4, tr));
      }
      
      // Save position for spacing checks
      basePositions.push({ c: tc, r: tr });
      
      // Force generate a beautiful, clean base terrain plateau around this camp
      this.generateBaseTerrainPatch(tc, tr);
      
      // Push the camp resource
      this.resources.push({
        id: `camp-${tc}-${tr}`,
        x: tc * this.cellSize + this.cellSize / 2,
        y: tr * this.cellSize + this.cellSize / 2,
        type: 'camp',
        name: this.theme.resources.camp.name,
        color: this.theme.resources.camp.color,
        health: 2000,
        maxHealth: 2000,
        cleared: false,
        guardsSpawned: false
      });
    });

    // Phase 4: Cache Map Terrain on off-screen Canvas as irregular polygonal/crystalline shards
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = cols * this.cellSize;
    this.mapCanvas.height = rows * this.cellSize;
    const mctx = this.mapCanvas.getContext('2d');

    // 1. Generate irregular crystalline vertex grid with beautiful, smooth jittering (0.18 instead of 0.35)
    const vertices = [];
    for (let r = 0; r <= rows; r++) {
      vertices[r] = [];
      for (let c = 0; c <= cols; c++) {
        let x = c * this.cellSize;
        let y = r * this.cellSize;
        // Jitter interior vertices to generate angular, crystalline polygonal terrain facets gently
        if (c > 0 && c < cols && r > 0 && r < rows) {
          x += (Math.sin(c * 1.5 + r * 2.3) * 0.18) * this.cellSize;
          y += (Math.cos(c * 2.1 + r * 1.1) * 0.18) * this.cellSize;
        }
        vertices[r][c] = { x, y };
      }
    }

    // 2. Render triangular terrain facets onto cached canvas plate
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v_topL = vertices[r][c];
        const v_topR = vertices[r][c + 1];
        const v_botL = vertices[r + 1][c];
        const v_botR = vertices[r + 1][c + 1];

        // Alternate triangulation slash to make crystalline facets organic and high-contrast
        const splitSlash = (c + r) % 2 === 0;

        const idx = r * cols + c;
        const tile = this.tiles[idx];
        const color = tile.meta.color;

        mctx.lineWidth = 1.0;

        if (splitSlash) {
          // Facet A
          mctx.fillStyle = color;
          mctx.beginPath();
          mctx.moveTo(v_topL.x, v_topL.y);
          mctx.lineTo(v_topR.x, v_topR.y);
          mctx.lineTo(v_botR.x, v_botR.y);
          mctx.closePath();
          mctx.fill();

          mctx.strokeStyle = color;
          mctx.stroke();

          // Facet B
          mctx.beginPath();
          mctx.moveTo(v_topL.x, v_topL.y);
          mctx.lineTo(v_botL.x, v_botL.y);
          mctx.lineTo(v_botR.x, v_botR.y);
          mctx.closePath();
          mctx.fill();
          mctx.stroke();
        } else {
          // Facet A
          mctx.fillStyle = color;
          mctx.beginPath();
          mctx.moveTo(v_topL.x, v_topL.y);
          mctx.lineTo(v_topR.x, v_topR.y);
          mctx.lineTo(v_botL.x, v_botL.y);
          mctx.closePath();
          mctx.fill();

          mctx.strokeStyle = color;
          mctx.stroke();

          // Facet B
          mctx.beginPath();
          mctx.moveTo(v_topR.x, v_topR.y);
          mctx.lineTo(v_botL.x, v_botL.y);
          mctx.lineTo(v_botR.x, v_botR.y);
          mctx.closePath();
          mctx.fill();
          mctx.stroke();
        }
      }
    }

    // Procedural Circuit Decals / High-Contrast Geometric Lines for deep high-tech visual layers
    mctx.strokeStyle = 'rgba(0, 229, 255, 0.022)';
    mctx.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      mctx.beginPath();
      mctx.moveTo(Math.random() * this.mapCanvas.width, Math.random() * this.mapCanvas.height);
      mctx.lineTo(Math.random() * this.mapCanvas.width, Math.random() * this.mapCanvas.height);
      mctx.stroke();
    }

    // Greedy Mesh Reduction: Merge adjacent grid blocks into minimized rectangle structures
    this.buildGreedyColliders();

    // Pre-explore camps so the radar and scanners show them
    this.resources.forEach(res => {
      if (res.type === 'camp') {
        const cc = Math.floor(res.x / this.cellSize);
        const cr = Math.floor(res.y / this.cellSize);
        const revealRadius = 3;
        for (let dr = -revealRadius; dr <= revealRadius; dr++) {
          for (let dc = -revealRadius; dc <= revealRadius; dc++) {
            const tc = cc + dc;
            const tr = cr + dr;
            if (tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
              this.tiles[tr * cols + tc].explored = true;
            }
          }
        }
      }
    });

    // Pre-explore Mothership start sector
    const mcc = Math.floor(midC);
    const mcr = Math.floor(midR);
    const playerRadius = 5;
    for (let dr = -playerRadius; dr <= playerRadius; dr++) {
      for (let dc = -playerRadius; dc <= playerRadius; dc++) {
        const tc = mcc + dc;
        const tr = mcr + dr;
        if (tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
          this.tiles[tr * cols + tc].explored = true;
        }
      }
    }
  }

  isBlocked(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true;
    return this.blockedMatrix[row * this.cols + col] === 1;
  }

  buildGreedyColliders() {
    this.greedyRects = [];
    const visited = new Uint8Array(this.cols * this.rows);
    const cols = this.cols;
    const rows = this.rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (this.blockedMatrix[idx] === 1 && !visited[idx]) {
          let width = 0;
          while (c + width < cols && this.blockedMatrix[r * cols + (c + width)] === 1 && !visited[r * cols + (c + width)]) {
            width++;
          }
          let height = 1;
          let ok = true;
          while (r + height < rows && ok) {
            for (let w = 0; w < width; w++) {
              const checkIdx = (r + height) * cols + (c + w);
              if (this.blockedMatrix[checkIdx] !== 1 || visited[checkIdx]) {
                ok = false;
                break;
              }
            }
            if (ok) height++;
          }
          for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
              visited[(r + h) * cols + (c + w)] = 1;
            }
          }
          this.greedyRects.push({
            x: c * this.cellSize,
            y: r * this.cellSize,
            w: width * this.cellSize,
            h: height * this.cellSize
          });
        }
      }
    }
  }

  getTileAt(worldX, worldY) {
    const c = Math.floor(worldX / this.cellSize);
    const r = Math.floor(worldY / this.cellSize);
    if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
      return this.tiles[r * this.cols + c];
    }
    return null;
  }
}
