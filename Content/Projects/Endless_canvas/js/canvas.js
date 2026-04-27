import { state } from './state.js';
import { scheduleSave, clearAllProjectData } from './storage.js';
import { hexToRgba, drawVariableWidthStrokePolygon, calculateStrokeBounds, getVariableWidthPath } from './utils/drawing.js';
import { screenToWorld } from './events.js';

// Helper to get current world-space viewport
export function getWorldViewport() {
    const p1 = screenToWorld(0, 0);
    const p2 = screenToWorld(window.innerWidth, window.innerHeight);
    return {
        minX: Math.min(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxX: Math.max(p1.x, p2.x),
        maxY: Math.max(p1.y, p2.y)
    };
}

// Import brush drawing functions
import { drawPenStroke } from './brush/pen.js';
import { drawWireframeStroke } from './brush/wireframe.js';
import { drawPixelStroke } from './brush/pixel.js';
import { drawSketchyStroke, drawAnimatedSketchyStroke } from './brush/sketchy.js';

let canvas;
let ctx;

// --- Rendering Optimization: Chunk-Based Cache ---
const CHUNK_SIZE = 1024; // In world units
const chunkCache = new Map(); // key: "cx,cy" -> { canvas, ctx, needsUpdate, strokes: Set }

function getChunkKey(cx, cy) {
    return `${cx},${cy}`;
}

function isStrokeAnimated(stroke) {
    // Both sketchy types are considered animated to maintain live texture
    if (stroke.type === 'sketchy' || stroke.type === 'sketchy-animated') {
        return true;
    }
    if (stroke.type === 'wireframe') {
        const speed = stroke.wireframeAnimationSpeed || 0;
        const amount = stroke.wireframeAnimationAmount || 0;
        return speed > 0 && amount > 0;
    }
    return false;
}

export function updateAnimatedStrokesList() {
    state.animatedStrokes.clear();
    state.strokes.forEach(s => {
        if (isStrokeAnimated(s)) state.animatedStrokes.add(s);
    });
}

/**
 * Optimized helper to add a single stroke to the animation list without re-filtering all.
 */
function registerAnimatedStroke(stroke) {
    if (isStrokeAnimated(stroke)) {
        state.animatedStrokes.add(stroke);
    }
}

export function clearChunkCache() {
    chunkCache.forEach(chunk => {
        if (chunk.canvas) {
            chunk.canvas.width = 0;
            chunk.canvas.height = 0;
        }
    });
    chunkCache.clear();
}

function getVisibleChunks(viewport) {
    const startCx = Math.floor(viewport.minX / CHUNK_SIZE);
    const endCx = Math.floor(viewport.maxX / CHUNK_SIZE);
    const startCy = Math.floor(viewport.minY / CHUNK_SIZE);
    const endCy = Math.floor(viewport.maxY / CHUNK_SIZE);

    const chunks = [];
    const numPotentialChunks = (endCx - startCx + 1) * (endCy - startCy + 1);

    // If the number of potential chunks in viewport is huge (e.g. very zoomed out),
    // it's faster to iterate through existing chunks and check bounds.
    if (numPotentialChunks > 1000) {
        for (const chunk of chunkCache.values()) {
            if (chunk.cx >= startCx && chunk.cx <= endCx && chunk.cy >= startCy && chunk.cy <= endCy) {
                chunks.push(chunk);
            }
        }
    } else {
        for (let cx = startCx; cx <= endCx; cx++) {
            for (let cy = startCy; cy <= endCy; cy++) {
                const key = getChunkKey(cx, cy);
                let chunk = chunkCache.get(key);
                if (chunk) {
                    chunks.push(chunk);
                }
            }
        }
    }
    return chunks;
}

export function invalidateChunksForStroke(stroke, forceRemove = false) {
    if (!stroke.bounds) stroke.bounds = calculateStrokeBounds(stroke);
    const startCx = Math.floor(stroke.bounds.minX / CHUNK_SIZE);
    const endCx = Math.floor(stroke.bounds.maxX / CHUNK_SIZE);
    const startCy = Math.floor(stroke.bounds.minY / CHUNK_SIZE);
    const endCy = Math.floor(stroke.bounds.maxY / CHUNK_SIZE);

    const isAnimated = isStrokeAnimated(stroke);

    for (let cx = startCx; cx <= endCx; cx++) {
        for (let cy = startCy; cy <= endCy; cy++) {
            const key = getChunkKey(cx, cy);
            let chunk = chunkCache.get(key);
            
            if (!chunk && !forceRemove) {
                chunk = {
                    cx, cy,
                    worldX: cx * CHUNK_SIZE,
                    worldY: cy * CHUNK_SIZE,
                    canvas: null,
                    ctx: null,
                    needsUpdate: true,
                    strokes: new Set()
                };
                chunkCache.set(key, chunk);
            }

            if (chunk) {
                chunk.needsUpdate = true;
                
                if (forceRemove || isAnimated) {
                    chunk.strokes.delete(stroke);
                } else {
                    // Double check membership
                    if (isStrokeInChunk(stroke, cx, cy)) {
                        chunk.strokes.add(stroke);
                    } else {
                        chunk.strokes.delete(stroke);
                    }
                }
            }
        }
    }
}

function isStrokeInChunk(stroke, cx, cy) {
    const worldX = cx * CHUNK_SIZE;
    const worldY = cy * CHUNK_SIZE;
    return !(stroke.bounds.maxX < worldX || 
             stroke.bounds.minX > worldX + CHUNK_SIZE || 
             stroke.bounds.maxY < worldY || 
             stroke.bounds.minY > worldY + CHUNK_SIZE);
}

export function rebuildChunkMemberships() {
    chunkCache.forEach(chunk => {
        chunk.strokes.clear();
        chunk.needsUpdate = true;
    });

    state.strokes.forEach(stroke => {
        if (!stroke.bounds) stroke.bounds = calculateStrokeBounds(stroke);

        // Animated strokes are drawn live, not baked into chunks
        if (isStrokeAnimated(stroke)) return;

        const startCx = Math.floor(stroke.bounds.minX / CHUNK_SIZE);
        const endCx = Math.floor(stroke.bounds.maxX / CHUNK_SIZE);
        const startCy = Math.floor(stroke.bounds.minY / CHUNK_SIZE);
        const endCy = Math.floor(stroke.bounds.maxY / CHUNK_SIZE);

        for (let cx = startCx; cx <= endCx; cx++) {
            for (let cy = startCy; cy <= endCy; cy++) {
                const key = getChunkKey(cx, cy);
                let chunk = chunkCache.get(key);
                if (!chunk) {
                    chunk = { cx, cy, worldX: cx * CHUNK_SIZE, worldY: cy * CHUNK_SIZE, canvas: null, ctx: null, needsUpdate: true, strokes: new Set() };
                    chunkCache.set(key, chunk);
                }
                chunk.strokes.add(stroke);
            }
        }
    });
}

function renderChunk(chunk, targetScale) {
    // Optimization: If a chunk has no strokes, don't allocate canvas memory.
    if (chunk.strokes.size === 0) {
        chunk.canvas = null;
        chunk.ctx = null;
        chunk.needsUpdate = false;
        return;
    }

    // Determine resolution based on current zoom for sharpness, but clamp it to avoid huge bitmaps
    const resolution = Math.min(2.0, Math.max(0.5, targetScale)); // 0.5 to 2.0 scale for caching
    const pSize = Math.ceil(CHUNK_SIZE * resolution);

    if (!chunk.canvas || chunk.canvas.width !== pSize || chunk.canvas.height !== pSize) {
        chunk.canvas = new OffscreenCanvas(pSize, pSize);
        chunk.ctx = chunk.canvas.getContext('2d', { alpha: true });
    }

    const cctx = chunk.ctx;
    cctx.clearRect(0, 0, pSize, pSize);
    
    cctx.save();
    cctx.scale(resolution, resolution);
    cctx.translate(-chunk.worldX, -chunk.worldY);

    chunk.strokes.forEach(stroke => {
        // Only draw non-selected strokes in chunks to keep selection transformations "live"
        if (state.selectedStrokes.includes(stroke)) return;
        
        drawStroke(cctx, stroke, false, targetScale);
    });

    cctx.restore();
    chunk.needsUpdate = false;
    chunk.cachedResolution = resolution;
}

// --- End Chunk Logic ---

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

export function init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    window.addEventListener('requestSyncUI', () => {
        const loading = document.getElementById('loading-overlay');
        if (loading) loading.classList.remove('hidden');
        
        clearChunkCache();
        rebuildChunkMemberships();
        updateAnimatedStrokesList();
        
        if (loading) loading.classList.add('hidden');
    });

    window.addEventListener('projectLoaded', () => {
        clearChunkCache();
        rebuildChunkMemberships();
        updateAnimatedStrokesList();
    });

    // Initial build of chunks if strokes exist (e.g. from state loading)
    rebuildChunkMemberships();
    updateAnimatedStrokesList();

    window.addEventListener('rebuildChunksRequest', () => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');

        // Delay processing slightly to allow UI to render the loading state
        setTimeout(() => {
            rebuildChunkMemberships();
            if (overlay) overlay.classList.add('hidden');
        }, 100);
    });
}

// Function to rotate points around a pivot
export function rotateStrokes(strokes, angle, pivot) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // Treat strokes as immutable: replace the modified ones in the main array
    const updatedStrokes = [];

    for (const stroke of strokes) {
        // Invalidate old position in chunks before moving
        invalidateChunksForStroke(stroke, true);
        
        // Create new stroke object with rotated points
        const newStroke = {
            ...stroke,
            points: stroke.points.map(p => {
                const dx = p.x - pivot.x;
                const dy = p.y - pivot.y;
                return {
                    ...p,
                    x: pivot.x + (dx * cos - dy * sin),
                    y: pivot.y + (dx * sin + dy * cos)
                };
            })
        };

        invalidateStrokeCaches(newStroke);
        // Replace in main strokes list
        const idx = state.strokes.indexOf(stroke);
        if (idx !== -1) state.strokes[idx] = newStroke;
        
        // Update selection reference
        updatedStrokes.push(newStroke);
        
        // Invalidate new position
        invalidateChunksForStroke(newStroke);
    }
    
    state.selectedStrokes = updatedStrokes;
    updateAnimatedStrokesList();
}

// Function to scale points relative to a pivot
export function scaleStrokes(strokes, scaleX, scaleY, pivot) {
    const updatedStrokes = [];

    for (const stroke of strokes) {
        // Invalidate old position
        invalidateChunksForStroke(stroke, true);

        const newStroke = {
            ...stroke,
            points: stroke.points.map(p => ({
                ...p,
                x: pivot.x + (p.x - pivot.x) * scaleX,
                y: pivot.y + (p.y - pivot.y) * scaleY,
                size: p.size * ((Math.abs(scaleX) + Math.abs(scaleY)) / 2)
            }))
        };

        invalidateStrokeCaches(newStroke);
        
        const idx = state.strokes.indexOf(stroke);
        if (idx !== -1) state.strokes[idx] = newStroke;
        
        updatedStrokes.push(newStroke);
        
        // Invalidate new position
        invalidateChunksForStroke(newStroke);
    }
    
    state.selectedStrokes = updatedStrokes;
    updateAnimatedStrokesList();
}

// --- Background Pattern Optimization: Pattern Caching ---
const patternCanvas = new OffscreenCanvas(1, 1);
const patternCtx = patternCanvas.getContext('2d');
let cachedPattern = null;
let lastPatternKey = '';

function getPattern(type, spacing, color, lineWidth) {
    const key = `${type}-${spacing}-${color}-${lineWidth}`;
    if (cachedPattern && lastPatternKey === key) return cachedPattern;

    const actualSpacing = spacing;
    const actualLineWidth = Math.max(0.5, lineWidth);
    
    // We create a square canvas that represents one tile of the repetition at 1:1 scale
    patternCanvas.width = actualSpacing;
    patternCanvas.height = actualSpacing;
    patternCtx.clearRect(0, 0, actualSpacing, actualSpacing);
    patternCtx.strokeStyle = color;
    patternCtx.fillStyle = color;
    patternCtx.lineWidth = actualLineWidth;

    if (type === 'dots') {
        patternCtx.beginPath();
        // Slightly larger dots for better visibility (lineWidth is radius)
        const dotRadius = Math.max(1, actualLineWidth);
        patternCtx.arc(actualSpacing / 2, actualSpacing / 2, dotRadius, 0, Math.PI * 2);
        patternCtx.fill();
    } else if (type === 'grid') {
        patternCtx.beginPath();
        patternCtx.moveTo(0, 0);
        patternCtx.lineTo(actualSpacing, 0);
        patternCtx.moveTo(0, 0);
        patternCtx.lineTo(0, actualSpacing);
        patternCtx.stroke();
    } else if (type === 'horizontal') {
        patternCtx.beginPath();
        patternCtx.moveTo(0, 0);
        patternCtx.lineTo(actualSpacing, 0);
        patternCtx.stroke();
    } else if (type === 'vertical') {
        patternCtx.beginPath();
        patternCtx.moveTo(0, 0);
        patternCtx.lineTo(0, actualSpacing);
        patternCtx.stroke();
    }

    cachedPattern = patternCtx.createPattern(patternCanvas, 'repeat');
    lastPatternKey = key;
    return cachedPattern;
}

// Function to draw background patterns using high-performance tiling
export function drawBackgroundPattern(context, type, spacing, viewportWorldX, viewportWorldY, viewportWorldWidth, viewportWorldHeight, targetScale) {
    if (type === 'none') return;

    const color = state.canvasSettings.backgroundLineColor || '#D1D1D1';
    const lineWidth = state.canvasSettings.backgroundLineWidth || 1;
    const pattern = getPattern(type, spacing, color, lineWidth);

    if (pattern) {
        context.save();
        // The pattern tiling must align with world coordinates.
        // We use setTransform to ensure the pattern offset matches our pan/zoom.
        const matrix = new DOMMatrix();
        // Scale and translate the pattern to match world coordinates
        // We apply translation first to position the (0,0) world point, then scale.
        matrix.translateSelf(state.panOffset.x, state.panOffset.y).scaleSelf(targetScale, targetScale);
        pattern.setTransform(matrix);

        context.fillStyle = pattern;
        // We fill in screen coordinates
        context.setTransform(1, 0, 0, 1, 0, 0); 
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();
    }
}

// Optimized pattern drawing for export or specific contexts
export function drawPatternToContext(targetCtx, width, height, resolution, worldX, worldY) {
    const type = state.canvasSettings.backgroundType;
    if (type === 'none') return;
    
    const spacing = state.canvasSettings.backgroundSpacing || 50;
    const color = state.canvasSettings.backgroundLineColor || '#D1D1D1';
    const lineWidth = state.canvasSettings.backgroundLineWidth || 1;
    
    const pattern = getPattern(type, spacing, color, lineWidth);
    if (pattern) {
        targetCtx.save();
        // Since this is for a local context (like an export or chunk), 
        // we offset the pattern so it starts correctly relative to worldX/worldY
        const matrix = new DOMMatrix();
        // Pattern (0,0) in world is at local ( -worldX * resolution, -worldY * resolution )
        matrix.translateSelf(-worldX * resolution, -worldY * resolution).scaleSelf(resolution, resolution);
        pattern.setTransform(matrix);

        targetCtx.fillStyle = pattern;
        // Reset transform to ensure we fill the specified pixel dimensions accurately
        targetCtx.setTransform(1, 0, 0, 1, 0, 0);
        targetCtx.fillRect(0, 0, width, height);
        targetCtx.restore();
    }
}

export async function renderStrokeToBitmap(stroke) {
    // Calculate bounding box of the stroke in world coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    stroke.points.forEach(p => {
        // Include brush size in bounds for safety
        const halfSize = (p.size * stroke.minSizeFactor + (p.size - p.size * stroke.minSizeFactor) * (p.pressure || 1.0)) / 2;
        minX = Math.min(minX, p.x - halfSize);
        minY = Math.min(minY, p.y - halfSize);
        maxX = Math.max(maxX, p.x + halfSize);
        maxY = Math.max(maxY, p.y + halfSize);
    });

    const padding = Math.max(10, stroke.points[0].size * 2); // Add some padding for safety in world units
    const worldWidth = maxX - minX + padding * 2;
    const worldHeight = maxY - minY + padding * 2;

    // Scale world units to pixel units for offscreen canvas
    const bitmapResolution = 2; // Reduced from 20 to 2 for much better performance/memory
    const MAX_BITMAP_DIM = 4096; // Cap to 4K to prevent browser crashes/huge lags

    let pixelWidth = Math.max(1, Math.ceil(worldWidth * bitmapResolution));
    let pixelHeight = Math.max(1, Math.ceil(worldHeight * bitmapResolution));

    if (pixelWidth > MAX_BITMAP_DIM || pixelHeight > MAX_BITMAP_DIM) {
        const scale = MAX_BITMAP_DIM / Math.max(pixelWidth, pixelHeight);
        pixelWidth = Math.round(pixelWidth * scale);
        pixelHeight = Math.round(pixelHeight * scale);
    }

    if (pixelWidth <= 0 || pixelHeight <= 0 || !isFinite(pixelWidth) || !isFinite(pixelHeight)) {
        return null; // Invalid dimensions, cannot create bitmap
    }

    const offscreenCanvas = new OffscreenCanvas(pixelWidth, pixelHeight);
    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    const finalResX = pixelWidth / worldWidth;
    const finalResY = pixelHeight / worldHeight;

    offscreenCtx.lineCap = stroke.tipShape;
    offscreenCtx.lineJoin = stroke.tipShape;
    offscreenCtx.strokeStyle = stroke.color; 
    offscreenCtx.fillStyle = stroke.color;

    // Scale for rendering onto the bitmap canvas
    offscreenCtx.scale(finalResX, finalResY);
    // Translate offscreen context to draw stroke at 0,0 relative to its bounding box (including padding)
    offscreenCtx.translate(-minX + padding, -minY + padding);

    drawVariableWidthStrokePolygon(offscreenCtx, stroke.points, stroke.color, stroke.minSizeFactor, stroke.tipShape);
    
    // Create ImageBitmap
    const bitmap = await createImageBitmap(offscreenCanvas);
    
    // Store original bounds and padding for drawing
    stroke.bitmapX = minX - padding;
    stroke.bitmapY = minY - padding;
    stroke.bitmapWidth = worldWidth;
    stroke.bitmapHeight = worldHeight;
    stroke.bitmap = bitmap;
}

export function draw() {
    // Clear the viewport
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas background color
    ctx.fillStyle = state.canvasSettings.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context state and apply transformations
    ctx.save();
    
    // 1. Flip View if needed (visual only)
    if (state.isCanvasFlipped) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    
    // 2. Pan and Zoom
    ctx.translate(state.panOffset.x, state.panOffset.y);
    ctx.scale(state.zoom, state.zoom);

    // Draw canvas background patterns (dots, grid, lines)
    const viewport = getWorldViewport();
    drawBackgroundPattern(ctx, state.canvasSettings.backgroundType, state.canvasSettings.backgroundSpacing, 
                          viewport.minX, viewport.minY, 
                          viewport.maxX - viewport.minX, viewport.maxY - viewport.minY, state.zoom);
    
    // 3. Draw Image Layers (Drawn after background but before strokes)
    state.images.forEach(img => {
        if (!img.visible) return;
        
        ctx.save();
        
        ctx.translate(img.x, img.y);
        ctx.rotate(img.rotation || 0);
        
        // 3.1 Draw the Image actual (Transformed by Scale and Opacity)
        ctx.save();
        ctx.scale(img.scaleX || 1, img.scaleY || 1);
        ctx.globalAlpha = img.opacity !== undefined ? img.opacity : 1;
        
        if (img.element && img.element.complete) {
            ctx.drawImage(img.element, -img.width / 2, -img.height / 2, img.width, img.height);
        } else if (img.url && !img.element) {
            // Lazy load element if not exists
            const imageEl = new Image();
            imageEl.src = img.url;
            img.element = imageEl;
            imageEl.onload = () => {
                requestAnimationFrame(draw);
            };
        }
        ctx.restore(); // Back to Pos+Rot only (Opacity & Scale restored)
        
        // 3.2 Draw selection highlight and handles (Drawn at full opacity and constant screen size)
        if (state.selectedImageId === img.id) {
            const sw = img.width * (img.scaleX || 1);
            const sh = img.height * (img.scaleY || 1);

            ctx.strokeStyle = '#007AFF';
            ctx.lineWidth = 2 / state.zoom;
            ctx.setLineDash([5 / state.zoom, 5 / state.zoom]);
            ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
            ctx.setLineDash([]);
            
            // Handles (Always 10px on screen)
            const handleSize = 10 / state.zoom;
            const hs = handleSize / 2;
            
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#007AFF';
            ctx.lineWidth = 1.5 / state.zoom;

            // Corners
            ctx.fillRect(-sw / 2 - hs, -sh / 2 - hs, handleSize, handleSize); // NW
            ctx.strokeRect(-sw / 2 - hs, -sh / 2 - hs, handleSize, handleSize);
            
            ctx.fillRect(sw / 2 - hs, sh / 2 - hs, handleSize, handleSize); // SE
            ctx.strokeRect(sw / 2 - hs, sh / 2 - hs, handleSize, handleSize);
            
            // Rotation handle (Top)
            const rotY = -sh / 2 - 25 / state.zoom;
            ctx.beginPath();
            ctx.moveTo(0, -sh / 2);
            ctx.lineTo(0, rotY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, rotY, hs, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Opacity handle (Bottom)
            const opacY = sh / 2 + 25 / state.zoom;
            ctx.beginPath();
            ctx.moveTo(0, sh / 2);
            ctx.lineTo(0, opacY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, opacY, hs, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        
        ctx.restore();
    });

    // Draw symmetry line if mirror mode is on
    if (state.mirrorMode) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1 / state.zoom;
        ctx.beginPath();
        ctx.moveTo(0, viewport.minY);
        ctx.lineTo(0, viewport.maxY);
        ctx.stroke();
    }

    if (state.renderMode === 'bitmap') {
        // --- Draw Cached Chunks ---
        const visibleChunks = getVisibleChunks(viewport);
        visibleChunks.forEach(chunk => {
            // If zoom changed significantly, or first load, invalidate
            const currentResolution = Math.min(2.0, Math.max(0.5, state.zoom));
            if (Math.abs(chunk.cachedResolution - currentResolution) > 0.4) {
                chunk.needsUpdate = true;
            }

            if (chunk.needsUpdate) {
                renderChunk(chunk, state.zoom);
            }
            
            if (chunk.canvas) {
                ctx.drawImage(chunk.canvas, chunk.worldX, chunk.worldY, CHUNK_SIZE, CHUNK_SIZE);
            }
        });

        // --- Draw Animated Strokes (Live Overlay via cached Set) ---
        state.animatedStrokes.forEach(stroke => {
            if (!state.selectedStrokes.includes(stroke)) {
                if (!stroke.bounds) stroke.bounds = calculateStrokeBounds(stroke);

                // Quick Viewport Culling
                if (stroke.bounds.maxX < viewport.minX || 
                    stroke.bounds.minX > viewport.maxX || 
                    stroke.bounds.maxY < viewport.minY || 
                    stroke.bounds.minY > viewport.maxY) {
                    return;
                }
                drawStroke(ctx, stroke, false, state.zoom);
            }
        });
    } else {
        // --- Draw Full Vector ---
        state.strokes.forEach(stroke => {
            // Only draw non-selected strokes (selected are drawn later)
            if (state.selectedStrokes.includes(stroke)) return;

            // Bounding box culling for vector mode
            if (!stroke.bounds) {
                const calculateStrokeBounds = (s) => {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    s.points.forEach(p => {
                        minX = Math.min(minX, p.x);
                        minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x);
                        maxY = Math.max(maxY, p.y);
                    });
                    const padding = s.size || 5;
                    return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
                };
                stroke.bounds = calculateStrokeBounds(stroke);
            }

            if (stroke.bounds.maxX < viewport.minX || 
                stroke.bounds.minX > viewport.maxX || 
                stroke.bounds.maxY < viewport.minY || 
                stroke.bounds.minY > viewport.maxY) {
                return;
            }

            drawStroke(ctx, stroke, false, state.zoom);
        });
    }

    // Draw selected strokes (they stay "live" and un-cached for smooth transformation)
    state.selectedStrokes.forEach(stroke => {
        drawStroke(ctx, stroke, false, state.zoom);
    });

    // Draw current stroke preview
    if (state.isDrawing && state.currentStroke) {
        drawStroke(ctx, state.currentStroke, true, state.zoom);
    }
    if (state.isDrawing && state.mirrorMode && state.currentMirrorStroke) {
        drawStroke(ctx, state.currentMirrorStroke, true, state.zoom);
    }

    // Draw selection handles/box on TOP
    if (state.selection && (state.selection.width > 0 || state.selection.height > 0)) {
        drawSelectionBox(ctx, state.selection, state.zoom, true);
    } else if (state.selectedStrokes.length > 0) {
        const bounds = state.selection || getSelectionBounds(state.selectedStrokes);
        if (bounds) {
            drawSelectionBox(ctx, bounds, state.zoom, true);
        }
    }

    // Restore context state
    ctx.restore();
}

function drawSelectionBox(context, rect, zoom, showHandles = false) {
    context.save();
    context.strokeStyle = 'rgba(0, 120, 212, 0.8)';
    context.lineWidth = 1 / zoom;
    context.setLineDash([5 / zoom, 3 / zoom]);
    context.strokeRect(rect.x, rect.y, rect.width, rect.height);
    context.setLineDash([]);

    if (showHandles) {
        const handleSize = 8 / zoom;
        const hs = handleSize / 2;
        context.fillStyle = 'white';
        context.strokeStyle = 'rgba(0, 120, 212, 1)';
        context.lineWidth = 1.5 / zoom;

        // Corners
        const corners = [
            { x: rect.x, y: rect.y }, // nw
            { x: rect.x + rect.width, y: rect.y }, // ne
            { x: rect.x, y: rect.y + rect.height }, // sw
            { x: rect.x + rect.width, y: rect.y + rect.height } // se
        ];
        // Midpoints
        const mids = [
            { x: rect.x + rect.width / 2, y: rect.y }, // n
            { x: rect.x, y: rect.y + rect.height / 2 }, // w
            { x: rect.x + rect.width, y: rect.y + rect.height / 2 }, // e
            { x: rect.x + rect.width / 2, y: rect.y + rect.height }, // s
        ];

        [...corners, ...mids].forEach(p => {
            context.beginPath();
            context.rect(p.x - hs, p.y - hs, handleSize, handleSize);
            context.fill();
            context.stroke();
        });

        // Rotation handle
        const rotY = rect.y - 30 / zoom;
        context.beginPath();
        context.moveTo(rect.x + rect.width / 2, rect.y);
        context.lineTo(rect.x + rect.width / 2, rotY);
        context.stroke();
        
        context.beginPath();
        context.arc(rect.x + rect.width / 2, rotY, hs, 0, Math.PI * 2);
        context.fill();
        context.stroke();
    }
    context.restore();
}

// Helper function to draw a single stroke (including preview)
function drawStroke(context, stroke, isPreview = false, targetScale = 1) {
    // Choose drawing function based on brush type
    switch (stroke.type) {
        case 'wireframe':
            drawWireframeStroke(context, stroke, targetScale, isPreview);
            break;
        case 'pixel':
            drawPixelStroke(context, stroke);
            break;
        case 'sketchy':
            drawSketchyStroke(context, stroke);
            break;
        case 'sketchy-animated':
            // Pass the isPreview flag directly to drawAnimatedSketchyStroke
            // This function now handles both its stable preview and its timed animation.
            drawAnimatedSketchyStroke(context, stroke, isPreview);
            break;
        case 'pen':
        default:
            drawPenStroke(context, stroke, isPreview, targetScale);
            break;
    }
}

export function startDrawingLoop() {
    function loop() {
        draw();
        requestAnimationFrame(loop);
    }
    loop();
}

// Function to apply simple smoothing (moving average)
function applySmoothing(points, factor) {
    if (factor === 0 || points.length < 3) return [...points]; // No smoothing or not enough points

    const smoothedPoints = [points[0]]; // Start with the first point
    // Adjust window size based on factor - smaller factor means smaller window
    const windowSize = Math.max(1, Math.floor(points.length * factor / 2)); 

    for (let i = 1; i < points.length; i++) {
        const start = Math.max(0, i - windowSize);
        const end = Math.min(points.length - 1, i + windowSize);
        let sumX = 0, sumY = 0, sumPressure = 0, sumSize = 0;
        let count = 0;

        for (let j = start; j <= end; j++) {
            sumX += points[j].x;
            sumY += points[j].y;
            sumPressure += points[j].pressure || 1.0;
            sumSize += points[j].size;
            count++;
        }
        smoothedPoints.push({
            x: sumX / count,
            y: sumY / count,
            pressure: sumPressure / count,
            size: sumSize / count,
        });
    }
    return smoothedPoints;
}

export function startStroke(x, y, pressure) {
    // Only assign to currentStroke; do NOT push to state.strokes yet.
    state.currentStroke = {
        type: state.brush.type,
        points: [{ x, y, pressure, size: state.brush.size }],
        color: state.brush.color,
        opacity: state.brush.opacity,
        tipShape: state.brush.tipShape, // Capture current brush tip shape
        minSizeFactor: state.brush.minSizeFactor, // Capture current min size factor
        nonCompoundingOpacity: state.brush.nonCompoundingOpacity, // Capture non-compounding setting
        pixelSize: state.brush.pixelSize, // Capture pixel size
        bitmap: null, // Initialise bitmap as null

        // Capture smoothing settings
        enableSmoothing: state.brush.enableSmoothing,
        smoothingFactor: state.brush.smoothingFactor,

        // Wireframe specific
        wireframeMeshOpacity: state.brush.wireframeMeshOpacity,
        wireframeLineOpacity: state.brush.wireframeLineOpacity,
        wireframeHullLineThickness: state.brush.wireframeHullLineThickness,
        wireframeMeshLineThickness: state.brush.wireframeMeshLineThickness,
        wireframePointRadius: state.brush.wireframePointRadius,
        wireframePointOpacity: state.brush.wireframePointOpacity,
        wireframePointColor: state.brush.wireframePointColor,
        wireframeAnimationSpeed: state.brush.wireframeAnimationSpeed,
        wireframeAnimationAmount: state.brush.wireframeAnimationAmount,
        wireframeIsClosed: state.brush.wireframeIsClosed, // New: Capture wireframeIsClosed
        wireframeMaxMeshLength: state.brush.wireframeMaxMeshLength, // New: Capture max mesh length
        wireframeGradientMesh: state.brush.wireframeGradientMesh, // New: Capture wireframeGradientMesh
        wireframeGradientMeshBoostFactor: state.brush.wireframeGradientMeshBoostFactor, // New: Capture gradient mesh boost factor
        // Sketchy specific
        jitterAmount: state.brush.jitterAmount,
        jitterDensity: state.brush.jitterDensity,
        animationInterval: state.brush.animationInterval,
    };

    // For animated strokes, initialize animation properties (if any, typically `lastAnimationTime`)
    // For 'sketchy-animated', `needsJitterUpdate` is NOT set here; the preview will use stable passes.
    // The final animation will kick in after `endStroke`.
    // New: For animated wireframe strokes, initialize animation properties.
    // However, during drawing, we want it to be static, so needsJitterUpdate is only true for the *final* state.
    // The animation timer will still start, but animatedPoints won't be used until isPreview is false.
    if (state.currentStroke.type === 'wireframe' && (state.currentStroke.wireframeAnimationSpeed || 0) > 0) {
        state.currentStroke.lastAnimationTime = performance.now();
        // needsJitterUpdate is intentionally NOT set here for wireframe.
    }

    if (state.mirrorMode) {
        state.currentMirrorStroke = {
            type: state.brush.type,
            points: [{ x: -x, y, pressure, size: state.brush.size }],
            color: state.brush.color,
            opacity: state.brush.opacity,
            tipShape: state.brush.tipShape, // Capture current brush tip shape
            minSizeFactor: state.brush.minSizeFactor, // Capture current min size factor
            nonCompoundingOpacity: state.brush.nonCompoundingOpacity, // Capture non-compounding setting
            pixelSize: state.brush.pixelSize,
            bitmap: null, // Initialise bitmap as null

            // Capture smoothing settings
            enableSmoothing: state.brush.enableSmoothing,
            smoothingFactor: state.brush.smoothingFactor,
            
            // Wireframe specific
            wireframeMeshOpacity: state.brush.wireframeMeshOpacity,
            wireframeLineOpacity: state.brush.wireframeLineOpacity,
            wireframeHullLineThickness: state.brush.wireframeHullLineThickness,
            wireframeMeshLineThickness: state.brush.wireframeMeshLineThickness,
            wireframePointRadius: state.brush.wireframePointRadius,
            wireframePointOpacity: state.brush.wireframePointOpacity,
            wireframePointColor: state.brush.wireframePointColor,
            wireframeAnimationSpeed: state.brush.wireframeAnimationSpeed,
            wireframeAnimationAmount: state.brush.wireframeAnimationAmount,
            wireframeIsClosed: state.brush.wireframeIsClosed, // New: Capture wireframeIsClosed
            wireframeMaxMeshLength: state.brush.wireframeMaxMeshLength, // New: Capture max mesh length
            wireframeGradientMesh: state.brush.wireframeGradientMesh, // New: Capture wireframeGradientMesh
            wireframeGradientMeshBoostFactor: state.brush.wireframeGradientMeshBoostFactor, // New: Capture gradient mesh boost factor
            // Sketchy specific
            jitterAmount: state.brush.jitterAmount,
            jitterDensity: state.brush.jitterDensity,
            animationInterval: state.brush.animationInterval,
        };
        // For animated strokes, initialize animation properties (if any, typically `lastAnimationTime`)
        // For 'sketchy-animated', `needsJitterUpdate` is NOT set here; the preview will use stable passes.
        // The final animation will kick in after `endStroke`.
        // New: For animated wireframe strokes, initialize animation properties
        if (state.currentMirrorStroke.type === 'wireframe' && (state.currentMirrorStroke.wireframeAnimationSpeed || 0) > 0) {
            state.currentMirrorStroke.lastAnimationTime = performance.now();
            // needsJitterUpdate is intentionally NOT set here for wireframe.
        }
    }
}

export function addPointToStroke(x, y, pressure) {
    if (state.currentStroke) {
        // Add current brush size to the point
        state.currentStroke.points.push({ x, y, pressure, size: state.brush.size });
    }
    if (state.mirrorMode && state.currentMirrorStroke) {
        // Add current brush size to the point for mirror stroke
        state.currentMirrorStroke.points.push({ x: -x, y, pressure, size: state.brush.size });
    }
}

export async function endStroke() {
    const wasDrawing = state.currentStroke && state.currentStroke.points.length > 1; // if just a click, don't consider it a full stroke
    
    if (wasDrawing) {
        // Capture a local reference to the strokes we're about to process
        const strokeToFinalize = state.currentStroke;
        const mirrorToFinalize = state.currentMirrorStroke;

        // Immediately clear current stroke state so the UI/Renderer knows we are done drawing
        state.currentStroke = null;
        state.currentMirrorStroke = null;
        state.isDrawing = false;

        // NEW: Calculate basic bounds immediately so they can be used for culling 
        // until the high-precision background task finishes.
        strokeToFinalize.bounds = calculateStrokeBounds(strokeToFinalize);
        if (mirrorToFinalize) mirrorToFinalize.bounds = calculateStrokeBounds(mirrorToFinalize);

        // Push to main array immediately so it doesn't flicker out of existence
        state.strokes.push(strokeToFinalize);
        if (mirrorToFinalize) state.strokes.push(mirrorToFinalize);

        // Synchronously register for immediate drawing
        invalidateChunksForStroke(strokeToFinalize);
        if (mirrorToFinalize) invalidateChunksForStroke(mirrorToFinalize);
        registerAnimatedStroke(strokeToFinalize);
        if (mirrorToFinalize) registerAnimatedStroke(mirrorToFinalize);

        // Perform "heavy" calculation in next tick to avoid blocking the main thread 
        // between mouseup and next mousedown.
        setTimeout(async () => {
             // 1. Data Sanitization (updates objects already in array/chunks/sets)
            strokeToFinalize.points = strokeToFinalize.points.map(p => ({
                x: Math.round(p.x * 10) / 10,
                y: Math.round(p.y * 10) / 10,
                pressure: Math.round((p.pressure || 1.0) * 100) / 100,
                size: Math.round(p.size * 10) / 10
            }));
            if (mirrorToFinalize) {
                mirrorToFinalize.points = mirrorToFinalize.points.map(p => ({
                    x: Math.round(p.x * 10) / 10,
                    y: Math.round(p.y * 10) / 10,
                    pressure: Math.round((p.pressure || 1.0) * 100) / 100,
                    size: Math.round(p.size * 10) / 10
                }));
            }

            // 2. Smoothing
            if (strokeToFinalize.enableSmoothing && strokeToFinalize.smoothingFactor > 0) {
                strokeToFinalize.points = applySmoothing(strokeToFinalize.points, strokeToFinalize.smoothingFactor);
                if (mirrorToFinalize) {
                    mirrorToFinalize.points = applySmoothing(mirrorToFinalize.points, mirrorToFinalize.smoothingFactor);
                }
            }

            // 3. Bounds & Spatial Data
            strokeToFinalize.bounds = calculateStrokeBounds(strokeToFinalize);
            if (mirrorToFinalize) {
                mirrorToFinalize.bounds = calculateStrokeBounds(mirrorToFinalize);
            }

            // 4. Path & Bitmap Caching
            if (strokeToFinalize.type === 'pen' && strokeToFinalize.points.length >= 2) {
                strokeToFinalize.pathObject = getVariableWidthPath(strokeToFinalize.points, strokeToFinalize.minSizeFactor, strokeToFinalize.tipShape);
                if (strokeToFinalize.nonCompoundingOpacity) {
                    renderStrokeToBitmap(strokeToFinalize);
                }

                if (mirrorToFinalize) {
                    mirrorToFinalize.pathObject = getVariableWidthPath(mirrorToFinalize.points, mirrorToFinalize.minSizeFactor, mirrorToFinalize.tipShape);
                    if (mirrorToFinalize.nonCompoundingOpacity) {
                        renderStrokeToBitmap(mirrorToFinalize);
                    }
                }
            }

            // 5. Animation Finalization
            if (strokeToFinalize.type === 'wireframe' && (strokeToFinalize.wireframeAnimationSpeed || 0) > 0) {
                strokeToFinalize.needsJitterUpdate = true;
            }
            if (strokeToFinalize.type === 'sketchy-animated' && (strokeToFinalize.animationInterval || 0) > 0) {
                strokeToFinalize.lastAnimationTime = performance.now();
                strokeToFinalize.needsJitterUpdate = true;
                delete strokeToFinalize.previewJitterPasses;
            }
            
            if (mirrorToFinalize) {
                if (mirrorToFinalize.type === 'wireframe' && (mirrorToFinalize.wireframeAnimationSpeed || 0) > 0) {
                    mirrorToFinalize.needsJitterUpdate = true;
                }
                if (mirrorToFinalize.type === 'sketchy-animated' && (mirrorToFinalize.animationInterval || 0) > 0) {
                    mirrorToFinalize.lastAnimationTime = performance.now();
                    mirrorToFinalize.needsJitterUpdate = true;
                    delete mirrorToFinalize.previewJitterPasses;
                }
            }

            // 6. Final Integration (Re-invalidate if points changed significantly)
            // If smoothing happened, bounds might have changed slightly
            strokeToFinalize.bounds = calculateStrokeBounds(strokeToFinalize);
            invalidateChunksForStroke(strokeToFinalize);
            
            if (mirrorToFinalize) {
                mirrorToFinalize.bounds = calculateStrokeBounds(mirrorToFinalize);
                invalidateChunksForStroke(mirrorToFinalize);
            }

            // 7. Persist History
            saveHistory();
        }, 0);
    } else {
        // Just a click, clean up
        state.currentStroke = null;
        state.currentMirrorStroke = null;
        state.isDrawing = false;
    }
}

// Function to invalidate all caches for a stroke (call after transformations)
function invalidateStrokeCaches(stroke) {
    // Before wiping bounds, notify current chunks to remove this stroke
    invalidateChunksForStroke(stroke);

    stroke.bounds = null;
    stroke.bitmap = null;
    stroke.pathObject = null;
    
    // Sketchy brush resets
    stroke.needsJitterUpdate = true;
    delete stroke.previewJitterPasses;
    
    // Wireframe brush resets
    stroke.needsDelaunayUpdate = true;
    stroke.cachedDelaunay = null;
    stroke.cachedDelaunayPoints = null;
    delete stroke.animatedPoints;
}

// Helper for hit-testing: checks if a point is "near" a stroke
export function isPointOnStroke(px, py, stroke, tolerance = 5) { // tolerance in world units
    if (stroke.points.length === 0) return false;

    // Fast check: bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (stroke.bounds) {
        minX = stroke.bounds.minX;
        minY = stroke.bounds.minY;
        maxX = stroke.bounds.maxX;
        maxY = stroke.bounds.maxY;
    } else {
        // Calculate bounds on the fly if not cached
        stroke.points.forEach(p => {
            const size = Math.max(0.5, p.size * stroke.minSizeFactor + (p.size - p.size * stroke.minSizeFactor) * (p.pressure || 1.0)) / 2;
            minX = Math.min(minX, p.x - size);
            minY = Math.min(minY, p.y - size);
            maxX = Math.max(maxX, p.x + size);
            maxY = Math.max(maxY, p.y + size);
        });
        stroke.bounds = { minX, minY, maxX, maxY };
    }

    if (px + tolerance < minX || px - tolerance > maxX || py + tolerance < minY || py - tolerance > maxY) {
        return false;
    }

    // Additionally, check if point is near any individual point in the stroke
    for (const p of stroke.points) {
        const effectiveSize = Math.max(0.5, p.size * stroke.minSizeFactor + (p.size - p.size * stroke.minSizeFactor) * (p.pressure || 1.0));
        const hitRadius = effectiveSize / 2 + tolerance;
        const distance = Math.hypot(px - p.x, py - p.y);
        if (distance <= hitRadius) {
            return true;
        }
    }

    // Additionally, check if point is near any line segment of the stroke (more accurate for long strokes)
    for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];

        const segmentLengthSq = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (segmentLengthSq === 0) continue; // Skip identical points

        // Project point onto the line segment
        const t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / segmentLengthSq;
        const tClamped = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1]

        const closestX = p1.x + tClamped * (p2.x - p1.x);
        const closestY = p1.y + tClamped * (p2.y - p1.y);

        // Get the average size of the two points for the segment hit radius
        const avgSize = (p1.size + p2.size) / 2;
        const avgEffectiveSize = Math.max(0.5, avgSize * stroke.minSizeFactor + (avgSize - avgSize * stroke.minSizeFactor) * ((p1.pressure || 1.0) + (p2.pressure || 1.0)) / 2);
        const hitRadius = avgEffectiveSize / 2 + tolerance;
        
        const distance = Math.hypot(px - closestX, py - closestY);
        if (distance <= hitRadius) {
            return true;
        }
    }

    return false;
}

export function deleteSelectedStrokes() {
    if (state.selectedStrokes.length === 0) return;

    for (const stroke of state.selectedStrokes) {
        invalidateChunksForStroke(stroke, true);
        const idx = state.strokes.indexOf(stroke);
        if (idx !== -1) {
            state.strokes.splice(idx, 1);
        }
    }
    
    state.selectedStrokes = [];
    state.selection = null;
    saveHistory();
    updateAnimatedStrokesList();
}

export function deleteStrokeAt(worldX, worldY) {
    let deleted = false;
    // Iterate in reverse to delete "topmost" stroke if overlaps
    for (let i = state.strokes.length - 1; i >= 0; i--) {
        const stroke = state.strokes[i];
        if (isPointOnStroke(worldX, worldY, stroke, state.brush.size / 2)) {
            invalidateChunksForStroke(stroke, true);
            state.strokes.splice(i, 1);
            deleted = true;
            
            // If the deleted stroke was selected, remove it from selectedStrokes
            const selIdx = state.selectedStrokes.indexOf(stroke);
            if (selIdx !== -1) {
                state.selectedStrokes.splice(selIdx, 1);
            }

            // For eraser, we might want to delete multiple strokes under the cursor
            if(state.activeTool !== 'eraser') {
                 break; // Delete only one stroke at a time for click-delete
            }
        }
    }

    if (deleted) {
        saveHistory();
        // Remove from animatedStrokes if it was there
        // Actually, for simplicity and since delete happens infrequently, 
        // we can just re-sync or manually remove.
        // re-syncing is safer but let's just re-calculate since it's after a UI action.
        updateAnimatedStrokesList();
    }
}

// Function to update selected strokes and invalidate chunks
export function setSelectedStrokes(newStrokes) {
    // Invalidate old selected strokes so they re-bake into chunks
    state.selectedStrokes.forEach(s => invalidateChunksForStroke(s));
    
    state.selectedStrokes = newStrokes;
    
    // Invalidate new selected strokes so they are removed from chunks (rendered live)
    state.selectedStrokes.forEach(s => invalidateChunksForStroke(s));
}

// Function to find strokes within a selection rectangle
export function selectStrokesInRect(rect) {
    const selected = [];
    for (const stroke of state.strokes) {
        // A simple check: if any point of the stroke is inside the rectangle
        // or if the stroke's bounding box intersects the rectangle.
        // For precision, let's check if all points are inside or if the whole stroke is contained.
        // Usually, in vector apps, if any part is touched it might be selected, 
        // but 'entirely contained' is safer for box select.
        
        let allInside = true;
        for (const p of stroke.points) {
            if (p.x < rect.x || p.x > rect.x + rect.width || p.y < rect.y || p.y > rect.y + rect.height) {
                allInside = false;
                break;
            }
        }
        
        if (allInside && stroke.points.length > 0) {
            selected.push(stroke);
        }
    }
    return selected;
}

// Function to move strokes by a delta
export function moveStrokes(strokes, dx, dy) {
    const updatedStrokes = [];

    for (const stroke of strokes) {
        // Invalidate old position
        invalidateChunksForStroke(stroke, true);

        const newStroke = {
            ...stroke,
            points: stroke.points.map(p => ({
                ...p,
                x: p.x + dx,
                y: p.y + dy
            }))
        };

        invalidateStrokeCaches(newStroke);
        
        const idx = state.strokes.indexOf(stroke);
        if (idx !== -1) state.strokes[idx] = newStroke;

        updatedStrokes.push(newStroke);
        
        // Invalidate new position
        invalidateChunksForStroke(newStroke);
        
        // If it was animated, we need to update its reference in the set
        if (state.animatedStrokes.has(stroke)) {
            state.animatedStrokes.delete(stroke);
            registerAnimatedStroke(newStroke);
        }
    }
    
    state.selectedStrokes = updatedStrokes;
}

// Function to calculate selection bounding box from selected strokes
export function getSelectionBounds(strokes) {
    if (!strokes || strokes.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(stroke => {
        stroke.points.forEach(p => {
            const size = Math.max(0.5, p.size * (stroke.minSizeFactor || 0.2) + (p.size - p.size * (stroke.minSizeFactor || 0.2)) * (p.pressure || 1.0)) / 2;
            minX = Math.min(minX, p.x - size);
            minY = Math.min(minY, p.y - size);
            maxX = Math.max(maxX, p.x + size);
            maxY = Math.max(maxY, p.y + size);
        });
    });
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// Helper to save current state to history
export function saveHistory() {
    // Clear redo history
    if (state.historyIndex < state.history.length - 1) {
        state.history.splice(state.historyIndex + 1);
    }
    // Limit history size
    if (state.history.length >= state.HISTORY_MAX_SIZE) {
        state.history.shift();
        state.historyIndex--;
    }
    
    // Performance Optimization: Save a shallow reference copy of the array.
    // This is instant even for 10,000 strokes. Since stroke objects themselves
    // are now treated as IMMUTABLE (transformations create new objects), 
    // this snapshot remains valid for undo/redo.
    state.history.push([...state.strokes]);
    
    state.historyIndex++;
    scheduleSave();
}

export function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        state.strokes = [...state.history[state.historyIndex]];
        setSelectedStrokes([]);
        rebuildChunkMemberships();
        updateAnimatedStrokesList();
    } else if (state.historyIndex === 0 && state.history.length > 0) {
        state.historyIndex = -1;
        state.strokes = [];
        setSelectedStrokes([]);
        rebuildChunkMemberships();
        updateAnimatedStrokesList();
    }
    scheduleSave();
}

export function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        state.strokes = [...state.history[state.historyIndex]];
        setSelectedStrokes([]);
        rebuildChunkMemberships();
        updateAnimatedStrokesList();
    }
    scheduleSave();
}

export async function clearCanvas() {
    state.strokes = [];
    state.images = [];
    setSelectedStrokes([]);
    state.selection = null;
    state.selectedImageId = null;
    state.history = [];
    state.historyIndex = -1; // Indicate empty state, not part of history array
    state.history.push([]); // Push an empty canvas state as the first history item
    state.historyIndex = 0; // Point to the new empty state
    rebuildChunkMemberships();
    updateAnimatedStrokesList();
    
    // Deep wipe IndexedDB
    await clearAllProjectData();
    
    // Final save to sync LocalStorage UI state
    scheduleSave();
}

export function pickColor(worldX, worldY) {
    // We need to re-render the scene to an offscreen canvas without the UI elements (like mirror line)
    // and without the current view transform to accurately pick a color.
    // This is complex. A simpler way is to get pixel data from the visible canvas.
    
    const screenX = Math.round(worldX * state.zoom + state.panOffset.x);
    const screenY = Math.round(worldY * state.zoom + state.panOffset.y);

    if (screenX < 0 || screenX >= canvas.width || screenY < 0 || screenY >= canvas.height) {
        return null; // Click was outside the viewport
    }

    const pixel = ctx.getImageData(screenX, screenY, 1, 1).data;
    
    // If alpha is 0, it's a transparent pixel (background)
    if (pixel[3] === 0) {
        return state.canvasSettings.backgroundColor; // Return canvas background color
    }
    
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
