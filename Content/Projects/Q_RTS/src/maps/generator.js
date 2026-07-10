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
      shallow: { id: 'river', name: 'Mana Stream', color: '#008ba3', blocked: false, speed: 0.75 },
      plain: { id: 'grass', name: 'Emerald Plain', color: '#133e23', blocked: false, speed: 1.0 },
      forest: { id: 'forest', name: 'Ancient Woods', color: '#092111', blocked: false, speed: 0.5 },
      mountain: { id: 'cliff', name: 'Runic Peaks', color: '#2a3b3a', blocked: true, speed: 0.0 }
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
      shallow: { id: 'conduit', name: 'Laser Circuit', color: '#a300cc', blocked: false, speed: 1.2 },
      plain: { id: 'metal', name: 'Chassis Deck', color: '#1f242d', blocked: false, speed: 1.0 },
      forest: { id: 'silicon', name: 'Silicon Pillars', color: '#0f1115', blocked: false, speed: 0.4 },
      mountain: { id: 'machinery', name: 'Core Reactors', color: '#3d4454', blocked: true, speed: 0.0 }
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
      shallow: { id: 'swamp', name: 'Silt Creek', color: '#4d5c41', blocked: false, speed: 0.6 },
      plain: { id: 'dirt', name: 'Highland Field', color: '#544634', blocked: false, speed: 1.0 },
      forest: { id: 'woods', name: 'Pine Forest', color: '#1a2b18', blocked: false, speed: 0.55 },
      mountain: { id: 'rock', name: 'Granite Ridges', color: '#444444', blocked: true, speed: 0.0 }
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

  generate() {
    this.tiles = [];
    this.resources = [];
    
    const cols = this.cols;
    const rows = this.rows;
    const midC = Math.floor(cols / 2);
    const midR = Math.floor(rows / 2);

    // Phase 1: Procedural Generation using Trigonometric Cellular Fields
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
          let noise = Math.sin(c * 0.22) + Math.cos(r * 0.22) + Math.sin((c + r) * 0.09);
          const borderCoords = midC * 0.72;

          if (distToCenter > borderCoords) {
            // Push towards boundaries with organic fade out
            const excess = distToCenter - borderCoords;
            noise -= excess * 0.5;

            if (noise < -1.1) {
              tileType = 'void';
            } else if (noise < -0.6) {
              tileType = 'shallow';
            } else {
              tileType = 'plain';
            }
          } else {
            // Standard Biome Distributions
            if (noise < -1.2) {
              tileType = 'void';
            } else if (noise < -0.7) {
              tileType = 'shallow';
            } else if (noise > 1.25) {
              tileType = 'mountain';
            } else if (noise > 0.65) {
              tileType = 'forest';
            } else {
              tileType = 'plain';
            }
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
        } else if (tile.type === 'mountain' && Math.random() < 0.015) {
          this.resources.push({
            id: `camp-${c}-${r}`,
            x: c * this.cellSize + this.cellSize / 2,
            y: r * this.cellSize + this.cellSize / 2,
            type: 'camp',
            name: this.theme.resources.camp.name,
            color: this.theme.resources.camp.color,
            health: 2000,
            maxHealth: 2000,
            cleared: false,
            guardsSpawned: false
          });
        }
      }
    }

    // Guarantee at least 3 enemy camps are created
    const camps = this.resources.filter(r => r.type === 'camp');
    if (camps.length < 3) {
      const angles = [0, Math.PI * 0.66, Math.PI * 1.33];
      const forceDist = Math.floor(midC * 0.72);
      angles.forEach((angle, i) => {
        const tc = Math.floor(midC + Math.cos(angle) * forceDist);
        const tr = Math.floor(midR + Math.sin(angle) * forceDist);
        if (tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
          const idx = tr * cols + tc;
          this.tiles[idx].type = 'mountain';
          this.tiles[idx].meta = this.theme.terrain.mountain;
          this.blockedMatrix[idx] = 1;
          this.resources.push({
            id: `force-camp-${i}`,
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
        }
      });
    }

    // Phase 4: Cache Map Terrain on off-screen Canvas
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = cols * this.cellSize;
    this.mapCanvas.height = rows * this.cellSize;
    const mctx = this.mapCanvas.getContext('2d');

    // Paint all terrain tiles once
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const tile = this.tiles[idx];
        mctx.fillStyle = tile.meta.color;
        mctx.fillRect(c * this.cellSize, r * this.cellSize, this.cellSize + 0.5, this.cellSize + 0.5);

        // Faint architectural grids on top of plains/metal chassis to keep it brutalist
        if (tile.type === 'plain' || tile.type === 'shallow') {
          mctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
          mctx.lineWidth = 0.5;
          mctx.strokeRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);
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
