export class ColorPick {
    constructor() {
        this.id = 'colorpick';
        this.name = 'Color Picker';
        this.icon = '🧪';
    }

    onActivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = 'copy';
        }
    }

    onDeactivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = '';
        }
    }

    // This method reads the color at mouse coordinates (mouseX, mouseY) and updates the palette & color picker
    pickColor(paint, mouseX, mouseY) {
        var wgl = paint.wgl;
        if (!wgl) return;

        // Ensure mouse coordinates are valid
        if (mouseX < 0 || mouseX >= paint.canvas.width || mouseY < 0 || mouseY >= paint.canvas.height) {
            return;
        }

        var r = 0, g = 0, b = 0;
        var pickedFromSimulation = false;

        // Try to pick from raw paint texture to avoid 3D lighting, shadows, and texture darkening
        var localX = mouseX - paint.paintingRectangle.left;
        var localY = mouseY - paint.paintingRectangle.bottom;
        var u = localX / paint.paintingRectangle.width;
        var v = localY / paint.paintingRectangle.height;

        if (u >= 0.0 && u < 1.0 && v >= 0.0 && v < 1.0 && paint.simulator && paint.simulator.paintTexture) {
            var simX = Math.floor(u * paint.simulator.resolutionWidth);
            var simY = Math.floor(v * paint.simulator.resolutionHeight);
            
            // Bind paintTexture to read raw pigment
            wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, paint.simulator.paintTexture, 0);
            var pixels = new Uint8Array(4);
            wgl.readPixels(
                wgl.createReadState().bindFramebuffer(paint.framebuffer),
                simX,
                simY,
                1,
                1,
                wgl.RGBA,
                wgl.UNSIGNED_BYTE,
                pixels
            );
            
            // If the alpha is 0, it means we clicked on the canvas where no paint is drawn yet.
            // In that case, we should fall back to the canvasTexture (to pick the gray canvas background).
            if (pixels[3] > 0) {
                r = pixels[0];
                g = pixels[1];
                b = pixels[2];
                pickedFromSimulation = true;
                
                // If in RGB mode, the pigment color in paintTexture is stored inverted/mixed.
                // Let's invert it back to normal RGB!
                if (paint.colorModel === 1) { // ColorModel.RGB
                    // Since it did: splatColor[0] = 1.0 - g; splatColor[1] = 1.0 - r; splatColor[2] = 1.0 - b;
                    // Let's reverse: r_norm = 1.0 - b_stored, g_norm = 1.0 - r_stored, b_norm = 1.0 - g_stored
                    var r_stored = r / 255.0;
                    var g_stored = g / 255.0;
                    var b_stored = b / 255.0;
                    
                    r = Math.round((1.0 - g_stored) * 255.0);
                    g = Math.round((1.0 - r_stored) * 255.0);
                    b = Math.round((1.0 - b_stored) * 255.0);
                }
            }
        }

        if (!pickedFromSimulation) {
            // Fallback to canvasTexture (which has background)
            wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, paint.canvasTexture, 0);
            var pixels = new Uint8Array(4);
            wgl.readPixels(
                wgl.createReadState().bindFramebuffer(paint.framebuffer),
                mouseX,
                mouseY,
                1,
                1,
                wgl.RGBA,
                wgl.UNSIGNED_BYTE,
                pixels
            );
            r = pixels[0];
            g = pixels[1];
            b = pixels[2];
        }

        // Clamp values just in case
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        // Convert RGB to HEX
        var componentToHex = function (c) {
            var hex = c.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        var hex = "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);

        var hsv;
        if (paint.colorModel === 0) { // ColorModel.RYB
            if (pickedFromSimulation) {
                hsv = this.rgbToHsv(r, g, b); // r, g, b are already RYB!
            } else {
                var ryb = this.rgbToRyb(r, g, b);
                hsv = this.rgbToHsv(ryb[0] * 255, ryb[1] * 255, ryb[2] * 255);
            }
        } else {
            hsv = this.rgbToHsv(r, g, b);
        }

        // Make the picked color 4% lighter to offset any shader-induced rendering/lighting darkening
        hsv[2] = Math.min(1.0, hsv[2] + 0.04);

        var currentAlpha = paint.brushColorHSVA[3];
        var newHSVA = [hsv[0], hsv[1], hsv[2], currentAlpha];

        // Update active color
        paint.brushColorHSVA = newHSVA;

        // Update the active palette swatch
        var activeIndex = paint.paletteManager.activeIndex;
        paint.paletteManager.setBaseColor(activeIndex, hex);

        paint.needsRedraw = true;
        paint.renderPalette();
    }

    rgbToRyb(r, g, b) {
        var r_scaled = r / 255;
        var g_scaled = g / 255;
        var b_scaled = b / 255;

        // Remove white
        var w = Math.min(r_scaled, g_scaled, b_scaled);
        var R = r_scaled - w;
        var G = g_scaled - w;
        var B = b_scaled - w;

        var maxG = Math.max(R, G, B);

        // Get the yellow out of red and green
        var Y = Math.min(R, G);
        R -= Y;
        G -= Y;

        if (B > 0 && G > 0) {
            B /= 2.0;
            G /= 2.0;
        }

        // Combine green and blue into yellow
        Y += G;
        B += G;

        // Normalize to the new max
        var maxY = Math.max(R, Y, B);
        if (maxY > 0) {
            var sc = maxG / maxY;
            R *= sc;
            Y *= sc;
            B *= sc;
        }

        // Add white back
        R += w;
        Y += w;
        B += w;

        return [R, Y, B];
    }

    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var h, s, v = max;

        var d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, v];
    }
}
