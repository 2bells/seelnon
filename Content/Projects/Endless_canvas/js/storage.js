import { state } from './state.js';
import { getImageAsset, getDBSize, saveCanvasState, getCanvasState, clearAllAssets, saveProjectMeta, getProjectMeta, saveSector, getSector } from './db.js';

const SAVE_KEY = 'endlessCanvasSettings'; // General settings like palette, presets
const PROJECT_ID_KEY = 'endlessCanvasActiveProjectId';
const SAVE_DELAY = 5000;
const SECTOR_SIZE = 4096; // 4K world units for storage sectors

let saveTimeout = null;
let statusTimeout = null;
let lastPreviewTime = 0;
let isSaving = false;
const PREVIEW_THROTTLE = 60000; // Only generate high-res preview every 60 seconds during auto-save

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

let sectorMap = new Map(); // Global map of sectors for current project: "sx,sy" -> [strokes]
let dirtySectors = new Set(); // Tracks which sectors need saving

export function markSectorDirty(stroke) {
    const startSx = Math.floor(stroke.bounds.minX / SECTOR_SIZE);
    const endSx = Math.floor(stroke.bounds.maxX / SECTOR_SIZE);
    const startSy = Math.floor(stroke.bounds.minY / SECTOR_SIZE);
    const endSy = Math.floor(stroke.bounds.maxY / SECTOR_SIZE);

    for (let sx = startSx; sx <= endSx; sx++) {
        for (let sy = startSy; sy <= endSy; sy++) {
            dirtySectors.add(`${sx},${sy}`);
        }
    }
}

export async function saveState(forcePreview = false) {
    if (isSaving && !forcePreview) return;
    isSaving = true;
    try {
        const projectId = state.currentProjectId || 'default-project';

        // --- 1. INCREMENTAL SPATIAL STORAGE ---
        // Only process sectors that were marked dirty
        if (dirtySectors.size > 0) {
            const savePromises = [];
            
            // Re-map ONLY affected sectors
            const affectedSectors = Array.from(dirtySectors);
            affectedSectors.forEach(key => {
                const [sx, sy] = key.split(',').map(Number);
                
                // Find all strokes that intersect this sector
                const sectorStrokes = state.strokes.filter(s => {
                    const sStartSx = Math.floor(s.bounds.minX / SECTOR_SIZE);
                    const sEndSx = Math.floor(s.bounds.maxX / SECTOR_SIZE);
                    const sStartSy = Math.floor(s.bounds.minY / SECTOR_SIZE);
                    const sEndSy = Math.floor(s.bounds.maxY / SECTOR_SIZE);
                    return sx >= sStartSx && sx <= sEndSx && sy >= sStartSy && sy <= sEndSy;
                }).map(s => {
                    const { bitmap, pathObject, bounds, animatedPoints, lastAnimationTime, needsDelaunayUpdate, cachedDelaunay, cachedDelaunayPoints, previewJitterPasses, jitterPasses, needsJitterUpdate, ...stripped } = s;
                    return stripped;
                });

                if (sectorStrokes.length > 0) {
                    savePromises.push(saveSector(projectId, sx, sy, sectorStrokes));
                }
            });

            await Promise.all(savePromises);
            dirtySectors.clear();
        }

        // --- 2. PROJECT MANIFEST ---
        // We still need to know which sectors have data to load them later
        const activeSectorsSet = new Set();
        state.strokes.forEach(s => {
            const startSx = Math.floor(s.bounds.minX / SECTOR_SIZE);
            const endSx = Math.floor(s.bounds.maxX / SECTOR_SIZE);
            const startSy = Math.floor(s.bounds.minY / SECTOR_SIZE);
            const endSy = Math.floor(s.bounds.maxY / SECTOR_SIZE);
            for (let sx = startSx; sx <= endSx; sx++) {
                for (let sy = startSy; sy <= endSy; sy++) {
                    activeSectorsSet.add(`${sx},${sy}`);
                }
            }
        });

        const projectData = {
            activeSectors: Array.from(activeSectorsSet),
            historyIndex: state.historyIndex,
            panOffset: state.panOffset,
            zoom: state.zoom,
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
            })),
            canvasSettings: state.canvasSettings
        };

        // Save project manifest
        await saveCanvasState(projectId, projectData);

        // Update Project Meta (timestamp and preview) - Throttled unless forced
        const now = Date.now();
        if (forcePreview || (now - lastPreviewTime > PREVIEW_THROTTLE)) {
            await updateProjectPreview(projectId);
            lastPreviewTime = now;
        } else {
            // Still update the timestamp at least
            const existingMeta = await getProjectMeta(projectId);
            if (existingMeta) {
                existingMeta.updatedAt = now;
                await saveProjectMeta(existingMeta);
            }
        }

        // --- 2. GLOBAL SETTINGS & UI (Light, stays in LocalStorage) ---
        const uiState = {
            activeTool: state.activeTool,
            brushPresets: state.brushPresets,
            activeBrushPresetId: state.activeBrushPresetId,
            version: state.version,
            paletteColors: state.paletteColors,
            selectedSwatchIndex: state.selectedSwatchIndex,
            activeColor: state.brush.color,
            renderMode: state.renderMode
        };

        localStorage.setItem(SAVE_KEY, JSON.stringify(uiState));
        localStorage.setItem(PROJECT_ID_KEY, projectId); // Keep track of last opened project
        
        console.log(`Project ${projectId} saved.`);
        showStatus('Saved');
        window.dispatchEvent(new CustomEvent('storageUsageChanged'));
    } catch (error) {
        console.error("Could not save canvas state:", error);
        showStatus('Save Error', true);
    } finally {
        isSaving = false;
    }
}

async function updateProjectPreview(projectId) {
    // Generate a high-res preview for the project card
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;

    const previewCanvas = document.createElement('canvas');
    const pWidth = 800;
    const pHeight = 500; // 16:10 aspect
    previewCanvas.width = pWidth;
    previewCanvas.height = pHeight;
    const pCtx = previewCanvas.getContext('2d');

    // Fill white background
    pCtx.fillStyle = state.canvasSettings.backgroundColor || '#F7F7F7';
    pCtx.fillRect(0, 0, pWidth, pHeight);

    // Draw the current viewport scaled down
    if (canvas.width > 0 && canvas.height > 0) {
        pCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, pWidth, pHeight);
    }

    const previewUrl = previewCanvas.toDataURL('image/jpeg', 0.8);
    
    // Get existing meta if any
    const existingMeta = await getProjectMeta(projectId);
    const meta = {
        id: projectId,
        name: existingMeta?.name || (projectId === 'default-project' ? 'Untitled Masterpiece' : 'New Project'),
        updatedAt: Date.now(),
        preview: previewUrl
    };
    await saveProjectMeta(meta);
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

export async function loadState(projectId = null) {
    try {
        // --- 1. LOAD GLOBAL SETTINGS (LocalStorage) ---
        const savedUIStateJSON = localStorage.getItem(SAVE_KEY);
        if (savedUIStateJSON) {
            const savedUIState = JSON.parse(savedUIStateJSON);
            const savedVersion = savedUIState.version || 0;

            if (savedUIState.activeTool) state.activeTool = savedUIState.activeTool;
            
            if (savedUIState.brushPresets) {
                for (const presetId in savedUIState.brushPresets) {
                    const savedPreset = savedUIState.brushPresets[presetId];
                    if (presetId === 'wireframe-open' || savedPreset.name === 'Open Wireframe') continue; 

                    if (state.brushPresets[presetId]) {
                        const sanitizedSavedPreset = { ...savedPreset };
                        delete sanitizedSavedPreset.name;
                        delete sanitizedSavedPreset.color;
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
            }

            if (savedUIState.paletteColors) state.paletteColors = savedUIState.paletteColors;
            if (savedUIState.selectedSwatchIndex !== undefined) state.selectedSwatchIndex = savedUIState.selectedSwatchIndex;
            if (savedUIState.renderMode) state.renderMode = savedUIState.renderMode;

            state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);

            if (savedUIState.activeColor) {
                state.brush.color = savedUIState.activeColor;
            } else {
                state.brush.color = '#000000';
            }
        } else {
            // Initial run fallback
            state.brush = structuredClone(state.brushPresets[state.activeBrushPresetId]);
        }

        // Determine which project to load
        const lastProjectId = localStorage.getItem(PROJECT_ID_KEY);
        const targetProjectId = projectId || lastProjectId || 'default-project';
        state.currentProjectId = targetProjectId;

        // Reset volatile project state BEFORE loading
        state.strokes = [];
        state.images = [];
        state.panOffset = { x: 0, y: 0 };
        state.zoom = 1;
        state.history = [[]];
        state.historyIndex = 0;

        // --- 2. LOAD PROJECT DATA (IndexedDB) ---
        let projectData = await getCanvasState(targetProjectId);
        
        // MIGRATION: If default-project is empty, try loading the legacy 'currentProject' key
        // This also handles the older monolithic 'strokes' format by converting it on first load.
        if (!projectData && targetProjectId === 'default-project') {
            console.log("Migrating legacy 'currentProject' data to 'default-project'...");
            projectData = await getCanvasState('currentProject');
            if (projectData) {
                // Save it immediately to the new key
                await saveCanvasState('default-project', projectData);
                // Also create initial meta for it if it's the first time
                const meta = {
                    id: 'default-project',
                    name: 'Untitled Masterpiece',
                    updatedAt: Date.now(),
                    preview: null
                };
                await saveProjectMeta(meta);
            }
        }

        if (projectData) {
            // Load strokes from sectors if they exist, or fallback to monolithic for migration
            if (projectData.activeSectors) {
                const strokeMap = new Map(); // Use map to deduplicate strokes touching multiple sectors
                const sectorPromises = projectData.activeSectors.map(key => {
                    const [sx, sy] = key.split(',').map(Number);
                    return getSector(targetProjectId, sx, sy);
                });
                
                const sectors = await Promise.all(sectorPromises);
                sectors.forEach(sectorStrokes => {
                    if (sectorStrokes) {
                        sectorStrokes.forEach(s => {
                            // We need a stable ID to deduplicate. Since we don't have one,
                            // we'll use a checksum of points if missing, or just rely on 
                            // the fact that we're re-architecting. 
                            // Let's add a temporary ID property to strokes during save if missing.
                            // For loading, we'll just use the first point as a crude key.
                            const id = s.id || `${s.points[0].x},${s.points[0].y},${s.points.length}`;
                            strokeMap.set(id, s);
                        });
                    }
                });
                state.strokes = Array.from(strokeMap.values()).map(s => ({ ...s, bitmap: null }));
            } else if (projectData.strokes) {
                // Monolithic migration path
                state.strokes = projectData.strokes.map(stroke => ({ ...stroke, bitmap: null }));
            }
            if (projectData.panOffset) state.panOffset = projectData.panOffset;
            if (projectData.zoom) state.zoom = projectData.zoom;
            if (projectData.historyIndex !== undefined) state.historyIndex = projectData.historyIndex;

            if (projectData.canvasSettings) {
                state.canvasSettings = { ...state.canvasSettings, ...projectData.canvasSettings };
            }

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
        window.dispatchEvent(new CustomEvent('projectLoaded')); // Useful for UI updates

        // Re-initialize history
        state.history = [];
        state.history.push(structuredClone(state.strokes.map(s => {
            const { bitmap, pathObject, ...rest } = s; return rest;
        })));
        state.historyIndex = 0;
        
    } catch (error) {
        console.error("Could not load canvas state:", error);
    }
}


export async function getStorageUsageInfo() {
    try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            if (key && value) {
                total += (key.length + value.length) * 2;
            }
        }
        
        const projectId = state.currentProjectId || 'default-project';
        const dbSize = await getDBSize();
        const projectSize = await getDBSize(projectId);
        
        const usedMB = total / (1024 * 1024);
        const dbMB = dbSize / (1024 * 1024);
        const projMB = projectSize / (1024 * 1024);
        const limitMB = 5;
        const percentage = (usedMB / limitMB) * 100;
        
        return {
            used: usedMB.toFixed(2),
            limit: limitMB,
            percentage: Math.min(100, percentage).toFixed(1),
            dbUsed: dbMB.toFixed(2),
            projectUsed: projMB.toFixed(2)
        };
    } catch (e) {
        return { used: "0.00", limit: 5, percentage: "0.0", dbUsed: "0.00", projectUsed: "0.00" };
    }
}
