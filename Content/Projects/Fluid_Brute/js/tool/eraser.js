export class Eraser {
    constructor() {
        this.id = 'eraser';
        this.name = 'Eraser';
        this.icon = '🧹';
    }

    onActivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = 'cell';
        }
    }

    onDeactivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = '';
        }
    }

    splat(paint, simulator, brush, zThreshold, paintingRectangle, splatRadius, splatVelocityScale, eraserType) {
        // Eraser splat color: RGB is 1.0 (subtracted during blending), Alpha is the erase strength.
        // We use the brush alpha/pressure to determine erase strength.
        var alphaT = paint.brushColorHSVA[3];
        var eraserStrength = alphaT * 0.55; // Highly effective erase strength

        var finalSplatRadius = splatRadius;
        var isRect = false;
        var isRectRotate90 = false;
        if (eraserType === 'scraper') {
            finalSplatRadius = splatRadius * 3.2; // Overlap completely to act like a solid flat scraper plate
            eraserStrength = alphaT * 0.90; // Stronger scraping
            isRect = true;
            isRectRotate90 = true;
        }

        var splatColor = [1.0, 1.0, 1.0, eraserStrength];
        var finalSplatVelocityScale = splatVelocityScale * 1.5; // Slightly more velocity turbulence for satisfying paint scraping simulation physics

        // Call simulator splat with isEraser = true
        simulator.splat(brush, zThreshold, paintingRectangle, splatColor, finalSplatRadius, finalSplatVelocityScale, true, false, false, isRect, isRectRotate90);
    }
}
