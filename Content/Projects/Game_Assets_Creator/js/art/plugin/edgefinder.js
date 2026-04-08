export class EdgeFinder {
  constructor() {
    this.threshold = 30; // Default threshold value
  }
  
  findEdges(imageData, customThreshold = null) {
    console.time('findEdges');
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const edges = new Uint8Array(width * height);
    
    // Use custom threshold if provided, otherwise use the instance threshold
    const threshold = customThreshold !== null ? customThreshold : this.threshold;
    
    console.log("Edge detection using threshold:", threshold);
    
    // Use a more efficient edge detection approach
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3]; // Alpha channel
        
        // Skip fully transparent pixels
        if (a === 0) continue;
        
        let isDifferent = false;
        
        // Check 8-neighbor pixels for significant color/alpha difference
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const nx = x + dx;
            const ny = y + dy;
            const nidx = (ny * width + nx) * 4;
            
            const na = data[nidx + 3];
            
            // If neighbor is fully transparent or alpha difference is significant
            if (na === 0 || Math.abs(a - na) > threshold) {
              isDifferent = true;
              break;
            }
            
            // Color difference check
            const diff = Math.abs(data[idx] - data[nidx]) + 
                         Math.abs(data[idx+1] - data[nidx+1]) + 
                         Math.abs(data[idx+2] - data[nidx+2]);
            
            if (diff > threshold) {
              isDifferent = true;
              break;
            }
          }
          
          if (isDifferent) break;
        }
        
        edges[y * width + x] = isDifferent ? 1 : 0;
      }
    }
    
    console.timeEnd('findEdges');
    return edges;
  }

  expandSprite(width, height, edges, offset) {
    console.time('expandSprite');
    console.log('Expanding sprite with offset:', offset); // Log the actual offset being used
    
    const expanded = new Uint8Array(width * height);
    
    // Use the offset directly instead of calculating it
    const pixelOffset = Math.max(0, offset); // Clamp between 1 and 30 pixels
    
    // Copy original edges
    expanded.set(edges);
    
    // Expand edges using the direct pixel offset
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x]) {
          const minX = Math.max(0, x - pixelOffset);
          const maxX = Math.min(width - 1, x + pixelOffset);
          const minY = Math.max(0, y - pixelOffset);
          const maxY = Math.min(height - 1, y + pixelOffset);
          
          for (let ny = minY; ny <= maxY; ny++) {
            for (let nx = minX; nx <= maxX; nx++) {
              expanded[ny * width + nx] = 1;
            }
          }
        }
      }
    }
    
    console.timeEnd('expandSprite');
    return expanded;
  }

  floodFillFromEdges(width, height, edges) {
    console.time('floodFillFromEdges');
    const visited = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let queueHead = 0;
    let queueTail = 0;
    
    // Add border pixels to queue
    for (let x = 0; x < width; x++) {
      queue[queueTail++] = x;
      queue[queueTail++] = (height - 1) * width + x;
      visited[x] = 1;
      visited[(height - 1) * width + x] = 1;
    }
    
    for (let y = 1; y < height - 1; y++) {
      queue[queueTail++] = y * width;
      queue[queueTail++] = y * width + width - 1;
      visited[y * width] = 1;
      visited[y * width + width - 1] = 1;
    }
    
    const dx = [0, 1, 0, -1];
    const dy = [-1, 0, 1, 0];
    
    while (queueHead < queueTail) {
      const current = queue[queueHead++];
      const x = current % width;
      const y = Math.floor(current / width);
      
      for (let i = 0; i < 4; i++) {
        const nx = x + dx[i];
        const ny = y + dy[i];
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nextIndex = ny * width + nx;
          
          if (!visited[nextIndex] && !edges[nextIndex]) {
            visited[nextIndex] = 1;
            queue[queueTail++] = nextIndex;
          }
        }
      }
    }
    
    console.timeEnd('floodFillFromEdges');
    return visited;
  }
}