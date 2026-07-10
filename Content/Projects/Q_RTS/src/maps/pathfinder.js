/**
 * Pathfinder.js
 * Optimized Grid A* Pathfinding Engine for Massive RTS battles
 */
export class Pathfinder {
  constructor(width, height, cellSize = 40) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.floor(width / cellSize);
    this.rows = Math.floor(height / cellSize);
    this.grid = new Uint8Array(this.cols * this.rows); // 0 = walkable, 1 = blocked
  }

  setGridSize(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.floor(width / cellSize);
    this.rows = Math.floor(height / cellSize);
    this.grid = new Uint8Array(this.cols * this.rows);
  }

  setBlocked(col, row, blocked) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.grid[row * this.cols + col] = blocked ? 1 : 0;
    }
  }

  isBlocked(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return true;
    }
    return this.grid[row * this.cols + col] === 1;
  }

  // Spiral outwards to find the nearest non-blocked (walkable) cell
  findNearestWalkable(col, row) {
    if (!this.isBlocked(col, row)) {
      return { col, row };
    }

    const maxRadius = 15;
    for (let r = 1; r <= maxRadius; r++) {
      for (let i = -r; i <= r; i++) {
        const checkPoints = [
          { c: col + i, r: row - r }, // Top row
          { c: col + i, r: row + r }, // Bottom row
          { c: col - r, r: row + i }, // Left col
          { c: col + r, r: row + i }  // Right col
        ];
        for (const pt of checkPoints) {
          if (pt.c >= 0 && pt.c < this.cols && pt.r >= 0 && pt.r < this.rows) {
            if (!this.isBlocked(pt.c, pt.r)) {
              return { col: pt.c, row: pt.r };
            }
          }
        }
      }
    }
    return { col, row }; // ultimate fallback
  }

  // Find path from world coordinates to world coordinates
  findPath(startX, startY, endX, endY) {
    const sc = Math.floor(startX / this.cellSize);
    const sr = Math.floor(startY / this.cellSize);
    const ec = Math.floor(endX / this.cellSize);
    const er = Math.floor(endY / this.cellSize);

    // Clamp coordinates to grid boundary
    let startCol = Math.max(0, Math.min(this.cols - 1, sc));
    let startRow = Math.max(0, Math.min(this.rows - 1, sr));
    let endCol = Math.max(0, Math.min(this.cols - 1, ec));
    let endRow = Math.max(0, Math.min(this.rows - 1, er));

    // Resolve starting and target locations to the nearest walkable space
    const startWalkable = this.findNearestWalkable(startCol, startRow);
    startCol = startWalkable.col;
    startRow = startWalkable.row;

    const endWalkable = this.findNearestWalkable(endCol, endRow);
    endCol = endWalkable.col;
    endRow = endWalkable.row;

    // Adjust target coordinates to center of resolved walkable cell
    const targetX = endCol * this.cellSize + this.cellSize / 2;
    const targetY = endRow * this.cellSize + this.cellSize / 2;

    if (startCol === endCol && startRow === endRow) {
      return [{ x: targetX, y: targetY }];
    }

    const openSet = [];
    const closedSet = new Uint8Array(this.cols * this.rows);
    const gScore = new Float32Array(this.cols * this.rows).fill(Infinity);
    const fScore = new Float32Array(this.cols * this.rows).fill(Infinity);
    const parent = new Int32Array(this.cols * this.rows).fill(-1);

    const startIndex = startRow * this.cols + startCol;
    const endIndex = endRow * this.cols + endCol;

    gScore[startIndex] = 0;
    fScore[startIndex] = this.heuristic(startCol, startRow, endCol, endRow);

    openSet.push({ col: startCol, row: startRow, f: fScore[startIndex], index: startIndex });

    let found = false;

    while (openSet.length > 0) {
      // Find lowest f-score
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) {
          lowestIdx = i;
        }
      }

      const current = openSet[lowestIdx];
      if (current.col === endCol && current.row === endRow) {
        found = true;
        break;
      }

      openSet.splice(lowestIdx, 1);
      closedSet[current.index] = 1;

      // 8-directional neighbors
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (dc === 0 && dr === 0) continue;

          const nc = current.col + dc;
          const nr = current.row + dr;

          if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;

          const neighborIndex = nr * this.cols + nc;
          if (closedSet[neighborIndex] === 1 || this.grid[neighborIndex] === 1) continue;

          // Prevent cutting corners through blocked tiles diagonally
          if (dc !== 0 && dr !== 0) {
            if (this.grid[current.row * this.cols + nc] === 1 || this.grid[nr * this.cols + current.col] === 1) {
              continue;
            }
          }

          const moveCost = (dc !== 0 && dr !== 0) ? 1.414 : 1.0;
          const tentativeG = gScore[current.index] + moveCost;

          if (tentativeG < gScore[neighborIndex]) {
            parent[neighborIndex] = current.index;
            gScore[neighborIndex] = tentativeG;
            const h = this.heuristic(nc, nr, endCol, endRow);
            fScore[neighborIndex] = tentativeG + h;

            // Check if already in openSet
            let inOpen = false;
            for (let i = 0; i < openSet.length; i++) {
              if (openSet[i].index === neighborIndex) {
                openSet[i].f = fScore[neighborIndex];
                inOpen = true;
                break;
              }
            }

            if (!inOpen) {
              openSet.push({ col: nc, row: nr, f: fScore[neighborIndex], index: neighborIndex });
            }
          }
        }
      }
    }

    if (!found) {
      // Return empty path to prevent unit passing through blocked terrain
      return [];
    }

    // Reconstruct path
    const path = [];
    let currIdx = endIndex;
    const halfCell = this.cellSize / 2;

    while (currIdx !== -1) {
      const col = currIdx % this.cols;
      const row = Math.floor(currIdx / this.cols);
      // Convert back to world coordinates centered on cell
      path.push({
        x: col * this.cellSize + halfCell,
        y: row * this.cellSize + halfCell
      });
      currIdx = parent[currIdx];
    }

    path.reverse();
    // Replace final step with resolved target coordinate for safe precise arrival
    if (path.length > 0) {
      path[path.length - 1] = { x: targetX, y: targetY };
    }
    return path;
  }

  heuristic(c1, r1, c2, r2) {
    const dc = Math.abs(c1 - c2);
    const dr = Math.abs(r1 - r2);
    // Diagonal distance (cheaper approximation than Euclidean)
    return (dc + dr) + (1.414 - 2) * Math.min(dc, dr);
  }
}
