import { hexToRgba, drawVariableWidthStrokePolygon } from '../utils/drawing';

export function drawPenStroke(context, stroke, isPreview = false, targetScale = 1) {
    // Handle single point strokes
    if (stroke.points.length < 2) { 
        if(stroke.points.length === 1) {
            const p = stroke.points[0];
            let singlePointSize = p.size;
            const minSize = p.size * stroke.minSizeFactor;
            singlePointSize = minSize + (p.size - minSize) * (p.pressure || 1.0);
            
            const finalColor = hexToRgba(stroke.color, stroke.opacity);
            context.fillStyle = finalColor;
            context.beginPath();
            context.arc(p.x, p.y, Math.max(0.5, singlePointSize) / 2, 0, Math.PI * 2);
            context.fill();
        }
        return;
    }

    if (stroke.nonCompoundingOpacity) {
        if (isPreview || !stroke.bitmap) {
            // For preview or when bitmap isn't ready, draw directly
            // For non-compounding opacity, the preview should also respect the overall stroke opacity directly
            const strokeColor = hexToRgba(stroke.color, stroke.opacity);
            drawVariableWidthStrokePolygon(context, stroke.points, strokeColor, stroke.minSizeFactor, stroke.tipShape);
        } else if (stroke.bitmap) {
            // Use cached bitmap
            context.globalAlpha = stroke.opacity;
            context.drawImage(stroke.bitmap, 
                              stroke.bitmapX, 
                              stroke.bitmapY,
                              stroke.bitmapWidth,
                              stroke.bitmapHeight);
            context.globalAlpha = 1;
        }
    } else {
        // Original compounding drawing method
        const strokeColor = hexToRgba(stroke.color, stroke.opacity);
        context.strokeStyle = strokeColor;
        context.fillStyle = strokeColor;
        context.lineCap = stroke.tipShape; 
        context.lineJoin = stroke.tipShape; 
        
        context.beginPath();
        context.moveTo(stroke.points[0].x, stroke.points[0].y);

        for (let i = 1; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i - 1];
            const p2 = stroke.points[i];
            const p3 = stroke.points[i + 1];

            const cp2x = p2.x + (p3.x - p2.x) / 2;
            const cp2y = p2.y + (p3.y - p2.y) / 2;

            let currentLineWidth = p2.size;
            const pressure = p2.pressure || 1.0;
            const minSize = p2.size * stroke.minSizeFactor;
            currentLineWidth = minSize + (p2.size - minSize) * pressure;
            
            context.lineWidth = Math.max(0.5, currentLineWidth) / targetScale; // Adjusted for zoom
            context.quadraticCurveTo(p2.x, p2.y, cp2x, cp2y);
            context.stroke();
            context.beginPath();
            context.moveTo(cp2x, cp2y);
        }
        
        if (stroke.points.length >= 2) {
            const lastPoint = stroke.points[stroke.points.length - 1];
            let lastWidth = lastPoint.size;
            const pressure = lastPoint.pressure || 1.0;
            const minSize = lastPoint.size * stroke.minSizeFactor;
            lastWidth = minSize + (lastPoint.size - minSize) * pressure;
            context.lineWidth = Math.max(0.5, lastWidth) / targetScale; // Adjusted for zoom
            context.lineTo(lastPoint.x, lastPoint.y);
            context.stroke();
        }
    }
}