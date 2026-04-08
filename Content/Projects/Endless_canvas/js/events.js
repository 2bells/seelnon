import { state } from 'app/state.js';
import { startStroke, addPointToStroke, endStroke, undo, redo, pickColor, deleteStrokeAt } from 'app/canvas.js';
import { scheduleSave } from 'app/storage.js';

function getPointerPos(event) {
    return {
        x: event.clientX,
        y: event.clientY,
        pressure: event.pointerType === 'pen' ? event.pressure : 1.0
    };
}

// Convert screen coordinates to world coordinates, considering pan and zoom
function screenToWorld(x, y) {
    let screenX = x;
    const screenY = y;

    if (state.isCanvasFlipped) {
        screenX = window.innerWidth - screenX;
    }

    return {
        x: (screenX - state.panOffset.x) / state.zoom,
        y: (screenY - state.panOffset.y) / state.zoom
    };
}

function updateToolbarColor(newColor) {
    const colorPicker = document.getElementById('colorPicker');
    const toolColorPicker = document.getElementById('toolColorPicker');
    if (colorPicker) {
        colorPicker.value = newColor;
    }
    if (toolColorPicker) {
        toolColorPicker.value = newColor;
    }
}

// Function to update the zoom indicator UI
function updateZoomIndicator() {
    const zoomIndicator = document.getElementById('zoom-indicator');
    if (zoomIndicator) {
        zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
    }
}

export function init(canvas) {
    // Initial update of the zoom indicator
    updateZoomIndicator();

    canvas.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary) return;
        const currentPointerPos = getPointerPos(e);
        state.lastMousePosition = currentPointerPos;
        const worldPos = screenToWorld(state.lastMousePosition.x, state.lastMousePosition.y);

        // Priority 1: Modifier key actions (Pan, Zoom, Eyedropper)
        if (state.spacebarPressed || e.button === 1) { // Pan on Spacebar+click or middle mouse
            state.isPanning = true;
            canvas.style.cursor = 'grabbing';
            return; // Prioritize panning
        }
        if (state.zKeyPressed && e.button === 0) { // Zoom on Z+click
            state.isZoomingWithMouse = true;
            canvas.style.cursor = 'zoom-in'; // Or a custom cursor
            return; // Prioritize zooming
        }
        if (state.altKeyPressed && e.button === 0) {
            const color = pickColor(worldPos.x, worldPos.y);
            if (color) {
                state.brush.color = color;
                updateToolbarColor(color);
                window.dispatchEvent(new CustomEvent('activeBrushChanged')); // Notify editor
            }
            return; // Prioritize eyedropper
        }

        // Priority 2: Tool-specific actions
        // Eraser tool behavior: continuous erase on hold
        if (state.activeTool === 'eraser') {
            canvas.setPointerCapture(e.pointerId); // Capture to prevent unintended scroll/pan
            state.isErasing = true; // Set erasing flag
            deleteStrokeAt(worldPos.x, worldPos.y); // Erase on initial click
            return; 
        }

        if (e.button === 0) { // Left mouse button for other tools
            canvas.setPointerCapture(e.pointerId);

            if (state.activeTool === 'brush') {
                state.isDrawing = true;
                const now = performance.now();
                startStroke(worldPos.x, worldPos.y, currentPointerPos.pressure);
                state.lastDrawPosition = { ...worldPos, timestamp: now };
            } else if (state.activeTool === 'selection') {
                state.isSelecting = true;
                state.selection = {
                    startX: worldPos.x,
                    startY: worldPos.y,
                    x: worldPos.x,
                    y: worldPos.y,
                    width: 0,
                    height: 0
                };
            }
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!e.isPrimary) return;
        const currentPointerPos = getPointerPos(e);
        const deltaX = currentPointerPos.x - state.lastMousePosition.x;
        const deltaY = currentPointerPos.y - state.lastMousePosition.y;
        const worldPos = screenToWorld(currentPointerPos.x, currentPointerPos.y); // Get world pos for all pointermove actions

        if (state.isPanning) {
            let actualDeltaX = deltaX;
            // If canvas is visually flipped, horizontal panning direction should be reversed
            if (state.isCanvasFlipped) {
                actualDeltaX = -deltaX;
            }
            state.panOffset.x += actualDeltaX;
            state.panOffset.y += deltaY;
            scheduleSave();
        } else if (state.isZoomingWithMouse) {
            const zoomSensitivity = 0.005;
            const zoomDelta = (deltaX - deltaY) * zoomSensitivity;
            const newZoom = Math.max(0.25, state.zoom + zoomDelta); // Changed: Min zoom 25%
            
            const worldPosBeforeZoom = screenToWorld(state.lastMousePosition.x, state.lastMousePosition.y);
            state.zoom = newZoom;
            const worldPosAfterZoom = screenToWorld(state.lastMousePosition.x, state.lastMousePosition.y);
            
            state.panOffset.x += (worldPosAfterZoom.x - worldPosBeforeZoom.x) * state.zoom;
            state.panOffset.y += (worldPosAfterZoom.y - worldPosBeforeZoom.y) * state.zoom;
            
            canvas.style.cursor = zoomDelta >= 0 ? 'zoom-in' : 'zoom-out';
            updateZoomIndicator(); // Update zoom UI
            scheduleSave();
        } else if (state.isDrawing) {
            if (state.activeTool === 'brush') {
                const now = performance.now();
                let pressure = currentPointerPos.pressure;

                // Speed sensitivity logic
                if (state.brush.speedSensitivity && pressure === 1.0) { // Fallback to speed if no hardware pressure
                    const timeDelta = now - state.lastDrawPosition.timestamp;
                    if (timeDelta > 5) { // Only calculate if there's a meaningful time gap
                        const distance = Math.hypot(worldPos.x - state.lastDrawPosition.x, worldPos.y - state.lastDrawPosition.y);
                        const speed = distance / timeDelta; // speed in pixels per millisecond

                        const maxSpeed = state.brush.speedSensitivityFactor; // Use configurable max speed
                        const minPressure = 0.1;
                        const calculatedPressure = 1 - (speed / maxSpeed);
                        pressure = Math.max(minPressure, Math.min(1, calculatedPressure));
                    } else {
                        // if moving very slowly or first point, use full pressure
                        pressure = 1.0;
                    }
                }

                addPointToStroke(worldPos.x, worldPos.y, pressure);
                state.lastDrawPosition = { ...worldPos, timestamp: now };
            }
        } else if (state.isErasing) { // Handle continuous erasing here
            deleteStrokeAt(worldPos.x, worldPos.y);
        } else if (state.isSelecting) {
            state.selection.x = Math.min(state.selection.startX, worldPos.x);
            state.selection.y = Math.min(state.selection.startY, worldPos.y);
            state.selection.width = Math.abs(state.selection.startX - worldPos.x);
            state.selection.height = Math.abs(state.selection.startY - worldPos.y);
        }
        
        state.lastMousePosition = currentPointerPos;
    });

    canvas.addEventListener('pointerup', (e) => {
        if (!e.isPrimary) return;
        if (state.isDrawing) {
            canvas.releasePointerCapture(e.pointerId);
            if(state.activeTool === 'brush') {
                endStroke();
            }
        }
        if (state.isSelecting) {
            canvas.releasePointerCapture(e.pointerId);
            // Finalize selection
            delete state.selection.startX;
            delete state.selection.startY;
            
            // Enable selection option in export modal
            const exportAreaSelect = document.getElementById('export-area');
            const selectionOption = exportAreaSelect.querySelector('option[value="selection"]');
            if (state.selection.width > 0 && state.selection.height > 0) {
                selectionOption.disabled = false;
            } else {
                state.selection = null;
                selectionOption.disabled = true;
            }
        }
        if (state.isErasing) { // Release pointer capture and reset flag for eraser tool
            canvas.releasePointerCapture(e.pointerId);
            state.isErasing = false;
        }
        state.isDrawing = false;
        state.isPanning = false;
        state.isZoomingWithMouse = false;
        state.isSelecting = false;
        // Restore cursor based on current active tools
        updateCanvasCursor();
    });

    canvas.addEventListener('pointerleave', (e) => {
        if(state.isDrawing && state.activeTool === 'brush') {
            endStroke();
        }
        if(state.isSelecting) {
            state.isSelecting = false;
            state.selection = null;
        }
        if (state.isErasing) { // Reset flag if pointer leaves while erasing
            state.isErasing = false;
        }
        state.isDrawing = false;
        state.isPanning = false;
        state.isZoomingWithMouse = false;
        state.isSelecting = false;
        updateCanvasCursor();
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Panning with Spacebar
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !state.spacebarPressed) {
            e.preventDefault();
            state.spacebarPressed = true;
            updateCanvasCursor();
        }
        if (e.key.toLowerCase() === 'z' && !state.zKeyPressed) {
             e.preventDefault();
             state.zKeyPressed = true;
             updateCanvasCursor();
        }
        if (e.key === 'Alt' && !state.altKeyPressed) {
            e.preventDefault();
            state.altKeyPressed = true;
            updateCanvasCursor();
        }
        // Brush size hotkeys (E for increase, W for decrease)
        if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'w') {
            e.preventDefault();
            const brushSizeInput = document.getElementById('brushSize');
            if (!brushSizeInput) return;
            const brushSizeValue = document.getElementById('brushSizeValue');
            let currentSize = parseFloat(brushSizeInput.value);
            const changeAmount = e.key.toLowerCase() === 'e' ? 0.5 : -0.5; // 'e' increases, 'w' decreases
            const newSize = Math.max(parseFloat(brushSizeInput.min), Math.min(parseFloat(brushSizeInput.max), currentSize + changeAmount));
            
            if (newSize !== currentSize) {
                state.brush.size = newSize;
                brushSizeInput.value = newSize;
                if (brushSizeValue) { // Add null check
                    brushSizeValue.textContent = newSize.toFixed(1);
                }
            }
            window.dispatchEvent(new CustomEvent('activeBrushChanged')); // Notify editor
        }
        
        // Function to handle brush cycling
        function cycleBrushPreset(baseType) {
            const presetsForType = Object.entries(state.brushPresets)
                .filter(([id, preset]) => preset.baseType === baseType)
                .map(([id, preset]) => id); // Get an array of preset IDs

            if (presetsForType.length === 0) return;

            const currentPresetId = state.activeBrushPresetId;
            const currentBaseType = state.brushPresets[currentPresetId]?.baseType;
            
            let nextPresetId;
            if (currentBaseType === baseType) {
                const currentIndex = presetsForType.indexOf(currentPresetId);
                const nextIndex = (currentIndex + 1) % presetsForType.length;
                nextPresetId = presetsForType[nextIndex];
            } else {
                // If not currently on this baseType, start with the first one
                nextPresetId = presetsForType[0];
            }
            
            document.querySelector(`[data-preset-id="${nextPresetId}"]`)?.click();
        }

        // Tool hotkeys
        if(e.key === '1') { // Hotkey '1' for Pen Brush
            e.preventDefault();
            cycleBrushPreset('pen');
        }
        if(e.key === '2') { // Hotkey '2' for Wireframe Brush
            e.preventDefault();
            cycleBrushPreset('wireframe');
        }
        if(e.key === '3') { // Hotkey '3' for Pixel Brush
            e.preventDefault();
            cycleBrushPreset('pixel');
        }
        if(e.key === '4') { // Hotkey '4' for Sketchy Brush
            e.preventDefault();
            cycleBrushPreset('sketchy');
        }
        if(e.key === '5') { // Hotkey '5' for Eraser Tool
            e.preventDefault();
            document.getElementById('eraser-tool')?.click();
        }
        if(e.key.toLowerCase() === 's') { // Hotkey 'S' for Selection Tool
            e.preventDefault();
            document.getElementById('selection-tool')?.click();
        }

        // Mirror mode
        if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            state.mirrorMode = !state.mirrorMode;
            const mirrorStatus = document.getElementById('mirror-status');
            if (mirrorStatus) {
                mirrorStatus.style.opacity = state.mirrorMode ? '1' : '0';
            }
        }
        // Flip canvas view
        if (e.key.toLowerCase() === 'b') {
             e.preventDefault();
             state.isCanvasFlipped = !state.isCanvasFlipped;
             const flipStatus = document.getElementById('flip-status');
             if (flipStatus) {
                flipStatus.style.opacity = state.isCanvasFlipped ? '1' : '0';
             }
        }
        // Undo/Redo
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            redo();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            state.spacebarPressed = false;
            updateCanvasCursor();
        }
        if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            state.zKeyPressed = false;
            updateCanvasCursor();
        }
        if (e.key === 'Alt') {
            e.preventDefault();
            state.altKeyPressed = false;
            updateCanvasCursor();
        }
    });

    // Zooming with mouse wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomAmount = 0.1;
        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        const newZoom = Math.max(0.25, state.zoom + zoomDirection * zoomAmount * state.zoom * 0.5); // Changed: Min zoom 25%

        const mousePos = {x: e.clientX, y: e.clientY};
        const worldPosBeforeZoom = screenToWorld(mousePos.x, mousePos.y);
        
        state.zoom = newZoom;

        const worldPosAfterZoom = screenToWorld(mousePos.x, mousePos.y);

        state.panOffset.x += (worldPosAfterZoom.x - worldPosBeforeZoom.x) * state.zoom;
        state.panOffset.y += (worldPosAfterZoom.y - worldPosBeforeZoom.y) * state.zoom;

        updateZoomIndicator(); // Update zoom UI
        scheduleSave();
    });

    // Function to update canvas cursor based on active tools/modes
    function updateCanvasCursor() {
        if (state.activeTool === 'eraser') {
            const size = Math.max(2, state.brush.size * state.zoom);
            const halfSize = size / 2;
            const svgCursor = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${halfSize}" cy="${halfSize}" r="${halfSize-1}" fill="none" stroke="black" stroke-width="1.5" /><circle cx="${halfSize}" cy="${halfSize}" r="${halfSize-2}" fill="none" stroke="white" stroke-width="1.5" /></svg>`;
            canvas.style.cursor = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgCursor)}') ${halfSize} ${halfSize}, auto`;
        } else if (state.activeTool === 'selection') {
            canvas.style.cursor = 'crosshair';
        } else if (state.altKeyPressed) {
            canvas.style.cursor = 'copy'; // Eyedropper cursor
        } else if (state.spacebarPressed) {
            canvas.style.cursor = 'grab';
        } else if (state.zKeyPressed) {
            canvas.style.cursor = 'zoom-in';
        } else {
             // For brush, use a dynamic cursor with a circle for size and a crosshair for visibility.
            const size = Math.max(1, state.brush.size * state.zoom);
            if (size > 128) { // Limit cursor size to avoid performance issues, fallback to crosshair
                canvas.style.cursor = 'crosshair';
                return;
            }
            
            // Define crosshair properties
            const crosshairGap = size / 2 + 2; // Start lines 2px away from the circle edge
            const crosshairLength = 5; // Each line segment is 5px long
            const crosshairExtent = crosshairGap + crosshairLength;
            
            // The SVG container needs to be large enough for the brush circle or the crosshair, whichever is bigger.
            const svgSize = Math.max(size, crosshairExtent * 2);
            const halfSvgSize = svgSize / 2;

            // Use two strokes for better visibility on different backgrounds (black with white outline)
            const circle = `<circle cx="${halfSvgSize}" cy="${halfSvgSize}" r="${size / 2}" fill="none" stroke="white" stroke-width="1.5" /><circle cx="${halfSvgSize}" cy="${halfSvgSize}" r="${size / 2}" fill="none" stroke="black" stroke-width="1" />`;
            
            const lines = `
                <line x1="${halfSvgSize}" y1="${halfSvgSize - crosshairGap}" x2="${halfSvgSize}" y2="${halfSvgSize - crosshairExtent}" stroke="white" stroke-width="1.5" />
                <line x1="${halfSvgSize}" y1="${halfSvgSize + crosshairGap}" x2="${halfSvgSize}" y2="${halfSvgSize + crosshairExtent}" stroke="white" stroke-width="1.5" />
                <line x1="${halfSvgSize - crosshairGap}" y1="${halfSvgSize}" x2="${halfSvgSize - crosshairExtent}" y2="${halfSvgSize}" stroke="white" stroke-width="1.5" />
                <line x1="${halfSvgSize + crosshairGap}" y1="${halfSvgSize}" x2="${halfSvgSize + crosshairExtent}" y2="${halfSvgSize}" stroke="white" stroke-width="1.5" />
                <line x1="${halfSvgSize}" y1="${halfSvgSize - crosshairGap}" x2="${halfSvgSize}" y2="${halfSvgSize - crosshairExtent}" stroke="black" stroke-width="1" />
                <line x1="${halfSvgSize}" y1="${halfSvgSize + crosshairGap}" x2="${halfSvgSize}" y2="${halfSvgSize + crosshairExtent}" stroke="black" stroke-width="1" />
                <line x1="${halfSvgSize - crosshairGap}" y1="${halfSvgSize}" x2="${halfSvgSize - crosshairExtent}" y2="${halfSvgSize}" stroke="black" stroke-width="1" />
                <line x1="${halfSvgSize + crosshairGap}" y1="${halfSvgSize}" x2="${halfSvgSize + crosshairExtent}" y2="${halfSvgSize}" stroke="black" stroke-width="1" />
            `;
            
            const svgCursor = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" xmlns="http://www.w3.org/2000/svg">${circle}${lines}</svg>`;
            canvas.style.cursor = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgCursor)}') ${halfSvgSize} ${halfSvgSize}, crosshair`;
        }
    }

    // Initial cursor set
    updateCanvasCursor();

    // Re-evaluate cursor on zoom and brush size change
    const brushSizeValue = document.getElementById('brushSizeValue');
    if (brushSizeValue) {
        // Observe brushSizeValue for changes (from keyboard input or editor)
        new MutationObserver(updateCanvasCursor).observe(brushSizeValue, { childList: true });
    }
    canvas.addEventListener('wheel', updateCanvasCursor, { passive: true });

    // Also update cursor when activeTool or state.brush.type changes
    // This is handled via a custom event dispatched from main.js when the active brush changes
    window.addEventListener('activeBrushChanged', updateCanvasCursor);
}
