// rpg/game/light_shaders.js
console.log("rpg/game/light_shaders.js loaded");

/**
 * Helper function to draw a cardinal spline through a set of points.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 * @param {Array<{x: number, y: number}>} points - The array of points for the spline.
 * @param {number} [tension=0.5] - The "tightness" of the curve. 0 is linear, 1 is very curved.
 * @param {boolean} [isClosed=true] - Whether the spline should be a closed loop.
 */
export function drawCardinalSpline(ctx, points, tension = 0.5, isClosed = true) {
    if (points.length < 2) return;

    const pts = [...points];
    
    if (isClosed) {
        // To close the loop smoothly, we need to wrap the points
        pts.unshift(points[points.length - 1]);
        pts.push(points[0]);
        pts.push(points[1]);
    } else {
        // For open splines, we need to duplicate the first and last points
        // to get tangents at the ends.
        pts.unshift(points[0]);
        pts.push(points[points.length - 1]);
    }

    ctx.moveTo(pts[1].x, pts[1].y);

    for (let i = 1; i < pts.length - 2; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2];

        // Cardinal spline formula for Bezier control points
        const t = (1 - tension) / 2;
        const cp1x = p1.x + (p2.x - p0.x) * t;
        const cp1y = p1.y + (p2.y - p0.y) * t;
        const cp2x = p2.x - (p3.x - p1.x) * t;
        const cp2y = p2.y - (p3.y - p1.y) * t;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
}


class LightSystem {
    constructor(engine, initialLightingData = {}) {
        this.engine = engine;
        this.canvas = engine.canvas;
        this.ctx = engine.ctx;
        this.time = 0; // For animations

        // Light/Shadow masks
        this.masks = initialLightingData.masks || [];
    }

    updateData(lightingData) {
        this.masks = lightingData.masks || [];
    }

    update(deltaTime) {
        this.time += deltaTime;
    }

    render(viewOriginX, viewOriginY) {
        if (!this.ctx || !this.masks || this.masks.length === 0) return;

        this.ctx.save();
        this.ctx.translate(-viewOriginX, -viewOriginY); // Apply camera translation for all masks

        // Render masks in the order they appear in the array (respecting user-defined layer order)
        for (const mask of this.masks) {
            if (mask.visible === false || !mask.vertices || mask.vertices.length < 3) continue;

            this.ctx.save();

            this.ctx.globalCompositeOperation = mask.blendMode || (mask.type === 'shadow' ? 'multiply' : 'add');
            this.ctx.globalAlpha = mask.intensity || (mask.type === 'shadow' ? 0.5 : 1.0);

            let vertices = mask.vertices;
            
            // Handle flicker
            if (mask.flicker && (mask.flickerIntensity || 0) > 0) {
                const centerX = vertices.reduce((acc, v) => acc + v.x, 0) / vertices.length;
                const centerY = vertices.reduce((acc, v) => acc + v.y, 0) / vertices.length;
                
                // Use a combination of sin waves for a more natural flicker
                const flickerSpeed1 = (mask.flickerSpeed || 5) * 0.7;
                const flickerSpeed2 = (mask.flickerSpeed || 5) * 1.3;
                
                const flicker1 = Math.sin(this.time * flickerSpeed1);
                const flicker2 = Math.cos(this.time * flickerSpeed2);
                
                // Average them and scale to flickerIntensity range
                const combinedFlicker = (flicker1 + flicker2) / 2; // range -1 to 1
                
                const scale = 1.0 + combinedFlicker * (mask.flickerIntensity || 0.1);
                
                vertices = vertices.map(v => {
                    return {
                        x: centerX + (v.x - centerX) * scale,
                        y: centerY + (v.y - centerY) * scale,
                    };
                });
            }

            // New blur implementation using canvas filter
            if (mask.blur > 0) {
                this.ctx.filter = `blur(${mask.blur}px)`;
            }

            this.ctx.beginPath();
            
            if (mask.smoothing && vertices.length >= 2) {
                drawCardinalSpline(this.ctx, vertices, mask.smoothingTension || 0.5, true);
            } else {
                this.ctx.moveTo(vertices[0].x, vertices[0].y);
                for (let i = 1; i < vertices.length; i++) {
                    this.ctx.lineTo(vertices[i].x, vertices[i].y);
                }
            }

            this.ctx.closePath();

            // We always fill the shape now. The filter handles the blur effect.
            this.ctx.fillStyle = mask.color || '#000000';
            this.ctx.fill();

            this.ctx.restore();
        }

        this.ctx.restore(); // Restore transform and global state

        // Reset composite operation and filter after all masks are drawn
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1.0;
        this.ctx.filter = 'none'; // Explicitly reset filter
        this.ctx.shadowBlur = 0; // It's good practice to reset this too.
    }
}

export default LightSystem;