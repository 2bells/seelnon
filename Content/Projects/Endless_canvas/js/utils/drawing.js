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

export function drawVariableWidthStrokePolygon(context, points, color, minSizeFactor, tipShape) {
    if (points.length < 2) return;

    // Build the outline of the stroke
    const outlinePoints = [];
    const prevPoints = [];

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const nextP = points[i + 1];

        // Calculate actual width based on point properties and brush settings
        let currentWidth = p.size;
        const pressure = p.pressure || 1.0;
        const minSize = p.size * minSizeFactor; // Use minSizeFactor from stroke properties
        currentWidth = minSize + (p.size - minSize) * pressure;

        // Ensure minimum width
        currentWidth = Math.max(0.5, currentWidth); 

        let normal = { x: 0, y: 0 };
        if (nextP) {
            const dx = nextP.x - p.x;
            const dy = nextP.y - p.y;
            const length = Math.hypot(dx, dy);
            if (length > 0) {
                normal.x = -dy / length;
                normal.y = dx / length;
            }
        } else if (i > 0) {
            // For the last point, use normal from previous segment
            const prevP = points[i - 1];
            const dx = p.x - prevP.x;
            const dy = p.y - prevP.y;
            const length = Math.hypot(dx, dy);
            if (length > 0) {
                normal.x = -dy / length;
                normal.y = dx / length;
            }
        }

        const halfWidth = currentWidth / 2;

        const p1 = { x: p.x + normal.x * halfWidth, y: p.y + normal.y * halfWidth };
        const p2 = { x: p.x - normal.x * halfWidth, y: p.y - normal.y * halfWidth };

        outlinePoints.push(p1);
        prevPoints.unshift(p2); // Add to beginning to reverse order
    }

    // Connect the start and end of the two lines to form a closed polygon
    if (outlinePoints.length > 0 && prevPoints.length > 0) {
        context.beginPath();
        context.moveTo(outlinePoints[0].x, outlinePoints[0].y);
        for (let i = 1; i < outlinePoints.length; i++) {
            context.lineTo(outlinePoints[i].x, outlinePoints[i].y);
        }
        for (let i = 0; i < prevPoints.length; i++) {
            context.lineTo(prevPoints[i].x, prevPoints[i].y);
        }
        context.closePath();
        context.fillStyle = color;
        context.fill();
    }
    
    // Draw caps for round tips (for square, the polygon itself defines the cap)
    if (tipShape === 'round') {
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        let firstWidth = firstPoint.size;
        firstWidth = Math.max(0.5, firstPoint.size * minSizeFactor + (firstPoint.size - firstPoint.size * minSizeFactor) * (firstPoint.pressure || 1.0));
        
        let lastWidth = lastPoint.size;
        lastWidth = Math.max(0.5, lastPoint.size * minSizeFactor + (lastPoint.size - lastPoint.size * minSizeFactor) * (lastPoint.pressure || 1.0));

        context.beginPath();
        context.arc(firstPoint.x, firstPoint.y, firstWidth / 2, 0, Math.PI * 2);
        context.fill();
        
        if (points.length > 1) {
            context.beginPath();
            context.arc(lastPoint.x, lastPoint.y, lastWidth / 2, 0, Math.PI * 2);
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