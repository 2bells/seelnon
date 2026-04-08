import { hexToRgba } from '../utils/drawing';

export function drawPixelStroke(context, stroke) {
    const pixelSize = stroke.pixelSize;
    if (stroke.points.length === 0 || !pixelSize) return;

    context.fillStyle = hexToRgba(stroke.color, stroke.opacity);
    const drawnCells = new Set(); // To avoid drawing the same cell multiple times

    // Bresenham's line algorithm to fill cells between points
    function drawLine(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;

        while (true) {
            const key = `${x0},${y0}`;
            if (!drawnCells.has(key)) {
                context.fillRect(x0 * pixelSize, y0 * pixelSize, pixelSize, pixelSize);
                drawnCells.add(key);
            }
            if (x0 === x1 && y0 === y1) break;
            let e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }
    
    // Draw line between consecutive points
    for (let i = 0; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        const gridX = Math.floor(p.x / pixelSize);
        const gridY = Math.floor(p.y / pixelSize);

        if (i > 0) {
            const prevP = stroke.points[i-1];
            const prevGridX = Math.floor(prevP.x / pixelSize);
            const prevGridY = Math.floor(prevP.y / pixelSize);
            drawLine(prevGridX, prevGridY, gridX, gridY);
        } else {
             const key = `${gridX},${gridY}`;
             if (!drawnCells.has(key)) {
                context.fillRect(gridX * pixelSize, gridY * pixelSize, pixelSize, pixelSize);
                drawnCells.add(key);
             }
        }
    }
}