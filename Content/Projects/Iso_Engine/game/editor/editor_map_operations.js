// rpg/game/editor/editor_map_operations.js
console.log("rpg/game/editor/editor_map_operations.js loaded");

import CustomDialog from '../ui/custom_dialog.js';
import { db, STORES } from '../utils/db.js';

function getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
        if (key === 'engine' || key === 'map' || key === 'sprite' || key === 'spriteImage' || key === 'dialogueUI' || key === 'uiManager' || key === 'editor' || key === 'game' || key === 'player' || key === 'gameObjects' || key === 'aiAdapter') {
            return undefined;
        }
        if (value instanceof HTMLElement || value instanceof Image || value instanceof HTMLCanvasElement) {
            return undefined;
        }
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return undefined;
            }
            seen.add(value);
        }
        return value;
    };
}

const RPG_EDITOR_MAP_PREFIX = 'rpgEditor_map_'; // Prefix for map keys in localStorage

class EditorMapOperations {
    constructor(editor) {
        this.editor = editor; // Reference to the main MapEditor instance
        this.engine = editor.engine;
        // Bound methods for direct use as event handlers
        this.promptNewMap = this._promptNewMap.bind(this);
        this.saveMapToLocal = this._saveMapToLocal.bind(this);
        this.loadMapFromLocal = this._loadMapFromLocal.bind(this);
        this.downloadMapFile = this._downloadMapFile.bind(this);
        this.triggerFileUpload = this._triggerFileUpload.bind(this);
        this.handleFileUpload = this._handleFileUpload.bind(this);
    }

    async _promptNewMap() {
        const result = await CustomDialog.promptNewMap(this.editor.map.width, this.editor.map.height);
        if (!result) return;

        const newWidth = result.width;
        const newHeight = result.height;

        this.editor.map.initializeNewMap(newWidth, newHeight, 1);
        if (this.engine.player) {
            const newPlayerMapX = Math.floor(newWidth / 2);
            const newPlayerMapY = Math.floor(newHeight / 2);
            const newScreenPos = this.editor.map.mapToScreen(newPlayerMapX, newPlayerMapY);
            this.engine.player.mapX = newPlayerMapX;
            this.engine.player.mapY = newPlayerMapY;
            this.engine.player.currentPixelX = newScreenPos.x;
            this.engine.player.currentPixelY = newScreenPos.y;
        }
        
        // Update light system to clear old masks from view
        const engine = this.editor.engine;
        engine.lightSystem.updateData(engine.map.getLightingData());
        const lightEditor = engine.editorManager.editors.light;
        if (lightEditor) {
            lightEditor.selectedMask = null;
            if (lightEditor.isActive) {
                lightEditor.refreshUI();
            }
        }
        
        CustomDialog.alert(`New ${newWidth}x${newHeight} map created.`, "Success");
    }

    async _saveMapToLocal() {
        if (!this.editor.uiManager) {
            CustomDialog.alert("UI Manager not available to prompt for map name.", "Error");
            return;
        }
        try {
            const currentMapName = this.editor.map.currentMapName || ''; // If map has a name, suggest it
            const mapName = await this.editor.uiManager.promptForMapName(currentMapName);

            if (!mapName || mapName.trim() === '') {
                CustomDialog.alert("Save cancelled or invalid map name.", "Save Cancelled");
                return;
            }

            const mapData = this.editor.map.serialize();
            mapData.mapName = mapName; // Store the name within the map data itself too
            
            // Save to IndexedDB (STORES.MAPS)
            await db.set(STORES.MAPS, mapName, mapData);
            
            // Also clean from legacy localStorage to avoid taking excessive space
            localStorage.removeItem(`${RPG_EDITOR_MAP_PREFIX}${mapName}`);

            this.editor.map.currentMapName = mapName; // Update current map's name
            CustomDialog.alert(`Map "${mapName}" saved securely in IndexedDB!`, "Map Saved");

        } catch (error) {
            console.error("Error saving map to IndexedDB:", error);
            CustomDialog.alert(`Error saving map: ${error.message}`, "Save Error");
        }
    }

    async _loadMapFromLocal() {
        try {
            const savedMaps = [];
            
            // 1. Fetch maps from IndexedDB
            try {
                const dbKeys = await db.getAllKeys(STORES.MAPS);
                for (const key of dbKeys) {
                    const mapData = await db.get(STORES.MAPS, key);
                    const mapSize = mapData ? JSON.stringify(mapData).length : 0;
                    savedMaps.push({
                        name: key,
                        size: mapSize,
                        source: 'IndexedDB'
                    });
                }
            } catch (dbError) {
                console.error("Error loading maps from IndexedDB:", dbError);
            }

            // 2. Fetch legacy maps from localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(RPG_EDITOR_MAP_PREFIX)) {
                    const mapName = key.substring(RPG_EDITOR_MAP_PREFIX.length);
                    // Avoid duplicating if it is already in IndexedDB
                    if (!savedMaps.some(m => m.name === mapName)) {
                        const mapString = localStorage.getItem(key);
                        savedMaps.push({
                            name: mapName,
                            size: mapString ? mapString.length : 0,
                            source: 'localStorage'
                        });
                    }
                }
            }

            // Sort maps by name for consistent ordering
            savedMaps.sort((a, b) => a.name.localeCompare(b.name));

            if (savedMaps.length === 0) {
                CustomDialog.alert("No saved maps found in storage.", "Load Maps");
                if (this.editor.uiManager && this.editor.uiManager.loadMapsListContainer) {
                     this.editor.uiManager.loadMapsListContainer.remove(); // Clear list if shown
                }
                return;
            }

            if (this.editor.uiManager) {
                this.editor.uiManager.displayLoadableMaps(savedMaps, 
                    (mapName) => { // Load callback
                        this._performLoadFromLocal(mapName);
                    },
                    (mapName) => { // Delete callback
                        this._deleteMapFromLocal(mapName);
                    }
                );
            } else {
                // Fallback if UI manager isn't available for listing (e.g. simple prompt)
                const savedMapNames = savedMaps.map(m => m.name);
                const mapToLoad = await CustomDialog.prompt(`Enter map name to load from: \n${savedMapNames.join('\n')}`, "", "Load Map Fallback");
                if (mapToLoad && savedMapNames.includes(mapToLoad)) {
                    this._performLoadFromLocal(mapToLoad);
                } else if (mapToLoad) {
                    CustomDialog.alert(`Map "${mapToLoad}" not found.`, "Load Error");
                }
            }

        } catch (error) {
            console.error("Error listing maps:", error);
            CustomDialog.alert(`Error listing maps: ${error.message}`, "Error");
        }
    }

    async _deleteMapFromLocal(mapName) {
        try {
            // Delete from IndexedDB and legacy localStorage
            await db.delete(STORES.MAPS, mapName);
            localStorage.removeItem(`${RPG_EDITOR_MAP_PREFIX}${mapName}`);
            
            // Refresh the list of maps
            this._loadMapFromLocal();
        } catch (error) {
            console.error(`Error deleting map "${mapName}":`, error);
            CustomDialog.alert(`Error deleting map: ${error.message}`, "Delete Error");
        }
    }

    async _performLoadFromLocal(mapName) {
        try {
            // Try loading from IndexedDB first
            let mapData = await db.get(STORES.MAPS, mapName);
            let mapSourceStr = 'IndexedDB';

            // Fallback to legacy localStorage if not in IndexedDB
            if (!mapData) {
                const mapString = localStorage.getItem(`${RPG_EDITOR_MAP_PREFIX}${mapName}`);
                if (mapString) {
                    mapData = JSON.parse(mapString);
                    mapSourceStr = 'legacy local storage';
                    // Auto-migrate to IndexedDB for safety
                    try {
                        await db.set(STORES.MAPS, mapName, mapData);
                        console.log(`Auto-migrated map "${mapName}" into IndexedDB.`);
                    } catch (mErr) {
                        console.error("Migration warning:", mErr);
                    }
                }
            }

            if (!mapData) {
                CustomDialog.alert(`Map "${mapName}" not found in storage.`, "Error");
                return;
            }

            // Use the engine's loadMap function
            const success = await this.engine.loadMap(mapData); // When loading from editor, we use default spawn point logic

            if (success) {
                CustomDialog.alert(`Map "${this.engine.map.currentMapName}" loaded successfully from ${mapSourceStr}!`, "Success");
            } else {
                CustomDialog.alert(`Failed to load map "${mapName}". Data might be corrupt. Check console.`, "Load Error");
            }
        } catch (error) {
            console.error(`Error loading map "${mapName}":`, error);
            CustomDialog.alert(`Error loading map "${mapName}": ${error.message}`, "Load Error");
        }
    }

    _downloadMapFile() {
        try {
            const mapData = this.editor.map.serialize();
            
            // Backup the original tiles
            const originalTiles = mapData.tiles;
            if (Array.isArray(originalTiles)) {
                mapData.tiles = originalTiles.map(row => {
                    return `__COMPACT_ROW_START__${JSON.stringify(row)}__COMPACT_ROW_END__`;
                });
            }
            
            let mapJson = JSON.stringify(mapData, getCircularReplacer(), 2);
            
            // Revert mapData.tiles back just in case
            if (Array.isArray(originalTiles)) {
                mapData.tiles = originalTiles;
            }
            
            // Post-process the JSON string to flatten compact rows into a single line
            mapJson = mapJson.replace(/"__COMPACT_ROW_START__([\s\S]*?)__COMPACT_ROW_END__"/g, (match, captured) => {
                try {
                    const parsedRow = JSON.parse(captured.replace(/\\"/g, '"'));
                    return JSON.stringify(parsedRow);
                } catch (e) {
                    return captured;
                }
            });

            const blob = new Blob([mapJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${mapData.mapName || 'map_data'}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            CustomDialog.alert("Map download initiated with compact tile arrays.", "Success");
        } catch (error) {
            console.error("Error downloading map file:", error);
            CustomDialog.alert(`Error downloading map: ${error.message}`, "Download Error");
        }
    }

    _triggerFileUpload() {
        // Assumes fileInput is on editor.uiManager instance
        if (this.editor.uiManager && this.editor.uiManager.fileInput) {
            this.editor.uiManager.fileInput.click();
        } else {
            console.error("File input not found on UI Manager for triggering upload.");
        }
    }

    _handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const mapData = JSON.parse(e.target.result);
                // Use the engine's new loadMap function
                const success = await this.engine.loadMap(mapData); // When loading from editor, we use default spawn point logic

                if (success) {
                    CustomDialog.alert(`Map "${file.name}" loaded successfully!`, "Success");
                } else {
                    CustomDialog.alert(`Failed to load map "${file.name}". Data might be corrupt or invalid. Check console.`, "Load Error");
                }
            } catch (error) {
                console.error(`Error parsing uploaded map file "${file.name}":`, error);
                CustomDialog.alert(`Error parsing map file "${file.name}": ${error.message}`, "Import Error");
            } finally {
                event.target.value = null;
            }
        };
        reader.onerror = (e) => {
            console.error(`Error reading file "${file.name}":`, e);
            CustomDialog.alert(`Error reading file "${file.name}".`, "Read Error");
            event.target.value = null;
        };
        reader.readAsText(file);
    }
}

export default EditorMapOperations;