export function displaceLiquifyCoords(engine, p0, p1, affectedThisFrame, forceStepOne = false) {
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
                backup.getContext('2d', { willReadFrequently: true }).drawImage(srcCanvas, 0, 0);
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
                
                const backupData = engine.currentStrokeDirtyChunks.get(id);
                const backup = backupData.canvas;
                
                if (!backupData._cachedImageData) {
                    const backupCtx = backup.getContext('2d', { willReadFrequently: true });
                    backupData._cachedImageData = backupCtx.getImageData(0, 0, w, h);
                }
                const originalImageData = backupData._cachedImageData;
                
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
            
            // Displace coordinates in the grid
            const R_sq = R * R;
            const exponent = (engine.brush.falloff !== undefined) ? (engine.brush.falloff * 4.0) : 2.0;
            
            // Dynamic step based on radius for massive performance speedup at larger brush sizes
            const qualityAttr = engine.brush.liquifyQuality ?? 2;
            const step = (forceStepOne || qualityAttr === 3) ? 1 : ((R < 80) ? 1 : ((R < 200) ? 2 : ((R < 400) ? 4 : 8)));
            
            const startY = Math.floor(localMinY / step) * step;
            const startX = Math.floor(localMinX / step) * step;
            
            for (let y = startY; y <= localMaxY; y += step) {
                const worldY = cly + y;
                const dy = worldY - p0.y;
                const dySq = dy * dy;
                
                for (let x = startX; x <= localMaxX; x += step) {
                    const worldX = clx + x;
                    const dx = worldX - p0.x;
                    const distSq = dx * dx + dySq;
                    
                    if (distSq < R_sq) {
                        const d = Math.sqrt(distSq);
                        const rRatio = d / R;
                        // Configurable exponent falloff matching quartic curve (1 - r^2)^exponent
                        const weight = Math.max(0, Math.min(1, Math.pow(1 - rRatio * rRatio, exponent)));
                        
                        const dispX = -weight * vx * strength;
                        const dispY = -weight * vy * strength;
                        
                        // Fill step x step block in map
                        for (let blockY = 0; blockY < step; blockY++) {
                            const mapY = y + blockY;
                            if (mapY < localMinY) continue;
                            if (mapY > localMaxY) break;
                            for (let blockX = 0; blockX < step; blockX++) {
                                const mapX = x + blockX;
                                if (mapX < localMinX) continue;
                                if (mapX > localMaxX) break;
                                
                                const idx = (mapY * w + mapX) * 2;
                                map[idx] += dispX;
                                map[idx + 1] += dispY;
                            }
                        }
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
        if (!backupData._cachedImageData) {
            const backupCtx = backupData.canvas.getContext('2d', { willReadFrequently: true });
            const w = backupData.canvas.width;
            const h = backupData.canvas.height;
            backupData._cachedImageData = backupCtx.getImageData(0, 0, w, h);
        }
        return backupData._cachedImageData.data;
    } else {
        // Read from the activeLayer offscreen canvas, which is still unmodified
        engine._syncChunkOffscreen(chunk, engine.activeLayer);
        const offscreenCanv = chunk.offscreenCanvases[engine.activeLayer];
        const offscreenCtx = chunk.offscreenCtxs[engine.activeLayer];
        
        if (!chunk._cachedOffscreenImageData) {
            chunk._cachedOffscreenImageData = [];
        }
        if (!chunk._cachedOffscreenImageData[engine.activeLayer]) {
            chunk._cachedOffscreenImageData[engine.activeLayer] = offscreenCtx.getImageData(0, 0, offscreenCanv.width, offscreenCanv.height);
        }
        return chunk._cachedOffscreenImageData[engine.activeLayer].data;
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

export function sampleOriginalWorldPixel(engine, wx, wy, chunkCache, dstData, dstIdx) {
    const x0 = Math.floor(wx);
    const x1 = x0 + 1;
    const y0 = Math.floor(wy);
    const y1 = y0 + 1;
    
    const tx = wx - x0;
    const ty = wy - y0;
    
    let c00_r = 0, c00_g = 0, c00_b = 0, c00_a = 0;
    if (getIntPixelDataAndIdx(engine, x0, y0, chunkCache)) {
        const d = engine._tempData, idx = engine._tempIdx;
        c00_r = d[idx]; c00_g = d[idx+1]; c00_b = d[idx+2]; c00_a = d[idx+3];
    }
    
    let c10_r = 0, c10_g = 0, c10_b = 0, c10_a = 0;
    if (getIntPixelDataAndIdx(engine, x1, y0, chunkCache)) {
        const d = engine._tempData, idx = engine._tempIdx;
        c10_r = d[idx]; c10_g = d[idx+1]; c10_b = d[idx+2]; c10_a = d[idx+3];
    }
    
    let c01_r = 0, c01_g = 0, c01_b = 0, c01_a = 0;
    if (getIntPixelDataAndIdx(engine, x0, y1, chunkCache)) {
        const d = engine._tempData, idx = engine._tempIdx;
        c01_r = d[idx]; c01_g = d[idx+1]; c01_b = d[idx+2]; c01_a = d[idx+3];
    }
    
    let c11_r = 0, c11_g = 0, c11_b = 0, c11_a = 0;
    if (getIntPixelDataAndIdx(engine, x1, y1, chunkCache)) {
        const d = engine._tempData, idx = engine._tempIdx;
        c11_r = d[idx]; c11_g = d[idx+1]; c11_b = d[idx+2]; c11_a = d[idx+3];
    }
    
    const r0_r = c00_r + tx * (c10_r - c00_r);
    const r1_r = c01_r + tx * (c11_r - c01_r);
    dstData[dstIdx] = Math.round(r0_r + ty * (r1_r - r0_r));
    
    const r0_g = c00_g + tx * (c10_g - c00_g);
    const r1_g = c01_g + tx * (c11_g - c01_g);
    dstData[dstIdx + 1] = Math.round(r0_g + ty * (r1_g - r0_g));
    
    const r0_b = c00_b + tx * (c10_b - c00_b);
    const r1_b = c01_b + tx * (c11_b - c01_b);
    dstData[dstIdx + 2] = Math.round(r0_b + ty * (r1_b - r0_b));
    
    const r0_a = c00_a + tx * (c10_a - c00_a);
    const r1_a = c01_a + tx * (c11_a - c01_a);
    dstData[dstIdx + 3] = Math.round(r0_a + ty * (r1_a - r0_a));
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
        const cly = engine.isStatic ? -engine.staticHeight / 2 : cy_y(engine, chunk.cy);
        
        // Let's resolve the block coordinates
        function cy_y(eng, cy) {
            return eng.isStatic ? -eng.staticHeight / 2 : cy * eng.chunkSize;
        }

        const realCly = cy_y(engine, chunk.cy);
        
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
                    const srcX = x + dx_displace;
                    const srcY = y + dy_displace;
                    
                    const x0 = Math.floor(srcX);
                    const y0 = Math.floor(srcY);
                    
                    if (x0 >= 0 && x0 < w - 1 && y0 >= 0 && y0 < h - 1) {
                        // Fast path within chunk: direct array lookups
                        const srcData = originalImageData.data;
                        const qualityAttr = engine.brush.liquifyQuality ?? 2;
                        const useNearest = (engine.brush.size >= 300) && (qualityAttr === 1 || (!forceBilinear && qualityAttr === 2));
                        if (useNearest) {
                            // Nearest-neighbor optimization for huge brush performance! Indistinguishable at 300px+ during moves
                            const roundX = Math.round(srcX);
                            const roundY = Math.round(srcY);
                            const srcIdx = (roundY * w + roundX) * 4;
                            dstData[dstIdx] = srcData[srcIdx];
                            dstData[dstIdx + 1] = srcData[srcIdx + 1];
                            dstData[dstIdx + 2] = srcData[srcIdx + 2];
                            dstData[dstIdx + 3] = srcData[srcIdx + 3];
                        } else {
                            const tx = srcX - x0;
                            const ty = srcY - y0;
                            const idx00 = (y0 * w + x0) * 4;
                            const idx10 = (y0 * w + (x0 + 1)) * 4;
                            const idx01 = ((y0 + 1) * w + x0) * 4;
                            const idx11 = ((y0 + 1) * w + (x0 + 1)) * 4;
                            
                            // Red
                            const r0_r = srcData[idx00] + tx * (srcData[idx10] - srcData[idx00]);
                            const r1_r = srcData[idx01] + tx * (srcData[idx11] - srcData[idx01]);
                            dstData[dstIdx] = Math.round(r0_r + ty * (r1_r - r0_r));
                            
                            // Green
                            const r0_g = srcData[idx00 + 1] + tx * (srcData[idx10 + 1] - srcData[idx00 + 1]);
                            const r1_g = srcData[idx01 + 1] + tx * (srcData[idx11 + 1] - srcData[idx01 + 1]);
                            dstData[dstIdx + 1] = Math.round(r0_g + ty * (r1_g - r0_g));
                            
                            // Blue
                            const r0_b = srcData[idx00 + 2] + tx * (srcData[idx10 + 2] - srcData[idx00 + 2]);
                            const r1_b = srcData[idx01 + 2] + tx * (srcData[idx11 + 2] - srcData[idx01 + 2]);
                            dstData[dstIdx + 2] = Math.round(r0_b + ty * (r1_b - r0_b));
                            
                            // Alpha
                            const r0_a = srcData[idx00 + 3] + tx * (srcData[idx10 + 3] - srcData[idx00 + 3]);
                            const r1_a = srcData[idx01 + 3] + tx * (srcData[idx11 + 3] - srcData[idx01 + 3]);
                            dstData[dstIdx + 3] = Math.round(r0_a + ty * (r1_a - r0_a));
                        }
                    } else {
                        // Turn local original coordinates (srcX, srcY) into absolute World Space!
                        const worldOrigX = clx + srcX;
                        const worldOrigY = realCly + srcY;
                        
                        // Slow path crossing chunk boundary: seamless cross-chunk sampling
                        sampleOriginalWorldPixel(engine, worldOrigX, worldOrigY, chunkCache, dstData, dstIdx);
                    }
                }
            }
        }
        
        chunkCtx.putImageData(boxImageData, box.minX, box.minY);
    });
    
    engine.refresh();
}

export function bilinearSampleImageData(engine, srcData, w, h, x, y, dstData, dstIdx) {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;
    
    const tx = x - x0;
    const ty = y - y0;
    
    const ix0 = x0 < 0 ? 0 : (x0 >= w ? w - 1 : x0);
    const ix1 = x1 < 0 ? 0 : (x1 >= w ? w - 1 : x1);
    const iy0 = y0 < 0 ? 0 : (y0 >= h ? h - 1 : y0);
    const iy1 = y1 < 0 ? 0 : (y1 >= h ? h - 1 : y1);
    
    const idx00 = (iy0 * w + ix0) * 4;
    const idx10 = (iy0 * w + ix1) * 4;
    const idx01 = (iy1 * w + ix0) * 4;
    const idx11 = (iy1 * w + ix1) * 4;
    
    for (let c = 0; c < 4; c++) {
        const c00 = srcData[idx00 + c];
        const c10 = srcData[idx10 + c];
        const c01 = srcData[idx01 + c];
        const c11 = srcData[idx11 + c];
        
        const r0 = c00 + tx * (c10 - c00);
        const r1 = c01 + tx * (c11 - c01);
        
        dstData[dstIdx + c] = Math.round(r0 + ty * (r1 - r0));
    }
}

export function bilinearSample(engine, srcData, w, h, x, y, dstData, dstIdx) {
    bilinearSampleImageData(engine, srcData, w, h, x, y, dstData, dstIdx);
}
