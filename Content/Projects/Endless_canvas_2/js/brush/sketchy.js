import { hexToRgba, drawVariableWidthStrokePolygon } from '../utils/drawing.js';

// Helper to generate the jittered passes for a sketchy stroke
function _generateSketchyJitterPasses(stroke) {
    const passes = stroke.jitterDensity || 3;
    const jitter = stroke.points[0].size * (stroke.jitterAmount || 0.4);
    const jitterPasses = [];
    for (let i = 0; i < passes; i++) {
        jitterPasses.push({
            offsetX: (Math.random() - 0.5) * jitter,
            offsetY: (Math.random() - 0.5) * jitter,
            opacityFactor: 0.3 + Math.random() * 0.4,
            sizeFactor: 0.8 + Math.random() * 0.4
        });
    }
    return jitterPasses;
}

// Helper to draw a sketchy stroke using pre-generated jitter passes
function _drawSketchyStrokeWithPasses(context, stroke, jitterPasses) {
    if (!jitterPasses || jitterPasses.length === 0) return;

    jitterPasses.forEach(pass => {
        const displacedPoints = stroke.points.map(p => ({
            ...p,
            x: p.x + pass.offsetX,
            y: p.y + pass.offsetY,
            size: p.size * pass.sizeFactor
        }));
        const strokeColor = hexToRgba(stroke.color, stroke.opacity * pass.opacityFactor);
        drawVariableWidthStrokePolygon(context, displacedPoints, strokeColor, stroke.minSizeFactor, stroke.tipShape);
    });
}

// This function will be used for 'sketchy' brush type (static)
// It regenerates random passes every frame, giving a 'live' texture.
export function drawSketchyStroke(context, stroke) {
    const jitterPasses = _generateSketchyJitterPasses(stroke);
    _drawSketchyStrokeWithPasses(context, stroke, jitterPasses);
}

// This function will be used for 'sketchy-animated' brush type.
// It provides a stable preview during drawing and then animates after drawing is complete.
export function drawAnimatedSketchyStroke(context, stroke, isPreview = false) {
    if (stroke.points.length === 0) return;

    // --- Preview behavior for sketchy-animated ---
    // If it's a preview, generate passes once and store them on the stroke for a stable, non-jittering preview.
    // This prevents the visual jitter during the drawing phase itself.
    if (isPreview) {
        if (!stroke.previewJitterPasses) {
            stroke.previewJitterPasses = _generateSketchyJitterPasses(stroke);
        }
        _drawSketchyStrokeWithPasses(context, stroke, stroke.previewJitterPasses);
        return; // Exit, as we handled the preview
    }

    // --- Final stroke animation behavior for sketchy-animated ---
    // This logic is for when the stroke is part of the finalized `state.strokes` array.
    const animationInterval = stroke.animationInterval || 1500; // Default to 1500ms if not set
    const now = performance.now();

    // Regenerate jitter passes if needed (first time after endStroke or if update is flagged, or based on animation interval)
    if (!stroke.jitterPasses || stroke.needsJitterUpdate || (animationInterval > 0 && now - (stroke.lastAnimationTime || 0) > animationInterval)) {
        stroke.jitterPasses = _generateSketchyJitterPasses(stroke);
        stroke.lastAnimationTime = now;
        stroke.needsJitterUpdate = false; // Reset the flag
    }
    _drawSketchyStrokeWithPasses(context, stroke, stroke.jitterPasses);
}
