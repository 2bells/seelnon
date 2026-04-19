import { state } from './state.js';

const SAVE_KEY = 'endlessCanvasState';
const SAVE_DELAY = 5000; // 5 seconds (changed from 2000)

let saveTimeout = null;
let statusTimeout = null;

function showStatus(message, isError = false) {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) return;

    indicator.textContent = message;
    
    if (isError) {
        indicator.classList.add('error');
    } else {
        indicator.classList.remove('error');
    }

    indicator.classList.add('visible');

    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 2000); // Hide after 2 seconds
}

function saveStateToLocalStorage() {
    try {
        // Only save the current strokes, history index, pan, zoom, and brush/canvas settings
        // The full history array is not saved to reduce storage size.
        // It's rebuilt from state.strokes + current historyIndex upon load.
        // This means undo/redo history is reset on page reload, but current drawing is preserved.
        const stateToSave = {
            strokes: state.strokes.map(stroke => ({
                // Optimization: Round coordinates to 1 decimal place to save localStorage space
                points: stroke.points.map(p => ({
                    x: Math.round(p.x * 10) / 10,
                    y: Math.round(p.y * 10) / 10,
                    pressure: Math.round((p.pressure || 1.0) * 100) / 100,
                    size: Math.round(p.size * 10) / 10
                })),
                bounds: stroke.bounds, // Save bounds for faster culling on load
                color: stroke.color,
                opacity: stroke.opacity,
                tipShape: stroke.tipShape, // Save per-stroke properties
                minSizeFactor: stroke.minSizeFactor, // Save per-stroke properties
                nonCompoundingOpacity: stroke.nonCompoundingOpacity, // Save per-stroke properties
                type: stroke.type, // Save brush type for stroke
                pixelSize: stroke.pixelSize, // Save pixel size for stroke
                enableSmoothing: stroke.enableSmoothing, // Save smoothing settings
                smoothingFactor: stroke.smoothingFactor,
                // Wireframe specific
                wireframeMeshOpacity: stroke.wireframeMeshOpacity,
                wireframeLineOpacity: stroke.wireframeLineOpacity,
                wireframeHullLineThickness: stroke.wireframeHullLineThickness,
                wireframeMeshLineThickness: stroke.wireframeMeshLineThickness,
                wireframePointRadius: stroke.wireframePointRadius,
                wireframePointOpacity: stroke.wireframePointOpacity,
                wireframePointColor: stroke.wireframePointColor,
                wireframeAnimationSpeed: stroke.wireframeAnimationSpeed,
                wireframeAnimationAmount: stroke.wireframeAnimationAmount,
                wireframeIsClosed: stroke.wireframeIsClosed, // New: Save wireframeIsClosed
                wireframeMaxMeshLength: stroke.wireframeMaxMeshLength, // New: Save max mesh length
                wireframeGradientMesh: stroke.wireframeGradientMesh, // New: Save gradient mesh setting
                wireframeGradientMeshBoostFactor: stroke.wireframeGradientMeshBoostFactor, // New: Save gradient mesh boost factor
                // Sketchy specific
                jitterAmount: stroke.jitterAmount,
                jitterDensity: stroke.jitterDensity,
                animationInterval: stroke.animationInterval,
                // Do not save lastAnimationTime or needsJitterUpdate, they are transient
            })),
            historyIndex: state.historyIndex, // This is just an indicator for the current state, not for reconstructing full history
            panOffset: state.panOffset,
            zoom: state.zoom,
            activeTool: state.activeTool, // Save active tool
            
            // Save brush preset data and active preset ID
            brushPresets: state.brushPresets, // Save all defined presets
            activeBrushPresetId: state.activeBrushPresetId, // Save the ID of the currently active preset
            version: state.version, // Save the state version
            paletteColors: state.paletteColors, // Save custom palette colors
            selectedSwatchIndex: state.selectedSwatchIndex, // Save which swatch is active
            activeColor: state.brush.color, // Save the actual current color as a fallback
            renderMode: state.renderMode, // Save current render mode (bitmap or vector)
            
            // Save Image Layers
            images: state.images.map(img => ({
                id: img.id,
                url: img.url,
                x: img.x,
                y: img.y,
                scaleX: img.scaleX,
                scaleY: img.scaleY,
                rotation: img.rotation,
                opacity: img.opacity,
                visible: img.visible,
                locked: img.locked,
                width: img.width,
                height: img.height
                // (Don't save img.element, it's transient)
            })),

            canvasSettings: { // Save canvas settings
                backgroundColor: state.canvasSettings.backgroundColor,
                backgroundType: state.canvasSettings.backgroundType,
                backgroundSpacing: state.canvasSettings.backgroundSpacing,
                backgroundLineColor: state.canvasSettings.backgroundLineColor,
                backgroundLineWidth: state.canvasSettings.backgroundLineWidth,
            }
        };
        // Use structuredClone to create a deep copy for saving to localStorage
        // though JSON.stringify already deep clones. The structuredClone here is for safety
        // and consistency, but the main performance benefit for history is in canvas.js.
        localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
        console.log('Canvas state saved.');
        showStatus('Saved');
    } catch (error) {
        console.error("Could not save canvas state:", error);
        // More specific error for quota exceeded
        if (error.code === 22 || error.name === 'QuotaExceededError') {
            showStatus('Storage full! Cannot save.', true);
            console.error('Local Storage Quota Exceeded. History may be too large.');
        } else {
            showStatus('Error saving', true);
        }
    }
}

export function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveStateToLocalStorage, SAVE_DELAY);
}

export function loadState() {
    try {
        const savedStateJSON = localStorage.getItem(SAVE_KEY);
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);

            // Apply saved state
            if (savedState.strokes) {
                // Ensure loaded strokes have 'bitmap: null' as it's not serializable
                state.strokes = savedState.strokes.map(stroke => ({ ...stroke, bitmap: null }));
            }
            if (savedState.panOffset) state.panOffset = savedState.panOffset;
            if (savedState.zoom) state.zoom = savedState.zoom;
            if (savedState.activeTool) state.activeTool = savedState.activeTool; // Load active tool
            
            // Check for state version and handle migrations if necessary
            const savedVersion = savedState.version || 0;
            const currentVersion = state.version || 0;

            // Load brush presets and set active preset
            if (savedState.brushPresets) {
                // Iterate over saved presets and merge them with existing or default definitions
                for (const presetId in savedState.brushPresets) {
                    const savedPreset = savedState.brushPresets[presetId];

                    // FORCED REMOVAL: 'Open Wireframe' is no longer supported/wanted
                    if (presetId === 'wireframe-open' || savedPreset.name === 'Open Wireframe') {
                        continue; 
                    }

                    if (state.brushPresets[presetId]) {
                        // Always ignore the saved 'name' property to ensure new hardcoded names take effect
                        const sanitizedSavedPreset = { ...savedPreset };
                        delete sanitizedSavedPreset.name;
                        delete sanitizedSavedPreset.color;
                        
                        // If it's a default preset and version is older, we might want to be selective.
                        // Force update 'wireframe-hull' if version < 6
                        if (presetId === 'wireframe-hull' && savedVersion < 6) {
                            // Don't merge user changes for Hull if we are upgrading its core definition
                            continue; 
                        }
                        
                        // Merge saved values into current default definition
                        state.brushPresets[presetId] = { ...state.brushPresets[presetId], ...sanitizedSavedPreset };
                    } else {
                        // It's a custom preset from the saved state.
                        const sanitizedSavedPreset = { ...savedPreset };
                        delete sanitizedSavedPreset.color;
                        state.brushPresets[presetId] = { ...state.brushPresets['pen-default'], ...sanitizedSavedPreset };
                    }
                }
            }
            
            if (savedState.activeBrushPresetId && state.brushPresets[savedState.activeBrushPresetId]) {
                state.activeBrushPresetId = savedState.activeBrushPresetId;
            } else if (savedState.activeBrushPresetId === 'wireframe-open') {
                 // Migration for old wireframe-open users
                 state.activeBrushPresetId = 'wireframe-hull';
            } else {
                state.activeBrushPresetId = 'pen-default'; // Fallback
            }

            // Apply saved palette
            if (savedState.paletteColors) state.paletteColors = savedState.paletteColors;
            if (savedState.selectedSwatchIndex !== undefined) state.selectedSwatchIndex = savedState.selectedSwatchIndex;
            if (savedState.renderMode) state.renderMode = savedState.renderMode;

            // Load image layers
            if (savedState.images) {
                state.images = savedState.images.map(imgData => {
                    const img = { ...imgData, element: null };
                    // Pre-load the image element from the saved URL
                    const imageEl = new Image();
                    imageEl.src = img.url;
                    img.element = imageEl;
                    // Note: Drawing loop will catch this once element.complete is true
                    return img;
                });
            }

            // Populate state.brush with a deep copy of the active preset
            state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);

            // Restore color: Priority: saved activeColor > active swatch > #000000
            if (savedState.activeColor) {
                state.brush.color = savedState.activeColor;
            } else if (state.selectedSwatchIndex !== null && state.paletteColors[state.selectedSwatchIndex]) {
                state.brush.color = state.paletteColors[state.selectedSwatchIndex];
            } else {
                state.brush.color = '#000000';
            }

            // Apply canvas settings
            if (savedState.canvasSettings) {
                if (savedState.canvasSettings.backgroundColor) state.canvasSettings.backgroundColor = savedState.canvasSettings.backgroundColor;
                if (savedState.canvasSettings.backgroundType) state.canvasSettings.backgroundType = savedState.canvasSettings.backgroundType;
                if (savedState.canvasSettings.backgroundSpacing) state.canvasSettings.backgroundSpacing = savedState.canvasSettings.backgroundSpacing;
                if (savedState.canvasSettings.backgroundLineColor) state.canvasSettings.backgroundLineColor = savedState.canvasSettings.backgroundLineColor;
                if (savedState.canvasSettings.backgroundLineWidth) state.canvasSettings.backgroundLineWidth = savedState.canvasSettings.backgroundLineWidth;
            }

            console.log('Canvas state loaded from Local Storage.');
        } else {
             // If no saved state, ensure state.brush is initialized from the default preset
            state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);
        }
        
        // Re-initialize history based on loaded strokes or empty canvas
        state.history = [];
        // Use structuredClone here too for consistency, ensure non-bitmap properties are copied
        state.history.push(structuredClone(state.strokes.map(s => ({
            points: s.points, color: s.color, opacity: s.opacity,
            tipShape: s.tipShape, minSizeFactor: s.minSizeFactor, nonCompoundingOpacity: s.nonCompoundingOpacity,
            type: s.type, // Include stroke type in history
            pixelSize: s.pixelSize, // Include pixel size in history
            enableSmoothing: s.enableSmoothing,
            smoothingFactor: s.smoothingFactor,
            wireframeMeshOpacity: s.wireframeMeshOpacity,
            wireframeLineOpacity: s.wireframeLineOpacity,
            wireframeHullLineThickness: s.wireframeHullLineThickness,
            wireframeMeshLineThickness: s.wireframeMeshLineThickness,
            wireframePointRadius: s.wireframePointRadius,
            wireframePointOpacity: s.wireframePointOpacity,
            wireframePointColor: s.wireframePointColor,
            wireframeAnimationSpeed: s.wireframeAnimationSpeed,
            wireframeAnimationAmount: s.wireframeAnimationAmount,
            wireframeIsClosed: s.wireframeIsClosed, // New: Include wireframeIsClosed in history
            wireframeMaxMeshLength: s.wireframeMaxMeshLength, // New: Include wireframeMaxMeshLength in history
            wireframeGradientMesh: s.wireframeGradientMesh, // New: Include gradient mesh setting in history
            wireframeGradientMeshBoostFactor: s.wireframeGradientMeshBoostFactor, // New: Include gradient mesh boost factor in history
            jitterAmount: s.jitterAmount,
            jitterDensity: s.jitterDensity,
            animationInterval: s.animationInterval,
        }))));
        state.historyIndex = 0;
        
    } catch (error) {
        console.error("Could not load canvas state:", error);
        // On error, ensure history is initialized correctly
        state.history = [];
        state.history.push([]); // Start with an empty canvas state
        state.historyIndex = 0;
        // Ensure brush is at least the default pen on error
        state.activeBrushPresetId = 'pen-default';
        state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);
    }
}
