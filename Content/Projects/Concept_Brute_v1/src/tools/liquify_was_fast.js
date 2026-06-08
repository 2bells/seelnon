// Liquify functions from liquify_was_fast (Highly Optimized FAST Mode)

export function displaceLiquifyCoords(engine, p0, p1, affectedThisFrame) {
    if (engine.activeLayer === 0) return;
    
    let vx = p1.x - p0.x;
    let vy = p1.y - p0.y;
    const dist = Math.sqrt(vx * vx + vy * vy);
    
    if (dist < 0.1) return;
    
    const R = engine.brush.size / 2;
    const strength = engine.brush.flow || 0.40;
    
    // Cap displacement per step to prevent extreme stretching & tearing
    const maxDist = R * 0.5;
    if (dist > maxDist) {
        vx = (vx / dist) * maxDist;
        vy = (vy / dist) * maxDist;
    }
    
    // Bounding box of the brush in world coordinates
    const minY = Math.floor(Math.min(p0.y, p1.y) - R - 2);
    const maxY = Math.ceil(Math.max(p0.y, p1.y) + R + 2);
    const minX = Math.floor(Math.min(p0.x, p1.x) - R - 2);
    const maxX = Math.ceil(Math.max(p0.x, p1.x) + R + 2);
    
    const sCX = engine.isStatic ? 0 : Math.floor(minX / engine.chunkSize);
    const eCX = engine.isStatic ? 0 : Math.floor(maxX / engine.chunkSize);
    const sCY = engine.isStatic ? 0 : Math.floor(minY / engine.chunkSize);
    const eCY = engine.isStatic ? 0 : Math.floor(maxY / engine.chunkSize);
    
    for (let cx = sCX; cx <= eCX; cx++) {
        for (let cy = sCY; cy <= eCY; cy++) {
            const chunk = engine._getChunk(cx, cy);
            if (!chunk) continue;
            
            const id = `${cx},${cy}`;
            
            // Check if we already have the backup canvas recorded for history and undo/redo
            if (!engine.currentStrokeDirtyChunks.has(id)) {
                const srcCanvas = chunk.canvases[engine.activeLayer];
                const backup = document.createElement('canvas');
                backup.width = srcCanvas.width; backup.height = srcCanvas.height;
                backup.getContext('2d').drawImage(srcCanvas, 0, 0);
                engine.currentStrokeDirtyChunks.set(id, { layer: engine.activeLayer, canvas: backup });
                engine._markDirty(id, engine.activeLayer);
            }
            
            // Get or initialize our optimized liquify cache for this chunk
            if (!engine.liquifyChunkData) {
                engine.liquifyChunkData = new Map();
            }
            
            let chunkData = engine.liquifyChunkData.get(id);
            if (!chunkData) {
                const w = chunk.canvases[engine.activeLayer].width;
                const h = chunk.canvases[engine.activeLayer].height;
                
                const backup = engine.currentStrokeDirtyChunks.get(id).canvas;
                const backupCtx = backup.getContext('2d');
                const originalImageData = backupCtx.getImageData(0, 0, w, h);
                
                // Zero-filled array represents 0 displacement, which avoids the giant for loop!
                const map = new Float32Array(w * h * 2);
                
                chunkData = {
                    w,
                    h,
                    originalImageData,
                    map
                };
                
                engine.liquifyChunkData.set(id, chunkData);
            }
            
            const { w, h, map } = chunkData;
            
            const clx = engine.isStatic ? -engine.staticWidth / 2 : cx * engine.chunkSize;
            const cly = engine.isStatic ? -engine.staticHeight / 2 : cy * engine.chunkSize;
            
            // Local coordinates on chunk matching the brush bounding box
            const localMinX = Math.max(0, Math.floor(minX - clx));
            const localMaxX = Math.min(w - 1, Math.ceil(maxX - clx));
            const localMinY = Math.max(0, Math.floor(minY - cly));
            const localMaxY = Math.min(h - 1, Math.ceil(maxY - cly));
            
            if (localMaxX < localMinX || localMaxY < localMinY) continue;
            
            // Update the local bounding box for this single move frame
            let frameBox = affectedThisFrame.get(id);
            if (!frameBox) {
                frameBox = { minX: localMinX, maxX: localMaxX, minY: localMinY, maxY: localMaxY };
                affectedThisFrame.set(id, frameBox);
            } else {
                frameBox.minX = Math.min(frameBox.minX, localMinX);
                frameBox.maxX = Math.max(frameBox.maxX, localMaxX);
                frameBox.minY = Math.min(frameBox.minY, localMinY);
                frameBox.maxY = Math.max(frameBox.maxY, localMaxY);
            }
            
            // Displace coordinates in the grid using FAST quadratic weights (no square roots or powers)
            const R_sq = R * R;
            
            for (let y = localMinY; y <= localMaxY; y++) {
                const worldY = cly + y;
                const dy = worldY - p0.y;
                const dySq = dy * dy;
                
                for (let x = localMinX; x <= localMaxX; x++) {
                    const worldX = clx + x;
                    const dx = worldX - p0.x;
                    const distSq = dx * dx + dySq;
                    
                    if (distSq < R_sq) {
                        // High-speed quadratic weight: (1 - d^2/R^2)^2 (no Math.sqrt, no Math.pow!)
                        const r2 = distSq / R_sq;
                        const w_term = 1 - r2;
                        const weight = w_term * w_term;
                        
                        const idx = (y * w + x) * 2;
                        map[idx] -= weight * vx * strength;
                        map[idx + 1] -= weight * vy * strength;
                    }
                }
            }
        }
    }
}

export function getOriginalChunkDataFromId(engine, id) {
    const chunk = engine.chunks.get(id);
    if (!chunk) return null;
    
    // Do we have a backup in currentStrokeDirtyChunks?
    const backupData = engine.currentStrokeDirtyChunks.get(id);
    if (backupData) {
      const backupCtx = backupData.canvas.getContext('2d');
      const w = backupData.canvas.width;
      const h = backupData.canvas.height;
      return backupCtx.getImageData(0, 0, w, h).data;
    } else {
      // Read from the activeLayer canvas, which is still unmodified
      const canvas = chunk.canvases[engine.activeLayer];
      const ctx = chunk.ctxs[engine.activeLayer];
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }
}

export function getIntPixelDataAndIdx(engine, wx, wy, chunkCache) {
    const cx = engine.isStatic ? 0 : Math.floor(wx / engine.chunkSize);
    const cy = engine.isStatic ? 0 : Math.floor(wy / engine.chunkSize);
    const id = `${cx},${cy}`;
    
    let data = chunkCache.get(id);
    if (data === undefined) {
      data = getOriginalChunkDataFromId(engine, id);
      chunkCache.set(id, data);
    }
    
    if (!data) return false;
    
    const clx = engine.isStatic ? -engine.staticWidth / 2 : cx * engine.chunkSize;
    const cly = engine.isStatic ? -engine.staticHeight / 2 : cy * engine.chunkSize;
    
    const w = engine.isStatic ? engine.staticWidth : engine.chunkSize;
    const h = engine.isStatic ? engine.staticHeight : engine.chunkSize;
    const lx = Math.max(0, Math.min(w - 1, Math.floor(wx - clx)));
    const ly = Math.max(0, Math.min(h - 1, Math.floor(wy - cly)));
    
    engine._tempData = data;
    engine._tempIdx = (ly * w + lx) * 4;
    return true;
}

export function sampleOriginalNearestWorldPixel(engine, wx, wy, chunkCache, dstData, dstIdx) {
    const lx = Math.round(wx);
    const ly = Math.round(wy);
    if (getIntPixelDataAndIdx(engine, lx, ly, chunkCache)) {
        const d = engine._tempData, idx = engine._tempIdx;
        dstData[dstIdx] = d[idx];
        dstData[dstIdx + 1] = d[idx + 1];
        dstData[dstIdx + 2] = d[idx + 2];
        dstData[dstIdx + 3] = d[idx + 3];
    } else {
        dstData[dstIdx] = 0;
        dstData[dstIdx + 1] = 0;
        dstData[dstIdx + 2] = 0;
        dstData[dstIdx + 3] = 0;
    }
}

export function sampleOriginalWorldPixel(engine, wx, wy, chunkCache, dstData, dstIdx) {
    // Fallback stub: forward to nearest pixel for fast mode
    sampleOriginalNearestWorldPixel(engine, wx, wy, chunkCache, dstData, dstIdx);
}

export function renderLiquifyChunks(engine, affectedThisFrame, forceBilinear = false) {
    if (!affectedThisFrame || affectedThisFrame.size === 0) return;
    
    const chunkCache = new Map();
    
    affectedThisFrame.forEach((box, id) => {
        const chunkData = engine.liquifyChunkData?.get(id);
        if (!chunkData) return;
        
        const chunk = engine.chunks.get(id);
        if (!chunk) return;
        
        const { w, h, originalImageData, map } = chunkData;
        const boxW = box.maxX - box.minX + 1;
        const boxH = box.maxY - box.minY + 1;
        if (boxW <= 0 || boxH <= 0) return;
        
        const chunkCtx = chunk.ctxs[engine.activeLayer];
        const boxImageData = chunkCtx.createImageData(boxW, boxH);
        const dstData = boxImageData.data;
        
        const clx = engine.isStatic ? -engine.staticWidth / 2 : chunk.cx * engine.chunkSize;
        const cly = engine.isStatic ? -engine.staticHeight / 2 : chunk.cy * engine.chunkSize;
        
        // Loop ONLY over the bounds of the brush displacement for this frame step!
        for (let y = box.minY; y <= box.maxY; y++) {
            const localY = y - box.minY;
            for (let x = box.minX; x <= box.maxX; x++) {
                const localX = x - box.minX;
                
                const idx = (y * w + x) * 2;
                const dx_displace = map[idx];
                const dy_displace = map[idx + 1];
                
                const dstIdx = (localY * boxW + localX) * 4;
                
                if (dx_displace === 0 && dy_displace === 0) {
                    const srcData = originalImageData.data;
                    const srcIdx = (y * w + x) * 4;
                    dstData[dstIdx] = srcData[srcIdx];
                    dstData[dstIdx + 1] = srcData[srcIdx + 1];
                    dstData[dstIdx + 2] = srcData[srcIdx + 2];
                    dstData[dstIdx + 3] = srcData[srcIdx + 3];
                } else {
                    // FAST mode nearest neighbor mapping (no interpolation, blazing fast CPU lookups)
                    const srcX = Math.round(x + dx_displace);
                    const srcY = Math.round(y + dy_displace);
                    
                    if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
                        const srcData = originalImageData.data;
                        const srcIdx = (srcY * w + srcX) * 4;
                        dstData[dstIdx] = srcData[srcIdx];
                        dstData[dstIdx + 1] = srcData[srcIdx + 1];
                        dstData[dstIdx + 2] = srcData[srcIdx + 2];
                        dstData[dstIdx + 3] = srcData[srcIdx + 3];
                    } else {
                        // Border fallback crossing chunk boundary: seamless cross-chunk nearest neighbor
                        const worldOrigX = clx + (x + dx_displace);
                        const worldOrigY = cly + (y + dy_displace);
                        sampleOriginalNearestWorldPixel(engine, worldOrigX, worldOrigY, chunkCache, dstData, dstIdx);
                    }
                }
            }
        }
        
        chunkCtx.putImageData(boxImageData, box.minX, box.minY);
    });
    
    engine.refresh();
}

export function bilinearSampleImageData(engine, srcData, w, h, x, y, dstData, dstIdx) {
    // Stub: nearest neighbor mapping fallback
    const px = Math.max(0, Math.min(w - 1, Math.round(x)));
    const py = Math.max(0, Math.min(h - 1, Math.round(y)));
    const srcIdx = (py * w + px) * 4;
    dstData[dstIdx] = srcData[srcIdx];
    dstData[dstIdx+1] = srcData[srcIdx+1];
    dstData[dstIdx+2] = srcData[srcIdx+2];
    dstData[dstIdx+3] = srcData[srcIdx+3];
}

export function bilinearSample(engine, srcData, w, h, x, y, dstData, dstIdx) {
    bilinearSampleImageData(engine, srcData, w, h, x, y, dstData, dstIdx);
}
