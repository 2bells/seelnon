import { state } from './state.js';
import { startStroke, addPointToStroke, endStroke, undo, redo, pickColor, deleteStrokeAt, selectStrokesInRect, moveStrokes, getSelectionBounds, saveHistory, renderStrokeToBitmap, rotateStrokes, scaleStrokes, isPointOnStroke } from './canvas.js';
import { scheduleSave } from './storage.js';

function getPointerPos(event) {
    let pressure = 1.0;
    
    // Check if hardware pressure is even possible and if brush wants it
    if (state.brush.pressureSensitivity) {
        // High-fidelity pressure reporting (Wacom, Apple Pencil, etc.)
        if (event.pointerType === 'pen') {
            // Pens are high fidelity, we trust their pressure even if it's a standard-looking value
            pressure = event.pressure;
        } else if (event.pressure !== undefined && event.pressure !== 0 && event.pressure !== 0.5) {
            // For mouse/touch, only override default 1.0 if we see non-trivial pressure values
            pressure = event.pressure;
        }
    }

    return {
        x: event.clientX,
        y: event.clientY,
        pressure: pressure
    };
}

// Convert screen coordinates to world coordinates, considering pan and zoom
export function screenToWorld(x, y) {
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

// Function to update the zoom and coordinate indicator UI in the status bar
function updateProjectInfo(worldX = 0, worldY = 0) {
    const projectZoom = document.getElementById('project-zoom');
    const projectCoords = document.getElementById('project-coords');
    
    if (projectZoom) {
        projectZoom.textContent = `${Math.round(state.zoom * 100)}%`;
    }
    
    if (projectCoords) {
        projectCoords.textContent = `X: ${Math.round(worldX)}, Y: ${Math.round(worldY)}`;
    }
}

function getSelectionHandleAt(worldX, worldY, rect, zoom) {
    if (!rect) return null;
    const handleSize = 12 / zoom; // Use slightly larger hit area for handles
    const hs = handleSize / 2;

    const handles = {
        nw: { x: rect.x, y: rect.y },
        ne: { x: rect.x + rect.width, y: rect.y },
        sw: { x: rect.x, y: rect.y + rect.height },
        se: { x: rect.x + rect.width, y: rect.y + rect.height },
        n: { x: rect.x + rect.width / 2, y: rect.y },
        s: { x: rect.x + rect.width / 2, y: rect.y + rect.height },
        w: { x: rect.x, y: rect.y + rect.height / 2 },
        e: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
        rotate: { x: rect.x + rect.width / 2, y: rect.y - 30 / zoom }
    };

    for (const [name, p] of Object.entries(handles)) {
        if (worldX >= p.x - hs && worldX <= p.x + hs && worldY >= p.y - hs && worldY <= p.y + hs) {
            return name;
        }
    }
    return null;
}

export function init(canvas) {
    // Initial update of project info
    updateProjectInfo();

    // Throttle status bar updates for performance
    let infoRequest = null;
    function throttledUpdateInfo(worldX, worldY) {
        if (infoRequest) return;
        infoRequest = requestAnimationFrame(() => {
            updateProjectInfo(worldX, worldY);
            infoRequest = null;
        });
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary) return;
        e.preventDefault();
        
        // Detect stylus for custom cursor
        state.isStylusActive = (e.pointerType === 'pen');
        updateStylusCursor(e);

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
                // Check if clicking on handles first
                const handle = getSelectionHandleAt(worldPos.x, worldPos.y, state.selection, state.zoom);
                if (handle) {
                    state.initialSelection = { ...state.selection };
                    if (handle === 'rotate') {
                        state.isRotatingSelection = true;
                        state.rotationStartAngle = Math.atan2(worldPos.y - (state.selection.y + state.selection.height / 2), worldPos.x - (state.selection.x + state.selection.width / 2));
                        state.totalRotationAngle = 0;
                    } else {
                        state.isScalingSelection = true;
                        state.selectionHandle = handle;
                    }
                    state.selectionPivot = { 
                        x: state.selection.x + state.selection.width / 2, 
                        y: state.selection.y + state.selection.height / 2 
                    };
                    state.moveOrigin = { x: worldPos.x, y: worldPos.y };
                    return;
                }

                // Check if clicking inside current selection to start move
                const bounds = state.selection || getSelectionBounds(state.selectedStrokes);
                let hitSelection = false;
                if (bounds) {
                    const margin = 10 / state.zoom;
                    if (worldPos.x >= bounds.x - margin && worldPos.x <= bounds.x + bounds.width + margin &&
                        worldPos.y >= bounds.y - margin && worldPos.y <= bounds.y + bounds.height + margin) {
                        hitSelection = true;
                    }
                }

                if (hitSelection) {
                    state.isMovingSelection = true;
                    state.moveOrigin = { x: worldPos.x, y: worldPos.y };
                    // If moving, we use bounds as our current state.selection if it wasn't set
                    if (!state.selection) {
                        state.selection = bounds;
                    }
                } else {
                    // Start new selection
                    state.isSelecting = true;
                    
                    // Hit-test strokes for single-click selection
                    let hitStroke = null;
                    const tolerance = 10 / state.zoom;
                    // Check from top to bottom (reverse order)
                    for (let i = state.strokes.length - 1; i >= 0; i--) {
                        if (isPointOnStroke(worldPos.x, worldPos.y, state.strokes[i], tolerance)) {
                            hitStroke = state.strokes[i];
                            break;
                        }
                    }
                    
                    state.clickHitStroke = hitStroke;
                    
                    if (!hitStroke) {
                        state.selectedStrokes = []; // Deselect on empty click start
                    }

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
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!e.isPrimary) return;
        e.preventDefault();

        // Update stylus cursor state
        if (e.pointerType === 'pen') {
            // Already handled in pointerdown for activation, 
            // but we update position here.
            updateStylusCursor(e);
        } else if (state.isStylusActive) {
            // If we get a mouse move while stylus was active, reset it
            state.isStylusActive = false;
            updateStylusCursor(e);
        }

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
            updateProjectInfo(worldPos.x, worldPos.y);
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
            updateProjectInfo(worldPos.x, worldPos.y);
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
        } else if (state.isMovingSelection) {
            const dx = worldPos.x - state.moveOrigin.x;
            const dy = worldPos.y - state.moveOrigin.y;
            moveStrokes(state.selectedStrokes, dx, dy);
            // Also move selection rect
            if (state.selection) {
                state.selection.x += dx;
                state.selection.y += dy;
            }
            state.moveOrigin = { x: worldPos.x, y: worldPos.y };
        } else if (state.isRotatingSelection) {
            const currentAngle = Math.atan2(worldPos.y - state.selectionPivot.y, worldPos.x - state.selectionPivot.x);
            const angleDeltaSinceLastFrame = Math.atan2(currentPointerPos.y - state.panOffset.y - state.selectionPivot.y * state.zoom, state.lastMousePosition.x - state.panOffset.x - state.selectionPivot.x * state.zoom); // Wait, this is inconsistent
            
            // Simpler: find delta from last frame to rotate strokes
            const prevAngle = Math.atan2(state.lastMousePosition.y - state.panOffset.y - state.selectionPivot.y * state.zoom, state.lastMousePosition.x - state.panOffset.x - state.selectionPivot.x * state.zoom);
            const currentFrameAngle = Math.atan2(currentPointerPos.y - state.panOffset.y - state.selectionPivot.y * state.zoom, currentPointerPos.x - state.panOffset.x - state.selectionPivot.x * state.zoom);
            const delta = currentFrameAngle - prevAngle;
            
            rotateStrokes(state.selectedStrokes, delta, state.selectionPivot);
            state.totalRotationAngle += delta;

            // Update selection rect based on INITIAL selection and TOTAL angle to avoid feedback loop growth
            if (state.initialSelection) {
                const rect = state.initialSelection;
                const corners = [
                    { x: rect.x, y: rect.y },
                    { x: rect.x + rect.width, y: rect.y },
                    { x: rect.x, y: rect.y + rect.height },
                    { x: rect.x + rect.width, y: rect.y + rect.height }
                ];
                
                const cos = Math.cos(state.totalRotationAngle);
                const sin = Math.sin(state.totalRotationAngle);
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                
                corners.forEach(p => {
                    const dx = p.x - state.selectionPivot.x;
                    const dy = p.y - state.selectionPivot.y;
                    const nx = state.selectionPivot.x + (dx * cos - dy * sin);
                    const ny = state.selectionPivot.y + (dx * sin + dy * cos);
                    minX = Math.min(minX, nx);
                    minY = Math.min(minY, ny);
                    maxX = Math.max(maxX, nx);
                    maxY = Math.max(maxY, ny);
                });
                
                state.selection = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                    startX: state.initialSelection.startX,
                    startY: state.initialSelection.startY
                };
            }
        } else if (state.isScalingSelection) {
            const rect = state.selection;
            const dx = worldPos.x - state.moveOrigin.x;
            const dy = worldPos.y - state.moveOrigin.y;
            
            let scaleX = 1;
            let scaleY = 1;

            if (state.selectionHandle.includes('e')) scaleX = (rect.width + dx) / rect.width;
            if (state.selectionHandle.includes('w')) scaleX = (rect.width - dx) / rect.width;
            if (state.selectionHandle.includes('s')) scaleY = (rect.height + dy) / rect.height;
            if (state.selectionHandle.includes('n')) scaleY = (rect.height - dy) / rect.height;
            
            const pivot = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            if (state.selectionHandle.includes('w')) pivot.x = rect.x + rect.width;
            if (state.selectionHandle.includes('e')) pivot.x = rect.x;
            if (state.selectionHandle.includes('n')) pivot.y = rect.y + rect.height;
            if (state.selectionHandle.includes('s')) pivot.y = rect.y;

            if (isFinite(scaleX) && isFinite(scaleY) && scaleX !== 0 && scaleY !== 0) {
                scaleStrokes(state.selectedStrokes, scaleX, scaleY, pivot);
                
                // Update selection rect manually to avoid shrinking jump
                if (state.selectionHandle.includes('e')) {
                    state.selection.width += dx;
                }
                if (state.selectionHandle.includes('w')) {
                    state.selection.x += dx;
                    state.selection.width -= dx;
                }
                if (state.selectionHandle.includes('s')) {
                    state.selection.height += dy;
                }
                if (state.selectionHandle.includes('n')) {
                    state.selection.y += dy;
                    state.selection.height -= dy;
                }
            }
            state.moveOrigin = { x: worldPos.x, y: worldPos.y };
        } else if (state.isSelecting) {
            state.selection.x = Math.min(state.selection.startX, worldPos.x);
            state.selection.y = Math.min(state.selection.startY, worldPos.y);
            state.selection.width = Math.abs(state.selection.startX - worldPos.x);
            state.selection.height = Math.abs(state.selection.startY - worldPos.y);
        }
        
        // Always update project coords on move (throttled)
        throttledUpdateInfo(worldPos.x, worldPos.y);
        
        state.lastMousePosition = currentPointerPos;
    });

    canvas.addEventListener('pointerup', (e) => {
        if (!e.isPrimary) return;

        // Reset stylus active state on ANY pointerup for safety
        if (state.isStylusActive || e.pointerType === 'pen') {
            state.isStylusActive = false;
            // Force a small delay to ensure the browser has finished pen-specific cursor logic
            requestAnimationFrame(() => updateStylusCursor(e));
        }

        if (state.isDrawing) {
            canvas.releasePointerCapture(e.pointerId);
            if(state.activeTool === 'brush') {
                endStroke();
            }
        }
        if (state.isMovingSelection) {
            canvas.releasePointerCapture(e.pointerId);
            state.isMovingSelection = false;
            
            // Regenerate bitmaps for moved strokes that use non-compounding opacity
            for (const stroke of state.selectedStrokes) {
                if (stroke.nonCompoundingOpacity && stroke.type === 'pen' && stroke.points.length >= 2) {
                    renderStrokeToBitmap(stroke);
                }
            }
            
            saveHistory();
        }
        if (state.isRotatingSelection || state.isScalingSelection) {
            canvas.releasePointerCapture(e.pointerId);
            state.isRotatingSelection = false;
            state.isScalingSelection = false;
            state.selectionHandle = null;

            for (const stroke of state.selectedStrokes) {
                if (stroke.nonCompoundingOpacity && stroke.type === 'pen' && stroke.points.length >= 2) {
                    renderStrokeToBitmap(stroke);
                }
            }
            saveHistory();
        }
        if (state.isSelecting) {
            canvas.releasePointerCapture(e.pointerId);
            
            // Finalize selection rect
            const bounds = { x: state.selection.x, y: state.selection.y, width: state.selection.width, height: state.selection.height };
            
            // Determine if it was a click or a drag
            const clickThreshold = 5 / state.zoom;
            const isClick = bounds.width < clickThreshold && bounds.height < clickThreshold;

            if (isClick && state.clickHitStroke) {
                // Clicked on a stroke: Select it exclusively and fit bounds
                state.selectedStrokes = [state.clickHitStroke];
                state.selection = getSelectionBounds(state.selectedStrokes);
                state.clickHitStroke = null;
            } else {
                // Dragged a box: Select all strokes inside
                state.selectedStrokes = selectStrokesInRect(bounds);
                state.clickHitStroke = null;

                if (state.selectedStrokes.length === 0) {
                    state.selection = null;
                }
            }
            
            // Enable selection option in export modal
            const exportAreaSelect = document.getElementById('export-area');
            const selectionOption = exportAreaSelect?.querySelector('option[value="selection"]');
            
            if (state.selectedStrokes.length > 0) {
                if (selectionOption) selectionOption.disabled = false;
            } else {
                if (selectionOption) selectionOption.disabled = true;
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

    canvas.addEventListener('pointercancel', (e) => {
        if (!e.isPrimary) return;
        
        if (state.isStylusActive) {
            state.isStylusActive = false;
            updateStylusCursor(e);
        }

        if (state.isDrawing) {
            canvas.releasePointerCapture(e.pointerId);
            if(state.activeTool === 'brush') {
                endStroke();
            }
        }
        state.isDrawing = false;
        state.isPanning = false;
        state.isZoomingWithMouse = false;
        state.isSelecting = false;
        state.isMovingSelection = false;
        state.isRotatingSelection = false;
        state.isScalingSelection = false;
        state.isErasing = false;
        updateCanvasCursor();
    });

    canvas.addEventListener('pointerleave', (e) => {
        // We no longer end stroke on pointerleave because setPointerCapture 
        // handles tracking outside the canvas area. pointerup or pointercancel 
        // will handle the finalisation.
        
        if (state.isStylusActive) {
            state.isStylusActive = false;
            updateStylusCursor(e);
        }
        
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
             // Smart Flip: keep the same world coordinate at the screen center
             const centerX = window.innerWidth / 2;
             const centerY = window.innerHeight / 2;
             const worldCenter = screenToWorld(centerX, centerY);
             
             state.isCanvasFlipped = !state.isCanvasFlipped;
             
             // Recalculate pan to keep worldCenter at screen center
             if (state.isCanvasFlipped) {
                 state.panOffset.x = (window.innerWidth - centerX) - worldCenter.x * state.zoom;
             } else {
                 state.panOffset.x = centerX - worldCenter.x * state.zoom;
             }

             const flipStatus = document.getElementById('flip-status');
             if (flipStatus) {
                flipStatus.style.opacity = state.isCanvasFlipped ? '1' : '0';
             }
             scheduleSave();
        }
        // Undo/Redo
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
            updateCanvasCursor();
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            redo();
            updateCanvasCursor();
        }

        // Delete selected strokes
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.activeTool === 'selection' && state.selectedStrokes.length > 0) {
            e.preventDefault();
            for (const stroke of state.selectedStrokes) {
                const idx = state.strokes.indexOf(stroke);
                if (idx !== -1) {
                    state.strokes.splice(idx, 1);
                }
            }
            state.selectedStrokes = [];
            state.selection = null;
            saveHistory();
            updateCanvasCursor();
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

        updateProjectInfo(worldPosBeforeZoom.x, worldPosBeforeZoom.y);
        scheduleSave();
    });

    let lastCursorParams = null;

    // Function to update canvas cursor based on active tools/modes
    function updateCanvasCursor() {
        // Check if anything actually changed to avoid expensive cursor re-sets
        const currentParams = `${state.activeTool}-${state.brush.size}-${state.zoom}-${state.brush.type}-${state.altKeyPressed}-${state.spacebarPressed}-${state.zKeyPressed}-${state.isMovingSelection}-${state.isRotatingSelection}-${state.isScalingSelection}-${state.isStylusActive}`;

        if (currentParams === lastCursorParams) return;
        lastCursorParams = currentParams;

        // Centralized stylus cursor handling
        const stylusCursor = document.getElementById('custom-stylus-cursor');
        if (state.isStylusActive) {
            canvas.style.cursor = 'none';
            if (stylusCursor) stylusCursor.classList.remove('hidden');
            return;
        } else {
            if (stylusCursor) stylusCursor.classList.add('hidden');
        }

        if (state.activeTool === 'eraser') {
            const size = Math.max(2, state.brush.size * state.zoom);
            const halfSize = size / 2;
            const svgCursor = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${halfSize}" cy="${halfSize}" r="${halfSize-1}" fill="none" stroke="black" stroke-width="1.5" /><circle cx="${halfSize}" cy="${halfSize}" r="${halfSize-2}" fill="none" stroke="white" stroke-width="1.5" /></svg>`;
            canvas.style.cursor = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgCursor)}') ${halfSize} ${halfSize}, auto`;
        } else if (state.isMovingSelection) {
            canvas.style.cursor = 'move';
        } else if (state.isRotatingSelection) {
            canvas.style.cursor = 'grab';
        } else if (state.isScalingSelection) {
            canvas.style.cursor = state.selectionHandle.includes('n') || state.selectionHandle.includes('s') ? 'ns-resize' : 'ew-resize';
        } else if (state.activeTool === 'selection') {
            const handle = getSelectionHandleAt(screenToWorld(state.lastMousePosition.x, state.lastMousePosition.y).x, screenToWorld(state.lastMousePosition.x, state.lastMousePosition.y).y, state.selection, state.zoom);
            if (handle) {
                if (handle === 'rotate') canvas.style.cursor = 'grab';
                else if (handle === 'n' || handle === 's') canvas.style.cursor = 'ns-resize';
                else if (handle === 'e' || handle === 'w') canvas.style.cursor = 'ew-resize';
                else if (handle === 'nw' || handle === 'se') canvas.style.cursor = 'nwse-resize';
                else if (handle === 'ne' || handle === 'sw') canvas.style.cursor = 'nesw-resize';
            } else {
                canvas.style.cursor = 'crosshair';
            }
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

    function updateStylusCursor(e) {
        const cursor = document.getElementById('custom-stylus-cursor');
        if (!cursor) return;

        if (state.isStylusActive) {
            cursor.style.left = `${e.clientX}px`;
            cursor.style.top = `${e.clientY}px`;
        }
        
        // Always trigger updateCanvasCursor to ensure sync
        updateCanvasCursor();
    }

    // Initial cursor set
    updateCanvasCursor();

    // Re-evaluate cursor on zoom and brush size change
    const brushSizeValue = document.getElementById('brushSizeValue');
    if (brushSizeValue) {
        // Observe brushSizeValue for changes (from keyboard input or editor)
        new MutationObserver(updateCanvasCursor).observe(brushSizeValue, { childList: true });
    }
    let wheelCursorTimeout = null;
    canvas.addEventListener('wheel', () => {
        if (wheelCursorTimeout) return;
        wheelCursorTimeout = setTimeout(() => {
            updateCanvasCursor();
            wheelCursorTimeout = null;
        }, 100); 
    }, { passive: true });

    // Also update cursor when activeTool or state.brush.type changes
    // This is handled via a custom event dispatched from main.js when the active brush changes
    window.addEventListener('activeBrushChanged', updateCanvasCursor);
}
