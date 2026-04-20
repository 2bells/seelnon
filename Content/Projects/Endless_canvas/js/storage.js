import { state } from './state.js';
import { getImageAsset, getDBSize, saveCanvasState, getCanvasState, clearAllAssets } from './db.js';

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

async function saveState() {
    try {
        // --- 1. PROJECT DATA (Heavy, goes to IndexedDB) ---
        const projectData = {
            strokes: state.strokes.map(stroke => ({
                // Optimization: Round coordinates to 1 decimal place
                points: stroke.points.map(p => ({
                    x: Math.round(p.x * 10) / 10,
                    y: Math.round(p.y * 10) / 10,
                    pressure: Math.round((p.pressure || 1.0) * 100) / 100,
                    size: Math.round(p.size * 10) / 10
                })),
                bounds: stroke.bounds,
                color: stroke.color,
                opacity: stroke.opacity,
                tipShape: stroke.tipShape,
                minSizeFactor: stroke.minSizeFactor,
                nonCompoundingOpacity: stroke.nonCompoundingOpacity,
                type: stroke.type,
                pixelSize: stroke.pixelSize,
                enableSmoothing: stroke.enableSmoothing,
                smoothingFactor: stroke.smoothingFactor,
                wireframeMeshOpacity: stroke.wireframeMeshOpacity,
                wireframeLineOpacity: stroke.wireframeLineOpacity,
                wireframeHullLineThickness: stroke.wireframeHullLineThickness,
                wireframeMeshLineThickness: stroke.wireframeMeshLineThickness,
                wireframePointRadius: stroke.wireframePointRadius,
                wireframePointOpacity: stroke.wireframePointOpacity,
                wireframePointColor: stroke.wireframePointColor,
                wireframeAnimationSpeed: stroke.wireframeAnimationSpeed,
                wireframeAnimationAmount: stroke.wireframeAnimationAmount,
                wireframeIsClosed: stroke.wireframeIsClosed,
                wireframeMaxMeshLength: stroke.wireframeMaxMeshLength,
                wireframeGradientMesh: stroke.wireframeGradientMesh,
                wireframeGradientMeshBoostFactor: stroke.wireframeGradientMeshBoostFactor,
                jitterAmount: stroke.jitterAmount,
                jitterDensity: stroke.jitterDensity,
                animationInterval: stroke.animationInterval,
            })),
            historyIndex: state.historyIndex,
            panOffset: state.panOffset,
            zoom: state.zoom,
            // Images metadata (Heavy bytes stay in 'imageAssets' store)
            images: state.images.map(img => ({
                id: img.id,
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
            }))
        };

        // Save heavy project data to the "Drive" (IndexedDB)
        await saveCanvasState('currentProject', projectData);

        // --- 2. PRESETS & UI (Light, stays in LocalStorage for instant load) ---
        const uiState = {
            activeTool: state.activeTool,
            brushPresets: state.brushPresets,
            activeBrushPresetId: state.activeBrushPresetId,
            version: state.version,
            paletteColors: state.paletteColors,
            selectedSwatchIndex: state.selectedSwatchIndex,
            activeColor: state.brush.color,
            renderMode: state.renderMode,
            canvasSettings: state.canvasSettings
        };

        localStorage.setItem(SAVE_KEY, JSON.stringify(uiState));
        
        console.log('Project saved (DB + LocalStorage).');
        showStatus('Saved');
        window.dispatchEvent(new CustomEvent('storageUsageChanged'));
    } catch (error) {
        console.error("Could not save canvas state:", error);
        showStatus('Save Error', true);
    }
}

export function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, SAVE_DELAY);
}

export async function clearAllProjectData() {
    clearTimeout(saveTimeout);
    await clearAllAssets();
    console.log('Project Drive and Asset Drive cleared.');
}

export async function loadState() {
    try {
        // --- 1. LOAD UI SHELL (LocalStorage) ---
        const savedUIStateJSON = localStorage.getItem(SAVE_KEY);
        if (savedUIStateJSON) {
            const savedUIState = JSON.parse(savedUIStateJSON);

            if (savedUIState.activeTool) state.activeTool = savedUIState.activeTool;
            
            const savedVersion = savedUIState.version || 0;

            // Load brush presets
            if (savedUIState.brushPresets) {
                for (const presetId in savedUIState.brushPresets) {
                    const savedPreset = savedUIState.brushPresets[presetId];
                    if (presetId === 'wireframe-open' || savedPreset.name === 'Open Wireframe') continue; 

                    if (state.brushPresets[presetId]) {
                        const sanitizedSavedPreset = { ...savedPreset };
                        delete sanitizedSavedPreset.name;
                        delete sanitizedSavedPreset.color;
                        if (presetId === 'wireframe-hull' && savedVersion < 6) continue; 
                        state.brushPresets[presetId] = { ...state.brushPresets[presetId], ...sanitizedSavedPreset };
                    } else {
                        const sanitizedSavedPreset = { ...savedPreset };
                        delete sanitizedSavedPreset.color;
                        state.brushPresets[presetId] = { ...state.brushPresets['pen-default'], ...sanitizedSavedPreset };
                    }
                }
            }
            
            if (savedUIState.activeBrushPresetId && state.brushPresets[savedUIState.activeBrushPresetId]) {
                state.activeBrushPresetId = savedUIState.activeBrushPresetId;
            } else {
                state.activeBrushPresetId = 'pen-default';
            }

            if (savedUIState.paletteColors) state.paletteColors = savedUIState.paletteColors;
            if (savedUIState.selectedSwatchIndex !== undefined) state.selectedSwatchIndex = savedUIState.selectedSwatchIndex;
            if (savedUIState.renderMode) state.renderMode = savedUIState.renderMode;

            state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);

            if (savedUIState.activeColor) {
                state.brush.color = savedUIState.activeColor;
            } else if (state.selectedSwatchIndex !== null && state.paletteColors[state.selectedSwatchIndex]) {
                state.brush.color = state.paletteColors[state.selectedSwatchIndex];
            } else {
                state.brush.color = '#000000';
            }

            if (savedUIState.canvasSettings) {
                state.canvasSettings = { ...state.canvasSettings, ...savedUIState.canvasSettings };
            }
        } else {
            state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);
        }

        // --- 2. LOAD PROJECT DATA (IndexedDB) ---
        const projectData = await getCanvasState('currentProject');
        if (projectData) {
            if (projectData.strokes) {
                state.strokes = projectData.strokes.map(stroke => ({ ...stroke, bitmap: null }));
            }
            if (projectData.panOffset) state.panOffset = projectData.panOffset;
            if (projectData.zoom) state.zoom = projectData.zoom;
            if (projectData.historyIndex !== undefined) state.historyIndex = projectData.historyIndex;

            if (projectData.images) {
                state.images = await Promise.all(projectData.images.map(async imgData => {
                    const img = { ...imgData, url: null, element: null };
                    try {
                        const cachedUrl = await getImageAsset(img.id);
                        if (cachedUrl) {
                            img.url = cachedUrl;
                            const imageEl = new Image();
                            imageEl.src = cachedUrl;
                            img.element = imageEl;
                        }
                    } catch (e) {
                        console.error("Failed to load image asset from IDB:", e);
                    }
                    return img;
                }));
            }
        }

        window.dispatchEvent(new CustomEvent('storageUsageChanged'));

        // Re-initialize history based on loaded strokes or empty canvas
        state.history = [];
        state.history.push(structuredClone(state.strokes.map(s => ({
            points: s.points, color: s.color, opacity: s.opacity,
            tipShape: s.tipShape, minSizeFactor: s.minSizeFactor, nonCompoundingOpacity: s.nonCompoundingOpacity,
            type: s.type, 
            pixelSize: s.pixelSize, 
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
            wireframeIsClosed: s.wireframeIsClosed,
            wireframeMaxMeshLength: s.wireframeMaxMeshLength,
            wireframeGradientMesh: s.wireframeGradientMesh,
            wireframeGradientMeshBoostFactor: s.wireframeGradientMeshBoostFactor,
            jitterAmount: s.jitterAmount,
            jitterDensity: s.jitterDensity,
            animationInterval: s.animationInterval,
        }))));
        state.historyIndex = 0;
        
    } catch (error) {
        console.error("Could not load canvas state:", error);
        state.history = [[]];
        state.historyIndex = 0;
        state.activeBrushPresetId = 'pen-default';
        state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);
    }
}

export async function getStorageUsageInfo() {
    try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            if (key && value) {
                // Characters in localStorage are internally stored as UTF-16, so 2 bytes per char
                total += (key.length + value.length) * 2;
            }
        }
        
        const dbSize = await getDBSize();
        
        const usedMB = total / (1024 * 1024);
        const dbMB = dbSize / (1024 * 1024);
        const limitMB = 5; // Standard localStorage limit
        const percentage = (usedMB / limitMB) * 100;
        
        return {
            used: usedMB.toFixed(2),
            limit: limitMB,
            percentage: Math.min(100, percentage).toFixed(1),
            dbUsed: dbMB.toFixed(2)
        };
    } catch (e) {
        return { used: "0.00", limit: 5, percentage: "0.0", dbUsed: "0.00" };
    }
}
