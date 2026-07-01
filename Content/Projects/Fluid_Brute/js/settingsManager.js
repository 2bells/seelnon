'use strict';

export const DEFAULT_TOOL_SETTINGS = {
    paint_bristles: {
        bristleCount: 50,
        bristleLength: 2.5,
        bristleStiffness: 0.4,
        bristleJitter: 0.5,
        bristleScatter: 1.0,
        brushScale: 35,
        fluidity: 0.70,
        paintHeight: 1.0,
        opacity: 1.0
    },
    paint_oil: {
        bristleCount: 15,
        bristleLength: 0.5,
        bristleStiffness: 0.1,
        bristleJitter: 0.6,
        bristleScatter: 0.30,
        brushScale: 20,
        fluidity: 0.50,
        paintHeight: 2.2,
        opacity: 1.0
    },
    ink: {
        bristleCount: 1,
        bristleLength: 0.1,
        bristleStiffness: 0.2,
        bristleJitter: 0.0,
        bristleScatter: 0.0,
        brushScale: 12,
        fluidity: 0.55,
        paintHeight: 0.1,
        opacity: 1.0
    },
    dry_chalk: {
        bristleCount: 30,
        bristleLength: 1.0,
        bristleStiffness: 0.8,
        bristleJitter: 1.2,
        bristleScatter: 0.3,
        brushScale: 12,
        fluidity: 0.55,
        paintHeight: 0.2,
        opacity: 0.6
    },
    dry_pencil: {
        bristleCount: 1,
        bristleLength: 1.0,
        bristleStiffness: 1.0,
        bristleJitter: 0.0,
        bristleScatter: 0.0,
        brushScale: 3.5,
        fluidity: 0.0,
        paintHeight: 0.1,
        opacity: 0.5
    },
    eraser_bristles: {
        bristleCount: 40,
        bristleLength: 4.5,
        bristleStiffness: 0.3,
        bristleJitter: 0.5,
        bristleScatter: 1.0,
        brushScale: 40,
        fluidity: 0.75,
        paintHeight: 1.0,
        opacity: 1.0
    },
    eraser_scraper: {
        bristleCount: 1,
        bristleLength: 4.5,
        bristleStiffness: 0.9,
        bristleJitter: 0.0,
        bristleScatter: 0.1,
        brushScale: 40,
        fluidity: 0.40,
        paintHeight: 1.0,
        opacity: 1.0
    },
    smudge_smudge: {
        bristleCount: 50,
        bristleLength: 3.5,
        bristleStiffness: 0.4,
        bristleJitter: 0.8,
        bristleScatter: 0.5,
        brushScale: 25,
        fluidity: 0.90,
        paintHeight: 1.0,
        opacity: 1.0
    },
    smudge_blur: {
        bristleCount: 1,
        bristleLength: 3.5,
        bristleStiffness: 0.5,
        bristleJitter: 0.0,
        bristleScatter: 0.1,
        brushScale: 45,
        fluidity: 1.0,
        paintHeight: 1.0,
        opacity: 1.0
    },
    liquify: {
        bristleCount: 1,
        bristleLength: 1.0,
        bristleStiffness: 1.0,
        bristleJitter: 0.0,
        bristleScatter: 0.0,
        brushScale: 40,
        fluidity: 0.75,
        paintHeight: 1.0,
        opacity: 1.0,
        liquifyIntensity: 0.7,
        liquifyFalloff: 2.0
    },
    select: {
        bristleCount: 1,
        bristleLength: 1.0,
        bristleStiffness: 1.0,
        bristleJitter: 0.0,
        bristleScatter: 0.0,
        brushScale: 40,
        fluidity: 0.75,
        paintHeight: 1.0,
        opacity: 1.0
    }
};

export function getCurrentSettingsKey(paint, toolId) {
    if (toolId === 'paint') {
        return 'paint_' + (paint.paintType || 'bristles');
    }
    if (toolId === 'eraser') {
        return 'eraser_' + (paint.eraserType || 'bristles');
    }
    if (toolId === 'smudge') {
        return 'smudge_' + (paint.smudgeType || 'smudge');
    }
    if (toolId === 'dry') {
        return 'dry_' + (paint.dryType || 'chalk');
    }
    return toolId;
}

export function getToolSettings(paint, toolId) {
    if (!toolId) return null;
    var key = paint.getCurrentSettingsKey(toolId);
    if (!paint.toolSettingsCache) {
        paint.toolSettingsCache = {};
    }
    if (paint.toolSettingsCache[key]) {
        return paint.toolSettingsCache[key];
    }
    var cacheKey = 'tool_settings_' + key;
    try {
        var cached = localStorage.getItem(cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            paint.toolSettingsCache[key] = parsed;
            return parsed;
        }
    } catch (e) {
        console.error('Error loading settings from localStorage:', e);
    }

    // Return a copy of the default settings
    var defaults = DEFAULT_TOOL_SETTINGS[key] || DEFAULT_TOOL_SETTINGS[toolId];
    if (defaults) {
        var copied = Object.assign({}, defaults);
        paint.toolSettingsCache[key] = copied;
        return copied;
    }
    return null;
}

export function saveToolSettings(paint, toolId, settings) {
    if (!toolId || !settings) return;
    var key = paint.getCurrentSettingsKey(toolId);
    if (!paint.toolSettingsCache) {
        paint.toolSettingsCache = {};
    }
    paint.toolSettingsCache[key] = settings;
    var cacheKey = 'tool_settings_' + key;
    try {
        localStorage.setItem(cacheKey, JSON.stringify(settings));
    } catch (e) {
        console.error('Error saving settings to localStorage:', e);
    }
}

export function updateCurrentToolSetting(paint, key, value) {
    if (paint.currentTool === 'colorpick') return;
    var settings = paint.getToolSettings(paint.currentTool);
    if (settings) {
        settings[key] = value;
        paint.saveToolSettings(paint.currentTool, settings);
    }
    paint.needsRedraw = true;
}

export function applyToolSettings(paint, toolId, MIN_BRUSH_SCALE, MAX_BRUSH_SCALE, MIN_BRISTLE_COUNT, MAX_BRISTLE_COUNT, Utilities) {
    if (toolId === 'colorpick') return;
    var settings = paint.getToolSettings(toolId);
    if (!settings) return;

    // Apply properties to simulator and brush
    paint.simulator.fluidity = settings.fluidity;
    paint.brush.setBristleCount(settings.bristleCount);
    paint.brush.bristleLength = settings.bristleLength;
    paint.brush.bristleStiffness = settings.bristleStiffness !== undefined ? settings.bristleStiffness : 0.3;
    paint.brush.bristleJitter = settings.bristleJitter;
    paint.brush.bristleScatter = settings.bristleScatter !== undefined ? settings.bristleScatter : 1.0;
    paint.brushScale = settings.brushScale;
    paint.paintHeight = settings.paintHeight !== undefined ? settings.paintHeight : 1.0;

    // Apply opacity
    paint.brushColorHSVA[3] = settings.opacity !== undefined ? settings.opacity : 1.0;

    // Load specific liquify parameters if applicable
    paint.liquifyIntensity = settings.liquifyIntensity !== undefined ? settings.liquifyIntensity : 0.7;
    paint.liquifyFalloff = settings.liquifyFalloff !== undefined ? settings.liquifyFalloff : 2.0;

    // Determine brushHeight based on tool type to make sure we make perfect canvas contact
    paint.updateBrushHeight();
    var initScale = paint.brushScale * (paint.zoomLevel || 1.0);
    if (!paint.brushInitialized) {
        paint.brush.initialize(paint.brushX, paint.brushY, paint.brushHeight * initScale, initScale);
        paint.brushInitialized = true;
    }

    // Update Top-Bar Slider Values silently (without triggering callbacks)
    if (paint.fluiditySlider) {
        if (toolId === 'ink') {
            paint.fluiditySlider.setMinMax(0.55, 0.95);
        } else {
            paint.fluiditySlider.setMinMax(0.1, 1.0);
        }
        paint.fluiditySlider.setValue(settings.fluidity);
    }
    if (paint.bristleCountSlider) {
        var BRISTLE_SLIDER_POWER = 2.0;
        var t = (settings.bristleCount - MIN_BRISTLE_COUNT) / (MAX_BRISTLE_COUNT - MIN_BRISTLE_COUNT);
        t = Utilities.clamp(t, 0.0, 1.0);
        var sliderValue = Math.pow(t, 1.0 / BRISTLE_SLIDER_POWER);
        paint.bristleCountSlider.setValue(sliderValue);
    }
    if (paint.brushSizeSlider) {
        if (toolId === 'liquify') {
            paint.brushSizeSlider.setMinMax(5, 2000);
        } else {
            paint.brushSizeSlider.setMinMax(MIN_BRUSH_SCALE, MAX_BRUSH_SCALE);
        }
        paint.brushSizeSlider.setValue(settings.brushScale);
    }
    if (paint.opacitySlider) {
        paint.opacitySlider.setValue(paint.brushColorHSVA[3]);
    }
    if (paint.liquifyFalloffSlider) {
        paint.liquifyFalloffSlider.setValue(paint.liquifyFalloff);
    }
    if (paint.liquifyIntensitySlider) {
        paint.liquifyIntensitySlider.setValue(paint.liquifyIntensity);
    }

    // Update Settings Window Slider Values
    if (paint.bristleLengthSlider) {
        if (toolId === 'ink') {
            paint.bristleLengthSlider.setMinMax(0.1, 0.5);
        } else {
            paint.bristleLengthSlider.setMinMax(0.1, 10.0);
        }
        paint.bristleLengthSlider.setValue(settings.bristleLength);
    }
    if (paint.bristleStiffnessSlider) {
        paint.bristleStiffnessSlider.setValue(settings.bristleStiffness !== undefined ? settings.bristleStiffness : 0.3);
    }
    if (paint.bristleJitterSlider) {
        paint.bristleJitterSlider.setValue(settings.bristleJitter);
    }
    if (paint.bristleScatterSlider) {
        paint.bristleScatterSlider.setValue(settings.bristleScatter !== undefined ? settings.bristleScatter : 1.0);
    }
    if (paint.paintHeightSlider) {
        paint.paintHeightSlider.setValue(paint.paintHeight);
    }

    // Update Labels
    paint.updateFluidityLabel(settings.fluidity);
    paint.updateBristlesLabel(settings.bristleCount);
    paint.updateSizeLabel(settings.brushScale);
    if (paint.updateOpacityLabel) paint.updateOpacityLabel(paint.brushColorHSVA[3]);
    if (paint.updateLengthLabel) paint.updateLengthLabel(settings.bristleLength);
    if (paint.updateTensionLabel) paint.updateTensionLabel(settings.bristleStiffness !== undefined ? settings.bristleStiffness : 0.3);
    if (paint.updateJitterLabel) paint.updateJitterLabel(settings.bristleJitter);
    if (paint.updateScatterLabel) paint.updateScatterLabel(settings.bristleScatter !== undefined ? settings.bristleScatter : 1.0);
    if (paint.updateHeightLabel) paint.updateHeightLabel(paint.paintHeight);
    if (paint.updateLiquifyFalloffLabel) paint.updateLiquifyFalloffLabel(paint.liquifyFalloff);
    if (paint.updateLiquifyIntensityLabel) paint.updateLiquifyIntensityLabel(paint.liquifyIntensity);

    // Show/hide relevant sliders in top bar dynamically for Liquify and Selection
    var isLiquify = (toolId === 'liquify');
    var isSelect = (toolId === 'select');
    var fluidityGrp = document.getElementById('fluidity-slider-group');
    var bristlesGrp = document.getElementById('bristles-slider-group');
    var sizeGrp = document.getElementById('size-slider-group');
    var opacityGrp = document.getElementById('opacity-slider-group');
    var falloffGrp = document.getElementById('liquify-falloff-group');
    var intensityGrp = document.getElementById('liquify-intensity-group');

    if (fluidityGrp) {
        if (isLiquify || isSelect) fluidityGrp.classList.add('hidden');
        else fluidityGrp.classList.remove('hidden');
    }
    if (bristlesGrp) {
        if (isLiquify || isSelect) bristlesGrp.classList.add('hidden');
        else bristlesGrp.classList.remove('hidden');
    }
    if (sizeGrp) {
        if (isSelect) sizeGrp.classList.add('hidden');
        else sizeGrp.classList.remove('hidden');
    }
    if (opacityGrp) {
        if (isLiquify || isSelect) opacityGrp.classList.add('hidden');
        else opacityGrp.classList.remove('hidden');
    }
    if (falloffGrp) {
        if (isLiquify) falloffGrp.classList.remove('hidden');
        else falloffGrp.classList.add('hidden');
    }
    if (intensityGrp) {
        if (isLiquify) intensityGrp.classList.remove('hidden');
        else intensityGrp.classList.add('hidden');
    }

    // Update Title in Settings Window
    var titleEl = document.getElementById('brush-params-title');
    if (titleEl) {
        titleEl.textContent = 'Brush Parameters (' + toolId.toUpperCase() + ')';
    }
    var titleSubEl = document.getElementById('brush-params-title-sub');
    if (titleSubEl) {
        titleSubEl.textContent = toolId.toUpperCase();
    }

    paint.needsRedraw = true;
}

export function scheduleDebouncedSave(paint, delayMs) {
    if (!paint.autosaveEnabled) {
        if (paint.debouncedSaveTimeout) {
            clearTimeout(paint.debouncedSaveTimeout);
            paint.debouncedSaveTimeout = null;
        }
        return;
    }
    var delay = (paint.autosaveDelay !== undefined) ? (paint.autosaveDelay * 1000) : (delayMs !== undefined ? delayMs : 3000);
    if (paint.debouncedSaveTimeout) {
        clearTimeout(paint.debouncedSaveTimeout);
    }
    paint.debouncedSaveTimeout = setTimeout(function () {
        paint.saveToIndexedDB();
        paint.debouncedSaveTimeout = null;
    }, delay);
}

function updateProjectLastSaved(projectId) {
    try {
        var request = indexedDB.open('FluidPaintDB', 1);
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readwrite');
            var store = transaction.objectStore('canvas_store');
            var getRequest = store.get('projects_list');
            getRequest.onsuccess = function (e) {
                var list = e.target.result;
                if (list && Array.isArray(list)) {
                    var found = false;
                    for (var i = 0; i < list.length; i++) {
                        if (list[i].id === projectId) {
                            list[i].lastSaved = Date.now();
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        var writeTrans = db.transaction(['canvas_store'], 'readwrite');
                        writeTrans.objectStore('canvas_store').put(list, 'projects_list');
                    }
                }
            };
        };
    } catch (err) {
        console.error(err);
    }
}

export function saveToIndexedDB(paint) {
    try {
        var pixels = paint.getPaintTextureData();
        var state = {
            pixels: pixels,
            width: paint.simulator.resolutionWidth,
            height: paint.simulator.resolutionHeight,
            paintingWidth: paint.paintingRectangle.width,
            paintingHeight: paint.paintingRectangle.height,
            paintingLeft: paint.paintingRectangle.left,
            paintingBottom: paint.paintingRectangle.bottom,
            logicalWidth: paint.logicalWidth,
            logicalHeight: paint.logicalHeight,
            zoomLevel: paint.zoomLevel,
            resolutionScale: paint.resolutionScale,
            colorModel: paint.colorModel,
            normalScale: paint.normalScale,
            roughness: paint.roughness,
            specularScale: paint.specularScale,
            lightAngle: paint.lightAngle
        };

        var projectId = paint.activeProjectId || 'default';

        var request = indexedDB.open('FluidPaintDB', 1);
        request.onupgradeneeded = function (event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains('canvas_store')) {
                db.createObjectStore('canvas_store');
            }
        };
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readwrite');
            var store = transaction.objectStore('canvas_store');
            store.put(state, 'project_state_' + projectId);
            
            updateProjectLastSaved(projectId);
        };
    } catch (e) {
        console.error('Error saving to IndexedDB:', e);
    }
}

export function loadFromIndexedDB(paint, callback) {
    try {
        var projectId = paint.activeProjectId || 'default';
        var request = indexedDB.open('FluidPaintDB', 1);
        request.onupgradeneeded = function (event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains('canvas_store')) {
                db.createObjectStore('canvas_store');
            }
        };
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readwrite');
            var store = transaction.objectStore('canvas_store');
            var getRequest = store.get('project_state_' + projectId);
            getRequest.onsuccess = function (e) {
                var state = e.target.result;
                if (state) {
                    callback(null, state);
                } else if (projectId === 'default') {
                    // Try to migrate from legacy 'current_state'
                    var getLegacy = store.get('current_state');
                    getLegacy.onsuccess = function (ev) {
                        var legacyState = ev.target.result;
                        if (legacyState) {
                            // Save to project_state_default
                            var saveTrans = db.transaction(['canvas_store'], 'readwrite');
                            saveTrans.objectStore('canvas_store').put(legacyState, 'project_state_default');
                            callback(null, legacyState);
                        } else {
                            callback(null, null);
                        }
                    };
                    getLegacy.onerror = function (ev) {
                        callback(ev.target.error, null);
                    };
                } else {
                    callback(null, null);
                }
            };
            getRequest.onerror = function (e) {
                callback(e.target.error, null);
            };
        };
        request.onerror = function (event) {
            callback(event.target.error, null);
        };
    } catch (e) {
        callback(e, null);
    }
}

export function getProjectsList(callback) {
    try {
        var request = indexedDB.open('FluidPaintDB', 1);
        request.onupgradeneeded = function (event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains('canvas_store')) {
                db.createObjectStore('canvas_store');
            }
        };
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readwrite');
            var store = transaction.objectStore('canvas_store');
            var getRequest = store.get('projects_list');
            getRequest.onsuccess = function (e) {
                var list = e.target.result;
                if (!list || !Array.isArray(list)) {
                    list = [{ id: 'default', name: 'My Painting', lastSaved: Date.now() }];
                    var writeTrans = db.transaction(['canvas_store'], 'readwrite');
                    writeTrans.objectStore('canvas_store').put(list, 'projects_list');
                }
                callback(null, list);
            };
            getRequest.onerror = function (e) {
                callback(e.target.error, null);
            };
        };
        request.onerror = function (event) {
            callback(event.target.error, null);
        };
    } catch (e) {
        callback(e, null);
    }
}

export function saveProjectsList(list, callback) {
    try {
        var request = indexedDB.open('FluidPaintDB', 1);
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readwrite');
            var store = transaction.objectStore('canvas_store');
            var putRequest = store.put(list, 'projects_list');
            putRequest.onsuccess = function () {
                if (callback) callback(null);
            };
            putRequest.onerror = function (e) {
                if (callback) callback(e.target.error);
            };
        };
        request.onerror = function (event) {
            if (callback) callback(event.target.error);
        };
    } catch (e) {
        if (callback) callback(e);
    }
}

export function deleteProjectFromIndexedDB(projectId, callback) {
    try {
        var request = indexedDB.open('FluidPaintDB', 1);
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readwrite');
            var store = transaction.objectStore('canvas_store');
            
            // Delete state and reference images
            store.delete('project_state_' + projectId);
            store.delete('reference_images_' + projectId);
            
            transaction.oncomplete = function () {
                if (callback) callback(null);
            };
            transaction.onerror = function (e) {
                if (callback) callback(e.target.error);
            };
        };
    } catch (e) {
        if (callback) callback(e);
    }
}

export function calculateOverallStorageUsage(callback) {
    try {
        var request = indexedDB.open('FluidPaintDB', 1);
        request.onupgradeneeded = function (event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains('canvas_store')) {
                db.createObjectStore('canvas_store');
            }
        };
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readonly');
            var store = transaction.objectStore('canvas_store');
            var totalBytes = 0;
            
            var cursorRequest = store.openCursor();
            cursorRequest.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    var value = cursor.value;
                    if (value) {
                        totalBytes += estimateValueSize(value);
                    }
                    cursor.continue();
                } else {
                    callback(null, totalBytes);
                }
            };
            cursorRequest.onerror = function (e) {
                callback(e.target.error, null);
            };
        };
        request.onerror = function (event) {
            callback(event.target.error, null);
        };
    } catch (e) {
        callback(e, null);
    }
}

export function calculateProjectStorageUsage(projectId, callback) {
    try {
        var request = indexedDB.open('FluidPaintDB', 1);
        request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(['canvas_store'], 'readonly');
            var store = transaction.objectStore('canvas_store');
            
            var stateRequest = store.get('project_state_' + projectId);
            stateRequest.onsuccess = function (e) {
                var stateValue = e.target.result;
                var stateBytes = stateValue ? estimateValueSize(stateValue) : 0;
                
                var imagesRequest = store.get('reference_images_' + projectId);
                imagesRequest.onsuccess = function (ev) {
                    var imagesValue = ev.target.result;
                    var imagesBytes = imagesValue ? estimateValueSize(imagesValue) : 0;
                    
                    callback(null, stateBytes + imagesBytes);
                };
                imagesRequest.onerror = function (ev) {
                    callback(null, stateBytes);
                };
            };
            stateRequest.onerror = function (e) {
                callback(e.target.error, null);
            };
        };
        request.onerror = function (event) {
            callback(event.target.error, null);
        };
    } catch (e) {
        callback(e, null);
    }
}

function estimateValueSize(value) {
    var bytes = 0;
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return value.size;
    }
    if (typeof value === 'boolean') {
        return 4;
    }
    if (typeof value === 'number') {
        return 8;
    }
    if (typeof value === 'string') {
        return value.length * 2; // UTF-16 characters
    }
    if (value instanceof ArrayBuffer) {
        return value.byteLength;
    }
    if (ArrayBuffer.isView(value)) {
        return value.byteLength;
    }
    if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
            bytes += estimateValueSize(value[i]);
        }
        return bytes;
    }
    if (typeof value === 'object') {
        for (var key in value) {
            if (value.hasOwnProperty(key)) {
                bytes += key.length * 2;
                bytes += estimateValueSize(value[key]);
            }
        }
    }
    return bytes;
}
