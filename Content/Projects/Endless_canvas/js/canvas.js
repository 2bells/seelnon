import { state } from './state.js';
import { scheduleSave } from './storage.js';
import { hexToRgba, drawVariableWidthStrokePolygon } from './utils/drawing.js';

// Import brush drawing functions
import { drawPenStroke } from './brush/pen.js';
import { drawWireframeStroke } from './brush/wireframe.js';
import { drawPixelStroke } from './brush/pixel.js';
import { drawSketchyStroke, drawAnimatedSketchyStroke } from './brush/sketchy.js';

let canvas;
let ctx;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

export function init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

// Function to rotate points around a pivot
export function rotateStrokes(strokes, angle, pivot) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const stroke of strokes) {
        for (const p of stroke.points) {
            const dx = p.x - pivot.x;
            const dy = p.y - pivot.y;
            p.x = pivot.x + (dx * cos - dy * sin);
            p.y = pivot.y + (dx * sin + dy * cos);
        }
        stroke.bounds = null;
        stroke.bitmap = null;
    }
}

// Function to scale points relative to a pivot
export function scaleStrokes(strokes, scaleX, scaleY, pivot) {
    for (const stroke of strokes) {
        for (const p of stroke.points) {
            p.x = pivot.x + (p.x - pivot.x) * scaleX;
            p.y = pivot.y + (p.y - pivot.y) * scaleY;
            p.size *= (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
        }
        stroke.bounds = null;
        stroke.bitmap = null;
    }
}

// Function to draw background patterns
export function drawBackgroundPattern(context, type, spacing, viewportWorldX, viewportWorldY, viewportWorldWidth, viewportWorldHeight, targetScale) {
    if (type === 'none') return;

    context.save();
    context.strokeStyle = '#D1D1D1';
    context.lineWidth = 1 / targetScale; // Make lines consistent thickness regardless of targetScale

    context.beginPath();

    if (type === 'dots') {
        const dotRadius = (1 / targetScale); // Fine dot for minimalism
        context.fillStyle = '#D1D1D1';
        for (let x = Math.floor(viewportWorldX / spacing) * spacing; x < viewportWorldX + viewportWorldWidth + spacing; x += spacing) {
            for (let y = Math.floor(viewportWorldY / spacing) * spacing; y < viewportWorldY + viewportWorldHeight + spacing; y += spacing) {
                context.moveTo(x + dotRadius, y);
                context.arc(x, y, dotRadius, 0, Math.PI * 2);
            }
        }
    } else if (type === 'grid' || type === 'horizontal' || type === 'vertical') {
        // Horizontal lines
        if (type === 'grid' || type === 'horizontal') {
            for (let y = Math.floor(viewportWorldY / spacing) * spacing; y < viewportWorldY + viewportWorldHeight + spacing; y += spacing) {
                context.moveTo(viewportWorldX, y);
                context.lineTo(viewportWorldX + viewportWorldWidth, y);
            }
        }
        // Vertical lines
        if (type === 'grid' || type === 'vertical') {
            for (let x = Math.floor(viewportWorldX / spacing) * spacing; x < viewportWorldX + viewportWorldWidth + spacing; x += spacing) {
                context.moveTo(x, viewportWorldY);
                context.lineTo(x, viewportWorldY + viewportWorldHeight);
            }
        }
    }
    
    context.stroke();
    if (type === 'dots') {
        context.fill(); // Fill dots if type is 'dots'
    }

    context.restore();
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
    const bitmapResolution = 20; // pixels per world unit

    const pixelWidth = Math.max(1, Math.ceil(worldWidth * bitmapResolution));
    const pixelHeight = Math.max(1, Math.ceil(worldHeight * bitmapResolution));

    if (pixelWidth <= 0 || pixelHeight <= 0 || !isFinite(pixelWidth) || !isFinite(pixelHeight)) {
        return null; // Invalid dimensions, cannot create bitmap
    }

    const offscreenCanvas = new OffscreenCanvas(pixelWidth, pixelHeight);
    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    offscreenCtx.lineCap = stroke.tipShape;
    offscreenCtx.lineJoin = stroke.tipShape;
    offscreenCtx.strokeStyle = stroke.color; // Use opaque color for offscreen
    offscreenCtx.fillStyle = stroke.color;

    // Translate offscreen context to draw stroke at 0,0 relative to its bounding box
    // Scale for rendering onto the bitmap canvas
    offscreenCtx.translate(-minX * bitmapResolution + padding * bitmapResolution, -minY * bitmapResolution + padding * bitmapResolution);
    offscreenCtx.scale(bitmapResolution, bitmapResolution);

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

function draw() {
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
    drawBackgroundPattern(ctx, state.canvasSettings.backgroundType, state.canvasSettings.backgroundSpacing, 
                          -state.panOffset.x / state.zoom, -state.panOffset.y / state.zoom, 
                          canvas.width / state.zoom, canvas.height / state.zoom, state.zoom);
    
    // Draw symmetry line if mirror mode is on
    if (state.mirrorMode) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1 / state.zoom; // Keep line thin regardless of zoom
        ctx.beginPath();
        const viewportTop = -state.panOffset.y / state.zoom;
        const viewportBottom = (canvas.height - state.panOffset.y) / state.zoom;
        ctx.moveTo(0, viewportTop);
        ctx.lineTo(0, viewportBottom);
        ctx.stroke();
    }

    // Draw selection rectangle if it exists
    if (state.selection && (state.selection.width > 0 || state.selection.height > 0)) {
        drawSelectionBox(ctx, state.selection, state.zoom, true);
    } else if (state.selectedStrokes.length > 0) {
        // Use exactly state.selection if present, otherwise calculate from strokes
        const bounds = state.selection || getSelectionBounds(state.selectedStrokes);
        if (bounds) {
            drawSelectionBox(ctx, bounds, state.zoom, true);
        }
    }

    // Use `performance.now()` for smoother, more reliable timing than `Date.now()`
    const now = performance.now();

    // Draw all stored strokes (finalized strokes)
    state.strokes.forEach(stroke => {
        // --- Animation Logic for Sketchy Brush ---
        if (stroke.type === 'sketchy-animated' && stroke.animationInterval > 0 && now - (stroke.lastAnimationTime || 0) > stroke.animationInterval) {
            stroke.lastAnimationTime = now;
            // Set a flag to regenerate the jittered passes in the drawing function
            stroke.needsJitterUpdate = true;
        }
        // --- Animation Logic for Wireframe Brush ---
        if (stroke.type === 'wireframe' && (stroke.wireframeAnimationSpeed || 0) > 0 && now - (stroke.lastAnimationTime || 0) > stroke.wireframeAnimationSpeed) {
            stroke.lastAnimationTime = now;
            stroke.needsJitterUpdate = true; // Trigger recalculation of jiggled points
        }

        // --- End Animation Logic ---
        
        // Highlight logic
        const isSelected = state.selectedStrokes.includes(stroke);
        if (isSelected) {
            ctx.save();
            // Draw a thicker highlight stroke underneath
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#0078D4';
            ctx.lineWidth = (stroke.size * 1.5) / state.zoom;
            // Since drawStroke uses its own internal state, we need a way to force color for highlight
            // Or just use the shadow, but let's make the shadow more intense
            ctx.shadowBlur = 12 / state.zoom;
            ctx.shadowColor = 'rgba(0, 120, 212, 0.8)';
            drawStroke(ctx, stroke, false, state.zoom);
            ctx.restore();
            
            // Draw original stroke on top
            drawStroke(ctx, stroke, false, state.zoom);
        } else {
            drawStroke(ctx, stroke, false, state.zoom);
        }
    });

    // Draw current stroke preview (only if actively drawing, and not yet part of state.strokes)
    // The `isPreview` flag ensures it's handled correctly if `nonCompoundingOpacity` is on.
    if (state.isDrawing && state.currentStroke) {
        drawStroke(ctx, state.currentStroke, true, state.zoom);
    }
    if (state.isDrawing && state.mirrorMode && state.currentMirrorStroke) {
        drawStroke(ctx, state.currentMirrorStroke, true, state.zoom);
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

export async function addPointToStroke(x, y, pressure) {
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
        // Apply smoothing if enabled before rendering to bitmap or adding to strokes
        if (state.currentStroke.enableSmoothing && state.currentStroke.smoothingFactor > 0) {
            state.currentStroke.points = applySmoothing(state.currentStroke.points, state.currentStroke.smoothingFactor);
            if (state.currentMirrorStroke) {
                state.currentMirrorStroke.points = applySmoothing(state.currentMirrorStroke.points, state.currentMirrorStroke.smoothingFactor);
            }
        }

        // If non-compounding opacity is on, render the stroke to an ImageBitmap for performance
        if (state.currentStroke.type === 'pen' && state.currentStroke.nonCompoundingOpacity && state.currentStroke.points.length >= 2) {
            await renderStrokeToBitmap(state.currentStroke);
            if (state.currentMirrorStroke) {
                await renderStrokeToBitmap(state.currentMirrorStroke);
            }
        }
        
        // After finalization, set needsJitterUpdate for animation to kick in on first non-preview draw
        if (state.currentStroke.type === 'wireframe' && (state.currentStroke.wireframeAnimationSpeed || 0) > 0) {
            state.currentStroke.needsJitterUpdate = true;
        }
        if (state.mirrorMode && state.currentMirrorStroke && state.currentMirrorStroke.type === 'wireframe' && (state.currentMirrorStroke.wireframeAnimationSpeed || 0) > 0) {
            state.currentMirrorStroke.needsJitterUpdate = true;
        }

        // Trigger animation start for sketchy-animated after drawing is complete
        if (state.currentStroke.type === 'sketchy-animated' && (state.currentStroke.animationInterval || 0) > 0) {
            state.currentStroke.lastAnimationTime = performance.now(); // Start animation timer
            state.currentStroke.needsJitterUpdate = true; // Trigger first animation pass
            delete state.currentStroke.previewJitterPasses; // Clear preview passes
        }
        if (state.mirrorMode && state.currentMirrorStroke && state.currentMirrorStroke.type === 'sketchy-animated' && (state.currentMirrorStroke.animationInterval || 0) > 0) {
            state.currentMirrorStroke.lastAnimationTime = performance.now();
            state.currentMirrorStroke.needsJitterUpdate = true;
            delete state.currentMirrorStroke.previewJitterPasses; // Clear preview passes
        }

        // Now that the stroke is finalized (and bitmap potentially rendered), add it to the main strokes array
        state.strokes.push(state.currentStroke);
        if (state.mirrorMode && state.currentMirrorStroke) {
            state.strokes.push(state.currentMirrorStroke);
        }

        saveHistory();
    } 
    // If it was just a click (wasDrawing is false), we don't add currentStroke to state.strokes,
    // it will simply be discarded when currentStroke is nulled below.
    
    state.currentStroke = null;
    state.currentMirrorStroke = null;
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

export function deleteStrokeAt(worldX, worldY) {
    let deleted = false;
    // Iterate in reverse to delete "topmost" stroke if overlaps
    for (let i = state.strokes.length - 1; i >= 0; i--) {
        const stroke = state.strokes[i];
        if (isPointOnStroke(worldX, worldY, stroke, (state.brush.size / 2) / state.zoom)) {
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
    }
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
    for (const stroke of strokes) {
        for (const p of stroke.points) {
            p.x += dx;
            p.y += dy;
        }
        // Invalidate cached bounds and bitmaps
        stroke.bounds = null;
        stroke.bitmap = null; // Will be regenerated if needed
    }
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
    // Push current (modified) strokes array to history
    state.history.push(structuredClone(state.strokes.map(s => ({
        type: s.type, points: s.points, color: s.color, opacity: s.opacity,
        tipShape: s.tipShape, minSizeFactor: s.minSizeFactor, nonCompoundingOpacity: s.nonCompoundingOpacity,
        pixelSize: s.pixelSize,
        enableSmoothing: s.enableSmoothing,
        smoothingFactor: s.smoothingFactor,
        wireframeMeshOpacity: s.wireframeMeshOpacity,
        wireframeLineOpacity: s.wireframeLineOpacity,
        wireframeHullLineThickness: s.wireframeHullLineThickness,
        wireframeMeshLineThickness: s.wireframeMeshLineThickness,
        wireframePointRadius: s.wireframePointRadius,
        wireframePointOpacity: s.wireframePointOpacity,
        wireframePointColor: s.wireframePointColor,
        wireframeAnimationSpeed: s.wireframeAnimationSpeed,
        wireframeAnimationAmount: s.wireframeAnimationAmount,
        wireframeIsClosed: s.wireframeIsClosed,
        wireframeMaxMeshLength: s.wireframeMaxMeshLength,
        wireframeGradientMesh: s.wireframeGradientMesh,
        wireframeGradientMeshBoostFactor: s.wireframeGradientMeshBoostFactor,
        jitterAmount: s.jitterAmount,
        jitterDensity: s.jitterDensity,
        animationInterval: s.animationInterval,
    }))));
    state.historyIndex++;
    scheduleSave();
}

export function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        // When loading from history, bitmaps are nullified, they will be regenerated by the draw loop
        // Use structuredClone here as well for consistency and potentially better performance
        state.strokes = structuredClone(state.history[state.historyIndex]).map(s => ({ ...s, bitmap: null }));
    } else if (state.historyIndex === 0 && state.history.length > 0) {
        // If at the first state in history, undoing means going to empty canvas
        state.historyIndex = -1;
        state.strokes = [];
    } else if (state.historyIndex === -1 && state.history.length > 0) {
         // If already at empty canvas (before first history item), and history exists, move to first actual state.
         // This can happen if canvas was cleared and then undo is pressed.
         state.historyIndex = 0;
         state.strokes = structuredClone(state.history[state.historyIndex]).map(s => ({ ...s, bitmap: null }));
    }
    scheduleSave();
}

export function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        // When loading from history, bitmaps are nullified, they will be regenerated by the draw loop
        // Use structuredClone here as well for consistency and potentially better performance
        state.strokes = structuredClone(state.history[state.historyIndex]).map(s => ({ ...s, bitmap: null }));
    }
    scheduleSave();
}

export function clearCanvas() {
    state.strokes = [];
    state.selectedStrokes = [];
    state.selection = null;
    state.history = [];
    state.historyIndex = -1; // Indicate empty state, not part of history array
    state.history.push([]); // Push an empty canvas state as the first history item
    state.historyIndex = 0; // Point to the new empty state
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
