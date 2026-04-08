class BrushEngine {
    constructor(canvasEngine, app) {
        this.canvas = canvasEngine;
        this.app = app; // Reference to the main app
        this.currentTool = 'brush'; // Default to brush when app initializes
        this.activeBrush = null; // Will hold the selected custom brush object
        
        // These are the *currently effective* drawing parameters, controlled by main UI sliders
        this.color = '#2c3e50';
        this.brushSize = 10;
        this.opacity = 1; // 0-1 scale
        
        // Brush state
        this.isDrawing = false;
        this.lastPoint = null;
        this.strokePoints = [];
        this.lastMidPoint = null; // For smoothing
        this.smoothedPoint = null; // For stabilization
        
        // Add zoom mode flag
        this.isZoomModeActive = false;
        
        // Performance optimization - brushCache is not used in this implementation
        // this.brushCache = new Map();
        // this.maxCacheSize = 50;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const canvas = this.canvas.canvas;
        
        canvas.addEventListener('mousedown', (e) => this.startStroke(e));
        canvas.addEventListener('mousemove', (e) => this.continueStroke(e));
        canvas.addEventListener('mouseup', (e) => this.endStroke(e));
        canvas.addEventListener('mouseleave', (e) => this.endStroke(e));
        
        // Touch events for mobile support
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startStroke({ clientX: touch.clientX, clientY: touch.clientY, button: 0, pointerType: 'touch' });
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.continueStroke({ clientX: touch.clientX, clientY: touch.clientY, pointerType: 'touch' });
        });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.endStroke(e);
        });
    }
    
    startStroke(e) {
        // Prevent drawing when zoom mode is active
        if (this.isZoomModeActive || this.app.isZoomModeActive) return;
        
        // Only left mouse button or touch (button 0) should initiate drawing, unless it's an eyedropper.
        if (e.button !== 0 && this.currentTool !== 'eyedropper') return; 
        
        // Prevent drawing when panning with spacebar or using alt-eyedropper
        if (this.app.isSpacePanActive || this.app.isAltEyedropperActive) {
            return;
        }

        if (this.currentTool === 'pan' || this.currentTool === 'select') {
            return; // Pan tool is handled by canvas-engine, Select tool by app.js
        }

        // If no brush is active and current tool is 'brush', we need a fallback.
        // This case should ideally be covered by default brush selection in app.js init.
        if (!this.activeBrush && this.currentTool === 'brush') {
            // For robustness, if somehow no brush is active but we're in brush mode, pick a default.
            const defaultBrush = this.app.brushes[0]; // Get the first default brush
            if (defaultBrush) {
                this.app.selectBrush(defaultBrush.id);
            } else {
                console.warn("No active brush and no default brushes available.");
                return;
            }
        }

        const rect = this.canvas.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.canvas.screenToWorld(screenX, screenY);
        
        if (this.currentTool === 'eyedropper') {
            this.isDrawing = true; // Set for eyedropper to allow continuous picking on drag
            const color = this.canvas.pickColor(worldPos.x, worldPos.y);
            if (color) {
                // The app class handles UI updates via this event.
                const event = new CustomEvent('colorpicked', { detail: { color }, bubbles: true });
                this.canvas.canvas.dispatchEvent(event);
            }
            return; // Eyedropper doesn't initiate a stroke
        }

        // --- History/Undo Change ---
        this.canvas.canvas.dispatchEvent(new CustomEvent('historystart'));
        // --- End History/Undo Change ---
        
        this.isDrawing = true;
        this.lastPoint = worldPos;
        this.strokePoints = [worldPos];
        this.lastMidPoint = worldPos;
        this.smoothedPoint = worldPos;
        
        // DO NOT draw initial dot here to prevent stamps on low pressure/accidental touches.
        // A dot for a click will be handled in endStroke if no movement occurred.
    }
    
    continueStroke(e) {
        if (!this.isDrawing || !this.lastPoint) {
             // Handle continuous eyedropper picking on mouse move
            if (this.isDrawing && this.currentTool === 'eyedropper') {
                const rect = this.canvas.canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPos = this.canvas.screenToWorld(screenX, screenY);
                const color = this.canvas.pickColor(worldPos.x, worldPos.y);
                if (color) {
                    const event = new CustomEvent('colorpicked', { detail: { color }, bubbles: true });
                    this.canvas.canvas.dispatchEvent(event);
                }
            }
            return;
        }
        
        const rect = this.canvas.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.canvas.screenToWorld(screenX, screenY);
        
        // --- Input Smoothing (Stabilization) ---
        const smoothing = (this.activeBrush?.smoothing || 0) / 100;
        const lerpFactor = Math.min(1.0, 0.4 - (smoothing * 0.35)); // Map 0-1 smoothing to ~0.4-0.05 lerp factor
        
        this.smoothedPoint = {
            x: this.smoothedPoint.x * (1 - lerpFactor) + worldPos.x * lerpFactor,
            y: this.smoothedPoint.y * (1 - lerpFactor) + worldPos.y * lerpFactor,
        };
        const currentPos = this.smoothedPoint;
        // --- End Input Smoothing ---
        
        // Calculate pressure simulation based on speed (or use actual pressure if available)
        // For simplicity, let's keep the speed-based pressure simulation for mouse.
        // For actual pen/stylus, e.pressure would be used.
        let pressure = 1.0;
        if (e.pointerType === 'pen' && e.pressure !== undefined) {
             pressure = e.pressure; // Use actual pen pressure
        } else {
            const distance = Math.sqrt(
                Math.pow(currentPos.x - this.lastPoint.x, 2) +
                Math.pow(currentPos.y - this.lastPoint.y, 2)
            );
            // Simulate pressure based on speed, max speed 20 units/frame
            const speed = Math.min(distance / 2, 20); 
            pressure = Math.max(0.3, 1 - (speed / 20)); // Adjust max speed and min pressure as needed
        }
        
        this.strokePoints.push({...currentPos, pressure});

        // --- Geometric Smoothing logic ---
        const midPoint = {
            x: (this.lastPoint.x + currentPos.x) / 2,
            y: (this.lastPoint.y + currentPos.y) / 2
        };

        // Draw a quadratic Bézier curve from the last midpoint to the new one
        this.drawQuadraticBezier(this.lastMidPoint, this.lastPoint, midPoint, pressure);
        
        this.lastPoint = currentPos;
        this.lastMidPoint = midPoint;
    }
    
    endStroke(e) {
        if (!this.isDrawing) return;

        // Reset eyedropper dragging state without drawing anything
        if (this.currentTool === 'eyedropper') {
            this.isDrawing = false;
            return;
        }
        
        // If it was just a click with no movement, draw a single dot.
        if (this.strokePoints.length <= 1) {
            const point = this.strokePoints.length ? this.strokePoints[0] : this.lastPoint;
            if (point) {
                const basePressure = 0.7; // Use a medium pressure for a single tap/click
                let finalDrawColor = this.color;
                const smudgeStrength = (this.activeBrush?.smudgeStrength || 0) / 100;

                if (smudgeStrength > 0) {
                    const pickedColorHex = this.canvas.pickColor(point.x, point.y);
                    if (pickedColorHex) {
                        const foregroundColorRgb = this.hexToRgb(this.color); 
                        const backgroundColorRgb = this.hexToRgb(pickedColorHex); 

                        const blendedR = Math.round(foregroundColorRgb.r * (1 - smudgeStrength) + backgroundColorRgb.r * smudgeStrength);
                        const blendedG = Math.round(foregroundColorRgb.g * (1 - smudgeStrength) + backgroundColorRgb.g * smudgeStrength);
                        const blendedB = Math.round(foregroundColorRgb.b * (1 - smudgeStrength) + backgroundColorRgb.b * smudgeStrength);

                        finalDrawColor = `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
                    }
                }
                this.drawBrushPoint(point.x, point.y, basePressure, finalDrawColor); 
            }
        } else {
            // Draw the final segment to the last point to complete the line smoothly
            const finalPoint = this.lastPoint;
            const finalMidPoint = this.lastMidPoint;
            
            if (finalPoint && finalMidPoint) {
                 // Use the last recorded pressure for the end of the stroke
                const lastPressure = this.strokePoints[this.strokePoints.length - 1].pressure || 1.0;
                this.drawQuadraticBezier(finalMidPoint, finalPoint, finalPoint, lastPressure);
            }
        }

        // --- History/Undo Change ---
        this.canvas.canvas.dispatchEvent(new CustomEvent('historyend'));
        // --- End History/Undo Change ---

        this.isDrawing = false;
        this.lastPoint = null;
        this.strokePoints = [];
        this.lastMidPoint = null;
        this.smoothedPoint = null;
    }
    
    drawQuadraticBezier(start, control, end, basePressure) {
        const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        const steps = Math.max(1, Math.ceil(distance / 2));
        
        const smudgeStrength = (this.activeBrush?.smudgeStrength || 0) / 100;
        let sampledSmudgeColor = null;

        if (smudgeStrength > 0) {
            // Sample color once for the start of this segment from the canvas.
            // Using `start` point of the bezier segment for sampling.
            sampledSmudgeColor = this.canvas.pickColor(start.x, start.y);
        }

        const foregroundColorRgb = this.hexToRgb(this.color); 

        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            
            // Quadratic Bézier formula: (1-t)^2 * P0 + 2 * (1-t) * t * P1 + t^2 * P2
            const tInv = 1 - t;
            const tInv2 = tInv * tInv;
            const t2 = t * t;

            const x = tInv2 * start.x + 2 * tInv * t * control.x + t2 * end.x;
            const y = tInv2 * start.y + 2 * tInv * t * control.y + t2 * end.y;

            let finalDrawColor = this.color;
            if (smudgeStrength > 0 && sampledSmudgeColor) {
                const backgroundColorRgb = this.hexToRgb(sampledSmudgeColor); 

                const blendedR = Math.round(foregroundColorRgb.r * (1 - smudgeStrength) + backgroundColorRgb.r * smudgeStrength);
                const blendedG = Math.round(foregroundColorRgb.g * (1 - smudgeStrength) + backgroundColorRgb.g * smudgeStrength);
                const blendedB = Math.round(foregroundColorRgb.b * (1 - smudgeStrength) + backgroundColorRgb.b * smudgeStrength);

                finalDrawColor = `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
            }

            // Use the base pressure for each point along the curve segment
            this.drawBrushPoint(x, y, basePressure, finalDrawColor); // Pass the computed color
        }
    }
    
    drawBrushPoint(worldX, worldY, pressure, drawColorOverride = null) {
        // Base size and opacity are from the main UI sliders/current settings
        const baseSize = this.brushSize;
        const baseOpacity = this.opacity; // Already 0-1

        // Get blending, hardness, and pressure dynamics from the active custom brush, or fallbacks
        const effectiveBlending = this.activeBrush?.blending || 'source-over';
        const effectiveHardness = (this.activeBrush?.hardness !== undefined ? this.activeBrush.hardness : 80) / 100;
        const effectivePressureSize = (this.activeBrush?.pressureSize !== undefined ? this.activeBrush.pressureSize : 50) / 100;
        const effectivePressureOpacity = (this.activeBrush?.pressureOpacity !== undefined ? this.activeBrush.pressureOpacity : 0) / 100;
        const effectiveTip = this.activeBrush?.tip || 'round';

        // Apply pressure modifiers
        const pressureSizeMod = 1.0 - effectivePressureSize * (1.0 - pressure);
        const pressureOpacityMod = 1.0 - effectivePressureOpacity * (1.0 - pressure);

        const effectiveDrawSize = baseSize * pressureSizeMod;
        const effectiveDrawOpacity = baseOpacity * pressureOpacityMod;
        
        // Ensure minimum size and opacity to avoid invisible strokes
        if (effectiveDrawSize <= 0 || effectiveDrawOpacity <= 0) return;

        // Use the overridden color if provided (for smudge), otherwise use the default brush color
        const finalDrawColor = drawColorOverride || this.color;
        
        this.canvas.drawAcrossChunks(worldX, worldY, effectiveDrawSize, (ctx, localX, localY) => {
            ctx.save();
            
            // Handle eraser specific blending, otherwise use brush's blending
            ctx.globalCompositeOperation = (effectiveBlending === 'destination-out' || this.currentTool === 'eraser') ? 'destination-out' : effectiveBlending;

            // --- Brush Tip Rendering ---
            if (effectiveTip === 'square') {
                ctx.globalAlpha = effectiveDrawOpacity;
                ctx.fillStyle = finalDrawColor;
                ctx.fillRect(localX - effectiveDrawSize / 2, localY - effectiveDrawSize / 2, effectiveDrawSize, effectiveDrawSize);
            } else { // Default to round
                // Create a radial gradient for soft-edged brushes
                const gradient = ctx.createRadialGradient(localX, localY, 0, localX, localY, effectiveDrawSize / 2);
                
                // Color for the solid part of the brush
                const opaqueColor = this.hexToRgba(finalDrawColor, effectiveDrawOpacity);
                // Color for the fully transparent outer edge
                const transparentColor = this.hexToRgba(finalDrawColor, 0);

                // The gradient is defined by hardness
                // From 0 to (hardness - small_epsilon), use opaque color
                gradient.addColorStop(0, opaqueColor);
                gradient.addColorStop(Math.max(0, effectiveHardness - 0.01), opaqueColor); 
                // At the edge (1.0), use transparent color
                gradient.addColorStop(1, transparentColor); 

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(localX, localY, effectiveDrawSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            // --- End Brush Tip Rendering ---
            
            ctx.restore();
        });
    }

    hexToRgba(hex, alpha) {
        // Handle cases where hex might be undefined or invalid
        if (!hex || typeof hex !== 'string' || (!hex.startsWith('#') && !hex.startsWith('rgb'))) {
            hex = '#2c3e50'; // Default color
        }
        
        if (hex.startsWith('rgb')) {
            const parts = hex.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (parts) {
                return `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, ${alpha})`;
            }
        }

        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // New helper to convert hex to RGB object
    hexToRgb(hex) {
        if (!hex || typeof hex !== 'string' || (!hex.startsWith('#') && !hex.startsWith('rgb'))) {
            hex = '#2c3e50'; // Default color
        }
        if (hex.startsWith('rgb')) {
            const parts = hex.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (parts) {
                return { r: parseInt(parts[1]), g: parseInt(parts[2]), b: parseInt(parts[3]) };
            }
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }
    
    setTool(tool) {
        this.currentTool = tool;
        // If a non-drawing tool is selected, clear the active brush.
        // Drawing tools (like 'brush' or 'eraser') will keep a brush active or use specific blending.
        if (tool === 'pan' || tool === 'eyedropper') {
            this.activeBrush = null;
        }
    }
    
    // Sets the custom brush template (blending, hardness, pressure dynamics)
    setBrush(brush) {
        this.activeBrush = brush;
    }

    // Sets the base size for the current drawing tool (from main UI slider)
    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(200, size)); // Max 200 for consistency with editor
    }
    
    // Sets the base opacity for the current drawing tool (from main UI slider)
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity / 100)); // Store as 0-1
    }
    
    setColor(color) {
        this.color = color;
    }
}