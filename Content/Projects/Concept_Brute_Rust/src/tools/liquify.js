import { wasmCore } from '../wasm/wasmBridge.js';

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
                const session = wasmCore.liquifyGetOrCreateSession(id, originalImageData.data, w, h);
                
                chunkData = {
                    w,
                    h,
                    originalImageData,
                    map,
                    session
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
            
            // Displace coordinates in the grid using Rust WASM (with zero-copy session)
            const exponent = (engine.brush.falloff !== undefined) ? (engine.brush.falloff * 4.0) : 2.0;
            let handledByWasm = false;
            if (chunkData.session) {
                handledByWasm = wasmCore.liquifyDisplaceSession(
                    chunkData.session,
                    localMinX,
                    localMaxX,
                    localMinY,
                    localMaxY,
                    clx,
                    cly,
                    p0.x,
                    p0.y,
                    vx * strength,
                    vy * strength,
                    R,
                    exponent
                );
            }
            if (!handledByWasm) {
                handledByWasm = wasmCore.liquifyDisplaceFull(
                    map,
                    w,
                    localMinX,
                    localMaxX,
                    localMinY,
                    localMaxY,
                    clx,
                    cly,
                    p0.x,
                    p0.y,
                    vx * strength,
                    vy * strength,
                    R,
                    exponent
                );
            }

            if (!handledByWasm) {
                const R_sq = R * R;
                const inv_R_sq = 1 / R_sq;

                for (let y = localMinY; y <= localMaxY; y++) {
                    const worldY = cly + y;
                    const dy = worldY - p0.y;
                    const dySq = dy * dy;
                    if (dySq >= R_sq) continue;
                    const rowIdx = y * w * 2;
                    
                    for (let x = localMinX; x <= localMaxX; x++) {
                        const worldX = clx + x;
                        const dx = worldX - p0.x;
                        const distSq = dx * dx + dySq;
                        
                        if (distSq < R_sq) {
                            const d = Math.sqrt(distSq);
                            const rRatio = d / R;
                            const weight = Math.max(0, Math.min(1, Math.pow(1 - rRatio * rRatio, exponent)));
                            
                            const idx = rowIdx + x * 2;
                            map[idx] -= weight * vx * strength;
                            map[idx + 1] -= weight * vy * strength;
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
        const bMinX = Math.max(0, Math.min(w - 1, box.minX));
        const bMaxX = Math.max(0, Math.min(w - 1, box.maxX));
        const bMinY = Math.max(0, Math.min(h - 1, box.minY));
        const bMaxY = Math.max(0, Math.min(h - 1, box.maxY));
        const boxW = bMaxX - bMinX + 1;
        const boxH = bMaxY - bMinY + 1;
        if (boxW <= 0 || boxH <= 0) return;
        
        const chunkCtx = chunk.ctxs[engine.activeLayer];
        if (!chunk._cachedBoxImageData || chunk._cachedBoxImageData.width !== boxW || chunk._cachedBoxImageData.height !== boxH) {
            chunk._cachedBoxImageData = chunkCtx.createImageData(boxW, boxH);
        }
        const boxImageData = chunk._cachedBoxImageData;
        const dstData = boxImageData.data;
        
        const clx = engine.isStatic ? -engine.staticWidth / 2 : chunk.cx * engine.chunkSize;
        const cly = engine.isStatic ? -engine.staticHeight / 2 : chunk.cy * engine.chunkSize;

        // Fast Rust WASM path for in-chunk bilinear warping (handles clamping at boundaries)
        let wasmRes = null;
        if (chunkData.session) {
            wasmRes = wasmCore.liquifyRenderSession(
                chunkData.session,
                bMinX,
                bMaxX,
                bMinY,
                bMaxY,
                dstData,
                true
            );
        } else {
            wasmRes = wasmCore.liquifyRenderBox(
                originalImageData.data,
                dstData,
                map,
                w,
                h,
                bMinX,
                bMaxX,
                bMinY,
                bMaxY,
                true
            );
        }

        if (!wasmRes) {
            // Full JS fallback if WebAssembly is unavailable
            for (let y = bMinY; y <= bMaxY; y++) {
                const localY = y - bMinY;
                for (let x = bMinX; x <= bMaxX; x++) {
                    const localX = x - bMinX;
                    const idx = (y * w + x) * 2;
                    const dx_displace = map[idx];
                    const dy_displace = map[idx + 1];

                    const srcX = x + dx_displace;
                    const srcY = y + dy_displace;
                    const dstIdx = (localY * boxW + localX) * 4;
                    const worldOrigX = clx + srcX;
                    const worldOrigY = cly + srcY;
                    sampleOriginalWorldPixel(engine, worldOrigX, worldOrigY, chunkCache, dstData, dstIdx);
                }
            }
        }
        
        chunkCtx.putImageData(boxImageData, bMinX, bMinY);
        engine._markDirty(id, engine.activeLayer, false);
        if (engine.gpuRenderer) {
            engine.gpuRenderer.markChunkLayerDirty(chunk, engine.activeLayer);
        }
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
