export function getVariableWidthPath(points, minSizeFactor, tipShape, offsetX = 0, offsetY = 0, sizeMultiplier = 1) {
    if (points.length < 2) return new Path2D();

    const path = new Path2D();

    // --- Forward Pass: Outline top side ---
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const nextP = points[i + 1];

        let currentWidth = p.size * sizeMultiplier;
        const pressure = p.pressure || 1.0;
        const minSize = (p.size * sizeMultiplier) * minSizeFactor;
        currentWidth = Math.max(0.1, minSize + ((p.size * sizeMultiplier) - minSize) * pressure);

        let nx = 0, ny = 0;
        if (nextP) {
            const dx = nextP.x - p.x;
            const dy = nextP.y - p.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) { nx = -dy / len; ny = dx / len; }
        } else if (i > 0) {
            const prevP = points[i - 1];
            const dx = p.x - prevP.x;
            const dy = p.y - prevP.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) { nx = -dy / len; ny = dx / len; }
        }

        const hw = currentWidth / 2;
        const x = p.x + offsetX;
        const y = p.y + offsetY;
        
        if (i === 0) {
            path.moveTo(x + nx * hw, y + ny * hw);
        } else {
            path.lineTo(x + nx * hw, y + ny * hw);
        }
    }

    // --- Backward Pass: Outline bottom side ---
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        const prevP = points[i - 1];
        const nextP = points[i + 1];

        let currentWidth = p.size * sizeMultiplier;
        const pressure = p.pressure || 1.0;
        const minSize = (p.size * sizeMultiplier) * minSizeFactor;
        currentWidth = Math.max(0.1, minSize + ((p.size * sizeMultiplier) - minSize) * pressure);

        let nx = 0, ny = 0;
        if (nextP) {
             const dx = nextP.x - p.x, dy = nextP.y - p.y;
             const len = Math.hypot(dx, dy);
             if (len > 0) { nx = -dy / len; ny = dx / len; }
        } else if (i > 0) {
             const dx = p.x - prevP.x, dy = p.y - prevP.y;
             const len = Math.hypot(dx, dy);
             if (len > 0) { nx = -dy / len; ny = dx / len; }
        }

        const hw = currentWidth / 2;
        const x = p.x + offsetX;
        const y = p.y + offsetY;
        path.lineTo(x - nx * hw, y - ny * hw);
    }

    path.closePath();
    
    // Draw caps for round tips
    if (tipShape === 'round') {
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        const firstWidth = Math.max(0.1, (firstPoint.size * sizeMultiplier) * minSizeFactor + ((firstPoint.size * sizeMultiplier) - (firstPoint.size * sizeMultiplier) * minSizeFactor) * (firstPoint.pressure || 1.0));
        const lastWidth = Math.max(0.1, (lastPoint.size * sizeMultiplier) * minSizeFactor + ((lastPoint.size * sizeMultiplier) - (lastPoint.size * sizeMultiplier) * minSizeFactor) * (lastPoint.pressure || 1.0));

        // Use arc to Path2D
        path.moveTo(firstPoint.x + offsetX + firstWidth / 2, firstPoint.y + offsetY);
        path.arc(firstPoint.x + offsetX, firstPoint.y + offsetY, firstWidth / 2, 0, Math.PI * 2);
        
        if (points.length > 1) {
            path.moveTo(lastPoint.x + offsetX + lastWidth / 2, lastPoint.y + offsetY);
            path.arc(lastPoint.x + offsetX, lastPoint.y + offsetY, lastWidth / 2, 0, Math.PI * 2);
        }
    }

    return path;
}

export function hexToRgba(hex, alpha) {
    if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        return `rgba(0,0,0,${alpha})`; // fallback
    }
    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${alpha})`;
}

export function drawVariableWidthStrokePolygon(context, points, color, minSizeFactor, tipShape, offsetX = 0, offsetY = 0, sizeMultiplier = 1) {
    if (points.length < 2) return;

    context.beginPath();
    context.fillStyle = color;

    // --- Forward Pass: Outline top side ---
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const nextP = points[i + 1];

        let currentWidth = p.size * sizeMultiplier;
        const pressure = p.pressure || 1.0;
        const minSize = (p.size * sizeMultiplier) * minSizeFactor;
        currentWidth = Math.max(0.1, minSize + ((p.size * sizeMultiplier) - minSize) * pressure);

        let nx = 0, ny = 0;
        if (nextP) {
            const dx = nextP.x - p.x;
            const dy = nextP.y - p.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) { nx = -dy / len; ny = dx / len; }
        } else if (i > 0) {
            const prevP = points[i - 1];
            const dx = p.x - prevP.x;
            const dy = p.y - prevP.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) { nx = -dy / len; ny = dx / len; }
        }

        const hw = currentWidth / 2;
        const x = p.x + offsetX;
        const y = p.y + offsetY;
        
        if (i === 0) {
            context.moveTo(x + nx * hw, y + ny * hw);
        } else {
            context.lineTo(x + nx * hw, y + ny * hw);
        }
    }

    // --- Backward Pass: Outline bottom side ---
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        const prevP = points[i - 1];
        const nextP = points[i + 1];

        let currentWidth = p.size * sizeMultiplier;
        const pressure = p.pressure || 1.0;
        const minSize = (p.size * sizeMultiplier) * minSizeFactor;
        currentWidth = Math.max(0.1, minSize + ((p.size * sizeMultiplier) - minSize) * pressure);

        let nx = 0, ny = 0;
        if (nextP) {
             const dx = nextP.x - p.x, dy = nextP.y - p.y;
             const len = Math.hypot(dx, dy);
             if (len > 0) { nx = -dy / len; ny = dx / len; }
        } else if (i > 0) {
             const dx = p.x - prevP.x, dy = p.y - prevP.y;
             const len = Math.hypot(dx, dy);
             if (len > 0) { nx = -dy / len; ny = dx / len; }
        }

        const hw = currentWidth / 2;
        const x = p.x + offsetX;
        const y = p.y + offsetY;
        context.lineTo(x - nx * hw, y - ny * hw);
    }

    context.closePath();
    context.fill();
    
    // Draw caps for round tips
    if (tipShape === 'round') {
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        const firstWidth = Math.max(0.1, (firstPoint.size * sizeMultiplier) * minSizeFactor + ((firstPoint.size * sizeMultiplier) - (firstPoint.size * sizeMultiplier) * minSizeFactor) * (firstPoint.pressure || 1.0));
        const lastWidth = Math.max(0.1, (lastPoint.size * sizeMultiplier) * minSizeFactor + ((lastPoint.size * sizeMultiplier) - (lastPoint.size * sizeMultiplier) * minSizeFactor) * (lastPoint.pressure || 1.0));

        context.beginPath();
        context.arc(firstPoint.x + offsetX, firstPoint.y + offsetY, firstWidth / 2, 0, Math.PI * 2);
        context.fill();
        
        if (points.length > 1) {
            context.beginPath();
            context.arc(lastPoint.x + offsetX, lastPoint.y + offsetY, lastWidth / 2, 0, Math.PI * 2);
            context.fill();
        }
    }
}

// Helper to convert points to an SVG path string for a variable width polygon
export const getPolygonPathData = (stroke) => {
    const points = stroke.points;
    const minSizeFactor = stroke.minSizeFactor;

    if (points.length < 2) return '';

    const outlinePoints = [];
    const prevPoints = [];
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const nextP = points[i + 1];
        let currentWidth = p.size;
        const pressure = p.pressure || 1.0;
        const minSize = p.size * minSizeFactor;
        currentWidth = Math.max(0.5, minSize + (p.size - minSize) * pressure);

        let normal = { x: 0, y: 0 };
        if (nextP) {
            const dx = nextP.x - p.x, dy = nextP.y - p.y;
            const length = Math.hypot(dx, dy);
            if (length > 0) { normal.x = -dy / length; normal.y = dx / length; }
        } else if (i > 0) {
            const prevP = points[i - 1];
            const dx = p.x - prevP.x, dy = p.y - prevP.y;
            const length = Math.hypot(dx, dy);
            if (length > 0) { normal.x = -dy / length; normal.y = dx / length; }
        }
        const halfWidth = currentWidth / 2;
        outlinePoints.push({ x: p.x + normal.x * halfWidth, y: p.y + normal.y * halfWidth });
        prevPoints.unshift({ x: p.x - normal.x * halfWidth, y: p.y - normal.y * halfWidth });
    }
    
    let pathData = `M ${outlinePoints[0].x} ${outlinePoints[0].y} `;
    for (let i = 1; i < outlinePoints.length; i++) {
        pathData += `L ${outlinePoints[i].x} ${outlinePoints[i].y} `;
    }
    for (let i = 0; i < prevPoints.length; i++) {
        pathData += `L ${prevPoints[i].x} ${prevPoints[i].y} `;
    }
    pathData += 'Z';
    
    return pathData;
};

export function calculateStrokeBounds(stroke) {
    if (!stroke.points || stroke.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // We need to account for the stroke width at each point
    for (let i = 0; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        
        // Calculate the maximum possible radius at this point
        const pressure = p.pressure || 1.0;
        const currentWidth = p.size * (stroke.minSizeFactor + (1 - stroke.minSizeFactor) * pressure);
        
        // Add additional padding for wireframe extras (hull, mesh spikes etc) or jitter
        let padding = currentWidth / 2;
        if (stroke.type.includes('wireframe')) padding *= 1.5; 
        if (stroke.type.includes('sketchy')) padding += (stroke.jitterAmount || 0) * (p.size || 5);

        minX = Math.min(minX, p.x - padding);
        minY = Math.min(minY, p.y - padding);
        maxX = Math.max(maxX, p.x + padding);
        maxY = Math.max(maxY, p.y + padding);
    }
    
    // Ensure we don't return Infinity
    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    return { minX, minY, maxX, maxY };
}
